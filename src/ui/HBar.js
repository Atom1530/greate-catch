// src/ui/HBar.js
export class HBar {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} xLeft
   * @param {number} yBottom
   * @param {number} width
   * @param {number} height
   * @param {string} label
   * @param {{ icon?: string, depth?: number }} [opts]
   */
  constructor(scene, xLeft, yBottom, width, height, label, opts = {}) {
    this.scene = scene;
    this.x = Math.round(xLeft);
    this.yBottom = Math.round(yBottom);
    this.w = Math.round(width);
    this.h = Math.round(height);
    this.value = 0;
    this.enabled = false;
    this.threshold = 80;
    this.icon = opts.icon || '';
    this.depth = opts.depth ?? 706;

    this.colors = {
      bg: 0x0f1524,
      border: 0xffffff,
      fillIdle: 0x9aa0a6,
      fillSafe: 0x2ecc71,
      fillDanger: 0xe67e22
    };

    this.g = scene.add.graphics().setDepth(this.depth);

    // Подпись ВНУТРИ бара (слева-центр)
    this.text = scene.add.text(
      this.x + 10,
      this.yBottom - this.h / 2,
      `${this.icon ? this.icon + ' ' : ''}${label}`,
      {
        fontFamily: 'Arial, sans-serif',
        fontSize: '13px',
        color: '#e8f1ff',
        fontStyle: 'bold'
      }
    ).setOrigin(0, 0.5).setDepth(this.depth + 2);

    this.draw(0);
  }

  setThreshold(pct){ this.threshold = Phaser.Math.Clamp(pct, 1, 99); this.draw(this.value); }
  setEnabled(on){ this.enabled = !!on; this.text.setAlpha(this.enabled ? 1 : 0.75); this.draw(this.value); }
  set(v){ this.value = Phaser.Math.Clamp(v, 0, 100); this.draw(this.value); }
  setVisible(vis){ this.g.setVisible(vis); this.text.setVisible(vis); }
  destroy(){ this.g?.destroy(); this.text?.destroy(); }

  draw(v) {
    const { g, x, yBottom, w, h, threshold } = this;
    const r = Math.floor(h / 2);
    const val = Phaser.Math.Clamp(v, 0, 100);

    g.clear();

    // Фон-«пилюля»
    g.fillStyle(this.colors.bg, this.enabled ? 0.85 : 0.6);
    g.fillRoundedRect(x, yBottom - h, w, h, r);
    g.lineStyle(2, this.colors.border, this.enabled ? 0.22 : 0.15);
    g.strokeRoundedRect(x, yBottom - h, w, h, r);

    // Заполнение
    const fillW = Math.max(2, Math.round(w * (val / 100)));
    const danger = val >= threshold;
    const fillColor = this.enabled ? (danger ? this.colors.fillDanger : this.colors.fillSafe) : this.colors.fillIdle;
    g.fillStyle(fillColor, this.enabled ? 1.0 : 0.7);
    const fillR = Math.min(r, Math.floor(fillW / 2));
    g.fillRoundedRect(x, yBottom - h, fillW, h, fillR);

    // Лёгкий глянец
    const glossH = Math.max(1, Math.floor(h * 0.35));
    g.fillStyle(0xffffff, this.enabled ? 0.08 : 0.05);
    g.fillRoundedRect(x, yBottom - h, fillW, glossH, fillR);

    // Едва заметный маркер порога (только в бою)
    if (this.enabled) {
      const tx = Math.round(x + w * (threshold / 100));
      g.lineStyle(1, 0xffffff, 0.28);
      g.beginPath(); g.moveTo(tx, yBottom - h + 2); g.lineTo(tx, yBottom - 2); g.strokePath();
    }
  }
}
