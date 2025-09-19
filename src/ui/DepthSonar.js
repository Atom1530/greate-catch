// src/ui/DepthSonar.js
export class DepthSonar {
  constructor(scene, { x = 150, y = 118, w = 260, h = 160 } = {}) {
    this.s = scene;
    this.pos = { x, y };
    this.size = { w, h };

    // --- логика
    this.samples = null;
    this.maxDepth = 0;
    this._fixedY = null;
    this.dotFollowX = false;
    this.dotXFrac = 0.82;
    this._dotXFixed = 0.82;

    this._fightOn = false;
    this._fightNoise = Math.random() * Math.PI * 2;
    this._fishDepth = null;
    this._lastTension = 0;
    this._lastReeling = false;

    this.epsBottom = 0.06;
    this.onProbe = null;

    // --- перф-кеши UI
    this._uiThrottleMs = 48;
    this._lastUIRedraw = 0;
    this._pillCache = { max: '', rig: '', clr: '', touching: null };

    // --- слайдер/позиции
    this.isCollapsed = false;
    this._tabW = 22;
    this._computeSlidePositions();

    // --- UI контейнер
    const c = (this.c = scene.add.container(this.shownX, y).setDepth(965));
    c.setScrollFactor(0);
    if (c.input) c.input.alwaysEnabled = true;

    const { w: W, h: H } = this.size;
    this._pad = 16;

    // корпус
    const outer = scene.add
      .rectangle(0, 0, W, H, 0x0f141c, 1)
      .setStrokeStyle(2, 0x000000, 0.85)
      .setOrigin(0.5);
    const inner = scene.add
      .rectangle(0, 0, W - 8, H - 8, 0x182634, 1)
      .setStrokeStyle(1, 0xffffff, 0.08)
      .setOrigin(0.5);

    // графика
    this.gProfile = scene.add.graphics().setDepth(966);
    this.gGrid = scene.add.graphics().setDepth(966);
    this.gTrail = scene.add.graphics().setDepth(967); // оставляем, но более не рисуем точки через Graphics
    this.gDot = scene.add.graphics().setDepth(968);
    this.gSweep = scene.add.graphics().setDepth(966);

    // «пилюли»-лейблы
    const mkPill = (align = 'left') => {
      const bg = scene.add
        .rectangle(0, 0, 80, 22, 0x0b0f16, 0.92)
        .setStrokeStyle(1, 0xffffff, 0.10)
        .setOrigin(align === 'right' ? 1 : 0, 0.5);
      bg.setRadius?.(6);
      const txt = scene.add
        .text(0, 0, '', {
          fontFamily: 'Arial, sans-serif',
          fontSize: '13px',
          color: '#ffffff',
        })
        .setOrigin(align === 'right' ? 1 : 0, 0.5);
      return { bg, txt, align };
    };

    this.pillMax = mkPill('left');   // слева-сверху
    this.pillRig = mkPill('right');  // справа-сверху
    this.pillClr = mkPill('right');  // справа-снизу

    // бейдж «НА ДНЕ»
    this.badgeG = scene.add.graphics().setDepth(971).setVisible(false);
    this.badgeTxt = scene.add
      .text(0, 0, 'НА ДНЕ', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '12px',
        color: '#ffefef',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(972)
      .setVisible(false);

    // левый язычок
    const tabX = -W / 2 - 8 + this._tabW / 2;
    this.tab = scene.add
      .rectangle(tabX, 0, this._tabW, 46, 0x243548, 1)
      .setStrokeStyle(1, 0xffffff, 0.18)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.toggle());
    this.arrow = scene.add
      .text(tabX, 0, '◄', { fontFamily: 'Arial, sans-serif', fontSize: '18px', color: '#ffffff' })
      .setOrigin(0.5);

    // правая «открывашка» — дети контейнера
    this._buildRightOpener();

    c.add([
      outer,
      inner,
      this.gProfile,
      this.gGrid,
      this.gSweep,
      this.gTrail,
      this.gDot,
      this.tab,
      this.arrow,
      // лейблы
      this.pillMax.bg,
      this.pillMax.txt,
      this.pillRig.bg,
      this.pillRig.txt,
      this.pillClr.bg,
      this.pillClr.txt,
      this.badgeG,
      this.badgeTxt,
      this.openBtnR,
      this.openIconR,
    ]);

    // === ЛЁГКИЙ ПУЛ «красных точек» ===
    this._setupTrailPool();

    // анимации
    this._sweepT = 0;
    this._sweepTimer = this.s.time.addEvent({
      delay: 50,
      loop: true,
      callback: () => {
        this._sweepT = (this._sweepT + 0.015) % 1;
        this._drawSweep();
      },
    });

    // таймер затухания хвоста
    this._trailTimer = this.s.time.addEvent({
      delay: 40,
      loop: true,
      callback: () => this._decayTrail(),
    });

    // ресайз
    this._onResize = () => {
      this._computeSlidePositions();
      this.c.setPosition(this.isCollapsed ? this.hiddenX : this.shownX, this.pos.y);
      this._repositionRightOpener();
      if (this.samples) this._drawProfile(); else this._drawIdle();
      this._layoutAttached();
      this._refreshRightOpenerVisibility();
    };
    scene.scale.on('resize', this._onResize);

    this._drawIdle();
  }

