// src/locations/LocationMgr.js
import { LOCATIONS } from '../data/locations.js';
import { WaterWavePipeline } from '../effects/WaterWavePipeline.js';

export class LocationMgr {
  constructor(scene, initialId = 'lake') {
    this.s = scene;
    this.current = initialId;

    // BG
    this.bg = null;                 // для совместимости
    this.bgLayers = null;           // { day, night }
    this.bgWaterLayers = null;      // { day, night }
    this._veil = null;              // тёмная вуаль (утро/вечер)
    this._grade = null;             // цветовой градинг (тёплый рассвет/закат)

    // water + FX
    this._resizeBound = false;
    this._waterMaskG = null;
    this._waterGeomMask = null;
    this._waterPipeline = null;
    this._waterTime = 0;
    this._waterFxEnabled = true;
    // casting mask debug
    this._maskG = null;
    this._castMaskEnabled = true;

    // depth debug
    this._depthDebug = null;

    // water bounds (px)
    this.waterTop = 0;
    this.waterBottom = this.s.scale.height;
    this._waterAreaLockedByScene = false;
    this._bgTimer = null; // сцена «залочила» границы воды?
    this._castUV = { minV: 0, maxV: 1 };

  }

  // ---------------- assets ----------------
  // Грузим ТОЛЬКО day & night (с умными фолбэками).
// ---------------- assets ----------------
static loadAssets(scene, locId = null) {
  const list = locId
    ? [LOCATIONS.find(l => l.id === locId)].filter(Boolean)
    : LOCATIONS;

  const queued = new Set();
  const add = (key, url) => {
    if (!key || !url) return;
    if (queued.has(key)) return;
    // если уже есть в TextureManager – не ставим снова
    if (scene.textures?.exists?.(key)) return;
    queued.add(key);
    scene.load.image(key, url);
  };

  for (const loc of list) {
    const S = loc.bgSet || {};

    const dayKey = S.day?.key || loc.bgDay?.key || loc.bg?.key;
    const dayUrl = S.day?.url || loc.bgDay?.url || loc.bg?.url;
    add(dayKey, dayUrl); // день всегда

    // НОЧЬ: только если у неё есть СОБСТВЕННЫЙ url
    const nightKeyOwn = S.night?.key || loc.bgNight?.key;
    const nightUrlOwn = S.night?.url || loc.bgNight?.url;
    if (nightKeyOwn && nightUrlOwn) add(nightKeyOwn, nightUrlOwn);
  }

  scene.load.on(Phaser.Loader.Events.LOAD_ERROR, (file) =>
    console.warn('LOAD_ERROR:', file?.key, file?.src)
  );
}


