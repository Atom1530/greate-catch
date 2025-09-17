// src/sim/spawn.js
import { FishCatalog } from '../data/fish.js';
import { LootCatalog } from '../data/loot.js';
import { SPAWN_TABLES } from '../data/spawnTables.js';

// Единый каталог: рыбе проставим kind='fish'
const Catalog = [
  ...FishCatalog.map(s => ({ ...s, kind: 'fish' })),
  ...LootCatalog
];
const DEBUG_SPAWN = true;


function weightFromTable(loc, id) {
  const v = (SPAWN_TABLES[loc] || {})[id];
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  return v.w ?? 1;
}

function timeAllowed(def, tag){
  const pref = def?.prefers?.time;
  if (!pref || !Array.isArray(pref) || pref.length === 0) return true;
  return pref.includes(tag);   // <-- БЕЗ поблажек 
}


function depthRangeFromTable(loc, id) {
  const v = (SPAWN_TABLES[loc] || {})[id];
  if (v && typeof v === 'object') {
    return [v.minDepth ?? -Infinity, v.maxDepth ?? Infinity];
  }
  return [-Infinity, Infinity];
}

function pickWeighted(pairs) {
  const sum = pairs.reduce((s, [, w]) => s + w, 0);
  if (sum <= 0) return pairs[0]?.[0] ?? null;
  let r = Math.random() * sum;
  for (const [obj, w] of pairs) { r -= w; if (r <= 0) return obj; }
  return pairs[pairs.length - 1][0];
}

// Вес (кг) только для рыбы
function rollWeight(spec, bait) {
  const [minW, maxW] = spec.baseWeight || [0.2, 2.0];
  const baseBias = spec.weightBias ?? 1.6; // >1 → чаще к min
  const bias = (spec.prefers?.baits?.includes(bait)) ? baseBias * 0.8 : baseBias;
  const t = Math.pow(Math.random(), bias);
  return +(minW + t * (maxW - minW)).toFixed(3);
}

// Награды для лута/мусора/побочки
function randInt(a, b) { return Math.floor(a + Math.random() * (b - a + 1)); }
function rollReward(spec) {
  if (spec.reward?.coins) {
    const [a, b] = spec.reward.coins;
    return { coins: randInt(a, b) };
  }
  if (spec.sell?.price) return { coins: spec.sell.price };
  return {};
}

// === ОСНОВНАЯ ФУНКЦИЯ ===
export function spawnFish(ctx = {}) {
  const bait = ctx.bait ?? 'worm';
  const tod  = ctx.timeOfDay ?? 'day';
  const loc  = ctx.locationId ?? 'lake';
  const d    = ctx.depthM ?? 1.5;

  console.log('[spawnFish ctx]', { bait, tod, loc, depthM: d });

// 1) Жёсткий фильтр по каталогу и таблицам (с диагностикой)
const candidates = Catalog.filter(sp => {
  if (sp.habitats && !sp.habitats.includes(loc)) {
    if (DEBUG_SPAWN) console.log('–', sp.id, 'нет в habitat', loc);
    return false;
  }

  if (sp.prefers?.baits && !sp.prefers.baits.includes(bait)) {
    if (DEBUG_SPAWN) console.log('–', sp.id, 'bait!=', bait);
    return false;
  }

  if (!timeAllowed(sp, tod)) {
    if (DEBUG_SPAWN) console.log('–', sp.id, 'time!=', tod, 'need one of', sp.prefers?.time);
    return false;
  }

  if (sp.prefers?.depth?.length === 2) {
    const [d0, d1] = sp.prefers.depth;
    if (d < d0 || d > d1) {
      if (DEBUG_SPAWN) console.log('–', sp.id, `depth ${d} ∉ [${d0}, ${d1}]`);
      return false;
    }
  }

  const [minD, maxD] = depthRangeFromTable(loc, sp.id);
  if (d < minD || d > maxD) {
    if (DEBUG_SPAWN) console.log('–', sp.id, `depth ${d} ∉ table[${minD}, ${maxD}]`);
    return false;
  }

  const w = weightFromTable(loc, sp.id);
  if (!(w > 0)) {
    if (DEBUG_SPAWN) console.log('–', sp.id, 'weight=0');
    return false;
  }
  return true;
});


if (!candidates.length) {
  console.warn('[spawnFish] no candidates after filters', { loc, d, bait, tod });
  return null;
}

const pool = candidates;

  if (!pool.length) {
    console.warn('[spawnFish] empty pool', { loc, d, bait, tod });
    return null;
  }

  // 2) Веса: таблица × тип × зональные множители (только для рыбы)
  const areaMods = (x, y) => {
    if (typeof ctx.getAreaMods === 'function') return ctx.getAreaMods(x, y);
    if (typeof ctx.getSpotMods === 'function') return ctx.getSpotMods(x, y);
    return null;
  };

  // Чем меньше множитель — тем реже тип.
  const TYPE_WEIGHT = { fish: 1.0, loot: 0.06, bycatch: 0.12, trash: 0.10 };

  const pairs = pool.map(sp => {
    let w = weightFromTable(loc, sp.id) * (TYPE_WEIGHT[sp.kind] ?? 1);
    if (sp.kind === 'fish' && ctx.cast) {
      const mul = areaMods(ctx.cast.x, ctx.cast.y)?.species?.[sp.id];
      if (mul) w *= mul;
    }
    return [sp, Math.max(0, w)];
  });

  console.log('[spawnFish pool]', pool.map(s => `${s.kind}:${s.id}`));
  console.table(pairs.map(([s, w]) => ({ id: s.id, kind: s.kind, w })));

  // 3) Выбор
  const chosenSpec = pickWeighted(pairs) || pairs[0][0];
  const chosenW = pairs.find(([s]) => s.id === chosenSpec.id)?.[1];
  console.log('[spawnFish chosen]', chosenSpec.kind, chosenSpec.id, 'w=', chosenW, 'depth=', d);

  // 4) Построение результата
  if (chosenSpec.kind === 'fish') {
    const weightKg = rollWeight(chosenSpec, bait);
    return {
      kind: 'fish',
      id: chosenSpec.id,
      name: chosenSpec.name,
      weightKg,
      priceKg: chosenSpec.pricePerKg ?? 1,
      maxKg:   chosenSpec.baseWeight?.[1] ?? weightKg,
      spec: chosenSpec
    };
  } else {
    const reward = rollReward(chosenSpec);
    return {
      kind: chosenSpec.kind,   // 'loot' | 'trash' | 'bycatch'
      id: chosenSpec.id,
      name: chosenSpec.name,
      reward,
      spec: chosenSpec
    };
  }
}
