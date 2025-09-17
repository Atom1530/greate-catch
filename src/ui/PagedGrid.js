// src/ui/PagedGrid.js
// Универсальный постраничный грид  (без масок и без завязки на тему/квесты)
//
// Пример использования:
//   const grid = new PagedGrid(scene, {
//     x, y,
//     cols: 3, rows: 2, cellW: 180, cellH: 208, gap: 16,
//     showFrame: true,
//     makeCell: (item, w, h, idx) => makeQuestCard(item, w, h),
//     makeStub: (w,h) => makeEmptySlot(w,h)   // опционально
//   });
//   grid.setItems(npcArray);
//
// Публичные методы:
//   setItems(items)
//   goTo(pageIndex, instant=false)
//   next(), prev()
//   setPosition(x,y), setDepth(d)
//   enableWheel(boolean)
//   destroy()

export default class PagedGrid {
  /** @param {Phaser.Scene} s
   *  @param {{
   *    x?:number, y?:number,
   *    cols:number, rows:number, cellW:number, cellH:number, gap?:number,
   *    showFrame?:boolean,
   *    makeCell:(item:any,w:number,h:number,globalIndex:number)=>Phaser.GameObjects.Container,
   *    makeStub?:(w:number,h:number)=>Phaser.GameObjects.Container,
   *    textStyle?:Phaser.Types.GameObjects.Text.TextStyle,
   *    bgColor?:number, strokeColor?:number
   *  }} opts
   */
  constructor(s, opts){
    this.s = s;
    this.opts = opts || {};
    this.x = opts.x|0; this.y = opts.y|0;

    this.cols   = Math.max(1, opts.cols|0);
    this.rows   = Math.max(1, opts.rows|0);
    this.cellW  = Math.max(8, opts.cellW|0);
    this.cellH  = Math.max(8, opts.cellH|0);
    this.gap    = (opts.gap ?? 16)|0;

    this.pageSize   = this.cols * this.rows;
    this.items      = [];
    this.pageIndex  = 0;
    this._pages     = [];     // контейнеры-страницы
    this._dots      = [];
    this._wheelOn   = true;

    // размеры видимой области (без маски)
    this.vw = this.cols*this.cellW + this.gap*(this.cols-1);
    this.vh = this.rows*this.cellH + this.gap*(this.rows-1);

    // базовые стили/цвета (без зависимости от theme.js)
    this.textStyle = Object.assign({
      fontFamily: 'Inter, Arial, sans-serif',
      fontSize: '18px',
      color: '#c8cfdd'
    }, opts.textStyle || {});
    this.bgColor     = (opts.bgColor ?? 0x121722);
    this.strokeColor = (opts.strokeColor ?? 0x2b3344);

    // корневой контейнер
    this.root = s.add.container(this.x, this.y).setSize(this.vw, this.vh + 28);

    // фон/рамка (по желанию)
    if (opts.showFrame !== false){
      const frame = s.add.graphics();
      frame.fillStyle(this.bgColor, 1).fillRoundedRect(0,0,this.vw,this.vh,14);
      frame.lineStyle(2, this.strokeColor, 1).strokeRoundedRect(0,0,this.vw,this.vh,14);
      this.root.add(frame);
    }

    // область для страниц
    this.wrap = s.add.container(0,0).setSize(this.vw, this.vh);
    this.root.add(this.wrap);

    // стрелки
    this.leftArrow  = s.add.text(-12, this.vh/2, '‹', this.textStyle).setOrigin(1,0.5)
      .setInteractive({useHandCursor:true}).on('pointerup', ()=> this.prev());
    this.rightArrow = s.add.text(this.vw+12, this.vh/2, '›', this.textStyle).setOrigin(0,0.5)
      .setInteractive({useHandCursor:true}).on('pointerup', ()=> this.next());
    this.root.add(this.leftArrow);
    this.root.add(this.rightArrow);

    // wheel по области грида
    this.wrap.setInteractive(new Phaser.Geom.Rectangle(0,0,this.vw,this.vh), Phaser.Geom.Rectangle.Contains);
    this.wrap.on('wheel', (_p,_dx,dy)=> { if (!this._wheelOn) return; (dy>0) ? this.next() : this.prev(); });

    // точки (перерисовываются в _renderDots)
    this._dotsY = this.vh + 6;

    // анимации
    this._fadeIn  = (pg) => this.s.tweens.add({ targets: pg, alpha: 1,  duration: 160, ease: 'Cubic.Out' });
    this._fadeOut = (pg, cb) => this.s.tweens.add({ targets: pg, alpha: 0, duration: 140, ease: 'Cubic.Out', onComplete: cb });
  }

  /* ======= Public API ======= */
  setItems(items){
    this.items = Array.isArray(items) ? items : [];
    this.pageIndex = 0;
    this._buildPages();
    this._updateArrows();
    this._renderDots();
    return this;
  }