  // ===== PUBLIC API =====
  destroy() {
    this.s.scale.off('resize', this._onResize);
    this._sweepTimer?.remove(false);
    this._trailTimer?.remove(false);
    this.c.destroy();
  }

  setPosition(x, y) {
    this.pos = { x, y };
    this._computeSlidePositions();
    this.c.setPosition(this.isCollapsed ? this.hiddenX : this.shownX, y);
    this._layoutAttached();
  }

  setDotFollowX(on = true) { this.dotFollowX = !!on; }

  attachDepthCtrl(ctrl, gap = 14) {
    if (!ctrl?.c) return;
    this._attached = { ctrl, gap };
    this.c.add(ctrl.c);
    ctrl.c.setDepth(968);
    ctrl.c.setScrollFactor?.(0);
    this._layoutAttached();

    const userHandler =
      typeof ctrl.onChange === 'function' ? ctrl.onChange.bind(ctrl) : null;
    ctrl.onChange = (vMeters) => {
      this.s.rigDepthM = vMeters;
      try { this.updateDot(undefined); } catch (_) {}
      userHandler?.(vMeters);
    };

    if (typeof this.s.rigDepthM === 'number') ctrl.setValue(this.s.rigDepthM, true);
    else this.s.rigDepthM = ctrl.value;

    try { this.updateDot(undefined); } catch (_) {}
  }

  show(castX, castY) {
    const lm = this.s.locationMgr;
    let prof = null;
    try {
      const col = lm?.getColumnIndexForX?.(castX);
      prof = lm?.getDepthProfileForColumn?.(col, 64);
    } catch (_) {}

    if (!prof || !Array.isArray(prof.depths) || !prof.depths.length) {
      const n = 64;
      const depths = [];
      for (let i = 0; i < n; i++) {
        const u = 1 - i / (n - 1);
        const y = this._uToY(u);
        const d = lm?.getDepthAtXY?.(castX, y) ?? 0;
        depths.push(Math.max(0, d));
      }
      prof = { depths, max: Math.max(0, ...depths) };
    }

    this.samples = prof.depths.slice();
    this.maxDepth = Math.max(
      0.01,
      typeof prof.max === 'number' ? prof.max : Math.max(...this.samples),
    );

    if (castY == null) {
      const { top, shore } = this._waterBounds();
      castY = Phaser.Math.Clamp(
        this.s.input.activePointer?.worldY ?? shore,
        top,
        shore,
      );
    }
    this._fixedY = castY;
    const u0 = this._yToU(castY);
    this._dotXFixed = this.dotXFrac = u0;

    this._drawProfile();
    this.updateDot(castY);
  }

