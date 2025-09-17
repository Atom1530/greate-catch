// src/ui/CatchModals.js
import PhotoBank from '../assets/PhotoBank.js';

// ─────────────────────────────────────────────────────────────────────────────
// Хелперы
// ─────────────────────────────────────────────────────────────────────────────
function _fmtKg(n){ return (n ?? 0).toFixed(3) + ' кг'; }
function _fmtG(n){ return (n ?? 0).toFixed(0) + ' г'; }

function _drawImage(scene, keyOrFrame, box, depth){
  if (keyOrFrame && typeof keyOrFrame === 'object'){
    const { key, frame } = keyOrFrame;
    if (key && scene.textures?.exists(key)){
      const im = scene.add.image(box.x, box.y, key, frame ?? undefined).setDepth(depth);
      const k = Math.min((box.w - 24) / im.width, (box.h - 24) / im.height);
      im.setScale(k); return im;
    }
  }
  const key = (typeof keyOrFrame === 'string') ? keyOrFrame : null;
  if (key && scene.textures?.exists(key)){
    const im = scene.add.image(box.x, box.y, key).setDepth(depth);
    const k = Math.min((box.w - 24) / im.width, (box.h - 24) / im.height);
    im.setScale(k); return im;
  }
  const g = scene.add.graphics().setDepth(depth);
  g.lineStyle(2, 0x6bd1ff, 0.9)
    .strokeRect(box.x - box.w/2 + 8, box.y - box.h/2 + 8, box.w - 16, box.h - 16);
  const left = box.x - box.w/2 + 16, top = box.y - 6;
  g.beginPath();
  for (let i = 0; i < 6; i++){
    const px = left + i * ((box.w - 32) / 5);
    const py = top + (i % 2 ? -16 : 16);
    if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
  }
  g.strokePath();
  return g;
}

function _statLine(scene, x, y, label, value, depth){
  const t1 = scene.add.text(x, y, label, {
    fontFamily:'Arial, sans-serif', fontSize:'15px', color:'#c9d3e7'
  }).setOrigin(0,0).setDepth(depth);
  const t2 = scene.add.text(x, y + 18, value, {
    fontFamily:'Arial, sans-serif', fontSize:'18px', color:'#ffffff'
  }).setOrigin(0,0).setDepth(depth);
  return [t1, t2];
}

function _badge(scene, x, y, text, color, depth){
  const w = Math.max(60, Math.round(text.length * 10 + 22)), h = 24;
  const r = scene.add.rectangle(x, y, w, h, color, 1).setOrigin(0,0.5)
    .setStrokeStyle(2, 0xffffff, 0.16).setDepth(depth);
  const t = scene.add.text(x + 10, y, text, {
    fontFamily:'Arial, sans-serif', fontSize:'13px', color:'#ffffff'
  }).setOrigin(0,0.5).setDepth(depth + 1);
  return [r, t];
}

function _triangleBtn(scene, x, y, dir, depth, size){
  const s = size ?? 40;
  const r = scene.add.rectangle(x, y, s, s, 0x0f141d, 1)
    .setStrokeStyle(2, 0xffffff, 0.12)
    .setDepth(depth).setInteractive({ useHandCursor: true });
  const g = scene.add.graphics().setDepth(depth + 1);
  g.lineStyle(2, 0xffffff, 1);
  const a = Math.round(s * 0.22);
  g.beginPath();
  if (dir === 'left'){ g.moveTo(x + 6, y - a); g.lineTo(x - 6, y); g.lineTo(x + 6, y + a); }
  else               { g.moveTo(x - 6, y - a); g.lineTo(x + 6, y); g.lineTo(x - 6, y + a); }
  g.strokePath();
  r.on('pointerover', ()=> r.setFillStyle(0x172033,1));
  r.on('pointerout',  ()=> r.setFillStyle(0x0f141d,1));
  return [r, g];
}

