// src/ui/ShopModal.js
import UI from '../ui/theme.js';
import { ShopCatalog, ensureCatalogInGearDB } from '../data/shopCatalog.js';
import { GearDB } from '../data/gear.js';
import { onItemBought, onInventoryChange, onWalletChange } from '../quests/QuestHooks.js';


export default class ShopModal {
  /**
   * @param {Phaser.Scene} scene
   * @param {{coins:number,gold:number}} wallet
   * @param {{rods:string[],reels:string[],lines:string[],hooks:string[],bait:Object, hookPacks?:Object}} inventory
   * @param {number} level
   * @param {Function=} onChange
   * @param {Function=} onClose
   */
  constructor(scene, wallet, inventory, level = 1, onChange, onClose) {
    this.s = scene;
    this.wallet = wallet;
    this.inventory = inventory;
    this.level = level | 0;
    this.onChange = onChange;
    this.onClose = onClose;

    ensureCatalogInGearDB(GearDB);

    this.kill = [];
    this.depthBase = UI?.z?.modal ? UI.z.modal + 50 : 3100;

    const W = this.s.scale.width, H = this.s.scale.height;
    const panelW = Math.min(1060, W - 80);
    const panelH = Math.min(620,  H - 80);
    const cx = Math.round(W / 2), cy = Math.round(H / 2);


    // ===== overlay
    const overlay = this.s.add
      .rectangle(0, 0, W, H, 0x000000, 0.72)
      .setOrigin(0, 0)
      .setDepth(this.depthBase)
      .setScrollFactor(0)
      .setInteractive();
    overlay.on('pointerdown', (_p,_x,_y,e)=>e?.stopPropagation());
    overlay.on('wheel', (_p,_o,_dx,_dy,_dz,e)=>e?.stopPropagation());
    this.kill.push(overlay);

    // ===== panel
    const shadow = this.s.add.rectangle(cx + 2, cy + 3, panelW, panelH, 0x000000, 0.22)
      .setDepth(this.depthBase + 1).setScrollFactor(0);
    const panel = this.s.add.rectangle(cx, cy, panelW, panelH, 0x151a24, 1)
      .setStrokeStyle(2, 0xffffff, 0.22)
      .setDepth(this.depthBase + 1).setScrollFactor(0);
    this.kill.push(shadow, panel);

    // ===== header
    const titleY = cy - panelH/2 + 16;
    const title = this.s.add.text(cx - panelW/2 + 20, titleY, 'МАГАЗИН', {
      fontFamily:'Arial, sans-serif', fontSize:'28px', color:'#ffffff', fontStyle:'bold'
    }).setOrigin(0,0).setDepth(this.depthBase+2);

    const btnClose = this.s.add.text(cx + panelW/2 - 14, titleY - 8, '✕', {
      fontFamily:'Arial, sans-serif', fontSize:'22px', color:'#ffffff'
    }).setOrigin(1,0).setDepth(this.depthBase+2).setInteractive({useHandCursor:true});
    btnClose.on('pointerdown', ()=> this.close());
    this.kill.push(title, btnClose);

    // левый верх — уровень
    const lvlTxt = this.s.add.text(cx - panelW/2 + 20, titleY + 34, `Уровень: ${this.level}`, {
      fontFamily:'Arial, sans-serif', fontSize:'14px', color:'#8ea6c9'
    }).setOrigin(0,0).setDepth(this.depthBase+2);
    this.kill.push(lvlTxt);

    // правый верх — кошелёк
    this._walletText = this.s.add.text(cx + panelW/2 - 20, titleY + 34,
      `🪙 ${this.wallet.coins|0}   ★ ${this.wallet.gold|0}`,
      { fontFamily:'Arial, sans-serif', fontSize:'14px', color:'#cfd8ff' }
    ).setOrigin(1,0).setDepth(this.depthBase+2);
    this.kill.push(this._walletText);

    // ===== разметка: левая колонка категорий / правая зона карточек
    const PAD = 18;
    const leftW = 260;
    const topY = titleY + 70;
    const innerH = panelH - (topY - (cy - panelH/2)) - PAD;

    // левая колонка контейнер + рамка
    const leftX = Math.round(cx - panelW/2 + PAD + leftW/2);
    const leftFrame = this.s.add.rectangle(leftX, Math.round(topY + innerH/2),
      leftW, innerH, 0x0f141d, 1)
      .setStrokeStyle(2, 0xffffff, 0.12)
      .setDepth(this.depthBase+1);
    this.kill.push(leftFrame);

    // правая область (лист с карточками)
    const rightW = panelW - leftW - PAD*3;
    const rightX = Math.round(leftX + leftW/2 + PAD + rightW/2);
    const rightFrame = this.s.add.rectangle(rightX, Math.round(topY + innerH/2),
      rightW, innerH, 0x0f141d, 1)
      .setStrokeStyle(2, 0xffffff, 0.12)
      .setDepth(this.depthBase+1);
    this.kill.push(rightFrame);

    // ===== категории (левая колонка) — скролл
    this._catViewport = { x:leftX, y:Math.round(topY + innerH/2), w:leftW, h:innerH };
    // Глобальный wheel: решаем по координатам, что крутить
this._onWheel = (pointer, over, dx, dy, dz, event) => {
  if (!this._catViewport || !this._listViewport) return;
  const px = pointer.x, py = pointer.y;
  if (this._ptIn(px, py, this._catViewport)) { event?.stopPropagation(); this._scrollCats(dy); return; }
  if (this._ptIn(px, py, this._listViewport)) { event?.stopPropagation(); this._scrollList(dy); return; }
};
this.s.input.on('wheel', this._onWheel);


    this.catRoot = this.s.add.container(0,0).setDepth(this.depthBase+2);
    this.kill.push(this.catRoot);

    const catMaskG = this.s.make.graphics({ x:0, y:0, add:false });
    catMaskG.fillStyle(0xffffff).fillRect(
      Math.round(this._catViewport.x - this._catViewport.w/2),
      Math.round(this._catViewport.y - this._catViewport.h/2),
      this._catViewport.w, this._catViewport.h
    );
    const catMask = catMaskG.createGeometryMask();
    this.catRoot.setMask(catMask);
    this.kill.push(catMaskG);

    // колесо мыши внутри левой колонки
    // const catHit = this.s.add.rectangle(this._catViewport.x, this._catViewport.y,
    //   this._catViewport.w, this._catViewport.h, 0x000000, 0)
    //   .setDepth(this.depthBase+3).setInteractive();
    // catHit.on('wheel', (_p,_o,dx,dy,_dz)=> this._scrollCats(dy));

// // Глобальный wheel: решаем по координатам, что крутить
this._onWheel = (pointer, over, dx, dy, dz, event) => {
  const px = pointer.x, py = pointer.y;
  if (this._ptIn(px, py, this._catViewport)) { event?.stopPropagation(); this._scrollCats(dy); return; }
  if (this._ptIn(px, py, this._listViewport)) { event?.stopPropagation(); this._scrollList(dy); return; }
};
this.s.input.on('wheel', this._onWheel);


    // ===== правая зона с карточками — скролл
    this._listViewport = { x:rightX, y:Math.round(topY + innerH/2), w:rightW, h:innerH };
    // Глобальный wheel: решаем по координатам, что крутить
this._onWheel = (pointer, over, dx, dy, dz, event) => {
  if (!this._catViewport || !this._listViewport) return;
  const px = pointer.x, py = pointer.y;
  if (this._ptIn(px, py, this._catViewport)) { event?.stopPropagation(); this._scrollCats(dy); return; }
  if (this._ptIn(px, py, this._listViewport)) { event?.stopPropagation(); this._scrollList(dy); return; }
};
this.s.input.on('wheel', this._onWheel);

    this.cardsRoot = this.s.add.container(0,0).setDepth(this.depthBase+2);
    const listMaskG = this.s.make.graphics({x:0, y:0, add:false});
    listMaskG.fillStyle(0xffffff).fillRect(
      Math.round(this._listViewport.x - this._listViewport.w/2),
      Math.round(this._listViewport.y - this._listViewport.h/2),
      this._listViewport.w, this._listViewport.h
    );
    const listMask = listMaskG.createGeometryMask();
    this.cardsRoot.setMask(listMask);
    this.kill.push(this.cardsRoot, listMaskG);

    // const listHit = this.s.add.rectangle(this._listViewport.x, this._listViewport.y,
    // this._listViewport.w, this._listViewport.h, 0x000000, 0)
    // .setDepth(this.depthBase+1).setInteractive(); // ниже карточек
    // listHit.on('wheel', (_p,_o,dx,dy,_dz)=> this._scrollList(dy));


    // ===== данные категорий
    this._labelMap = {
      sets:'Сеты',
      rods:'Удочки',
      reels:'Катушки',
      lines:'Леска',
      hooks:'Крючки',
      bait:'Наживка',
      accessories:'Аксессуары',
      ex_rods:'Эксклюзив. удилища',
      ex_reels:'Эксклюзив. катушки'
    };

    const defaultOrder = ['rods','reels','lines','hooks','bait','accessories','sets','ex_rods','ex_reels'];
    const available = Object.keys(ShopCatalog.items || {});
    this.categories = (ShopCatalog.categories && ShopCatalog.categories.length)
      ? ShopCatalog.categories
      : defaultOrder.filter(k => available.includes(k));
    if (this.categories.length === 0) this.categories = ['rods']; // safety

    this.activeTab = this.categories[0];
    this._buildCategories();     // слева
    this._renderList(true);      // справа

    // ESC
    this.s.input.keyboard?.once('keydown-ESC', () => this.close());
  }

