// src/scenes/Base.js
import MarketModal from '../ui/MarketModal.js';
import ShopModal from '../ui/ShopModal.js';
import { VM as vm } from '../vm.js';
import { onWalletChange } from '../quests/QuestHooks.js'; // у тебя экспорт по умолчанию тоже есть — импортуй как в проекте принято

import { WalletBadge } from '../ui/WalletBadge.js';


export class Base extends Phaser.Scene {
  constructor(){ super('Base'); }

  preload(){
    // Положи любой фон по этому пути или поменяй ключ/URL
    this.load.image('base_bg', 'assets/ui/base_bg.jpg');
  }

  create(data){
    // Берём из VM через get(), иначе — из data, иначе — из дефолтов
    const d = vm?.defaults?.() ?? { wallet:{coins:0,gold:0}, keepnet:[], keepnetCap:25 };

    this.state      = vm?.get?.('state',      data?.state)      ?? {};
    this.wallet     = vm?.get?.('wallet',     data?.wallet)     ?? d.wallet;
    this.keepnet    = vm?.get?.('keepnet',    data?.keepnet)    ?? d.keepnet;
    this.keepnetCap = vm?.get?.('keepnetCap', data?.keepnetCap) ?? d.keepnetCap;
     // инвентарь и уровень игрока для магазина
    this.inventory  = vm?.get?.('inventory') ?? {
      rods:  ['rod_wood_1'],
      reels: ['reel_rusty'],
      lines: ['line_old_1'],
      hooks: ['hook_rusty'],
      bait:  { worm: 25 }
  };
  this.playerLevel = vm?.get?.('level') ?? 1;

    const W = this.scale.width, H = this.scale.height;

    // ===== ФОН с cover-подгонкой =====
    this.bg = this.add.image(W/2, H/2, 'base_bg').setDepth(-100).setOrigin(0.5);
    this._fitCover(this.bg);
    // лёгкое затемнение, чтобы текст всегда читался (сохраняем ссылку и обновляем в layout)
    this.bgDim = this.add.rectangle(W/2, H/2, W, H, 0x0b1222, 0.42)
      .setDepth(-99).setScrollFactor(0);

    // ===== Шапка =====
    this.add.text(12, 10, 'База', {
      fontFamily:'Arial, sans-serif', fontSize:'26px', color:'#ffffff'
    }).setDepth(940).setOrigin(0,0);

    this.walletBadge = new WalletBadge(this, this.wallet, { x: 300, y: 36 });
    this.updateWallet();

    // «к водоёму» + компактный счётчик садка — вместо полноценного бейджа
    this._makeBackButton();

    // ===== Меню по центру =====
    this.menu = this.add.container(W/2, H/2).setDepth(950);
    const mkBtn = (label, onClick, {enabled=true, icon=null}={})=>{
      const w = 360, h = 56;
      const r = this.add.rectangle(0,0,w,h, enabled?0x2b334a:0x232838, 1)
        .setStrokeStyle(2, 0xffffff, enabled?0.18:0.10)
        .setOrigin(0.5).setDepth(951);
      if (enabled) {
        r.setInteractive({ useHandCursor:true })
         .on('pointerover', ()=> r.setFillStyle(0x323c58,1))
         .on('pointerout',  ()=> r.setFillStyle(0x2b334a,1))
         .on('pointerdown', onClick);
      } else {
        r.setAlpha(0.6);
      }
      const txt = this.add.text(0,0, `${icon?icon+' ':''}${label}`, {
        fontFamily:'Arial, sans-serif', fontSize:'20px', color:'#ffffff'
      }).setOrigin(0.5).setDepth(952);
      const c = this.add.container(0,0,[r,txt]);
      this.menu.add(c);
      return c;
    };

    const items = [
      mkBtn('Продать рыбу', ()=> this.openMarket(), { icon:'🧺' }),
      mkBtn('Магазин', ()=> this.openShop(), { enabled:true, icon:'🛒' }),
      mkBtn('Улучшения (WIP)', ()=>{}, { enabled:false, icon:'🛠️' }),
      mkBtn('Инвентарь (WIP)', ()=>{}, { enabled:false, icon:'🎒' }),
    ];
    const GAP = 16;
    items.forEach((c,i)=> c.setPosition(0, i*(56+GAP)));

    // подсказка внизу
    this.add.text(W/2, H-10,
      'На «Базе» недоступна рыбалка. Здесь — торговля, перки, магазин и пр.',
      { fontFamily:'Arial, sans-serif', fontSize:'14px', color:'#9fb1db' }
    ).setOrigin(0.5,1).setDepth(930);

    // Горячая клавиша «назад»
    this.input.keyboard?.on('keydown-ESC', () => {
      this.commitToVM();
      this.scene.start('Start');
    });

    // респонсив
    this.scale.on('resize', ()=> this.layout());
    this.layout();
  }

