// src/ui/DepthCtrl.js
export class DepthCtrl {
  constructor(scene, initValueM = 1.2, pos = { x: 64, y: 64 }, onChange = ()=>{}, opts = {}) {
    this.s = scene;

    // единицы: внутри см (целые), наружу — метры
    this._prec = 100;
    this.minM  = opts.min  ?? 0.20;
    this.maxM  = opts.max  ?? 8.00;
    this.stepM = opts.step ?? 0.01;

    this.minCm  = Math.round(this.minM  * this._prec);
    this.maxCm  = Math.round(this.maxM  * this._prec);
    this.stepCm = Math.max(1, Math.round(this.stepM * this._prec));

    this._valueCm = Phaser.Math.Clamp(Math.round(initValueM * this._prec), this.minCm, this.maxCm);
    this.value    = this._valueCm / this._prec;
    this.onChange = onChange;

    // ——— режим "по дну" (необязателен) ———
    // если передан opts.getBottomDepth -> функция должна возвращать текущую глубину дна (в метрах) ПОД КРЮЧКОМ
    this.getBottomDepth = (typeof opts.getBottomDepth === 'function') ? opts.getBottomDepth : null;
    this.autoBottomOn   = !!opts.autoBottom;                     // стартовое состояние
    this.autoOffsetCm   = Math.round((opts.autoOffsetM ?? 0) * this._prec); // отступ от дна (+см вверх)
    this._autoTimer     = null;

    this.modalOpen = false;
    this._modal = null;
    this._hostRef = null;
    this._applyRequested = false;
    this.useHost = !!(opts.useHost);
    this.badgeStroke = 0x48c2ff;

    // ——— лаунчер-кнопка (HUD) ———
    this.c = scene.add.container(pos.x, pos.y).setDepth(980);
    this.c.setScrollFactor?.(0);

    const bw = 148, bh = 32;
    this.btn = scene.add.rectangle(0, 0, bw, bh, 0x2b334a, 1)
      .setStrokeStyle(2, 0xffffff, 0.18)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.btn.setRadius?.(bh/2);

    this.btnLbl = scene.add.text(0, 0, this._label(), {
      fontFamily:'Arial, sans-serif', fontSize:'13px', color:'#ffffff'
    }).setOrigin(0.5);

    this.c.add([this.btn, this.btnLbl]);
    this.btn.on('pointerover', ()=> this.btn.setFillStyle(0x323c58,1));
    this.btn.on('pointerout',  ()=> this.btn.setFillStyle(0x2b334a,1));
    this.btn.on('pointerdown', ()=> this._openModal());

    // если автоподстройка включена снаружи — запустим таймер
    if (this.autoBottomOn) this._ensureAutoTimer();
  }

  // ===== helpers =====
  _label(){ return `Глубина: ${this.value.toFixed(2)}м`; }
  _cmLabel(){ return `${Math.round(this.value * 100)} см`; }

  _applyCm(newCm, silent=false){
    const clamped = Phaser.Math.Clamp(Math.round(newCm), this.minCm, this.maxCm);
    if (clamped === this._valueCm) {
      // всё равно синхронизируем визуал, если открыт модал
      if (this.modalOpen) this._syncModalVisual();
      return;
    }
    this._valueCm = clamped;
    this.value = clamped / this._prec;

    this.btnLbl?.setText(this._label());
    if (!silent) this.onChange?.(this.value);

    this._syncModalVisual();
    this._updateStepBtns?.();
  }

  _syncModalVisual(){
    if (this._handle && this._prog && this._toY) {
      const ny = this._toY(this.value);
      this._handle.y = ny;
      this._prog.height = Math.max(2, ny - this._y0);
      this._num?.setText(this._cmLabel());
      this._updateRigVisual();
    }
  }

  _bump(deltaCm, silent=false){
    this._applyCm(this._valueCm + deltaCm, silent);
  }

  setPosition(x, y){ this.c?.setPosition(x, y); }

