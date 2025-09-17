// src/data/spawnTables.js
// Коэффициенты к шансам (1 = обычно, 0 = не встречается)
// Какие виды и с какими весами (вероятностями) встречаются в локациях.
// minDepth — минимальная глубина, с которой вид доступен.
// Для каждой локации указываем виды.
// Значение может быть:
//  - number        → множитель веса (1 = по умолчанию, 0 = выключено);
//  - object        → { w?:number, minDepth?:number, maxDepth?:number }

export const SPAWN_TABLES = {
  lake: {
    crucian: 1.2,
    roach:   1.1,
    perch:    0.9,
    ruffe:     0.8 ,
    bleak:   0.7,
    bream:     0.6,
    tench:     0.5 ,
    ide:     0.6,
    pike:      0.35,
    carp:      0.4,
    rudd: 0.9,
     silver_bream: 0.7,
      dace: 0.0,
       chub: 0.0, // (речных — 0 в озере)
  zander:  0.25,
   asp: 0.0,
    burbot:  0.35,
  catfish:0.15,
   minDepth: 2.0 , 
  pike:   0.35  ,

    // лутт
    loot_coins_small:   0.06,
    chest_wood:         0.015, 
    crayfish:           0.20, 
    frog:               0.12,              
    rusty_can:          0.15,        
    stick:              0.12,              
    grass_snake:        0.03,             
  },


  river: {
    crucian: 0.6,
    roach:   1.2,
    perch:     1.0,
    ruffe:   1.0,
    bleak:   1.1,
    bream:     0.7 ,
    tench:   0.0,                 // нет в реке
    ide:       0.9 ,
    pike:      0.4,
    carp:    0.3,
  },

  // sea здесь пока пустышка (нет морских видов в FishCatalog)
  sea: {
    crucian: 0, roach: 0, perch: 0, ruffe: 0, bleak: 0,
    bream: 0, tench: 0, ide: 0, pike: 0, carp: 0
  }
};
