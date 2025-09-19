// src/scenes/LoadLoc.js
import { LocationMgr } from '../locations/LocationMgr.js';
import PhotoBank from '../assets/PhotoBank.js';
import VM from '../vm.js';
import Phaser from "phaser";
export class LoadLoc extends Phaser.Scene {
  constructor(){ super('LoadLoc'); }

  init(data){
    this.locId = data?.locId || 'lake';
    VM.set?.('locationId', this.locId);
  }

  preload(){
    let curW = this.scale.width, curH = this.scale.height;
    const cx = Math.floor(curW/2), cy = Math.floor(curH/2);

    // --- градиент под заданные размеры
    const makeGrad = (w, h) => {
      const key = '__load_grad__';
      if (this.textures.exists(key)) this.textures.remove(key);
      const t = this.textures.createCanvas(key, w, h);
      const ctx = t.getContext();
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0.00, '#0b0f1c');
      g.addColorStop(0.55, '#101a33');
      g.addColorStop(1.00, '#0b1428');
      ctx.fillStyle = g; ctx.fillRect(0,0,w,h); t.refresh();
      return key;
    };

    const bg = this.add.image(0,0,makeGrad(curW, curH)).setOrigin(0).setDepth(-10);
    const wave = this.add.graphics().setDepth(-9);

    const drawWave = (amp=8, y0=curH*0.18, step=8) => {
      wave.clear().fillStyle(0xffffff, 0.04);
      wave.beginPath();
      wave.moveTo(0, y0);
      for (let x=0; x<=curW; x+=step){
        const y = y0 + Math.sin((x/64)+this.time.now/650)*amp;
        wave.lineTo(x, y);
      }
      wave.lineTo(curW,0).lineTo(0,0).closePath().fillPath();
    };
    const waveTimer = this.time.addEvent({ delay: 70, loop: true, callback: () => drawWave() });

    // --- карточка прогресса
    const panelW = Math.min(520, curW - 80), panelH = 160;
    const shadow = this.add.rectangle(cx+4, cy+6, panelW, panelH, 0x000000, 0.35);
    const panel  = this.add.rectangle(cx, cy, panelW, panelH, 0x1a2030, 0.88).setStrokeStyle(2, 0xffffff, 0.16);
    const title  = this.add.text(cx, cy - panelH/2 + 16, `Завантаження: ${this.locId}`, {
      fontFamily:'Arial, sans-serif', fontSize:'20px', color:'#ffffff'
    }).setOrigin(0.5,0);

    const barW = panelW - 40, barH = 16;
    const barBg = this.add.rectangle(cx, cy, barW, barH, 0x121826, 1).setStrokeStyle(2, 0xffffff, 0.12);
    const barFg = this.add.rectangle(cx - barW/2, cy, 1, barH-4, 0x2b74ff, 1).setOrigin(0,0.5);
    const pctTxt = this.add.text(cx, cy + 24, '0%', { fontFamily:'Arial, sans-serif', fontSize:'16px', color:'#cfe' }).setOrigin(0.5,0);

    const fileTxt = this.add.text(cx, cy - 6, 'Готуємо файли…', { fontFamily:'Arial, sans-serif', fontSize:'13px', color:'#9ab' }).setOrigin(0.5,1);

    const tips = [
      'Порада: різна глибина — різна риба.',
      'Підсічка: Ctrl/⌘+Enter — швидко!',
      'Приманка важлива: спробуй іншу.',
      'Дощ і ніч змінюють активність.',
      'Садок не безкінечний: продавай улов.'
    ];
    let tipIdx = 0;
    const tipTxt = this.add.text(cx, cy + 48, tips[0], { fontFamily:'Arial, sans-serif', fontSize:'12px', color:'#8fb' }).setOrigin(0.5,0);
    const tipTimer = this.time.addEvent({ delay: 2400, loop: true, callback: () => { tipIdx = (tipIdx+1)%tips.length; tipTxt.setText(tips[tipIdx]); } });

