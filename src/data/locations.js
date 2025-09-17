
// src/data/locations.js
const BG = (name) => new URL(`../assets/bg/${name}.png`, import.meta.url).href;
// src/locations/locations.js
export const LOCATIONS = [
  {
    id: 'lake',
    title: 'Озеро',

        bgSet: {
      // dawn:  { key: 'bg_lake_evening', url: BG('bg_lake_evening') }, // если нет отдельного dawn
      day:   { key: 'bg_lake_day',     url: BG('bg_lake_day') },
      // dusk:  { key: 'bg_lake_sunset',  url: BG('bg_lake_sunset') },
      night: { key: 'bg_lake_night',   url: BG('bg_lake_night') },
    bgDay:   { key: 'bg_lake_day',     url: BG('bg_lake_day') },
    bgNight: { key: 'bg_lake_night',   url: BG('bg_lake_night') },
    bgDawn:  { key: 'bg_lake_evening', url: BG('bg_lake_evening') },
    bgDusk:  { key: 'bg_lake_sunset',  url: BG('bg_lake_sunset') },
    },

    depthGrid: { cols: 8, rows: 4, data: [
      1.2,1.6,2.0,2.8,3.6,3.2,2.0,1.5,
      1.4,1.8,2.4,3.2,3.8,3.4,2.2,1.6,
      1.6,2.0,2.6,3.4,3.9,3.5,2.4,1.8,
      1.0,1.2,1.6,2.2,2.6,2.2,1.6,1.1,
    ]},

    depthColumns: {
      cols: 10,
      profiles: [
        [[0,3.7],[0.25,2.6],[0.55,1.1],[1,2.6]],
        [[0.3,4.1],[0.30,2.8],[0.60,2.3],[1,2.6]],
        [[0.2,3.6],[0.30,2.8],[0.60,3.3],[1,1.6]],
        [[0,3.5],[0.40,2.6],[0.75,4.8],[1,2.2]],
        [[0,3.3],[0.50,2.0],[0.80,2.2],[1,3.4]],
        [[0,2.9],[0.45,2.8],[0.78,3.1],[1,2.3]],
        [[0,3.0],[0.40,2.4],[0.70,3.7],[1,2.0]],
        [[0,3.6],[0.35,2.0],[0.65,4.4],[1,2.8]],
        [[0,2.7],[0.30,2.0],[0.55,2.1],[1,1.6]],
        [[0,2.7],[0.25,2.6],[0.52,2.0],[1,2.5]],
      ]
    },

castMask: {
  "allowedPolys": [
    [
      [
        0.016,
        0.644
      ],
      [
        0.174,
        0.614
      ],
      [
        0.224,
        0.569
      ],
      [
        0.356,
        0.554
      ],
      [
        0.591,
        0.56
      ],
      [
        0.727,
        0.592
      ],
      [
        1,
        0.662
      ],
      [
        0.994,
        0.989
      ],
      [
        0.001,
        0.977
      ]
    ]
  ],
  "blockedPolys": [
    [
      [
        0.004,
        0.851
      ],
      [
        0.996,
        0.831
      ],
      [
        0.993,
        0.985
      ],
      [
        0,
        0.98
      ]
    ]
  ]
},

    // ЯВНЫЙ список видов этой локации (можно добавлять/убирать — менеджер подхватит).
    // Если не указать, он будет выведен из speciesAreas и (при наличии) из SPAWN_TABLES.
    fishIds: ['carp', 'perch', 'roach', 'pike'],

    speciesAreas: [
      {
        speciesId: 'carp',
        mult: 1.5,
        polys: [[[0.047,0.286],[0.067,0.406],[0.09,0.288]]]
      }
    ]
  },



  {
    id: 'river',
    title: 'Река',
    bg: {
      key: 'bg_river_day',
      url: new URL('../assets/bg/bg_river_day.png', import.meta.url).href,
    },
    depthGrid: {
      cols: 10, rows: 4,
      data: [
        0.8,1.0,1.2,1.6,2.2,2.6,2.2,1.6,1.2,1.0,
        0.9,1.1,1.4,1.8,2.6,3.0,2.6,1.8,1.4,1.1,
        1.0,1.2,1.6,2.0,2.8,3.2,2.8,2.0,1.6,1.2,
        0.8,0.9,1.1,1.4,2.0,2.4,2.0,1.4,1.1,0.9,
      ]
    },
  },
  {
    id: 'sea',
    title: 'Море',
    bg: {
      key: 'bg_sea_day',
      url: new URL('../assets/bg/bg_sea_day.png', import.meta.url).href,
    },
    depthGrid: {
      cols: 6, rows: 3,
      data: [
        1.5,2.0,3.0,6.0,8.0,4.0,
        2.0,3.5,6.0,9.0,12.0,7.0,
        1.8,2.5,4.0,7.0,10.0,5.0,
      ]
    },
  },
];
