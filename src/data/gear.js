// src/data/gear.js
export const GearDB = {
  rods: [
    { id: 'rod_wood_1',  name: 'Удочка деревянная', capKg: 1.0 },
    { id: 'rod_fib_5',   name: 'Удочка композитная', capKg: 5.0 },
  ],
  lines: [
    { id: 'line_old_1',  name: 'Леска старая', capKg: 1.0 },
    { id: 'line_nylon_4',name: 'Леска нейлоновая', capKg: 4.0 },
  ],
  reels: [
    { id: 'reel_rusty', name: 'Катушка ржавая', pullBoost: 0.01 }, // 1% силы
    { id: 'reel_pro',   name: 'Катушка карповая', pullBoost: 1.15 },
  ],
  hooks: [
    { id: 'hook_rusty',  name: 'Крючок ржавый',  control: 1.00 },
    { id: 'hook_sharp',  name: 'Крючок острый',  control: 1.12 },
  ],
  baits: ['bread','worm','corn','fish'],
};

// src/data/gear.js
export function getDefaultGear() {
  return {
    rod:  { id:'rod_wood_1',  capKg: 1.0, durability: 100 },
    line: { id:'line_old_1',  capKg: 1.0, durability: 100 },
    reel: { id:'reel_rusty',  pullBoost: 1.00 },
    hook: { id:'hook_rusty',  control: 1.0, count: 5 },
    bait: 'worm',
    inv:  { bait: 25 }
  };
}