  setValue(vMeters, silent=false){
    const rawCm = Math.round(Phaser.Math.Clamp(vMeters, this.minM, this.maxM) * this._prec);
    const snappedCm = Math.round(rawCm / this.stepCm) * this.stepCm;
    this._applyCm(snappedCm, silent);
  }

  // === публично: автоподстройка под дно ===
  setAutoBottom(on = true, offsetM = (this.autoOffsetCm/this._prec)){
    this.autoBottomOn = !!on;
    this.autoOffsetCm = Math.round((offsetM ?? 0) * this._prec);
    this._updateAutoInteractivity();
    if (this.autoBottomOn) this._ensureAutoTimer();
    else this._stopAutoTimer();
  }
  isAutoBottom(){ return !!this.autoBottomOn; }
  setAutoOffset(offsetM){ this.setAutoBottom(this.autoBottomOn, offsetM); }

  destroy(){
    this._stopAutoTimer();
    this._closeModal(false, /*force*/true);
    this.c?.destroy();
  }

  // =================== MODAL ===================
  _buildUI(root, { W, H, cx, cy, PW, PH, withOverlay }) {
    const ACCENT = 0xffc940;
    const PANEL  = 0x1f2433;

    // overlay
    if (withOverlay) {
      const ovr = this.s.add.rectangle(0, 0, W, H, 0x000000, 0.5)
        .setOrigin(0,0).setScrollFactor(0).setInteractive();
      root.add(ovr);
    }

    // панель
    PW = Math.round(PW); PH = Math.round(PH);
    const shadow = this.s.add.rectangle(cx+3, cy+4, PW, PH, 0x000000, 0.22);
    const panel  = this.s.add.rectangle(cx,  cy,   PW, PH, PANEL, 0.86)
      .setStrokeStyle(2, 0xa7d9ff, 0.22);
    root.add([shadow, panel]);

    // заголовок
    const titleX = Math.round(cx - PW/2 + 14);
    const titleY = Math.round(cy - PH/2 + 12);
    const title = this.s.add.text(titleX, titleY, 'Настройки глубины', {
      fontFamily:'Arial, sans-serif', fontSize:'20px', color:'#ffd36a', fontStyle:'bold'
    }).setOrigin(0,0);

    const closeX = this.s.add.text(Math.round(cx + PW/2 - 12), titleY - 2, '✕', {
      fontFamily:'Arial, sans-serif', fontSize:'18px', color:'#ffd36a', fontStyle:'bold'
    }).setOrigin(1,0).setInteractive({ useHandCursor:true });

    const sep = this.s.add.rectangle(cx, Math.round(titleY + 28.5), PW - 24, 1, 0xffffff, 0.10)
      .setOrigin(0.5, 0);
    root.add([title, closeX, sep]);

    // бейдж «см»
    this._numBadgeG = this.s.add.graphics();
    this._num = this.s.add.text(0, 0, this._cmLabel(), {
      fontFamily:'Arial, sans-serif', fontSize:'16px', color:'#ffd36a', fontStyle:'bold'
    }).setOrigin(0.5);
    root.add([this._numBadgeG, this._num]);

    // ── левый вертикальный слайдер ──
    const pad = 14;
    const laneW = 24;
    const trackH = Math.round(PH - 172);
    const trackX = Math.round(cx - PW/2 + pad + laneW/2);
    const y0 = Math.round(cy - trackH/2);
    const y1 = Math.round(cy + trackH/2);
    this._y0 = y0; this._y1 = y1;

    const well   = this.s.add.rectangle(trackX, cy, laneW, trackH + 16, 0x000000, 0.18)
                      .setStrokeStyle(1, 0xffffff, 0.08);
    const groove = this.s.add.rectangle(trackX, cy, 6, trackH, 0xffffff, 0.10);
    const track  = this.s.add.rectangle(trackX, cy, 6, trackH, 0x000000, 0)
                      .setOrigin(0.5).setInteractive();
    root.add([well, groove, track]);

    const toY = (vMeters)=> {
      const frac = (vMeters - this.minM) / (this.maxM - this.minM);
      return Math.round(y0 + Phaser.Math.Clamp(frac,0,1) * trackH);
    };
    this._toY = toY;

    this._prog = this.s.add.rectangle(trackX, y0, 4, Math.max(2, toY(this.value) - y0), 0x5aa6ff, 1)
      .setOrigin(0.5, 0);
    this._handle = this.s.add.circle(trackX, toY(this.value), 8, 0x1b2232, 1)
      .setStrokeStyle(2, 0x0f1116, 0.6)
      .setInteractive({ draggable:true, useHandCursor:true });
    root.add([this._prog, this._handle]);

    const dragTo = (py)=>{
      const ny = Phaser.Math.Clamp(Math.round(py), y0, y1);
      this._handle.y = ny;
      const frac = (ny - y0) / trackH;
      const rawM = this.minM + frac * (this.maxM - this.minM);
      const rawCm = Math.round(rawM * this._prec);
      const vCm = Math.round(rawCm / this.stepCm) * this.stepCm;
      this._applyCm(vCm, false);
      this._prog.height = Math.max(2, ny - y0);
    };
    this.s.input.setDraggable(this._handle, true);
    this._handle.on('drag', (_p, _x, dragY)=> dragTo(dragY));
    track.on('pointerdown', (p)=> dragTo(p.worldY));

    // ── центр: снасть ──
    const rigLeft  = Math.round(trackX + laneW/2 + 12);
    const rigRight = Math.round(cx + PW/2 - pad);
    const rigW = Math.max(112, (rigRight - rigLeft));
    const rigH = trackH;
    const rigCx = Math.round(rigLeft + rigW/2);
    const rigCy = cy;

    this._rigRoot = this.s.add.container(0,0);
    root.add(this._rigRoot);

    const rigHit = this.s.add.rectangle(rigCx, rigCy, rigW, rigH, 0x000000, 0.001)
      .setInteractive({ useHandCursor:true });
    this._rigRoot.add(rigHit);

    this._waterG = this.s.add.graphics();
    this._rigRoot.add(this._waterG);

    this._rigG = this.s.add.graphics();
    this._rigLineG = this.s.add.graphics();
    this._rigHookG = this.s.add.graphics();
    this._rigBracketG = this.s.add.graphics();
    this._rigRoot.add([this._rigG, this._rigLineG, this._rigHookG, this._rigBracketG]);

    this._waterPhase = 0;
    this._waterTimer = this.s.time.addEvent({
      delay: 120, loop: true,
      callback: () => { this._waterPhase = (this._waterPhase + 0.15) % (Math.PI*2); this._drawWaterBg(); }
    });

    this._rigGeom = {
      top: rigCy - rigH/2 + 8,
      bottom: rigCy + rigH/2 - 8,
      left: rigLeft,
      right: rigRight,
      cx: rigCx
    };

    this._drawRigStatic(ACCENT);
    this._updateRigVisual();
    this._drawWaterBg();

    const rigDragTo = (py)=>{
      const y = Phaser.Math.Clamp(Math.round(py), this._rigGeom.top + 14, this._rigGeom.bottom - 6);
      const frac = (y - (this._rigGeom.top + 14)) / ((this._rigGeom.bottom - 6) - (this._rigGeom.top + 14));
      const rawM = this.minM + frac * (this.maxM - this.minM);
      const rawCm = Math.round(rawM * this._prec);
      const vCm = Math.round(rawCm / this.stepCm) * this.stepCm;
      this._applyCm(vCm, false);
    };
    rigHit.on('pointerdown', (p)=> rigDragTo(p.worldY));
    rigHit.on('pointermove', (p)=> { if (p.isDown) rigDragTo(p.worldY); });

    // колесо: ±1см / ±5см (Shift) / ±10см (Ctrl/Cmd)
    this._wheelHandler = (_ptr, _over, _dx, dy, _dz, ev)=> {
      if (!this.modalOpen) return;
      const base = (dy > 0 ? +1 : -1);
      const mult = (ev?.ctrlKey || ev?.metaKey) ? 10 : (ev?.shiftKey ? 5 : 1);
      this._bump(base * mult);
    };
    this.s.input.on('wheel', this._wheelHandler);

    // ── степпер −/＋ (±1 см), с ускорением ──
    const stepSize = 24;
    const stepGap  = 8;
    const stepY    = Math.round(cy + PH/2 - 54);
    const decX     = Math.round(trackX - (stepSize/2 + stepGap/2));
    const incX     = Math.round(trackX + (stepSize/2 + stepGap/2));

    const mkBtn = (x, y, txt)=> {
      const r = this.s.add.rectangle(x, y, stepSize, stepSize, 0x0b0f16, 0.95)
        .setStrokeStyle(2, 0xffffff, 0.16).setInteractive({ useHandCursor:true });
      r.setRadius?.(6);
      const t = this.s.add.text(x, y, txt, {
        fontFamily:'Arial, sans-serif', fontSize:'16px', color:'#ffd36a', fontStyle:'bold'
      }).setOrigin(0.5);
      root.add([r, t]);
      return r;
    };

    this._decBtn = mkBtn(decX, stepY, '−');
    this._incBtn = mkBtn(incX, stepY, '+');
    const hover = (btn, over)=> btn.setFillStyle(0x0e1622, over? 1 : 0.95);
    this._decBtn.on('pointerover', ()=>hover(this._decBtn, true));
    this._decBtn.on('pointerout',  ()=>hover(this._decBtn, false));
    this._incBtn.on('pointerover', ()=>hover(this._incBtn, true));
    this._incBtn.on('pointerout',  ()=>hover(this._incBtn, false));

    const stepOnce = (d)=> this._bump(d);
    const holdStart = (d)=>{
      stepOnce(d);
      this._repeatEv?.remove(false);
      // ускорение: 240 → 120 → 60 мс
      let delay = 240, ticks = 0;
      this._repeatEv = this.s.time.addEvent({
        delay, loop: true, callback: ()=> {
          stepOnce(d);
          ticks++;
          if (ticks === 6) { this._repeatEv.delay = 120; }
          else if (ticks === 16) { this._repeatEv.delay = 60; }
        }
      });
    };
    const holdStop = ()=>{
      this._repeatEv?.remove(false);
      this._repeatEv = null;
    };

    this._decBtn.on('pointerdown', ()=> holdStart(-1));
    this._incBtn.on('pointerdown', ()=> holdStart(+1));
    this.s.input.on('pointerup', holdStop);
    this._stepperStop = holdStop;
    this._updateStepBtns?.();

    // ── кнопки OK/Cancel ──
    const btnY = Math.round(cy + PH/2 - 20);
    const wBtn = 96, hBtn = 30, gap = 12;

    const ok = this.s.add.rectangle(Math.round(cx - (wBtn/2 + gap/2)), btnY, wBtn, hBtn, 0x2e7d32, 1)
      .setStrokeStyle(2, 0xffffff, 0.18).setOrigin(0.5).setInteractive({ useHandCursor:true });
    ok.setRadius?.(6);
    const okLbl = this.s.add.text(ok.x, ok.y, 'Готово', {
      fontFamily:'Arial, sans-serif', fontSize:'14px', color:'#ffffff'
    }).setOrigin(0.5);

    const cancel = this.s.add.rectangle(Math.round(cx + (wBtn/2 + gap/2)), btnY, wBtn, hBtn, 0x36425b, 1)
      .setStrokeStyle(2, 0xffffff, 0.18).setOrigin(0.5).setInteractive({ useHandCursor:true });
    cancel.setRadius?.(6);
    const cancelLbl = this.s.add.text(cancel.x, cancel.y, 'Отмена', {
      fontFamily:'Arial, sans-serif', fontSize:'14px', color:'#ffffff'
    }).setOrigin(0.5);

    root.add([ok, okLbl, cancel, cancelLbl]);

    // ── блок "По дну" + отступ ──
    const baseY = Math.round(titleY + 48);
    const boxX  = Math.round(trackX);
    const chk  = this.s.add.rectangle(boxX, baseY, 16, 16, 0x0b0f16, 0.95)
      .setStrokeStyle(2, 0xffffff, 0.16).setInteractive({ useHandCursor:true });
    const tick = this.s.add.text(boxX, baseY-1, '✓', {
      fontFamily:'Arial, sans-serif', fontSize:'13px', color:'#ffd36a', fontStyle:'bold'
    }).setOrigin(0.5).setVisible(this.autoBottomOn);
    const lbl  = this.s.add.text(boxX + 12, baseY, 'По дну (авто)', {
      fontFamily:'Arial, sans-serif', fontSize:'14px', color:'#ffd36a'
    }).setOrigin(0,0.5);
    root.add([chk, tick, lbl]);

    // отступ
    const offsY = baseY;
    const offsLbl = this.s.add.text(rigCx - 24, offsY, 'Отступ:', {
      fontFamily:'Arial, sans-serif', fontSize:'14px', color:'#ffd36a'
    }).setOrigin(1,0.5);
    const offsVal = this.s.add.text(rigCx + 44, offsY, `${Math.max(0, this.autoOffsetCm)} см`, {
      fontFamily:'Arial, sans-serif', fontSize:'14px', color:'#ffffff'
    }).setOrigin(0.5);
    const offsDec = this.s.add.rectangle(rigCx + 16, offsY, 20, 20, 0x0b0f16, 0.95)
      .setStrokeStyle(2, 0xffffff, 0.14).setInteractive({ useHandCursor:true });
    const offsInc = this.s.add.rectangle(rigCx + 72, offsY, 20, 20, 0x0b0f16, 0.95)
      .setStrokeStyle(2, 0xffffff, 0.14).setInteractive({ useHandCursor:true });
    const offsDecT = this.s.add.text(offsDec.x, offsDec.y, '−', { fontFamily:'Arial, sans-serif', fontSize:'14px', color:'#ffd36a', fontStyle:'bold' }).setOrigin(0.5);
    const offsIncT = this.s.add.text(offsInc.x, offsInc.y, '+', { fontFamily:'Arial, sans-serif', fontSize:'14px', color:'#ffd36a', fontStyle:'bold' }).setOrigin(0.5);
    root.add([offsLbl, offsVal, offsDec, offsInc, offsDecT, offsIncT]);

    const refreshOffsUI = ()=>{
      offsVal.setText(`${Math.max(0,this.autoOffsetCm)} см`);
      tick.setVisible(this.autoBottomOn);
      chk.setAlpha(this.autoBottomOn ? 1 : 0.9);
      this._updateAutoInteractivity();
    };

    const changeOffset = (d)=> {
      this.autoOffsetCm = Math.max(0, this.autoOffsetCm + d);
      refreshOffsUI();
    };

    const toggleAuto = ()=>{
      if (!this.getBottomDepth) {
        // нет поставщика глубины — лёгкий сигнал (подсветим рамку)
        chk.setStrokeStyle(2, 0xff5151, 0.9);
        this.s.time.delayedCall(240, ()=> chk.setStrokeStyle(2, 0xffffff, 0.16));
        return;
      }
      this.autoBottomOn = !this.autoBottomOn;
      if (this.autoBottomOn) this._ensureAutoTimer(); else this._stopAutoTimer();
      refreshOffsUI();
    };

    chk.on('pointerdown', toggleAuto);
    lbl.setInteractive({ useHandCursor:true }).on('pointerdown', toggleAuto);
    offsDec.on('pointerdown', ()=> changeOffset(-1));
    offsInc.on('pointerdown', ()=> changeOffset(+1));

    // горячие клавиши внутри модалки
    const keyDown = (ev)=>{
      if (!this.modalOpen) return;
      if (ev.key === 'ArrowUp')   { this._bump(-1 * (ev.shiftKey?5:(ev.ctrlKey||ev.metaKey?10:1))); }
      if (ev.key === 'ArrowDown') { this._bump(+1 * (ev.shiftKey?5:(ev.ctrlKey||ev.metaKey?10:1))); }
      if (ev.key === 'PageUp')    { this._bump(-10); }
      if (ev.key === 'PageDown')  { this._bump(+10); }
      if (ev.key === 'Home')      { this._applyCm(this.minCm); }
      if (ev.key === 'End')       { this._applyCm(this.maxCm); }
    };
    this._keyHandler = keyDown;
    this.s.input.keyboard?.on('keydown', keyDown);

    const closeAs = (apply)=> {
      if (!this.modalOpen) return;
      if (!apply) this._applyCm(this._beforeCm, true);
      this._closeModal(apply);
    };
    closeX.on('pointerdown', ()=> closeAs(true));
    ok.on('pointerdown',     ()=> closeAs(true));
    cancel.on('pointerdown', ()=> closeAs(false));

    // стартовое состояние интерактивности
    this._updateAutoInteractivity();

    return { ok, cancel, closeX };
  }

