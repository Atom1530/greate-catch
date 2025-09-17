// src/ui/MarketModal.js
import { summarizeKeepnet } from '../data/pricing.js';

export class MarketModal {
  constructor(scene, keepnet, wallet, onChange, onClose) {
    this.scene = scene;
    this.keepnet = keepnet;
    this.wallet = wallet;
    this.onChange = onChange;
    this.onClose = onClose;
    this.kill = [];
    this.depthBase = 3100;

    // тост
    this.toast = (msg) => {
      const t = this.scene.add.text(
        Math.round(this.scene.scale.width / 2),
        Math.round(this.scene.scale.height - 64),
        msg,
        { fontFamily: 'Arial, sans-serif', fontSize: '16px', color: '#ffffff' }
      ).setOrigin(0.5).setDepth(this.depthBase + 10).setScrollFactor(0);
      this.scene.tweens.add({ targets: t, y: t.y - 12, alpha: 0, delay: 600, duration: 1600, onComplete: () => t.destroy() });
    };

    const W = this.scene.scale.width, H = this.scene.scale.height;
    const PAD = 18;

    // overlay
    const overlay = scene.add.rectangle(0, 0, W, H, 0x000000, 0.72)
      .setOrigin(0, 0).setInteractive().setDepth(this.depthBase).setScrollFactor(0);
    overlay.on('pointerdown', (_p,_x,_y,e)=>e?.stopPropagation());
    overlay.on('wheel', (_p,_dx,_dy,_dz,e)=>e?.stopPropagation());
    this.kill.push(overlay);

    // panel
    const panelW = Math.min(1060, W - 80);
    const panelH = Math.min(620,  H - 80);
    const cx = Math.round(W / 2), cy = Math.round(H / 2);

    const shadow = scene.add.rectangle(cx + 2, cy + 3, panelW, panelH, 0x000000, 0.22)
      .setDepth(this.depthBase + 1).setScrollFactor(0);
    const panel = scene.add.rectangle(cx, cy, panelW, panelH, 0x1f2433, 1)
      .setStrokeStyle(2, 0xffffff, 0.22)
      .setDepth(this.depthBase + 1).setScrollFactor(0);
    this.kill.push(shadow, panel);

    // header
    const titleTop = cy - panelH/2 + 16;
    const title = scene.add.text(cx - panelW/2 + 20, titleTop, 'ПРОДАЖА РЫБЫ', {
      fontFamily:'Arial, sans-serif', fontSize:'28px', color:'#ffffff', fontStyle:'bold'
    }).setOrigin(0,0).setDepth(this.depthBase+2);
    const btnClose = scene.add.text(cx + panelW/2 - 14, titleTop - 8, '✕', {
      fontFamily:'Arial, sans-serif', fontSize:'22px', color:'#ffffff'
    }).setOrigin(1,0).setDepth(this.depthBase+2).setInteractive({useHandCursor:true});
    btnClose.on('pointerdown', ()=> this.close());
    this.kill.push(title, btnClose);

    // внутренняя сетка (одна формула для всех)
    const innerX = cx - panelW/2 + PAD;
    const innerY = titleTop + 48;
    const innerW = panelW - PAD*2;
    const headerH = 36;
    const gapCols = 16;

    const colW = Math.floor((innerW - gapCols) / 2);
    const leftX = innerX;
    const rightX = innerX + colW + gapCols;

    // заголовки секций
    const capL = this._sectionCaption(leftX,  innerY, colW, 'Опции продажи');
    const capR = this._sectionCaption(rightX, innerY, colW, 'Специальные заказы');
    this.kill.push(capL.g, capL.t, capR.g, capR.t);

    // рабочая область под заголовками
    const areaTop = innerY + headerH + 8;
    const areaH = (cy + panelH/2 - PAD) - areaTop;

    // рамки колонок
    const leftFrame  = scene.add.rectangle(leftX,  areaTop, colW, areaH, 0x0f141d, 1)
      .setOrigin(0,0).setStrokeStyle(2, 0xffffff, 0.12).setDepth(this.depthBase+1);
    const rightFrame = scene.add.rectangle(rightX, areaTop, colW, areaH, 0x0f141d, 1)
      .setOrigin(0,0).setStrokeStyle(2, 0xffffff, 0.12).setDepth(this.depthBase+1);
    this.kill.push(leftFrame, rightFrame);

    // контенты колонок (контейнеры) — всё рисуем относительно их (0,0)
    this.leftRoot   = scene.add.container(leftX + 12, areaTop + 12).setDepth(this.depthBase+2);
    this.ordersRoot = scene.add.container(rightX + 12, areaTop + 12).setDepth(this.depthBase+2);
    this.summaryBar = this._buildSummaryBar(leftX, areaTop, colW, areaH);
    this.kill.push(this.summaryBar.grp);
    this.kill.push(this.leftRoot, this.ordersRoot);

    // левая: три карточки
    this.sellCards = [];
    let y = 0;
    this.sellCards.push(this._buildSellOption(this.leftRoot, { y, w: colW - 24, h: 120,
      icon:'rare', title:'Редкая рыба', subtitle:'Продать редкую рыбу за золото',
      countText: () => `У вас: ${this._cache?.cntRec|0} шт`,
      estText:   () => `Оценочная стоимость: ${this._cache?.cntRec|0} золотых`,
      button: { label:'Скоро', disabled:true, onClick:()=>this.soon() }
    })); y += 120 + 12;

    this.sellCards.push(this._buildSellOption(this.leftRoot, { y, w: colW - 24, h: 120,
      icon:'big', title:'Крупная рыба', subtitle:'Продать всю крупную рыбу (Дорого)',
      countText: () => `У вас: ${this._cache?.prem?.length|0} шт`,
      estText:   () => `Оценочная стоимость: ${this._cache?.sumPrem|0} серебра`,
      button: { label:'Продать', onClick:()=>this.sellPremium() }
    })); y += 120 + 12;

    this.sellCards.push(this._buildSellOption(this.leftRoot, { y, w: colW - 24, h: 120,
      icon:'all', title:'Вся рыба', subtitle:'Продать всю рыбу оптом (Дешево)',
      countText: () => `У вас: ${this.keepnet.length|0} шт`,
      estText:   () => `Оценочная стоимость: ${(this._cache?.sumSmall|0)+(this._cache?.sumPrem|0)} серебра`,
      button: { label:'Продать всё', onClick:()=>this.sellAll() }
    }));

    // правая: сетка заказов 2xN
    this.orders = [
      { id:'bream',   name:'Лещ',   price:90,  tex:'fish_bream' },
      { id:'catfish', name:'Сом',   price:200, tex:'fish_catfish' },
      { id:'croaker', name:'Горбыль судачий', price:45,  tex:'fish_croaker' },
      { id:'asp',     name:'Жерех', price:75,  tex:'fish_asp' },
    ];
    const gp = 12;
    const cardW = Math.floor((colW - 24 - gp) / 2);
    const cardH = 196;

    let xi = 0, yi = 0;
    for (const o of this.orders) {
      const x = 0 + xi * (cardW + gp);
      const y2 = 0 + yi * (cardH + gp);
      this._buildOrderCard(this.ordersRoot, o, x, y2, cardW, cardH);
      xi++; if (xi >= 2) { xi = 0; yi++; }
    }

    // плавное появление
    this.leftRoot.setAlpha(0);
    this.ordersRoot.setAlpha(0);
    scene.tweens.add({ targets:this.leftRoot,   alpha:1, duration:200, ease:'Sine.out' });
    scene.tweens.add({ targets:this.ordersRoot, alpha:1, duration:200, ease:'Sine.out', delay:70 });

    // подсчёты
    this.refresh();
  }

