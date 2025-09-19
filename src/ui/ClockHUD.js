// src/ui/ClockHUD.js
export class ClockHUD {
  constructor(scene, timeCycle, opts = {}){
    this.s = scene; this.tc = timeCycle;
    this.depth = opts.depth ?? 955;

    this.ringR = opts.ringR ?? 14;
    this.ringTh = opts.ringTh ?? 4;
    this.padX = 12; this.padY = 8;

    this.colors = {
      dawn:  { panel: 0x263148, stroke: 0xffffff, strokeA: 0.18, ring: 0xffc76b, time: '#ffffff', sub: '#ffe6b3', icon:'🌅', label:'РАССВЕТ' },
      day:   { panel: 0x2a3144, stroke: 0xffffff, strokeA: 0.18, ring: 0xffd166, time: '#ffffff', sub: '#a7ffeb', icon:'☀',  label:'ДЕНЬ'    },
      dusk:  { panel: 0x23293d, stroke: 0xffffff, strokeA: 0.18, ring: 0xff9d66, time: '#ffffff', sub: '#ffc9a1', icon:'🌆', label:'ЗАКАТ'   },
      night: { panel: 0x1a1f31, stroke: 0xffffff, strokeA: 0.18, ring: 0x87a6ff, time: '#ffffff', sub: '#cfd8dc', icon:'🌙', label:'НОЧЬ'    },
    };

    this.root = this.s.add.container(0,0).setDepth(this.depth);
    this.gPanel = this.s.add.graphics().setDepth(this.depth); this.root.add(this.gPanel);
    this.gRing  = this.s.add.graphics().setDepth(this.depth+1); this.root.add(this.gRing);

    this.icon   = this.s.add.text(0,0,'☀',{ fontFamily:'Arial, sans-serif', fontSize:'18px', color:'#ffffff' })
      .setOrigin(0,0.5).setDepth(this.depth+2);
    this.timeTxt= this.s.add.text(0,0,'00:00',{ fontFamily:'Arial, sans-serif', fontSize:'20px', color:'#ffffff' })
      .setOrigin(0,0.5).setDepth(this.depth+2);
    this.subTxt = this.s.add.text(0,0,'ДЕНЬ',{ fontFamily:'Arial, sans-serif', fontSize:'12px', color:'#a7ffeb' })
      .setOrigin(0,0.5).setDepth(this.depth+2);

    this.root.add([this.icon,this.timeTxt,this.subTxt]);

    this.lastClock=''; this.lastPhase=null; this.w=180; this.h=40;
    this._applyStyle('day'); this._layout(); this.update(true);

    // сохраняем ссылку, чтобы потом отписаться
    this._onResize = () => this._redrawPanel();
    scene.scale.on('resize', this._onResize);

    // авто-чистка при закрытии сцены
    scene.events.once('shutdown', () => {
      try { scene.scale.off('resize', this._onResize); } catch {}
      this.destroy();
    });
  }

  destroy(){
    this.gPanel?.destroy(); this.gRing?.destroy();
    this.icon?.destroy(); this.timeTxt?.destroy(); this.subTxt?.destroy();
    this.root?.destroy();
  }
  setPosition(x,y){ this.root.setPosition(Math.round(x), Math.round(y)); }
  getBounds(){ return new Phaser.Geom.Rectangle(this.root.x - this.w/2, this.root.y - this.h/2, this.w, this.h); }

  _applyStyle(phase){
    const C = this.colors[phase] || this.colors.day;
    this.curStyle = C;
    this.icon?.setText(C.icon);
    this.timeTxt?.setColor(C.time);
    this.subTxt?.setColor(C.sub);
    this.subTxt?.setText(C.label);
    this._redrawPanel();
  }
  _redrawPanel(){
    const g = this.gPanel;
    if (!g || !g.scene) return; // графика уже уничтожена
    const C = this.curStyle || this.colors.day;
    g.clear();
    g.fillStyle(C.panel, 1); g.lineStyle(2, C.stroke, C.strokeA);
    g.fillRoundedRect(-this.w/2, -this.h/2, this.w, this.h, 14);
    g.strokeRoundedRect(-this.w/2, -this.h/2, this.w, this.h, 14);
  }
  _layout(){
    if (!this.icon || !this.timeTxt || !this.subTxt) return;
    const ringSize = (this.ringR + this.ringTh) * 2;
    let x = -this.w/2 + this.padX;
    this.ringX = x + this.ringR + this.ringTh; this.ringY = 0; x += ringSize + 8;
    this.icon.setPosition(x, 0); x += Math.max(18, this.icon.width) + 8;
    this.timeTxt.setPosition(x, 0); x += this.timeTxt.width + 10;
    this.subTxt.setPosition(x, 0);

    const right = this.subTxt.x + this.subTxt.width;
    const contentW = (right + this.padX) - (-this.w/2);
    this.w = Math.max(170, Math.ceil(contentW)); this.h = 40;
    this._redrawPanel();
  }
  _drawRing(pct){
    const g = this.gRing;
    if (!g || !g.scene) return;
    const C = this.curStyle || this.colors.day;
    g.clear();
    g.lineStyle(this.ringTh, 0xffffff, 0.15);
    g.beginPath(); g.arc(this.ringX, this.ringY, this.ringR, -Math.PI/2, -Math.PI/2 + Math.PI*2, false); g.strokePath();
    const end = -Math.PI/2 + Math.PI*2 * Phaser.Math.Clamp(pct, 0, 1);
    g.lineStyle(this.ringTh, C.ring, 1);
    g.beginPath(); g.arc(this.ringX, this.ringY, this.ringR, -Math.PI/2, end, false); g.strokePath();
  }

  // ——— безопасный апдейт, который не трогает текст без валидной текстуры ———
  update(force=false){
    // сцена ещё активна?
    if (!this.s || !this.s.sys || !this.s.sys.isActive()) return;

    if (!this.tc?.getInfo) return;
    const info = this.tc.getInfo(); // { clock, phase, pct24, ... }

    const t = this.timeTxt;
    // у Phaser.Text должна быть CanvasTexture + валидный frame.source.image
    const canTouchText =
      t && t.active && !t.destroyed &&
      t.texture && t.texture.canvas &&
      t.frame && t.frame.source && t.frame.source.image;

    if (canTouchText && (force || info.clock !== this.lastClock)){
      this.lastClock = info.clock;
      t.setText(info.clock);
      this._layout();
    }

    if (force || info.phase !== this.lastPhase){
      this.lastPhase = info.phase;
      this._applyStyle(info.phase);
    }

    this._drawRing(info.pct24);
  }
}
