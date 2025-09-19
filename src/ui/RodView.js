// src/ui/RodView.js
import UI from './theme.js';

export class RodView {
  /**
   * PNG-удочка + отрисовка лески до цели (обычно поплавок).
   * Пример:
   *   rodView.setRod(gear.rod)
   *   await rodView.playCastSequence({x,y}) // каст-анимация
   *   rodView.follow(this.bobber)           // привязка лески
   */
  constructor(scene, opts = {}) {
    this.s = scene;
    this.visible = false;

    // Политика движения и зазоры
    this._movePolicy  = opts.movePolicy  || 'near'; // по умолчанию держимся возле поплавка
    this._edgePad     = opts.edgePad     ?? 24;     // слева «берег»+резерв
    this._hudRightPad = opts.hudRightPad ?? 140;    // справа под кнопки/HUD
    this._gapToFloat  = opts.gapToFloat  ?? 80;     // «не подъезжать вплотную»
    this._idleTween   = null;

    // Держаться возле поплавка
    this._stickToFloat    = true;
    this._baseFollowPxps  = 420;

    // Каст-процесс
    this._isCasting = false;

    // над миром, под UI
    const Z = (UI?.z?.world ?? 0) + 6;

    this.base = { x: 0, y: 0 };
    this.root = scene.add.container(0, 0).setDepth(Z).setVisible(false);

    // PNG удочки: опираемся на рукоять (низ-лево)
    this.img = scene.add.image(0, 0, '__rod_placeholder__')
      .setOrigin(0.08, 0.94)
      .setVisible(false);

    // Отладочный маркер кончика (по запросу)
    this._debugTip = !!opts.debugTip;
    this._tipDot = scene.add.circle(0, 0, 3, 0xff5252, 1)
      .setDepth(Z + 1)
      .setVisible(this._debugTip);

    // Координаты кончика в долях текстуры (0..1)
    this.TIP_UX = 0.50;
    this.TIP_UY = 0.02;

    // Калибровка по ключам
    this.TIP_BY_KEY = {
      rod_tier1: { ux: 0.50, uy: 0.02 },
    };

    // Графика лески
    this.line = scene.add.graphics().setDepth(Z - 1);

    // Состояние
    this._tension = 0;          // 0..1
    this._baseRot = -0.06;      // слегка вниз к воде
    this._followGetter = null;  // () => {x,y}

    this.textureKey = null;

    this.root.add(this.img);

    this._updateBase();
    this._boundResize = this.layout.bind(this);
    scene.scale.on('resize', this._boundResize);
  }

  destroy(){
    this.s.scale.off('resize', this._boundResize);
    this.root?.destroy();
    this.line?.destroy();
    this._tipDot?.destroy();
  }

  // ---------- PUBLIC API ----------

  /** указать активную удочку (по def.id подбираем текстуру/калибровку) */
  setRod(def){
    if (!def){
      this.visible = false;
      this.root.setVisible(false);
      this.line.clear();
      return;
    }

    const key = this._pickTextureKey(def);
    this._ensureTexture(key);
    this.textureKey = key;
    this._applyTipForKey(key);

    // масштаб под текущую зону воды
    this.img.setTexture(key).setVisible(true).setScale(this._computeScaleFromWater());

    this.visible = true;
    this.root.setVisible(true);
    this.root.setRotation(this._baseRot);

    this._updateBase();
    this.root.setPosition(this.base.x, this.base.y);
  }

  /** тонкая ручная калибровка точки кончика (доли 0..1) */
  setTipUV(ux, uy){
    if (typeof ux === 'number') this.TIP_UX = Phaser.Math.Clamp(ux, 0, 1);
    if (typeof uy === 'number') this.TIP_UY = Phaser.Math.Clamp(uy, 0, 1);
  }

  setVisible(v){
    this.visible = !!v;
    this.root.setVisible(!!v);
    if (!v) this.line.clear();
  }