  // ============ ЛЕВАЯ КОЛОНКА КАТЕГОРИЙ ============
  _buildCategories(){
    this.catRoot.removeAll(true);
    const { x, y, w, h } = this._catViewport;

    const GAP = 10, BTN_H = 58, PADX = 12;
    let cy = Math.round(y - h/2) + 8 + BTN_H/2;

    this._catBtns = [];

    for (const cat of this.categories) {
      const r = this.s.add.rectangle(x, cy, w - 14, BTN_H, 0x1b2230, 1)
        .setStrokeStyle(2, 0xffffff, 0.12)
        .setDepth(this.depthBase+2)
        .setInteractive({useHandCursor:true})
        .on('pointerover', ()=>r.setFillStyle(0x222b3e,1))
        .on('pointerout',  ()=>r.setFillStyle((cat===this.activeTab)?0x24324b:0x1b2230,1))
        .on('pointerdown', ()=> this._switchTab(cat));
      this.catRoot.add(r);

      // иконка слева
      const icon = this._drawCatIcon(cat, x - (w-14)/2 + PADX + 16, cy);
      this.catRoot.add(icon);


      // подпись
      const t = this.s.add.text(x - (w-14)/2 + PADX + 36, cy,
        this._labelMap[cat] || cat, {
          fontFamily:'Arial, sans-serif', fontSize:'16px', color:'#e9f0ff'
        }).setOrigin(0,0.5).setDepth(this.depthBase+3);
      this.catRoot.add(t);

      this._catBtns.push({ r, t, cat });
      cy += BTN_H + GAP;
    }

    this._updateCatVisual();
    this._catsMinY = this.catRoot.first?.y || 0;
    this._catsMaxY = Math.max(this._catsMinY, Math.round(y + h/2) - 12);
  }
//спомогательный метод
 _ptIn(x, y, r) {
  return x >= r.x - r.w/2 && x <= r.x + r.w/2 &&
         y >= r.y - r.h/2 && y <= r.y + r.h/2;
}
  _drawCatIcon(cat, cx, cy){
    const g = this.s.add.graphics().setDepth(this.depthBase+3);
    g.lineStyle(2, 0xb5c2d9, 1);
    g.fillStyle(0xb5c2d9, 1);

    switch(cat){
      case 'rods': {
        g.lineStyle(2, 0x9ec9ff, 1);
        g.beginPath();
        g.moveTo(cx-14, cy+10); g.lineTo(cx+14, cy-10);
        g.strokePath();
        g.fillCircle(cx+10, cy-8, 2);
        break;
      }
      case 'reels': {
        g.lineStyle(2, 0x9ec9ff, 1);
        g.strokeCircle(cx, cy, 10);
        g.beginPath(); g.moveTo(cx+10, cy); g.lineTo(cx+16, cy); g.strokePath();
        break;
      }
      case 'lines': {
        g.lineStyle(2, 0x9ec9ff, 1);
        g.strokeRect(cx-10, cy-10, 20, 20);
        g.beginPath();
        g.moveTo(cx-6, cy-6); g.lineTo(cx+6, cy+6);
        g.moveTo(cx+6, cy-6); g.lineTo(cx-6, cy+6);
        g.strokePath();
        break;
      }
      case 'hooks': {
        g.lineStyle(2, 0x9ec9ff, 1);
        g.beginPath();
        g.moveTo(cx-6, cy-12);
        g.lineTo(cx-6, cy+6);
        g.arc(cx, cy+6, 6, Math.PI, Math.PI*1.8, false);
        g.strokePath();
        break;
      }
      case 'bait': {
        g.lineStyle(2, 0x9ec9ff, 1);
        g.strokeCircle(cx-4, cy, 5);
        g.strokeCircle(cx+6, cy-2, 4);
        break;
      }
      case 'accessories': {
        g.lineStyle(2, 0x9ec9ff, 1);
        g.strokeRoundedRect(cx-12, cy-10, 24, 20, 4);
        g.beginPath(); g.moveTo(cx, cy-6); g.lineTo(cx, cy+6); g.moveTo(cx-6, cy); g.lineTo(cx+6, cy); g.strokePath();
        break;
      }
      case 'sets': {
        g.lineStyle(2, 0x9ec9ff, 1);
        g.strokeRoundedRect(cx-12, cy-10, 24, 20, 3);
        g.beginPath(); g.moveTo(cx-12, cy-3); g.lineTo(cx+12, cy-3); g.strokePath();
        break;
      }
      default: {
        g.strokeCircle(cx, cy, 8);
      }
    }
    return g;
  }

