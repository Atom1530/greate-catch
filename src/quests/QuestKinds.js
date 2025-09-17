// src/quests/QuestKinds.js
// Централизованный реестр типов задач. Теперь учитываем тип события: catch | wallet | shop | level | inventory

function inRange(val, [min, max]) {
  const v = Number(val);
  const lo = (min ?? -Infinity);
  const hi = (max ?? +Infinity);
  return Number.isFinite(v) && v >= lo && v <= hi;
}
function normStr(x){ return String(x||'').trim().toLowerCase(); }
function evIs(ctx, ...evs){ const ev = ctx?.ev ?? 'catch'; return evs.includes(ev); }

function weightToG(pick) {
  if (!pick) return null;
  if (typeof pick.weightG === 'number') return pick.weightG|0;
  if (typeof pick.weightKg === 'number') return Math.round(pick.weightKg * 1000);
  return null;
}
function getSpeciesId(pick) {
  return pick?.speciesId ?? pick?.species ?? pick?.id ?? null;
}
function normTime(s) {
  const t = normStr(s);
  if (!t) return null;
  // приведение фаз визуалки к игровым слотам времени
  if (['dawn','рассвет','світанок'].includes(t)) return 'morning';
  if (['dusk','закат','сутінки'].includes(t))     return 'evening';

  if (['morning','утро','ранок'].includes(t))  return 'morning';
  if (['day','день'].includes(t))              return 'day';
  if (['evening','вечер','вечiр','вечір'].includes(t)) return 'evening';
  if (['night','ночь','ніч'].includes(t))      return 'night';
  return t;
}
function listFromKgOrG(params){
  // Поддерживаем params.valuesG (массив), params.valueG (число),
  // params.valuesKg / valueKg — автоматически конвертируем в граммы
  if (!params) return null;
  if (Array.isArray(params.valuesG)) return params.valuesG.map(n=>Number(n)||0);
  if (typeof params.valueG === 'number') return [params.valueG];
  if (Array.isArray(params.valuesKg)) return params.valuesKg.map(n=>Math.round(Number(n)*1000));
  if (typeof params.valueKg === 'number') return [Math.round(Number(params.valueKg)*1000)];
  return null;
}

function _anyHasItemId(arr, wantId){
  if (!Array.isArray(arr)) return false;
  return arr.some(it => (typeof it === 'string') ? (it === wantId) : (it?.id === wantId));
}

