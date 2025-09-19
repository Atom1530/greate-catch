// src/ui/MapButton.js
import UI from './theme.js';

export class MapButton {
  constructor(scene, { onClick } = {}) {
    this.s = scene;
    this.w = 154; this.h = 44;
    this.x = 0; this.y = 0;

    this.c = scene.add.container(0,0).setDepth(UI.z.map);

    const bg = scene.add.graphics();
    bg.fillStyle(0x1a2233, 1).fillRoundedRect(-this.w/2, -this.h/2, this.w, this.h, UI.radius);
    bg.lineStyle(2, 0xffffff, 0.18).strokeRoundedRect(-this.w/2, -this.h/2, this.w, this.h, UI.radius);

    const icon = scene.add.text(-this.w/2 + 12, 0, '🧭', {
      fontFamily:'Arial, sans-serif', fontSize:'18px', color:'#ffffff'
    }).setOrigin(0,0.5);

    const label = scene.add.text(icon.x + 26, 0, 'Экспедиция', {
      fontFamily:'Arial, sans-serif', fontSize:'18px', color:'#e8f1ff'
    }).setOrigin(0,0.5);

    const hit = scene.add.rectangle(0,0,this.w,this.h,0x000000,0.001)
      .setInteractive({ useHandCursor:true });

    hit.on('pointerover', () => {
      bg.clear()
        .fillStyle(0x212a3c, 1).fillRoundedRect(-this.w/2, -this.h/2, this.w, this.h, UI.radius)
        .lineStyle(2, 0xffffff, 0.22).strokeRoundedRect(-this.w/2, -this.h/2, this.w, this.h, UI.radius);
    });
    hit.on('pointerout', () => {
      bg.clear()
        .fillStyle(0x1a2233, 1).fillRoundedRect(-this.w/2, -this.h/2, this.w, this.h, UI.radius)
        .lineStyle(2, 0xffffff, 0.18).strokeRoundedRect(-this.w/2, -this.h/2, this.w, this.h, UI.radius);
    });
    hit.on('pointerdown', () => onClick?.());

    this._bg = bg;
    this._label = label;
    this.c.add([bg, icon, label, hit]);
  }

  setText(t){ this._label?.setText(String(t||'')); }
  setPosition(x,y){ this.x=x|0; this.y=y|0; this.c.setPosition(this.x,this.y); }
  setDepth(d){ this.c.setDepth(d); }
  setVisible(v){ this.c.setVisible(!!v); }
  destroy(){ this.c.destroy(); }
}

export default MapButton;
