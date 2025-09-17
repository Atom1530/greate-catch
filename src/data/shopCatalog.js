// src/data/shopCatalog.js
// Универсальный каталог магазина. Масштабируется без правок логики.
// Важно: поля capKg / pullBoost / control / pack и т.п. оставлены совместимыми
// с твоими слотами/инвентарём. Дополнительные поля (desc, rarity, tags, goldPrice)
// безопасны и могут быть проигнорированы текущим кодом.

export const ShopCatalog = {
  categories: ['sets', 'rods', 'reels', 'lines', 'hooks', 'bait'],

  // общие рекомендации по балансу/ценам:
  // - цена растёт примерно квадратично с уровнем мощности
  // - capKg/boost/control растут плавно; сеты дешевле суммы частей на 8–15%
  // - часть топовых предметов может иметь goldPrice (опционально)
  meta: {
    version: 1,
    currency: { coins: 'Монеты', gold: 'Золото' },
  },

  items: {
    // ================== СЕТЫ (комбо с небольшой скидкой) ==================
    sets: [
      {
        id: 'set_wood',
        name: 'Набор «Деревянный»',
        level: 1,
        price: 65, // ~ -10% vs сумма
        rarity: 'common',
        contains: [
          { kind: 'rods',  id: 'rod_wood_1'  },
          { kind: 'reels', id: 'reel_rusty'  },
          { kind: 'lines', id: 'line_old_1'  },
          { kind: 'hooks', id: 'hook_rusty'  },
          { kind: 'bait',  id: 'worm', qty: 25 }
        ],
        note: 'Бюджетный стартовый комплект',
        tags: ['starter','budget']
      },
      {
        id: 'set_birch',
        name: 'Набор «Берёзовый»',
        level: 3,
        price: 170,
        rarity: 'common',
        contains: [
          { kind: 'rods',  id: 'rod_birch_2'  },
          { kind: 'reels', id: 'reel_bronze'  },
          { kind: 'lines', id: 'line_solid_2' },
          { kind: 'hooks', id: 'hook_bronze'  },
          { kind: 'bait',  id: 'worm', qty: 25 }
        ],
        note: 'Повышенная прочность снастей',
        tags: ['balanced']
      },
      {
        id: 'set_pine',
        name: 'Набор «Сосновый»',
        level: 5,
        price: 320,
        rarity: 'uncommon',
        contains: [
          { kind: 'rods',  id: 'rod_pine_3'     },
          { kind: 'reels', id: 'reel_iron'      },
          { kind: 'lines', id: 'line_braided_3' },
          { kind: 'hooks', id: 'hook_steel'     },
          { kind: 'bait',  id: 'worm', qty: 25  }
        ],
        note: 'Приятный буст по тяге и запасу прочности',
        tags: ['power']
      },
      {
        id: 'set_ash',
        name: 'Набор «Ясень»',
        level: 7,
        price: 520,
        rarity: 'uncommon',
        contains: [
          { kind: 'rods',  id: 'rod_ash_4'        },
          { kind: 'reels', id: 'reel_steel'       },
          { kind: 'lines', id: 'line_braided_4'   },
          { kind: 'hooks', id: 'hook_tempered'    },
          { kind: 'bait',  id: 'worm_premium', qty: 25 }
        ],
        note: 'Стабильность на средних трофеях',
        tags: ['control','midgame']
      },
      {
        id: 'set_maple',
        name: 'Набор «Клён»',
        level: 9,
        price: 760,
        rarity: 'rare',
        contains: [
          { kind: 'rods',  id: 'rod_maple_5'  },
          { kind: 'reels', id: 'reel_chrome'  },
          { kind: 'lines', id: 'line_fluoro_5'},
          { kind: 'hooks', id: 'hook_chrome'  },
          { kind: 'bait',  id: 'worm_premium', qty: 25 }
        ],
        note: 'Тяга и контроль для крупняка',
        tags: ['big-fish','control']
      },
      {
        id: 'set_fiberglass',
        name: 'Набор «Стеклопластик»',
        level: 11,
        price: 1040,
        rarity: 'rare',
        contains: [
          { kind: 'rods',  id: 'rod_fiber_6'   },
          { kind: 'reels', id: 'reel_graphite' },
          { kind: 'lines', id: 'line_fluoro_6' },
          { kind: 'hooks', id: 'hook_titanium' },
          { kind: 'bait',  id: 'worm_premium', qty: 25 }
        ],
        note: 'Лёгкость и запас по прочности',
        tags: ['light','durable']
      },
      {
        id: 'set_carbon',
        name: 'Набор «Carbon Pro»',
        level: 14,
        price: 1420,
        goldPrice: 2, // опциональная часть цены золотом
        rarity: 'epic',
        contains: [
          { kind: 'rods',  id: 'rod_carbon_7'    },
          { kind: 'reels', id: 'reel_carbonpro'  },
          { kind: 'lines', id: 'line_ultra_7'    },
          { kind: 'hooks', id: 'hook_titanium_pro' },
          { kind: 'bait',  id: 'worm_premium', qty: 25 }
        ],
        note: 'Максимум контроля и рывка',
        tags: ['endgame','premium']
      },
    ],

    // ================== ОТДЕЛЬНЫЕ ПРЕДМЕТЫ ==================
    // ---- Удилища ----
    rods: [
      { id:'rod_wood_1',   name:'Деревянная удочка', capKg:1.0, level:1,  price:30,  rarity:'common',   set:'Деревянный', desc:'Простой, но рабочий старт' },
      { id:'rod_birch_2',  name:'Берёзовая удочка',  capKg:2.4, level:3,  price:90,  rarity:'common',   set:'Берёзовый',  desc:'Попрактичнее стартовой'   },
      { id:'rod_pine_3',   name:'Сосновая удочка',   capKg:3.2, level:5,  price:160, rarity:'uncommon', set:'Сосновый',   desc:'Больше запас по капу'     },
      { id:'rod_ash_4',    name:'Ясеневая удочка',   capKg:4.4, level:7,  price:260, rarity:'uncommon', set:'Ясень',      desc:'Хорошо держит натяжение'  },
      { id:'rod_maple_5',  name:'Клёновая удочка',   capKg:5.6, level:9,  price:380, rarity:'rare',     set:'Клён',       desc:'Для тяжёлых экземпляров'  },
      { id:'rod_fiber_6',  name:'Стеклопластиковая', capKg:7.0, level:11, price:520, rarity:'rare',     set:'Стеклопластик', desc:'Лёгко и крепко'       },
      { id:'rod_carbon_7', name:'Carbon Pro',        capKg:9.0, level:14, price:700, rarity:'epic',     set:'Carbon',     desc:'Топовый кап и отзывчивость' },
    ],

    // ---- Катушки ----
    reels: [
      { id:'reel_rusty',     name:'Ржавая катушка',    pullBoost:0.90, level:1,  price:20,  rarity:'common',   set:'Деревянный',  desc:'Чуть хуже базовой тяги' },
      { id:'reel_bronze',    name:'Бронзовая катушка', pullBoost:1.10, level:3,  price:70,  rarity:'common',   set:'Берёзовый',   desc:'Плюс к тяге'            },
      { id:'reel_iron',      name:'Железная катушка',  pullBoost:1.20, level:5,  price:120, rarity:'uncommon', set:'Сосновый',    desc:'Надёжная середина'      },
      { id:'reel_steel',     name:'Стальная катушка',  pullBoost:1.35, level:7,  price:200, rarity:'uncommon', set:'Ясень',       desc:'Ровная тяга'            },
      { id:'reel_chrome',    name:'Хромированная',     pullBoost:1.50, level:9,  price:300, rarity:'rare',     set:'Клён',        desc:'Солидный буст'          },
      { id:'reel_graphite',  name:'Графитовая',        pullBoost:1.65, level:11, price:420, rarity:'rare',     set:'Стеклопластик', desc:'Лёгкая, тяговитая'   },
      { id:'reel_carbonpro', name:'Carbon Pro Spool',  pullBoost:1.85, level:14, price:560, rarity:'epic',     set:'Carbon',      desc:'Максимальная тяга'      },
    ],

    // ---- Лески ----
    lines: [
      { id:'line_old_1',   name:'Старая леска',      capKg:1.2, level:1,  price:15,  rarity:'common',   set:'Деревянный',  desc:'Базовый кап'       },
      { id:'line_solid_2', name:'Прочная леска',     capKg:2.1, level:3,  price:55,  rarity:'common',   set:'Берёзовый',   desc:'Чуть крепче'       },
      { id:'line_braided_3', name:'Плетёнка МКIII',  capKg:3.0, level:5,  price:95,  rarity:'uncommon', set:'Сосновый',    desc:'Хорошо держит рывки' },
      { id:'line_braided_4', name:'Плетёнка МКIV',   capKg:4.0, level:7,  price:150, rarity:'uncommon', set:'Ясень',       desc:'Сильнее и стабильнее' },
      { id:'line_fluoro_5',  name:'Флюорокарбон X5', capKg:5.0, level:9,  price:210, rarity:'rare',     set:'Клён',        desc:'Износостойкая'     },
      { id:'line_fluoro_6',  name:'Флюорокарбон X6', capKg:6.2, level:11, price:280, rarity:'rare',     set:'Стеклопластик', desc:'Топ для тяжёлых' },
      { id:'line_ultra_7',   name:'ULTRA Mono 7',    capKg:7.8, level:14, price:360, rarity:'epic',     set:'Carbon',      desc:'Запас для трофеев' },
    ],

    // ---- Крючки ----
    hooks: [
      { id:'hook_rusty',        name:'Ржавый крючок',       control:0.90, level:1,  price:10, pack:5, rarity:'common',   set:'Деревянный',  desc:'Срывы случаются' },
      { id:'hook_bronze',       name:'Бронзовый крючок',    control:1.10, level:3,  price:35, pack:5, rarity:'common',   set:'Берёзовый',   desc:'Поплотнее держит' },
      { id:'hook_steel',        name:'Стальной крючок',     control:1.20, level:5,  price:60, pack:5, rarity:'uncommon', set:'Сосновый',    desc:'Чаще досаживает рыбе' },
      { id:'hook_tempered',     name:'Закалённый крючок',   control:1.30, level:7,  price:85, pack:5, rarity:'uncommon', set:'Ясень',       desc:'Надёжная фиксация' },
      { id:'hook_chrome',       name:'Хромированный крючок',control:1.42, level:9,  price:115,pack:5, rarity:'rare',     set:'Клён',        desc:'Меньше сходов' },
      { id:'hook_titanium',     name:'Титановый крючок',    control:1.55, level:11, price:160,pack:5, rarity:'rare',     set:'Стеклопластик', desc:'Легкий и злой' },
      { id:'hook_titanium_pro', name:'Titan Pro Hook',      control:1.70, level:14, price:220,pack:5, rarity:'epic',     set:'Carbon',      desc:'Почти «как на липучке»' },
    ],

    // ---- Наживка ----
    // ВНИМАНИЕ: сейчас у тебя оснастка фактически потребляет только worm из gear.inv.bait.
    // Поэтому оставляем лишь совместимые пакеты червей. Остальные виды — легко добавить позже.
    bait: [
      { id:'worm',          name:'Червь (25 шт.)',           pack:25, level:1, price:15,  rarity:'common',  desc:'Базовая наживка' },
      { id:'worm_premium',  name:'Червь премиум (25 шт.)',   pack:25, level:2, price:25,  rarity:'uncommon',desc:'Дольше живёт'    },
      // примеры на будущее (пока не используем в логике):
      // { id:'maggot_pack', name:'Опарыш (30 шт.)', pack:30, level:2, price:22, rarity:'common' },
      // { id:'leech_pack',  name:'Пиявка (10 шт.)', pack:10, level:6, price:50, rarity:'uncommon' },
    ],
  },
};

