// === Clean Start Scene (без ensure/prepare/asset-logs, без редакторов) ===
import { GearSlots } from '../ui/GearSlots.js';
import { spawnFish } from '../sim/spawn.js';
import { calcFightParams } from '../data/balance.js';
import { BarsDock } from '../ui/BarsDock.js';
import { Progress } from '../progression/progress.js';
import { GearModal } from '../ui/GearModal.js';
import { GearDB, getDefaultGear } from '../data/gear.js';
import { Bobber } from '../ui/Bobber.js';
import UI from '../ui/theme.js';
import { ModalHost } from '../ui/ModalHost.js';
import { LocationMgr } from '../locations/LocationMgr.js';
import VM from '../vm.js';
import { ShopCatalog } from '../data/shopCatalog.js';
import { openKeepnetModal } from '../ui/CatchModals.js';
import PhotoBank from '../assets/PhotoBank.js';
import TopHUD from '../ui/TopHUD.js';
import { TimeCycle } from '../time/TimeCycle.js';
import LocationEditor from '../locations/LocationEditor.js';
import { handleCatch } from '../quests/CatchFlow.js';
import { setRewardSink } from '../quests/QuestRewards.js';
import { onWalletChange, onLevelChange } from '../quests/QuestHooks.js';
import { API, Auth } from '../net/api.js';
import { ChatClient } from '../net/chat.js';
import ChatOverlay from '../ui/ChatOverlay.js';
import Phaser from 'phaser';

export class Start extends Phaser.Scene {
  constructor(){ super('Start'); this.locId = 'lake'; }
  init(data){ if (data?.locId) this.locId = data.locId; }