  _drawRigStatic(ACCENT){
    const g = this._rigG; g.clear();
    const { left, right, top, cx } = this._rigGeom;

    // линия воды
    g.lineStyle(2, 0xffffff, 0.15);
    g.beginPath(); g.moveTo(left, top); g.lineTo(right, top); g.strokePath();

    // антенка поплавка
    g.fillStyle(0xff3a3a, 1);
    g.fillRect(cx - 2, top - 18, 4, 16);

    // тело поплавка (треугольник)
    g.fillStyle(0xb6794a, 1);
    g.fillTriangle(cx, top - 2, cx - 7, top + 12, cx + 7, top + 12);

    // узел крепления
    g.fillStyle(0xeaeaea, 1);
    g.fillCircle(cx, top + 12, 2);
  }

  _numBadge(g, x, y, w, h, stroke=0xffc940){
    g.clear();
    if (g.fillRoundedRect) {
      g.fillStyle(0x0b0f16, 0.95);
      g.fillRoundedRect(x - w/2, y - h/2, w, h, 6);
      g.lineStyle(2, stroke, 0.9);
      g.strokeRoundedRect(x - w/2, y - h/2, w, h, 6);
    } else {
      g.fillStyle(0x0b0f16, 0.95);
      g.fillRect(x - w/2, y - h/2, w, h);
      g.lineStyle(2, stroke, 0.9);
      g.strokeRect(x - w/2, y - h/2, w, h);
    }
  }

