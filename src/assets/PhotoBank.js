// ЕДИНЫЙ фотобанк: рыба (src/assets/fish/*.png) и лут/мусор (src/assets/pick/*.png)
import Phaser from "phaser";
import { SPAWN_TABLES } from '../data/spawnTables.js';
import { FishCatalog } from '../data/fish.js';
import { LootCatalog } from '../data/loot.js';

// ——— собрать массив id из каталога (поддерживаем и Array, и {items:[]}) ———
function _toIdArray(cat) {
  const arr = Array.isArray(cat?.items) ? cat.items
            : (Array.isArray(cat) ? cat : []);
  return arr.map(x => x?.id).filter(Boolean);
}

const FISH_IDS = new Set(_toIdArray(FishCatalog));
const PICK_IDS = new Set(_toIdArray(LootCatalog));

// Базовые папки через import.meta.url → стабильный абсолютный URL и в dev, и в build
const ROOT_URL = new URL('./', import.meta.url);
const BASE_URL = {
  fish: new URL('fish/', ROOT_URL),
  pick: new URL('pick/', ROOT_URL),
};

// Алиасы по умолчанию ПУСТЫЕ — используем ровно такие имена, как у файлов.
// Если захочешь — добавь здесь сопоставления: { crucian:'gold-crucian' } и т.п.
const ALIAS = {
  fish: {
    // crucian: 'gold-crucian',
  },
  pick: {
    // rusty_can: 'rusty-can',
  },
};

// Кеш, чтобы не пытаться грузить отсутствующие файлы заново каждый раз
const _MISSING = new Set(); // 'fish_crucian', 'pick_rusty_can', ...
const _LOADED  = new Set();

// ——— общие вспомогательные ———
function key(kind, id) { return `${kind}_${id}`; }
function file(kind, id) {
  const name = (ALIAS[kind]?.[id]) ?? id;
  return new URL(`${name}.png`, BASE_URL[kind]).href;
}

function idsForLocation(locId) {
  const table = SPAWN_TABLES?.[locId] || {};
  const ids = Object.keys(table);
  return {
    fish: ids.filter(id => FISH_IDS.has(id)),
    pick: ids.filter(id => PICK_IDS.has(id)),
  };
}

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
      console.warn('[photo MISSING]', k, file?.src);
    }
  });
}

// ——— публичные API ———
function queueForScene(scene, locId) {
  const { fish, pick } = idsForLocation(locId);

  const oldPath = scene.load.path;
  scene.load.setPath(''); // не конфликтуем с base path фона/звуков

  let enqFish = 0, enqPick = 0;

  for (const id of fish) {
    const k = key('fish', id);
    if (scene.textures.exists(k) || _LOADED.has(k) || _MISSING.has(k)) continue;
    scene.load.image(k, file('fish', id));
    enqFish++;
  }

  for (const id of pick) {
    const k = key('pick', id);
    if (scene.textures.exists(k) || _LOADED.has(k) || _MISSING.has(k)) continue;
    scene.load.image(k, file('pick', id));
    enqPick++;
  }

  scene.load.setPath(oldPath);
  _attachLogsOnce(scene);

  return { fish: enqFish, pick: enqPick };
}

function ensureOne(scene, kind, id) {
  const k = key(kind, id);
  if (scene.textures.exists(k)) return Promise.resolve(k);
  if (_MISSING.has(k))         return Promise.resolve(null);

  return new Promise((resolve) => {
    _attachLogsOnce(scene);
    const url = file(kind, id);

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

export default {
  // ключ/путь
  key, file,
  keyFor: key,
  fileFor: file,

  keyForFish: (id) => key('fish', id),
  keyForPick: (id) => key('pick', id),

  // выбор по локации и загрузка
  idsForLocation,
  queueForScene,

  // догрузка одной
  ensureOne,
};
