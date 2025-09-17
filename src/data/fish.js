// src/data/fish.js
export const FishCatalog = [
  // ——— базовые «мирные» ———
  {
    id: 'crucian', name: 'Карась', rarity: 'common',
    baseWeight: [0.20, 2.30], weightBias: 1.7,
    marketMinKg: 0.80, pricePerKg: 4, wholesaleFactor: 0.6,
    info: 'Неприхотливый, держится у травы и кромок, любит тёплую воду и прикорм.',
    habitats: ['lake','pond'],
    prefers: { baits: ['worm','bread','corn'], time: ['dawn','day','evening'], depth: [0.3, 2.5] }
  },
  {
    id: 'roach', name: 'Плотва', rarity: 'common',
    baseWeight: [0.10, 1.20], weightBias: 1.6,
    marketMinKg: 0.60, pricePerKg: 3, wholesaleFactor: 0.6,
    info: 'Стаи держатся на бровках и у кувшинок, хорошо берёт растительные насадки.',
    habitats: ['lake','river'],
    prefers: { baits: ['worm','bread'], time: ['dawn','day','evening'], depth: [0.4, 3.0] }
  },
  {
    id: 'bleak', name: 'Уклейка', rarity: 'common',
    baseWeight: [0.03, 0.15], weightBias: 1.2,
    marketMinKg: 0.10, pricePerKg: 2.2, wholesaleFactor: 0.55,
    info: 'Поверхностная стайная рыба, часто на мелководье и под самой плоскостью воды.',
    habitats: ['lake','river'],
    prefers: { baits: ['bread','worm'], time: ['dawn','day','evening'], depth: [0.1, 1.0] }
  },
  {
    id: 'bream', name: 'Лещ', rarity: 'uncommon',
    baseWeight: [0.60, 3.00], weightBias: 1.7,
    marketMinKg: 1.20, pricePerKg: 6, wholesaleFactor: 0.65,
    info: 'Предпочитает свалы и ямы, активнее сумерками и ночью. Любит прикорм.',
    habitats: ['lake','river'],
    prefers: { baits: ['worm','corn'], time: ['dawn','evening','night'], depth: [1.5, 6.0] }
  },
  {
    id: 'tench', name: 'Линь', rarity: 'uncommon',
    baseWeight: [0.40, 2.80], weightBias: 1.7,
    marketMinKg: 1.00, pricePerKg: 7, wholesaleFactor: 0.7,
    info: 'Тихие заросшие заливы; активен на зорях.',
    habitats: ['lake','pond'],
    prefers: { baits: ['worm','corn'], time: ['dawn','evening'], depth: [0.5, 2.5] }
  },
  {
    id: 'ide', name: 'Язь', rarity: 'uncommon',
    baseWeight: [0.50, 2.50], weightBias: 1.6,
    marketMinKg: 1.20, pricePerKg: 6, wholesaleFactor: 0.65,
    info: 'Сильная рыба струй и обраток; клюёт на животные и растительные насадки.',
    habitats: ['lake','river'],
    prefers: { baits: ['worm','bread'], time: ['dawn','day','evening'], depth: [0.5, 2.5] }
  },

  // ——— добавленные мирные ———
  {
    id: 'rudd', name: 'Краснопёрка', rarity: 'common',
    baseWeight: [0.05, 0.60], weightBias: 1.5,
    marketMinKg: 0.25, pricePerKg: 3.5, wholesaleFactor: 0.6,
    info: 'Любит кувшинки и кромки растительности; берёт лёгкие насадки в полводы.',
    habitats: ['lake','pond','river'],
    prefers: { baits: ['bread','worm'], time: ['dawn','day','evening'], depth: [0.3, 2.0] }
  },
  {
    id: 'silver_bream', name: 'Густера', rarity: 'common',
    baseWeight: [0.20, 1.20], weightBias: 1.7,
    marketMinKg: 0.60, pricePerKg: 3.8, wholesaleFactor: 0.6,
    info: 'Родственница леща; предпочитает поглубже и активна сумерками.',
    habitats: ['lake','river'],
    prefers: { baits: ['worm'], time: ['dawn','evening','night'], depth: [1.5, 4.0] }
  },
  {
    id: 'dace', name: 'Елец', rarity: 'common',
    baseWeight: [0.05, 0.40], weightBias: 1.5,
    marketMinKg: 0.20, pricePerKg: 3.2, wholesaleFactor: 0.6,
    info: 'Мелкие быстрые струи, чистая вода; любит мелкие животные насадки.',
    habitats: ['river'],
    prefers: { baits: ['worm','bread'], time: ['dawn','day','evening'], depth: [0.3, 2.0] }
  },
  {
    id: 'chub', name: 'Голавль', rarity: 'uncommon',
    baseWeight: [0.40, 3.00], weightBias: 1.6,
    marketMinKg: 1.00, pricePerKg: 7, wholesaleFactor: 0.7,
    info: 'Перекаты и коряжник; полу-хищник, берёт насадки и вертушки.',
    habitats: ['river'],
    prefers: { baits: ['worm','bread','spinner'], time: ['dawn','day','evening'], depth: [0.4, 2.5] }
  },

  // ——— хищники ———
  {
    id: 'perch', name: 'Окунь', rarity: 'common',
    baseWeight: [0.20, 1.50], weightBias: 1.5,
    marketMinKg: 0.60, pricePerKg: 5, wholesaleFactor: 0.65,
    info: 'Стаи у коряжника и свалов; хорошо реагирует на блёсны и малька.',
    habitats: ['lake','river'],
    prefers: { baits: ['worm','spinner','fish'], time: ['dawn','day','evening'], depth: [0.5, 4.0] }
  },
  {
    id: 'pike', name: 'Щука', rarity: 'rare',
    baseWeight: [0.80, 3.50], weightBias: 1.8,
    marketMinKg: 2.00, pricePerKg: 9, wholesaleFactor: 0.7,
    info: 'Амбушюрный хищник у травы; пики активности — рассвет и закат.',
    habitats: ['lake','river'],
    prefers: { baits: ['fish','spinner'], time: ['dawn','evening','day'], depth: [0.5, 3.5] }
  },
  {
    id: 'zander', name: 'Судак', rarity: 'rare',
    baseWeight: [1.00, 6.00], weightBias: 1.9,
    marketMinKg: 1.80, pricePerKg: 10, wholesaleFactor: 0.72,
    info: 'Глубокие бровки; активен в темноте и на зорях.',
    habitats: ['lake','river'],
    prefers: { baits: ['fish','spinner'], time: ['dawn','evening','night'], depth: [2.0, 8.0] }
  },
  {
    id: 'asp', name: 'Жерех', rarity: 'rare',
    baseWeight: [1.00, 4.00], weightBias: 1.8,
    marketMinKg: 1.50, pricePerKg: 9, wholesaleFactor: 0.7,
    info: 'Пелагический речной хищник; выходит бить малька на рассвете.',
    habitats: ['river'],
    prefers: { baits: ['spinner','fish'], time: ['dawn','day'], depth: [0.5, 3.0] }
  },
  {
    id: 'burbot', name: 'Налим', rarity: 'uncommon',
    baseWeight: [0.60, 3.00], weightBias: 1.7,
    marketMinKg: 1.00, pricePerKg: 7, wholesaleFactor: 0.7,
    info: 'Ночной холодолюбивый хищник; держится ям, берёт на рыбьи куски и червя.',
    habitats: ['lake','river'],
    prefers: { baits: ['fish','worm'], time: ['night','dawn'], depth: [2.0, 6.0] }
  },
  {
    id: 'catfish', name: 'Сом', rarity: 'epic',
    baseWeight: [1.50, 8.00], weightBias: 2.0,
    marketMinKg: 2.50, pricePerKg: 11, wholesaleFactor: 0.75,
    info: 'Крупный донный хищник; активен ночью, любит ямы и коряжник.',
    habitats: ['lake','river'],
    prefers: { baits: ['fish','worm'], time: ['night','evening'], depth: [2.0, 8.0] }
  },

  // ——— карповые «тяжи» ———
  {
    id: 'carp', name: 'Карп', rarity: 'rare',
    baseWeight: [1.00, 4.00], weightBias: 1.9,
    marketMinKg: 2.00, pricePerKg: 8, wholesaleFactor: 0.7,
    info: 'Сильная донная рыба; любит прикормленные точки и окна в траве.',
    habitats: ['lake','pond'],
    prefers: { baits: ['corn','bread','worm'], time: ['dawn','day','evening'], depth: [1.0, 5.0] }
  }
];