  _switchTab(cat){
    if (this.activeTab === cat) return;
    this.activeTab = cat;
    this._updateCatVisual();
    this._renderList(true);
  }

  _updateCatVisual(){
    this._catBtns?.forEach(({r, t, cat})=>{
      const active = (cat === this.activeTab);
      r.setFillStyle(active?0x24324b:0x1b2230,1);
      r.setStrokeStyle(2, 0x6bd1ff, active?0.6:0.12);
      t.setColor(active?'#ffffff':'#c9d3e7');
      t.setFontStyle(active?'bold':'normal');
    });
  }

  _scrollCats(deltaY){
    if (!this._catBtns?.length) return;
    const step = Phaser.Math.Clamp(deltaY, -60, 60);
    // вычислим пределы
    const first = this._catBtns[0].r;
    const last  = this._catBtns[this._catBtns.length-1].r;
    const minY = Math.round(this._catViewport.y - this._catViewport.h/2 + 8 + first.height/2);
    const maxY = Math.round(this._catViewport.y + this._catViewport.h/2 - 8 - last.height/2);

    // сдвигаем все элементы
    this.catRoot.iterate(obj => { if (obj.y != null) obj.y -= step; });

    // clamp
    const curFirstY = first.y;
    const curLastY  = last.y;
    let corr = 0;
    if (curFirstY > minY) corr = curFirstY - minY;
    if (curLastY < maxY)  corr = curLastY - maxY;
    if (corr) this.catRoot.iterate(obj => { if (obj.y != null) obj.y -= corr; });
  }

