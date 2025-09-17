// src/ui/DepthSonar.js
export class DepthSonar {
  constructor(scene, { x = 150, y = 118, w = 220, h = 140 } = {}) {
    this.s = scene;
    this.size = { w, h };
    this.pos = { x, y };

    this._fixedY = null;


    this.samples = null;
    this.maxDepth = 0;

    // точка на оси локатора (u∈[0..1], 0=берег/лево, 1=даль/право)
    this.dotFollowX = false;
    this.dotXFrac   = 0.82;
    this._dotXFixed = 0.82;

    // slide
    this.isCollapsed = false;
    this._tabW = 22;
    this._computeSlidePositions();

    // контейнер панели
    this.c = scene.add.container(this.shownX, y).setDepth(965);
    this.c.setScrollFactor(0);
    this.c.input && (this.c.input.alwaysEnabled = true);

    const { w:W, h:H } = this.size;
    const outer = scene.add.rectangle(0, 0, W, H, 0x10161f, 1)
      .setStrokeStyle(2, 0x000000, 0.8).setOrigin(0.5);
    const inner = scene.add.rectangle(0, 0, W - 20, H - 20, 0x183042, 1).setOrigin(0.5);

    this.gProfile = scene.add.graphics().setDepth(966);
    this.gDot     = scene.add.graphics().setDepth(967);

    this.lblMax = scene.add.text(-W/2 + 18, H/2 - 24, '', {
      fontFamily: 'Arial, sans-serif', fontSize: '18px', color: '#ffffff', fontStyle: 'bold'
    }).setOrigin(0, 0.5).setDepth(968);

    // левый «язычок»
    const tabX = -W/2 - 8 + this._tabW/2;
    this.tab = scene.add.rectangle(tabX, 0, this._tabW, 46, 0x243548, 1)
      .setStrokeStyle(1, 0xffffff, 0.18)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.toggle());
    this.arrow = scene.add.text(tabX, 0, '◄', {
      fontFamily:'Arial, sans-serif', fontSize:'18px', color:'#ffffff'
    }).setOrigin(0.5);

    this.c.add([outer, inner, this.gProfile, this.gDot, this.lblMax, this.tab, this.arrow]);

    // правая открывалка (видна только когда панель спрятана)
    this._buildRightOpener();

    // единый ресайз
    this._onResize = () => {
      if (this.samples) this._drawProfile(); else this._drawIdle();
      this._computeSlidePositions();
      this.c.setPosition(this.isCollapsed ? this.hiddenX : this.shownX, this.pos.y);
      this._placeRightOpener();
      this._layoutAttached();
      this._refreshRightOpenerVisibility();
    };
    scene.scale.on('resize', this._onResize);

    this._drawIdle();

    this._fightOn = false;
    this._fishDepth = null;     // сглаженная «рыбья» глубина под точкой
    this._fightNoise = Math.random() * Math.PI * 2;

  }

  destroy(){
    this.s.scale.off('resize', this._onResize);
    this.c.destroy();
    this.openBtnR?.destroy();
    this.openIconR?.destroy();
  }

  setPosition(x, y) {
    this.pos = { x, y };
    this._computeSlidePositions();
    this.c.setPosition(this.isCollapsed ? this.hiddenX : this.shownX, y);
    this._placeRightOpener();
    this._layoutAttached();
  }

  setDotFollowX(on = true){ this.dotFollowX = !!on; }

  // прикрепляет внешний контрол (DepthCtrl) к низу панели
  attachDepthCtrl(ctrl, gap = 14) {
    if (!ctrl?.c) return;
    this._attached = { ctrl, gap };
    this.c.add(ctrl.c);                      // теперь он — ребёнок панели
    ctrl.c.setDepth(968);
    ctrl.c.setScrollFactor?.(0);
    this._layoutAttached();
  }

  // показать профиль в колонке заброса, зафиксировать X точки
