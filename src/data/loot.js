
// src/data/loot.js
export const LootCatalog = [
  // ——— Сокровища / награды ———
  {
    id: 'loot_coins_small', kind: 'loot', name: 'Кошелёк монет', rarity: 'uncommon',
    habitats: ['lake','river','pond'],
    prefers: { baits: ['worm','bread'], time: ['day','evening',], depth: [1, 3] },
    reward: { coins: [50, 150] } // диапазон монет
  },
  {
    id: 'chest_wood', kind: 'loot', name: 'Деревянный ящик', rarity: 'rare',
    habitats: ['lake'],
    prefers: { baits: ['worm','bread','corn','fish'], time: ['day','evening','night','dawn'], depth: [3, 5] },
    reward: { coins: [2000, 60000] } // сейчас сразу открывается и даёт монеты
  },

  // ——— Побочная живность (можно «продавать как есть») ———
  {
    id: 'crayfish', kind: 'bycatch', name: 'Рак', rarity: 'uncommon',
    habitats: ['lake','river'],
    prefers: { baits: ['worm'], time: ['evening','night'], depth: [1, 3] },
    sell: { price: 2 } // просто начисляем монеты как за продажу
  },
  {
    id: 'frog', kind: 'bycatch', name: 'Жаба', rarity: 'common',
    habitats: ['pond','lake'],
    prefers: { baits: ['worm','bread'], time: ['evening','night'], depth: [0, 1] },
    sell: { price: 1 }
  },

  // ——— Атмосферный мусор ———
  {
    id: 'rusty_can', kind: 'trash', name: 'Ржавая банка', rarity: 'common',
    habitats: ['lake','river'],
    prefers: { baits: ['worm','bread'], time: ['day','evening'], depth: [0, 1] },
    reward: { coins: [0, 2] } // иногда чуть-чуть монет
  },
  {
    id: 'stick', kind: 'trash', name: 'Палка', rarity: 'common',
    habitats: ['lake'],
    prefers: { baits: ['worm','bread'], time: ['day','evening'], depth: [0, 1] },
    reward: { coins: [0, 1] }
  },

  // ——— На будущее можно расширять ———
  {
    id: 'grass_snake', kind: 'bycatch', name: 'Уж', rarity: 'rare',
    habitats: ['lake','river'],
    prefers: { baits: ['fish','worm'], time: ['day'], depth: [0, 1] },
    reward: { coins: [1, 3] } // сейчас просто монетки
  }
];