  // ---------------- background ----------------
  applyBackground() {
 const { width: W, height: H } = this.s.scale;

    // cleanup
    this.bg?.destroy(); this.bg = null;
    if (this.bgLayers) Object.values(this.bgLayers).forEach(i => i?.destroy());
    if (this.bgWaterLayers) Object.values(this.bgWaterLayers).forEach(i => i?.destroy());
    this.bgLayers = {};
    this.bgWaterLayers = {};

  this.bgLayers = {}; this.bgWaterLayers = {};

  const loc = this.data || {};
  const S = loc.bgSet || {};
  const dayKeyBase   = S.day?.key   || loc.bgDay?.key   || loc.bg?.key || null;
  let   nightKeyBase = S.night?.key || loc.bgNight?.key || null;

  // если ночь не загружена – используем день
  const hasDay   = dayKeyBase   && this.s.textures.exists(dayKeyBase);
  const hasNight = nightKeyBase && this.s.textures.exists(nightKeyBase);
  const dayKey   = hasDay   ? dayKeyBase   : null;
  const nightKey = hasNight ? nightKeyBase : dayKeyBase; // ← фолбэк на day

  if (!dayKey && !nightKey) return;

  const baseDepth = -300;

  // base
  if (dayKey) {
    const imgDay = this.s.add.image(W/2, H/2, dayKey)
      .setOrigin(0.5).setDepth(baseDepth + 1).setScrollFactor(0).setAlpha(0);
    this._fitCover(imgDay); this.bgLayers.day = imgDay;
  }
  if (nightKey) {
    const imgNight = this.s.add.image(W/2, H/2, nightKey)
      .setOrigin(0.5).setDepth(baseDepth + 1).setScrollFactor(0).setAlpha(0);
    this._fitCover(imgNight); this.bgLayers.night = imgNight;
  }

  // water слои – аналогично
  if (dayKey) {
    const imgDayW = this.s.add.image(W/2, H/2, dayKey)
      .setOrigin(0.5).setDepth(baseDepth + 1.5).setScrollFactor(0).setAlpha(0);
    this._fitCover(imgDayW); this.bgWaterLayers.day = imgDayW;
  }
  if (nightKey) {
    const imgNightW = this.s.add.image(W/2, H/2, nightKey)
      .setOrigin(0.5).setDepth(baseDepth + 1.5).setScrollFactor(0).setAlpha(0);
    this._fitCover(imgNightW); this.bgWaterLayers.night = imgNightW;
  }

  // показать хотя бы один слой
  (this.bgLayers.day || this.bgLayers.night)?.setAlpha(1);
  (this.bgWaterLayers.day || this.bgWaterLayers.night)?.setAlpha(1);


    // пост-слои
    this._veil?.destroy();
    this._veil = this.s.add.rectangle(0, 0, W, H, 0x000000, 0)
      .setOrigin(0, 0).setDepth(baseDepth + 2).setScrollFactor(0);
    this._grade?.destroy();
    this._grade = this.s.add.rectangle(0, 0, W, H, 0xffffff, 0)
      .setOrigin(0, 0).setDepth(baseDepth + 2.1).setScrollFactor(0)
      .setBlendMode(Phaser.BlendModes.MULTIPLY);

    // границы воды → из конфига, если сцена не задала
    if (!this._waterAreaLockedByScene) this._resolveWaterAreaFromConfig();
    // маска по allowedPolys
    this.setWaterMaskFromCastMask(this.data?.castMask);

    // resize
    if (!this._resizeBound) {
      this._resizeBound = true;
      this.s.scale.on('resize', () => {
        const w = this.s.scale.width, h = this.s.scale.height;
        if (this.bgLayers.day)   this._fitCover(this.bgLayers.day);
        if (this.bgLayers.night) this._fitCover(this.bgLayers.night);
        if (this.bgWaterLayers.day)   this._fitCover(this.bgWaterLayers.day);
        if (this.bgWaterLayers.night) this._fitCover(this.bgWaterLayers.night);
        this._veil?.setSize(w, h);
        this._grade?.setSize(w, h);

        if (!this._waterAreaLockedByScene) this._resolveWaterAreaFromConfig();
        this.setWaterMaskFromCastMask(this.data?.castMask);
        if (this._waterPipeline) this._setU(2, 'uResolution', w, h);
        if (this._depthDebug?.visible) this.drawDepthDebug(true);
        if (this._maskG) this.toggleCastMaskDebug(true);
      });
      if (!this._bgTimer) {
  this._bgTimer = this.s.time.addEvent({
    delay: 1000, loop: true, callback: () => {
      const info = this.s.timeCycle?.getInfo?.();
      // phase/t нам не обязательны, но передадим для совместимости
      this.setPhaseBlend(info?.phase ?? 'day', info?.t ?? 0);
    }
  });
  // убрать таймер при завершении сцены
  this.s.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    this._bgTimer?.remove(); this._bgTimer = null;
  });
}
// --- (ре)включаем водные FX после готовности слоёв ---
this.disableWaterFX(); // почистим старый пайплайн/листенеры, если были
if (this._waterFxEnabled) {
this.enableWaterFX({
  mode: 1,             // только полосы
  stripeCount: 1,     // сколько «ребер»
  stripeAmp: 1.0,      // амплитуда (px)
  stripeSpeed: 1.0,    // скорость «захлоп/расхлоп»
  amp: 0               // базовую волну выключили
});

}

    }
  }

  // вернуть управление границами конфигу
  useConfigWaterArea() {
    this._waterAreaLockedByScene = false;
    this._resolveWaterAreaFromConfig();
    this.setWaterMaskFromCastMask(this.data?.castMask);
  }

  // ---------------- day/night + градинг ----------------
  setPhaseBlend(phase, t) {
    if (!this.bgLayers) return;

    const dayImg   = this.bgLayers.day;
    const nightImg = this.bgLayers.night;
    if (!dayImg && !nightImg) return;

    // читаем часы из timeCycle (0..24), иначе — по phase
    const H = this._hourNow(phase, t);

    // картинка: day 06..24, night 00..06
    const useDay = (H >= 6 && H < 24);
    dayImg?.setAlpha(0); nightImg?.setAlpha(0);
    (useDay ? dayImg : nightImg)?.setAlpha(1);

    const dayW = this.bgWaterLayers?.day, nightW = this.bgWaterLayers?.night;
    dayW?.setAlpha(0); nightW?.setAlpha(0);
    (useDay ? dayW : nightW)?.setAlpha(1);

    // вуаль и тёплый градинг — ТОЛЬКО рассвет/закат
    const veilA = this._veilAlphaForHour(H);
    this._veil?.setFillStyle(0x000000, veilA);

    const { color, alpha } = this._gradeColorForHour(H);
    this._grade?.setFillStyle(color, alpha);
  }
  setPhase(p){ this.setPhaseBlend(p, 0); }

  // 0..24
  _hourNow(phase, t) {
    const ti = this.s.timeCycle?.getInfo?.();
    if (ti && typeof ti.pct24 === 'number') {
      let H = ti.pct24 * 24;
      H = ((H % 24) + 24) % 24;
      return H;
    }
    // грубый фолбэк, если нет timeCycle.pct24
    const u = Phaser.Math.Clamp(t ?? 0, 0, 1);
    if (phase === 'dawn')  return 6 + 3*u;     // 06..09
    if (phase === 'day')   return 9 + 12*u;    // 09..21
    if (phase === 'dusk')  return 21 + 3*u;    // 21..24
    if (phase === 'night') return 0 + 6*u;     // 00..06
    return 12; // середина дня по умолчанию
  }

  // лёгкая тёмная вуаль только утром/вечером
  _veilAlphaForHour(H) {
    const MAX = 0.25; // сила затемнения рассвет/закат
    if (H >= 6 && H < 9)  return MAX * (1 - (H - 6) / 3); // 06: MAX → 09: 0
    if (H >= 21 && H < 24) return MAX * ((H - 21) / 3);  // 21: 0 → 24: MAX
    return 0; // днём и ночью — без вуали
  }

  // тёплый «оранжевый» градинг только рассвет/закат
  _gradeColorForHour(H) {
    const WARM = 0xFFC070; // мягкий оранжевый для MULTIPLY
    if (H >= 6 && H < 9)  return { color: WARM, alpha: 0.18 * (1 - (H - 6) / 3) };
    if (H >= 21 && H < 24) return { color: WARM, alpha: 0.18 * ((H - 21) / 3) };
    return { color: 0xffffff, alpha: 0 }; // днём и ночью — без тона
  }

  // ---------------- shaders & mask ----------------