  _updateStepBtns(){
    const atMin = this._valueCm <= this.minCm;
    const atMax = this._valueCm >= this.maxCm;

    if (this._decBtn) {
      this._decBtn.setAlpha(atMin ? 0.35 : 1);
      this._decBtn.disableInteractive();
      if (!atMin) this._decBtn.setInteractive({ useHandCursor:true });
    }
    if (this._incBtn) {
      this._incBtn.setAlpha(atMax ? 0.35 : 1);
      this._incBtn.disableInteractive();
      if (!atMax) this._incBtn.setInteractive({ useHandCursor:true });
    }
  }

  _lerpColor(c1, c2, t){
    const r1=(c1>>16)&255, g1=(c1>>8)&255, b1=c1&255;
    const r2=(c2>>16)&255, g2=(c2>>8)&255, b2=c2&255;
    const r=Math.round(r1+(r2-r1)*t), g=Math.round(g1+(g2-g1)*t), b=Math.round(b1+(b2-b1)*t);
    return (r<<16)|(g<<8)|b;
  }

  _fillVGrad(g, x, y, w, h, cTop, cBot, aTop=1, aBot=1, steps=40){
    const step = Math.max(1, Math.floor(h/steps));
    for (let i=0;i<h;i+=step){
      const t = Math.min(1, i/h);
      const c = this._lerpColor(cTop, cBot, t);
      const a = aTop + (aBot - aTop) * t;
      g.fillStyle(c, a); g.fillRect(x, y + i, w, Math.min(step, h - i));
    }
  }