  preload(){
    this.locId = VM.get?.('locationId', this.locId) ?? this.locId;
    LocationMgr.loadAssets(this);                 // фон, звуки и т.д.
    PhotoBank.queueForScene(this, this.locId);    // (если нужны фотки лута/мусора)
  }

async create(){
    await Auth.ensure();
  if (!Auth.isAuthed) { this.scene.start('Auth'); return; }


  // --- 1) VM-дефолты (база локального стейта) ---
  const d = VM.defaults();
  this.state       = 'idle';
  this.inventory   = VM.get('inventory') ?? d.inventory;
  this.activeBaitId= VM.get('activeBaitId','worm');
  this.gear        = VM.get('gear') ?? getDefaultGear();
  this.gear.inv  ||= {};
  this.gear.inv.bait = this.inventory?.bait?.[this.activeBaitId] | 0;
  this.keepnet     = VM.get('keepnet', d.keepnet);
  this.wallet      = VM.get('wallet')    ?? d.wallet;
  this.rigDepthM   = VM.get('rigDepthM', d.rigDepthM);
  this.keepnetCap  = VM.get('keepnetCap', d.keepnetCap ?? 25);
  this.locId       = VM.get?.('locationId', this.locId) ?? this.locId;

  // <<< ВОТ ЭТОГО НЕ ХВАТАЛО:
const savedProgress = VM.get('progress');
const savedLevel    = VM.get('level', 1);

// --- создать Progress и налить сохранённые значения
this.progress = new Progress(this);
if (savedProgress?.xp != null)    this.progress.xp    = savedProgress.xp|0;
if (savedProgress?.level != null) this.progress.level = savedProgress.level|0;
else                               this.progress.level = savedLevel|0;


  // --- 2) Серверный стейт поверх VM ---
  let st = null;
  try { st = window.API_BASE ? await API.loadState() : null; } catch (e){ console.warn('loadState failed', e); }
  if (st){
    this.wallet       = st.wallet      ?? this.wallet;
    this.keepnet      = st.keepnet     ?? this.keepnet;
    this.keepnetCap   = st.keepnetCap  ?? this.keepnetCap;
    this.gear         = st.gear        ?? this.gear;
    this.rigDepthM    = st.rigDepthM   ?? this.rigDepthM;
    this.locId        = st.locationId  || this.locId;
    this.inventory    = st.inventory   ?? this.inventory;
    this.activeBaitId = st.activeBaitId?? this.activeBaitId;
    this.gear.inv   ||= {};
    this.gear.inv.bait = this.inventory?.bait?.[this.activeBaitId] | 0;
      if (st.progress?.xp != null)    this.progress.xp    = st.progress.xp|0;
  if (st.progress?.level != null) this.progress.level = st.progress.level|0;
  }

  // --- 3) Дебаунс-автосейв: VM + сервер ---
  let _saveTO = null;
  this.commitState = () => {
    const payload = {
      wallet:this.wallet, keepnet:this.keepnet, keepnetCap:this.keepnetCap,
      gear:this.gear, rigDepthM:this.rigDepthM,
      locationId: this.locationMgr?.getCurrentId?.() || this.locId,
      level:this.progress?.level,
      progress:{ xp:this.progress?.xp, level:this.progress?.level },
      inventory:this.inventory, activeBaitId:this.activeBaitId
    };
    if (VM.setMany) VM.setMany(payload); else {
      VM.set('wallet', payload.wallet);
      VM.set('keepnet', payload.keepnet);
      VM.set('keepnetCap', payload.keepnetCap);
      VM.set('gear', payload.gear);
      VM.set('rigDepthM', payload.rigDepthM);
      VM.set('locationId', payload.locationId);
      VM.set('inventory', payload.inventory);
      VM.set('activeBaitId', payload.activeBaitId);
    }
  console.log('[SAVE]', payload);                    // <-- видно каждое сохранение
  clearTimeout(_saveTO);
  _saveTO = setTimeout(() => {
    // если нет API_BASE — просто ничего не шлём
    if (window.API_BASE) API.saveState(payload).catch(()=>{});
  }, 400);
};

window.addEventListener('beforeunload', () => this.commitState?.());
this.events.once('shutdown', () => this.commitState?.());

  // --- 4) Локация/время/фон ---
  this.locationMgr = new LocationMgr(this, this.locId);
  this.locationMgr.applyBackground();

  const onPhaseChange = (phase) => {
    const ti = this.timeCycle?.getInfo?.(); const t = ti?.t ?? 0;
    this.locationMgr?.setPhaseBlend?.(phase, t);
    this.timeOfDay = phase;     // логический тег для спавна
  };
  this.cameras.main.roundPixels = true;
  this.timeCycle = new TimeCycle(this, {}, onPhaseChange);
  { const ti = this.timeCycle.getInfo(); this.locationMgr?.setPhaseBlend?.(ti.phase, ti.t); this.timeOfDay = ti.phase; }


  // --- 5) RUNTIME переменные ---
  this.bobber = null; this.biteTimer = null; this.toast = null;
  this.fish = null; this.params = null; this.jerkTO = null;
  this.fishTargetX = null; this.fishSideSpeed = 0; this.sideTimer = null;
  this.kickTweening = false;
  this.holdAcc = 0; this.HOLD_NEED = 0.1; this.SAFE_THR = 90;
  this.baseSlipChance = 0.12; this.slipTO = null;
  this.baitCharged = false;
  this.uiLock = false;

  // --- 6) UI: HUD/слоты/бары/модалки ---
  this.initInventory();
  this.createHUD();
  this.createSlots();
  this.positionPullButtonAtSlotsLevel();

  this.scale.on('resize', () => this.computeCastZone());

  this.createBarsDock();
  this.rodBar.setThreshold(this.SAFE_THR);
  this.lineBar.setThreshold(this.SAFE_THR);
  this.barsDock.setMode('idle');

  this.modals = new ModalHost(this, UI.z.modal);

  // Прогресс
  this.progress = new Progress(this);
  if (st?.level != null) this.progress.level = st.level;

  // Эффекты/редактор
  this.locationMgr.enableWaterFX({ amp: 2, waveLen: 56, speed: 22 });
  this.locEditor = new LocationEditor(this, this.locId || 'lake');
  this.locEditor.bindHotkeys();

  // Top HUD
  this.rigDepthM = this.rigDepthM ?? 1.20;
  this.hud = new TopHUD(this, {
    wallet: this.wallet,
    progress: this.progress,
    keepnetCapacity: this.keepnetCap ?? 25,
    timeCycle: this.timeCycle,

    onKeepnetClick: async () => {
      if (!this.keepnet?.length){ this.showToast?.('Садок пуст'); return; }
      const res = await openKeepnetModal(this, this.keepnet, 0);
      if (res?.action === 'release'){
        this.hud.setKeepnet(this.keepnet.length, this.keepnetCap);
        this.commitState?.();
        onWalletChange(this.wallet);
      }
    },

    onLocationPick: (locId) => {
      if (this.state === 'fight'){ this.showToast('Нельзя менять локацию во время вываживания'); return; }
      this.abortFishingDueToLocationChange();
      VM.snapshotFromStart?.(this);
      this.commitState();
      // чат: покинуть текущую комнату (подключимся в новой сцене)
      if (this.currentRoomId) this.ioClient?.leave(this.currentRoomId);
      this.scene.start('LoadLoc', { locId });
    },

    onGoBase: () => {
      if (this.state === 'fight'){ this.showToast('Нельзя на базу во время вываживания'); return; }
      this.abortFishingDueToLocationChange();
      VM.snapshotFromStart?.(this);
      this.commitState();
      this.scene.start('Base');
    },

    getSlotsTop: () => this.slots?.yTop,
    rigDepthM: this.rigDepthM,
    onDepthChange: (v) => { this.rigDepthM = v; this._applyRigToBobber(); },
    sonarCorner: 'left',
    sonarAtTop:  true,
  });

  // Инициализировать HUD-числа
  this.hud.setWallet(this.wallet.coins|0, this.wallet.gold|0);
  this.hud.setKeepnet(this.keepnet.length|0, this.keepnetCap|0);

  // Геометрия воды
  this.computeCastZone();
  this.positionPullButtonAtSlotsLevel();

// --- 7) ЧАТ: один раз, правильная комната ---
if (window.API_BASE && window.io) {                 // только если реально есть бэкенд
  this.ioClient = new ChatClient(window.io, window.API_BASE);
  this.currentRoomId = this.locationMgr.getCurrentId?.() || this.locId || 'lake';
  this.ioClient.join?.(this.currentRoomId);

  this.chatUI = new ChatOverlay(this, this.ioClient, this.currentRoomId);
  this.chatUI?.loadHistory?.(API, 40);             // безопасный вызов
}

  // --- 8) Экономика / инпут ---
  this.marketCfg = {
    kgPrice: 1,
    valuableThreshold: 0.75,
    recordThreshold: 0.95,
    pieceMult: 3.0
  };

  this.input.on('pointerdown', (p) => {
    if (this.uiLock) return;
    if (this.state === 'fight' || this.state === 'result') return;
    this.castLine(p.worldX, p.worldY);
  });

  // --- 9) Реварды ---
  setRewardSink((reward) => {
    if (!reward) return;
    const w = (this.wallet ||= { coins:0, gold:0, perks:0 });
    if (reward.wallet?.coins) w.coins = (w.coins|0) + (reward.wallet.coins|0);
    if (reward.wallet?.gold)  w.gold  = (w.gold|0)  + (reward.wallet.gold|0);
    if (reward.perks?.skillPoints) w.perks = (w.perks|0) + (reward.perks.skillPoints|0);
    this.updateWalletHUD?.();
    this.commitState?.();
    const parts = [];
    if (reward.wallet?.coins) parts.push(`🪙 +${reward.wallet.coins}`);
    if (reward.wallet?.gold)  parts.push(`⭐ +${reward.wallet.gold}`);
    if (reward.perks?.skillPoints) parts.push(`💡 +${reward.perks.skillPoints}`);
    if (parts.length) this.showToast?.(`Нагорода: ${parts.join(' ')}`);
  });

  // --- 10) Стартовое состояние UI ---
  this.setPullUI('idle');
}

// --- Нормализация фазы для спавна ---
// 4 фазы визуалки -> 3 логические для спавна
_spawnTimeFromPhase(phase){
  switch (phase) {
    case 'night': return 'night';
    case 'dusk':  return 'evening';
    case 'dawn':  return 'dawn';
    case 'day':   // рассвет и день считаем "day"
    default:      return 'day';
  }
}