// ———————————————————————————————————————————————————————————————
// Хелпер: мягко влить определения в GearDB, чтобы слоты знали про новые id
export function ensureCatalogInGearDB(GearDB){
  const add = (arrName, obj, key='id') => {
    GearDB[arrName] = GearDB[arrName] || [];
    const exists = GearDB[arrName].some(x => x[key] === obj[key]);
    if (!exists) GearDB[arrName].push(obj);
  };

  // В снарягу льём только то, что реально нужно UI слотов/мерджа:
  for (const r of ShopCatalog.items.rods)   add('rods',  { id:r.id,  name:r.name,  capKg:r.capKg });
  for (const r of ShopCatalog.items.lines)  add('lines', { id:r.id,  name:r.name,  capKg:r.capKg });
  for (const r of ShopCatalog.items.hooks)  add('hooks', { id:r.id,  name:r.name,  control:r.control });
  for (const r of ShopCatalog.items.reels)  add('reels', { id:r.id,  name:r.name,  pullBoost:r.pullBoost });
}

// (опционально) мини-утилиты — удобно для будущего ShopModal:
export function getItemById(kind, id){
  const list = ShopCatalog.items[kind] || [];
  return list.find(x => x.id === id) || null;
}

export function listByCategory(kind){
  return [...(ShopCatalog.items[kind] || [])];
}
