// src/ui/ActiveQuestHUD.js
import UI from './theme.js';
import { getAllNPC } from '../data/QuestDB.js';
import { QuestState } from '../quests/QuestState.js';
import { openQuestsModal, openQuestDetailsModal } from './QuestsModal.js';

export class ActiveQuestHUD {
  constructor(s, opts = {}) {
    this.s = s;
    this.onOpen = typeof opts.onOpen === 'function' ? opts.onOpen : null;

    // ─── базовые размеры ──────────────────────────────────────────────────────
    this.w = Math.max(220, (opts.width | 0) || 280);
    this.h = 64;

    // ─── палитра ─────────────────────────────────────────────────────────────
    this._col = {
      panel:   (UI.colors?.panelSubBg ?? UI.color?.panel ?? 0x121722),
      stroke:  0x2b3344,
      barBg:   0x0e1422,
      barFg:   0x3aa3ff,
      barFgReady: 0x39c26d,
      text:    '#ffffff',
      sub:     '#a8b0be',
      ok:      '#93f5b9',
      ddRow:   0x121826,
      ddRowHover: 0x1a2333,
      footerBg: 0x0f1521
    };

    // ─── тонкая настройка ────────────────────────────────────────────────────
    this._tune = { barBottom: 18, ddTextTop: 8, rootHitPad: 10 };

    // ─── состояние ───────────────────────────────────────────────────────────
    this.isOpen = false;          // открыт ли дроп-даун
    this._toggleLock = 0;         // анти-дребезг
    this._ignoreNextUp = false;   // чтобы клики по кнопкам не улетали в root
    this._lastKey = '';
    this._nextPollT = 0;
    this._lastProgress = { cur: 0, goal: 0, ready: false };

    // ─── корневой контейнер HUD поверх мира ──────────────────────────────────
    const baseZ = (UI.z?.wallet ?? 952);
    this.root = s.add.container((opts.x|0)||0, (opts.y|0)||0).setSize(this.w, this.h);
    this.root.setDepth(baseZ + 1);

    // фон + рамка карточки
    this.bg = s.add.graphics(); this._paintPanel();

    // аватар
    this.avatar = s.add.text(18, this.h/2, '🧑‍🦱', { fontSize:'26px' }).setOrigin(0.5);

    // заголовки
    this.title = s.add.text(44, 8, '—', {
      fontFamily: UI.fonts?.ui || 'Inter, Arial, sans-serif',
      fontSize:'14px', color:this._col.text
    }).setOrigin(0,0);
    this.sub = s.add.text(44, 24, '—', {
      fontFamily: UI.fonts?.ui || 'Inter, Arial, sans-serif',
      fontSize:'12px', color:this._col.sub
    }).setOrigin(0,0);

    // стрелка состояния дропа
    this.chev = s.add.text(this.w - 28, 6, '▾', {
      fontFamily: UI.fonts?.ui || 'Inter, Arial, sans-serif',
      fontSize:'14px', color:'#a8b0be'
    }).setOrigin(0,0).setInteractive({ useHandCursor:true });

    // прогресс
    this.pbar = s.add.graphics();
    this.ptext = s.add.text(this.w - 10, this.h - 10, '', {
      fontFamily: UI.fonts?.ui || 'Inter, Arial, sans-serif',
      fontSize:'11px', color:this._col.sub
    }).setOrigin(1,1);

    // отдельная большая кнопка «Квести» справа
    // собрать
    this.root.add([this.bg, this.avatar, this.title, this.sub, this.pbar, this.ptext, this.chev,]);

    // дроп-даун (под карточкой, прижат без зазора)
    this.ddWrap = s.add.container(0, this.h - 2).setVisible(false).setAlpha(0);
    this.root.add(this.ddWrap);
    this.ddBg = s.add.graphics(); this.ddWrap.add(this.ddBg);
    this._ddRows = [];
    this._ddShadow = null;

    // расширенная кликабельная область всей карточки (тоггл дропа)
    this._updateHitArea();

    // ─── интеракции ──────────────────────────────────────────────────────────
    // 1) вся карточка — открывает/закрывает дроп-даун
    this.root.on('pointerup', () => {
      if (this._ignoreNextUp) { this._ignoreNextUp = false; return; }
      if (this.s.time.now < this._toggleLock) return;
      this._toggleLock = this.s.time.now + 150;
      this._toggleDropdown();
    });

    // 2) клик по стрелке — только переключает (и не пробивает на root)
    this.chev.on('pointerup', (p,lx,ly,ev)=>{ ev?.stopPropagation?.(); this._ignoreNextUp = true; this._toggleDropdown(); });

    // первый рендер + подписка на прогресс квестов
    this.refresh(true);
    this._onQuestEvt = () => { this.refresh(true); if (this.ddWrap.visible) this._buildDropdown(); };
    window.addEventListener('quest-progress', this._onQuestEvt);
  }

