// src/ui/ModalHost.js
export class ModalHost {
  constructor(scene, baseDepth = 2000){
    this.s = scene;
    this.base = baseDepth;
    this.stack = [];

    this.root = scene.add.container(0,0)
      .setDepth(baseDepth)
      .setScrollFactor(0);
    this.root.setVisible(false);

    const W = scene.scale.width, H = scene.scale.height;

    // правильный "проглот" событий
    const swallow = (pointer, _x, _y, event) => {
      const e = event || pointer?.event;
      e?.stopImmediatePropagation?.();
      e?.stopPropagation?.();
    };

    // ОДИН overlay
this.overlay = scene.add.rectangle(0,0,W,H,0x000000,0.6)
  .setOrigin(0,0)
  .setScrollFactor(0)
  .setInteractive()
  .setDepth(baseDepth);

this.overlay.on('pointerdown', swallow);
this.root.add(this.overlay);

    scene.scale.on('resize', () => {
      this.overlay.setSize(scene.scale.width, scene.scale.height);
    });
  }

  // buildFn(container, api)
  open(buildFn, depthOffset = 1){
    this.root.setVisible(true);

    const c = this.s.add.container(0,0); // depth внутри контейнера не важен
    this.root.add(c);

    let closed = false;
    let escCb = null;

    const api = {
      close: () => {
        if (closed) return;
        closed = true;
        this.close(c);
      },
      onEsc: (fn) => { escCb = fn; }
    };

    this.stack.push(c);

    const escOnce = () => {
      if (closed) return;
      if (typeof escCb === 'function') escCb();
      else api.close();
    };
    this.s.input.keyboard?.once('keydown-ESC', escOnce);

    buildFn(c, api);
    return api;
  }

  close(container){
    const i = this.stack.indexOf(container);
    if (i >= 0) this.stack.splice(i,1);
    container?.destroy();
    if (this.stack.length === 0) this.root.setVisible(false);
  }

  destroy(){
    this.root?.destroy();
    this.stack.length = 0;
  }
}
export default ModalHost;