  // секционный заголовок (x,y — левый верх)
  _sectionCaption(x, y, w, text){
    const g = this.scene.add.rectangle(x, y, w, 36, 0x0b1019, 1)
      .setOrigin(0,0).setStrokeStyle(2, 0xffffff, 0.10).setDepth(this.depthBase+1);
    const t = this.scene.add.text(x + w/2, y + 6, text, {
      fontFamily:'Arial, sans-serif', fontSize:'16px', color:'#e9f0ff', fontStyle:'bold'
    }).setOrigin(0.5,0).setDepth(this.depthBase+2);
    return { g, t };
  }

  // карточка слева (root — контейнер колонки)
  _buildSellOption(root, { y, w, h, icon, title, subtitle, countText, estText, button }) {
    const D = this.depthBase + 2, s = this.scene;

    const r = s.add.rectangle(0, y, w, h, 0x2a3144, 1)
      .setOrigin(0,0).setStrokeStyle(2, 0xffffff, 0.16).setDepth(D).setInteractive();
    r.on('pointerover', ()=> r.setFillStyle(0x33405a,1));
    r.on('pointerout',  ()=> r.setFillStyle(0x2a3144,1));
    root.add(r); this.kill.push(r);

    const iconBox = s.add.rectangle(12, y + 12, 110, h - 24, 0x0f141d, 1)
      .setOrigin(0,0).setStrokeStyle(2, 0xffffff, 0.10).setDepth(D+1);
    root.add(iconBox); this.kill.push(iconBox);

    const iconG = this._drawSellIcon(icon, iconBox.x + 55, iconBox.y + (h-24)/2, 34);
    root.add(iconG); this.kill.push(iconG);

    const textX = 12 + 110 + 12;
    const titleT = s.add.text(textX, y + 14, title, {
      fontFamily:'Arial, sans-serif', fontSize:'18px', color:'#ffffff'
    }).setOrigin(0,0).setDepth(D+1);
    const subT = s.add.text(textX, titleT.y + 22, subtitle, {
      fontFamily:'Arial, sans-serif', fontSize:'14px', color:'#cfd8dc'
    }).setOrigin(0,0).setDepth(D+1);
    const cntT = s.add.text(textX, subT.y + 20, '', {
      fontFamily:'Arial, sans-serif', fontSize:'13px', color:'#a9b7d0'
    }).setOrigin(0,0).setDepth(D+1);
    const estT = s.add.text(textX, cntT.y + 18, '', {
      fontFamily:'Arial, sans-serif', fontSize:'13px', color:'#a9b7d0'
    }).setOrigin(0,0).setDepth(D+1);
    root.add(titleT); root.add(subT); root.add(cntT); root.add(estT);
    this.kill.push(titleT, subT, cntT, estT);

    const bw = 140, bh = 36;
    const bx = w - bw - 12, by = y + h - bh - 12;
    const btn = s.add.rectangle(bx, by, bw, bh, button?.disabled ? 0x4b5568 : 0x2a9d8f, 1)
      .setOrigin(0,0).setStrokeStyle(2, 0xffffff, 0.18).setDepth(D+1);
    const btnT = s.add.text(bx + bw/2, by + bh/2, button?.label || 'Продать', {
      fontFamily:'Arial, sans-serif', fontSize:'14px', color:'#ffffff'
    }).setOrigin(0.5).setDepth(D+2);
    root.add(btn); root.add(btnT); this.kill.push(btn, btnT);

    if (!button?.disabled) {
      btn.setInteractive({ useHandCursor:true })
        .on('pointerover', ()=> btn.setFillStyle(0x32b3a3,1))
        .on('pointerout',  ()=> btn.setFillStyle(0x2a9d8f,1))
        .on('pointerdown', button.onClick);
    }

    const update = () => {
      cntT.setText(countText ? countText() : '');
      estT.setText(estText ? estText() : '');
    };
    update();

    return { update };
  }