  /* ───────────────────── public ───────────────────── */
  setPosition(x,y){ this.root?.setPosition(x,y); return this; }
  setVisible(v){ this.root?.setVisible(!!v); return this; }

  setWidth(w){
    const newW = Math.max(220, w|0);
    if (newW === this.w) return this;
    this.w = newW;

    this.root?.setSize(this.w, this.h);
    this._updateHitArea();
    this._paintPanel();

    // правые элементы
    this.ptext.setX(this.w - 10);
    this.chev.setX(this.w - 28);

    // кнопка «Квести» остаётся прижатой вправо
    this.openBtn?.setPosition(this.w - 12, 10);

    this._drawProgress(this._lastProgress.cur, this._lastProgress.goal, this._lastProgress.ready);
    if (this.ddWrap.visible) this._buildDropdown();
    return this;
  }

  update(){
    const now = this.s.time.now|0;
    if (now < this._nextPollT) return;
    this._nextPollT = now + 500;
    this.refresh(false);
  }

  refresh(force=false){
    const pick = _pickTrackedQuest();
    const key = pick
      ? `${pick.npc.id}|${pick.stage.id}|${pick.task?.id||'none'}|${pick.cur}/${pick.goal}|${pick.ready?'1':'0'}`
      : 'none';
    if (!force && key === this._lastKey) return;
    this._lastKey = key;

    if (!pick){
      this._ensureAvatarText();
      this.avatar.setText('🧩');
      this.title.setText('Немає активних квестів');
      this.sub.setText('Відкрий «Квести», щоб почати');
      this._drawProgress(0,0,false);
      if (this.ddWrap.visible) this._buildDropdown();
      return;
    }

    // аватар
    if (pick.npc.portraitKey && this.s.textures.exists(pick.npc.portraitKey)){
      if (this.avatar?.type === 'Text'){
        this.avatar.destroy();
        this.avatar = this.s.add.image(18, this.h/2, pick.npc.portraitKey).setOrigin(0.5);
        this.root.addAt(this.avatar, 1);
      } else {
        this.avatar.setTexture(pick.npc.portraitKey);
      }
      const max = 28;
      const sc = Math.min(max/(this.avatar.width||max), max/(this.avatar.height||max));
      this.avatar.setScale(sc);
    } else {
      this._ensureAvatarText();
      this.avatar.setText('🧑‍🦱');
    }

    this.title.setText(pick.npc.name);
    this.sub.setText(pick.task ? pick.task.name : pick.stage.name);
    this._drawProgress(pick.cur, pick.goal, pick.ready);

    if (this.ddWrap.visible) this._buildDropdown();
  }

  /* ───────────────────── layout ───────────────────── */
  _updateHitArea(){
    const p = this._tune.rootHitPad;
    const rect = new Phaser.Geom.Rectangle(-p, -p, this.w + p*2, this.h + p*2);
    this.root.setSize(this.w, this.h);
    if (this.root.input) this.root.removeInteractive();
    this.root.setInteractive(rect, Phaser.Geom.Rectangle.Contains);
  }

  _paintPanel(){
    this.bg.clear();
    this.bg.fillStyle(this._col.panel,1).fillRoundedRect(0,0,this.w,this.h,12);
    this.bg.lineStyle(2, this._col.stroke,1).strokeRoundedRect(0,0,this.w,this.h,12);
  }

  _drawProgress(cur, goal, ready=false){
    this._lastProgress = { cur:cur|0, goal:goal|0, ready:!!ready };
    const x = 44, w = this.w - x - 96 /* оставляем место под кнопку */, h = 8, r = 4;
    const y = this.h - this._tune.barBottom;

    const ratio = goal ? Phaser.Math.Clamp(cur/goal, 0, 1) : 0;
    this.pbar.clear();
    this.pbar.fillStyle(this._col.barBg,1).fillRoundedRect(x,y,w,h,r);
    this.pbar.fillStyle(ready ? this._col.barFgReady : this._col.barFg,1)
      .fillRoundedRect(x,y, Math.max(2, Math.round(w*ratio)), h, r);

    this.ptext.setPosition(this.w - 12 - 88 /* btnW */, y + h).setOrigin(1,1);

    if (ready) this.ptext.setText('✓ Готово').setColor(this._col.ok);
    else       this.ptext.setText(goal ? `${cur}/${goal}` : '').setColor(this._col.sub);
  }

