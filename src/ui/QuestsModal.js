// src/ui/QuestsModal.js
import UI from './theme.js';
import ModalHost from './ModalHost.js';
import PagedGrid from './PagedGrid.js';
import { getAllNPC } from '../data/QuestDB.js';
import { QuestState } from '../quests/QuestState.js';
import { grantReward } from '../quests/QuestRewards.js';

/* ───────────────────────── Публичный API ───────────────────────── */
export function openQuestsModal(scene){
  const host = ensureModalHost(scene);
  new QuestsModal(scene, host).open();
}

/* ───────────────────────── internals ───────────────────────── */
function ensureModalHost(scene){
  if (!scene.__modalHost) {
    const baseDepth = (UI.z?.modal ?? 2000);
    scene.__modalHost = new ModalHost(scene, baseDepth);
  }
  return scene.__modalHost;
}

/* ============================================================== *
 *   КВЕСТЫ: окно + грид на PagedGrid, детали в отдельной модалке *
 * ============================================================== */
class QuestsModal {
  /** @param {Phaser.Scene} s @param {ModalHost} host */
  constructor(s, host){
    this.s = s; this.host = host;

    // layout
    this.cols = 3;
    this.rows = 2;
    this.gap  = 16;
    this.headerH = 48;
    this.pad = 18;
    this.cardTargetW = 180;
    this.cardTargetH = 208;

    // вычисляется в _measure()
    this.cardW = 0; this.cardH = 0;
    this.vw = 0; this.vh = 0;
    this.winW = 0; this.winH = 0;
    this.x0 = 0; this.y0 = 0;

    // refs
    this.root = null;
    this.grid = null;

    // handlers
    this._resizeHandler = null;
    this._keyLeft = null;
    this._keyRight = null;
  }

  open(){
    const api = this.host.open((root, modalApi) => {
      this.root = root;

      this._measure();
      this._buildWindow();
      this._buildGrid();

      // данные
      this.grid.setItems(getAllNPC());

      this.s.input?.setTopOnly?.(true);

      // клавиатура
this._onLeft  = () => this.grid.prev();
this._onRight = () => this.grid.next();
this.s.input.keyboard?.on('keydown-LEFT',  this._onLeft);
this.s.input.keyboard?.on('keydown-RIGHT', this._onRight);

      // esc
      modalApi.onEsc?.(()=> api.close());

      // resize
      this._resizeHandler = () => this._rebuild();
      this.s.scale.on('resize', this._resizeHandler);
    });

    // корректный cleanup
    const origClose = api.close;
    api.close = () => { this._cleanup(); origClose(); };
  }