export const QuestKinds = Object.freeze({
  // =============== CATCH-ивенты ===============
  catch_count(task, pick, ctx) {
    if (!evIs(ctx,'catch')) return false;
    return pick?.kind === 'fish';
  },

  // Весовой коридор в граммах
  catch_weight_range_g(task, pick, ctx) {
    if (!evIs(ctx,'catch') || pick?.kind !== 'fish') return false;
    const w = weightToG(pick);
    const range = task?.params?.weightG ?? task?.params?.rangeG ?? task?.params?.g;
    if (!Array.isArray(range) || range.length !== 2) return false;
    return inRange(w, range);
  },

  // Точный вес (под твои 0.111, 0.222, ... кг). Поддержка кг/г + допуск.
  // params: { valuesKg:[0.111,0.222], toleranceG?:2, ignoreZero?:true }
  catch_weight_exact_g(task, pick, ctx){
    if (!evIs(ctx,'catch') || pick?.kind !== 'fish') return false;
    const w = weightToG(pick);
    if (w == null) return false;

    const { toleranceG = 2, ignoreZero = true } = task?.params || {};
    if (ignoreZero && w <= 0) return false;

    const targetsG = listFromKgOrG(task?.params);
    if (!targetsG || !targetsG.length) return false;

    // Совпадение с допуском ±toleranceG (например, 0.111 кг → 111 г ± 2 г)
    return targetsG.some(tg => Math.abs(w - (tg|0)) <= (toleranceG|0));
  },

  // Виды
  catch_species(task, pick, ctx) {
    if (!evIs(ctx,'catch') || pick?.kind !== 'fish') return false;
    const want = task?.params?.species;
    if (!want) return false;
    const have = getSpeciesId(pick);
    return Array.isArray(want) ? want.includes(have) : (have === want);
  },

  // Глубина
  catch_depth_range_m(task, _pick, ctx) {
    if (!evIs(ctx,'catch')) return false;
    const dm = Number(ctx?.depthM);
    const range = task?.params?.depthM ?? task?.params?.m;
    if (!Array.isArray(range) || range.length !== 2) return false;
    return inRange(dm, range);
  },

  // Наживка
  catch_bait_is(task, _pick, ctx) {
    if (!evIs(ctx,'catch')) return false;
    const want = normStr(task?.params?.bait ?? task?.params?.id);
    const have = normStr(ctx?.bait);
    return !!want && !!have && want === have;
  },

  // Локация
  catch_in_location(task, _pick, ctx) {
    if (!evIs(ctx,'catch')) return false;
    const loc = ctx?.locationId;
    const want = task?.params?.locations ?? task?.params?.location;
    return Array.isArray(want) ? want.includes(loc) : (want ? loc === want : false);
  },

  // Время суток
  catch_time_of_day(task, _pick, ctx) {
    if (!evIs(ctx,'catch')) return false;
    const want = task?.params?.time ?? task?.params?.times;
    const have = normTime(ctx?.timeOfDay);
    if (!have || !want) return false;
    const arr = Array.isArray(want) ? want : [want];
    return arr.map(normTime).includes(have);
  },

  // Лут
loot_any(task, pick, ctx) {
  if (!evIs(ctx,'catch')) return false;
  // засчитываем всё не-рыбу
  return pick && pick.kind && pick.kind !== 'fish';
},

  // =============== WALLET-ивенты ===============
  // params: { coins: 1000 }
  wallet_coins_at_least(task, wallet, ctx) {
    if (!evIs(ctx,'wallet')) return false;
    const need = Number(task?.params?.coins ?? 0);
    return Number(wallet?.coins ?? 0) >= need;
  },
  // params: { gold: 2 }
  wallet_gold_at_least(task, wallet, ctx) {
    if (!evIs(ctx,'wallet')) return false;
    const need = Number(task?.params?.gold ?? 0);
    return Number(wallet?.gold ?? 0) >= need;
  },

  // =============== LEVEL-ивенты ===============
  // params: { level: 3 }
  reach_level_at_least(task, prog, ctx) {
    if (!evIs(ctx,'level')) return false;
    const need = Number(task?.params?.level ?? 0);
    const cur  = Number(prog?.level ?? 1);
    return cur >= need;
  },

  // =============== SHOP/INVENTORY-ивенты ===============
  // params: { itemId:'rod_basic' }
  buy_item_id(task, purchase, ctx) {
    if (!evIs(ctx,'shop')) return false;
    const want = task?.params?.itemId;
    return !!want && purchase?.itemId === want;
  },

  // params: { kind:'rod', count:2 }
  own_item_kind_count_at_least(task, inventory, ctx) {
    if (!evIs(ctx,'inventory')) return false;
    const kind = task?.params?.kind; // 'rod'|'reel'|'line'|'hook' и т.п.
    const need = Number(task?.params?.count ?? 1);
    if (!kind) return false;
    const arr = Array.isArray(inventory?.[kind+'s']) ? inventory[kind+'s'] : [];
    return arr.length >= need;
  },

  // params: { itemId:'rod_pro' }
 own_item_id(task, inventory, ctx) {
    if (!evIs(ctx,'inventory')) return false;
    const want = task?.params?.itemId;
    if (!want) return false;

    // стандартные категории (массивы строк или объектов)
    const cats = ['rods','reels','lines','hooks','items'];
    for (const c of cats) {
      if (_anyHasItemId(inventory?.[c], want)) return true;
    }

    // наживки могут быть как массивы, так и map
    const baits = inventory?.baits || inventory?.bait;
    if (Array.isArray(baits)) {
      if (_anyHasItemId(baits, want)) return true;
    } else if (baits && typeof baits === 'object') {
      if (Object.prototype.hasOwnProperty.call(baits, want) && (baits[want]|0) > 0) return true;
    }
    return false;
  },
});

// Единая точка матчинга
export function matchTask(task, payload, ctx) {
  const fn = QuestKinds[task?.kind];
  if (!fn) return false;
  try { return !!fn(task, payload, ctx); } catch { return false; }
}