  /* ───────────────────── dropdown ───────────────────── */
  _toggleDropdown(){ this.isOpen ? this._closeDropdown() : this._openDropdown(); }

  _openDropdown(){
    if (this.isOpen) return;
    this._buildDropdown();
    this.ddWrap.setVisible(true).setAlpha(0);
    this.s.tweens.add({ targets:this.ddWrap, alpha:1, duration:120, ease:'Cubic.Out' });
    this.isOpen = true;
    this.chev?.setText?.('▴');
    // ВАЖНО: нет никаких «щитков» и кликов вне — дроп остаётся открытым,
    // игрок может ловить рыбу, UI не блокирует мир.
  }

  _closeDropdown(immediately=false){
    if (!this.isOpen) return;
    const finish = () => { this.ddWrap.setVisible(false).setAlpha(0); };
    if (immediately) finish();
    else this.s.tweens.add({ targets:this.ddWrap, alpha:0, duration:120, ease:'Cubic.Out', onComplete:finish });
    this.isOpen = false;
    this.chev?.setText?.('▾');
  }

_buildDropdown(){
  const pick = _pickTrackedQuest();

  // очистка
  this._ddRows.forEach(r => r.destroy());
  this._ddRows.length = 0;
  this.ddBg.clear();
  this._ddShadow?.destroy(); 
  this._ddShadow = null;

  if (!pick || !pick.stage){
    this.ddWrap.setVisible(false).setAlpha(0);
    return;
  }

  const headerTaskId = pick.task?.id || null;
  const tasks = Array.isArray(pick.stage.tasks) ? pick.stage.tasks : [];

  // элементы списка (без хедера)
  const items = tasks
    .filter(t => (t?.id || 'none') !== headerTaskId)
    .map(t => {
      const { cur, goal, done } = _taskProgress(pick.npc.id, t);
      return { title: t.name || t.id, cur, goal, done, npc: pick.npc, isClaim:false };
    });

  // если стадия завершена — пункт «заберіть нагороду» сверху
  if (QuestState.isStageComplete?.(pick.npc.id)){
    items.unshift({
      title:'Стадію завершено — заберіть нагороду',
      cur:0, goal:0, done:true, npc:pick.npc, isClaim:true
    });
  }

  // размеры
  const w     = this.w;
  const rowH  = 40;
  const pad   = 10;

  // +1 строка под «Відкрити всі квести…»
  const totalH = (items.length + 1) * rowH + pad*2;

  // тень
  this._ddShadow = this.s.add.graphics();
  const rrShadow = { tl:0, tr:0, bl:14, br:14 };
  this._ddShadow.fillStyle(0x000000, 0.22).fillRoundedRect(2, 6, w, totalH, rrShadow);
  this.ddWrap.add(this._ddShadow);

  // фон
  const rr = { tl:0, tr:0, bl:12, br:12 };
  this.ddBg.fillStyle(this._col.panel, 1).fillRoundedRect(0, 0, w, totalH, rr);
  this.ddBg.lineStyle(2, this._col.stroke, 1).strokeRoundedRect(0, 0, w, totalH, rr);

  // строки задач
  let y = pad;
  for (const it of items){
    const row = this._makeDDRow(it, w, rowH);
    row.setPosition(0, y);
    this.ddWrap.add(row);
    this._ddRows.push(row);
    y += rowH;
  }

  // футер «Відкрити всі квести…»
  const openAllRow = this._makeOpenAllRow(w, rowH);
  openAllRow.setPosition(0, y);
  this.ddWrap.add(openAllRow);
  this._ddRows.push(openAllRow);
  y += rowH;

  // контейнер/интерактив
  this.ddWrap.setSize(w, totalH);
  if (this.ddWrap.input) this.ddWrap.removeInteractive();
  this.ddWrap.setInteractive(
    new Phaser.Geom.Rectangle(0, 0, w, totalH),
    Phaser.Geom.Rectangle.Contains
  );
}