  // простые иконки
  _drawSellIcon(kind, x, y, s = 32) {
    const g = this.scene.add.graphics().setDepth(this.depthBase + 3);
    g.lineStyle(2, 0xffffff, 1);

    if (kind === 'rare') {
      g.strokeCircle(x - s/3, y, s/4);
      g.beginPath(); g.moveTo(x - s/6, y); g.lineTo(x + s/2, y); g.strokePath();
      for (let i = -2; i <= 2; i++) {
        g.beginPath();
        g.moveTo(x + i * 6, y); g.lineTo(x + i * 6 - 6, y - 6);
        g.moveTo(x + i * 6, y); g.lineTo(x + i * 6 - 6, y + 6);
        g.strokePath();
      }
      g.fillStyle(0xffffff, 1).fillCircle(x + s/2 + 2, y, 2);
    } else if (kind === 'big') {
      g.strokeEllipse(x, y, s * 1.2, s * 0.7);
      g.beginPath();
      g.moveTo(x + s * 0.6, y);
      g.lineTo(x + s * 0.9, y - s * 0.2);
      g.lineTo(x + s * 0.9, y + s * 0.2);
      g.closePath(); g.strokePath();
      g.fillStyle(0xffffff, 1).fillCircle(x - s * 0.25, y - s * 0.08, 2);
    } else { // all
      for (let i = 0; i < 3; i++) {
        const yy = y - s * 0.22 + i * s * 0.22;
        g.strokeEllipse(x - s * 0.1, yy, s * 0.7, s * 0.38);
        g.beginPath();
        g.moveTo(x + s * 0.25, yy); g.lineTo(x + s * 0.45, yy - s * 0.12);
        g.moveTo(x + s * 0.25, yy); g.lineTo(x + s * 0.45, yy + s * 0.12);
        g.strokePath();
      }
    }
    return g;
  }