  /** лёгкий доворот/подтяжка в сторону цели (не «ездим», а только поза) */
  onCastTowards(pt){
    if (!this.visible || !pt) return;
    const nudge = 0.10;
    const toX = this.base.x + (pt.x - this.base.x) * nudge;
    const toY = this.base.y + (pt.y - this.base.y) * nudge * 0.25;
    const ang = Phaser.Math.Angle.Between(this.base.x, this.base.y, pt.x, pt.y) - Phaser.Math.DegToRad(90);

    this.s.tweens.add({
      targets: this.root,
      x: toX, y: toY, rotation: ang * 0.33 + this._baseRot * 0.67,
      duration: 220, ease: 'Sine.out'
    });
  }

  /** вернуть в исходную позу у кромки */
  resetPose(){
    if (!this.visible) return;
    this.s.tweens.add({
      targets: this.root,
      x: this.base.x, y: this.base.y, rotation: this._baseRot,
      duration: 220, ease: 'Sine.out'
    });
  }

  /**
   * Привязать леску к цели.
   * Можно передать объект с x/y, Phaser GameObject/Container или функцию () => ({x,y})
   */
  follow(target){
    if (!target){ this._followGetter = null; return; }

    if (typeof target === 'function'){
      this._followGetter = target;
      return;
    }

    if (typeof target.x === 'number' && typeof target.y === 'number'){
      this._followGetter = () => ({ x: target.x, y: target.y });
      return;
    }

    if (target.c && typeof target.c.x === 'number' && typeof target.c.y === 'number'){
      this._followGetter = () => ({ x: target.c.x, y: target.c.y });
      return;
    }

    this._followGetter = null;
  }

  /** 0..1 — влияет на изгиб/поворот */
  setTension(t){
    this._tension = Phaser.Math.Clamp(t ?? 0, 0, 1);
  }

  /** вызывать из Scene.update */
  update(){
    if (!this.visible){
      this.line.clear();
      return;
    }

    // лёгкий «прогиб» по натяжению
    const bend = Phaser.Math.Linear(0, 0.22, this._tension);
    this.root.rotation = this._baseRot + bend;

    this._drawLine();

    // База едет за поплавком, если есть цель, и нет каст-анимации
    if (!this._isCasting && this._stickToFloat && this._followGetter) {
      const end = this._followGetter();
      if (end && typeof end.x === 'number') {
        const desiredX = this._desiredBaseX(end.x);
        const curX = this.root.x ?? this.base.x;
        const dt = this.s.game.loop.delta / 1000;
        const maxMove = this._baseFollowPxps * dt;
        const dx = Phaser.Math.Clamp(desiredX - curX, -maxMove, maxMove);

        const newX = curX + dx;
        this.root.x = newX;
        this.base.x = newX;
        this.root.y = this.base.y; // y базы фиксирован по воде
      }
    }
  }

  /** пересчёт позиции/масштаба при ресайзе/смене воды */
  layout(){
    this._updateBase();
    if (!this._followGetter){
      this.root.setPosition(this.base.x, this.base.y);
      this.root.setRotation(this._baseRot);
    }
    // если вода/экран поменялись — обновить масштаб PNG
    if (this.textureKey) this.img.setScale(this._computeScaleFromWater());
  }

  // ---------- Каст-API ----------

  /** Мгновенный перенос базы к колонке заброса (без анимации перемещения) */
  teleportBaseToCast(castX){
    this._updateBase(); // обновит base.y под текущую воду/экран
    const bx = this._desiredBaseX(castX);
    this.root.setPosition(bx, this.base.y);
    this.base.x = bx;
    this.root.setRotation(this._baseRot);
  }

