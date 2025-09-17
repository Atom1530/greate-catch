// src/ui/KeepnetBadge.js
export class KeepnetBadge {
  constructor(scene, capacity = 25, onClick = null) {
    this.scene = scene;
    this.capacity = capacity;
    this.count = 0;
    this.onClick = onClick;

    const W = scene.scale.width;
    const M = 12;

    this.w = 108; this.h = 64;
    this.x = W - M - this.w;
    this.y = M;

    this.bg = scene.add.graphics().setDepth(950);
    this.bg.fillStyle(0x111522, 0.88);
    this.bg.fillRoundedRect(this.x, this.y, this.w, this.h, 14);
    this.bg.lineStyle(2, 0xffffff, 0.18);
    this.bg.strokeRoundedRect(this.x, this.y, this.w, this.h, 14);

    this.icon = scene.add.text(this.x + 18, this.y + this.h/2, '🧺', {
      fontFamily:'Arial, sans-serif', fontSize:'24px', color:'#ffffff'
    }).setOrigin(0,0.5).setDepth(951);

    this.label = scene.add.text(this.x + this.w - 14, this.y + this.h/2, '0/25', {
      fontFamily:'Arial, sans-serif', fontSize:'18px', color:'#e8f1ff'
    }).setOrigin(1,0.5).setDepth(951);

    // интеракт
    this.zone = scene.add.zone(this.x, this.y, this.w, this.h).setOrigin(0,0)
      .setDepth(952).setInteractive();
    if (onClick) this.zone.on('pointerdown', onClick);
  }
  // В src/ui/KeepnetBadge.js — добавить внутрь класса:
setPosition(x, y){
  this.x = x|0; this.y = y|0;

  // перерисовать фон на новых координатах
  this.bg.clear();
  this.bg.fillStyle(0x111522, 0.88);
  this.bg.fillRoundedRect(this.x, this.y, this.w, this.h, 14);
  this.bg.lineStyle(2, 0xffffff, 0.18);
  this.bg.strokeRoundedRect(this.x, this.y, this.w, this.h, 14);

  // сдвинуть элементы
  this.icon.setPosition(this.x + 18, this.y + this.h/2);
  this.label.setPosition(this.x + this.w - 14, this.y + this.h/2);
  this.zone.setPosition(this.x, this.y);
}


  set(count, capacity = this.capacity){
    this.count = count; this.capacity = capacity;
    this.label.setText(`${count}/${capacity}`);
  }

  setVisible(v){
    [this.bg,this.icon,this.label,this.zone].forEach(o=>o.setVisible(v));
    this.zone.setInteractive(v);
  }

  setOnClick(fn){
    this.zone.removeAllListeners(); this.onClick = fn;
    if (fn) this.zone.on('pointerdown', fn);
  }
}