  hide() {
    this.samples = null;
    this.maxDepth = 0;
    this._drawIdle();
  }

  updateDot(currentY, opts = {}) {
    if (!this.samples) return;

    this._lastTension = Phaser.Math.Clamp(opts.tension ?? this._lastTension ?? 0, 0, 1);
    this._lastReeling = !!(opts.reeling ?? this._lastReeling);

    const info = this.probe(currentY);
    if (!info) return;

    this.dotXFrac = info.u;

    const { w, h } = this.size, pad = this._pad;
    const L = -w / 2 + pad, T = -h / 2 + pad, VW = w - pad * 2, VH = h - pad * 2;
    const rng = Math.max(0.1, this.maxDepth * 1.1);

    const mx = Math.round(L + info.u * VW) + 0.5;
    const my = Math.round(T + (info.dotDepth / rng) * VH) + 0.5;

    // линия уровня + сама точка
    this.gDot.clear();
    this.gDot.lineStyle(1, 0xffffff, 0.18).beginPath();
    this.gDot.moveTo(L, my); this.gDot.lineTo(L + VW, my); this.gDot.strokePath();
    this.gDot.fillStyle(0xff3b3b, 1).fillCircle(mx, my, 3);

    // лёгкий X-дрейф в бою
    if (this._fightOn && !this.dotFollowX && (opts.allowXDrift ?? false)) {
      const drift = (0.003 + 0.01 * (this._lastTension || 0)) * Math.sin(this._fightNoise * 0.5);
      this._dotXFixed = Phaser.Math.Clamp(this._dotXFixed + drift, 0, 1);
    }

    // --- ОПТИМИЗИРОВАННЫЙ ХВОСТ ---
    this._pushTrailPx(mx, my); // добавляем точку с троттлингом/порогом
    this._refreshTrailSprites(); // быстро обновляем альфу/видимость

    // подписи/бейдж (по троттлу)
    const clearance = Math.max(0, info.bottomDepth - info.baitDepth);
    const now = this.s.time.now;
    if (now - this._lastUIRedraw >= this._uiThrottleMs) {
      this._updatePills({
        L, T, VW, VH,
        max: this.maxDepth,
        rig: info.baitDepth,
        clr: clearance,
        touching: clearance <= (this.epsBottom ?? 0.06),
      });
      // «НА ДНЕ» — внизу
      this._setBottomBadge(clearance <= (this.epsBottom ?? 0.06), L + 60, T + VH - 12);
      this._lastUIRedraw = now;
    }

    if (typeof this.onProbe === 'function') this.onProbe(info);
  }

  probe(currentY) {
    if (!this.samples || !this.samples.length) return null;

    const u = this.dotFollowX ? this._yToU(currentY) : this._yToU(this._fixedY ?? currentY);

    const S = Math.max(1, this.samples.length - 1);
    const t = 1 - u;
    const xIdx = Phaser.Math.Clamp(t * S, 0, S);
    const i0 = Math.floor(xIdx), i1 = Math.min(i0 + 1, S), frac = xIdx - i0;
    const bottomDepth = this.samples[i0] * (1 - frac) + this.samples[i1] * frac;

    const rig = Math.max(0, this.s.rigDepthM ?? 0);
    const baitDepthBase = Math.min(rig, bottomDepth);

    let dotDepth = baitDepthBase;
    if (this._fightOn) {
      this._fightNoise += 0.035 + 0.02 * this._lastTension;
      const noiseAmp = (0.08 + 0.12 * this._lastTension) * bottomDepth;
      const noise = Math.sin(this._fightNoise) * noiseAmp;
      const diveFactor = this._lastReeling ? 0.25 : 0.8;
      const wantDive = diveFactor * this._lastTension * bottomDepth;
      const target = Phaser.Math.Clamp(baitDepthBase + wantDive + noise, 0, bottomDepth);
      if (this._fishDepth == null) this._fishDepth = baitDepthBase;
      this._fishDepth = Phaser.Math.Linear(this._fishDepth, target, 0.08);
      dotDepth = this._fishDepth;
    }

    const isTouchingBottom = bottomDepth - baitDepthBase <= (this.epsBottom ?? 0.06);

    return { u, bottomDepth, baitDepth: baitDepthBase, dotDepth, isTouchingBottom };
  }

