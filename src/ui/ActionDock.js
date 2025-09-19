// src/ui/ActionDock.js
import UI from './theme.js';
import  openMapModal from './MapModal.js';
import { LOCATIONS } from '../data/locations.js'; // чтобы собрать список и онлайн

export class ActionDock {
  /**
   * @param {Phaser.Scene} scene
   * @param {{
   *   onBase?: ()=>void,
   *   onLocationPick?: (locId:string)=>void,
   *   wallet?: {coins:number,gold:number,perks?:number},
   *   showPerks?: boolean
   * }} opts
   */
  constructor(scene, { onBase, onLocationPick, wallet, showPerks = true } = {}) {
    this.s = scene;
    this.onBase = onBase;
    this.onLocationPick = onLocationPick;
    this.showPerks = showPerks;

    // дизайн-токены
    this.padX = UI.rem(scene, 12);
    this.padY = UI.rem(scene, 6);
    this.gap  = UI.rem(scene, 10);
    this.radius = Math.max(10, Math.round(UI.rem(scene, 10)));
    this.bgColor = 0x2a3144;
    this.bgAlpha = 0.95;
    this.strokeColor = 0xffffff;
    this.strokeAlpha = 0.18;

    this.container = scene.add.container(0, 0).setDepth((UI.z.keepnet ?? 950) + 2);
    this.bg = scene.add.graphics();
    this.container.add(this.bg);

    // --- кнопки
    this.btnBase = this._makeTextBtn('🏠  База', () => this.onBase?.());
     this.btnExp  = this._makeTextBtn('🗺️  Экспедиция', () => {
   const curId = this.s.locationMgr?.getCurrentId?.() || this.s.locId || 'lake';
   const room  = this.s.room;

   const makeItems = () =>
     LOCATIONS.map(l => {
       const info = room?.getRoomInfo?.(l.id) || { occupants:0, capacity:100 };
       // тут можно воткнуть свою логику анлока
       const unlocked = true;
       return {
         id: l.id,
         title: l.title,
         locked: !unlocked,
         lockReason: unlocked ? '' : 'Откроется с 5 уровня',
         occupants: info.occupants|0,
         capacity:  info.capacity|0,
       };
     });

   const modal = openMapModal(this.s, {
     currentId: curId,
     items: makeItems(),
     onPick: async (locId) => {
       // просто пробрасываем наружу — там Start/TopHUD делает
       // переход сцены, загрузку ассетов и смену комнаты
       await this.onLocationPick?.(locId);
     }
   });

   // live-онлайн
   this._unsubMapInfo?.();
   this._unsubMapInfo = room?.client?.on?.('roomInfo', () => {
    modal.update(makeItems());
   });
 });

    // --- мини-кошелёк (компактные «чипы» без подписей)
    const w = wallet || { coins: 0, gold: 0, perks: 0 };
    this.chipCoins = this._makeChip(this._icCoin.bind(this));
    this.chipGold  = this._makeChip(this._icGold.bind(this));
    this.container.add([this.btnBase, this.btnExp, this.chipCoins, this.chipGold]);

    if (this.showPerks){
      this.chipPerks = this._makeChip(this._icPerk.bind(this));
      this.container.add(this.chipPerks);
    }

    // разделители
    this.divA = scene.add.rectangle(0, 0, 2, 22, 0xffffff, 0.16);
    this.divB = scene.add.rectangle(0, 0, 2, 22, 0xffffff, 0.16);
    this.container.add([this.divA, this.divB]);

    // значения
    this.setWallet(w.coins|0, w.gold|0, w.perks|0);

    this.layoutInternal();
  }

  // ——— публичное API
  setPosition(x, y){ this.container.setPosition(x, y); }
  setDepth(z){ this.container.setDepth(z); }
  getBounds(){ return new Phaser.Geom.Rectangle(this.container.x - this.w/2, this.container.y - this.h/2, this.w, this.h); }
  setWallet(coins, gold, perks=0){
    this._setChipValue(this.chipCoins, coins);
    this._setChipValue(this.chipGold,  gold);
    if (this.chipPerks) this._setChipValue(this.chipPerks, perks);
    this.layoutInternal();
  }