  // --- Поплавок: ложится ли при текущей оснастке/глубине ---
  _shouldLieByRig(actualDepth){
    const minStand = this.bobber?.minStandingDepth ?? 0.45;
    if (actualDepth < minStand) return true;
    const EPS = 0.10; // 10 см
    return (this.rigDepthM > actualDepth + EPS);
  }
  _applyRigToBobber(){
    if (!this.bobber) return;
    const d = this.locationMgr.getDepthAtXY(this.bobber.x, this.bobber.y);
    const lie = this._shouldLieByRig(d);
    this.bobber.setShallow(lie);
  }

  // --- Инвентарь/синхронизация ---
  initInventory(){
    const invFromVM = VM.get?.('inventory');
    if (invFromVM){
      this.inventory = JSON.parse(JSON.stringify(invFromVM));
    } else {
      this.inventory = {
        rods:  ['rod_wood_1'],
        reels: ['reel_rusty'],
        lines: ['line_old_1'],
        hooks: ['hook_rusty'],
        bait:  { worm: (this.gear?.inv?.bait ?? 25) }
      };
    }
    this.gear.inv = this.gear.inv || {};
    this.gear.inv.bait = (this.inventory?.bait?.worm | 0);
  }

  // === Gear helpers ===
  getDefById(kind, id){
    const arr = GearDB[kind + 's'] || [];
    return arr.find(x => x.id === id) || null;
  }
  buildOwnedList(kind){
    const ids = this.inventory[kind + 's'] || [];
    return ids.map(id => this.getDefById(kind, id)).filter(Boolean);
  }
  mergeGearKeepingRuntime(kind, def){
    if (!def) return;
    const slot = this.gear[kind] || (this.gear[kind] = {});
    if (kind === 'rod'){
      slot.id = def.id; slot.name = def.name; slot.capKg = def.capKg;
      if (slot.durability == null) slot.durability = 100;
      return;
    }
    if (kind === 'line'){
      slot.id = def.id; slot.name = def.name; slot.capKg = def.capKg;
      if (slot.durability == null) slot.durability = 100;
      return;
    }
    if (kind === 'reel'){
      slot.id = def.id; slot.name = def.name; slot.pullBoost = def.pullBoost;
      return;
    }
    if (kind === 'hook'){
      const prevId = slot.id;
      slot.id = def.id; slot.name = def.name; slot.control = def.control;
      if (prevId !== def.id){
        const stacks = this.inventory.hookPacks || {};
        slot.count = Math.max(0, stacks[def.id] | 0);
      } else {
        if (slot.count == null || slot.count <= 0){
          const stacks = this.inventory.hookPacks || {};
          slot.count = Math.max(0, stacks[def.id] | 0);
        }
      }
      return;
    }
  }

  // --- модалка выбора снастей ---
  openGearModal(kind){
    if (this.state === 'fight') { this.showToast('Нельзя менять снасти во время вываживания'); return; }
    const supported = ['rod','reel','line','hook'];
    if (!supported.includes(kind)) return;

    const list = this.buildOwnedList(kind);
    const activeId = this.gear?.[kind]?.id ?? null;
    const onPick = (def) => {
      this.mergeGearKeepingRuntime(kind, def);
      this.slots?.update(this.gear);
      this.computeCastZone();
      this.showToast(`${def.name} экипирована`);
    };

    this.uiLock = true;
    this._gearModal = new GearModal(
      this, kind, list, activeId, onPick,
      () => { this.uiLock = false; this._gearModal = null; }
    );
  }

  // --- HUD: квадратная кнопка ---
  createHUD(){
    const W = this.scale.width, H = this.scale.height;
    this.pullBtnSize = 128;
    const btnW = this.pullBtnSize, btnH = this.pullBtnSize;
    const PAD = UI.layout.pull.outerPad;

    const tempX = W - PAD - btnW / 2;
    const tempY = H - PAD - btnH / 2;

    this.pullPressed = false;
    this.pullEnabled = false;

    this.pullBtnBg = this.add.rectangle(tempX, tempY, btnW, btnH, 0x3a3a3a, 1)
      .setStrokeStyle(2, 0xffffff, 0.5)
      .setInteractive()
      .setDepth(810);

    this.pullBtnLabel = this.add.text(tempX, tempY, '', {
      fontFamily:'Arial, sans-serif', fontSize:'22px', color:'#ffffff'
    }).setOrigin(0.5).setDepth(811);

    this.pullBtnBg.on('pointerdown', () => {
      if (!this.pullEnabled) return;
      if (this.state === 'bite') { this.attemptHook(); return; }
      if (this.state === 'fight') { this.pullPressed = true; this.pullBtnBg.setFillStyle(0x1573cc,1); }
    });
    this.pullBtnBg.on('pointerup',   () => {
      if (!this.pullEnabled) return;
      if (this.state === 'fight') { this.pullPressed = false; this.pullBtnBg.setFillStyle(0x1e90ff,1); }
    });
    this.pullBtnBg.on('pointerout',  () => {
      if (!this.pullEnabled) return;
      if (this.state === 'fight') { this.pullPressed = false; this.pullBtnBg.setFillStyle(0x1e90ff,1); }
    });
  }

