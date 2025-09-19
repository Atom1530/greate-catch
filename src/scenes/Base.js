// src/scenes/Base.js
import MarketModal from '../ui/MarketModal.js';
import ShopModal from '../ui/ShopModal.js';
import { VM as vm } from '../vm.js';
import { onWalletChange } from '../quests/QuestHooks.js';
import { WalletBadge } from '../ui/WalletBadge.js';

export class Base extends Phaser.Scene {
  constructor(){ super('Base'); }

  preload(){
    // фон
    if (!this.textures.exists('base_bg')) {
      this.load.image('base_bg', 'src/assets/ui/base_bg.png');
    }
    // опциональный арт рыбака
    if (!this.textures.exists('fisherman')) {
      this.load.image('fisherman', 'src/assets/ui/fisherman.png');
    }
  }

  create(){
    // ===== VM =====
    const d = vm?.defaults?.() ?? { wallet:{coins:0,gold:0}, keepnet:[], keepnetCap:25 };
    this.state      = vm?.get?.('state')      ?? {};
    this.wallet     = vm?.get?.('wallet')     ?? d.wallet;
    this.keepnet    = vm?.get?.('keepnet')    ?? d.keepnet;
    this.keepnetCap = vm?.get?.('keepnetCap') ?? d.keepnetCap;
    this.inventory  = vm?.get?.('inventory')  ?? {
      rods:['rod_wood_1'], reels:['reel_rusty'], lines:['line_old_1'], hooks:['hook_rusty'],
      bait:{ worm:25 }
    };
    this.playerLevel = vm?.get?.('level') ?? 1;

    // ===== ФОН (статичный) =====
    const W = this.scale.width, H = this.scale.height;
    const bgKey = this.textures.exists('base_bg') ? 'base_bg' : this._mkFallbackTexture(W,H);
    this.bg = this.add.image(W/2, H/2, bgKey).setOrigin(0.5).setDepth(-300);
    this._fitCover(this.bg);

    // легкая виньетка — статично
    this.vignette = this.add.rectangle(W/2, H/2, W, H, 0x0a1020, 0.55)
      .setDepth(-290).setScrollFactor(0);

    // ===== Сканлайны (статичные) =====
    this._scanKey = null;
    this._drawScanlines();

    // ===== Центр: «кибер-рамка» + сетка + арт =====
    this.center = this.add.container(0,0).setDepth(-200);

    // рамка и «стекло»
    this.midGlow  = this.add.rectangle(0,0, 100,100, 0x2bf0ff, 0.06)
      .setBlendMode(Phaser.BlendModes.SCREEN);
    this.midPanel = this.add.rectangle(0,0, 100,100, 0x0b1024, 0.2)
      .setStrokeStyle(2, 0x2bf0ff, 0.22);
    this.center.add([this.midGlow, this.midPanel]);

    // статичная голографическая сетка
    this._gridKey = null;
    this.gridImg = this.add.image(0,0, '').setOrigin(0.5).setDepth(-199);
    this.center.add(this.gridImg);

    // арт рыбака (если нет — силуэт)
    if (this.textures.exists('fisherman')) {
      this.fisher = this.add.image(0,0,'fisherman').setOrigin(0.5).setDepth(-198);
    } else {
      const g = this.add.graphics().setDepth(-198);
      g.fillStyle(0xffffff, 0.08);
      g.fillEllipse(0, 38, 220, 60);
      g.lineStyle(3, 0x2bf0ff, 0.35);
      g.strokeCircle(0, -70, 36);
      g.strokeRoundedRect(-48, -32, 96, 140, 12);
      g.lineStyle(4, 0x2bf0ff, 0.28).beginPath();
      g.moveTo(10, -10); g.lineTo(150, -6); g.strokePath();
      this.fisher = g; // для layout() это тоже «дисплей-объект»
    }
    this.center.add(this.fisher);

    // ===== Шапка / кнопки =====
    this.add.text(16, 10, 'База', {
      fontFamily:'Arial, sans-serif', fontSize:'28px', color:'#dff6ff'
    }).setDepth(940).setOrigin(0,0);

    this.walletBadge = new WalletBadge(this, this.wallet, { x: 340, y: 36 });
    this.updateWallet();

    // Назад к воде (без садка)
    this._makeBackButton();

    // Меню-колонки
    this.leftMenu  = this.add.container(0,0).setDepth(950);
    this.rightMenu = this.add.container(0,0).setDepth(950);

    const L = [
      this._mkNeoBtn('🧺  Продать рибу', () => this.openMarket(), { hotkey:'M' }),
      this._mkNeoBtn('🛒  Магазин',      () => this.openShop(),   { hotkey:'S' }),
      this._mkNeoBtn('🛠️  Перки / Улучшения', () => this.showWIP('upgrades')),
    ];
    L.forEach(b => this.leftMenu.add(b));

    const R = [
      this._mkNeoBtn('🏆  Досягнення',        () => this.showWIP('achievements')),
      this._mkNeoBtn('📜  Журнал / Квести',   () => this.showWIP('journal')),
      this._mkNeoBtn('🎒  Інвентар',          () => this.showWIP('bag')),
      this._mkNeoBtn('👤  Профіль',           () => this.showWIP('profile')),
      this._mkNeoBtn('✉️  Пошта',             () => this.showWIP('mail')),
      this._mkNeoBtn('⚙️  Налаштування',      () => this.showWIP('settings')),
    ];
    R.forEach(b => this.rightMenu.add(b));

    // подсказка
    this.hint = this.add.text(W/2, H-10,
      'Кібербаза: торгівля, магазин, досягнення, інвентар та інше.',
      { fontFamily:'Arial, sans-serif', fontSize:'14px', color:'#8fd4ff' }
    ).setOrigin(0.5,1).setDepth(930);

    // ESC
    this.input.keyboard?.on('keydown-ESC', () => { this.commitToVM(); this.scene.start('Start'); });

    // Респонсив
    this._onResize = () => this.layout();
    this.scale.on('resize', this._onResize);
    this.layout();

    // очистка
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
  ['__scanlines__', '__center_grid__', '__base_fallback__'].forEach(k=>{
    if (this.textures.exists(k)) this.textures.remove(k);
  });
});

  }

  // ===== Неон-кнопка (без анимаций, только hover) =====
  _mkNeoBtn(label, onClick, {hotkey=null}={}){
    const w = 320, h = 64;
    const c = this.add.container(0,0);

    const base = this.add.rectangle(0,0,w,h, 0x141a2c, 0.85)
      .setStrokeStyle(2, 0x2bf0ff, 0.28).setOrigin(0.5);
    const glow = this.add.rectangle(0,0,w+8,h+8, 0x2bf0ff, 0.06)
      .setOrigin(0.5).setBlendMode(Phaser.BlendModes.ADD);
    const txt  = this.add.text(0,0,label, {
      fontFamily:'Arial, sans-serif', fontSize:'20px', color:'#e9fbff'
    }).setOrigin(0.5);

    c.add([glow, base, txt]);

    base.setInteractive({ useHandCursor:true })
      .on('pointerover', ()=> { base.setFillStyle(0x182238, 0.95); glow.setAlpha(0.10); })
      .on('pointerout',  ()=> { base.setFillStyle(0x141a2c, 0.85); glow.setAlpha(0.06); })
      .on('pointerdown', onClick);

    if (hotkey){
      this.input.keyboard?.on(`keydown-${hotkey.toUpperCase()}`, (e)=>{ e.preventDefault(); onClick(); });
      const hk = this.add.text(w/2 - 10, h/2 - 18, hotkey.toUpperCase(), {
        fontFamily:'Arial, sans-serif', fontSize:'12px', color:'#7fdcff'
      }).setOrigin(1,1);
      c.add(hk);
    }
    return c;
  }

  // ===== Назад =====
  _makeBackButton(){
    const W = this.scale.width; const bx = W - 160, by = 36, bw = 200, bh = 44;
    this._backBtn = this.add.rectangle(bx, by, bw, bh, 0x162238, 0.95)
      .setStrokeStyle(2, 0x2bf0ff, 0.25).setDepth(953)
      .setInteractive({ useHandCursor:true })
      .on('pointerover', ()=> this._backBtn.setFillStyle(0x1b2946,0.98))
      .on('pointerout',  ()=> this._backBtn.setFillStyle(0x162238,0.95))
      .on('pointerdown', ()=>{ this.commitToVM(); this.scene.start('Start'); });

    this._backLbl = this.add.text(bx, by, '← До водоймища', {
      fontFamily:'Arial, sans-serif', fontSize:'18px', color:'#e9fbff'
    }).setOrigin(0.5).setDepth(954);
  }

  // ===== Layout / Resize-safe =====
  layout(){
    const W = this.scale.width, H = this.scale.height;
    this._fitCover(this.bg);
    this.vignette.setSize(W, H).setPosition(W/2, H/2);

    // центральная область
    const midW = Math.min(860, Math.floor(W*0.72));
    const midH = Math.min(480, Math.floor(H*0.56));
    const cx = Math.floor(W/2), cy = Math.floor(H*0.52);

    this.center.setPosition(cx, cy);
    this.midPanel.setSize(midW, midH);
    this.midGlow.setSize(midW+18, midH+18);

    // сетка перерисовывается под новый размер
    this._drawGrid(midW, midH);
    this.gridImg.setPosition(0,0);

    // арт рыбака (contain)
    if (this.fisher?.texture) {
      const maxW = midW * 0.9, maxH = midH * 0.9;
      const img = this.fisher;
      const tx = this.textures.get(img.texture.key).getSourceImage();
      const k = Math.min(maxW / tx.width, maxH / tx.height);
      img.setScale(k).setPosition(0,0);
    } else {
      // это Graphics — просто центрируем
      this.fisher.setPosition(0,0);
    }

    // меню-колонки
    const padX = 42, baseY = Math.max(110, Math.floor(H*0.24)), gapY = 14, itemH = 64;
    let y = baseY;
    (this.leftMenu.list||[]).forEach(n => { n.setPosition(padX + 160, y); y += itemH + gapY; });

    y = baseY;
    const rx = W - (padX + 160);
    (this.rightMenu.list||[]).forEach(n => { n.setPosition(rx, y); y += itemH + gapY; });

    // back
    const bx = W - 160, by = 36;
    this._backBtn?.setPosition(bx, by);
    this._backLbl?.setPosition(bx, by);

    // подсказка
    this.hint?.setPosition(W/2, H-10);

    // сканлайны под новый размер
    this._drawScanlines();
  }

  // ===== Actions =====
  updateWallet(){ this.walletBadge?.set(this.wallet.coins|0, this.wallet.gold|0); }

  openMarket(){
    new MarketModal(
      this,
      this.keepnet,
      this.wallet,
      ()=>{ this.updateWallet(); this.commitToVM(); onWalletChange(this.wallet); },
      ()=>{ this.updateWallet(); this.commitToVM(); onWalletChange(this.wallet); }
    );
  }

  openShop(){
    new ShopModal(
      this,
      this.wallet,
      this.inventory,
      this.playerLevel,
      ()=>{ this.updateWallet(); this.commitToVM(); },
      ()=>{ this.updateWallet(); this.commitToVM(); }
    );
  }

  showWIP(kind){
    const map = {
      achievements:'Скоро: перегляд досягнень',
      mail:'Скоро: поштова скринька',
      journal:'Скоро: журнал/квести',
      bag:'Скоро: інвентар та спорядження',
      profile:'Скоро: профіль гравця',
      settings:'Скоро: налаштування',
      upgrades:'Скоро: перки / апгрейди'
    };
    this.showToast(map[kind] || 'WIP');
  }

  showToast(text){
    const W = this.scale.width, H = this.scale.height;
    if (this._toast) this._toast.destroy();
    const t = this.add.text(W/2, H-18, text, {
      fontFamily:'Arial, sans-serif', fontSize:'16px', color:'#e9fbff'
    }).setOrigin(0.5,1).setDepth(9999);
    this._toast = t;
    this.tweens.add({ targets:t, alpha:0, duration:1400, delay:900, onComplete:()=>t.destroy() });
  }

  // ===== helpers =====
  _fitCover(img){
    if (!img) return;
    const W=this.scale.width, H=this.scale.height;
    const k = Math.max(W / img.width, H / img.height);
    img.setScale(k).setPosition(W/2, H/2);
  }
  _mkFallbackTexture(W,H){
    const key='__base_fallback__'; if (this.textures.exists(key)) this.textures.remove(key);
    const t = this.textures.createCanvas(key, W, H), ctx = t.getContext();
    const g = ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0.0,'#0b0f1c'); g.addColorStop(0.55,'#101a33'); g.addColorStop(1.0,'#0b1428');
    ctx.fillStyle=g; ctx.fillRect(0,0,W,H); t.refresh(); return key;
  }