  // ——— вёрстка внутри пилюли
  layoutInternal(){
    // размеры элементов
    const bH = Math.max(this.btnBase.hit.height, this.btnExp.hit.height);
    const chipH = 28; // высота чипа
    const contentH = Math.max(bH, chipH);

    // ширины
    const wBase = this.btnBase.hit.width;
    const wExp  = this.btnExp.hit.width;
    const wChip = (chip) => chip.bg.width;
    const coinsW = wChip(this.chipCoins);
    const goldW  = wChip(this.chipGold);
    const perksW = this.chipPerks ? wChip(this.chipPerks) : 0;

    // общая ширина
    const chipGroupW = coinsW + this.gap + goldW + (this.chipPerks ? (this.gap + perksW) : 0);
    this.w = this.padX + wBase + this.gap + 2 + this.gap + wExp + this.gap + 2 + this.gap + chipGroupW + this.padX;
    this.h = this.padY*2 + contentH;

    // фон-пилюля
    this.bg.clear();
    this.bg.fillStyle(this.bgColor, this.bgAlpha);
    this.bg.lineStyle(2, this.strokeColor, this.strokeAlpha);
    this.bg.fillRoundedRect(-this.w/2, -this.h/2, this.w, this.h, this.radius);
    this.bg.strokeRoundedRect(-this.w/2, -this.h/2, this.w, this.h, this.radius);

    // позиции
    let x = -this.w/2 + this.padX;

    // База
    this.btnBase.setPosition(x + wBase/2, 0);
    x += wBase + this.gap;

    // разделитель A
    this.divA.setPosition(x + 1, 0);
    x += 2 + this.gap;

    // Экспедиция
    this.btnExp.setPosition(x + wExp/2, 0);
    x += wExp + this.gap;

    // разделитель B
    this.divB.setPosition(x + 1, 0);
    x += 2 + this.gap;

    // чипы
    const cy = 0;
    this._placeChip(this.chipCoins, x, cy); x += coinsW + this.gap;
    this._placeChip(this.chipGold,  x, cy); x += goldW  + (this.chipPerks ? this.gap : 0);
    if (this.chipPerks) this._placeChip(this.chipPerks, x, cy);
  }

  // ——— кнопка-текст
  _makeTextBtn(label, onClick){
    const g = this.s.add.container(0,0);

    const t = this.s.add.text(0,0, label, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '18px',
      color: '#ffffff'
    }).setOrigin(0.5);

    const hitW = t.width + UI.rem(this.s, 24);
    const hitH = Math.max(36, t.height + UI.rem(this.s, 8));
    const hit = this.s.add.rectangle(0, 0, hitW, hitH, 0x000000, 0)
      .setInteractive({ useHandCursor: true });

    hit.on('pointerover', ()=> t.setAlpha(0.9));
    hit.on('pointerout',  ()=> t.setAlpha(1));
    hit.on('pointerdown', ()=> onClick?.());

    g.t = t; g.hit = hit;
    g.add([t, hit]);
    return g;
  }

  // ——— компактный «чип» валюты
  _makeChip(drawIcon){
    const c = this.s.add.container(0,0);
    const w = 76; const h = 28;
    const bg = this.s.add.rectangle(0,0,w,h,0x1e2636,1)
      .setOrigin(0.5)
      .setStrokeStyle(2, 0xffffff, 0.12);
    const ic = this.s.add.graphics({ x: -w/2 + 10, y: 0 });
    drawIcon(ic, 0, 0);

    const val = this.s.add.text(ic.x + 16, 0, '0', {
      fontFamily:'Arial, sans-serif', fontSize:'16px', color:'#eaf2ff'
    }).setOrigin(0,0.5);

    c.bg = bg; c.val = val;
    c.add([bg, ic, val]);
    return c;
  }
  _placeChip(chip, leftX, cy){
    chip.setPosition(leftX + chip.bg.width/2, cy);
  }
  _setChipValue(chip, v){
    const txt = String(v|0);
    chip.val.setText(txt);
    // динамически расширяем, если число широкое
    const minW = 64;
    const needW = Math.max(minW, chip.val.width + 28);
    chip.bg.width = needW;
    chip.bg.setSize(needW, chip.bg.height);
  }

  // ——— иконки
  _icCoin(g,x,y){ g.fillStyle(0xf6d463,1).fillCircle(x,y,7); g.fillStyle(0xffffff,0.6).fillCircle(x-2.5,y-2.5,2); g.lineStyle(2,0xffffff,0.18).strokeCircle(x,y,7); }
  _icGold(g,x,y){
    const R1=7,R2=3.2,pts=[]; for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?R2:R1;pts.push({x:x+Math.cos(a)*r,y:y+Math.sin(a)*r});}
    g.fillStyle(0xffe47a,1).fillPoints(pts,true); g.lineStyle(2,0xffffff,0.18).strokePoints(pts,true);
  }
  _icPerk(g,x,y){ g.lineStyle(2,0xb9d7ff,1); g.strokeCircle(x,y,7); g.beginPath(); g.moveTo(x-5,y); g.lineTo(x+5,y); g.moveTo(x,y-5); g.lineTo(x,y+5); g.strokePath(); }
}

export default ActionDock;