function _button(scene, x, y, w, label, color, depth, onClick, disabled=false, opts={}){
  const h = opts.h ?? 40, fontSize = opts.fontSize ?? 16;
  const r = scene.add.rectangle(x, y, w, h, color, 1).setOrigin(0.5)
    .setStrokeStyle(2, 0xffffff, 0.18).setDepth(depth);
  const t = scene.add.text(x, y, label, {
    fontFamily:'Arial, sans-serif', fontSize:String(fontSize)+'px', color:'#ffffff'
  }).setOrigin(0.5).setDepth(depth + 1);
  if (!disabled){
    r.setInteractive({ useHandCursor:true })
      .on('pointerover', ()=> {
        const c = Phaser.Display.Color.IntegerToColor(color).darken(10).color;
        r.setFillStyle(c, 1);
      })
      .on('pointerout', ()=> r.setFillStyle(color, 1))
      .on('pointerdown', onClick);
  } else {
    r.setFillStyle(0x4b5568,1).disableInteractive(); t.setColor('#c7c7c7');
  }
  return [r, t];
}

// ─────────────────────────────────────────────────────────────────────────────
// Общий рендер модалки
// entry: { title, name, imageKey, badges[], stats[], info?, actions[], onAction(id), onEsc?(), escAction?, closeDelayMs? }
// idxInfo?: { index,total,onPrev,onNext }
// ─────────────────────────────────────────────────────────────────────────────
function _renderEntry(scene, ui, api, entry, idxInfo){
  const W = scene.scale.width, H = scene.scale.height;
  const PAD = 18, D = 4300;
  const cx = (W/2)|0, cy = (H/2)|0;

  const SCALE = 0.66;
  const PW = Math.min(Math.round(860 * SCALE), W - 80);
  const PH = Math.min(Math.round(520 * SCALE), H - 80);

  const SZ = {
    btnW:     Math.max(120, Math.round(180 * SCALE)),
    btnH:     Math.max(30,  Math.round(40  * SCALE)),
    btnFont:  Math.max(13,  Math.round(16  * SCALE)),
    arrow:    Math.max(28,  Math.round(40  * SCALE)),
    pageFont: Math.max(14,  Math.round(20  * SCALE)),
  };

  const CLOSE_DELAY_MS = entry.closeDelayMs ?? 0;
  let canClose = CLOSE_DELAY_MS <= 0;
  if (!canClose) scene.time.delayedCall(CLOSE_DELAY_MS, ()=> { canClose = true; });

  const tryClose = ()=> { if (!canClose) return; (entry.onEsc ? entry.onEsc() : api.close()); };

  // overlay
  const overlay = scene.add.rectangle(0,0,W,H,0x000000,0)
    .setOrigin(0,0).setDepth(D).setScrollFactor(0).setInteractive();
  // Раньше было ограничение по bottom-120px — убираем, чтобы везде вне панели закрывало
  overlay.on('pointerdown', () => { if (canClose) tryClose(); });

  // panel (как было)
  const shadow = scene.add.rectangle(cx+2, cy+3, PW, PH, 0x000000, 0.22).setDepth(D+1);
  const panel  = scene.add.rectangle(cx, cy, PW, PH, 0x1f2433, 1)
    .setStrokeStyle(2, 0xffffff, 0.22).setDepth(D+1).setInteractive();
  // Важно: клики по панели не должны передаваться в overlay
  panel.on('pointerdown', (_, __, ___, e)=> e?.stopPropagation());

    // ...после panel.on('pointerdown', ...)

  // Геометрия панели (для глобального клика)
  const panelRect = {
    left:  Math.round(cx - PW/2),
    right: Math.round(cx + PW/2),
    top:   Math.round(cy - PH/2),
    bottom:Math.round(cy + PH/2),
  };
  const isInsidePanel = (x, y) =>
    x >= panelRect.left && x <= panelRect.right && y >= panelRect.top && y <= panelRect.bottom;

  // Глобальный ловец клика: если кликнули ВНЕ панели — закрываем (как overlay)
  const onGlobalPointerDown = (pointer) => {
    if (!canClose) return;
    if (!isInsidePanel(pointer.worldX, pointer.worldY)) tryClose();
  };
  scene.input.on('pointerdown', onGlobalPointerDown);

  // Снимем слушатель при закрытии модалки
  const detach = () => { scene.input.off('pointerdown', onGlobalPointerDown); };
  // если кто-то зовёт onEsc (в т.ч. Esc/крестик/overlay), снимем и там
  const prevEsc = entry.onEsc;
  entry.onEsc = () => { try { detach(); } catch {} ; prevEsc ? prevEsc() : api.close(); };
  api.onEsc(() => { try { detach(); } catch {} ; tryClose(); });


  // title + close (✕)
  const title = scene.add.text(cx, cy - PH/2 + 16, entry.title || '', {
    fontFamily:'Arial, sans-serif', fontSize:'26px', color:'#ffffff'
  }).setOrigin(0.5,0).setDepth(D+2);

  const btnClose = scene.add.text(cx + PW/2 - 14, cy - PH/2 + 6, '✕', {
    fontFamily:'Arial, sans-serif', fontSize:'22px', color:'#ffffff'
  })
    .setOrigin(1,0)
    .setDepth(D+3)
    .setInteractive({ useHandCursor:true })
    // Не даём клику уйти в panel/overlay, сразу закрываем
    .on('pointerdown', (pointer, lx, ly, ev) => { ev?.stopPropagation(); tryClose(); });

  ui.add([overlay, shadow, panel, title, btnClose]);


  // сетка
  const innerTop = title.y + 44;
  const innerH   = PH - (innerTop - (cy - PH/2)) - 64;
  const colGap   = 16, leftW = Math.floor((PW - PAD*2 - colGap) * 0.42);
  const rightW   = PW - PAD*2 - colGap - leftW;
  const leftX    = cx - PW/2 + PAD + leftW/2;
  const rightX   = leftX + leftW/2 + colGap + rightW/2;

  const imgBox = { x:leftX, y:Math.round(innerTop + innerH/2) - 8, w:leftW, h:innerH - 12 };
  const imgFrame = scene.add.rectangle(imgBox.x, imgBox.y, imgBox.w, imgBox.h, 0x0f141d, 1)
    .setStrokeStyle(2, 0xffffff, 0.12).setDepth(D+2);
  const imgObj = _drawImage(scene, entry.imageKey, imgBox, D+3);
  ui.add([imgFrame, imgObj]);

  // пагинация (если есть)
  if (idxInfo && idxInfo.total > 1){
    const [lR, lG] = _triangleBtn(scene,
      imgBox.x - imgBox.w/2 + 22, imgBox.y + imgBox.h/2 + 34, 'left', D+3, SZ.arrow);
    const [rR, rG] = _triangleBtn(scene,
      imgBox.x + imgBox.w/2 - 22, imgBox.y + imgBox.h/2 + 34, 'right', D+3, SZ.arrow);
    const pageText = scene.add.text(imgBox.x, imgBox.y + imgBox.h/2 + 34,
      `${idxInfo.index+1}/${idxInfo.total}`, {
      fontFamily:'Arial, sans-serif', fontSize:String(SZ.pageFont)+'px', color:'#ffffff'
    }).setOrigin(0.5).setDepth(D+3);
    ui.add([lR, lG, rR, rG, pageText]);
    lR.on('pointerdown', ()=> idxInfo.onPrev && idxInfo.onPrev());
    rR.on('pointerdown', ()=> idxInfo.onNext && idxInfo.onNext());
  }

  // правая панель
  const rFrame = scene.add.rectangle(rightX, imgBox.y, rightW, imgBox.h, 0x0f141d, 1)
    .setStrokeStyle(2, 0xffffff, 0.12).setDepth(D+2);
  ui.add(rFrame);

  const rx0 = Math.round(rightX - rightW/2) + 16;
  let ry = Math.round(imgBox.y - imgBox.h/2) + 10;

  const nameT = scene.add.text(rx0, ry, entry.name || '', {
    fontFamily:'Arial, sans-serif', fontSize:'22px', color:'#ffffff'
  }).setOrigin(0,0).setDepth(D+3);
  ui.add(nameT); ry += nameT.height + 6;

  (entry.badges || []).forEach((b, i)=> ui.add(_badge(scene, rx0 + i*130, ry + 12, b.text, b.color, D+3)));
  if ((entry.badges || []).length) ry += 38;

  (entry.stats || []).forEach(s => { ui.add(_statLine(scene, rx0, ry, s.label, s.value, D+3)); ry += 36; });

// ...после вывода stats
if (entry.info){
  const infoStr =
    (typeof entry.info === 'string')
      ? entry.info
      : (entry.info?.bio || entry.info?.text || JSON.stringify(entry.info));

  // Лейбл (серый)
  const infoLabel = scene.add.text(rx0 - 2, ry + 10, 'Описание', {
    fontFamily: 'Arial, sans-serif',
    fontSize: '15px',
    color: '#c9d3e7'
  })
  .setOrigin(0, 0)
  .setDepth(D + 3);
  ui.add(infoLabel);

  // Небольшой сдвиг влево для самого текста
  const SHIFT_X = -2; // если нужно сильнее/слабее — поменяй это число
  const wrapW = (rightW - 32) + Math.min(0, SHIFT_X); // сохраняем правую границу

  // Описание (ярко белый) с переносом
  const desc = scene.add.text(rx0 + SHIFT_X, infoLabel.y + infoLabel.height + 4, infoStr, {
    fontFamily: 'Arial, sans-serif',
    fontSize: '15px',
    color: '#ffffff',           // насыщенно-белый
    lineSpacing: 2,
    wordWrap: { width: wrapW, useAdvanced: true }
  })
  .setOrigin(0, 0)
  .setDepth(D + 3);

  // дублируем wrap через API (иногда помогает с кириллицей)
  desc.setWordWrapWidth(wrapW, true);

  ui.add(desc);
  ry = desc.y + desc.height + 8;
}



  const by = Math.round(cy + PH/2 - Math.max(22, Math.round(SZ.btnH/2) + 6));
  const GAP = 12;
  const rightEdge = cx + PW/2 - PAD;
  const actions = entry.actions || [];

  if (actions.length === 1){
    const a  = actions[0];
    const xR = rightEdge - SZ.btnW/2;
    ui.add(_button(scene, xR, by, SZ.btnW, a.label, a.color ?? 0x3b4662, D+3,
                   ()=> entry.onAction && entry.onAction(a.id), !!a.disabled,
                   { h: SZ.btnH, fontSize: SZ.btnFont }));
  } else if (actions.length >= 2){
    const aL = actions[0], aR = actions[1];
    const xR = rightEdge - SZ.btnW/2;
    const xL = xR - (SZ.btnW + GAP);

    ui.add(_button(scene, xL, by, SZ.btnW, aL.label, aL.color ?? 0x2a9d8f, D+3,
                   ()=> entry.onAction && entry.onAction(aL.id), !!aL.disabled,
                   { h: SZ.btnH, fontSize: SZ.btnFont }));

    ui.add(_button(scene, xR, by, SZ.btnW, aR.label, aR.color ?? 0x36425b, D+3,
                   ()=> entry.onAction && entry.onAction(aR.id), !!aR.disabled,
                   { h: SZ.btnH, fontSize: SZ.btnFont }));
  }

  const keyEsc = scene.input.keyboard?.addKey('ESC');
  keyEsc?.once('down', tryClose);
  api.onEsc(tryClose);
}