  // ============ ПРАВАЯ ЧАСТЬ — СПИСОК КАРТОЧЕК ============
  _getItemsForActiveTab() {
    const list = ShopCatalog.items?.[this.activeTab] || [];
    let res = [...list];
    // фильтр «доступно по уровню сверху»
    res.sort((a,b)=>
      (a.level|0)-(b.level|0) || (a.price|0)-(b.price|0) || String(a.id).localeCompare(String(b.id))
    );
    return res;
  }

  _renderList(withFade=false){
    this.cardsRoot.removeAll(true);

    const items = this._getItemsForActiveTab();
    const PAD = 14, cols = 4;
    const colW = Math.floor((this._listViewport.w - PAD*(cols-1) - 24) / cols);
    const cardW = Math.min(240, colW);
    const cardH = 214;

    let xi = 0;
    let y = Math.round(this._listViewport.y - this._listViewport.h/2) + 12 + cardH/2;

    const x0 = Math.round(this._listViewport.x - this._listViewport.w/2) + 12 + Math.floor((colW - cardW)/2);

    for (const it of items) {
      const x = x0 + xi * (colW) + cardW/2;
      const objs = this._makeCard(it, x, y, cardW, cardH);
      this.cardsRoot.add(objs);

      xi++;
      if (xi >= cols){ xi = 0; y += cardH + PAD; }
    }

    // запомним границы для скролла
    this._listMinY = Math.round(this._listViewport.y - this._listViewport.h/2) + 8 + cardH/2;
    this._listMaxY = Math.max(this._listMinY, y);

    if (withFade){
      this.cardsRoot.setAlpha(0);
      this.s.tweens.add({ targets: this.cardsRoot, alpha:1, duration:180, ease:'Sine.inOut' });
    }
  }