  _makeDDRow(it, w, h){
    const s = this.s;
    const g = s.add.graphics();
    const baseCol  = it.isClaim ? 0x1d2b21 : this._col.ddRow;
    const hoverCol = it.isClaim ? 0x274a2a : this._col.ddRowHover;
    g.fillStyle(baseCol,1).fillRoundedRect(4,2, w-8, h-4, 10);

    const textTop = this._tune.ddTextTop;
    const iconY   = textTop + 6;

    const left = s.add.text(10, iconY, it.isClaim ? '🎁' : (it.done ? '✔' : '•'), {
      fontSize:'14px', color: it.isClaim ? this._col.ok : (it.done ? this._col.ok : '#8aa1c2')
    }).setOrigin(0,0.5);

    const title = s.add.text(24, textTop, it.title, {
      fontFamily: UI.fonts?.ui || 'Inter, Arial, sans-serif',
      fontSize:'12px', color:'#ffffff', wordWrap:{ width: w - 24 - 60 }
    }).setOrigin(0,0);

    const bar = s.add.graphics();
    if (!it.isClaim){
      const barX = 24, barW = w - 24 - 54, barY = h - 10;
      const ratio = it.goal ? Phaser.Math.Clamp(it.cur/it.goal, 0, 1) : 0;
      bar.fillStyle(this._col.barBg,1).fillRoundedRect(barX, barY, barW, 6, 3);
      bar.fillStyle((it.goal && it.cur>=it.goal) ? this._col.barFgReady : this._col.barFg,1)
        .fillRoundedRect(barX, barY, Math.max(2, Math.round(barW*ratio)), 6, 3);
    }

    const right = s.add.text(
      w-10, iconY, it.isClaim ? '✓' : (it.goal ? `${it.cur}/${it.goal}` : ''),
      { fontFamily: UI.fonts?.ui || 'Inter, Arial, sans-serif', fontSize:'11px', color: it.isClaim ? this._col.ok : this._col.sub }
    ).setOrigin(1,0.5);

    const row = s.add.container(0,0,[g,left,title,bar,right]).setSize(w,h);
    row.setInteractive(new Phaser.Geom.Rectangle(0,0,w,h), Phaser.Geom.Rectangle.Contains)
      .on('pointerover', ()=> g.fillStyle(hoverCol,1).fillRoundedRect(4,2,w-8,h-4,10))
      .on('pointerout',  ()=> g.fillStyle(baseCol,1).fillRoundedRect(4,2,w-8,h-4,10));

    row.on('pointerup', (p,lx,ly,ev)=>{
      ev?.stopPropagation?.();
      this._ignoreNextUp = true;
      this._hideDropdown(true); // при открытии модалки дроп скрываем
      QuestState.setTrackedNpcId?.(it.npc.id);
      openQuestDetailsModal(this.s, it.npc);
    });

    return row;
  }
_makeOpenAllRow(w, h){
  const s = this.s;

  const g = s.add.graphics();
  const baseCol  = this._col.ddRow;
  const hoverCol = this._col.ddRowHover;
  g.fillStyle(baseCol, 1).fillRoundedRect(4, 2, w-8, h-4, 10);

  const title = s.add.text(14, h/2, 'Відкрити всі квести…', {
    fontFamily: UI.fonts?.ui || 'Inter, Arial, sans-serif',
    fontSize:'12px', color:'#ffffff'
  }).setOrigin(0,0.5);

  const chevron = s.add.text(w-12, h/2, '›', {
    fontFamily: UI.fonts?.ui || 'Inter, Arial, sans-serif',
    fontSize:'14px', color:this._col.sub
  }).setOrigin(1,0.5);

  const row = s.add.container(0,0,[g,title,chevron]).setSize(w,h);
  row.setInteractive(new Phaser.Geom.Rectangle(0,0,w,h), Phaser.Geom.Rectangle.Contains);
  row.input.cursor = 'pointer';

  row.on('pointerover', () => g.clear().fillStyle(hoverCol,1).fillRoundedRect(4,2,w-8,h-4,10));
  row.on('pointerout',  () => g.clear().fillStyle(baseCol,1).fillRoundedRect(4,2,w-8,h-4,10));

  row.on('pointerup', (p,lx,ly,ev) => {
    ev?.stopPropagation?.();
    this._ignoreNextUp = true;
    this._hideDropdown(true);
    openQuestsModal(this.s);
  });

  return row;
}


