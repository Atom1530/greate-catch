// src/ui/DepthCtrl.js
export class DepthCtrl {
  constructor(scene, initValueM = 1.2, pos = { x: 64, y: 64 }, onChange = ()=>{}, opts = {}) {
    this.s = scene;

    // --- единицы: работаем внутри в сантиметрах (целое), наружу отдаём метры ---
    this._prec = 100;                   // 1 м = 100 "тик" (см)
    this.minM = opts.min ?? 0.20;
    this.maxM = opts.max ?? 8.00;
    this.stepM = opts.step ?? 0.01;     // шаг СЛАЙДЕРА в метрах (по умолчанию 1см)

    this.minCm  = Math.round(this.minM  * this._prec);
    this.maxCm  = Math.round(this.maxM  * this._prec);
    this.stepCm = Math.max(1, Math.round(this.stepM * this._prec)); // ≥1см гарантированно

    this._valueCm = Phaser.Math.Clamp(Math.round(initValueM * this._prec), this.minCm, this.maxCm);
    this.value    = this._valueCm / this._prec;     // публичное поле (метры)
    this.onChange = onChange;

    this.modalOpen = false;
    this._modal = null;
    this._hostRef = null;
    this._applyRequested = false;
    this.useHost = !!opts.useHost;

    // -------- Лончер-кнопка (отдельно от локатора) --------
    this.c = scene.add.container(pos.x, pos.y).setDepth(980);
    const bw = 132, bh = 28;

    this.btn = scene.add.rectangle(0, 0, bw, bh, 0x2b334a, 1)
      .setStrokeStyle(2, 0xffffff, 0.18).setInteractive({ useHandCursor: true });
    this.btnLbl = scene.add.text(0, 0, this._label(), {
      fontFamily:'Arial, sans-serif', fontSize:'13px', color:'#ffffff'
    }).setOrigin(0.5);
    this.c.add([this.btn, this.btnLbl]);

    this.btn.on('pointerover', ()=> this.btn.setFillStyle(0x323c58,1));
    this.btn.on('pointerout',  ()=> this.btn.setFillStyle(0x2b334a,1));
    this.btn.on('pointerdown', ()=> this._openModal());
  }

  // ====== helpers ======
  _label(){ return `Глубина: ${this.value.toFixed(2)}м`; }

  _applyCm(newCm, silent=false){
    const clamped = Phaser.Math.Clamp(Math.round(newCm), this.minCm, this.maxCm);
    this._valueCm = clamped;
    this.value = clamped / this._prec;
    this.btnLbl?.setText(this._label());
    if (!silent) this.onChange?.(this.value);

    // если открыт модал — синхронизировать ручку/прогресс
    if (this._handle && this._prog && this._toX) {
      const nx = this._toX(this.value);
      this._handle.x = nx;
      this._prog.width = Math.max(2, nx - this._x0);
      this._num?.setText(this._label());
    }
  }

  _bump(deltaCm, silent=false){ this._applyCm(this._valueCm + deltaCm, silent); }

  setPosition(x, y){ this.c?.setPosition(x, y); }

  // публичный API «установить в метрах» (с сохранением обратной совместимости)
  setValue(vMeters, silent=false){
    const rawCm = Math.round(Phaser.Math.Clamp(vMeters, this.minM, this.maxM) * this._prec);
    // снап по шагу слайдера (в см)
    const snappedCm = Math.round(rawCm / this.stepCm) * this.stepCm;
    this._applyCm(snappedCm, silent);
  }

  destroy(){
    this._closeModal(false, /*force*/true);
    this.c?.destroy();
  }

