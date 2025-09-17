// src/vm.js
export const VM = {
  _s: Object.create(null),

  // --- базовые операции ---
  get(k, dflt){ return Object.prototype.hasOwnProperty.call(this._s, k) ? this._s[k] : dflt; },
  set(k, v){ this._s[k] = v; this._save(); return v; },
  setMany(obj){ Object.assign(this._s, obj); this._save(); },
  has(k){ return Object.prototype.hasOwnProperty.call(this._s, k); },
  del(k){ if (this.has(k)) { delete this._s[k]; this._save(); } },
  clear(){ this._s = Object.create(null); this._save(); },

  // --- persist (по умолчанию ВЫКЛ), удобно для дебага ---
  _persist: false,
  _lsKey: 'rf.vm',
  init({ persist=false, key } = {}){
    this._persist = !!persist;
    if (key) this._lsKey = key;
    if (this._persist) {
      try {
        const raw = localStorage.getItem(this._lsKey);
        if (raw) this._s = JSON.parse(raw) || Object.create(null);
      } catch(e){ this._s = Object.create(null); }
    }
    return this;
  },
  _save(){
    if (!this._persist) return;
    try { localStorage.setItem(this._lsKey, JSON.stringify(this._s)); } catch(e){}
  },

  // --- удобные хелперы ---
  resetClock(){
    this.del('clockAnchorMs');
    this.del('clockOffsetMin');
    this.del('clockDayLengthMin');
  },

  snapshotFromStart(scene){
    this.setMany({
      gear: scene.gear,
      keepnet: scene.keepnet,
      wallet: scene.wallet,
      rigDepthM: scene.rigDepthM,
      inventory: scene.inventory,
      keepnetCap: scene.keepnetCap ?? 25,
      locationId: scene.locationMgr?.getCurrentId?.() || scene.locationMgr?.current || 'lake',
      level: scene.progress?.level ?? this.get('level', 1),
    });
  },

  defaults(){
    return {
      gear: null,
      keepnet: [],
      wallet: { coins: 0, gold: 0 },
      keepnetCap: 25,
      rigDepthM: 1.2,
      locationId: 'lake',
      level: 1,
      inventory: {
        rods:  ['rod_wood_1'],
        reels: ['reel_rusty'],
        lines: ['line_old_1'],
        hooks: ['hook_rusty'],
        bait:  { worm: 25 },
        hookPacks: { hook_rusty: 5 },
      },
    };
  }
};
export default VM;
