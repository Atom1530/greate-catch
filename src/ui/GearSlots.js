// src/ui/GearSlots.js
export class GearSlots {
  /**
   * Универсальный конструктор:
   *  A) new GearSlots(scene, gear, onClick?)
   *  B) new GearSlots(scene, slotsBottom:number, gear)
   */
  constructor(scene, a2, a3) {
    this.scene = scene;

    // разобрать аргументы
    let gear, onClick, slotsBottom;
    if (typeof a2 === 'number') {         // сигнатура B (как у тебя сейчас)
      slotsBottom = a2;
      gear = a3;
      onClick = {};
    } else {                               // сигнатура A (новая)
      gear = a2;
      onClick = a3 || {};
    }
    this.gear = gear || {};
    this.onClick = onClick;

    const W = scene.scale.width;
    const H = scene.scale.height;

    // геометрия и размеры
    this.MARGIN_X = 16;
    this.GAP = 10;
    this.SIZE = Math.min(96, Math.floor((W - this.MARGIN_X * 2 - this.GAP * 4) / 5)); // квадрат
    this.h = this.SIZE;                                // важно: используется снаружи
    this.yBottom = (typeof slotsBottom === 'number') ? slotsBottom : (H - 12);
    this.yTop = this.yBottom - this.h;

    // порядок: как на твоём скрине
    this.items = ['rod', 'reel', 'line', 'hook', 'bait'];
    this.icons = { rod:'🎣', reel:'🎛️', line:'🧵', hook:'🪝', bait:'🪱' };

    // X позиции
    this.xs = [];
    for (let i = 0; i < 5; i++) {
      this.xs.push(this.MARGIN_X + i * (this.SIZE + this.GAP));
    }

    // рендер
    this._elems = [];
    this.items.forEach((key, idx) => {
      const x = this.xs[idx];

      const bg = scene.add.graphics().setDepth(700);
      bg.fillStyle(0x111522, 0.90);
      bg.fillRoundedRect(x, this.yTop, this.SIZE, this.SIZE, 14);
      bg.lineStyle(2, 0xffffff, 0.18);
      bg.strokeRoundedRect(x, this.yTop, this.SIZE, this.SIZE, 14);

      const icon = scene.add.text(x + this.SIZE / 2, this.yTop + 16, this.icons[key], {
        fontFamily: 'Arial, sans-serif', fontSize: '34px', color: '#ffffff'
      }).setOrigin(0.5, 0).setDepth(701);

      const value = scene.add.text(x + this.SIZE / 2, this.yTop + this.SIZE - 22, '', {
        fontFamily: 'Arial, sans-serif', fontSize: '13px', color: '#dfeaff'
      }).setOrigin(0.5, 0).setDepth(701);

      const hit = scene.add.zone(x, this.yTop, this.SIZE, this.SIZE)
        .setOrigin(0, 0).setInteractive().setDepth(702);

      hit.on('pointerdown', () => {
        const fn = this.onClick?.[key];
        if (typeof fn === 'function') fn();
      });

      this._elems.push({ bg, icon, value, hit, key });
    });

    this.update(this.gear);
  }

  update(gearIn) {
    const gear = gearIn || this.gear || {};
    const text = {
      rod:  gear.rod ? `${gear.rod.capKg} кг` : '',
      line: gear.line ? `${gear.line.capKg} кг` : '',
      reel: (gear.reel && (gear.reel.pullBoost != null)) ? `${Math.round((gear.reel.pullBoost)*100)}%` : '',
      hook: (gear.hook && (gear.hook.count != null)) ? `${gear.hook.count} шт` : '',
      bait: `× ${gear.inv?.bait ?? 0}`,
    };
    this._elems.forEach(el => el.value.setText(text[el.key] ?? ''));
  }

  setVisible(v) {
    this._elems.forEach(({ bg, icon, value, hit }) => {
      bg.setVisible(v); icon.setVisible(v); value.setVisible(v); hit.setInteractive(v);
    });
  }
}