_drawScanlines(){
  const W = this.scale.width, H = this.scale.height;
  const key = '__scanlines__';

  if (this.textures.exists(key)) this.textures.remove(key);

  const canvas = this.textures.createCanvas(key, Math.max(2, W|0), Math.max(2, H|0));
  const ctx = canvas.getContext();
  ctx.fillStyle = 'rgba(255,255,255,0.035)';
  for (let y=0; y<H; y+=3) ctx.fillRect(0,y,W,1);
  canvas.refresh();

  const needsNewImg = !this.scanImg || !this.scanImg.scene || this.scanImg.destroyed;
  if (needsNewImg) {
    this.scanImg = this.add.image(0,0,key).setOrigin(0).setDepth(-285).setAlpha(0.40);
  } else {
    this.scanImg.setTexture(key);
  }
  this.scanImg.setDisplaySize(W, H);
}



_drawGrid(w,h){
  const key='__center_grid__';
  if (this.textures.exists(key)) this.textures.remove(key);

  const c = this.textures.createCanvas(key, Math.max(2,w|0), Math.max(2,h|0));
  const ctx = c.getContext();
    ctx.clearRect(0,0,w,h);
    ctx.strokeStyle = 'rgba(43,240,255,0.12)';
    ctx.lineWidth = 1;

    const step = Math.max(16, Math.round(w/24));
    // вертикали
    for (let x=step; x<w; x+=step) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    // горизонтали
    for (let y=step; y<h; y+=step) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
  c.refresh();

  const dead = !this.gridImg || !this.gridImg.scene || this.gridImg.destroyed;
  if (dead) this.gridImg = this.add.image(0,0,key).setOrigin(0.5).setDepth(-199);
  else this.gridImg.setTexture(key);

  this.gridImg.setDisplaySize(w,h).setPosition(0,0);
  }

  commitToVM(){
    vm.set?.('wallet', this.wallet);
    vm.set?.('keepnet', this.keepnet);
    vm.set?.('keepnetCap', this.keepnetCap);
    vm.set?.('inventory', this.inventory);
    vm.set?.('level', this.playerLevel);
  }
}

export default Base;
