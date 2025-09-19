// src/ui/ProfileModal.js
// Профиль игрока — НОРМАЛЬНАЯ ЦЕНТРАЛЬНАЯ модалка по умолчанию.
// По желанию можно «пришвартовать» к углам через style.anchor.
// API: openProfileModal(scene, { user, progress, style? })

export function openProfileModal(scene, { user = {}, progress, style = {} } = {}) {
  const W = scene.scale.width;
  const H = scene.scale.height;
  const D = 2100;

  // === стиль (дефолты сделаны как для обычной модалки) =======================
  const anchor       = style.anchor || 'center';       // 'center'|'br'|'tr'|'bl'|'tl'
  const margin       = Math.max(8, style.margin ?? 16);
  const overlayAlpha = Math.max(0, Math.min(1, style.overlayAlpha ?? 0.45)); // затемнение по умолчанию есть
  const blockInput   = style.blockInput !== false;     // блокируем клики снаружи (по умолчанию true)
  const panelW       = Math.min(Math.max(420, Math.floor(W * 0.5)), W - margin*2);
  const panelH       = Math.min(300, H - margin*2);

  // === корень
  const root = scene.add.container(0, 0).setDepth(D);

  // === оверлей
  const overlay = scene.add.rectangle(0, 0, W, H, 0x000000, overlayAlpha)
    .setOrigin(0, 0)
    .setScrollFactor(0)
    .setInteractive(); // всегда интерактивен — чтобы поймать клик и не пропускать его под модалку
  root.add(overlay);

  // === контейнер карточки (вся геометрия внутри от (0,0))
  const card = scene.add.container(0, 0);
  root.add(card);

  // позиция по якорю
  const computeXY = () => {
    let x = margin, y = margin;
    if (anchor.includes('r')) x = W - panelW - margin;
    if (anchor.includes('b')) y = H - panelH - margin;
    if (anchor === 'center'){ x = Math.round((W - panelW)/2); y = Math.round((H - panelH)/2); }
    return { x, y };
  };
  const place = () => { const p = computeXY(); card.setPosition(p.x, p.y); overlay.setSize(scene.scale.width, scene.scale.height); };

  // === панель (graphics внутри card, рисуем от (0,0))
  const panel = scene.add.graphics();
  const r = 16;
  const drawPanel = () => {
    panel.clear();
    panel.fillStyle(0x000000, 0.22).fillRoundedRect(3, 4, panelW, panelH, r);   // тень
    panel.fillStyle(0x1f2433, 1).fillRoundedRect(0, 0, panelW, panelH, r);      // тело
    panel.fillStyle(0xffffff, 0.05).fillRoundedRect(0, 0, panelW, 14, r);       // верхний блик
    panel.lineStyle(2, 0xffffff, 0.18).strokeRoundedRect(0, 0, panelW, panelH, r);
  };
  drawPanel();
  card.add(panel);

  // заголовок + закрытие
  const title = scene.add.text(16, 10, 'Профиль игрока', {
    fontFamily:'Arial, sans-serif', fontSize:'18px', color:'#ffffff'
  }).setOrigin(0,0);
  const close = scene.add.text(panelW - 12, 6, '✕', {
    fontFamily:'Arial, sans-serif', fontSize:'22px', color:'#ffffff'
  }).setOrigin(1,0).setInteractive({ useHandCursor:true });
  card.add([title, close]);

  // аватар
  const AV = 72, leftPad = 16, topPad = 44;
  const avCx = leftPad + AV/2, avCy = topPad + AV/2;
  const avG = scene.add.graphics();
  avG.fillStyle(0x0f1522, 1).fillCircle(avCx, avCy, AV/2);
  avG.lineStyle(2, 0xffffff, 0.18).strokeCircle(avCx, avCy, AV/2);
  const initials = String(user.username || user.email || 'Player').trim().slice(0,2).toUpperCase();
  const avTxt = scene.add.text(avCx, avCy, initials, { fontFamily:'Arial, sans-serif', fontSize:'22px', color:'#eaf2ff' })
    .setOrigin(0.5);
  card.add([avG, avTxt]);

  // имя/ID
  const name = user.username || user.email || 'Без имени';
  const id   = user.id ? String(user.id) : '—';
  const nameTxt = scene.add.text(leftPad + AV + 12, topPad + 6, name, {
    fontFamily:'Arial, sans-serif', fontSize:'16px', color:'#ffffff'
  }).setOrigin(0,0.5);
  const idTxt = scene.add.text(nameTxt.x, nameTxt.y + 22, `ID: ${id}`, {
    fontFamily:'Arial, sans-serif', fontSize:'12px', color:'#a9b7d0'
  }).setOrigin(0,0.5);
  card.add([nameTxt, idTxt]);

  // уровень / XP
  const lvl   = progress?.level ?? 1;
  const curXP = progress?.xp ?? 0;
  const need  = (progress && typeof progress.xpNeeded === 'function') ? progress.xpNeeded(lvl) : 100;
  const pct   = Math.max(0, Math.min(1, (Number(curXP)||0) / Math.max(1, Number(need)||1)));

  const infoTitle = scene.add.text(leftPad, topPad + AV + 22,
    `Уровень ${lvl} • ${curXP}/${Math.max(1, need)} XP`, {
      fontFamily:'Arial, sans-serif', fontSize:'13px', color:'#cfe6ff'
    }).setOrigin(0,0.5);
  card.add(infoTitle);

  // xp-бар
  const bx = leftPad, by = infoTitle.y + 16, bw = panelW - leftPad*2, bh = 12;
  const xpG = scene.add.graphics();
  xpG.fillStyle(0x000000, 0.22).fillRoundedRect(bx, by + 2, bw, bh, 8);
  xpG.fillStyle(0x0b1020, 0.96).fillRoundedRect(bx, by, bw, bh, 8);
  xpG.lineStyle(1, 0xffffff, 0.16).strokeRoundedRect(bx, by, bw, bh, 8);
  const fillColor = (pct < 0.5) ? 0x2ecc71 : (pct < 0.85 ? 0xf1c40f : 0xe74c3c);
  xpG.fillStyle(fillColor, 1).fillRoundedRect(bx, by, Math.floor(bw * pct), bh, 8);
  xpG.lineStyle(1, 0xffffff, 0.12);
  [0, 0.5, 1].forEach(t => { const tx = Math.round(bx + bw * t); xpG.beginPath(); xpG.moveTo(tx, by+2); xpG.lineTo(tx, by+bh-2); xpG.strokePath(); });
  card.add(xpG);

  const note = scene.add.text(bx, by + 20, 'Ачивки и статистика — скоро ✨', {
    fontFamily:'Arial, sans-serif', fontSize:'12px', color:'#a9b7d0'
  }).setOrigin(0,0);
  card.add(note);

  // позиционирование/анимация
  place();
  card.setScale(anchor === 'center' ? 0.96 : 1);
  root.setAlpha(0);
  scene.tweens.add({ targets: root, alpha: 1, duration: 120, ease: 'Sine.out' });
  if (anchor === 'center') {
    scene.tweens.add({ targets: card, scale: 1, duration: 160, ease: 'Sine.out' });
  } else {
    // лёгкий выезд из стороны якоря
    const dx = anchor.includes('r') ? 10 : anchor.includes('l') ? -10 : 0;
    const dy = anchor.includes('b') ? 10 : anchor.includes('t') ? -10 : 0;
    card.setPosition(card.x + dx, card.y + dy);
    scene.tweens.add({ targets: card, x: card.x - dx, y: card.y - dy, duration: 160, ease: 'Sine.out' });
  }

  // закрытие
  const cleanup = () => {
    scene.tweens.add({
      targets: [root], alpha: 0, duration: 120, ease: 'Sine.inOut',
      onComplete: () => root.destroy(true)
    });
    scene.scale.off('resize', onResize);
    scene.input.keyboard?.off('keydown-ESC', onEsc);
  };
  const onEsc = e => { e?.preventDefault?.(); cleanup(); };

  overlay.on('pointerdown', (p)=>{
    if (!blockInput) return; // если не блокируем — просто пропускаем
    p?.event?.stopPropagation?.();
    cleanup();
  });
  close.on('pointerdown', (p)=>{ p?.event?.stopPropagation?.(); cleanup(); });
  scene.input.keyboard?.once('keydown-ESC', onEsc);

  // ресайз
  const onResize = () => {
    // обновим размеры сцены и перепозиционируем карточку
    place();
  };
  scene.scale.on('resize', onResize);

  return { destroy: cleanup };
}

export default openProfileModal;