  setFight(on = true) {
    this._fightOn = !!on;
    this._fishDepth = null;
    this._fightNoise = Math.random() * Math.PI * 2;
  }
  isFightOn() { return this._fightOn; }

  // ===== INTERNAL =====
  _computeSlidePositions() {
    const overhang = 8;
    const shift = this.size.w - this._tabW + overhang;
    this.shownX = this.pos.x;
    this.hiddenX = this.pos.x - shift;
  }

  _setInteractive(on) {
    this.tab?.setInteractive(on ? { useHandCursor: true } : undefined);
    this.openBtnR?.setInteractive(on && this.isCollapsed ? { useHandCursor: true } : undefined);
  }

  toggle() {
    this._tween?.remove();
    this.isCollapsed = !this.isCollapsed;
    this._setInteractive(false);
    this._tween = this.s.tweens.add({
      targets: this.c,
      x: this.isCollapsed ? this.hiddenX : this.shownX,
      duration: 180,
      ease: 'Cubic.inOut',
      onComplete: () => {
        this._refreshRightOpenerVisibility();
        this._setInteractive(true);
      },
    });
    this.arrow.setText(this.isCollapsed ? '►' : '◄');
    this._refreshRightOpenerVisibility();
  }

  _drawIdle() {
    this.gProfile.clear(); this.gGrid.clear(); this.gDot.clear();
    this.gSweep.clear(); this.gTrail.clear();
    this._clearTrailSprites();

    const { w, h } = this.size, pad = this._pad;
    const L = -w / 2 + pad, T = -h / 2 + pad, rW = w - pad * 2, rH = h - pad * 2;

    this._fillVGrad(this.gProfile, L, T, rW, rH, 0x16364b, 0x0d1e2c, 0.85, 0.95, 48);
    this.gProfile.lineStyle(1, 0xa7d9ff, 0.16).strokeRect(L + 0.5, T + 0.5, rW - 1, rH - 1);
    this._drawGrid(L, T, rW, rH);

    this._pillCache = { max: '', rig: '', clr: '', touching: null };
    this._placePills(L, T, rW, rH, { max: 0, rig: 0, clr: 0 }, true);
    this._setBottomBadge(false);
  }

  _drawProfile() {
    if (!this.samples) return this._drawIdle();

    const { w, h } = this.size, pad = this._pad;
    const L = -w / 2 + pad, T = -h / 2 + pad, VW = w - pad * 2, VH = h - pad * 2;
    const range = Math.max(0.1, this.maxDepth * 1.1);

    this._fillVGrad(this.gProfile, L, T, VW, VH, 0x16364b, 0x0d1e2c, 0.85, 0.95, 48);
    this.gProfile.lineStyle(1, 0xa7d9ff, 0.16).strokeRect(L + 0.5, T + 0.5, VW - 1, VH - 1);
    this._drawGrid(L, T, VW, VH);

    const toXY = (i) => {
      const t = i / (this.samples.length - 1);
      const u = 1 - t;
      const d = this.samples[i];
      const px = Math.round(L + u * VW) + 0.5;
      const py = Math.round(T + (d / range) * VH) + 0.5;
      return { x: px, y: py };
    };

    this.gProfile.fillStyle(0x1c3c52, 1).beginPath();
    let p = toXY(0);
    this.gProfile.moveTo(p.x, p.y);
    for (let i = 1; i < this.samples.length; i++) { p = toXY(i); this.gProfile.lineTo(p.x, p.y); }
    this.gProfile.lineTo(L, T + VH); this.gProfile.lineTo(L + VW, T + VH);
    this.gProfile.closePath(); this.gProfile.fillPath();

    this.gDot.clear(); this.gSweep.clear();
    this._clearTrailSprites(); // сброс хвоста при новом профиле
    this._drawSweep();

    this._pillCache = { max: '', rig: '', clr: '', touching: null };
    this._placePills(L, T, VW, VH, { max: this.maxDepth, rig: this.s.rigDepthM || 0, clr: 0 }, false);
  }