  goTo(index, instant=false){
    const total = this._pages.length || 1;
    const next = clamp(index|0, 0, total-1);
    if (next === this.pageIndex) return this;

    const prevPage = this._pages[this.pageIndex];
    const nextPage = this._pages[next];
    nextPage.setVisible(true);

    if (instant){
      if (prevPage){ prevPage.setVisible(false).setAlpha(0); }
      nextPage.setAlpha(1);
    } else {
      if (prevPage) this._fadeOut(prevPage, () => prevPage.setVisible(false));
      this._fadeIn(nextPage);
    }

    this.pageIndex = next;
    this._updateArrows();
    this._highlightDots();
    return this;
  }

  next(){ return this.goTo(this.pageIndex + 1); }
  prev(){ return this.goTo(this.pageIndex - 1); }

  setPosition(x,y){ this.x=x|0; this.y=y|0; this.root?.setPosition(this.x,this.y); return this; }
  setDepth(d){ this.root?.setDepth(d); return this; }
  enableWheel(v=true){ this._wheelOn = !!v; return this; }

  destroy(){
    this.wrap?.removeAll(true);
    this.root?.removeAll(true);
    this._pages.length = 0;
    this._dots.length  = 0;
    this.wrap = null; this.root = null;
  }

  /* ======= Internals ======= */
  _buildPages(){
    // очистка
    this.wrap.removeAll(true);
    this._pages.length = 0;

    const totalPages = Math.max(1, Math.ceil(this.items.length / this.pageSize));
    const makeCell = this.opts.makeCell;
    const makeStub = this.opts.makeStub || ((w,h)=> {
      const g = this.s.add.graphics();
      g.fillStyle(0x0e121b, 1).fillRoundedRect(0,0,this.cellW,this.cellH,12);
      g.lineStyle(2, this.strokeColor, 1).strokeRoundedRect(0,0,this.cellW,this.cellH,12);
      const dash = this.s.add.text(this.cellW/2, this.cellH/2, '—', Object.assign({}, this.textStyle, {color:'#677089'})).setOrigin(0.5);
      return this.s.add.container(0,0,[g,dash]).setSize(this.cellW,this.cellH);
    });

    for (let p=0; p<totalPages; p++){
      const page = this.s.add.container(0,0).setAlpha(0).setVisible(false);
      this.wrap.add(page);
      this._pages.push(page);

      for (let i=0; i<this.pageSize; i++){
        const gi  = p*this.pageSize + i;         // глобальный индекс
        const col = i % this.cols;
        const row = (i / this.cols) | 0;
        const x   = col * (this.cellW + this.gap);
        const y   = row * (this.cellH + this.gap);

        const item = this.items[gi];
        const node = (item !== undefined)
          ? makeCell(item, this.cellW, this.cellH, gi)
          : makeStub(this.cellW, this.cellH);

        node.setPosition(x,y);
        page.add(node);
      }
    }

    // стартовая страница
    const cur = this._pages[this.pageIndex] || this._pages[0];
    cur?.setVisible(true).setAlpha(1);
  }

  _renderDots(){
    // очистка
    this._dots.forEach(d=>d.destroy());
    this._dots.length = 0;

    const total = this._pages.length || 1;
    const cx = (this.vw/2)|0, gap = 12;

    // «умные» точки: всё, если страниц ≤ 7; иначе — 1 … вокруг текущей … N
    const indexes = [];
    if (total <= 7){
      for (let i=0;i<total;i++) indexes.push(i);
    } else {
      indexes.push(0);
      if (this.pageIndex > 2) indexes.push('…');
      for (let i=this.pageIndex-1;i<=this.pageIndex+1;i++){
        if (i>0 && i<total-1) indexes.push(i);
      }
      if (this.pageIndex < total-3) indexes.push('…');
      indexes.push(total-1);
    }

    // центрируем набор
    const n = indexes.length;
    const startX = cx - ((n-1)*gap)/2;

    indexes.forEach((it, k) => {
      const x = startX + k*gap;
      const txt = (it === '…') ? '…' : '•';
      const color = (it === '…') ? '#677089' : (it===this.pageIndex ? '#ffffff' : '#677089');
      const dot = this.s.add.text(x, this._dotsY, txt, Object.assign({}, this.textStyle, {color}))
        .setOrigin(0.5);

      if (it !== '…'){
        dot.setInteractive({useHandCursor:true}).on('pointerup', ()=> this.goTo(it));
      }
      this.root.add(dot);
      this._dots.push(dot);
    });
  }

  _highlightDots(){
    const total = this._pages.length || 1;
    // когда _renderDots делает «умные» точки, проще перерисовать
    this._renderDots();
    this._updateArrows();
  }

  _updateArrows(){
    const total = this._pages.length || 1;
    const atFirst = this.pageIndex <= 0;
    const atLast  = this.pageIndex >= total-1;
    this.leftArrow?.setAlpha(atFirst ? 0.35 : 1);
    this.rightArrow?.setAlpha(atLast  ? 0.35 : 1);
    this.leftArrow?.setInteractive({ useHandCursor: !atFirst });
    this.rightArrow?.setInteractive({ useHandCursor: !atLast  });
  }
}

/* ───── helpers ───── */
function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