  setPullUI(mode){
    this.tweens.killTweensOf(this.pullBtnBg);
    this.tweens.killTweensOf(this.pullBtnLabel);

    if (mode === 'idle'){
      this.pullEnabled = false; this.pullPressed = false;
      this.pullBtnBg.setFillStyle(0x3a3a3a, 1).setAlpha(0.35);
      this.pullBtnLabel.setText('');
    }
    if (mode === 'bite'){
      this.pullEnabled = true; this.pullPressed = false;
      this.pullBtnBg.setFillStyle(0xff8c00, 1).setAlpha(1);
      this.pullBtnLabel.setText('Подсечь');
      this.tweens.add({
        targets:[this.pullBtnBg,this.pullBtnLabel],
        alpha: { from:1, to:0.65 }, duration:500, yoyo:true, repeat:-1, ease:'Sine.inOut'
      });
    }
    if (mode === 'fight'){
      this.pullEnabled = true; this.pullPressed = false;
      this.pullBtnBg.setFillStyle(0x1e90ff, 1).setAlpha(1);
      this.pullBtnLabel.setText('Тянуть');
    }
  }

  abortFishingDueToLocationChange(){
    if (this.bobber) this.bobber?.stopAllTweens();
    this.clearAttempt();
    this.barsDock.setMode('idle');
    this.setPullUI('idle');
    this.state = 'idle';
  }

  createBarsDock(){
    const btnRect = { x: this.pullBtnBg.x, width: this.pullBtnSize, height: this.pullBtnSize };
    this.barsDock = new BarsDock(this, this.slots, btnRect);
    this.rodBar  = this.barsDock.rodBar;
    this.lineBar = this.barsDock.lineBar;
    this.barsDock.setMode('idle');
  }

  positionPullButtonAtSlotsLevel(){
    const size = this.pullBtnSize;
    const PAD = UI.layout.pull.outerPad;
    const x = this.scale.width - PAD - size / 2;
    const y = this.slots.yTop + (this.slots.h / 2);
    this.pullBtnBg.setPosition(x, y);
    this.pullBtnLabel.setPosition(x, y);
  }

  createSlots(){
    const onClick = {
      rod:  () => this.openGearModal('rod'),
      reel: () => this.openGearModal('reel'),
      line: () => this.openGearModal('line'),
      hook: () => this.openGearModal('hook'),
      bait: () => this.openBaitModal(),
    };
    this.slots = new GearSlots(this, this.gear, onClick);
  }

  setBarsVisible(v){ this.rodBar.setVisible(v); this.lineBar.setVisible(v); }

computeCastZone(){
  // const H = this.scale.height;

  // // верх воды
  // this.castTopY = Math.max(120, Math.floor(H * 0.46));

  // // низ воды = где кончается «игровой» экран (выше слотов и кнопки)
  // const btnTop   = this.pullBtnBg.y - this.pullBtnSize / 2 - 8;
  // const slotsTop = this.slots ? (this.slots.yTop - 8) : H;
  // this.castBottomY = Math.min(btnTop, slotsTop);

  // // логический «берег» и визуальный низ при бою совпадают
  // this.logicShoreY   = this.castBottomY;
  // this.visualBottomY = this.castBottomY;

  // // <- ключ: лочим воду внутри LocationMgr, чтобы ресайз её не перетёр
  // this.locationMgr.setWaterArea(this.castTopY, this.castBottomY, { lock:true });
  const area = this.locationMgr?.getWaterArea?.();
  const H = this.scale.height;

  const top    = area?.top    ?? Math.max(120, Math.floor(H*0.46));
  const bottom = area?.bottom ?? (H - 2);

  this.castTopY     = top;
  this.castBottomY  = bottom;
  this.logicShoreY  = bottom;
  this.visualBottomY = bottom;

}


  castLine(x, y){
   if (!this.locationMgr.canCastAt(x, y)){
   this.showToast('Сюда забросить нельзя'); return;
   }
  if ((this.gear.inv.bait ?? 0) <= 0){
    this.showToast('Нужна наживка (червь)'); return;
  }
    this.clearAttempt();

    this.bobber = new Bobber(this, x, y);
    this.bobber.startIdleBobbing();

    this.hud.showSonarAt(x, y);
    this.hud.setSonarFollowX(false);
    this.hud.updateSonarDot(y);

    const waterDepth = this.locationMgr.getDepthAtXY(x, y);
    const hookDepth  = Math.min(this.rigDepthM ?? 0, waterDepth);
    this._waterDepthAtCast = waterDepth;
    this._hookDepthAtCast  = hookDepth;
    this._castDepthM       = hookDepth;

    this._applyRigToBobber();

    this.state = 'waiting';
    this.barsDock.setMode('idle');
    this.setPullUI('idle');

    const delay = Phaser.Math.Between(1000,1000);
    this.biteTimer = this.time.delayedCall(delay, () => this.onBite());
  }