  /* ───────── layout ───────── */
  _measure(){
    const sw = this.s.scale.width, sh = this.s.scale.height;

    const maxW = Math.floor(sw * 0.9);
    const maxH = Math.floor(sh * 0.86);

    const baseVW = this.cardTargetW*this.cols + this.gap*(this.cols-1);
    const baseVH = this.cardTargetH*this.rows + this.gap*(this.rows-1);
    const dotsH  = 28;

    const k = Math.min(
      1,
      (maxW - this.pad*2) / baseVW,
      (maxH - (this.headerH + dotsH + this.pad)) / baseVH
    );

    this.cardW = Math.max(120, Math.floor(this.cardTargetW * k));
    this.cardH = Math.max(140, Math.floor(this.cardTargetH * k));

    this.vw = this.cardW*this.cols + this.gap*(this.cols-1);
    this.vh = this.cardH*this.rows + this.gap*(this.rows-1);

    this.winW = Math.min(this.vw + this.pad*2, maxW);
    this.winH = Math.min(this.headerH + this.vh + dotsH + this.pad, maxH);

    this.x0 = Math.round((sw - this.winW)/2);
    this.y0 = Math.round((sh - this.winH)/2);
  }

_buildWindow(){
  const s = this.s;
  const sw = s.scale.width, sh = s.scale.height;

  // --- FULLSCREEN BLOCKER: ловит клики/скролл везде под модалкой ---
  this._screenBlock?.destroy();
  this._screenBlock = s.add.zone(0, 0, sw, sh)
    .setOrigin(0, 0)
    .setScrollFactor?.(0)     // если камера двигается
    .setInteractive({ useHandCursor:false });

  const stop = ev => ev?.stopPropagation?.();
  this._screenBlock.on('pointerdown', (_p,_lx,_ly,ev)=>stop(ev));
  this._screenBlock.on('pointerup',   (_p,_lx,_ly,ev)=>stop(ev));
  this._screenBlock.on('wheel',       (_p,_dx,_dy,ev)=>stop(ev));

  // кладём ПЕРВЫМ в root
  this.root.add(this._screenBlock);

  // --- дальше как было ---
  // блокер внутри окна (можно оставить, но уже не обязателен)
  this._panelHit?.destroy();
  this._panelHit = s.add.zone(this.x0, this.y0, this.winW, this.winH)
    .setOrigin(0,0).setInteractive({ useHandCursor:false });
  this._panelHit.on('pointerdown', (_p,_lx,_ly,ev)=>stop(ev));
  this._panelHit.on('pointerup',   (_p,_lx,_ly,ev)=>stop(ev));
  this._panelHit.on('wheel',       (_p,_dx,_dy,ev)=>stop(ev));
  this.root.add(this._panelHit);

  const bg = s.add.graphics();
    bg.fillStyle(UI.colors?.modalBg ?? 0x0f121a, 1)
      .fillRoundedRect(this.x0, this.y0, this.winW, this.winH, 18);
    bg.lineStyle(2, 0x2b3344, 1)
      .strokeRoundedRect(this.x0, this.y0, this.winW, this.winH, 18);
    this.root.add(bg);

    const title = s.add.text(this.x0 + this.pad, this.y0 + this.pad, 'Квести', {
      fontFamily: UI.fonts?.ui || 'Inter, Arial, sans-serif',
      fontSize: '20px', color:'#fff'
    }).setOrigin(0,0);
    this.root.add(title);

    const closeBtn = s.add.text(this.x0 + this.winW - this.pad, this.y0 + this.pad, '✕', {
      fontFamily: UI.fonts?.ui || 'Inter, Arial, sans-serif',
      fontSize: '20px', color:'#a8b0be'
    }).setOrigin(1,0).setInteractive({ useHandCursor:true });
    closeBtn.on('pointerup', ()=> this.host.close(this.root));
    this.root.add(closeBtn);
  }

  _buildGrid(){
    const s = this.s;

    this.grid = new PagedGrid(s, {
      x: 0, y: 0,
      cols: this.cols, rows: this.rows,
      cellW: this.cardW, cellH: this.cardH, gap: this.gap,
      showFrame: true,
      makeCell: (npc, w, h) => this._makeNpcCard(npc, w, h),
      makeStub: (w, h) => this._makeStub(w, h)
    });

    this.root.add(this.grid.root);
    this.grid.setPosition(this.x0 + this.pad, this.y0 + this.headerH);
    this.grid.setDepth((UI.z?.modal ?? 2000) + 1);
  }

  _rebuild(){
    const page = this.grid?.pageIndex || 0;
    this.grid?.destroy();
    this.root?.removeAll(true);

    this._measure();
    this._buildWindow();
    this._buildGrid();
    this.grid.setItems(getAllNPC()).goTo(page, true);
  }

_cleanup(){
  this.s.scale.off('resize', this._resizeHandler);
  this.s.input.keyboard?.off('keydown-LEFT',  this._onLeft);
  this.s.input.keyboard?.off('keydown-RIGHT', this._onRight);
  this._onLeft = this._onRight = null;

  this._screenBlock?.destroy(); this._screenBlock = null;
  this._panelHit?.destroy();    this._panelHit   = null;   // <- фиксим his → this

  this.grid?.destroy(); this.grid = null;
  this.root = null;
}

