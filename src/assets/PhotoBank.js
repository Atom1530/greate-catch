// src/assets/PhotoBank.js
// ЕДИНЫЙ фотобанк: рыба (src/assets/fish/*.png) и лут/мусор (src/assets/pick/*.png)

import { SPAWN_TABLES } from '../data/spawnTables.js';
import { FishCatalog } from '../data/fish.js';
import { LootCatalog } from '../data/loot.js';

// ─────────────────────────────────────────────────────────────────────────────
// Утилиты каталога
// ─────────────────────────────────────────────────────────────────────────────
function _toIdArray(cat) {
  const arr = Array.isArray(cat?.items) ? cat.items : (Array.isArray(cat) ? cat : []);
  return arr.map(x => x?.id).filter(Boolean);
}
const FISH_IDS = new Set(_toIdArray(FishCatalog));
const PICK_IDS = new Set(_toIdArray(LootCatalog));

// ─────────────────────────────────────────────────────────────────────────────
// Подхватываем все изображения заранее (Vite добавит их в бандл и вернёт URL)
// КЛЮЧ ВАЖЕН: шаблоны путей должны быть ЛИТЕРАЛАМИ
// ─────────────────────────────────────────────────────────────────────────────
const fishFiles = import.meta.glob('./fish/*.png', { eager: true, import: 'default' });
const pickFiles = import.meta.glob('./pick/*.png', { eager: true, import: 'default' });

function _toNameUrlMap(obj) {
  const m = new Map();
  for (const [path, url] of Object.entries(obj)) {
    const lastSlash = path.lastIndexOf('/') + 1;
    const name = path.slice(lastSlash, -4); // имя файла без .png
    m.set(name, url);
  }
  return m;
}
const FISH_URL = _toNameUrlMap(fishFiles);
const PICK_URL = _toNameUrlMap(pickFiles);

// Если нужно сопоставить id и другое имя файла — заполни ALIAS
const ALIAS = {
  fish: {
    // crucian: 'gold-crucian',
  },
  pick: {
    // rusty_can: 'rusty-can',
  },
};

// Кеши: чтобы не перезагружать то, чего нет/что уже есть
const _MISSING = new Set(); // 'fish_crucian', 'pick_rusty_can', ...
const _LOADED  = new Set();

// ─────────────────────────────────────────────────────────────────────────────
// Базовые хелперы
// ─────────────────────────────────────────────────────────────────────────────
function key(kind, id) { return `${kind}_${id}`; }

/** Возвращает URL картинки из бандла или null, если файла нет */
function file(kind, id) {
  const name = (ALIAS[kind]?.[id]) ?? id;
  const url =
    kind === 'fish' ? FISH_URL.get(name)
    : kind === 'pick' ? PICK_URL.get(name)
    : null;

  if (!url) {
    console.warn('[photo MISSING in bundle]', kind, name);
    return null;
  }
  return url;
}

function idsForLocation(locId) {
  const table = SPAWN_TABLES?.[locId] || {};
  const ids = Object.keys(table);
  return {
    fish: ids.filter(id => FISH_IDS.has(id)),
    pick: ids.filter(id => PICK_IDS.has(id)),
  };
}
function fishIdsForLocation(locId) { return idsForLocation(locId).fish; }
function pickIdsForLocation(locId) { return idsForLocation(locId).pick; }

function _attachLogsOnce(scene) {
  if (scene._photoBankLogsAttached) return;
  scene._photoBankLogsAttached = true;

  scene.load.on('filecomplete', (k, type) => {
    if (type === 'image' && (k.startsWith('fish_') || k.startsWith('pick_'))) {
      _MISSING.delete(k);
      _LOADED.add(k);
      const kind = k.startsWith('fish_') ? 'fish' : 'pick';
      console.log(`[${kind} photo OK]`, k);
    }
  });

  scene.load.on('loaderror', (file) => {
    const k = file?.key ?? '';
    if (file?.type === 'image' && (k.startsWith('fish_') || k.startsWith('pick_'))) {
      _MISSING.add(k);
      console.warn('[photo LOAD ERROR]', k, file?.src);
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Публичные API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Поставить в очередь загрузку картинок для локации.
 * @param {Phaser.Scene} scene
 * @param {string} locId
 * @param {{fish?:boolean, pick?:boolean}=} opts — фильтр (по умолчанию оба true)
 */
function queueForScene(scene, locId, opts = { fish: true, pick: true }) {
  const lists = idsForLocation(locId);
  const doFish = opts.fish !== false;
  const doPick = opts.pick !== false;

  const oldPath = scene.load.path;
  scene.load.setPath(''); // не конфликтуем с глобальным base path

  let enqFish = 0, enqPick = 0;

  if (doFish) {
    for (const id of lists.fish) {
      const k = key('fish', id);
      if (scene.textures.exists(k) || _LOADED.has(k) || _MISSING.has(k)) continue;
      const url = file('fish', id);
      if (!url) { _MISSING.add(k); continue; }
      scene.load.image(k, url);
      enqFish++;
    }
  }

  if (doPick) {
    for (const id of lists.pick) {
      const k = key('pick', id);
      if (scene.textures.exists(k) || _LOADED.has(k) || _MISSING.has(k)) continue;
      const url = file('pick', id);
      if (!url) { _MISSING.add(k); continue; }
      scene.load.image(k, url);
      enqPick++;
    }
  }

  scene.load.setPath(oldPath);
  _attachLogsOnce(scene);

  return { fish: enqFish, pick: enqPick };
}

/**
 * Догружает одну картинку нужного типа.
 * @param {Phaser.Scene} scene
 * @param {'fish'|'pick'} kind
 * @param {string} id
 * @returns {Promise<string|null>} ключ текстуры или null, если файла нет
 */
function ensureOne(scene, kind, id) {
  const k = key(kind, id);
  if (scene.textures.exists(k)) return Promise.resolve(k);
  if (_MISSING.has(k))         return Promise.resolve(null);

  const url = file(kind, id);
  if (!url) { _MISSING.add(k); return Promise.resolve(null); }

  return new Promise((resolve) => {
    _attachLogsOnce(scene);

    const onDone = (doneKey, type) => {
      if (doneKey === k && type === 'image') {
        scene.load.off('filecomplete', onDone);
        resolve(k);
      }
    };

    scene.load.on('filecomplete', onDone);
    scene.load.image(k, url);
    scene.load.start();
  });
}

// Экспорт совместим с FishPhotos/PickPhotos
export default {
  // ключи/пути
  key, file,
  keyFor: key,
  fileFor: file,
  keyForFish: (id) => key('fish', id),
  keyForPick: (id) => key('pick', id),

  // выбор по локации
  idsForLocation,
  fishIdsForLocation,
  pickIdsForLocation,

  // загрузка
  queueForScene,
  ensureOne,
};