    // отмена: без load.reset()
    const btnW = 120, btnH = 28;
    const cancelBtn = this.add.rectangle(cx, cy + panelH/2 - 18, btnW, btnH, 0x303a52, 1).setStrokeStyle(2, 0xffffff, 0.16).setInteractive({ useHandCursor: true });
    const cancelLbl = this.add.text(cancelBtn.x, cancelBtn.y, 'Скасувати', { fontFamily:'Arial, sans-serif', fontSize:'14px', color:'#fff' }).setOrigin(0.5);
    const cancel = () => { this.scene.start('Start', { locId: this.locId }); };
    cancelBtn.on('pointerover', ()=> cancelBtn.setFillStyle(0x3a4562,1));
    cancelBtn.on('pointerout',  ()=> cancelBtn.setFillStyle(0x303a52,1));
    cancelBtn.on('pointerdown', cancel);
    this.input.keyboard?.once('keydown-ESC', cancel);

    // === реальная загрузка ассетов выбранной локации
    LocationMgr.loadAssets(this, this.locId);
    PhotoBank.queueForScene(this, this.locId);

    // --- лоадер-листенеры (именованные, чтобы точно снять)
    const onProgress = (v) => {
      barFg.width = Math.max(1, Math.floor(barW * v));
      pctTxt.setText(Math.floor(v*100) + '%');
    };
    const onFile = (file) => {
      if (!file) return;
      const name = (file.key || file.src || '').toString();
      fileTxt.setText(`Файл: ${name.slice(-48)}`);
    };
    let hadError = false;
    const onError = (file) => {
      hadError = true;
      panel.setFillStyle(0x2a1b1b, 0.92);
      fileTxt.setColor('#f88').setText(`Помилка: ${file?.key || file?.src || 'невідомо'}`);
      pctTxt.setColor('#fcc');
      cancelLbl.setText('Повторити');
      cancelBtn.off('pointerdown', cancel).on('pointerdown', () => this.scene.restart({ locId: this.locId }));
    };
    const onComplete = () => { if (!hadError) this.scene.start('Start', { locId: this.locId }); };

    this.load.on('progress', onProgress);
    this.load.on('fileprogress', onFile);
    this.load.on('loaderror', onError);
    this.load.once('complete', onComplete);

    // --- респонсив
    const onResize = (gs) => {
      curW = gs.width; curH = gs.height;
      bg.setTexture(makeGrad(curW, curH)).setDisplaySize(curW, curH);
      drawWave(8, curH*0.18);
      const nx = Math.floor(curW/2), ny = Math.floor(curH/2);
      shadow.setPosition(nx+4, ny+6);
      panel.setPosition(nx, ny);
      title.setPosition(nx, ny - panelH/2 + 16);
      barBg.setPosition(nx, ny);
      barFg.setPosition(nx - barW/2, ny);
      pctTxt.setPosition(nx, ny + 24);
      fileTxt.setPosition(nx, ny - 6);
      tipTxt.setPosition(nx, ny + 48);
      cancelBtn.setPosition(nx, ny + panelH/2 - 18);
      cancelLbl.setPosition(nx, ny + panelH/2 - 18);
    };
    this.scale.on('resize', onResize);

    // --- чистка
    this.events.once('shutdown', ()=>{
      this.scale?.off('resize', onResize);
      waveTimer?.remove?.(); tipTimer?.remove?.();
      try {
        this.load.off('progress', onProgress);
        this.load.off('fileprogress', onFile);
        this.load.off('loaderror', onError);
      } catch {}
      bg?.destroy?.(); wave?.destroy?.();
      shadow?.destroy?.(); panel?.destroy?.(); title?.destroy?.();
      barBg?.destroy?.(); barFg?.destroy?.(); pctTxt?.destroy?.();
      fileTxt?.destroy?.(); tipTxt?.destroy?.();
      cancelBtn?.destroy?.(); cancelLbl?.destroy?.();
    });
  }

  create(){ /* переход делаем в complete */ }
}

export default LoadLoc;