  /* ───────── карточка NPC ───────── */
  _makeNpcCard(npc, w, h){
    const s = this.s;

    const base = s.add.graphics();
    base.fillStyle(0x161a22,1).fillRoundedRect(0,0,w,h,12);
    base.lineStyle(2, 0x2b3344,1).strokeRoundedRect(0,0,w,h,12);

    const hover = s.add.graphics().setAlpha(0);
    hover.lineStyle(2, UI.colors?.accent ?? 0x7ad7ff, 1).strokeRoundedRect(1,1,w-2,h-2,11);

    let portrait;
    if (npc.portraitKey && s.textures.exists(npc.portraitKey)) {
      portrait = s.add.image(w/2, 56, npc.portraitKey).setOrigin(0.5);
      const max = 62;
      portrait.setScale(Math.min(max/(portrait.width||max), max/(portrait.height||max)));
    } else {
      portrait = s.add.text(w/2, 56, '🧑‍🦱', { fontSize:'38px' }).setOrigin(0.5);
    }

    const name = s.add.text(w/2, 108, npc.name, {
      fontFamily: UI.fonts?.ui || 'Inter, Arial, sans-serif',
      fontSize:'14px', color:'#fff', wordWrap:{ width: w-20 }, align:'center'
    }).setOrigin(0.5);

    const stage = s.add.text(w/2, 136, this._stageLabel(npc.id), {
      fontFamily: UI.fonts?.ui || 'Inter, Arial, sans-serif',
      fontSize:'12px', color:'#a8b0be'
    }).setOrigin(0.5);

    const c = s.add.container(0,0,[base,hover,portrait,name,stage]).setSize(w,h);
    const isActive = QuestState.getTrackedNpcId?.() === npc.id;
    if (isActive){
      const star = s.add.text(w - 10, 8, '★', { fontSize:'16px', color:'#7ad7ff' }).setOrigin(1,0);
      c.add(star);
    }
const hit = s.add.zone(0, 0, w, h).setOrigin(0, 0).setInteractive({ useHandCursor: true });
c.add(hit);

// Ховеры и клик обрабатываем через зону
hit.on('pointerover', () => { hover.setAlpha(1); c.setScale(1.02); c.y -= 2; });
hit.on('pointerout',  () => { hover.setAlpha(0); c.setScale(1.00); c.y += 2; });
hit.on('pointerup',   () => openQuestDetailsModal(this.s, npc));

    return c;
  }

  _makeStub(w,h){
    const g = this.s.add.graphics();
    g.fillStyle(0x0d111a,0.6).fillRoundedRect(0,0,w,h,12);
    g.lineStyle(2,0x2b3344,1).strokeRoundedRect(0,0,w,h,12);
    const t = this.s.add.text(w/2,h/2,'—',{
      fontFamily: UI.fonts?.ui || 'Inter, Arial, sans-serif',
      fontSize:'18px', color:'#495065'
    }).setOrigin(0.5);
    return this.s.add.container(0,0,[g,t]).setSize(w,h);
  }

  _stageLabel(npcId){
    const st = QuestState.getActiveStage(npcId);
    return st ? st.name : 'Завершено';
  }
}

/* ============================================================== *
 *   МОДАЛКА ДЕТАЛЕЙ NPC (портрет, задачи, награды)               *
 * ============================================================== */