  // =================== MODAL ===================
  _buildUI(root, { W, H, cx, cy, PW, PH, withOverlay }) {
    if (withOverlay) {
      const ovr = this.s.add.rectangle(0, 0, W, H, 0x000000, 0.5)
        .setOrigin(0,0).setScrollFactor(0).setInteractive();
      root.add(ovr);
    }

    const shadow = this.s.add.rectangle(cx+2, cy+3, PW, PH, 0x000000, 0.22);
    const panel  = this.s.add.rectangle(cx, cy, PW, PH, 0x1f2433, 1)
      .setStrokeStyle(2, 0xffffff, 0.22);
    root.add([shadow, panel]);

    const title = this.s.add.text(cx, cy - PH/2 + 16, 'Настройка глубины оснастки', {
      fontFamily:'Arial, sans-serif', fontSize:'20px', color:'#ffffff'
    }).setOrigin(0.5,0);
    const closeX = this.s.add.text(cx + PW/2 - 22, cy - PH/2 + 6, '✕', {
      fontFamily:'Arial, sans-serif', fontSize:'20px', color:'#ffffff'
    }).setOrigin(0.5,0).setInteractive({ useHandCursor:true });
    root.add([title, closeX]);

    // readout
    this._num = this.s.add.text(cx, title.y + 36, this._label(), {
      fontFamily:'Arial, sans-serif', fontSize:'16px', color:'#cfd8ff'
    }).setOrigin(0.5,0);
    root.add(this._num);

    // slider
    const trackW = Math.min(360, PW - 80);
    const trackY = cy + 16;
    const x0 = cx - trackW/2, x1 = cx + trackW/2;
    this._x0 = x0; this._x1 = x1;

    const track = this.s.add.rectangle(cx, trackY, trackW, 6, 0x3a4760, 1)
      .setStrokeStyle(1, 0xffffff, 0.15).setInteractive();
    root.add(track);

    // u ↔ метры
    const toX = (vMeters)=> x0 + ((vMeters - this.minM)/(this.maxM - this.minM)) * trackW;
    this._toX = toX;

    this._prog = this.s.add.rectangle(x0, trackY, Math.max(2, toX(this.value) - x0), 6, 0x5aa6ff, 1)
      .setOrigin(0,0.5);
    root.add(this._prog);

    // тики (каждые 0.5м) + подписи на целых метрах
    const ticksG = this.s.add.graphics();
    ticksG.lineStyle(1, 0xffffff, 0.18);
    const stepTick = 0.5;
    for (let v = this.minM; v <= this.maxM + 1e-6; v += stepTick){
      const tx = toX(v);
      ticksG.beginPath();
      ticksG.moveTo(tx, trackY - 5);
      ticksG.lineTo(tx, trackY + 5);
      ticksG.strokePath();

      if (Math.abs(v - Math.round(v)) < 1e-6){
        const t = this.s.add.text(tx, trackY + 12, `${Math.round(v)}м`, {
          fontFamily:'Arial, sans-serif', fontSize:'12px', color:'#9fb1db'
        }).setOrigin(0.5,0);
        root.add(t);
      }
    }
    root.add(ticksG);

    // handle
    this._handle = this.s.add.circle(toX(this.value), trackY, 10, 0xeaeaea, 1)
      .setStrokeStyle(2, 0x0f1116, 0.6).setInteractive({ draggable:true, useHandCursor:true });
    root.add(this._handle);

    const dragTo = (px)=>{
      const nx = Phaser.Math.Clamp(px, x0, x1);
      this._handle.x = nx;
      // обратное преобразование X -> метры -> см со снапом по stepCm
      const frac = (nx - x0) / trackW;
      const rawM = this.minM + frac * (this.maxM - this.minM);
      const rawCm = Math.round(rawM * this._prec);
      const vCm = Math.round(rawCm / this.stepCm) * this.stepCm;
      this._applyCm(vCm, false);
      this._prog.width = Math.max(2, nx - x0);
    };
    this.s.input.setDraggable(this._handle, true);
    this._handle.on('drag', (_p, dragX)=> dragTo(dragX));
    track.on('pointerdown', (p)=> dragTo(p.worldX));

    // +/- buttons (±1см, Shift=±5см, Ctrl/Meta=±10см)
    const makeBtn = (x, txt, dir) => {
      const r = this.s.add.rectangle(x, trackY + 40, 40, 28, 0x3b4662, 1)
        .setStrokeStyle(2, 0xffffff, 0.18).setInteractive({ useHandCursor:true });
      const l = this.s.add.text(x, trackY + 40, txt, {
        fontFamily:'Arial, sans-serif', fontSize:'18px', color:'#ffffff'
      }).setOrigin(0.5);
      r.on('pointerover', ()=> r.setFillStyle(0x435074,1));
      r.on('pointerout',  ()=> r.setFillStyle(0x3b4662,1));
      r.on('pointerdown', (pointer)=> {
        const ev = pointer?.event;
        const mult = ev?.ctrlKey || ev?.metaKey ? 10 : (ev?.shiftKey ? 5 : 1);
        this._bump(dir * mult);
      });

      // // (опционально) авто-повтор при удержании:
      // let rep = null;
      // r.on('pointerdown', (p)=> {
      //   const start = ()=> this._bump(dir * (p.event?.ctrlKey||p.event?.metaKey ? 10 : (p.event?.shiftKey?5:1)));
      //   start();
      //   rep = this.s.time.addEvent({ delay: 110, loop: true, callback: start });
      // });
      // r.on('pointerup',   ()=> rep?.remove());
      // r.on('pointerout',  ()=> rep?.remove());

      root.add([r,l]);
      return r;
    };
    makeBtn(cx - 80, '−', -1);
    makeBtn(cx + 80, '+', +1);

    // OK / Cancel
    const ok = this.s.add.rectangle(cx - 60, cy + PH/2 - 24, 120, 34, 0x2e7d32, 1)
      .setStrokeStyle(2, 0xffffff, 0.18).setInteractive({ useHandCursor:true });
    const okLbl = this.s.add.text(ok.x, ok.y, 'Готово', {
      fontFamily:'Arial, sans-serif', fontSize:'16px', color:'#ffffff'
    }).setOrigin(0.5);

    const cancel = this.s.add.rectangle(cx + 60, cy + PH/2 - 24, 120, 34, 0x36425b, 1)
      .setStrokeStyle(2, 0xffffff, 0.18).setInteractive({ useHandCursor:true });
    const cancelLbl = this.s.add.text(cancel.x, cancel.y, 'Отмена', {
      fontFamily:'Arial, sans-serif', fontSize:'16px', color:'#ffffff'
    }).setOrigin(0.5);

    root.add([ok, okLbl, cancel, cancelLbl]);

    closeX.on('pointerdown', ()=> this._closeModal(true));
    ok.on('pointerdown',     ()=> this._closeModal(true));
    cancel.on('pointerdown', ()=> { this._applyCm(this._beforeCm, true); this._closeModal(false); });

    return { ok, cancel, closeX };
  }

  _openModal(){
    if (this.modalOpen) return;
    this.modalOpen = true;
    this._applyRequested = false;
    this._beforeCm = this._valueCm;

    // блокируем клики в игре, если есть флаг в сцене
    this._hadUiLock = ('uiLock' in this.s) ? this.s.uiLock : undefined;
    if ('uiLock' in this.s) this.s.uiLock = true;

    const W = this.s.scale.width, H = this.s.scale.height;
    const cx = Math.round(W/2), cy = Math.round(H/2);
    const PW = Math.min(520, W - 80), PH = 210;

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

    // автономный режим
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

    this._modal = null;
    this._hostRef = null;
    this._handle = null; this._prog = null; this._num = null;
    this._toX = null;
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
}

export default DepthCtrl;