// ─────────────────────────────────────────────────────────────────────────────
// Построители entry
// ─────────────────────────────────────────────────────────────────────────────
function _pickInfo(obj){
  return obj?.info ?? obj?.meta?.info ?? obj?.spec?.info ?? null;
}

function _entryForFish(fish, mode='catch', { keepnetFull=false } = {}){
  const badges = [];
  if (fish.isPersonalRecord) badges.push({ text:'Личный рекорд', color:0x2a6b3f });
  if (fish.isWorldRecord)    badges.push({ text:'Мировой рекорд', color:0x7341a9 });

  const stats = [];
  stats.push({ label:'Вес', value:(fish.weightKg != null ? _fmtKg(fish.weightKg) : _fmtG(fish.weightG)) });
  if (fish.estimatedPrice != null) stats.push({ label:'Оценивается', value:`${fish.estimatedPrice} мон.` });
  if (fish.baitName)     stats.push({ label:'Наживка',     value: fish.baitName });
  if (fish.locationName) stats.push({ label:'Где поймана', value: fish.locationName });
  if (fish.statusText)   stats.push({ label:'Статус',      value: fish.statusText });

  const imageKey =
    fish.imageKey ||
    (fish.kind && fish.kind !== 'fish'
      ? PhotoBank.key('pick', fish.id)
      : PhotoBank.key('fish', fish.id));

  const info = _pickInfo(fish);

  if (mode === 'catch'){
    return {
      title:'Поймана рыба!',
      name: fish.name || '',
      imageKey, badges, stats, info,
      actions:[
        { id:'keep',    label:'Оставить (XP)',     color:0x2a9d8f, disabled: keepnetFull },
        { id:'release', label:'Отпустить (×2 XP)', color:0x36425b }
      ],
      escAction:'keep', closeDelayMs:600
    };
  }
  return {
    title: fish.name || 'Садок',
    name: fish.name || '',
    imageKey, badges, stats, info,
    actions:[
      { id:'share',   label:'Хвастаться',     color:0x3b4662 },
      { id:'release', label:'Отпустить рыбу', color:0x2a9d8f }
    ],
    escAction:'close', closeDelayMs:0
  };
}