  onBite(){
    if (!this.bobber) return;
    this.state = 'bite';
    
const tinfo = this.timeCycle?.getInfo?.() || { phase:'day' };
const picked = spawnFish({
  bait: this._getActiveBaitId?.() ?? this.activeBaitId ?? 'worm',
  timeOfDay: this._spawnTimeFromPhase?.(tinfo.phase) ?? tinfo.phase ?? 'day',
  locationId: this.locationMgr.getCurrentId?.() || this.locationMgr.current || 'lake',
  depthM: this._hookDepthAtCast ?? this._castDepthM ?? 0,
  cast: { x: this.bobber.x, y: this.bobber.y },
  getAreaMods: (x, y) =>
    this.locationMgr.getSpeciesAreaModsAt?.(x, y) ||
    this.locationMgr.getSpotModsAt?.(x, y) || null
});


    if (!picked){
      this.showToast('Здесь на эту наживку и глубину не клюёт. Попробуй другую глубину/наживку.');
      this.state = 'waiting';
      const delay = Phaser.Math.Between(5000, 12000);
      this.biteTimer = this.time.delayedCall(delay, () => this.onBite());
      return;
    }

    this.fish = picked;
    this.bobber?.biteShake();

    this.hookActive = true;
    this.hookStartMs = this.time.now;
    this.hookMin = 250; this.hookMax = 1600; this.hookSweet = 850;
    this.hookTO = this.time.delayedCall(this.hookMax, () => {
      if (this.hookActive) this.fishEscape('Поздно подсекли — улов ушёл');
    });

    this.setPullUI('bite');
    this.showToast('Клюёт! Подсеките!');
  }

  attemptHook(){
    if (!this.hookActive) return;
    const dt = this.time.now - this.hookStartMs;
    if (dt < this.hookMin) return this.fishEscape('Слишком рано подсекли — рыба ушла');
    if (dt > this.hookMax) return this.fishEscape('Поздно подсекли — рыба ушла');

    if (this.bobber) this.tweens.killTweensOf(this.bobber);

    const halfWin = (this.hookMax - this.hookMin) / 2;
    const norm = Math.min(Math.abs(dt - this.hookSweet), halfWin) / halfWin;
    const hookQ = 1 - norm;
    this.hookQ = hookQ;
    this.slipGraceUntil = this.time.now + 2500;

    this.hookActive = false; if (this.hookTO){ this.hookTO.remove(); this.hookTO = null; }
    this.bobber?.stopAllTweens();
    this.params = calcFightParams(this.gear, this.fish, hookQ);

    // Смягчение для не-рыбы
    if (this.fish?.kind && this.fish.kind !== 'fish'){
      const K = ({ loot:0.35, trash:0.25, bycatch:0.50 }[this.fish.kind] ?? 0.35);
      this.params.rodUp         = (this.params.rodUp        ?? 18) * K;
      this.params.lineUp        = (this.params.lineUp       ?? 22) * K;
      this.params.down          = (this.params.down         ?? 12) * 0.6;
      this.params.fishPullSpeed = (this.params.fishPullSpeed?? 70) * K;
      this.params.pullSpeed     = (this.params.pullSpeed    ?? 120) * 1.0;
      this.params.escapeLimit   = Math.max(2.0, (this.params.escapeLimit ?? 3.2) * 1.6);
      const j = this.params.jerk || { add: 4, chance: 0.4, minMs: 900, maxMs: 1600 };
      j.add    = (j.add ?? 4) * (0.35 * K + 0.15);
      j.chance = Math.min(0.15, (j.chance ?? 0.4) * 0.35);
      j.minMs  = Math.max(900, (j.minMs ?? 900) * 1.5);
      j.maxMs  = Math.max(j.minMs + 200, (j.maxMs ?? 1600) * 1.6);
      this.params.jerk = j;
    }

    this.fishSideSpeed = this.params.fishPullSpeed * 0.75;
    this.fishTargetX = this.bobber.x;
    if (this.sideTimer) this.sideTimer.remove();
    this.sideTimer = this.time.addEvent({
      delay: Phaser.Math.Between(600, 1200), loop: true,
      callback: () => {
        const margin = 30;
        this.fishTargetX = Phaser.Math.Between(margin, this.scale.width - margin);
      }
    });

    this.state = 'fight';
    this.hud.setSonarFollowX(true);
    this.hud.setSonarFight?.(true);

    this.tailPx = 0;

    this.rodVal = 0; this.lineVal = 0;
    this.pullPressed = false; this.noPullTime = 0; this.holdAcc = 0; this.baitCharged = false;
    this.hud?.update();

    this.barsDock.setMode('fight');
    this.setPullUI('fight');


    const dist = this.logicShoreY - this.bobber.y;
    if (dist < 28){
      const KICK = 12;
      const targetY = Math.max(this.castTopY + 16, this.bobber.y - KICK);
      const targetX = Phaser.Math.Clamp(this.bobber.x + Phaser.Math.Between(-24, 24), 20, this.scale.width - 20);
      this.kickTweening = true;
      this.tweens.add({
        targets: this.bobber, y: targetY, x: targetX,
        duration: 140, ease: 'Sine.out', onComplete: () => { this.kickTweening = false; }
      });
    }

    this.queueSlip();
    this.scheduleNextJerk();
  }