  _drawWaterBg(){
    if (!this._waterG || !this._rigGeom) return;
    const g = this._waterG; g.clear();
    const { left, right, top, bottom } = this._rigGeom;
    const w = right - left, h = bottom - top;

    const C_TOP = 0x2a95d6, C_BOT = 0x0b1a2a;
    this._fillVGrad(g, left, top, w, h, C_TOP, C_BOT, 0.55, 0.88, 44);

    g.lineStyle(2, 0xa7d9ff, 0.18);
    g.strokeRect(left+0.5, top+0.5, w-1, h-1);

    this._fillVGrad(g, left+2, top+2, w-4, 12, 0xffffff, 0xffffff, 0.16, 0.0, 12);

    const phase = this._waterPhase || 0;
    for (let i=0;i<3;i++){
      const baseY = top + 20 + i*22;
      g.lineStyle(1, 0xffffff, 0.06);
      g.beginPath();
      for (let x = left + 8; x <= right - 8; x += 8){
        const t = (x-left)/42 + phase + i*0.6;
        const y = baseY + Math.sin(t) * 3;
        (x === left + 8) ? g.moveTo(x, y) : g.lineTo(x, y);
      }
      g.strokePath();
    }
  }

  _updateRigVisual(){
    const gLine = this._rigLineG;
    const gHook = this._rigHookG;
    const gBr   = this._rigBracketG;
    const { cx, top, bottom, right } = this._rigGeom;

    gLine.clear(); gHook.clear(); gBr.clear();

    const minY = Math.round(top + 12);
    const maxY = Math.round(bottom - 6);
    const frac  = (this.value - this.minM) / (this.maxM - this.minM);
    const hookY = Math.round(Phaser.Math.Linear(minY, maxY, Phaser.Math.Clamp(frac, 0, 1)));

    // леска
    gLine.lineStyle(2, 0xd7e5ff, 0.9);
    gLine.beginPath(); gLine.moveTo(Math.round(cx)+0.5, minY+0.5); gLine.lineTo(Math.round(cx)+0.5, hookY+0.5); gLine.strokePath();

    // крючок (J)
    gHook.lineStyle(3, 0x0f1116, 1);
    gHook.beginPath();
    const r = 9;
    gHook.moveTo(cx, hookY);
    gHook.lineTo(cx, hookY + r);
    gHook.arc(cx + r/2, hookY + r, r/1.25, Math.PI, Math.PI * 1.85, false);
    gHook.strokePath();

    // скоба-стрелки
    const midX = Math.min(cx + 28, right - 86);
    gBr.lineStyle(2, 0x222a36, 1);
    gBr.beginPath(); gBr.moveTo(midX+0.5, minY); gBr.lineTo(midX+0.5, hookY); gBr.strokePath();
    const drawArrow = (x, y, dir)=> {
      const s = 6 * (dir < 0 ? -1 : 1);
      gBr.beginPath(); gBr.moveTo(x - 5, y - s); gBr.lineTo(x, y); gBr.lineTo(x + 5, y - s); gBr.strokePath();
    };
    drawArrow(midX, minY, +1);
    drawArrow(midX, hookY, -1);

    // бейдж «см»
    const by  = Math.round(Phaser.Math.Linear(minY, hookY, 0.5));
    const txt = this._cmLabel();
    this._num.setText(txt);
    const txtW = (this._num?.width ?? txt.length * 9);
    const w = Math.max(64, Math.round(txtW + 18));
    const h = 26;
    const bx = Math.round(right - 14 - w/2);
    this._numBadge(this._numBadgeG, bx, by, w, h, this.badgeStroke);
    this._num.setPosition(bx, by);
  }

