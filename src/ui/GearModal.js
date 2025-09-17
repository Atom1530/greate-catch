// src/ui/GearModal.js
export class GearModal {
  constructor(scene, kind, list, activeId, onPick, onClose) {
    this.scene = scene;
    this.kind = kind;
    this.list = list || [];
    this.activeId = activeId || null;
    this.onPick = onPick;
    this.onClose = onClose;
    this.killed = false;

    this.depthBase = 2000;

    this.build();
    this.layout(); // первая раскладка
    this.bindResize();
  }

  build() {
    const s = this.scene;
    const W = s.scale.width, H = s.scale.height;

    // затемнение
    this.overlay = s.add.rectangle(0, 0, W, H, 0x000000, 0.6)
      .setOrigin(0, 0)
      .setDepth(this.depthBase)
      .setInteractive();

    // панель
    this.panel = s.add.rectangle(0, 0, 560, 380, 0x242a36, 1)
      .setStrokeStyle(2, 0xffffff, 0.22)
      .setDepth(this.depthBase + 1);

    // заголовок
    const titleText = ({
      rod:  'Удочки',
      reel: 'Катушки',
      line: 'Лески',
      hook: 'Крючки'
    })[this.kind] || 'Экипировка';

    this.title = s.add.text(0, 0, titleText, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '24px',
      color: '#ffffff'
    }).setOrigin(0.5, 0).setDepth(this.depthBase + 2);

    // кнопка закрытия
    this.btnClose = s.add.text(0, 0, '✕', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '22px',
      color: '#ffffff'
    }).setOrigin(0.5, 0).setDepth(this.depthBase + 2).setInteractive();

    this.btnClose.on('pointerdown', () => this.close());

    // контейнер для списка
    this.listContainer = s.add.container(0, 0).setDepth(this.depthBase + 2);

    // создаём строки списка
    this.rows = [];
    this.list.forEach((it, i) => {
      const row = this.buildRow(it);
      this.rows.push(row);
      this.listContainer.add([row.bg, row.name, row.sub, row.tick]);
    });
  }

  buildRow(it) {
    const s = this.scene;
    const rowH = 56;

    // заглушечные координаты – реальные проставим в layout()
    const cx = 0, cy = 0;

    const bg = s.add.rectangle(cx, cy, 100, rowH, 0x3a4558, 1)
      .setStrokeStyle(2, 0xffffff, this.activeId === it.id ? 0.35 : 0.18)
      .setInteractive();

    // hover
    bg.on('pointerover', () => bg.setFillStyle(0x425066, 1));
    bg.on('pointerout',  () => bg.setFillStyle(0x3a4558, 1));

    // выбор
    bg.on('pointerdown', () => {
      if (this.killed) return;
      this.pick(it);
    });

    // название слева
    const name = s.add.text(0, 0, it.name || '—', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '18px',
      color: '#ffffff'
    }).setOrigin(0, 0.5);

    // подпись/характеристика
    const subTxt =
      this.kind === 'rod'  ? `Прочность: ${it.capKg} кг` :
      this.kind === 'line' ? `Прочность: ${it.capKg} кг` :
      this.kind === 'reel' ? `Тяга: ${(it.pullBoost*100).toFixed(0)}%` :
      this.kind === 'hook' ? `Контроль: ${(it.control*100).toFixed(0)}%` : '';
    const sub = s.add.text(0, 0, subTxt, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px',
      color: '#d6deea'
    }).setOrigin(0, 0.5);

    // отметка активного
    const tick = s.add.text(0, 0, this.activeId === it.id ? '✓' : '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '18px',
      color: '#7ddc7a'
    }).setOrigin(1, 0.5);

    return { bg, name, sub, tick, rowH, it };
  }

  layout() {
    const s = this.scene;
    const W = s.scale.width, H = s.scale.height;

    // размеры панели
    const panelW = Math.min(560, W - 120);
    const panelH = Math.min(380, H - 160);
    this.panel.setSize(panelW, panelH);
    this.panel.setPosition(W / 2, H / 2);

    // заголовок
    this.title.setPosition(this.panel.x, this.panel.y - panelH / 2 + 18);

    // крестик
    this.btnClose.setPosition(this.panel.x + panelW / 2 - 22, this.panel.y - panelH / 2 + 8);

    // контент-зона
    const pad = 18;
    const areaLeft   = this.panel.x - panelW / 2 + pad;
    const areaTop    = this.panel.y - panelH / 2 + 62;
    const areaWidth  = panelW - pad * 2;
    const rowGap     = 8;

    // выровнять каждую строку ПО ШИРИНЕ ПАНЕЛИ (а не экрана)
    let y = areaTop;
    this.rows.forEach(r => {
      r.bg.setSize(areaWidth, r.rowH);
      r.bg.setPosition(areaLeft + areaWidth / 2, y + r.rowH / 2);

      // тексты внутри строки
      const textLeft = areaLeft + 14;
      r.name.setPosition(textLeft, r.bg.y - 8);
      r.sub.setPosition(textLeft, r.bg.y + 12);

      // галочка справа
      r.tick.setPosition(areaLeft + areaWidth - 12, r.bg.y);

      y += r.rowH + rowGap;
    });

    // overlay растянуть
    this.overlay.setSize(W, H);
  }

  pick(def) {
    // визуально переключаем галочку/рамку
    this.rows.forEach(r => {
      const active = r.it.id === def.id;
      r.tick.setText(active ? '✓' : '');
      r.bg.setStrokeStyle(2, 0xffffff, active ? 0.35 : 0.18);
    });

    // вызов колбэка и закрытие
    try { this.onPick && this.onPick(def); } catch(e){}
    this.close();
  }

  bindResize() {
    this._onResize = () => {
      if (!this.killed) this.layout();
    };
    this.scene.scale.on('resize', this._onResize);
  }

  close() {
    if (this.killed) return;
    this.killed = true;

    // уничтожить всё
    [this.overlay, this.panel, this.title, this.btnClose].forEach(g => g && g.destroy());
    if (this.rows) {
      this.rows.forEach(r => {
        r.bg.destroy(); r.name.destroy(); r.sub.destroy(); r.tick.destroy();
      });
      this.rows.length = 0;
    }
    if (this.listContainer) this.listContainer.destroy(true);

    // снять слушатель resize
    if (this._onResize) this.scene.scale.off('resize', this._onResize);

    // уведомить сцену
    try { this.onClose && this.onClose(); } catch(e){}
  }
}

export default GearModal;