  // ===== Сохранение состояния в VM (метод класса!) =====
  commitToVM(){
    vm.set?.('wallet', this.wallet);
    vm.set?.('keepnet', this.keepnet);
    vm.set?.('keepnetCap', this.keepnetCap);
    vm.set?.('inventory', this.inventory);
    vm.set?.('level', this.playerLevel);
  }

  layout(){
    const W = this.scale.width, H = this.scale.height;
    this._fitCover(this.bg);
    this.menu.setPosition(W/2, Math.round(H*0.40));
    // оверлей подгоняем под новое окно
    this.bgDim.setPosition(W/2, H/2);
    this.bgDim.setSize(W, H);

    // обновим позицию back-кнопки
    const badge = this._backBadge;
    const bx = W - 150, by = 36;
    this._backBtn?.setPosition(bx, by);
    this._backLbl?.setPosition(bx, by);
    badge?.setPosition(bx + 140, by); // маленькая «пилюля» садка справа от кнопки
  }

  // ===== кнопка возврата и мини-счётчик садка =====
  _makeBackButton(){
    const W = this.scale.width;
    const bx = W - 150, by = 36;
    const bw = 170, bh = 40;

    this._backBtn = this.add.rectangle(bx, by, bw, bh, 0x36425b, 1)
      .setStrokeStyle(2, 0xffffff, 0.20).setDepth(953)
      .setInteractive({ useHandCursor:true })
      .on('pointerover', ()=> this._backBtn.setFillStyle(0x3c4a66,1))
      .on('pointerout',  ()=> this._backBtn.setFillStyle(0x36425b,1))
      .on('pointerdown', ()=> {
        this.commitToVM();
        this.scene.start('Start');
      });

    this._backLbl = this.add.text(bx, by, '← К водоёму', {
      fontFamily:'Arial, sans-serif', fontSize:'18px', color:'#ffffff'
    }).setOrigin(0.5).setDepth(954);

    // минималистичный счётчик садка (пилюля)
    const pillW = 86, pillH = 30;
    const r = this.add.rectangle(bx + 140, by, pillW, pillH, 0x2a3348, 1)
      .setOrigin(0.5).setStrokeStyle(2, 0xffffff, 0.12).setDepth(954);
    const t = this.add.text(r.x, r.y, '0/0', {
      fontFamily:'Arial, sans-serif', fontSize:'16px', color:'#eaf2ff'
    }).setOrigin(0.5).setDepth(955);
    this._backBadge = { r, t, setPosition:(x,y)=>{ r.setPosition(x,y); t.setPosition(x,y);} };
    this.refreshKeepnetPill();
  }

  refreshKeepnetPill(){
    if (!this._backBadge) return;
    this._backBadge.t.setText(`${this.keepnet.length}/${this.keepnetCap}`);
  }

  updateWallet(){
    this.walletBadge?.set(this.wallet.coins|0, this.wallet.gold|0);
  }

  openMarket(){
    // модалка поверх всего; после продажи — обновляем кошелёк и счётчик
    new MarketModal(
      this,
      this.keepnet,
      this.wallet,
      ()=>{ // onChange
        this.updateWallet();
        this.refreshKeepnetPill();
        this.commitToVM();
        onWalletChange(this.wallet); // QUEST HOOKS
      },
      ()=>{ // onClose
        this.updateWallet();
        this.refreshKeepnetPill();
        this.commitToVM();
        onWalletChange(this.wallet); // на случай, если кошелёк изменился на закрытии
      }
    );
  }
   openShop(){
  new ShopModal(
    this,
    this.wallet,
    this.inventory,
    this.playerLevel,
    ()=>{ // onChange
      this.updateWallet();
      this.commitToVM();
    },
    ()=>{ // onClose
      this.updateWallet();
      this.commitToVM();
    }
  );
}


  _fitCover(img){
    const W = this.scale.width, H = this.scale.height;
    const k = Math.max(W / img.width, H / img.height);
    img.setScale(k).setPosition(W/2, H/2);
  }
}

export default Base;