export function openQuestDetailsModal(scene, npc){
  const host = ensureModalHost(scene);
  const s = scene;

  host.open((root, api) => {
    const sw = s.scale.width, sh = s.scale.height;
    const winW = Math.min(720, Math.floor(sw * 0.78));
    const winH = Math.min(560, Math.floor(sh * 0.78));
    const x0 = Math.round((sw - winW)/2);
    const y0 = Math.round((sh - winH)/2);
    const pad = 18;
    s.input?.setTopOnly?.(true);

    // клико- и скролл-блокер по области окна деталей
const panelHit = s.add.zone(x0, y0, winW, winH)
  .setOrigin(0, 0)
  .setInteractive({ useHandCursor:false });
panelHit.on('pointerdown', (_p,_lx,_ly,ev)=>ev?.stopPropagation?.());
panelHit.on('pointerup',   (_p,_lx,_ly,ev)=>ev?.stopPropagation?.());
panelHit.on('wheel',       (_p,_dx,_dy,ev)=>ev?.stopPropagation?.());
root.add(panelHit);

    // окно
    const bg = s.add.graphics();
    bg.fillStyle(UI.colors?.modalBg ?? 0x0f121a, 1)
      .fillRoundedRect(x0, y0, winW, winH, 16);
    bg.lineStyle(2, 0x2b3344, 1)
      .strokeRoundedRect(x0, y0, winW, winH, 16);
    root.add(bg);

    const title = s.add.text(x0 + pad, y0 + pad, 'Деталі квестів', {
      fontFamily: UI.fonts?.ui || 'Inter, Arial, sans-serif',
      fontSize:'18px', color:'#fff'
    }).setOrigin(0,0); root.add(title);

    const closeBtn = s.add.text(x0 + winW - pad, y0 + pad, '✕', {
      fontFamily: UI.fonts?.ui || 'Inter, Arial, sans-serif',
      fontSize:'18px', color:'#a8b0be'
    }).setOrigin(1,0).setInteractive({ useHandCursor:true });
 closeBtn.on('pointerdown', (_p,_lx,_ly,ev)=>ev?.stopPropagation?.());
closeBtn.on('pointerup',   (p,_lx,_ly,ev)=>{ ev?.stopPropagation?.(); api.close(); });
root.add(closeBtn);

    // «Активный» переключатель
    const isActive = QuestState.getTrackedNpcId() === npc.id;
    const actBtn = s.add.text(x0 + winW - pad - 140, y0 + pad, isActive ? 'Активний' : 'Зробити активним', {
      fontFamily: UI.fonts?.ui || 'Inter, Arial, sans-serif',
      fontSize:'14px',
      color: isActive ? '#7ad7ff' : '#ffffff'
    }).setOrigin(0,0).setInteractive({ useHandCursor:true });
    actBtn.on('pointerup', ()=>{
      QuestState.setTrackedNpcId(npc.id);
      actBtn.setText('Активний').setColor('#7ad7ff');
      s.showToast?.('Квест зроблено активним');
    });
    root.add(actBtn);

    // контентный контейнер
    const cont = s.add.container(x0 + pad, y0 + 54); root.add(cont);

    // шапка NPC
    const head = s.add.graphics();
    head.fillStyle(0x161a22,1).fillRoundedRect(0,0,winW - pad*2, 96, 12);
    head.lineStyle(2,0x2b3344,1).strokeRoundedRect(0,0,winW - pad*2, 96, 12);
    cont.add(head);

    let avatar;
    if (npc.portraitKey && s.textures.exists(npc.portraitKey)) {
      avatar = s.add.image(46, 48, npc.portraitKey).setOrigin(0.5);
      const max = 64;
      avatar.setScale(Math.min(max/(avatar.width||max), max/(avatar.height||max)));
    } else {
      avatar = s.add.text(46, 48, '🧑‍🦱', { fontSize:'42px' }).setOrigin(0.5);
    }
    cont.add(avatar);

    const st = QuestState.getActiveStage(npc.id);
    const stName = st ? st.name : 'Усі стадії завершені';

    const name = s.add.text(90, 18, npc.name, {
      fontFamily: UI.fonts?.ui || 'Inter, Arial, sans-serif',
      fontSize:'18px', color:'#fff'
    }).setOrigin(0,0); cont.add(name);

    const sub = s.add.text(90, 46, stName, {
      fontFamily: UI.fonts?.ui || 'Inter, Arial, sans-serif',
      fontSize:'13px', color:'#a8b0be'
    }).setOrigin(0,0); cont.add(sub);

    // Прогресс первой считаемой задачи
    const hp = QuestState.getHeaderProgress(npc.id);
    if ((hp.goal|0) > 0){
      const px = 90, py = 72, pw = winW - pad*2 - px - 16, ph = 10, r = 6;
      const bar = s.add.graphics();
      bar.fillStyle(0x0e1422,1).fillRoundedRect(px, py, pw, ph, r);
      const ratio = Phaser.Math.Clamp((hp.cur||0)/(hp.goal||1), 0, 1);
      bar.fillStyle(0x3aa3ff,1).fillRoundedRect(px, py, Math.max(2, Math.round(pw*ratio)), ph, r);
      cont.add(bar);

      const counter = s.add.text(px + pw, py + ph + 2, `${hp.cur}/${hp.goal}`, {
        fontFamily: UI.fonts?.ui || 'Inter, Arial, sans-serif',
        fontSize:'12px', color:'#a8b0be'
      }).setOrigin(1,0);
      cont.add(counter);
    }

    // прокручиваемая область
    const innerY = 110;
    const viewH  = winH - 54 - innerY - pad;
    const maskG  = s.add.graphics();
    maskG.fillStyle(0xffffff,1).fillRoundedRect(0, innerY, winW - pad*2, viewH, 12);
    const mask = maskG.createGeometryMask(); maskG.setVisible(false);
    root.add(maskG);

    const scrollWrap = s.add.container(x0 + pad, y0 + 54).setMask(mask).setSize(winW - pad*2, viewH);
    const body = s.add.container(0, innerY); scrollWrap.add(body);
    root.add(scrollWrap);

    // — задачи
    let y = 0;
    const labelTasks = s.add.text(0, y, 'Завдання', {
      fontFamily: UI.fonts?.ui || 'Inter, Arial, sans-serif',
      fontSize:'14px', color:'#e0e6f1'
    }).setOrigin(0,0); body.add(labelTasks); y += 24;

    if (st?.tasks?.length){
      for (const task of st.tasks){
        const row = makeTaskRowUI(s, npc.id, task, winW - pad*2);
        row.y = y; body.add(row); y += 44;
      }
    } else {
      const none = s.add.text(0, y, 'Завдання відсутні', {
        fontFamily: UI.fonts?.ui || 'Inter, Arial, sans-serif',
        fontSize:'13px', color:'#a8b0be'
      }).setOrigin(0,0); body.add(none); y += 22;
    }

    // — награда
    y += 8;
    const labelRw = s.add.text(0, y, 'Нагорода', {
      fontFamily: UI.fonts?.ui || 'Inter, Arial, sans-serif',
      fontSize:'14px', color:'#e0e6f1'
    }).setOrigin(0,0); body.add(labelRw); y += 28;

    const chips = makeRewardChipsUI(s, st?.reward, winW - pad*2);
    chips.y = y; body.add(chips); y += (chips.height || 30) + 8;

    // — кнопка «Забрати нагороду»
    const ready = QuestState.isStageComplete(npc.id);
    const claim = makeClaimButtonUI(
      s,
      0,            // x внутри body
      y + 8,        // y
      winW - pad*2, // максимально допустимая ширина
      ready,
      () => {
        const rwd = QuestState.claimStageReward(npc.id);
        if (rwd){
          grantReward(rwd);
          s.showToast?.('Нагороду отримано');
          api.close();
          openQuestDetailsModal(s, npc);
        }
      }
    );
    body.add(claim);
    y += claim.height + 16;

    body.setSize(winW - pad*2, y);

    // колесо — скролл контента
    scrollWrap.setInteractive(
      new Phaser.Geom.Rectangle(0,0, winW - pad*2, winH - 54 - pad),
      Phaser.Geom.Rectangle.Contains
    );
    let currentScroll = 0;
    scrollWrap.on('wheel', (_p,_dx,dy,ev)=>{
  ev?.stopPropagation?.();               // не даём скроллу добраться до грида под окном
  const maxY = Math.max(0, (body.height||0) - viewH);
  currentScroll = Phaser.Math.Clamp(currentScroll + (dy>0?30:-30), 0, maxY);
  body.y = innerY - currentScroll;
});
    api.onEsc?.(()=> api.close());
  });
}

