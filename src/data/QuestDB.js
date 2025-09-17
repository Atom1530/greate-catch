// src/data/QuestDB.js

// Типы (для удобства ориентирования; можно удалить если не используешь TS/JSDoc)
/**
 * @typedef {{ id:string, kind:string, name:string, params?:any, countGoal?:number }} QuestTask
 * @typedef {{ id:string, name:string, tasks?:QuestTask[], reward?:any }} QuestStage
 * @typedef {{ id:string, name:string, portraitKey?:string, category?:string, stages:QuestStage[] }} NPCQuestline
 */

/** @type {NPCQuestline[]} */
export const NPCS = [
  {
    id: 'uncle_zhora',
    name: 'Дядько Жора',
    portraitKey: 'npc_uncle_zhora',
    category: 'starter',
    stages: [
      // ───────────── s1 ─────────────
      {
        id: 's1',
        name: 'Перші кроки рибалки',
        tasks: [
          { id:'t1', kind:'catch_count', name:'Злови 1 рибу',  params:{}, countGoal:1 },
          { id:'t2', kind:'catch_count', name:'Злови 5 риб',   params:{}, countGoal:5 },
        ],
        reward: { wallet:{ coins: 100 } }
      },

      // ───────────── s2 ─────────────
      {
        id: 's2',
        name: 'Тренування продовжується',
        tasks: [
          // id’ы задач можно повторять между стадіями, потому что
          // QuestState очищает прогресс задач при получении награди.
          { id:'t1', kind:'catch_count', name:'Злови 10 риб', params:{}, countGoal:10 },
        ],
        reward: { wallet:{ coins: 250 } }
      },

      // ───────────── s3 ─────────────
      {
        id: 's3',
        name: 'Справжній рибалка',
        tasks: [
          { id:'t1', kind:'catch_count', name:'Злови 25 риб', params:{}, countGoal:25 },
        ],
        reward: { wallet:{ coins: 500, gold: 1 } }
      },
      {
        id: 's4',
        name: 'Майстер водойми',
        tasks: [
          { id:'t1', kind:'catch_count', name:'Злови 50 риб', params:{}, countGoal:50 },
        ],
        reward: { wallet:{ coins: 1000 }, items:[{ id:'bait_worm', count:20 }] }
      }
    ]
  },


{
  id: 'weighmaster_pavlo',
  name: 'Павло-вагар',
  portraitKey: 'npc_pavlo',
  category: 'precision',
  stages: [
    {
      id: 's1',
      name: 'Міліграми мають значення',
      tasks: [
        {
          id:'t_exact_111',
          kind:'catch_weight_exact_g',
          name:'Злови рибу рівно 0.111 кг (±2 г)',
          params:{ valuesKg:[0.111], toleranceG:2, ignoreZero:true },
          countGoal: 1
        },
        {
          id:'t_exact_222',
          kind:'catch_weight_exact_g',
          name:'Злови рибу рівно 0.222 кг (±2 г)',
          params:{ valuesKg:[0.222], toleranceG:2, ignoreZero:true },
          countGoal: 1
        },
      ],
      reward: { wallet:{ coins: 300 } }
    },
    {
      id: 's2',
      name: 'Точність множиться',
      tasks: [
        {
          id:'t_exact_set',
          kind:'catch_weight_exact_g',
          name:'0.333, 0.444 або 0.555 кг (будь-яка, ±2 г) — двічі',
          params:{ valuesKg:[0.333,0.444,0.555], toleranceG:2, ignoreZero:true },
          countGoal: 2
        },
        {
          id:'t_bait_ctrl',
          kind:'catch_bait_is',
          name:'Доведи майстерність — злови 2 риби на хліб',
          params:{ bait:'bread' },
          countGoal: 2
        },
      ],
      reward: { wallet:{ coins: 700 }, items:[{ id:'bait_worm', count:8 }] }
    },
    {
      id: 's3',
      name: 'Точність у вечірній тиші',
      tasks: [
        { id:'t_even', kind:'catch_time_of_day', name:'Лови ввечері (3 риби)', params:{ time:'evening' }, countGoal:3 },
        { id:'t_exact_444', kind:'catch_weight_exact_g', name:'0.444 кг (±2 г)', params:{ valuesKg:[0.444], toleranceG:2 }, countGoal:1 },
      ],
      reward: { wallet:{ coins: 1200 }, items:[{ id:'bait_worm', count:12 }] }
    }
  ]
},

{
  id: 'banker_olena',
  name: 'Олена-банкір',
  portraitKey: 'npc_banker_olena',
  category: 'economy',
  stages: [
    {
      id:'s1',
      name:'Фінансова дисципліна',
      tasks: [
        { id:'t_coins_500', kind:'wallet_coins_at_least', name:'Накопич 500 срібла', params:{ coins:500 } },
        { id:'t_loot_once',  kind:'loot_any', name:'Знайди будь-який лут', params:{} , countGoal:1 }, // стимулюємо різні активності
      ],
      reward: { wallet:{ coins: 250 } }
    },
    {
      id:'s2',
      name:'Золотий стандарт',
      tasks: [
        { id:'t_gold2', kind:'wallet_gold_at_least', name:'Май 2 золота', params:{ gold:2 } },
        { id:'t_coins_2000', kind:'wallet_coins_at_least', name:'Накопич 2000 срібла', params:{ coins:2000 } },
      ],
      reward: { wallet:{ coins: 800, gold:1 } }
    },
    {
      id:'s3',
      name:'Фонд стабільності',
      tasks: [
        { id:'t_coins_5000', kind:'wallet_coins_at_least', name:'Баланс 5000 срібла', params:{ coins:5000 } },
      ],
      reward: { wallet:{ coins: 1500 }, items:[{ id:'bait_worm', count:15 }] }
    }
  ]
},
{
  id: 'rodsmith_oleg',
  name: 'Олег-коваль вудочок',
  portraitKey: 'npc_rodsmith_oleg',
  category: 'gear',
  stages: [
    {
      id:'s1',
      name:'Перші інструменти',
      tasks: [
        { id:'t_buy_rod_basic', kind:'buy_item_id', name:'Купи вудку «rod_basic»', params:{ itemId:'rod_basic' } },
        { id:'t_have_rod2', kind:'own_item_kind_count_at_least', name:'Май 2 вудки у інвентарі', params:{ kind:'rod', count:2 } },
      ],
      reward: { wallet:{ coins: 300 } }
    },
    {
      id:'s2',
      name:'Рибальська майстерня',
      tasks: [
        { id:'t_buy_reel_basic', kind:'buy_item_id', name:'Купи котушку «reel_basic»', params:{ itemId:'reel_basic' } },
        { id:'t_have_line', kind:'own_item_kind_count_at_least', name:'Май 1 ліску', params:{ kind:'line', count:1 } },
      ],
      reward: { wallet:{ coins: 600 } }
    }
  ]
},
{
  id: 'mentor_ivan',
  name: 'Іван-наставник',
  portraitKey: 'npc_mentor_ivan',
  category: 'progression',
  stages: [
    {
      id:'s1',
      name:'Стань кращим',
      tasks: [
        { id:'t_lvl2', kind:'reach_level_at_least', name:'Досягни рівня 2', params:{ level:2 } },
      ],
      reward: { wallet:{ coins: 200 } }
    },
    {
      id:'s2',
      name:'Зростання',
      tasks: [
        { id:'t_lvl3', kind:'reach_level_at_least', name:'Досягни рівня 3', params:{ level:3 } },
      ],
      reward: { wallet:{ coins: 400 } }
    },
    {
      id:'s3',
      name:'Справжній шлях',
      tasks: [
        { id:'t_lvl5', kind:'reach_level_at_least', name:'Досягни рівня 5', params:{ level:5 } },
      ],
      reward: { wallet:{ coins: 900, gold:1 } }
    }
  ]
},




  // Можна додати інших NPC нижче:
  // {
  //   id: 'fisher_katya',
  //   name: 'Катя-рибачка',
  //   portraitKey: 'npc_katya',
  //   stages: [ ... ]
  // }

  {
  id: 'fisher_katya',
  name: 'Катя-рибачка',
  portraitKey: 'npc_katya',      // якщо текстури нема — UI покаже емодзі
  category: 'technique',         // умовна категорія: «техніка лову»
  stages: [
    // ───────────── s1 ─────────────
    {
      id: 's1',
      name: 'Легка розминка',
      tasks: [
        { id:'t_count3', kind:'catch_count', name:'Злови 3 риби', params:{}, countGoal:3 },
        { id:'t_worm2',  kind:'catch_bait_is', name:'Злови 2 риби на червʼяка', params:{ bait:'worm' }, countGoal:2 },
      ],
      reward: { wallet:{ coins: 180 } }
    },

    // ───────────── s2 ─────────────
    {
      id: 's2',
      name: 'Точний ваговий контроль',
      tasks: [
        {
          id:'t_w100_200',
          kind:'catch_weight_range_g',
          name:'Злови 3 риби вагою 100–200 г',
          params:{ weightG:[100,200] },
          countGoal:3
        },
        {
          id:'t_lake3',
          kind:'catch_in_location',
          name:'Злови 3 риби на озері',
          params:{ locations:['lake'] },
          countGoal:3
        }
      ],
      reward: { wallet:{ coins: 420 } }
    },

    // ───────────── s3 ─────────────
    {
      id: 's3',
      name: 'Глибина і час',
      tasks: [
        {
          id:'t_depth_shallow',
          kind:'catch_depth_range_m',
          name:'Злови 4 риби на глибині 0.5–1.5 м',
          params:{ depthM:[0.5,1.5] },
          countGoal:4
        },
        {
          id:'t_evening3',
          kind:'catch_time_of_day',
          name:'Злови 3 риби ввечері',
          params:{ time:'evening' },
          countGoal:3
        }
      ],
      reward: { wallet:{ coins: 650 }, items:[{ id:'bait_worm', count:12 }] }
    },

    // ───────────── s4 ─────────────
    {
      id: 's4',
      name: 'Майстриня різноманіття',
      tasks: [
        {
          id:'t_species_mix',
          kind:'catch_species',
          name:'Злови 2 карпа або плотви',
          params:{ species:['carp','roach'] },
          countGoal:2
        },
        {
          id:'t_loot_any',
          kind:'loot_any',
          name:'Добудь будь-який лут',
          params:{},
          countGoal:1
        }
      ],
      reward: { wallet:{ coins: 1000, gold:1 } }
    }
  ]
}

];

// Публічні селектори
export function getAllNPC() {
  return NPCS;
}

export function getNPCById(id) {
  return NPCS.find(n => n.id === id) || null;
}