  _drawGrid(L, T, W, H) {
    this.gGrid.clear();
    this.gGrid.lineStyle(1, 0xffffff, 0.07);
    for (let i = 1; i <= 4; i++) {
      const y = Math.round(T + (H * i) / 5) + 0.5;
      this.gGrid.beginPath(); this.gGrid.moveTo(L, y); this.gGrid.lineTo(L + W, y); this.gGrid.strokePath();
    }
    for (let i = 1; i <= 3; i++) {
      const x = Math.round(L + (W * i) / 4) + 0.5;
      this.gGrid.beginPath(); this.gGrid.moveTo(x, T); this.gGrid.lineTo(x, T + H); this.gGrid.strokePath();
    }
  }

  _buildRightOpener() {
    const offX = this.size.w / 2 + 8 - this._tabW / 2;
    this.openBtnR = this.s.add
      .rectangle(offX, 0, this._tabW, 46, 0x243548, 1)
      .setStrokeStyle(1, 0xffffff, 0.18)
      .setDepth(969)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => { if (this.isCollapsed) this.toggle(); });
    this.openIconR = this.s.add
      .text(offX, 0, '►', { fontFamily: 'Arial, sans-serif', fontSize: '18px', color: '#ffffff' })
      .setOrigin(0.5)
      .setDepth(970);
  }

  // ВНУТРИ class DepthSonar { ... }

