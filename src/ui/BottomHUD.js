// src/ui/BottomHUD.js
import UI from './theme.js';
import { GearSlots } from './GearSlots.js';
import { HBar } from './HBar.js';

export class BottomHUD {
  constructor(scene, gear, onClick, pullBtnRect){
    this.s = scene;
    this.gear = gear;
    this.onClick = onClick || {};
    this.pullBtnRect = pullBtnRect || { x: scene.scale.width - 16, width: 128 };

    // геометрия панели
    this._computeGeom();

    // фон под «стекло» (ниже слотов/баров)
    const Z_BG = Math.min(UI.z.slots ?? 700, UI.z.bars ?? 705) - 1;
    this.bg = scene.add.graphics().setDepth(Z_BG);

    // отрисовать фон
    this._redrawBg();

    // слоты слева (их фон лучше не дублировать — делаем прозрачными)
    this.slots = new GearSlots(scene, gear, this.onClick);
    this.slots.yBottom = this.yBottom - 12;
    this.slots.yTop = this.slots.yBottom - this.slots.h;
    // уберём плотные плитки у слотов — фон панели общий, стеклянный
    this.slots._elems?.forEach(({ bg }) => { try { bg?.clear?.(); } catch(_){} });

    // правее — две полосы
    const { leftX, innerW, barH, y1, y2 } = this._barsFrame();
    this.rodBar  = new HBar(scene, leftX, y1, innerW, barH, 'Удочка', { icon:'🎣', depth: UI.z.bars });
    this.lineBar = new HBar(scene, leftX, y2, innerW, barH, 'Леска',   { icon:'🧵', depth: UI.z.bars });

    // флаги/состояния
    this._enabled = false;

    // ресайз
    this._boundLayout = this.layout.bind(this);
    scene.scale.on('resize', this._boundLayout);
  }

  // ==== публичное API ====
  setMode(m){
    const active = (m === 'fight');
    this._enabled = active;
    // НИКАКОЙ форс-альфы — панель всегда стеклянная
    this.rodBar?.setEnabled?.(active);
    this.lineBar?.setEnabled?.(active);
    if (!active){ this.rodBar?.set?.(0); this.lineBar?.set?.(0); }
  }
  set(rod, line){ this.rodBar?.set?.(rod); this.lineBar?.set?.(line); }
  get yTopBars(){ return this.yTop; }

  destroy(){
    this.s.scale.off('resize', this._boundLayout);
    this.bg?.destroy();
    this.rodBar?.destroy?.();
    this.lineBar?.destroy?.();
    // this.slots?.destroy?.();
  }

  // ==== внутреннее ====
  _computeGeom(){
    const W = this.s.scale.width;
    this.h = Math.min(96, Math.floor(W * 0.12));  // высота панели
    this.yBottom = this.s.scale.height - 12;
    this.yTop = this.yBottom - this.h;
    this.x = 12; this.w = W - 24;                 // «естественная» ширина (до выреза под кнопку)
  }

  _rightSafeX(){
    // край, ДО которого можно рисовать фон, оставляя место под правую кнопку «Тянуть»
    const W = this.s.scale.width;
    const px = (this.pullBtnRect?.x ?? (W - 16));
    const half = (this.pullBtnRect?.width ?? 0) / 2;
    const gap = (UI.layout?.pull?.outerPad ?? 18);
    return Math.max(this.x + 160, Math.round(px - half - gap)); // не сжимаем панель меньше 160
  }

  _redrawBg(){
    const r = UI.radius ?? 12;
    const safeRight = this._rightSafeX();
    const drawW = Math.max(160, Math.min(this.w, safeRight - this.x)); // вырез справа

    // чистим
    this.bg.clear();

    // тень под панелью (мягкая)
    this.bg.fillStyle(0x000000, 0.18);
    this.bg.fillRoundedRect(this.x, this.yTop + 3, drawW, this.h, r);

    // САМА ПАНЕЛЬ — настоящая «стеклянная» (тёмная, очень прозрачная)
    const GLASS = 0x0c1220;          // глубокий тёмно-синий
    this.bg.fillStyle(GLASS, 0.16);  // 0.12–0.18 — видно фон
    this.bg.fillRoundedRect(this.x, this.yTop, drawW, this.h, r);

    // лёгкий верхний «блик»
    const shineH = Math.max(10, Math.floor(this.h * 0.35));
    this.bg.fillStyle(0xffffff, 0.06);
    this.bg.fillRoundedRect(this.x, this.yTop, drawW, shineH, r);

    // тонкий внутренний хайлайт
    this.bg.lineStyle(2, 0xffffff, 0.08);
    this.bg.strokeRoundedRect(this.x + 1, this.yTop + 1, drawW - 2, this.h - 2, Math.max(1, r - 1));

    // лёгкая внешняя обводка (для читаемости на светлой воде)
    this.bg.lineStyle(2, 0x000000, 0.10);
    this.bg.strokeRoundedRect(this.x, this.yTop, drawW, this.h, r);
  }

  _barsFrame(){
    const leftX  = this.slots?.xs?.[4] != null
      ? (this.slots.xs[4] + this.slots.SIZE + 16)
      : (this.x + 5*64 + 16); // запасной вариант, если xs нет

    // правый край для баров тот же safeRight
    const rightX = this._rightSafeX();
    const innerW = Math.max(160, rightX - leftX);

    const barH = 18, spacing = 14;
    const y1 = this.yBottom - 16 - (barH + spacing);
    const y2 = this.yBottom - 16;
    return { leftX, innerW, barH, y1, y2 };
  }

  layout(){
    // пересчитать геометрию и перерисовать фон (с вырезом справа под кнопку)
    this._computeGeom();
    this._redrawBg();

    // обновить «уровень» слотов
    if (this.slots){
      this.slots.yBottom = this.yBottom - 12;
      this.slots.yTop = this.slots.yBottom - this.slots.h;
    }

    // сдвинуть полосы
    const { leftX, innerW, y1, y2 } = this._barsFrame();

    if (typeof this.rodBar?.setPosition === 'function'){
      this.rodBar.setPosition(leftX, y1);
      if (typeof this.rodBar.setWidth === 'function') this.rodBar.setWidth(innerW);
    }
    if (typeof this.lineBar?.setPosition === 'function'){
      this.lineBar.setPosition(leftX, y2);
      if (typeof this.lineBar.setWidth === 'function') this.lineBar.setWidth(innerW);
    }
  }
}

export default BottomHUD;
