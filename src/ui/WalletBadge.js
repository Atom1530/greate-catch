// src/ui/WalletBadge.js
export class WalletBadge {
  constructor(scene, wallet, {
    x = 320, y = 46,
    width = 420,
    showPerks = true,
    labels = { coins: 'Серебро', gold: 'Золото', perks: 'Перки' },
  } = {}) {
    this.s = scene;
    this.wallet = wallet || { coins: 0, gold: 0, perks: 0 };
    this.w = width; this.h = 54;

    this.c = scene.add.container(x, y).setDepth(952);

    // карточка-фон
    const card = scene.add.rectangle(0, 0, this.w, this.h, 0x151b27, 1)
      .setOrigin(0.5).setStrokeStyle(2, 0xffffff, 0.14);
    const gloss = scene.add.rectangle(0, -this.h/2 + 8, this.w - 16, 10, 0xffffff, 0.05).setOrigin(0.5);
    this.c.add([card, gloss]);

    // разметка под 2/3 пилюли
    const pad = 8;
    const cols = showPerks ? 3 : 2;
    const pillW = Math.floor((this.w - pad*(cols+1)) / cols);
    const pillH = 34;
    const y0 = 0;

    // пилюли
    this.pillCoins = this._makePill(-this.w/2 + pad + pillW/2, y0, pillW, pillH, 0x212a3c, this._icCoin.bind(this), labels.coins);
    this.pillGold  = this._makePill(this.pillCoins.grp.x + pillW/2 + pad + pillW/2, y0, pillW, pillH, 0x2a3348, this._icGold.bind(this), labels.gold);

    if (showPerks) {
      const xPerk = this.pillGold.grp.x + pillW/2 + pad + pillW/2;
      this.pillPerk = this._makePill(xPerk, y0, pillW, pillH, 0x252e41, this._icPerk.bind(this), labels.perks);
    }

    this.set(this.wallet.coins|0, this.wallet.gold|0, this.wallet.perks|0);
  }

  set(coins, gold, perks = 0){
    this.coins = coins|0; this.gold = gold|0; this.perks = perks|0;
    this.pillCoins.value.setText(String(this.coins));
    this.pillGold.value.setText(String(this.gold));
    if (this.pillPerk) this.pillPerk.value.setText(String(this.perks));
  }

  setPosition(x,y){ this.c.setPosition(x,y); }
  getBounds(){ return new Phaser.Geom.Rectangle(this.c.x - this.w/2, this.c.y - this.h/2, this.w, this.h); }

  // — внутренности —
  _makePill(cx, cy, w, h, color, drawIcon, label){
    const grp = this.s.add.container(cx, cy); this.c.add(grp);

    const bg = this.s.add.rectangle(0, 0, w, h, color, 1)
      .setOrigin(0.5).setStrokeStyle(2, 0xffffff, 0.12);
    const gloss = this.s.add.rectangle(0, -h/2 + 5, w - 10, 8, 0xffffff, 0.06).setOrigin(0.5);

    // иконка
    const ic = this.s.add.graphics({ x: -w/2 + 16, y: 0 });
    drawIcon(ic, 0, 0);

    // подпись и число
    const labelT = this.s.add.text(ic.x + 18, -9, label, { fontFamily:'Arial, sans-serif', fontSize:'11px', color:'#a9b7d0' }).setOrigin(0,0.5);
    const valueT = this.s.add.text(ic.x + 18, 8,  '0', { fontFamily:'Arial, sans-serif', fontSize:'18px', color:'#eaf2ff' }).setOrigin(0,0.5);

    // плюсик (пока неактивный)
    const plus = this.s.add.rectangle(w/2 - 14, 0, 22, 22, 0xffffff, 0.10)
      .setOrigin(0.5).setStrokeStyle(2, 0xffffff, 0.14);
    const plusT = this.s.add.text(plus.x, plus.y - 1, '+', { fontFamily:'Arial, sans-serif', fontSize:'16px', color:'#ffffff' }).setOrigin(0.5);

    grp.add([bg, gloss, ic, labelT, valueT, plus, plusT]);
    return { grp, value: valueT };
  }

  _icCoin(g,x,y){ g.fillStyle(0xf6d463,1).fillCircle(x,y,8); g.fillStyle(0xffffff,0.6).fillCircle(x-3,y-3,2); g.lineStyle(2,0xffffff,0.18).strokeCircle(x,y,8); }
  _icGold(g,x,y){ const R1=8,R2=3.6,pts=[]; for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?R2:R1;pts.push({x:x+Math.cos(a)*r,y:y+Math.sin(a)*r});} g.fillStyle(0xffe47a,1).fillPoints(pts,true); g.lineStyle(2,0xffffff,0.18).strokePoints(pts,true); }
  _icPerk(g,x,y){ g.lineStyle(2,0xb9d7ff,1); g.strokeCircle(x,y,8); g.beginPath(); g.moveTo(x-5,y); g.lineTo(x+5,y); g.moveTo(x,y-5); g.lineTo(x,y+5); g.strokePath(); }
}

export default WalletBadge;