  _openModal(){
    if (this.modalOpen) return;
    this.modalOpen = true;
    this._applyRequested = false;
    this._beforeCm = this._valueCm;

    this._hadUiLock = ('uiLock' in this.s) ? this.s.uiLock : undefined;
    if ('uiLock' in this.s) this.s.uiLock = true;

    const W = this.s.scale.width, H = this.s.scale.height;
    const cx = Math.round(W/2), cy = Math.round(H/2);

    // компактная панель
    const PW = Math.max(240, Math.min(300, Math.floor(W * 0.50)));
    const PH = Math.max(320, Math.min(380, Math.floor(H * 0.58)));

    if (this.useHost && this.s.modals) {
      const hostRoot = this.s.add.container(0,0);
      this._hostRef = hostRoot;

      hostRoot.once('destroy', () => {
        if (!this._applyRequested) this._applyCm(this._beforeCm, true);
        this._finalizeClose();
      });

      if (this.s.modals.root) this.s.modals.root.add(hostRoot);
      if (typeof this.s.modals.open === 'function') this.s.modals.open(()=>{}, 1);

      this._buildUI(hostRoot, { W, H, cx, cy, PW, PH, withOverlay:false });

      // ESC = отмена
      this.s.input.keyboard?.once('keydown-ESC', ()=> {
        if (!this.modalOpen) return;
        this._applyCm(this._beforeCm, true);
        if (hostRoot && !hostRoot.destroyed) hostRoot.destroy(true);
      });
      return;
    }

    // автономка
    this._modal = this.s.add.container(0, 0).setDepth(1400);
    this._buildUI(this._modal, { W, H, cx, cy, PW, PH, withOverlay:true });

    // ESC = отмена
    this.s.input.keyboard?.once('keydown-ESC', ()=> {
      if (!this.modalOpen) return;
      this._applyCm(this._beforeCm, true);
      this._closeModal(false);
    });
  }