  queueSlip(){
    if (this.slipTO) this.slipTO.remove();
    const delay = Phaser.Math.Between(2000, 2800);
    this.slipTO = this.time.delayedCall(delay, () => this.trySlip());
  }
  trySlip(){
    if (this.state !== 'fight') return;
    let chance = this.baseSlipChance / (this.gear.hook?.control ?? 1.0);
    chance *= this.pullPressed ? 0.5 : 1.1;
    if (this.rodVal >= 90 || this.lineVal >= 90) chance *= 1.25;
    if (Math.random() < chance) this.fishEscape('Рыба сошла');
    else this.queueSlip();
  }

  scheduleNextJerk(){
    if (!this.params?.jerk) return;
    const { minMs, maxMs } = this.params.jerk;
    const delay = Phaser.Math.Between(minMs, maxMs);
    this.jerkTO = this.time.delayedCall(delay, () => {
      this.applyJerk();
      this.scheduleNextJerk();
    });
  }

  applyJerk(){
    if (this.state !== 'fight' || !this.params?.jerk) return;
    const { add, chance } = this.params.jerk;
    if (Math.random() > chance) return;
    const k = this.pullPressed ? 1.0 : 1.15;
    const bump = add * (0.85 + Math.random() * 0.3) * k;
    this.rodVal  = Phaser.Math.Clamp(this.rodVal  + bump, 0, 100);
    this.lineVal = Phaser.Math.Clamp(this.lineVal + bump, 0, 100);
    this.rodBar.set(this.rodVal);
    this.lineBar.set(this.lineVal);
    if (this.bobber) this.bobber.y = Math.max(this.castTopY + 8, this.bobber.y - 4);
  }

  update(_, delta){
const ti = this.timeCycle?.getInfo?.();
if (ti){
  this.timeOfDay = ti.phase;               // для спавна
  this.hud?.clock?.update?.();             // правильная ссылка на часы
}

this.hud?.update();

if (this.bobber && (this.state === 'idle' || this.state === 'waiting')) {
  this.hud.updateSonarDot(this.bobber.y);
  this._applyRigToBobber();
}

if (this.state === 'fight' && this.bobber){
  const tension = Math.max(this.rodVal, this.lineVal) / 100;
  this.hud.updateSonarDot(this.bobber.y, {
    tension,
    reeling: this.pullPressed,
    allowXDrift: true
  });
}

if (this.state !== 'fight' || !this.params) {
  // Не-боевой апдейт — здесь можно лишь поджать bobber в пределах воды и выйти
  if (this.bobber){
    const bottomClamp = this.castBottomY;
    this.bobber.y = Phaser.Math.Clamp(this.bobber.y, this.castTopY + 8, bottomClamp);
  }
  return;
}


    const dt = delta / 1000;
    const P = this.params;

    // Временный «кик» после хука
    if (this.kickTweening){
      if (this.pullPressed){ this.rodVal += P.rodUp*dt; this.lineVal += P.lineUp*dt; }
      else                 { this.rodVal -= P.down*dt;  this.lineVal -= P.down*dt;  }
      this.rodVal  = Phaser.Math.Clamp(this.rodVal,  0, 100);
      this.lineVal = Phaser.Math.Clamp(this.lineVal, 0, 100);
      this.rodBar.set(this.rodVal); this.lineBar.set(this.lineVal);
      return;
    }

    // Напряжение
    if (this.pullPressed){ this.rodVal += P.rodUp*dt; this.lineVal += P.lineUp*dt; }
    else                 { this.rodVal -= P.down*dt;  this.lineVal -= P.down*dt;  }
    this.rodVal  = Phaser.Math.Clamp(this.rodVal,  0, 100);
    this.lineVal = Phaser.Math.Clamp(this.lineVal, 0, 100);
    this.rodBar.set(this.rodVal); this.lineBar.set(this.lineVal);

    // Поломки
    if (this.rodVal >= 100 && this.lineVal >= 100) return (Math.random()<0.5? this.breakRod(): this.breakLine());
    if (this.rodVal >= 100) return this.breakRod();
    if (this.lineVal >= 100) return this.breakLine();

    // Движение по Y
    const distToShore = this.logicShoreY - this.bobber.y;
    const nearShoreFactor = Phaser.Math.Clamp(distToShore / 160, 0.50, 1.0);

    if (this.pullPressed){
      this.noPullTime = 0;
      this.bobber.y += P.pullSpeed * nearShoreFactor * dt;
    } else {
      this.noPullTime += dt;
      const topEdge = this.castTopY + 8;
      const distTop = this.bobber.y - topEdge;
      const slow = Phaser.Math.Clamp(distTop / 60, 0.25, 1);
      this.bobber.y -= P.fishPullSpeed * slow * dt;
    }

    // Движение по X
    if (this.fishTargetX != null){
      const dx = this.fishTargetX - this.bobber.x;
      let sideMult = this.pullPressed ? 0.35 : 1.0;
      if (this.bobber.y >= this.logicShoreY - 6) sideMult *= 0.25;
      const step = this.fishSideSpeed * dt * sideMult;
      const move = Phaser.Math.Clamp(dx, -step, step);
      this.bobber.x += move;
    }

    // Клампы
    this.bobber.x = Phaser.Math.Clamp(this.bobber.x, 20, this.scale.width - 20);
    const bottomClamp = (this.state === 'fight') ? this.visualBottomY : this.castBottomY;
    this.bobber.y = Phaser.Math.Clamp(this.bobber.y, this.castTopY + 8, bottomClamp);

    // «Ушла вверх»
    if (this.noPullTime > P.escapeLimit || this.bobber.y <= this.castTopY + 8){
      return this.fishEscape('Рыба сорвалась');
    }

    // Удержание у берега
    const atShore = (this.bobber.y >= this.logicShoreY - 6);
    const tensionMax = Math.max(this.rodVal, this.lineVal);
    const safe = tensionMax < (this.SAFE_THR + 10);
    if (atShore && safe){
      const k = this.pullPressed ? 1.0 : 0.6;
      this.holdAcc += dt * k;
      if (this.holdAcc >= this.HOLD_NEED) return this.landFish();
    } else {
      this.holdAcc = 0;
    }
  }