_setBottomBadge(show, x = 0, y = 0) {
  // кэш, чтобы не гонять перерисовку без изменений
  this._badgeState ||= { show: false, x: 0, y: 0 };
  const st = this._badgeState;

  if (st.show === show && (!show || (st.x === x && st.y === y))) return;

  st.show = show; st.x = x; st.y = y;

  this.badgeG.clear();
  this.badgeTxt.setVisible(show);
  this.badgeG.setVisible(show);
  if (!show) return;

  const w = 56, h = 18, r = 6;

  if (this.badgeG.fillRoundedRect) {
    this.badgeG.fillStyle(0x6b1e1e, 0.88);
    this.badgeG.fillRoundedRect(x - w/2, y - h/2, w, h, r);
    this.badgeG.lineStyle(2, 0xffb4b4, 0.9);
    this.badgeG.strokeRoundedRect(x - w/2, y - h/2, w, h, r);
  } else {
    this.badgeG.fillStyle(0x6b1e1e, 0.88);
    this.badgeG.fillRect(x - w/2, y - h/2, w, h);
    this.badgeG.lineStyle(2, 0xffb4b4, 0.9);
    this.badgeG.strokeRect(x - w/2, y - h/2, w, h);
  }
  this.badgeTxt.setPosition(x, y);
}

  _repositionRightOpener() {
    const offX = this.size.w / 2 + 8 - this._tabW / 2;
    this.openBtnR?.setPosition(offX, 0);
    this.openIconR?.setPosition(offX, 0);
  }
  _refreshRightOpenerVisibility() {
    const v = !!this.isCollapsed;
    this.openBtnR?.setVisible(v).setInteractive(v ? { useHandCursor: true } : undefined);
    this.openIconR?.setVisible(v);
  }

  _layoutAttached() {
    if (!this._attached) return;
    const { ctrl, gap } = this._attached;
    ctrl.c.setPosition(0, this.size.h / 2 + gap);
  }

  _drawSweep() {
    if (!this.samples) { this.gSweep.clear(); return; }
    const { w, h } = this.size, pad = this._pad;
    const L = -w / 2 + pad, T = -h / 2 + pad, VW = w - pad * 2, VH = h - pad * 2;
    const x = L + this._sweepT * VW;
    this.gSweep.clear();
    this.gSweep.lineStyle(1, 0xffffff, 0.06);
    this.gSweep.beginPath(); this.gSweep.moveTo(x + 0.5, T); this.gSweep.lineTo(x + 0.5, T + VH); this.gSweep.strokePath();
  }

  // ====== ХВОСТ (спрайтовый пул) ======
  _setupTrailPool() {
    const key = '__sonarTrailDot';
    if (!this.s.textures.exists(key)) {
      const gg = this.s.add.graphics();
      gg.fillStyle(0xff3b3b, 1).fillCircle(3, 3, 2);
      gg.generateTexture(key, 6, 6);
      gg.destroy();
    }
    this._trailKey = key;
    this._trailMax = 24;
    this._trailSprites = [];
    for (let i = 0; i < this._trailMax; i++) {
      const spr = this.s.add.image(0, 0, key)
        .setDepth(967).setVisible(false).setAlpha(0).setScrollFactor(0);
      this.c.add(spr);
      this._trailSprites.push(spr);
    }
    this._trail = [];              // [{x,y,t}]
    this._trailSampleMs = 80;      // не чаще 12.5 Гц
    this._trailMinPx = 3;          // минимум 3px между точками
    this._trailTTL = 1500;         // время жизни
    this._lastTrailAddT = 0;
    this._lastTrailX = null; this._lastTrailY = null;
  }

  _pushTrailPx(x, y) {
    const now = this.s.time.now;
    if (now - this._lastTrailAddT < this._trailSampleMs) return;
    if (this._lastTrailX != null) {
      const dx = x - this._lastTrailX, dy = y - this._lastTrailY;
      if (dx*dx + dy*dy < this._trailMinPx * this._trailMinPx) return;
    }
    this._lastTrailAddT = now;
    this._lastTrailX = x; this._lastTrailY = y;
    this._trail.push({ x, y, t: now });
    while (this._trail.length > this._trailMax) this._trail.shift();
  }

  _refreshTrailSprites() {
    const now = this.s.time.now;
    const n = this._trail.length;
    for (let i = 0; i < this._trailSprites.length; i++) {
      const spr = this._trailSprites[i];
      if (i < n) {
        const p = this._trail[i];
        spr.setVisible(true).setPosition(p.x, p.y);
        const age = Phaser.Math.Clamp((now - p.t) / this._trailTTL, 0, 1);
        spr.setAlpha(0.25 * (1 - age));
      } else {
        if (spr.visible) spr.setVisible(false).setAlpha(0);
      }
    }
  }

  _decayTrail() {
    if (!this._trail.length) return;
    const cutoff = this.s.time.now - this._trailTTL;
    let changed = false;
    while (this._trail.length && this._trail[0].t < cutoff) { this._trail.shift(); changed = true; }
    if (changed) this._refreshTrailSprites();
    else this._refreshTrailSprites(); // обновляем альфы по возрасту
  }

  _clearTrailSprites() {
    this._trail.length = 0;
    for (const spr of this._trailSprites) spr.setVisible(false).setAlpha(0);
    this._lastTrailX = this._lastTrailY = null;
  }

  // ---- лейблы
  _fmtM(v) { if (!isFinite(v)) return '—'; return `${v.toFixed(2)}м`; }
  _fmtClr(v) { const x = Math.max(0, v); return x < 1.0 ? `${Math.round(x * 100)}см` : `${x.toFixed(2)}м`; }

  _placePills(L, T, W, H, data, empty) {
    const pad = 6, h = 22;
    const mTxt = `Макс: ${empty ? '—' : this._fmtM(data.max)}`;
    const rTxt = `Оснастка: ${empty ? '—' : this._fmtM(data.rig)}`;
    const cTxt = `До дна: ${empty ? '—' : this._fmtClr(data.clr ?? 0)}`;
    this._setPillIfChanged(this.pillMax, mTxt, 'max', L + pad, T + pad, h);
    this._setPillIfChanged(this.pillRig, rTxt, 'rig', L + W - pad, T + pad, h);
    this._setPillIfChanged(this.pillClr, cTxt, 'clr', L + W - pad, T + H - pad, h);
    if (!empty) {
      const touching = !!data.touching;
      if (this._pillCache.touching !== touching) {
        this.pillRig.txt.setColor(touching ? '#ff6b6b' : '#ffffff');
        this._pillCache.touching = touching;
      }
    } else {
      this.pillRig.txt.setColor('#ffffff'); this._pillCache.touching = null;
    }
  }
