// ui/theme.js
export const UI = {
  // относительный масштаб интерфейса
  scale(scene){
    const W = scene.scale.width, H = scene.scale.height;
    return Phaser.Math.Clamp(Math.min(W/1280, H/720), 0.85, 1.25);
  },
  rem(scene, px){ return Math.round(px * UI.scale(scene)); },

  z: {
    bg: 11100,
    world: 0,
    bobber: 5,
    // низ
    slots: 700,
    bars: 705,
    bottomHudBg: 704,
    // верх
    levelBadge: 940,
    keepnet: 950,
    wallet: 952,
    sonar: 965,
    depthBtn: 980,
    map: 900,
    modal: 2000,
    market: 2100
  },

  color: {
    panel: 0x111522,
    panelStroke: { c: 0xffffff, a: 0.18 },
    tile: 0x2a3348,
    tileHover: 0x33405a,
    good: 0x2ecc71,
    warn: 0xe67e22
  },

  radius: 14,
  pad: 16,

  // ===== новые токены лайаута =====
  layout: {
    sonar: {
      anchorX: 150,                   // якорь слева
      size: { w: 240, h: 150 },       // габариты панели
      raiseRem: 456,                   // было 456px → теперь UI.rem(scene, 96)
      depthAttachGap: 14              // зазор между локатором и кнопкой глубины
    },
    top: {
      gap: 12,                        // отступы в шапке
      btnW: 160
    },
    pull: {
      outerPad: 18                    // отступ кнопки «Тянуть» от краёв
    }
  }
};
export default UI;