enableWaterFX(opts = {}) {
  if (!this._waterFxEnabled) return;
  if (this.s.sys.game.config.renderType !== Phaser.WEBGL) {
    console.warn('[WaterFX] Canvas renderer: шейдеры недоступны');
    return;
  }

  const pm = this.s.game.renderer?.pipelines;
  if (!pm) return;

  let pipe = (typeof pm.get === 'function') ? pm.get('WaterWave') : null;
  if (!pipe && typeof pm.add === 'function') {
    pm.add('WaterWave', new WaterWavePipeline(this.s.game));
    pipe = pm.get('WaterWave');
  }
  if (!pipe) { console.warn('[WaterFX] Не удалось создать pipeline'); return; }
  this._waterPipeline = pipe;

  const { width: W, height: H } = this.s.scale;

  // ВОЛНА (можно оставить amp=0, чтобы выключить)
  const amp     = (opts.amp     != null) ? opts.amp     : 0;            // по умолчанию отключаем волну
  const waveLen = (opts.waveLen != null) ? opts.waveLen : this._fxWaveLen();
  const speed   = (opts.speed   != null) ? opts.speed   : this._fxSpeed();

  // ПОЛОСЫ
  const stripeCount = (opts.stripeCount != null) ? opts.stripeCount : 30;
  const stripeAmp   = (opts.stripeAmp   != null) ? opts.stripeAmp   : 2.0;
  const stripeSpeed = (opts.stripeSpeed != null) ? opts.stripeSpeed : 2.0; // «дыхание» 2 рад/сек
  const mode        = (opts.mode != null) ? opts.mode : 1; // 0=wave, 1=stripes, 2=both

  this._setU(2, 'uResolution', W, H);
  this._setU(1, 'uAmp', amp);
  this._setU(1, 'uWaveLen', waveLen);
  this._setU(1, 'uSpeed', speed);
  this._setU(1, 'uTime', this._waterTime = 0);

  // новые униформы
  this._setU(1, 'uStripeCount', stripeCount);
  this._setU(1, 'uStripeAmp',   stripeAmp);
  this._setU(1, 'uStripeSpeed', stripeSpeed);
  this._setU(1, 'uMode',        mode);

  // навешиваем pipeline на water-слои (если вдруг слоёв ещё нет — подождём applyBackground)
  const targets = Object.values(this.bgWaterLayers || {});
  if (targets.length === 0) {
    console.warn('[WaterFX] Нет water-слоёв. Вызови applyBackground() прежде.');
  }
  targets.forEach(go => go?.setPipeline?.('WaterWave'));

  if (!this._boundUpdate) {
    this._boundUpdate = (_t, dt) => {
      this._waterTime += (dt || 0) / 1000;
      this._setU(1, 'uTime', this._waterTime);
    };
    this.s.events.on('update', this._boundUpdate);
  }
}

  disableWaterFX() {
    if (!this._waterPipeline) return;
    const targets = this.bgWaterLayers ? Object.values(this.bgWaterLayers) : [];
    targets.forEach(go => go?.resetPipeline && go.resetPipeline());
    this._waterPipeline = null;
    if (this._boundUpdate) {
      this.s.events.off('update', this._boundUpdate);
      this._boundUpdate = null;
    }
  }

  _setU(n, name, ...vals) {
    const p = this._waterPipeline; if (!p) return;
    const a = p[`setFloat${n}`], b = p[`set${n}f`];
    if (typeof a === 'function') return a.call(p, name, ...vals);
    if (typeof b === 'function') return b.call(p, name, ...vals);
  }

  // сцена задаёт реальные границы воды
  setWaterArea(topY, bottomY, { lock = true } = {}) {
    this.waterTop = (topY ?? 0);
    this.waterBottom = (bottomY ?? this.s.scale.height);
    if (lock) this._waterAreaLockedByScene = true;

    // uv->xy меняется — пересобираем геомаску
    this.setWaterMaskFromCastMask(this.data?.castMask);

    if (this._maskG) this.toggleCastMaskDebug(true);
  }

  _waterBounds() {
    return { top: this.waterTop ?? 0, shore: this.waterBottom ?? this.s.scale.height };
  }

  // читать границы из конфига (если сцена не залочила)
  _resolveWaterAreaFromConfig() {
    if (this._waterAreaLockedByScene) return;
    const H = this.s.scale.height;
    const w = this.data?.water || {};
    const toPx = (v) => (v <= 1 ? Math.round(v * H) : v|0);
    const top = (w.top != null) ? toPx(w.top) : 0;
    const bottom = (w.bottom != null) ? toPx(w.bottom) : H;
    this.setWaterArea(top, bottom, { lock: true });
  }

  _uvToXY(u, v) {
    const W = this.s.scale.width;
    const { top, shore } = this._waterBounds();
    const Hwater = Math.max(1, shore - top);
    return { x: u * W, y: top + v * Hwater };
  }

  _buildWaterMaskFromAllowed(allowedPolys) {
    this._waterMaskG?.destroy(); this._waterGeomMask = null;
    const g = this._waterMaskG = this.s.add.graphics().setScrollFactor(0).setDepth(-9999).setVisible(false);
    g.clear(); g.fillStyle(0xffffff, 1);

    const polys = (Array.isArray(allowedPolys) && allowedPolys.length)
      ? allowedPolys : [[[0,0],[1,0],[1,1],[0,1]]];

    for (const poly of polys) {
      if (!poly || poly.length < 3) continue;
      const p0 = this._uvToXY(poly[0][0], poly[0][1]);
      g.beginPath(); g.moveTo(p0.x, p0.y);
      for (let i=1;i<poly.length;i++){ const p=this._uvToXY(poly[i][0], poly[i][1]); g.lineTo(p.x,p.y); }
      g.closePath(); g.fillPath();
    }
    this._waterGeomMask = new Phaser.Display.Masks.GeometryMask(this.s, g);
    // --- вычислим вертикальные границы доступной зоны по allowedPolys ---
     let have = false, minV = 1, maxV = 0;
    if (Array.isArray(allowedPolys) && allowedPolys.length) {
     for (const poly of allowedPolys) {
    if (!Array.isArray(poly)) continue;
    for (const pt of poly) {
      const v = Array.isArray(pt) ? pt[1] : null;
      if (typeof v === 'number') {
        have = true;
        if (v < minV) minV = v;
        if (v > maxV) maxV = v;
      }
    }
  }
}
this._castUV = have ? { minV, maxV } : { minV: 0, maxV: 1 };


    const targets = this.bgWaterLayers ? Object.values(this.bgWaterLayers) : [];
    targets.forEach(img => img.setMask(this._waterGeomMask));
  }

  setWaterMaskFromCastMask(castMask) {
    this._buildWaterMaskFromAllowed(
      Array.isArray(castMask?.allowedPolys) ? castMask.allowedPolys : null
    );
  }

  // ---------------- casting mask (game logic) ----------------
  _toUV(x, y) {
    const W = Math.max(1, this.s.scale.width);
    const { top, shore } = this._waterBounds();
    const u = Phaser.Math.Clamp(x / W, 0, 1);
    const v = Phaser.Math.Clamp((y - top) / Math.max(1, (shore - top)), 0, 1);
    return { u, v };
  }

    /**
   * Нормированная позиция вдоль ВОДЫ по вертикали (между waterTop и waterBottom).
   * Возвращает 0..1, где:
   *  - 0 = у берега (нижняя граница waterBottom)
   *  - 1 = «дальше от берега», верх воды (waterTop)
   */
  getShoreDistanceRatio(y) {
    const { top, shore } = this._waterBounds();
    const Hwater = Math.max(1, shore - top);
    const v = Phaser.Math.Clamp((y - top) / Hwater, 0, 1); // 0 вверху → 1 внизу
    return 1 - v; // «правее = дальше от берега»
  }
  

  /**
   * Удобный хелпер прямо для точек локатора: вернёт X внутри шкалы.
   * @param {number} y - экранная Y поплавка
   * @param {number} left - X левого края шкалы локатора
   * @param {number} width - ширина шкалы локатора
   */
  getLocatorXForY(y, left, width) {
    const r = this.getShoreDistanceRatio(y); // 0..1
    return left + r * Math.max(0, width);
  }