  _makeOpenAllFooter(w, h){
    const s = this.s;
    const g = s.add.graphics();
    g.fillStyle(this._col.footerBg, 1).fillRoundedRect(4, 2, w-8, h-4, {tl:8,tr:8,bl:10,br:10});
    g.lineStyle(1, 0x1c2432, 1).strokeRoundedRect(4, 2, w-8, h-4, {tl:8,tr:8,bl:10,br:10});

    const t = s.add.text(14, h/2, 'Відкрити всі квести…', {
      fontFamily: UI.fonts?.ui || 'Inter, Arial, sans-serif', fontSize:'12px', color:'#c9d3e6'
    }).setOrigin(0,0.5);

    const chevron = s.add.text(w-16, h/2, '›', {
      fontFamily: UI.fonts?.ui || 'Inter, Arial, sans-serif', fontSize:'16px', color:'#c9d3e6'
    }).setOrigin(1,0.5);

    const row = s.add.container(0,0,[g,t,chevron]).setSize(w,h);
    row.setInteractive(new Phaser.Geom.Rectangle(0,0,w,h), Phaser.Geom.Rectangle.Contains)
      .on('pointerover', ()=> g.setAlpha(0.92))
      .on('pointerout',  ()=> g.setAlpha(1))
      .on('pointerup',   (p,lx,ly,ev)=>{ ev?.stopPropagation?.(); this._ignoreNextUp = true; openQuestsModal(this.s); });

    return row;
  }

  _hideDropdown(immediately=false){
    if (!this.ddWrap.visible) return;
    if (immediately){ this.ddWrap.setVisible(false).setAlpha(0); return; }
    this.s.tweens.add({ targets:this.ddWrap, alpha:0, duration:120, ease:'Cubic.Out',
      onComplete: ()=> this.ddWrap.setVisible(false)
    });
  }

  _makeOpenAllBtn(){
    const s = this.s;
    const btnW = 88, btnH = 26, r = 12;
    const cont = s.add.container(this.w - 12, 10); // прижат к правому верхнему углу карточки
    const g = s.add.graphics();
    const fill = UI.colors?.accent ?? 0x3aa3ff;
    g.fillStyle(fill,1).fillRoundedRect(-btnW, 0, btnW, btnH, r);
    g.lineStyle(1,0xffffff,0.15).strokeRoundedRect(-btnW, 0, btnW, btnH, r);
    const t = s.add.text(-btnW/2, btnH/2, 'Квести', {
      fontFamily: UI.fonts?.ui || 'Inter, Arial, sans-serif', fontSize:'12px', color:'#ffffff'
    }).setOrigin(0.5);

    const hit = s.add.zone(-btnW, 0, btnW, btnH).setOrigin(0,0).setInteractive({ useHandCursor:true });
    hit.on('pointerover', ()=> g.setAlpha(0.92));
    hit.on('pointerout',  ()=> g.setAlpha(1));
    hit.on('pointerup',   ()=>{ this._ignoreNextUp = true; (this.onOpen ? this.onOpen() : openQuestsModal(this.s)); });

    cont.add([g,t,hit]);
    cont.setSize(btnW, btnH);
    return cont;
  }

  _ensureAvatarText(){
    if (this.avatar && this.avatar.type !== 'Text'){
      this.avatar.destroy();
      this.avatar = this.s.add.text(18, this.h/2, '🧑‍🦱', { fontSize:'26px' }).setOrigin(0.5);
      this.root.addAt(this.avatar, 1);
    }
  }

  destroy(){
    try { window.removeEventListener('quest-progress', this._onQuestEvt); } catch(_){}
    this.root?.removeAll(true);
    this.root?.destroy();
    this.root = null;
  }
}

/* ───────────────────── helpers ───────────────────── */
function _taskProgress(npcId, task){
  const done = QuestState.isTaskDone(npcId, task);
  if (task.countGoal == null) return { cur:0, goal:0, done };
  const rec = (QuestState.getNPC(npcId).tasks[task.id]) || { count:0 };
  const cur  = Math.min(rec.count|0, task.countGoal|0);
  const goal = task.countGoal|0;
  return { cur, goal, done };
}

function _pickTrackedQuest(){
  const npcs = getAllNPC();
  const tracked = QuestState.getTrackedNpcId?.();
  const scan = tracked ? npcs.filter(n => n.id === tracked) : npcs;

  for (const npc of scan){
    const stage = QuestState.getActiveStage(npc.id);
    if (!stage) continue;

    let task = null, cur = 0, goal = 0;
    if (Array.isArray(stage.tasks) && stage.tasks.length){
      task = stage.tasks.find(t => !QuestState.isTaskDone(npc.id, t)) || stage.tasks[0];
      if (task?.countGoal != null){
        const rec = (QuestState.getNPC(npc.id).tasks[task.id]) || { count:0 };
        cur  = Math.min(rec.count|0, task.countGoal|0);
        goal = task.countGoal|0;
      }
    }

    const ready = QuestState.isStageComplete?.(npc.id) || (goal>0 && cur>=goal);
    return { npc, stage, task, cur, goal, ready };
  }
  return null;
}

export default ActiveQuestHUD;