show(castX, castY){
  const prof = this.s.locationMgr.getDepthProfileForColumn(
    this.s.locationMgr.getColumnIndexForX(castX), 64
  );
  this.samples  = prof.depths;
  this.maxDepth = prof.max;

  if (castY == null) {
    const { top, shore } = this.s.locationMgr._waterBounds();
    castY = Phaser.Math.Clamp(this.s.input.activePointer?.worldY ?? shore, top, shore);
  }
  this._fixedY = castY;                 // <— запоминаем исходный Y
  const u0 = this._yToU(castY);
  this._dotXFixed = u0;                 // можно оставить для первичного отрисования
  this.dotXFrac   = u0;

  this._drawProfile();
}


  hide(){ this.samples = null; this.maxDepth = 0; this._drawIdle(); }

updateDot(currentY, opts = {}) {
  if (!this.samples) return;

  const u = this.dotFollowX ? this._yToU(currentY)
                            : this._yToU(this._fixedY ?? currentY);
  this.dotXFrac = u;

  const S = Math.max(1, this.samples.length - 1);
  const t = 1 - u; // 0 = даль/право, 1 = берег/лево
  const xIdx = Phaser.Math.Clamp(t * S, 0, S);
  const i0 = Math.floor(xIdx), i1 = Math.min(i0 + 1, S), frac = xIdx - i0;
  const bottomDepth = this.samples[i0]*(1-frac) + this.samples[i1]*frac;

  const rig = Math.max(0, this.s.rigDepthM ?? 0);
  const baitDepth = Math.min(rig, bottomDepth);

// --- вертикальная «жизнь» в бою ---
let dotDepth = baitDepth;
if (this._fightOn) {
  const tension = Phaser.Math.Clamp(opts.tension ?? 0, 0, 1);
  const reeling = !!opts.reeling;

  this._fightNoise += 0.035 + 0.02 * tension;
  const noiseAmp = (0.08 + 0.12 * tension) * bottomDepth; // 8–20% от дна
  const noise = Math.sin(this._fightNoise) * noiseAmp;

  const diveFactor = (reeling ? 0.25 : 0.8);
  const wantDive = diveFactor * tension * bottomDepth;

  const target = Phaser.Math.Clamp(baitDepth + wantDive + noise, 0, bottomDepth);

  if (this._fishDepth == null) this._fishDepth = baitDepth;
  this._fishDepth = Phaser.Math.Linear(this._fishDepth, target, 0.08);

  dotDepth = this._fishDepth;
}

  // ------------------------------------

  const { w, h } = this.size, pad = 18;
  const L = -w/2 + pad, T = -h/2 + pad, VW = w - pad*2, VH = h - pad*2;
  const range = Math.max(0.1, this.maxDepth * 1.1);

  const mx = Math.round(L + u * VW) + 0.5;
  const my = Math.round(T + (dotDepth / range) * VH) + 0.5; // <<< тут dotDepth

  this.gDot.clear();
  this.gDot.lineStyle(1, 0xffffff, 0.18).beginPath();
  this.gDot.moveTo(L, my); this.gDot.lineTo(L + VW, my); this.gDot.strokePath();
  this.gDot.fillStyle(0xff3b3b, 1).fillCircle(mx, my, 3);

  // лёгкий X-дрейф только при фиксированном X
  if (this._fightOn && !this.dotFollowX && (opts.allowXDrift ?? false)) {
    const drift = (0.003 + 0.01 * (opts.tension ?? 0)) * Math.sin(this._fightNoise * 0.5);
    this._dotXFixed = Phaser.Math.Clamp(this._dotXFixed + drift, 0, 1);
  }
}

  
  //уходит на глубину 
  setFight(on = true){
  this._fightOn = !!on;
  this._fishDepth = null;              // пересинхронимся при старте/стопе
  this._fightNoise = Math.random() * Math.PI * 2;
}

isFightOn(){ return this._fightOn; }


  // --- internal ---