  /** Полная анимация заброса. Возвращает Promise, чтобы сцена знала, когда спавнить поплавок. */
/** Проиграть последовательность "замах → бросок → доброс" без timeline */
async playCastSequence(pt, opts = {}){
  const dur = Math.max(600, opts.duration ?? 2200);

  // разложим на 3 фазы: 25%/55%/20%
  const d1 = Math.floor(dur * 0.25);
  const d2 = Math.floor(dur * 0.55);
  const d3 = Math.max(180, dur - d1 - d2);

  // небольшая амплитуда замаха (вверх и чуть назад)
  const swingBackRot = this._baseRot - 0.28;
  const swingBackY   = this.base.y - 8;

  // направление к точке заброса
  const ang = Phaser.Math.Angle.Between(this.base.x, this.base.y, pt.x, pt.y) - Phaser.Math.DegToRad(90);
  const castRot = ang * 0.45 + this._baseRot * 0.55;

  // Фаза 1: замах
  await this._tweenAsync({
    targets: this.root,
    rotation: swingBackRot,
    y: swingBackY,
    duration: d1,
    ease: 'Sine.out'
  });

  // Фаза 2: бросок вперёд
  await this._tweenAsync({
    targets: this.root,
    rotation: castRot,
    y: this.base.y - 4,
    duration: d2,
    ease: 'Sine.in'
  });

  // Фаза 3: стабилизация
  await this._tweenAsync({
    targets: this.root,
    rotation: this._baseRot,
    y: this.base.y,
    duration: d3,
    ease: 'Sine.out'
  });

  // конец каста — позволяем рисовать леску
  this._castPlaying = false;
}
// === helpers: "await tween" ===
_tweenAsync(cfg){
  return new Promise(res => {
    const t = this.s.tweens.add({
      ...cfg,
      onComplete: () => { try{ cfg.onComplete?.(); }catch{} res(); }
    });
  });
}

/** Мгновенно перенести базу удочки к колонке заброса и спрятать леску на время каста */
teleportBaseToCast(castX){
  this._updateBase(); // актуализируем Y по воде
  const { left, right } = this._calcBounds();
  const minX = left  + this._gapToFloat;
  const maxX = right - this._gapToFloat;
  const bx = Phaser.Math.Clamp(castX, minX, maxX);

  // прячем линию на период каста
  this._castPlaying = true;
  this.line.clear();

  this.root.setVisible(true);
  this.visible = true;

  this.base.x = bx;     // обновляем внутреннюю "базу"
  this.base.y = this.base.y || this.root.y;

  // мгновенно ставим контейнер на новое место
  this.root.setPosition(this.base.x, this.base.y);
  this.root.setRotation(this._baseRot);
}

  // ---------- INTERNALS ----------

  _applyTipForKey(key){
    const t = this.TIP_BY_KEY?.[key];
    if (t){
      this.TIP_UX = Phaser.Math.Clamp(t.ux, 0, 1);
      this.TIP_UY = Phaser.Math.Clamp(t.uy, 0, 1);
    } else {
      this.TIP_UX = 0.50;
      this.TIP_UY = 0.02;
    }
  }

  setMovementPolicy(mode = 'near'){ this._movePolicy = (mode === 'opposite' ? 'opposite' : 'near'); }
  setMovementMargins({ edge, hudRightPad, gapToFloat } = {}){
    if (edge != null)        this._edgePad = edge;
    if (hudRightPad != null) this._hudRightPad = hudRightPad;
    if (gapToFloat != null)  this._gapToFloat = gapToFloat;
    this.layout();
  }

  /** Мягкая покачка, только для ожидания */
  setIdleSway(on){
    if (on){
      if (this._idleTween) return;
      const baseRot = this._baseRot;
      this._idleTween = this.s.tweens.add({
        targets: this.root,
        rotation: { from: baseRot - 0.03, to: baseRot + 0.03 },
        y:        { from: this.base.y, to: this.base.y - 3 },
        duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.inOut'
      });
    } else {
      if (this._idleTween){ this._idleTween.stop(); this._idleTween = null; }
      this.resetPose();
    }
  }