  _makeCard(it, x, y, w, h){
    const D = this.depthBase+3;
    const objs = [];

    // фон
    const rect = this.s.add.rectangle(x, y, w, h, 0x1b2230, 1)
      .setStrokeStyle(2, 0xffffff, 0.14).setDepth(D).setInteractive();
    rect.on('pointerover', ()=>rect.setFillStyle(0x212a3e,1));
    rect.on('pointerout',  ()=>rect.setFillStyle(0x1b2230,1));
    objs.push(rect);

    // мини-картинка (плашка сверху)
    const imgH = 90;
    const imgRect = this.s.add.rectangle(x, Math.round(y - h/2 + imgH/2 + 8), w-16, imgH, 0x0f141d, 1)
      .setStrokeStyle(2, 0xffffff, 0.08).setDepth(D+1);
    objs.push(imgRect);

    // простая «заглушка-изображение»
    const g = this.s.add.graphics().setDepth(D+2);
    g.lineStyle(2, 0x6bd1ff, 0.9);
    g.beginPath();
    g.moveTo(imgRect.x - (w-16)/2 + 10, imgRect.y + 20);
    g.lineTo(imgRect.x - (w-16)/2 + 40, imgRect.y - 10);
    g.lineTo(imgRect.x - (w-16)/2 + 70, imgRect.y + 10);
    g.lineTo(imgRect.x - (w-16)/2 + 100, imgRect.y - 6);
    g.strokePath();
    objs.push(g);

    // имя
    const name = this.s.add.text(x, imgRect.y + imgRect.height/2 + 6,
      it.name || it.id, {
        fontFamily:'Arial, sans-serif', fontSize:'16px', color:'#ffffff',
        align:'center', wordWrap:{ width:w-18 }
      }).setOrigin(0.5,0).setDepth(D+2);
    objs.push(name);

    // описание/статы
    const stats = this.s.add.text(x, name.y + name.height + 2, this._statsText(it), {
      fontFamily:'Arial, sans-serif', fontSize:'12px', color:'#a9b7d0',
      align:'center', wordWrap:{ width:w-18 }
    }).setOrigin(0.5,0).setDepth(D+2);
    objs.push(stats);

    // требуемый уровень
    const req = this.s.add.text(x - w/2 + 10, y + h/2 - 44,
      `Треб. ур.: ${it.level ?? 1}`, {
        fontFamily:'Arial, sans-serif', fontSize:'12px', color:'#8ea6c9'
      }).setOrigin(0,1).setDepth(D+2);
    objs.push(req);

    // бейдж «Уже есть»
    if (!it.contains && this.activeTab !== 'bait' && this._owns(this.activeTab, it.id)) {
      const own = this.s.add.text(x + w/2 - 10, y - h/2 + 10, 'Уже есть', {
        fontFamily:'Arial, sans-serif', fontSize:'12px', color:'#a7ffeb'
      }).setOrigin(1,0).setDepth(D+4);
      objs.push(own);
    }

    // кнопка купить (пилюля)
    const bw = Math.min(160, w-18), bh = 32;
    const buy = this.s.add.rectangle(x, y + h/2 - 16, bw, bh, 0x2a9d8f, 1)
      .setStrokeStyle(2, 0xffffff, 0.18).setDepth(D+2);
    const priceStr = `${it.price|0}🪙`;
    const buyLbl = this.s.add.text(x, buy.y, `Купить • ${priceStr}`, {
      fontFamily:'Arial, sans-serif', fontSize:'14px', color:'#ffffff'
    }).setOrigin(0.5).setDepth(D+3);
    objs.push(buy, buyLbl);

    const { canBuy, reason } = this._canBuy(it);
    if (canBuy){
      buy.setInteractive({useHandCursor:true})
        .on('pointerover', ()=>buy.setFillStyle(0x32b3a3,1))
        .on('pointerout',  ()=>buy.setFillStyle(0x2a9d8f,1))
        .on('pointerdown', ()=> this._attemptBuy(it));
    } else {
      buy.setFillStyle(0x4b5568,1).disableInteractive();
      buyLbl.setColor('#c7c7c7');
      buyLbl.setText(reason || 'Недоступно');
    }

    // дополнительные заметки (кол-во наживки/крючков)
    if (!it.contains){
      let ownedNote = '';
      if (this.activeTab === 'bait'){
        const n = (this.inventory.bait?.[it.id] | 0);
        ownedNote = n ? `В наличии: ${n} шт.` : '';
      } else if (this.activeTab === 'hooks'){
        const n = (this.inventory.hookPacks?.[it.id] | 0);
        ownedNote = n ? `Крючков: ${n} шт.` : '';
      }
      if (ownedNote){
        const note = this.s.add.text(x, stats.y + stats.height + 2, ownedNote, {
          fontFamily:'Arial, sans-serif', fontSize:'12px', color:'#a7ffeb'
        }).setOrigin(0.5,0).setDepth(D+2);
        objs.push(note);
      }
    }

    return objs;
  }

