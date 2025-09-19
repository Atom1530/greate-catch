// src/ui/PlayerCard.js
// Компактная карточка игрока с круговым XP-кольцом и бережными анимациями.
// API сохранён. Добавлены: setVisible(v), setDepth(z). Все твины убираются в destroy().

import { openProfileModal } from './ProfileModal.js';

export class PlayerCard {
  constructor(scene, { progress, user, onOpen } = {}) {
    this.s = scene;
    this.progress = progress;
    this.user = user || {};
    this.onOpen = onOpen;

    this.x = 12;
    this.y = 12;
    this.w = 236;     // ширина карточки
    this.h = 68;      // ниже: убрали линейный бар

    this._tw = [];    // ссылки на твины для корректного destroy

    this.root = scene.add.container(this.x, this.y).setDepth(940);

    // --- Фон-плитка (двухслойная, с тенью) ---
    this.bg = scene.add.graphics();
    this._drawBg();
    this.root.add(this.bg);

    // --- Аватар с кольцом XP ---
    const AV = 48;
    this._AV = AV;
    const avX = 12 + AV / 2;
    const avY = Math.round((this.h - AV) / 2) + AV / 2;

    this.avCircle = scene.add.graphics();
    this.avRing   = scene.add.graphics();
    this.avCircle.setPosition(avX, avY);
    this.avRing.setPosition(avX, avY);

    // круглая «капсула» аватара
    this.avCircle.clear();
    this.avCircle.fillStyle(0x0f1522, 1);
    this.avCircle.fillCircle(0, 0, AV / 2);
    this.avCircle.lineStyle(2, 0xffffff, 0.18).strokeCircle(0, 0, AV / 2);

    // инициалы
    const initials = String(this.user.username || this.user.email || 'P').trim().slice(0, 2).toUpperCase();
    this.avTxt = scene.add.text(avX, avY, initials, {
      fontFamily: 'Arial, sans-serif', fontSize: '16px', color: '#eaf2ff'
    }).setOrigin(0.5);

    // --- Имя + mini-инфо (всё справа от аватара) ---
    const left = 12 + AV + 12;
    this.nameT = scene.add.text(left, avY - 14, this.user.username || this.user.email || 'Player', {
      fontFamily: 'Arial, sans-serif', fontSize: '15px', color: '#ffffff'
    }).setOrigin(0, 0.5);

    this.lvlT = scene.add.text(left, avY + 10, '', {
      fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#a9b7d0'
    }).setOrigin(0, 0.5);

    // Процент внутри кольца (над инициалами не рисуем; покажем ниже имени)
    this.pctT = scene.add.text(left + 110, avY + 10, '', {
      fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#cfe6ff'
    }).setOrigin(1, 0.5);

    // --- Интерактив/клики ---
    const hit = scene.add.zone(0, 0, this.w, this.h)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });

    hit.on('pointerover', () => {
      const t = this.s.tweens.add({
        targets: [this.root],
        y: this.y - 2,
        duration: 120,
        ease: 'Sine.out'
      });
      this._tw.push(t);
    });
    const hoverOut = () => {
      const t = this.s.tweens.add({
        targets: [this.root],
        y: this.y,
        duration: 140,
        ease: 'Sine.inOut'
      });
      this._tw.push(t);
    };
    hit.on('pointerout', hoverOut);
    hit.on('pointerup', hoverOut);

    hit.on('pointerdown', () => {
      if (typeof this.onOpen === 'function') this.onOpen();
      else openProfileModal(this.s, { user: this.user, progress: this.progress });
    });

    this.root.add([
      this.avCircle, this.avRing, this.avTxt,
      this.nameT, this.lvlT, this.pctT,
      hit
    ]);

    this.update(true);
  }

  // --- Публичное API ---
  setPosition(x, y){
    this.x = x|0; this.y = y|0;
    this.root.setPosition(this.x, this.y);
    this.update(true);
  }
  setUser(user){
    this.user = user || {};
    this.nameT.setText(this.user.username || this.user.email || 'Player');
    const initials = String(this.user.username || this.user.email || 'P').trim().slice(0, 2).toUpperCase();
    this.avTxt.setText(initials);
  }
  setProgress(progress){
    this.progress = progress;
    this.update(true);
  }
  setVisible(v){ this.root.setVisible(!!v); }
  setDepth(z){ this.root.setDepth(z|0); }

  // --- Рендер ---
  _drawBg(){
    const r = 14;
    this.bg.clear();
    // тень
    this.bg.fillStyle(0x000000, 0.18);
    this.bg.fillRoundedRect(0, 3, this.w, this.h, r);
    // тело
    this.bg.fillStyle(0x111522, 0.92);
    this.bg.fillRoundedRect(0, 0, this.w, this.h, r);
    // верхний блик
    this.bg.fillStyle(0xffffff, 0.06);
    this.bg.fillRoundedRect(0, 0, this.w, 10, r);
    // обводка
    this.bg.lineStyle(2, 0xffffff, 0.16).strokeRoundedRect(0, 0, this.w, this.h, r);
  }

  _ringColor(p){
    // p: 0..1 — зелёный → жёлтый → красный
    if (p <= 0.5){
      // 0..0.5
      const t = p / 0.5;
      return Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(0x2ecc71),
        Phaser.Display.Color.ValueToColor(0xf1c40f),
        100, Math.round(t*100)
      );
    } else {
      const t = (p - 0.5) / 0.5;
      return Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(0xf1c40f),
        Phaser.Display.Color.ValueToColor(0xe74c3c),
        100, Math.round(t*100)
      );
    }
  }

  _drawRing(pct){
    // pct: 0..1
    const g = this.avRing;
    const R = this._AV / 2 + 2;
    const t = Math.max(2, Math.floor(this._AV * 0.12));
    const start = Phaser.Math.DegToRad(-90);
    const end = start + Phaser.Math.PI2 * Phaser.Math.Clamp(pct, 0, 1);

    g.clear();
    // рельса
    g.lineStyle(t, 0x223047, 1);
    g.beginPath();
    g.arc(0, 0, R, 0, Phaser.Math.PI2, false);
    g.strokePath();

    // цвет заливки по проценту
    const ic = this._ringColor(pct);
    const col = Phaser.Display.Color.GetColor(ic.r, ic.g, ic.b);

    // заливка
    g.lineStyle(t, col, 1);
    g.beginPath();
    g.arc(0, 0, R, start, end, false);
    g.strokePath();
  }

  update(silent = false){
    const lvl   = this.progress?.level ?? 1;
    const curXP = this.progress?.xp ?? 0;
    const need  = (this.progress && typeof this.progress.xpNeeded === 'function') ? this.progress.xpNeeded(lvl) : 100;

    // подписи справа
    this.lvlT.setText(`Ур. ${lvl} • ${curXP}/${Math.max(1, need)} XP`);

    const pct = Math.max(0, Math.min(1, (Number(curXP)||0) / Math.max(1, Number(need)||1)));
    this.pctT.setText(`${Math.round(pct*100)}%`);

    // анимация кольца
    if (!silent){
      const t2 = this.s.tweens.addCounter({
        from: this._lastRingPct ?? 0,
        to: pct,
        duration: 300,
        ease: 'Sine.inOut',
        onUpdate: (tw) => this._drawRing(tw.getValue())
      });
      this._tw.push(t2);
    } else {
      this._drawRing(pct);
    }
    this._lastRingPct = pct;
  }

  destroy(){
    try { this._tw.forEach(t => t?.remove?.()); } catch {}
    this._tw = [];
    this.root?.destroy(true);
  }
}

export default PlayerCard;