  // карточка заказа (рисуем в контейнере ordersRoot, координаты — от его (0,0))
  _buildOrderCard(root, order, x, y, w, h) {
    const D = this.depthBase + 2, s = this.scene;

    const box = s.add.rectangle(x, y, w, h, 0x2a3144, 1)
      .setOrigin(0,0).setStrokeStyle(2, 0xffffff, 0.16).setDepth(D).setInteractive({useHandCursor:true});
    box.on('pointerover', ()=> box.setFillStyle(0x33405a,1));
    box.on('pointerout',  ()=> box.setFillStyle(0x2a3144,1));
    box.on('pointerdown', ()=> this.soon());
    root.add(box); this.kill.push(box);

    const imgH = h - 74;
    const imgBox = s.add.rectangle(x + 8, y + 8, w - 16, imgH, 0x0f141d, 1)
      .setOrigin(0,0).setStrokeStyle(2, 0xffffff, 0.10).setDepth(D+1);
    root.add(imgBox); this.kill.push(imgBox);

    if (order.tex && s.textures?.exists(order.tex)) {
      const im = s.add.image(imgBox.x + imgBox.width/2, imgBox.y + imgBox.height/2, order.tex).setDepth(D+2);
      const k = Math.min((imgBox.width - 16) / im.width, (imgBox.height - 16) / im.height);
      im.setScale(k); root.add(im); this.kill.push(im);
    } else {
      const g = s.add.graphics().setDepth(D+2);
      g.lineStyle(2, 0x6bd1ff, 0.9).beginPath();
      const left = imgBox.x + 12;
      const step = (imgBox.width - 24) / 5;
      for (let i = 0; i <= 5; i++) {
        const px = left + i * step;
        const py = imgBox.y + imgBox.height/2 + (i % 2 ? -12 : 12);
        if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.strokePath();
      root.add(g); this.kill.push(g);
    }

    const name = s.add.text(x + w/2, imgBox.y + imgBox.height + 8, order.name, {
      fontFamily:'Arial, sans-serif', fontSize:'18px', color:'#ffffff',
      align:'center', wordWrap:{ width:w - 16 }
    }).setOrigin(0.5,0).setDepth(D+2);
    root.add(name); this.kill.push(name);

    const pillW = 96, pillH = 28;
    const priceBox = s.add.rectangle(x + (w - pillW)/2, y + h - pillH - 10, pillW, pillH, 0x0f141d, 1)
      .setOrigin(0,0).setStrokeStyle(2, 0xffffff, 0.12).setDepth(D+2);
    const priceT = s.add.text(priceBox.x + pillW/2, priceBox.y + pillH/2, `${order.price|0} 🪙`, {
      fontFamily:'Arial, sans-serif', fontSize:'16px', color:'#e9f0ff'
    }).setOrigin(0.5).setDepth(D+3);
    root.add(priceBox); root.add(priceT); this.kill.push(priceBox, priceT);
  }

  // логика
  refresh() {
    const { small, prem, rec, sumSmall, sumPrem, cntRec } = summarizeKeepnet(this.keepnet);
    this._cache = { small, prem, rec, sumSmall, sumPrem, cntRec };
    this.sellCards?.forEach(c => c?.update && c.update());
    const cap = (this.scene.keepnetCap | 0) || 25;
    this.summaryBar.set(this.wallet.coins | 0, `${this.keepnet.length | 0}/${cap}`, this.wallet.gold | 0);

  }

  sellSmall(){
    const { small, sumSmall } = this._cache;
    if (!small.length) return;
    this.keepnet.splice(0, this.keepnet.length, ...this.keepnet.filter(f=>!small.includes(f)));
    this.wallet.coins += sumSmall;
    this.toast(`Продано по кг: +${sumSmall} мон.`);
    this.onChange && this.onChange();
    this.refresh();
  }

  sellPremium(){
    const { prem, sumPrem } = this._cache;
    if (!prem.length) return;
    this.keepnet.splice(0, this.keepnet.length, ...this.keepnet.filter(f=>!prem.includes(f)));
    this.wallet.coins += sumPrem;
    this.toast(`Продано ценное: +${sumPrem} мон.`);
    this.onChange && this.onChange();
    this.refresh();
  }

  sellAll(){
    const { small, prem, sumSmall, sumPrem } = this._cache;
    const total = [...small, ...prem];
    if (!total.length) return;
    this.keepnet.splice(0, this.keepnet.length, ...this.keepnet.filter(f=>!total.includes(f)));
    const add = (sumSmall|0) + (sumPrem|0);
    this.wallet.coins += add;
    this.toast(`Продано всё: +${add} мон.`);
    this.onChange && this.onChange();
    this.refresh();
  }

  soon(){ this.toast('Скоро: спец-заказы и редкая рыба за золото'); }

  close(){
    this.kill.forEach(o => { try{o.destroy();}catch(e){} });
    this.onClose && this.onClose();
  }
  // полоска внизу левой колонки
_buildSummaryBar(leftX, areaTop, colW, areaH){
  const s = this.scene, D = this.depthBase + 2;
  const x = leftX + 12, y = areaTop + areaH - 60, w = colW - 24, h = 52;

  const grp = s.add.container(x, y).setDepth(D);
  const bg  = s.add.rectangle(0, 0, w, h, 0x1b2230, 1).setOrigin(0,0)
                 .setStrokeStyle(2, 0xffffff, 0.12);
  const gloss = s.add.rectangle(w/2, 6, w-10, 8, 0xffffff, 0.05).setOrigin(0.5,0);
  grp.add([bg, gloss]);

  const pad = 8, pillW = Math.floor((w - pad*4)/3), pillH = h - 16;

  const pCoins = this._makePill(grp, pad,               8, pillW, pillH, 0x26324a, (g,x,y)=>this._iconCoin(g,x,y),  '0');
  const pKeep  = this._makePill(grp, pad*2 + pillW,     8, pillW, pillH, 0x26324a, (g,x,y)=>this._iconKeep(g,x,y), '0/0');
  const pGold  = this._makePill(grp, pad*3 + pillW*2,   8, pillW, pillH, 0x2a3348, (g,x,y)=>this._iconGold(g,x,y),  '0');

  return {
    grp,
    set:(coins, keepStr, gold)=>{
      pCoins.text.setText(String(coins));
      pKeep.text.setText(keepStr);
      pGold.text.setText(String(gold));
    }
  };
}

// универсальная пилюля
_makePill(parent, x, y, w, h, color, drawIcon, initial='0'){
  const s = this.scene, D = this.depthBase + 3;
  const c = s.add.container(x, y).setDepth(D);
  const bg = s.add.rectangle(0,0,w,h,color,1).setOrigin(0,0)
      .setStrokeStyle(2, 0xffffff, 0.12);
  const gloss = s.add.rectangle(w/2,4,w-10,6,0xffffff,0.06).setOrigin(0.5,0);
  const ic = s.add.graphics({ x: 14, y: Math.floor(h/2) }); drawIcon(ic, 0, 0);
  const text = s.add.text(30, Math.floor(h/2), initial, {
    fontFamily:'Arial, sans-serif', fontSize:'16px', color:'#eaf2ff'
  }).setOrigin(0,0.5);
  c.add([bg,gloss,ic,text]); parent.add(c);
  this.kill.push(c,bg,gloss,ic,text);
  return { c, text };
}

// иконки
_iconCoin(g, x, y){ g.fillStyle(0xf6d463,1).fillCircle(x,y,8); g.fillStyle(0xffffff,0.6).fillCircle(x-3,y-3,2); g.lineStyle(2,0xffffff,0.18).strokeCircle(x,y,8); }
_iconGold(g, x, y){
  const R1=8, R2=3.6; const pts=[];
  for(let i=0;i<10;i++){ const a=-Math.PI/2 + i*Math.PI/5, r=(i%2?R2:R1); pts.push({x:x+Math.cos(a)*r,y:y+Math.sin(a)*r});}
  g.fillStyle(0xffe47a,1).fillPoints(pts,true); g.lineStyle(2,0xffffff,0.18).strokePoints(pts,true);
}
_iconKeep(g, x, y){ // маленькая «рыбка»
  g.lineStyle(2,0xb9d7ff,1); g.strokeEllipse(x-2,y,14,8);
  g.beginPath(); g.moveTo(x+5,y); g.lineTo(x+11,y-4); g.moveTo(x+5,y); g.lineTo(x+11,y+4); g.strokePath();
  g.fillStyle(0xffffff,1).fillCircle(x-7,y-1.2,1.2);
}

}

export default MarketModal;
