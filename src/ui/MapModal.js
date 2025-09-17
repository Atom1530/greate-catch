// src/ui/MapModal.js
import UI from '../ui/theme.js';
import { LOCATIONS } from '../data/locations.js';

export function openMapModal(scene, onPick) {
  const viaHost = !!scene.modalHost?.open;

  if (viaHost) {
    return scene.modalHost.open((c, api) => buildMapUI(scene, onPick, { container:c, onClose: api.close }));
  }

  // fallback без ModalHost
  const { width: W, height: H } = scene.scale;
  const overlay = scene.add.rectangle(0,0,W,H,0x000000,0.6)
    .setOrigin(0,0).setInteractive().setDepth(UI.z.map);

  const cleanup = () => {
    overlay.destroy();
    panel?.destroy(); title?.destroy(); maskG?.destroy(); list?.destroy();
  };

  let panel, title, maskG, list;
  ({ panel, title, maskG, list } = buildMapUI(scene, onPick, { onClose: cleanup, depthBase: UI.z.map+1 }));

  scene.scale.on('resize', onResize);
  overlay.once('destroy', () => scene.scale.off('resize', onResize));
  overlay.once('pointerdown', cleanup);

  function onResize() {
    const W2 = scene.scale.width, H2 = scene.scale.height;
    overlay.setSize(W2, H2);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Внутренняя сборка UI. Работает и с ModalHost (через container), и автономно.
// ─────────────────────────────────────────────────────────────────────────────
function buildMapUI(scene, onPick, { container=null, onClose=()=>{}, depthBase=UI.z.modal } = {}) {
  const { width: W, height: H } = scene.scale;
  const PW = Math.min(680, W - 80), PH = Math.min(480, H - 80);

  const add = (go) => {
    if (container) container.add(go);
    return go;
  };

  const panel = add(
    scene.add.rectangle(W/2, H/2, PW, PH, 0x1f2433, 1)
      .setStrokeStyle(2, 0xffffff, 0.25).setDepth(depthBase)
  );

  const title = add(
    scene.add.text(W/2, panel.y - PH/2 + 18, 'Экспедиция — выбери локацию', {
      fontFamily:'Arial, sans-serif', fontSize:'22px', color:'#ffffff'
    }).setOrigin(0.5,0).setDepth(depthBase+1)
  );

  // список (скролл + маска)
  const listPad = 18;
  const listH = PH - 86;
  const listY = title.y + 40;
  const list = add(scene.add.container(panel.x - PW/2 + listPad, listY).setDepth(depthBase+1));

  const maskG = add(scene.add.graphics().setVisible(false).setDepth(depthBase+1));
  maskG.fillRect(panel.x - PW/2 + listPad, listY, PW - listPad*2, listH);
  const mask = maskG.createGeometryMask();
  list.setMask(mask);

  const twoCols = (PW >= 520);
  const itemW = twoCols ? (PW - listPad*2 - 10) / 2 : (PW - listPad*2);
  const itemH = 44, gap = 10;

  LOCATIONS.forEach((loc, i) => {
    const col = twoCols ? (i % 2) : 0;
    const row = twoCols ? Math.floor(i / 2) : i;
    const x = col * (itemW + 10);
    const y = row * (itemH + gap);

    const r = add(
      scene.add.rectangle(x + itemW/2, y + itemH/2, itemW, itemH, 0x36425b, 1)
        .setStrokeStyle(2, 0xffffff, 0.15)
        .setInteractive()
        .setDepth(depthBase+1)
    );
    const t = add(
      scene.add.text(r.x, r.y, loc.title, {
        fontFamily:'Arial, sans-serif', fontSize:'18px', color:'#ffffff'
      }).setOrigin(0.5).setDepth(depthBase+1)
    );

    r.on('pointerover', () => r.setFillStyle(0x3c4a66,1));
    r.on('pointerout',  () => r.setFillStyle(0x36425b,1));
    r.on('pointerdown', () => { onClose(); onPick?.(loc.id); });

    list.add([r, t]);
  });

  // скролл колесом и перетаскиванием (через окно сцены)
  let ty = 0;
  const minY = Math.min(0, listH - list.getBounds().height - 8);
  const clamp = v => Phaser.Math.Clamp(v, minY, 0);

  scene.input.on('wheel', onWheel, this);
  scene.input.on('pointermove', onDragMove, this);
  scene.input.on('pointerup', onDragUp, this);

  let dragging = false, lastY = 0;
  function onWheel(_p, _dx, dy) { ty = clamp(ty - dy * 0.8); list.y = listY + ty; }
  function onDragMove(p) { if (!dragging) return; ty = clamp(ty + (p.y - lastY)); lastY = p.y; list.y = listY + ty; }
  function onDragUp() { dragging = false; }
  scene.input.on('pointerdown', (p)=>{ 
    // проверим, попали ли внутрь списка
    const b = new Phaser.Geom.Rectangle(panel.x - PW/2 + listPad, listY, PW - listPad*2, listH);
    if (Phaser.Geom.Rectangle.Contains(b, p.x, p.y)) { dragging = true; lastY = p.y; }
  });

  // ESC закрывает
  scene.input.keyboard?.once('keydown-ESC', onClose);

  // вернуть ручки для fallback-чистки
  return { panel, title, maskG, list };
}