/* ───────────────────────── helpers (details) ───────────────────────── */

function makeTaskRowUI(s, npcId, task, w){
  const done = QuestState.isTaskDone(npcId, task);

  const g = s.add.graphics();
  g.fillStyle(0x1a2030,1).fillRoundedRect(0,0,w,36,10);
  g.lineStyle(1,0x283146,1).strokeRoundedRect(0,0,w,36,10);

  const check = s.add.text(10,18, done ? '✔' : '○', {
    fontSize:'16px', color: done ? '#7fff9f' : '#9aa3b6'
  }).setOrigin(0,0.5);

  const title = s.add.text(32,18, task.name || task.id, {
    fontFamily: UI.fonts?.ui || 'Inter, Arial, sans-serif',
    fontSize:'13px', color:'#fff'
  }).setOrigin(0,0.5);

  let prog = null, extra = '';
  if (task.countGoal != null){
    const rec = (QuestState.getNPC(npcId).tasks[task.id]) || {count:0};
    const cur = Math.min(rec.count|0, task.countGoal|0);
    const ratio = task.countGoal ? cur / task.countGoal : 0;
    extra = `${cur}/${task.countGoal}`;

    prog = s.add.graphics();
    const px = w - 112, py = 12, pw = 92, ph = 12, r = 6;
    prog.fillStyle(0x0e1422,1).fillRoundedRect(px, py, pw, ph, r);
    prog.fillStyle(0x3aa3ff,1).fillRoundedRect(px, py, Math.max(2, Math.round(pw*ratio)), ph, r);
  }

  const right = s.add.text(w-10, 18, extra, {
    fontFamily: UI.fonts?.ui || 'Inter, Arial, sans-serif',
    fontSize:'12px', color:'#a8b0be'
  }).setOrigin(1,0.5);

  const children = [g, check, title, right];
  if (prog) children.push(prog);

  const row = s.add.container(0,0,children).setSize(w,36);
  row.setInteractive(new Phaser.Geom.Rectangle(0,0,w,36), Phaser.Geom.Rectangle.Contains);
  row.on('pointerover', ()=> g.setAlpha(0.95));
  row.on('pointerout',  ()=> g.setAlpha(1));
  return row;
}