  breakRod(){
    this.showToast('Удочка сломалась!');
    this.gear.rod.durability = Math.max(0, (this.gear.rod.durability ?? 100) - 20);
    this.chargeBaitOnce();
    this.slots?.update(this.gear);
    this.endFight('break');
  }

  breakLine(){
    this.showToast('Леска порвалась!');
    this.gear.line.durability = Math.max(0, (this.gear.line.durability ?? 100) - 25);

    const hid = this.gear.hook?.id;
    if (hid){
      const cur = this.gear.hook.count|0;
      this.gear.hook.count = Math.max(0, cur - 1);
      const stacks = this.inventory.hookPacks || (this.inventory.hookPacks = {});
      stacks[hid] = Math.max(0, (stacks[hid]|0) - 1);
      if (stacks[hid] === 0) this.showToast('Крючки закончились');
    }

    this.chargeBaitOnce();
    this.slots?.update(this.gear);
    this.endFight('break');
  }

  fishEscape(msg='Рыба ушла'){
    this.showToast(msg);
    this.chargeBaitOnce();
    this.endFight('escape');
  }

  // ——— Финал поимки ———
async landFish(){
  this.chargeBaitOnce();
  const pick = this.fish;

  // общий UI-переход из боя
  this.barsDock.setMode('idle');
  this.setPullUI('idle');

  // общий контекст для квеста/спавна
  const questCtx = {
    locationId: this.locationMgr.getCurrentId?.() || this.locationMgr.current || this.locId || 'lake',
    depthM:     this._hookDepthAtCast ?? this._castDepthM ?? this.rigDepthM,
    bait:       this._getActiveBaitId?.() ?? this.activeBaitId ?? 'worm'
  };

  // КАРТИНКА для карточки
  pick.imageKey = pick.imageKey || (pick.kind==='fish' ? PhotoBank.key('fish', pick.id)
                                                       : PhotoBank.key('pick', pick.id));

  // Переходим в "result" на время модалки
  const prevState = this.state;
  const prevLock  = this.uiLock;
  this.state  = 'result';
  this.uiLock = true;

  // ← ПОКАЗЫВАЕМ МОДАЛКУ и одновременно триггерим квесты (внутри handleCatch)
  const action = await handleCatch(this, pick, questCtx);
  // action: 'keep'|'release' для рыбы, 'take'|'drop' для лута

  // ВОЗВРАТ UI
  this.uiLock = prevLock;
  this.state  = 'idle';

  if (pick.kind !== 'fish') {
    // ЛУТ/МУСОР — монеты, если взяли
    const coins = pick?.reward?.coins | 0;
    if (action === 'take' && coins > 0) {
      this.wallet.coins = (this.wallet.coins|0) + coins;
      this.hud.setWallet(this.wallet.coins|0, this.wallet.gold|0);
      this.commitState?.();
      onWalletChange(this.wallet); // QUEST HOOKСS
    }
    this.setPullUI('idle');
    this.clearAttempt();
    return;
  }

  // РЫБА — XP + садок
  const award = (released) => {
    const base = this.progress.xpForFish(pick);
    const res  = this.progress.grantCatchXP(pick, { released });
    this.hud?.level?.update?.();
    if (res.leveled > 0) this.hud?.level?.pulse?.();
    onLevelChange({ level: this.progress.level, xp: this.progress.xp }); // QUEST HOOKS
    this.showToast(`+${released ? base * 2 : base} XP`);
  };

  if (action === 'keep' && this.keepnet.length < this.keepnetCap){
    this.keepnet.push(pick);
    this.hud.setKeepnet(this.keepnet.length, this.keepnetCap);
    this.commitState?.();
    award(false);
  } else {
    award(true);
  }

 this.ioClient?.announceCatch?.({
  fishId: pick.id, name: pick.name, weightKg: pick.weightKg, lengthCm: pick.lengthCm,
  rarity: pick.rarity, photoKey: pick.imageKey
});

  this.clearAttempt();
  this.state = 'idle';
}

updateWalletHUD(){
  this.hud?.setWallet(this.wallet.coins|0, this.wallet.gold|0, this.wallet.perks|0);
}

  endFight(){
    this.hud.setSonarFollowX(false);
    this.hud.setSonarFight?.(false);
    this.clearAttempt();
    this.barsDock.setMode('idle');
    this.setPullUI('idle');
    this.state = 'idle';
    this.tailPx = 0;
  }

  // ——— Наживка ———
  _getActiveBaitId(){ return this.activeBaitId || 'worm'; }
  _getBaitCount(){
    const id = this._getActiveBaitId();
    return this.inventory?.bait?.[id] | 0;
  }
  _setBaitCount(v){
    const id = this._getActiveBaitId();
    const bag = this.inventory.bait || (this.inventory.bait = {});
    bag[id] = Math.max(0, v|0);
    this.gear.inv.bait = bag[id];
    this.slots?.update(this.gear);
  }
  chargeBaitOnce(){
    if (this.baitCharged) return;
    const n = this._getBaitCount();
    if (n <= 0) return;
    this.baitCharged = true;
    this._setBaitCount(n - 1);
  }