/**
 * Нормированная "дальность от берега" c учётом ДОСТУПНОЙ зоны из castMask.
 * Возвращает 0..1, где 1 = самая дальняя доступная точка (верх доступной зоны),
 * 0 = у берега в пределах доступной зоны.
 */
getCastDistanceRatio(y) {
  const { top, shore } = this._waterBounds();
  const Hwater = Math.max(1, shore - top);
  const v = Phaser.Math.Clamp((y - top) / Hwater, 0, 1);

  const { minV = 0, maxV = 1 } = this._castUV || {};
  const span = Math.max(1e-6, maxV - minV);
  const vv = Phaser.Math.Clamp(v, minV, maxV);     // режем по доступной зоне
  return (maxV - vv) / span;                        // 1 = верх доступной зоны → вправо
}

/** Удобный маппер для сонара (если хочется сразу в пиксели шкалы) */

  static _pointInPoly(pt, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1];
      const xj = poly[j][0], yj = poly[j][1];
      const intersect = ((yi > pt.v) !== (yj > pt.v)) &&
                        (pt.u < (xj - xi) * (pt.v - yi) / ((yj - yi) || 1e-9) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  _inAnyPoly(pt, polys = []) {
    for (const p of polys) {
      if (Array.isArray(p) && p.length >= 3 && LocationMgr._pointInPoly(pt, p)) return true;
    }
    return false;
  }

  canCastAt(x, y) {
    const { top, shore } = this._waterBounds();
    if (y < top || y > shore) return false;
    if (!this._castMaskEnabled) return true;

    const mask = this.data?.castMask;
    if (!mask) return true;

    const pt = this._toUV(x, y);

    if (Array.isArray(mask.allowedPolys) || Array.isArray(mask.blockedPolys)) {
      const hasValidAllowed = mask.allowedPolys?.some(p => Array.isArray(p) && p.length >= 3);
      if (hasValidAllowed && !this._inAnyPoly(pt, mask.allowedPolys)) return false;
      const inBlocked = mask.blockedPolys?.length && this._inAnyPoly(pt, mask.blockedPolys);
      if (inBlocked) return false;
      return true;
    }

    if (Array.isArray(mask.polys) && mask.polys.length) {
      const hasValid = mask.polys.some(p => Array.isArray(p) && p.length >= 3);
      if (!hasValid) return true;
      if (mask.mode === 'allow')  return this._inAnyPoly(pt, mask.polys);
      return !this._inAnyPoly(pt, mask.polys);
    }
    return true;
  }

  setCastMaskEnabled(on = true) { this._castMaskEnabled = !!on; }

  toggleCastMaskDebug(on = true) {
    if (!on) { this._maskG?.destroy(); this._maskG = null; return; }
    this._maskG?.destroy();
    const g = this._maskG = this.s.add.graphics().setDepth(5000);
    const W = this.s.scale.width;
    const { top, shore } = this._waterBounds();
    const Hwater = Math.max(1, shore - top);
    const toXY = ([u, v]) => ({ x: u * W, y: top + v * Hwater });
    const draw = (poly, color, alpha) => {
      const pts = poly.map(toXY);
      g.fillStyle(color, alpha);
      g.lineStyle(2, color, 0.9);
      g.beginPath();
      g.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
      g.closePath(); g.fillPath(); g.strokePath();
    };

    const mask = this.data?.castMask;
    if (!mask) return;
    if (Array.isArray(mask.allowedPolys)) mask.allowedPolys.forEach(p => draw(p, 0x00ff88, 0.15));
    if (Array.isArray(mask.blockedPolys)) mask.blockedPolys.forEach(p => draw(p, 0xff3355, 0.25));
    if (Array.isArray(mask.polys)) {
      if (mask.mode === 'allow') mask.polys.forEach(p => draw(p, 0x00ff88, 0.15));
      else                        mask.polys.forEach(p => draw(p, 0xff3355, 0.25));
    }
  }

  // ---------------- depths ----------------
  _evalProfile(pts, t) {
    if (!pts?.length) return 0;
    if (t <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) {
      if (t <= pts[i][0]) {
        const [t0, d0] = pts[i - 1], [t1, d1] = pts[i];
        const u = (t - t0) / Math.max(1e-6, t1 - t0);
        return d0 + (d1 - d0) * u;
      }
    }
    return pts[pts.length - 1][1];
  }

  getColumnIndexForX(x) {
    const cols = this.data?.depthColumns?.cols ?? this.data?.depthGrid?.cols ?? 10;
    const W = Math.max(1, this.s.scale.width);
    const u = Phaser.Math.Clamp(x / W, 0, 0.999999);
    return Math.floor(u * cols);
  }

  getDepthProfileForColumn(colIdx, samples = 64) {
    const dc = this.data?.depthColumns;
    if (dc?.profiles?.length) {
      const prof = dc.profiles[colIdx] || dc.profiles[colIdx % dc.profiles.length];
      const depths = new Array(samples);
      let max = 0;
      for (let i = 0; i < samples; i++) {
        const t = (samples === 1) ? 0 : i / (samples - 1);
        const d = this._evalProfile(prof, t);
        depths[i] = d; if (d > max) max = d;
      }
      return { depths, max };
    }

    const cols = this.data?.depthGrid?.cols ?? dc?.cols ?? 10;
    const W = Math.max(1, this.s.scale.width);
    const x = ((colIdx + 0.5) / cols) * W;

    const { top, shore } = this._waterBounds();
    const depths = new Array(samples);
    let max = 0;
    for (let i = 0; i < samples; i++) {
      const t = (samples === 1) ? 0 : i / (samples - 1);
      const y = top + t * (shore - top);
      const d = this.getDepthAtXY(x, y);
      depths[i] = d; if (d > max) max = d;
    }
    return { depths, max };
  }

  getDepthAtXY(x, y) {
    const loc = this.data;
    if (!loc) return 2;

    const { top, shore } = this._waterBounds();
    const t = Phaser.Math.Clamp((y - top) / Math.max(1, shore - top), 0, 1);

    const dc = loc.depthColumns;
    if (dc?.profiles?.length) {
      const colIdx = this.getColumnIndexForX(x);
      const prof = dc.profiles[colIdx] || dc.profiles[colIdx % dc.profiles.length];
      return this._evalProfile(prof, t);
    }

    const g = loc.depthGrid;
    if (g?.data && g.cols > 0 && g.rows > 0) {
      const W = Math.max(1, this.s.scale.width);
      const u = Phaser.Math.Clamp(x / W, 0, 0.999999);
      const gx = u * (g.cols - 1);
      const gy = t * (g.rows - 1);

      const c0 = Math.floor(gx), c1 = Math.min(c0 + 1, g.cols - 1);
      const r0 = Math.floor(gy), r1 = Math.min(r0 + 1, g.rows - 1);
      const tx = gx - c0, ty = gy - r0;

      const idx = (r, c) => r * g.cols + c;
      const d00 = g.data[idx(r0, c0)] ?? 0;
      const d10 = g.data[idx(r0, c1)] ?? 0;
      const d01 = g.data[idx(r1, c0)] ?? 0;
      const d11 = g.data[idx(r1, c1)] ?? 0;

      const d0 = d00 * (1 - tx) + d10 * tx;
      const d1 = d01 * (1 - tx) + d11 * tx;
      return d0 * (1 - ty) + d1 * ty;
    }

    let baseDepth = 2;
    const bands = loc.depth?.bands;
    if (bands?.length) {
      const W = Math.max(1, this.s.scale.width);
      const u = Phaser.Math.Clamp(x / W, 0, 0.999999);
      const band = bands.find(b => u >= b.from && u < b.to) || bands[bands.length - 1];
      baseDepth = band.m ?? 2;
    }
    const yg = loc.depth?.yGradient || { top: 1.25, bottom: 0.75 };
    const k = Phaser.Math.Linear(yg.top, yg.bottom, t);
    return baseDepth * k;
  }

  getDepthAtX(x) {
    const loc = this.data;
    if (!loc) return 2;

    const g = loc.depthGrid;
    if (g?.data && g.cols && g.rows) {
      const W = Math.max(1, this.s.scale.width);
      const u = Phaser.Math.Clamp(x / W, 0, 0.999999);
      const c = Math.floor(u * g.cols);
      let max = 0;
      for (let r = 0; r < g.rows; r++) {
        const d = g.data[r * g.cols + c] ?? 0;
        if (d > max) max = d;
      }
      return max || 2;
    }

    const bands = loc.depth?.bands;
    if (bands?.length) {
      const W = Math.max(1, this.s.scale.width);
      const u = Phaser.Math.Clamp(x / W, 0, 0.999999);
      const b = bands.find(b => u >= b.from && u < b.to) || bands[bands.length - 1];
      return b.m ?? 2;
    }
    return 2;
  }

  // ---------------- species area mods ----------------
  getSpeciesAreaModsAt(x, y) {
    const areas = this.data?.speciesAreas || [];
    if (!areas.length) return null;
    const pt = this._toUV(x, y);
    const mods = {};
    for (const a of areas) {
      if (!a?.polys?.length || !a.speciesId || !a.mult) continue;
      const hit = a.polys.some(poly => LocationMgr._pointInPoly(pt, poly));
      if (hit) mods[a.speciesId] = Math.max(mods[a.speciesId] || 1, a.mult);
    }
    return Object.keys(mods).length ? { species: mods } : null;
  }

  // ---------------- common ----------------
  get data() {
    return LOCATIONS.find(l => l.id === (this.current || 'lake')) || null;
  }
  getCurrentId(){ return this.current; }

  set(id) {
    if (!LOCATIONS.some(l => l.id === id)) return;
    this.current = id;
    this.applyBackground();
    this.drawDepthDebug(false);
    this.toggleCastMaskDebug(false);
    this._bgTimer?.remove(); this._bgTimer = null;

  }

  _fitCover(img) {
    if (!img) return;
    const W = this.s.scale.width, H = this.s.scale.height;
    const k = Math.max(W / img.width, H / img.height);
    img.setScale(k).setPosition(Math.round(W/2), Math.round(H/2));
  }

  // публично: верх/низ воды в пикселях
  getWaterArea(){
    const { top, shore } = this._waterBounds();
    return { top, bottom: shore };
  }
setWaterFxEnabled(on = true){
  this._waterFxEnabled = !!on;
  if (on) this.enableWaterFX({ amp: this._fxAmp(), waveLen: this._fxWaveLen(), speed: this._fxSpeed() });
  else    this.disableWaterFX();
}

// заметные, но мягкие значения по экрану
_fxAmp(){   // амплитуда в пикселях
  const H = this.s.scale.height;
  return Math.max(2, Math.round(H * 0.004)); // ~3–6px на типичных высотах
}
_fxWaveLen(){
  const H = this.s.scale.height;
  return Math.max(48, Math.round(H * 0.07)); // длина волны
}
_fxSpeed(){ return 24; } // px/сек

// быстро понять, «жив» ли FX
debugWaterFXStatus(){
  return {
    webgl: this.s.sys.game.config.renderType === Phaser.WEBGL,
    pipelineReady: !!this._waterPipeline,
    timeHook: !!this._boundUpdate,
    targets: Object.values(this.bgWaterLayers || {}).length
  };
}

  
}

export default LocationMgr;