function _entryForLoot(pick, { coins=0 } = {}){
  const stats = [];
  if (coins > 0) stats.push({ label:'Награда', value:`+${coins} монет` });

  const imageKey =
    pick?.tex || pick?.icon || pick?.spriteKey ||
    (pick?.id ? PhotoBank.key('pick', pick.id) : null);

  const info = _pickInfo(pick);

  return {
    title: 'Улов',
    name: pick?.name ?? 'Награда',
    imageKey,
    badges: [],
    stats,
    info,
    actions: [
      { id:'take', label:(coins>0 ? 'Забрать' : 'Ок'), color:0x3b4662 },
      { id:'drop', label:'Выбросить',                  color:0x2a9d8f }
    ],
    escAction: 'take',
    closeDelayMs: 300
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Публичные API
// ─────────────────────────────────────────────────────────────────────────────
export function openFishCatchModal(scene, fish, extra = {}) {
  return new Promise((resolve) => {
    // базовый список (садок + текущая пойманная)
    const baseKeepnet = Array.isArray(extra.keepnet)
      ? extra.keepnet
      : (Array.isArray(scene.keepnet) ? scene.keepnet : []);
    const list = baseKeepnet.slice();
    list.push(fish);
    let idx = list.length - 1;

    const keepnetFull = !!extra.keepnetFull ||
      ((scene.keepnet?.length ?? 0) >= (scene.keepnetCap ?? 0));

    scene.modals.open((ui, api) => {
      let finished = false;


      const finish = (v) => {
        if (finished) return;
        finished = true;
        try { ui.iterate?.(c => c.disableInteractive?.()); } catch {}
        try { resolve(v); } catch {}
        scene.time.delayedCall(0, () => api.close());
      };

      const rerender = () => {
        ui.removeAll?.(true);
        const cur = list[idx];
        const isCatch = (idx === list.length - 1);
        const entry = _entryForFish(cur, isCatch ? 'catch' : 'keepnet', { keepnetFull });

        entry.onAction = (id) => {
          if (isCatch) {
            if (id === 'keep') finish('keep');
            else if (id === 'release') finish('release');
          } else {
            if (id === 'share') {
              scene.showToast?.('Скоро: поделиться трофеем');
            } else if (id === 'release') {
              const removed = baseKeepnet.splice(idx, 1);
              if (removed.length) {
                const iLocal = list.indexOf(removed[0]);
                if (iLocal >= 0) list.splice(iLocal, 1);
              }
              if (idx >= list.length) idx = Math.max(0, list.length - 1);
              scene.keepnet = baseKeepnet;
              scene.keepnetBadge?.set(baseKeepnet.length, scene.keepnetCap ?? 25);
              rerender();
            }
          }
        };

        entry.onEsc = () => finish(isCatch ? 'keep' : 'close');

        _renderEntry(scene, ui, api, entry, {
          index: idx,
          total: list.length,
          onPrev: () => { idx = (idx - 1 + list.length) % list.length; rerender(); },
          onNext: () => { idx = (idx + 1) % list.length; rerender(); }
        });
      };

      rerender();
    });
  });
}


export function openKeepnetModal(scene, keepnet, startIndex = 0){
  const list = Array.isArray(keepnet) ? keepnet : [];
  let idx = Math.max(0, Math.min(startIndex|0, Math.max(0, list.length-1)));

  return new Promise((resolve) => {
    scene.modals.open((ui, api) => {
      let finished = false;
      const finish = (v) => {
        if (finished) return; finished = true;
        try { ui.iterate?.(c => c.disableInteractive?.()); } catch {}
        resolve(v);
        scene.time.delayedCall(0, ()=> api.close());
      };

      const rerender = () => {
        ui.removeAll?.(true);
        const fish = list[idx] || {};
        const e = _entryForFish(fish, 'keepnet');

        e.onAction = (id) => {
          if (id === 'release'){
            const removed = list.splice(idx,1);
            if (removed.length){
              const orig = scene.keepnet || keepnet;
              const iGlobal = orig.indexOf(removed[0]);
              if (iGlobal >= 0) orig.splice(iGlobal,1);
            }
            if (!list.length){ finish({ action:'release', index: idx }); return; }
            if (idx >= list.length) idx = list.length - 1;
            scene.keepnetBadge?.set(list.length, scene.keepnetCap ?? 25);
            rerender();
          } else if (id === 'share'){
            scene.showToast?.('Скоро: поделиться трофеем');
          }
        };
        e.onEsc = () => finish({ action:'close', index: idx });

        _renderEntry(scene, ui, api, e, {
          index: idx,
          total: list.length,
          onPrev: () => { idx = (idx - 1 + list.length) % list.length; rerender(); },
          onNext: () => { idx = (idx + 1) % list.length; rerender(); }
        });
      };
      rerender();
    });
  });
}

export function openLootModal(scene, pick, { coins = 0 } = {}) {
  return new Promise((resolve) => {
    scene.modals.open((ui, api) => {
      let finished = false;


      const finish = (value) => {
        if (finished) return;
        finished = true;
        try { ui.iterate?.(c => c.disableInteractive?.()); } catch {}
        try { resolve(value); } catch {}
        scene.time.delayedCall(0, () => api.close?.());
      };

      const entry = _entryForLoot(pick, { coins });
      entry.onAction = (id) => { if (id === 'take' || id === 'drop') finish(id); };
      entry.onEsc = () => finish(entry.escAction || 'take');

      ui.removeAll?.(true);
      _renderEntry(scene, ui, api, entry, null);
    });
  });
}