  openBaitModal(){
    if (this.state === 'fight'){ this.showToast('Нельзя менять наживку во время вываживания'); return; }

    const W = this.scale.width, H = this.scale.height;
    const PW = Math.min(520, W-80), PH = Math.min(360, H-120);
    const cx = Math.round(W/2), cy = Math.round(H/2);
    const D  = 2100;

    this.uiLock = true;
    const ui = this.add.container(0,0).setDepth(D);

    const overlay = this.add.rectangle(0,0,W,H,0x000000,0.6)
      .setOrigin(0,0).setScrollFactor(0).setInteractive();
    const shadow = this.add.rectangle(cx+2, cy+3, PW, PH, 0x000000, 0.22);
    const panel  = this.add.rectangle(cx, cy, PW, PH, 0x1f2433, 1).setStrokeStyle(2, 0xffffff, 0.22);
    const title  = this.add.text(cx, cy - PH/2 + 16, 'Выбор наживки', {
      fontFamily:'Arial, sans-serif', fontSize:'22px', color:'#ffffff'
    }).setOrigin(0.5,0);
    const close = this.add.text(cx + PW/2 - 18, cy - PH/2 + 6, '✕', {
      fontFamily:'Arial, sans-serif', fontSize:'22px', color:'#ffffff'
    }).setOrigin(1,0).setInteractive();

    ui.add([overlay, shadow, panel, title, close]);

    const bag = this.inventory?.bait || {};
    const ids = Object.keys(bag);
    if (ids.length === 0){
      const t = this.add.text(cx, cy, 'Наживки нет', { fontFamily:'Arial, sans-serif', fontSize:'16px', color:'#cfd8dc' }).setOrigin(0.5);
      ui.add(t);
    } else {
      const names = {};
      (ShopCatalog?.items?.bait || []).forEach(b => names[b.id] = b.name);

      const rowH = 56, gap = 10;
      const totalH = ids.length*rowH + (ids.length-1)*gap;
      let y = Math.round(cy - totalH/2 + rowH/2) + 10;

      ids.forEach((id)=>{
        const w = PW - 40, h = rowH;
        const g = this.add.container(cx, y);
        const bg = this.add.rectangle(0,0,w,h,0x2a3144,1).setStrokeStyle(2,0xffffff,0.16).setInteractive({useHandCursor:true});
        const label = names[id] || id;
        const count = bag[id] | 0;

        const nameTxt  = this.add.text(-w/2 + 12, 0, label, { fontFamily:'Arial, sans-serif', fontSize:'16px', color:'#ffffff' }).setOrigin(0,0.5);
        const cntTxt   = this.add.text(nameTxt.x + nameTxt.width + 10, 0, `• ${count} шт.`, { fontFamily:'Arial, sans-serif', fontSize:'14px', color:'#a7ffeb' }).setOrigin(0,0.5);

        const btnW=110, btnH=30;
        const btn = this.add.rectangle(w/2 - btnW/2 - 8, 0, btnW, btnH, 0x3b4662,1).setStrokeStyle(2,0xffffff,0.18);
        const btnLbl = this.add.text(btn.x, btn.y, (count>0?'Выбрать':'Нет'), { fontFamily:'Arial, sans-serif', fontSize:'14px', color:'#ffffff' }).setOrigin(0.5);

        if (count>0){
          btn.setInteractive({useHandCursor:true})
            .on('pointerover', ()=> btn.setFillStyle(0x435074,1))
            .on('pointerout',  ()=> btn.setFillStyle(0x3b4662,1))
            .on('pointerdown', ()=> {
              this.activeBaitId = id;
              this.gear.inv.bait = bag[id] | 0;
              this.slots?.update(this.gear);
              this.showToast(`Наживка: ${label}`);
              this.commitState?.();
              cleanup();
            });
        } else {
          btn.setFillStyle(0x2c3446,1);
          btnLbl.setColor('#bfc7d9');
        }

        g.add([bg, nameTxt, cntTxt, btn, btnLbl]);
        ui.add(g);
        y += rowH + gap;
      });
    }

    const cleanup = ()=>{
      ui.destroy();
      this.time.delayedCall(16, ()=> this.uiLock = false);
    };
    close.on('pointerdown', cleanup);
    overlay.on('pointerdown', (p)=>{ p.stopPropagation(); cleanup(); });
    this.input.keyboard?.once('keydown-ESC', cleanup);
  }

  clearAttempt(){
    if (this.hookTO) { this.hookTO.remove(); this.hookTO = null; }
    if (this.slipTO) { this.slipTO.remove(); this.slipTO = null; }
    this.hookActive = false;

    if (this.sideTimer) { this.sideTimer.remove(); this.sideTimer = null; }
    this.fishTargetX = null; this.fishSideSpeed = 0;

    if (this.biteTimer) { this.biteTimer.remove(); this.biteTimer = null; }

    if (this.bobber){
      this.bobber.stopAllTweens();
      this.bobber.destroy();
      this.bobber = null;
    }

    this.hud.hideSonar();
    this.hud.setSonarFight?.(false);   

    this.fish = null; this.params = null;
    this.kickTweening = false;
    this.holdAcc = 0;
    this.baitCharged = false;
    if (this.jerkTO) { this.jerkTO.remove(); this.jerkTO = null; }
  }

  showToast(text){
    const W = this.scale.width, H = this.scale.height;
    if (this.toast) this.toast.destroy();
    const t = this.add.text(W/2, H-20, text, {
      fontFamily:'Arial, sans-serif', fontSize:'18px', color:'#ffffff'
    }).setOrigin(0.5,1);
    this.toast = t;
    this.tweens.add({ targets:t, alpha:0, duration:1500, delay:900, onComplete:()=>t.destroy() });
  }

}

export default Start;
