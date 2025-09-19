// src/ui/HBar.js
// Новый стиль v2: цвет по значению (зелёный → жёлтый → красный),
// улучшенный «канал», метки 0/50/100, мягкая тень, доработанный пузырь значения.
// API полностью совместим (класс/сигнатуры те же). Доп. опции необязательны.

export class HBar {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} xLeft
   * @param {number} yBottom
   * @param {number} width
   * @param {number} height
   * @param {string} label
   * @param {{
   *   icon?: string,
   *   depth?: number,
   *   maxVisualW?: number,
   *   align?: 'left'|'center'
   * }} [opts]
   */
  constructor(scene, xLeft, yBottom, width, height, label, opts = {}) {
    this.scene = scene;

    // Геометрия (вход)
    this.x = Math.round(xLeft);
    this.yBottom = Math.round(yBottom);
    this.w = Math.round(width);
    this.h = Math.round(height);

    // Состояние
    this.value = 0;              // 0..100
    this.enabled = false;
    this.threshold = 80;         // % порога
    this.icon = opts.icon || '';
    this.depth = opts.depth ?? 706;

    // Доп. настройки стиля
    this.maxVisualW = Math.max(160, Math.round(opts.maxVisualW ?? 440));
    this.align = opts.align || 'left';

    // Палитра/токены
    this.colors = {
      labelBg: 0x111a2a,
      labelStroke: 0xffffff,
      railBg: 0x0b1020,
      railTopSheen: 0xffffff,
      railStroke: 0xffffff,
      tick: 0xffffff,
      text: '#e8f1ff',
      // базовые точки для интерполяции
      safe: 0x2ecc71,    // зелёный
      warn: 0xf1c40f,    // жёлтый
      danger: 0xe74c3c   // красный
    };

    // Графика и тексты
    this.g = scene.add.graphics().setDepth(this.depth);
    this.text = scene.add.text(0, 0, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '13px',
      color: this.colors.text,
      fontStyle: 'bold'
    }).setDepth(this.depth + 2);

    // Значение в «пузыре»
    this.valText = scene.add.text(0, 0, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '12px',
      color: '#e6eeff'
    }).setDepth(this.depth + 3).setOrigin(0.5, 0.5);

    // мелкие подписи 0 / 50 / 100
    this.t0 = scene.add.text(0, 0, '0', { fontFamily:'Arial, sans-serif', fontSize:'10px', color:'#b8c6e3' })
      .setDepth(this.depth + 1).setOrigin(0.5, 0);
    this.t50 = scene.add.text(0, 0, '50', { fontFamily:'Arial, sans-serif', fontSize:'10px', color:'#b8c6e3' })
      .setDepth(this.depth + 1).setOrigin(0.5, 0);
    this.t100 = scene.add.text(0, 0, '100', { fontFamily:'Arial, sans-serif', fontSize:'10px', color:'#b8c6e3' })
      .setDepth(this.depth + 1).setOrigin(0.5, 0);

    // Кэш
    this._last = { x:-1, y:-1, w:-1, h:-1, value:-1, enabled:null, thr:-1, label:'' };
    this._labelCache = label ?? '';

    // Первичный рендер
    this._layoutAndDraw(0);
  }

  // === Публичное API (совместимо) ============================================
  setThreshold(pct){
    const np = Phaser.Math.Clamp(pct, 1, 99);
    if (np === this.threshold) return;
    this.threshold = np;
    this._layoutAndDraw(this.value);
  }
  setEnabled(on){
    const en = !!on;
    if (this.enabled === en) return;
    this.enabled = en;
    this._layoutAndDraw(this.value);
  }
  set(v){
    const val = Phaser.Math.Clamp(v, 0, 100);
    if (val === this.value) return;
    this.value = val;
    this._layoutAndDraw(val);
  }
  setVisible(vis){
    this.g.setVisible(vis); this.text.setVisible(vis); this.valText.setVisible(vis);
    this.t0.setVisible(vis); this.t50.setVisible(vis); this.t100.setVisible(vis);
  }
  destroy(){
    this.g?.destroy(); this.text?.destroy(); this.valText?.destroy();
    this.t0?.destroy(); this.t50?.destroy(); this.t100?.destroy();
  }

  // Нежно добавленные методы для лайаута (часто вызываются снаружи)
  setPosition(xLeft, yBottom){
    const nx = Math.round(xLeft), ny = Math.round(yBottom);
    if (this.x === nx && this.yBottom === ny) return;
    this.x = nx; this.yBottom = ny;
    this._layoutAndDraw(this.value);
  }
  setWidth(w){
    const nw = Math.max(140, Math.round(w));
    if (this.w === nw) return;
    this.w = nw;
    this._layoutAndDraw(this.value);
  }
  setLabel(label){
    const s = String(label ?? '');
    if (s === this._labelCache) return;
    this._labelCache = s;
    this._layoutAndDraw(this.value);
  }

  // === Внутреннее =============================================================
  _mix(c1, c2, t){
    // линейная интерполяция цветов 0xRRGGBB
    const r1 = (c1 >> 16) & 255, g1 = (c1 >> 8) & 255, b1 = c1 & 255;
    const r2 = (c2 >> 16) & 255, g2 = (c2 >> 8) & 255, b2 = c2 & 255;
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    return (r << 16) | (g << 8) | b;
  }
  _colorFor(val){
    // 0..50 → зелёный→жёлтый, 50..100 → жёлтый→красный
    if (val <= 50){
      const t = val / 50; // 0..1
      return this._mix(this.colors.safe, this.colors.warn, t);
    } else {
      const t = (val - 50) / 50; // 0..1
      return this._mix(this.colors.warn, this.colors.danger, Math.min(1, t));
    }
  }

  _layout(){
    const x = this.x, yBottom = this.yBottom, w = this.w, h = this.h;

    const labelW = Math.max(96, Math.round(h * 3.1));
    const gap = Math.max(8, Math.round(h * 0.36));
    const railH = Math.max(14, Math.min(h - 8, 22));
    const railR = Math.floor(railH / 2);

    const availW = Math.max(120, w - labelW - gap);
    const railW = Math.min(this.maxVisualW, availW);

    let railX;
    if (this.align === 'center') {
      const left = x + labelW + gap;
      railX = left + Math.floor((availW - railW) / 2);
    } else {
      railX = x + labelW + gap;
    }

    const labelX = x;
    const labelY = yBottom - h;
    const railY = yBottom - Math.floor((h - railH) / 2) - railH;

    const thrX = Math.round(railX + railW * (this.threshold / 100));
    const val = Phaser.Math.Clamp(this.value, 0, 100);
    const fillW = Math.max(2, Math.round(railW * (val / 100)));
    const bubbleX = Math.min(railX + fillW, railX + railW);
    const bubbleY = railY + railH / 2;

    // позиции меток 0/50/100
    const tick0X = railX;
    const tick50X = Math.round(railX + railW * 0.5);
    const tick100X = railX + railW;

    return {
      label: { x: labelX, y: labelY, w: labelW, h },
      rail:  { x: railX, y: railY, w: railW, h: railH, r: railR },
      thrX,
      bubble: { x: bubbleX, y: bubbleY },
      ticks: { x0: tick0X, x50: tick50X, x100: tick100X }
    };
  }

  _layoutAndDraw(v){
    const cache = this._last;
    if (cache.x === this.x && cache.y === this.yBottom &&
        cache.w === this.w && cache.h === this.h &&
        cache.value === v && cache.enabled === this.enabled &&
        cache.thr === this.threshold && cache.label === this._labelCache) return;

    this._last = {
      x: this.x, y: this.yBottom, w: this.w, h: this.h,
      value: v, enabled: this.enabled, thr: this.threshold, label: this._labelCache
    };

    const L = this._layout();
    const g = this.g;
    g.clear();

    // === 1) Капсула-лейбл ===
    const labelRadius = Math.min(18, Math.floor(L.label.h/2));
    g.fillStyle(this.colors.labelBg, this.enabled ? 0.98 : 0.9);
    g.fillRoundedRect(L.label.x, L.label.y, L.label.w, L.label.h, labelRadius);
    // лёгкая внутренняя полоса внизу
    g.fillStyle(0x000000, 0.10);
    g.fillRoundedRect(L.label.x, L.label.y + L.label.h - 6, L.label.w, 6, labelRadius);
    g.lineStyle(2, this.colors.labelStroke, this.enabled ? 0.18 : 0.12);
    g.strokeRoundedRect(L.label.x, L.label.y, L.label.w, L.label.h, labelRadius);

    // иконка+лейбл
    const labelPad = Math.max(10, Math.floor(this.h * 0.24));
    this.text.setText(`${this.icon ? this.icon + ' ' : ''}${this._labelCache || ''}`);
    this.text.setPosition(L.label.x + labelPad, L.label.y + L.label.h / 2);
    this.text.setOrigin(0, 0.5);

    // === 2) Рельса (канал) ===
    // тень-«плита» под рельсой
    g.fillStyle(0x000000, 0.22);
    g.fillRoundedRect(L.rail.x, L.rail.y + 3, L.rail.w, L.rail.h, L.rail.r);

    g.fillStyle(this.colors.railBg, this.enabled ? 0.97 : 0.86);
    g.fillRoundedRect(L.rail.x, L.rail.y, L.rail.w, L.rail.h, L.rail.r);
    g.lineStyle(2, this.colors.railStroke, this.enabled ? 0.13 : 0.10);
    g.strokeRoundedRect(L.rail.x, L.rail.y, L.rail.w, L.rail.h, L.rail.r);

    // верхний глянец (чуть тоньше)
    const glossH = Math.max(1, Math.floor(L.rail.h * 0.22));
    g.fillStyle(this.colors.railTopSheen, this.enabled ? 0.06 : 0.04);
    g.fillRoundedRect(L.rail.x, L.rail.y, L.rail.w, glossH, Math.min(L.rail.r, Math.floor(glossH/2)));

    // деления крупнее на 0/50/100 + тонкие каждые 10%
    g.lineStyle(1, this.colors.tick, 0.10);
    for (let t = 10; t < 100; t += 10){
      const tx = Math.round(L.rail.x + L.rail.w * (t/100));
      g.beginPath(); g.moveTo(tx, L.rail.y + 2); g.lineTo(tx, L.rail.y + L.rail.h - 2); g.strokePath();
    }
    // жирнее на ключевых
    g.lineStyle(1, this.colors.tick, 0.22);
    [0, 50, 100].forEach((t) => {
      const tx = Math.round(L.rail.x + L.rail.w * (t/100));
      g.beginPath(); g.moveTo(tx, L.rail.y + 1); g.lineTo(tx, L.rail.y + L.rail.h - 1); g.strokePath();
    });

    // подписи 0/50/100
    this.t0.setPosition(L.ticks.x0, L.rail.y + L.rail.h + 2);
    this.t50.setPosition(L.ticks.x50, L.rail.y + L.rail.h + 2);
    this.t100.setPosition(L.ticks.x100, L.rail.y + L.rail.h + 2);

    // === 3) Заполнение с динамическим цветом ===
    const val = Phaser.Math.Clamp(this.value, 0, 100);
    const fillW = Math.max(2, Math.round(L.rail.w * (val / 100)));
    const fillColor = this._colorFor(val);
    g.fillStyle(fillColor, this.enabled ? 1.0 : 0.8);
    g.fillRoundedRect(L.rail.x, L.rail.y, fillW, L.rail.h, Math.min(L.rail.r, Math.floor(fillW/2)));

    // лёгкая «ткань» внутри заполнения
    if (fillW > 28) {
      g.lineStyle(1, 0xffffff, this.enabled ? 0.06 : 0.04);
      const step = 6;
      for (let sx = L.rail.x - L.rail.h; sx < L.rail.x + fillW; sx += step){
        g.beginPath();
        g.moveTo(sx, L.rail.y + L.rail.h);
        g.lineTo(sx + L.rail.h, L.rail.y);
        g.strokePath();
      }
    }

    // === 4) Порог — шеврон и треугольник ===
    if (this.enabled) {
      const tx = L.thrX;
      g.lineStyle(1, 0xffffff, 0.30);
      g.beginPath(); g.moveTo(tx, L.rail.y + 1); g.lineTo(tx, L.rail.y + L.rail.h - 1); g.strokePath();

      g.fillStyle(0xffffff, 0.18);
      g.beginPath();
      g.moveTo(tx, L.rail.y - 4);
      g.lineTo(tx - 4, L.rail.y + 2);
      g.lineTo(tx + 4, L.rail.y + 2);
      g.closePath(); g.fillPath();
    }

    // === 5) Пузырь значения (с указателем) ===
    const bubbleR = Math.max(7, Math.floor(this.h * 0.30));
    const bubbleW = bubbleR * 2 + 12;
    const bubbleH = bubbleR * 2;
    const bx = Math.min(L.bubble.x, L.rail.x + L.rail.w - 2);
    const by = L.bubble.y;

    // хвостик-указатель
    g.fillStyle(0x111a2a, this.enabled ? 0.98 : 0.9);
    g.beginPath();
    g.moveTo(bx, by);            // кончик
    g.lineTo(bx - 8, by - 6);
    g.lineTo(bx - 8, by + 6);
    g.closePath();
    g.fillPath();

    // тело пузыря
    g.fillRoundedRect(bx - bubbleW, by - bubbleH/2, bubbleW, bubbleH, bubbleR);
    g.lineStyle(1, 0xffffff, 0.18);
    g.strokeRoundedRect(bx - bubbleW, by - bubbleH/2, bubbleW, bubbleH, bubbleR);

    // текст значения
    this.valText.setText(`${val|0}%`);
    this.valText.setPosition(bx - bubbleW/2, by);

    // Если очень высокий уровень — лёгкий ореол (без твинов и таймеров)
    if (this.enabled && val >= 90) {
      g.fillStyle(0xff0000, 0.05);
      g.fillRoundedRect(L.rail.x - 4, L.rail.y - 3, L.rail.w + 8, L.rail.h + 6, L.rail.r + 2);
    }
  }
}