_yToU(y){
  const lm = this.s.locationMgr;
  if (lm?.getCastDistanceRatio) return lm.getCastDistanceRatio(y);
  if (lm?.getShoreDistanceRatio) return lm.getShoreDistanceRatio(y);
  // совсем уж бэкап, если LM ещё не готов:
  const H = this.s.scale.height;
  const t = Phaser.Math.Clamp(y / Math.max(1, H), 0, 1);
  return 1 - t;
}


  _computeSlidePositions() {
    const overhang = 8;
    const shift = (this.size.w - this._tabW) + overhang;
    this.shownX  = this.pos.x;
    this.hiddenX = this.pos.x - shift;
  }

  toggle() {
    if (this._tween) this._tween.stop();
    this.isCollapsed = !this.isCollapsed;
    this._tween = this.s.tweens.add({
      targets: this.c,
      x: this.isCollapsed ? this.hiddenX : this.shownX,
      duration: 220, ease: 'Sine.inOut',
      onUpdate: () => { this._placeRightOpener(); this._refreshRightOpenerVisibility(); },
      onComplete: () => this._refreshRightOpenerVisibility()
    });
    this.arrow.setText(this.isCollapsed ? '►' : '◄');
    this._refreshRightOpenerVisibility();
  }

  _drawIdle() {
    this.gProfile.clear(); this.gDot.clear();
    const { w, h } = this.size, pad = 10, rW = w - 20, rH = h - 20;
    this.gProfile.fillStyle(0x1a394c, 1);
    this.gProfile.fillRect(-rW/2 + pad, -rH/2 + pad, rW - pad*2, rH - pad*2);
    this.lblMax.setText('');
  }

  _drawProfile(){
    if (!this.samples) { this._drawIdle(); return; }

    const { w, h } = this.size, pad = 18;
    const L = -w/2 + pad, T = -h/2 + pad, VW = w - pad*2, VH = h - pad*2;
    const range = Math.max(0.1, this.maxDepth * 1.1);

    this.gProfile.clear();
    this.gProfile.fillStyle(0x0f2a3b, 1);
    this.gProfile.fillRect(L, T, VW, VH);

    const toXY = (i) => {
      const t = i / (this.samples.length - 1); // 0=даль/право,1=берег/лево
      const u = 1 - t;
      const d = this.samples[i];
      const px = Math.round(L + u * VW) + 0.5;
      const py = Math.round(T + (d / range) * VH) + 0.5;
      return { x:px, y:py };
    };

    this.gProfile.fillStyle(0x213e54, 1).beginPath();
    let p = toXY(0);
    this.gProfile.moveTo(p.x, p.y);
    for (let i = 1; i < this.samples.length; i++) {
      p = toXY(i);
      this.gProfile.lineTo(p.x, p.y);
    }
    const BRX = L + VW, BRY = T + VH;
    this.gProfile.lineTo(L, BRY);
    this.gProfile.lineTo(BRX, BRY);
    this.gProfile.closePath();
    this.gProfile.fillPath();

    this.lblMax.setText(`${this.maxDepth.toFixed(2)}m`);
    this.gDot.clear();
  }

  _buildRightOpener(){
    const z = 969;
    this.openBtnR = this.s.add.rectangle(0, 0, this._tabW, 46, 0x243548, 1)
      .setStrokeStyle(1, 0xffffff, 0.18)
      .setDepth(z)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => { if (this.isCollapsed) this.toggle(); });
    this.openIconR = this.s.add.text(0, 0, '►', {
      fontFamily:'Arial, sans-serif', fontSize:'18px', color:'#ffffff'
    }).setOrigin(0.5).setDepth(z+1).setScrollFactor(0);

    this._placeRightOpener();
    this._refreshRightOpenerVisibility();
  }

  _placeRightOpener(){
    const x = this.c.x + (this.size.w/2) + 8 - this._tabW/2;
    const y = this.pos.y;
    this.openBtnR?.setPosition(x, y);
    this.openIconR?.setPosition(x, y);
  }

  _refreshRightOpenerVisibility(){
    const v = !!this.isCollapsed;
    this.openBtnR?.setVisible(v).setInteractive(v);
    this.openIconR?.setVisible(v);
  }

  _layoutAttached(){
    if (!this._attached) return;
    const { ctrl, gap } = this._attached;
    ctrl.c.setPosition(0, (this.size.h/2) + gap);
  }
}

export default DepthSonar;
