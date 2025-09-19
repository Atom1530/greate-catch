// src/ui/Bobber.js
import UI from './theme.js';

export class Bobber {
  constructor(scene, x, y){
    this.s = scene;

    // КУДА КЛАСТЬ ПОПЛАВОК
    // 1) Под всем UI, но над миром/водой:
    const Z_UNDER_UI = (UI?.z?.world ?? 0) + 5;

    // 2) Если вдруг нужно под самой водой (обычно НЕ надо):
    // const Z_UNDER_WATER = -301;

    this.c = scene.add.container(x, y).setDepth(Z_UNDER_UI);

    const g = scene.add.graphics();
    g.fillStyle(0xffffff, 1).fillEllipse(0, -8, 10, 20);
    g.fillStyle(0xff3b3b, 1).fillRect(-2, -18, 4, 10);
    this.c.add(g);

    this.minStandingDepth = 0.45;   // м — мельче этого «ложимся»
    this._tweens = new Set();
    this._shallow = false;
  }

  // удобный сеттер глубины (вдруг понадобится перекинуть)
  setDepth(z){ this.c.setDepth(z); return this; }

  get x(){ return this.c.x; } set x(v){ this.c.x = v; }
  get y(){ return this.c.y; } set y(v){ this.c.y = v; }
  setPosition(x,y){ this.c.setPosition(x,y); }

  setShallow(on){
    if (this._shallow === !!on) return;
    this._shallow = !!on;
    const target = on ? Phaser.Math.DegToRad(65) : 0;
    this.s.tweens.killTweensOf(this.c);
    const tw = this.s.tweens.add({
      targets: this.c, rotation: target, duration: 180, ease: 'Sine.out'
    });
    this._tweens.add(tw);
  }

  startIdleBobbing(){
    this.stopAllTweens();
    const tw = this.s.tweens.add({
      targets: this.c,
      y: { from: this.c.y, to: this.c.y + 3 },
      duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.inOut'
    });
    this._tweens.add(tw);
  }

  biteShake(){
    const baseY = this.c.y;
    this.stopAllTweens();
    const tw = this.s.tweens.add({
      targets: this.c,
      y: { from: baseY, to: baseY + 10 },
      duration: 120, yoyo: true, repeat: 5, ease: 'Sine.inOut',
      onComplete: () => this.startIdleBobbing()
    });
    this._tweens.add(tw);
  }

  stopAllTweens(){
    for (const t of this._tweens){ try{ t.remove(); }catch{} }
    this._tweens.clear();
    this.s.tweens.killTweensOf(this.c);
  }

  destroy(){
    this.stopAllTweens();
    this.c.destroy();
  }
}

export default Bobber;
