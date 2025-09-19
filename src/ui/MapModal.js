// src/ui/MapModal.js
import UI from '../ui/theme.js';
import { LOCATIONS } from '../data/locations.js';

/**
 * openMapModal(scene, {
 *   items?: Array<{id,title,locked?:boolean,lockReason?:string, occupants?:number, capacity?:number}>,
 *   currentId?: string,                // чтобы подсветить "Вы здесь"
 *   onPick?: (locId)=> (void|Promise)  // можно async — модалка покажет "Переход..."
 * })
 * Возвращает { update(items), close() }
 */
export default function openMapModal(scene, { items=null, currentId=null, onPick } = {}) {
  const viaHost = !!scene.modalHost?.open;

  const data = (items && Array.isArray(items) && items.length)
    ? items
    : LOCATIONS.map(l => ({ id:l.id, title:l.title }));

  const build = (container, onClose) =>
    buildMapUI(scene, { items:data, currentId, onPick, container, onClose });

  if (viaHost) {
    const api = scene.modalHost.open((c, mh) => build(c, mh.close));
    return {
      update: (newItems) =>
        api.update?.((c, mh) =>
          buildMapUI(scene, { items:newItems, currentId, onPick, container:c, onClose: mh.close })),
      close: api.close,
    };
  }

  // fallback без ModalHost
  const { width: W, height: H } = scene.scale;
  const overlay = scene.add.rectangle(0,0,W,H,0x000000,0.6)
    .setOrigin(0,0).setInteractive().setDepth(UI.z.map);

  let kill = ()=>{};
  const onClose = () => { kill(); overlay.destroy(); };

  const ui = buildMapUI(scene, { items:data, currentId, onPick, onClose, depthBase: UI.z.map+1 });

  scene.scale.on('resize', onResize);
  overlay.once('destroy', () => scene.scale.off('resize', onResize));
  overlay.once('pointerdown', onClose);

  function onResize() {
    overlay.setSize(scene.scale.width, scene.scale.height);
  }
  kill = () => { ui.destroy(); };

  return {
    update: (newItems) => {
      ui.destroy();
      const ui2 = buildMapUI(scene, { items:newItems, currentId, onPick, onClose, depthBase: UI.z.map+1 });
      kill = () => ui2.destroy();
    },
    close: onClose,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Внутренняя сборка UI
// ─────────────────────────────────────────────────────────────────────────────
function buildMapUI(scene, { items, currentId=null, onPick, container=null, onClose=()=>{}, depthBase=UI.z.modal } = {}) {
  const { width: W, height: H } = scene.scale;
  const PW = Math.min(720, W - 80), PH = Math.min(520, H - 80);

  const add = (go) => { if (container) container.add(go); return go; };

  const panel = add(
    scene.add.rectangle(W/2, H/2, PW, PH, 0x1f2433, 1)
      .setStrokeStyle(2, 0xffffff, 0.25).setDepth(depthBase)
  );

  const title = add(
    scene.add.text(W/2, panel.y - PH/2 + 16, 'Экспедиция', {
      fontFamily:'Arial, sans-serif', fontSize:'22px', color:'#ffffff'
    }).setOrigin(0.5,0).setDepth(depthBase+1)
  );

  // Close
  const btnClose = add(
    scene.add.text(panel.x + PW/2 - 14, panel.y - PH/2 + 10, '✕', {
      fontFamily:'Arial, sans-serif', fontSize:'20px', color:'#ffffff'
    }).setOrigin(1,0).setDepth(depthBase+2).setInteractive({useHandCursor:true})
  );
  btnClose.on('pointerdown', onClose);

  // Поиск
  const searchBoxW = Math.min(340, PW - 160);
  const searchBg = add(
    scene.add.rectangle(panel.x - PW/2 + 16 + searchBoxW/2, title.y + 34, searchBoxW, 30, 0x293149, 1)
      .setStrokeStyle(2, 0xffffff, 0.18).setDepth(depthBase+1)
  );
  const searchText = add(
    scene.add.text(searchBg.x - searchBg.width/2 + 8, searchBg.y, '', {
      fontFamily:'Arial, sans-serif', fontSize:'16px', color:'#dce7ff'
    }).setOrigin(0,0.5).setDepth(depthBase+2)
  );
  const hint = add(
    scene.add.text(searchBg.x + searchBg.width/2, searchBg.y, 'Найди локацию…', {
      fontFamily:'Arial, sans-serif', fontSize:'14px', color:'#8ea0bd'
    }).setOrigin(1,0.5).setDepth(depthBase+2)
  );

  // Список
  const listPad = 16;
  const listH = PH - 100;
  const listTopY = title.y + 58;
  const list = add(scene.add.container(panel.x - PW/2 + listPad, listTopY).setDepth(depthBase+1));

  const maskG = add(scene.add.graphics().setVisible(false).setDepth(depthBase+1));
  maskG.fillRect(panel.x - PW/2 + listPad, listTopY, PW - listPad*2, listH);
  const mask = maskG.createGeometryMask();
  list.setMask(mask);

  const twoCols = (PW >= 560);
  const itemW = twoCols ? (PW - listPad*2 - 10) / 2 : (PW - listPad*2);
  const itemH = 56, gap = 10;

  // Busy слой (когда кликаем по локации)
  const busy = add(scene.add.container(0,0).setDepth(depthBase+10).setVisible(false));
  const busyShade = scene.add.rectangle(panel.x, panel.y, PW, PH, 0x0b0f18, 0.65);
  const busyText  = scene.add.text(panel.x, panel.y, 'Переход…', {
    fontFamily:'Arial, sans-serif', fontSize:'18px', color:'#ffffff'
  }).setOrigin(0.5);
  busy.add([busyShade, busyText]);

  let isBusy = false;
  function setBusy(v, locTitle='') {
    isBusy = !!v;
    busyText.setText(locTitle ? `Переход: ${locTitle}…` : 'Переход…');
    busy.setVisible(isBusy);
  }

  // утилиты
  const occColor = (fill) => {
    if (fill >= 0.85) return 0xff6b6b; // красный
    if (fill >= 0.55) return 0xffd46b; // жёлтый
    return 0x76ff9b; // зелёный
  };

  // рендер
  let ty = 0, minY = 0;
  let filter = '';
  render();

  function render() {
    list.removeAll(true);

    const visible = (items || [])
      .filter(it => {
        if (!filter) return true;
        const f = filter.toLowerCase();
        return (it.title || it.id).toLowerCase().includes(f);
      })
      // чуть удобнее: текущая локация вверх, потом открытые, потом закрытые
      .sort((a,b) => {
        const ac = a.id === currentId ? -1 : 0;
        const bc = b.id === currentId ? -1 : 0;
        if (ac !== bc) return ac - bc;
        const al = a.locked ? 1 : 0;
        const bl = b.locked ? 1 : 0;
        if (al !== bl) return al - bl;
        return (a.title||a.id).localeCompare(b.title||b.id, 'ru');
      });

    visible.forEach((loc, i) => {
      const col = twoCols ? (i % 2) : 0;
      const row = twoCols ? Math.floor(i / 2) : i;
      const x = col * (itemW + 10);
      const y = row * (itemH + gap);

      const r = scene.add.rectangle(x + itemW/2, y + itemH/2, itemW, itemH, 0x36425b, 1)
        .setStrokeStyle(2, 0xffffff, 0.15)
        .setDepth(depthBase+1);

      const name = scene.add.text(r.x - itemW/2 + 12, r.y - 8, loc.title || loc.id, {
        fontFamily:'Arial, sans-serif', fontSize:'18px', color:'#ffffff'
      }).setOrigin(0,0.5).setDepth(depthBase+2);

      // онлайн
      const occN = Math.max(0, loc.occupants|0);
      const capN = Math.max(1, loc.capacity|0 || 100);
      const fill = Math.min(1, occN / capN);

      const barW = 90, barH = 6;
      const barX = r.x + itemW/2 - 12 - barW/2;
      const barY = r.y + 10;

      const occLabel = scene.add.text(r.x + itemW/2 - 12, r.y - 9, `${occN}/${capN}`, {
        fontFamily:'Arial, sans-serif', fontSize:'12px', color:'#a8ffc7'
      }).setOrigin(1,0.5).setDepth(depthBase+2);

      const barBg   = scene.add.rectangle(barX, barY, barW, barH, 0x253249, 1).setOrigin(0.5).setDepth(depthBase+2);
      const barFill = scene.add.rectangle(barX - barW/2, barY, Math.round(barW * fill), barH, occColor(fill), 1)
        .setOrigin(0,0.5).setDepth(depthBase+3);

      // метки состояния
      let tag = null;
      if (loc.id === currentId) {
        tag = scene.add.text(name.x, r.y + 10, 'Вы здесь', {
          fontFamily:'Arial, sans-serif', fontSize:'12px', color:'#c5d2ff'
        }).setOrigin(0,0.5).setDepth(depthBase+2);
        r.setFillStyle(0x2f3a51, 1);
      }

      let lockShade = null, lockText = null;
      const clickable = !loc.locked && loc.id !== currentId;

      if (loc.locked) {
        lockShade = scene.add.rectangle(r.x, r.y, itemW, itemH, 0x0b0f18, 0.5).setDepth(depthBase+3);
        lockText  = scene.add.text(r.x, r.y, loc.lockReason || 'Закрыто', {
          fontFamily:'Arial, sans-serif', fontSize:'14px', color:'#ffb6b6'
        }).setOrigin(0.5).setDepth(depthBase+4);
      } else if (clickable) {
        r.setInteractive({useHandCursor:true});
        r.on('pointerover', () => { if(!isBusy) r.setFillStyle(0x3c4a66,1); });
        r.on('pointerout',  () => { if(!isBusy) r.setFillStyle(0x36425b,1); });
        r.on('pointerdown', async () => {
          if (isBusy) return;
          setBusy(true, loc.title || loc.id);
          try {
            await onPick?.(loc.id);
          } finally {
            // обычно сразу смена сцены; если нет — закроем модалку сами
            onClose();
          }
        });
      }

      list.add([r, name, occLabel, barBg, barFill]);
      if (tag) list.add(tag);
      if (lockShade) list.add(lockShade);
      if (lockText)  list.add(lockText);
    });

    // клампы скролла
    ty = 0;
    minY = Math.min(0, listH - list.getBounds().height - 8);
    list.y = listTopY + ty;
  }

  // «виртуальный» ввод в поиск
  scene.input.keyboard?.on('keydown', (ev) => {
    if (ev.key === 'Escape') return;
    if (ev.key === 'Backspace') {
      filter = filter.slice(0,-1);
    } else if (ev.key.length === 1 && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
      filter += ev.key;
    }
    searchText.setText(filter);
    hint.setVisible(filter.length === 0);
    render();
  });

  // скролл/drag
  const clamp = v => Phaser.Math.Clamp(v, minY, 0);
  function onWheel(_p, _dx, dy) { if (isBusy) return; ty = clamp(ty - dy * 0.8); list.y = listTopY + ty; }
  function onDragMove(p) { if (isBusy || !dragging) return; ty = clamp(ty + (p.y - lastY)); lastY = p.y; list.y = listTopY + ty; }
  function onDragUp() { dragging = false; }
  let dragging = false, lastY = 0;

  scene.input.on('wheel', onWheel, scene);
  scene.input.on('pointermove', onDragMove, scene);
  scene.input.on('pointerup', onDragUp, scene);
  scene.input.on('pointerdown', (p)=>{ 
    if (isBusy) return;
    const b = new Phaser.Geom.Rectangle(panel.x - PW/2 + listPad, listTopY, PW - listPad*2, listH);
    if (Phaser.Geom.Rectangle.Contains(b, p.x, p.y)) { dragging = true; lastY = p.y; }
  }, scene);

  scene.input.keyboard?.once('keydown-ESC', onClose);

  function destroy() {
    panel.destroy(); title.destroy(); btnClose.destroy();
    searchBg.destroy(); searchText.destroy(); hint.destroy();
    list.destroy(); maskG.destroy(); busy.destroy();
    scene.input.off('wheel', onWheel, scene);
    scene.input.off('pointermove', onDragMove, scene);
    scene.input.off('pointerup', onDragUp, scene);
  }

  return { destroy };
}
