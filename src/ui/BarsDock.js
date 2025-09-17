// src/ui/BarsDock.js
import { HBar } from './HBar.js';

export class BarsDock {
  constructor(scene, slots, pullBtnRect) {
    this.scene = scene;
    this.slots = slots;

    const gap = 12;
    const leftX  = slots.xs[4] + slots.SIZE + gap;
    const rightX = (pullBtnRect?.x ?? scene.scale.width - 16) - (pullBtnRect?.width ?? 0)/2 - gap;

    this.w = Math.max(160, rightX - leftX);
    this.h = slots.h;
    this.x = leftX;
    this.yTop = slots.yTop;
    this.yBottom = slots.yBottom;

    // фон панели
    this.bg = scene.add.graphics().setDepth(705);
    this.bg.fillStyle(0x111522, 0.90);
    this.bg.fillRoundedRect(this.x, this.yTop, this.w, this.h, 14);
    this.bg.lineStyle(2, 0xffffff, 0.18);
    this.bg.strokeRoundedRect(this.x, this.yTop, this.w, this.h, 14);

    // внутренняя геометрия
    const pad = 16;
    const innerX = this.x + pad;
    const innerRight = this.x + this.w - pad;
    const innerW = Math.max(60, innerRight - innerX);
    const barH = 18;
    const spacing = 14;                // ← больше расстояние между полосами
    const barsBottom = this.yBottom - pad;

    // подпись теперь внутри бара: иконка + короткий текст
    this.rodBar  = new HBar(scene, innerX, barsBottom - (barH + spacing), innerW, barH, 'Удочка', { icon: '🎣', depth: 706 });
    this.lineBar = new HBar(scene, innerX, barsBottom,                    innerW, barH, 'Леска',  { icon: '🧵', depth: 706 });

    this.yTopBars = this.yTop;
  }

  setMode(mode){
    const active = mode === 'fight';
    this.bg.setAlpha(active ? 0.90 : 0.55);
    this.rodBar.setEnabled(active);
    this.lineBar.setEnabled(active);
    if (!active) { this.rodBar.set(0); this.lineBar.set(0); }
  }

  setVisible(v){ this.setMode(v ? 'fight' : 'idle'); } // совместимость
  set(rodVal, lineVal){ this.rodBar.set(rodVal); this.lineBar.set(lineVal); }

  destroy(){ this.bg.destroy(); this.rodBar.destroy(); this.lineBar.destroy(); }
}