  _scrollList(deltaY){
    if (!this.cardsRoot.list?.length) return;
    const step = Phaser.Math.Clamp(deltaY, -80, 80);
    this.cardsRoot.iterate(obj => { if (obj.y != null) obj.y -= step; });

    // clamp по первой/последней строке
    const objs = this.cardsRoot.list.filter(o => o?.type === 'Rectangle'); // фон карточек
    if (!objs.length) return;
    const first = objs[0], last = objs[objs.length-1];

    const minY = Math.round(this._listViewport.y - this._listViewport.h/2 + 12 + first.height/2);
    const maxY = Math.round(this._listViewport.y + this._listViewport.h/2 - 12 - first.height/2);

    const curFirstY = first.y;
    const curLastY  = last.y;
    let corr = 0;
    if (curFirstY > minY) corr = curFirstY - minY;
    if (curLastY < maxY)  corr = curLastY - maxY;
    if (corr) this.cardsRoot.iterate(obj => { if (obj.y != null) obj.y -= corr; });
  }

  // ——— helpers ———
  _owns(kindPlural, id) {
    if (kindPlural === 'bait') return false;
    const arr = this.inventory[kindPlural] || [];
    return Array.isArray(arr) && arr.includes(id);
  }

  _statsText(it) {
    if (it.contains) {
      const compact = it.contains.map(c => {
        if (c.kind === 'bait') return 'наживка ×' + (c.qty || 0);
        const map = { rods:'удочка', reels:'катушка', lines:'леска', hooks:'крючок' };
        return map[c.kind] || c.kind;
      });
      return compact.join(' • ');
    }
    if ('capKg' in it)     return `Прочность: ${(+it.capKg).toFixed(2)} кг`;
    if ('pullBoost' in it) return `Тяга: ×${(+it.pullBoost).toFixed(2)}`;
    if ('control' in it)   return `Контроль: ×${(+it.control).toFixed(2)}`;
    if ('pack' in it)      return `Пачка: ${it.pack|0} шт.`;
    if ('keepnetCap' in it)return `Садок: ${it.keepnetCap|0} мест`;
    return '';
  }