  _finalizeClose() {
    this.modalOpen = false;

    if (this._hadUiLock !== undefined) this.s.uiLock = this._hadUiLock;
    this.btnLbl?.setText(this._label());
    if (this._applyRequested) this.onChange?.(this.value);

    if (this._wheelHandler) {
      this.s.input.off('wheel', this._wheelHandler);
      this._wheelHandler = null;
    }
    if (this._stepperStop) {
      this.s.input.off('pointerup', this._stepperStop);
      this._stepperStop = null;
    }
    if (this._keyHandler){
      this.s.input.keyboard?.off('keydown', this._keyHandler);
      this._keyHandler = null;
    }
    this._repeatEv?.remove(false);
    this._repeatEv = null;

    this._waterTimer?.remove(false);
    this._waterTimer = null;

    this._modal = null;
    this._hostRef = null;
    this._handle = null; this._prog = null; this._num = null;
    this._numBadgeG = null; this._toY = null;
    this._rigRoot = null; this._rigG = null; this._rigLineG = null;
    this._rigHookG = null; this._rigBracketG = null; this._rigGeom = null;
    this._waterG = null;
    this._incBtn = null; this._decBtn = null;
  }

  _closeModal(apply=false, force=false){
    if (!this.modalOpen && !force) return;
    this._applyRequested = !!apply;

    if (this._hostRef) {
      if (!this._hostRef.destroyed) this._hostRef.destroy(true);
      return;
    }
    if (this._modal && !this._modal.destroyed) this._modal.destroy(true);
    this._finalizeClose();
  }

  // ====== АВТОПОСТРОЙКА ПОД ДНО ======
  _ensureAutoTimer(){
    if (!this.getBottomDepth) return;
    if (this._autoTimer) return;
    // обновляем аккуратно, не чаще 8Гц
    this._autoTimer = this.s.time.addEvent({
      delay: 125, loop: true,
      callback: () => {
        const d = this.getBottomDepth?.();
        if (typeof d !== 'number' || !isFinite(d)) return;
        const targetM = Math.max(this.minM, Math.min(this.maxM, d - this.autoOffsetCm/this._prec));
        this.setValue(targetM, /*silent*/false);
      }
    });
  }
  _stopAutoTimer(){
    this._autoTimer?.remove(false);
    this._autoTimer = null;
  }
  _updateAutoInteractivity(){
    const auto = this.autoBottomOn;
    // при авто — блокируем прямые драги, но остаётся колесо/клавиши для изменения offset/мелких правок вручную
    if (this._handle) {
      this._handle.disableInteractive();
      if (!auto) this._handle.setInteractive({ draggable:true, useHandCursor:true });
    }
  }
}

export default DepthCtrl;