  _updateBase(){
    const area   = this.s.locationMgr?.getWaterArea?.();
    const bottom = area?.bottom ?? (this.s.scale.height - 16);
    const { left, right, W } = this._calcBounds();

    this.base.y = Math.round(bottom - 10);

    const defX  = Math.round(W * 0.54);
    const curX  = (this.root?.x ?? defX);
    this.base.x = Phaser.Math.Clamp(curX, left, right);
  }

  _desiredBaseX(targetX){
    const { left, right } = this._calcBounds();
    const minX = left  + this._gapToFloat;
    const maxX = right - this._gapToFloat;
    return Phaser.Math.Clamp(targetX, minX, maxX);
  }

  _computeScaleFromWater(){
    // целевая высота удочки ≈ 38–46% высоты водной зоны — подбирается приятнее
    const area = this.s.locationMgr?.getWaterArea?.();
    const top    = area?.top    ?? Math.floor(this.s.scale.height * 0.46);
    const bottom = area?.bottom ?? (this.s.scale.height - 2);
    const waterH = Math.max(60, bottom - top);

    const texH = this.img.height || 1000;
    const targetH = waterH * 0.46;
    return Phaser.Math.Clamp(targetH / texH, 0.28, 0.56);
  }

  _calcBounds(){
    const W = this.s.scale.width;
    const left  = this._edgePad;
    const right = Math.max(left + 50, W - (this._edgePad + this._hudRightPad));
    return { left, right, W };
  }

 _drawLine(){
  this.line.clear();
  if (this._castPlaying) return;           // << ключевая строка
  if (!this._followGetter) return;

  const end = this._followGetter();
  if (!end) return;

  const start = this._worldTip();

  if (this._debugTip){
    this._tipDot.setPosition(start.x, start.y).setVisible(true);
  }

  this.line.lineStyle(2, 0xffffff, 0.95);
  this.line.beginPath();
  this.line.moveTo(start.x, start.y);

  const dist = Phaser.Math.Distance.Between(start.x, start.y, end.x, end.y);
  const slackBase = Phaser.Math.Linear(64, 3, this._tension);
  const slack = slackBase * Phaser.Math.Clamp(dist / 260, 0.6, 2.0);

  const cx = (start.x + end.x) * 0.5;
  const cy = (start.y + end.y) * 0.5 + slack;

  if (typeof this.line.quadraticBezierTo === 'function'){
    this.line.quadraticBezierTo(cx, cy, end.x, end.y);
  } else if (typeof this.line.quadraticCurveTo === 'function'){
    this.line.quadraticCurveTo(cx, cy, end.x, end.y);
  } else {
    this.line.lineTo(end.x, end.y);
  }
  this.line.strokePath();
}

  _worldTip(){
    // локальные координаты кончика (коорд. контейнера)
    const w = this.img.displayWidth  || this.img.width  || 100;
    const h = this.img.displayHeight || this.img.height || 100;
    const lx = (this.TIP_UX - this.img.originX) * w;
    const ly = (this.TIP_UY - this.img.originY) * h;

    // в мировые
    const m = this.root.getWorldTransformMatrix();
    const p = new Phaser.Math.Vector2();
    m.transformPoint(lx, ly, p);
    return p;
  }

  _pickTextureKey(def){
    const id = def?.id || '';
    if (id.includes('wood') || id.includes('1')) return 'rod_tier1';
    if (id.includes('2')) return 'rod_tier2';
    if (id.includes('3')) return 'rod_tier3';
    return 'rod_tier1';
  }

  _ensureTexture(key){
    if (this.s.textures.exists(key)) return;
    const PATHS = {
      rod_tier1: 'src/assets/ui/rods/tir1.png',
      // rod_tier2: 'src/assets/ui/rods/tir2.png',
      // rod_tier3: 'src/assets/ui/rods/tir3.png',
    };
    const url = PATHS[key];
    if (!url) return;
    const loader = new Phaser.Loader.LoaderPlugin(this.s);
    loader.image(key, url);
    loader.start();
  }
}

export default RodView;
