// Простая прогрессия: XP за рыбу, уровни, сохранение в localStorage

export class Progress {
  constructor(scene) {
    this.scene = scene;
    this.level = 1;
    this.xp = 0;        // текущий прогресс до следующего уровня
    this.totalXp = 0;   // суммарный XP за всё время
    this.load();
  }

  // Сколько нужно XP на следующий уровень
  xpNeeded(level) {
    // мягкая кривуля: растёт плавно
    return Math.floor(5 * Math.pow(level, 1.35));
  }

  // Мультипликатор по редкости
  static rarityMult(rarity) {
    if (rarity === 'rare') return 2.0;
    if (rarity === 'uncommon') return 1.4;
    return 1.0; // common
  }

  // Базовый XP за рыбу
  xpForFish(fish) {
    const w = Math.max(0, fish?.weightKg || 0);
    const rarity = fish?.species?.rarity || 'common';
    const base = 5 + 10 * w;                    // вес решает
    const mult = Progress.rarityMult(rarity);   // редкость умножает
    return Math.round(base * mult);
  }

  // Выдача XP с учётом «отпустил = x2»
  grantCatchXP(fish, { released = false } = {}) {
    const base = this.xpForFish(fish);
    const gain = released ? base * 2 : base;
    return this.addXp(gain);
  }

  // Добавить XP (обработать апы)
  addXp(amount) {
    let add = Math.max(0, Math.floor(amount || 0));
    this.totalXp += add;

    let leveled = 0;
    while (add > 0) {
      const need = this.xpNeeded(this.level) - this.xp;
      if (add >= need) {
        add -= need;
        this.level += 1;
        this.xp = 0;
        leveled += 1;
      } else {
        this.xp += add;
        add = 0;
      }
    }

    this.save();
    return { leveled, level: this.level, xp: this.xp, toNext: this.xpNeeded(this.level) };
  }

  save() {
    try {
      localStorage.setItem('rf.progress', JSON.stringify({
        level: this.level, xp: this.xp, totalXp: this.totalXp
      }));
    } catch (e) {}
  }

  load() {
    try {
      const raw = localStorage.getItem('rf.progress');
      if (raw) {
        const o = JSON.parse(raw);
        this.level = o.level || 1;
        this.xp = o.xp || 0;
        this.totalXp = o.totalXp || 0;
      }
    } catch (e) {}
  }
}
