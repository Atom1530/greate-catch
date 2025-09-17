// ui/Bobber.js
export class Bobber {
  constructor(scene, x, y){
    this.s = scene;
    this.c = scene.add.container(x, y).setDepth(805);

    // простая «длинная» форма поплавка из Graphics
    const g = scene.add.graphics();
    g.fillStyle(0xffffff, 1).fillEllipse(0, -8, 10, 20);
    g.fillStyle(0xff3b3b, 1).fillRect(-2, -18, 4, 8); // «антенка»
    this.c.add(g);

    this.minStandingDepth = 0.45; // м — мельче этого «ложимся»
    this._tweens = new Set();
  }

  // свойства, чтобы tween/код мог менять x/y
  get x(){ return this.c.x; } set x(v){ this.c.x = v; }
  get y(){ return this.c.y; } set y(v){ this.c.y = v; }

  setPosition(x,y){ this.c.setPosition(x,y); }

  setShallow(isShallow){
    // легкий наклон, если мелко
    this.c.setRotation(isShallow ? Phaser.Math.DegToRad(70) : 0);
  }

  // «покачивание» в ожидании
  startIdleBobbing(){
    this.stopAllTweens();
    const tw = this.s.tweens.add({
      targets: this.c,
      y: { from: this.c.y, to: this.c.y + 6 },
      duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut'
    });
    this._tweens.add(tw);
  }

  // «поклёвка» — быстрая тряска
  biteShake(){
    this.stopAllTweens();
    const tw = this.s.tweens.add({
      targets: this.c,
      y: { from: this.c.y, to: this.c.y + 14 },
      duration: 140, yoyo: true, repeat: 6, ease: 'Sine.inOut',
      onComplete: () => { this.startIdleBobbing(); }
    });
    this._tweens.add(tw);
  }

  stopAllTweens(){
    for (const t of this._tweens){ t.remove(); }
    this._tweens.clear();
    // на всякий — убить любые чужие твины по контейнеру
    this.s.tweens.killTweensOf(this.c);
  }

  destroy(){
    this.stopAllTweens();
    this.c.destroy();
  }



  // прокси для удобства (сцена читает bobber.x/y)
  get x(){ return this.c.x } set x(v){ this.c.x = v }
  get y(){ return this.c.y } set y(v){ this.c.y = v }
}