  _canBuy(it) {
    if (this.level < (it.level ?? 1)) return { canBuy:false, reason:'🔒 Уровень' };
    if ((this.wallet.coins|0) < (it.price|0)) return { canBuy:false, reason:'Не хватает' };

    if (!it.contains && this.activeTab !== 'bait' && this.activeTab !== 'accessories') {
      if (this._owns(this.activeTab, it.id)) return { canBuy:false, reason:'Уже есть' };
    }
    if (it.contains) {
      const everythingOwned = it.contains.every(c=>{
        if (c.kind === 'bait') return false;
        const arr = this.inventory[c.kind] || [];
        return arr.includes(c.id);
      });
      if (everythingOwned) return { canBuy:false, reason:'Комплект уже есть' };
    }
    return { canBuy:true, reason:'' };
  }

  _attemptBuy(it) {
    const { canBuy, reason } = this._canBuy(it);
    if (!canBuy) { this._toast(reason || 'Покупка недоступна'); return; }

    // списываем монеты
    this.wallet.coins = (this.wallet.coins|0) - (it.price|0);
    //QUEST HOOKS:
    onWalletChange(this.wallet);

    // выдача
    if (it.contains) {
      for (const c of it.contains) this._grantItem(c.kind, c.id, c.qty || 0);
    } else {
      const kind = this.activeTab;
      const qty = (kind === 'bait') ? (it.pack || 0) : 0;
      this._grantItem(kind, it.id, qty, it);
    }

    // QUEST HOOKS: покупка и инвентарь
   onItemBought({ itemId: it.id, kind: this.activeTab });
   if (it.contains) {
     // опционально: считаем покупку каждого предмета в комплекте
     for (const c of it.contains) onItemBought({ itemId: c.id, kind: c.kind });
   }
   onInventoryChange(this.inventory);

    // апдейт
    this._walletText?.setText(`🪙 ${this.wallet.coins|0}   ★ ${this.wallet.gold|0}`);
    this._renderList();
    this.onChange && this.onChange();
    this._toast('Покупка успешна');
  }

  _grantItem(kind, id, qty = 0, itemObj = null) {
    if (kind === 'bait') {
      const bag = this.inventory.bait || (this.inventory.bait = {});
      bag[id] = (bag[id] | 0) + (qty | 0);
      return;
    }
    if (kind === 'hooks') {
      const pack = qty || (itemObj?.pack|0) || 5;
      const stacks = this.inventory.hookPacks || (this.inventory.hookPacks = {});
      stacks[id] = (stacks[id] | 0) + pack;
      const arr = this.inventory.hooks || (this.inventory.hooks = []);
      if (!arr.includes(id)) arr.push(id);
      return;
    }
    if (kind === 'accessories') {
      // апгрейды: сейчас — увеличение вместимости садка
      if (itemObj && itemObj.keepnetCap){
        if (typeof this.s.keepnetCap === 'number') this.s.keepnetCap = itemObj.keepnetCap|0;
        // сохраним маркер апгрейда в инвентарь
        const up = (this.inventory.upgrades ||= {});
        up.keepnetCap = itemObj.keepnetCap|0;
      }
      return;
    }
    // rods / reels / lines — поштучно
    const arr = this.inventory[kind] || (this.inventory[kind] = []);
    if (!arr.includes(id)) arr.push(id);
  }

  _toast(msg) {
    const t = this.s.add.text(
      Math.round(this.s.scale.width / 2),
      Math.round(this.s.scale.height - 64),
      msg,
      { fontFamily:'Arial, sans-serif', fontSize:'16px', color:'#ffffff' }
    ).setOrigin(0.5).setDepth(this.depthBase + 10).setScrollFactor(0);
    this.s.tweens.add({ targets:t, y:t.y-12, alpha:0, delay:600, duration:1600, onComplete:()=>t.destroy() });
  }

  close() {
    if (this._onWheel) this.s.input.off('wheel', this._onWheel);
    this.kill.forEach(o => { try { o.destroy(); } catch(_) {} });
    this.onClose && this.onClose();

  }
}
