// Компактный HUD «Уровень/XP» слева сверху

export class LevelBadge {
  constructor(scene, progress) {
    this.scene = scene;
    this.progress = progress;

    const M = 12;
    this.x = M;
    this.y = M;
    this.w = 170;
    this.h = 56;

    this.bg = scene.add.graphics().setDepth(940);
    this.bg.fillStyle(0x111522, 0.90).fillRoundedRect(this.x, this.y, this.w, this.h, 14);
    this.bg.lineStyle(2, 0xffffff, 0.18).strokeRoundedRect(this.x, this.y, this.w, this.h, 14);

    this.title = scene.add.text(this.x + 12, this.y + 10, '', {
      fontFamily: 'Arial, sans-serif', fontSize: '15px', color: '#e8f1ff'
    }).setDepth(941).setOrigin(0, 0);

    this.bar = scene.add.graphics().setDepth(941);

    this.update();
  }

// внутри класса LevelBadge, рядом с constructor:
setProgress(progress){
  const fallback = {
    level: 1,
    xp: 0,
    xpNeeded: (lvl) => 100,  // дефолт, чтобы не было деления на 0
  };
  this.progress = (progress && typeof progress.xpNeeded === 'function')
    ? progress
    : fallback;
  return this;
}


  // В src/ui/LevelBadge.js — внутри класса LevelBadge:
setPosition(x, y){
  this.x = x|0; this.y = y|0;

  // перерисовать бэкграунд
  this.bg.clear();
  this.bg.fillStyle(0x111522, 0.90).fillRoundedRect(this.x, this.y, this.w, this.h, 14);
  this.bg.lineStyle(2, 0xffffff, 0.18).strokeRoundedRect(this.x, this.y, this.w, this.h, 14);

  this.title.setPosition(this.x + 12, this.y + 10);
  this.update(); // перерисует прогресс-бар с учётом новых x,y
}


update() {
  const level = this.progress?.level ?? 1;
  const curRaw = this.progress?.xp ?? 0;
  const needRaw = (this.progress && typeof this.progress.xpNeeded === 'function')
    ? this.progress.xpNeeded(level)
    : 100;

  // защита от NaN/0
  const cur  = Math.max(0, Number(curRaw)  || 0);
  const need = Math.max(1, Number(needRaw) || 1);

  this.title.setText(`Ур. ${level}  •  ${cur}/${need} XP`);

  const bx = this.x + 12, by = this.y + 34, bw = this.w - 24, bh = 14;
  this.bar.clear();
  this.bar.fillStyle(0x000000, 0.35).fillRoundedRect(bx, by, bw, bh, 8);
  this.bar.lineStyle(1, 0xffffff, 0.22).strokeRoundedRect(bx, by, bw, bh, 8);

  const fillW = Math.max(0, Math.min(bw, Math.floor((cur / need) * bw)));
  this.bar.fillStyle(0x5ec27a, 1).fillRoundedRect(bx, by, fillW, bh, 8);
}


  pulse() {
    this.scene.tweens.add({
      targets: [this.bg, this.bar, this.title],
      alpha: { from: 1, to: 0.6 },
      duration: 200,
      yoyo: true,
      repeat: 2,
      ease: 'Sine.inOut'
    });
  }
getBounds(){
  // прямоугольник бейджа слева сверху (у тебя x,y,w,h уже есть)
  return new Phaser.Geom.Rectangle(this.x, this.y, this.w, this.h);
}
  destroy() {
    this.bg.destroy(); this.bar.destroy(); this.title.destroy();
  }



}
