import { GearSlots } from './GearSlots.js';
import { HBar } from './HBar.js';

export class BottomHUD {
  constructor(scene, gear, onClick, pullBtnRect){
    this.s = scene;
    const pad = UI.pad, r = UI.radius;

    // геометрия
    const W = scene.scale.width;
    this.h = Math.min(96, Math.floor(W*0.12));               // высота панели
    this.yBottom = scene.scale.height - 12;
    this.yTop = this.yBottom - this.h;
    this.x = 12; this.w = W - 24;

    // общий фон
    this.bg = scene.add.graphics().setDepth(UI.z.bottomHudBg);
    this.bg.fillStyle(UI.color.panel, 0.90);
    this.bg.fillRoundedRect(this.x, this.yTop, this.w, this.h, r);
    this.bg.lineStyle(2, 0xffffff, 0.18);
    this.bg.strokeRoundedRect(this.x, this.yTop, this.w, this.h, r);

    // слоты слева (используем ваш компонент, просто подстраиваем высоту)
    this.slots = new GearSlots(scene, gear, onClick);
    // переиспользуем вычисления слотов, но «впечатываем» в панель
    this.slots.yBottom = this.yBottom - 12; // чуть выше края
    this.slots.yTop = this.slots.yBottom - this.slots.h;
    this.slots._elems.forEach(({bg})=>{
      bg.clear();
      bg.fillStyle(0x111522, 0.0); // фон уже общий
    });

    // правее — две полосы
    const leftX  = this.slots.xs[4] + this.slots.SIZE + 16;
    const rightX = (pullBtnRect?.x ?? (W - 16)) - (pullBtnRect?.width ?? 0)/2 - 12;
    const innerW = Math.max(160, rightX - leftX);
    const barH = 18, spacing = 14;

    this.rodBar  = new HBar(scene, leftX,  this.yBottom - 16 - (barH + spacing), innerW, barH, 'Удочка', { icon:'🎣', depth: UI.z.bars });
    this.lineBar = new HBar(scene, leftX,  this.yBottom - 16,                    innerW, barH, 'Леска',  { icon:'🧵', depth: UI.z.bars });
  }

  setMode(m){ const a = m==='fight'; this.bg.setAlpha(a?0.95:0.6); this.rodBar.setEnabled(a); this.lineBar.setEnabled(a); if(!a){this.rodBar.set(0);this.lineBar.set(0);} }
  set(rod, line){ this.rodBar.set(rod); this.lineBar.set(line); }
  get yTopBars(){ return this.yTop; }
  destroy(){ this.bg.destroy(); this.rodBar.destroy(); this.lineBar.destroy(); /* слоты остаются вашим классом */ }
}
export default BottomHUD;