function makeRewardChipsUI(s, rwd, maxW){
  const cont = s.add.container(0,0);
  let x = 0, y = 0, gap = 8;

  const chips = [];
  const push = (text) => {
    const padX = 10, h = 24;
    const t = s.add.text(0, h/2, text, {
      fontFamily: UI.fonts?.ui || 'Inter, Arial, sans-serif',
      fontSize:'12px', color:'#dfe7f5'
    }).setOrigin(0,0.5);

    const bg = s.add.graphics();
    const w = Math.round(t.width + padX*2);
    bg.fillStyle(0x1b2334,1).fillRoundedRect(0,0,w,h,12);
    bg.lineStyle(1,0x2a3852,1).strokeRoundedRect(0,0,w,h,12);

    const chip = s.add.container(0,0,[bg,t]).setSize(w,h);
    chips.push(chip);
  };

  if (rwd?.wallet?.coins)        push(`🪙 Монети +${rwd.wallet.coins}`);
  if (rwd?.wallet?.gold)         push(`⭐ Золото +${rwd.wallet.gold}`);
  if (rwd?.perks?.skillPoints)   push(`💡 Очки навичок +${rwd.perks.skillPoints}`);
  if (rwd?.perks?.perkId)        push(`🎯 Перк: ${rwd.perks.perkId}`);
  if (Array.isArray(rwd?.items)) for (const it of rwd.items) push(`🎁 ${it.id} ×${it.count}`);
  if (!chips.length)             push('—');

  for (const chip of chips){
    if (x + chip.width > maxW) { x = 0; y += 30; }
    chip.setPosition(x, y + 12);
    cont.add(chip);
    x += chip.width + gap;
  }

  cont.setSize(maxW, y + 28);
  return cont;
}

function makeClaimButtonUI(s, x, y, maxW, enabled, onClick){
  const label = 'Забрати нагороду';
  const padX = 14, h = 36, r = 10;

  const t = s.add.text(0, 0, `🎁 ${label}`, {
    fontFamily: UI.fonts?.ui || 'Inter, Arial, sans-serif',
    fontSize:'13px', color:'#ffffff'
  }).setOrigin(0.5);

  const w = Math.max(188, Math.min(maxW, Math.ceil(t.width + padX*2)));

  const bg = s.add.graphics();
  const fill   = enabled ? 0x2b7a3f : 0x33424f;
  const stroke = enabled ? 0x71d48a : 0x2a3852;
  bg.fillStyle(fill, 1).fillRoundedRect(-w/2, -h/2, w, h, r);
  bg.lineStyle(1, stroke, 1).strokeRoundedRect(-w/2, -h/2, w, h, r);

  const c = s.add.container(x + w/2, y + h/2, [bg, t]).setSize(w, h);
  c.height = h;

  const hit = s.add.zone(0, 0, w, h).setOrigin(0.5).setInteractive({ useHandCursor: enabled });
  const stop = (_p,_lx,_ly,ev)=>ev?.stopPropagation?.();

  hit.on('pointerdown',      stop);
  hit.on('pointerupoutside', stop);
  hit.on('pointermove',      stop);
  hit.on('wheel',            stop);

  if (enabled){
    hit.on('pointerover', ()=> bg.setAlpha(0.92));
    hit.on('pointerout',  ()=> bg.setAlpha(1));
    hit.on('pointerup',   (p,lx,ly,ev)=>{ stop(p,lx,ly,ev); onClick?.(); });
  } else {
    hit.on('pointerup',   (p,lx,ly,ev)=>{ stop(p,lx,ly,ev); s.showToast?.('Завершіть усі завдання'); });
  }

  c.add(hit);
  return c;
}

