// src/ui/TopHUD.js
import UI from './theme.js';
import { KeepnetBadge } from './KeepnetBadge.js';
import { ClockHUD } from './ClockHUD.js';
import { LevelBadge } from './LevelBadge.js';
import { DepthSonar } from './DepthSonar.js';
import { DepthCtrl } from './DepthCtrl.js';
import ActionDock from './ActionDock.js';
import { openQuestsModal } from './QuestsModal.js';
import { ActiveQuestHUD } from './ActiveQuestHUD.js';

export class TopHUD {
  constructor(scene, opts = {}) {
    this.s = scene;
    this.opts = opts;
    this.levelOffsetY = opts.levelOffsetY ?? 0;

    this.getSlotsTop   = opts.getSlotsTop || null;
    this.onDepthChange = opts.onDepthChange || null;
    this.sonarCorner   = opts.sonarCorner || 'left';
    this.rigDepthM     = (typeof opts.rigDepthM === 'number') ? opts.rigDepthM : 1.2;

    // слева
    this.level  = new LevelBadge(scene, opts.progress);

    // центр
    this.clock  = new ClockHUD(scene, opts.timeCycle, {
      ringR: UI.rem(scene, 12),
      ringTh: Math.max(2, Math.round(UI.rem(scene, 4))),
      depth: (UI.z.wallet ?? 940) - 1
    });

    // справа (садок)
    this.keepnet = new KeepnetBadge(scene, opts.keepnetCapacity ?? 25, opts.onKeepnetClick);

    // комбодок (база/локации/кошелёк/перки)
    this.actionDock = new ActionDock(scene, {
      onBase: () => opts.onGoBase?.(),
      onLocationPick: (locId) => opts.onLocationPick?.(locId),
      wallet: opts.wallet,
      showPerks: true
    });


    // Мини-карточка активного квеста (клик открывает модалку)
    this.activeQuest = new ActiveQuestHUD(scene, {
      width: 230,
      onOpen: () => openQuestsModal(scene)
    });

    // сонар + глубина
    this.sonar = new DepthSonar(scene, {
      x: UI.layout.sonar.anchorX,
      y: 0,
      w: UI.layout.sonar.size.w,
      h: UI.layout.sonar.size.h
    });
    this.depthCtrl = new DepthCtrl(
      scene,
      this.rigDepthM,
      { x: 0, y: 0 },
      (v) => { this.rigDepthM = v; this.onDepthChange?.(v); }
    );
    this.sonar.attachDepthCtrl(this.depthCtrl, UI.layout.sonar.depthAttachGap);

    // лэйаут
    this.layout = this.layout.bind(this);
    this.layout();
    scene.scale.on('resize', this.layout);
  }

  // публичное API
  showSonarAt(x, y){ this.sonar?.show(x, y); }
  hideSonar(){ this.sonar?.hide(); }
  setSonarFollowX(v){ this.sonar?.setDotFollowX(!!v); }
  setSonarFight(v){ this.sonar?.setFight(!!v); }
  updateSonarDot(y, opts = {}){ this.sonar?.updateDot(y, opts); }

  setWallet(coins, gold, perks=0){ this.actionDock?.setWallet(coins, gold, perks); }
  setKeepnet(count, cap){ this.keepnet?.set(count|0, cap|0); }

  update(){
    this.clock.update();
    this.activeQuest?.update();
  }

  layout(){
    const W   = this.s.scale.width;
    const gap = UI.rem(this.s, UI.layout.top.gap);
    const m   = gap;

    // размеры часов (нужны для второго ряда)
    this.clock.update(true);
    const ckB = this.clock.getBounds?.() ?? new Phaser.Geom.Rectangle(0,0,180,40);

    // размеры дока (верхний ряд)
    const dockW = this.actionDock.w ?? 360;
    const dockH = this.actionDock.h ?? 40;

    // ===== ROW 1: ActionDock (центр) + Keepnet (справа) =====
    const row1Y = m + Math.round(dockH/2);

    // Keepnet справа
    const knW  = this.keepnet.w ?? 160;
    const knH  = this.keepnet.h ?? 42;
    const knX  = W - m - knW;
    const knY  = Math.round(row1Y - knH/2);
    this.keepnet.setPosition?.(knX, knY);

    // Док — стремится к центру, не врезается в садок
    const maxRight = knX - gap;
    const minLeft  = m;
    let dockX = Math.round(W/2);
    let left  = dockX - dockW/2;
    let right = dockX + dockW/2;

    if (right > maxRight) {
      const shift = right - maxRight;
      dockX -= shift; left -= shift; right -= shift;
    }
    if (left < minLeft) {
      dockX = minLeft + Math.round(dockW/2);
      left  = dockX - dockW/2; right = dockX + dockW/2;
    }
    this.actionDock.setPosition(dockX, row1Y);

    // ---- Активная карточка между доком и садком (или под садок)
    const aqMinW = 160;
    const aqMaxW = 360;

    const leftEdge  = right + gap;   // сразу после дока
    const rightEdge = knX - gap;     // перед садком
    const avail     = Math.max(0, rightEdge - leftEdge);

    if (avail >= aqMinW) {
      // помещаем между доком и садком
      const useW = Math.min(aqMaxW, avail);
      this.activeQuest.setWidth(useW);
      const aqY = Math.round(row1Y - this.activeQuest.h/2);
      this.activeQuest.setPosition(leftEdge, aqY).setVisible(true);
    } else {
      // мало места — переносим под садок
      const underGap = Math.round(gap * 0.75);
      const useW = Math.min(aqMaxW, Math.max(aqMinW, knW - gap));
      this.activeQuest.setWidth(useW);
      const centerX = knX + Math.round((knW - useW) / 2);
      const aqY = row1Y + Math.ceil(knH/2) + underGap + Math.round(this.activeQuest.h/2);
      this.activeQuest.setPosition(centerX, aqY).setVisible(true);
    }

    // ===== ROW 2: Clock (центр) + Level (слева) =====
    const vgap   = Math.round(gap * 0.75);
    const row2Y  = row1Y + Math.ceil(dockH/2) + vgap + Math.round(ckB.height/2);

    // часы строго по центру
    this.clock.setPosition(Math.round(W/2), row2Y);

    // левый бейдж уровня — по второй строке
    const lvlY = Math.max(2, m + this.levelOffsetY);
    this.level.setPosition?.(m, lvlY);

    // Сонар — к линии слотов
    this.placeSonar(m, W);
  }

  placeSonar(m, W){
    if (!this.sonar?.setPosition) return;

    const baselineY = (typeof this.getSlotsTop === 'function')
      ? (this.getSlotsTop() ?? Math.round(this.s.scale.height * 0.72))
      : Math.round(this.s.scale.height * 0.72);

    const raise  = UI.rem(this.s, UI.layout.sonar.raiseRem);
    const sonarY = Math.round(baselineY - raise);

    const sizeW   = UI.layout.sonar.size?.w ?? 240;
    const xLeft   = UI.layout.sonar.anchorX|0;
    const xRight  = Math.max(m, W - sizeW - m);
    const x       = (this.sonarCorner === 'right') ? xRight : xLeft;

    this.sonar.setPosition(x, sonarY);
  }

  destroy(){
    this.s.scale.off('resize', this.layout);
    this.activeQuest?.destroy();
  }
}

export default TopHUD;