_setPillIfChanged(pill, text, key, x, y, h) {
  if (!pill?.txt?.active || !pill?.bg?.active) return;   // <- защита
  if (this._pillCache[key] !== text) {
    this._pillCache[key] = text;
    pill.txt.setText(text);
    const w = Math.max(56, Math.round(pill.txt.width + 12));
    pill.bg.setSize(w, h);
  }
  pill.bg.setPosition(x, y);
  pill.txt.setPosition(pill.align === 'right' ? x - 6 : x + 6, y);
}

  _updatePills({ L, T, VW, VH, max, rig, clr, touching }) {
    this._placePills(L, T, VW, VH, { max, rig, clr, touching }, false);
  }

  // ---- утилиты
  _lerpColor(c1, c2, t) {
    const r1 = (c1 >> 16) & 255, g1 = (c1 >> 8) & 255, b1 = c1 & 255;
    const r2 = (c2 >> 16) & 255, g2 = (c2 >> 8) & 255, b2 = c2 & 255;
    const r = Math.round(r1 + (r2 - r1) * t), g = Math.round(g1 + (g2 - g1) * t), b = Math.round(b1 + (b2 - b1) * t);
    return (r << 16) | (g << 8) | b;
  }
  _fillVGrad(g, x, y, w, h, cTop, cBot, aTop = 1, aBot = 1, steps = 40) {
    const step = Math.max(1, Math.floor(h / steps));
    for (let i = 0; i < h; i += step) {
      const t = Math.min(1, i / h), c = this._lerpColor(cTop, cBot, t), a = aTop + (aBot - aTop) * t;
      g.fillStyle(c, a); g.fillRect(x, y + i, w, Math.min(step, h - i));
    }
  }

  _waterBounds() {
    const lm = this.s.locationMgr;
    if (lm?._waterBounds) { try { return lm._waterBounds(); } catch (_) {} }
    if (lm?.getWaterArea) { try { const a = lm.getWaterArea(); return { top: a.top | 0, shore: a.bottom | 0 }; } catch (_) {} }
    const H = this.s.scale.height | 0;
    return { top: Math.max(120, (H * 0.46) | 0), shore: H - 2 };
  }

  _yToU(y) {
    const lm = this.s.locationMgr;
    if (lm?.getCastDistanceRatio) return lm.getCastDistanceRatio(y);
    if (lm?.getShoreDistanceRatio) return lm.getShoreDistanceRatio(y);
    const { top, shore } = this._waterBounds();
    const Hwater = Math.max(1, shore - top);
    const v = Phaser.Math.Clamp((y - top) / Hwater, 0, 1);
    return 1 - v;
  }

  _uToY(u) {
    const { top, shore } = this._waterBounds();
    const Hwater = Math.max(1, shore - top);
    const v = 1 - Phaser.Math.Clamp(u, 0, 1);
    return top + v * Hwater;
  }
}

export default DepthSonar;
