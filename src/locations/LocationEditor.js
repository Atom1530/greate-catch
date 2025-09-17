// src/locations/LocationEditor.js
// Автономный редактор castMask и speciesAreas.
// Работает напрямую с LOCATIONS и сценой. LocationMgr НЕ требуется.

import { LOCATIONS } from '../data/locations.js';

export class LocationEditor {
  constructor(scene, locationId = 'lake') {
    this.s = scene;
    this.locId = locationId;

    // состояния редакторов
    this._maskEdit = null;
    this._spEdit = null;

    // служебное
    this._hotkeysBound = false;
    this._shutdownBound = false;
    this._prevCursor = '';

    // авто-отвязка на выключение сцены
    if (!this._shutdownBound) {
      this._shutdownBound = true;
      this.s.events?.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        this.stopCastMaskEditor();
        this.stopSpeciesAreasEditor();
        if (this._hotkeysBound && this._hotKeyHandler) {
          this.s.input.keyboard?.off('keydown', this._hotKeyHandler);
          this._hotkeysBound = false;
        }
      });
    }
  }

  // -------- утилиты доступа / геометрия --------
  get loc() {
    return LOCATIONS.find(l => l.id === this.locId) || (LOCATIONS[0] ?? null);
  }
  setLocation(id) { this.locId = id; }

  // water bounds из конфига (px/frac → px)
  _waterBounds() {
    const H = this.s.scale.height;
    const w = this.loc?.water || {};
    const toPx = (v) => (v <= 1 ? Math.round(v * H) : v|0);
    const top = (w.top != null) ? toPx(w.top) : 0;
    const shore = (w.bottom != null) ? toPx(w.bottom) : H;
    return { top, shore };
  }

  _toUV(x, y) {
    const W = Math.max(1, this.s.scale.width);
    const { top, shore } = this._waterBounds();
    const u = Phaser.Math.Clamp(x / W, 0, 1);
    const v = Phaser.Math.Clamp((y - top) / Math.max(1, (shore - top)), 0, 1);
    return { u, v };
  }
  _toXY([u, v]) {
    const W = this.s.scale.width;
    const { top, shore } = this._waterBounds();
    const Hwater = Math.max(1, shore - top);
    return { x: u * W, y: top + v * Hwater };
  }

  static _distPtSeg({u, v}, [ax, ay], [bx, by]) {
    const vx = bx - ax, vy = by - ay;
    const wx = u  - ax, wy = v  - ay;
    const c1 = vx*wx + vy*wy;
    if (c1 <= 0) return Math.hypot(u-ax, v-ay);
    const c2 = vx*vx + vy*vy;
    if (c2 <= c1) return Math.hypot(u-bx, v-by);
    const t = c1 / Math.max(1e-9, c2);
    const px = ax + t*vx, py = ay + t*vy;
    return Math.hypot(u - px, v - py);
  }
  static _insertPointIntoNearestEdge(poly, ptUV) {
    if (!poly.length) { poly.push([ptUV.u, ptUV.v]); return; }
    let bestI = 0, bestD = Infinity;
    for (let i=0;i<poly.length;i++) {
      const a = poly[i], b = poly[(i+1)%poly.length];
      const d = LocationEditor._distPtSeg(ptUV, a, b);
      if (d < bestD) { bestD = d; bestI = i; }
    }
    poly.splice(bestI+1, 0, [ptUV.u, ptUV.v]);
  }
  static _findNearestVertex(poly, ptUV, maxDist=0.03) {
    let idx = -1, best = Infinity;
    for (let i=0;i<poly.length;i++) {
      const [u,v] = poly[i];
      const d = Math.hypot(ptUV.u - u, ptUV.v - v);
      if (d < best) { best = d; idx = i; }
    }
    return (best <= maxDist) ? idx : -1;
  }

  // ---------- удобные публичные переключатели (необязательные) ----------
  isCastMaskEditing(){ return !!this._maskEdit; }
  isSpeciesEditing(){ return !!this._spEdit; }

  toggleCastMaskEditor(force){
    if (force === true)  return this.startCastMaskEditor();
    if (force === false) return this.stopCastMaskEditor();
    return this._maskEdit ? this.stopCastMaskEditor() : this.startCastMaskEditor();
  }
  toggleSpeciesAreasEditor(force){
    if (force === true)  return this.startSpeciesAreasEditor();
    if (force === false) return this.stopSpeciesAreasEditor();
    return this._spEdit ? this.stopSpeciesAreasEditor() : this.startSpeciesAreasEditor();
  }

  // Alt+M — маска, Alt+P — виды
  bindHotkeys(){
    if (this._hotkeysBound) return;
    const kb = this.s.input.keyboard; if (!kb) return;
    this._hotKeyHandler = (e) => {
      if (e.altKey && e.code === 'KeyM') { e.preventDefault(); this.toggleCastMaskEditor(); }
      if (e.altKey && e.code === 'KeyP') { e.preventDefault(); this.toggleSpeciesAreasEditor(); }
    };
    kb.on('keydown', this._hotKeyHandler);
    this._hotkeysBound = true;
  }

  // ---------------- CastMask editor ----------------
  startCastMaskEditor() {
    if (this._maskEdit) return; // уже запущен
    this.stopSpeciesAreasEditor(); // одновременно активен только один редактор

    const loc = this.loc;
    const mask = (loc.castMask ||= {});
    mask.allowedPolys = mask.allowedPolys || [];
    mask.blockedPolys = mask.blockedPolys || [];

    const state = { layer: 'allowedPolys', polyIdx: 0 };

    // живые размеры воды
    let W = this.s.scale.width;
    let { top: TOP, shore: SHORE } = this._waterBounds();
    let Hwater = Math.max(1, SHORE - TOP);

    const toUV = (x, y) => ({
      u: Phaser.Math.Clamp(x / Math.max(1, W), 0, 1),
      v: Phaser.Math.Clamp((y - TOP) / Math.max(1, Hwater), 0, 1),
    });
    const toXY = ([u, v]) => ({ x: u * W, y: TOP + v * Hwater });

    // Курсор
    this._prevCursor = this.s.input.manager?.canvas?.style?.cursor || '';
    try { this.s.input.manager.canvas.style.cursor = 'crosshair'; } catch {}

    // слои
    const overlay = this.s.add.rectangle(0, 0, this.s.scale.width, this.s.scale.height, 0x000000, 0)
      .setOrigin(0, 0).setDepth(5999).setScrollFactor(0).setInteractive(); // клики ловим только на overlay
    const gAllowed = this.s.add.graphics().setDepth(6000);
    const gBlocked = this.s.add.graphics().setDepth(6000);
    const handles  = this.s.add.container(0, 0).setDepth(6001);

    const ensurePoly = (layer) => {
      const list = mask[layer];
      if (!list.length) list.push([]);
      if (state.polyIdx >= list.length) state.polyIdx = list.length - 1;
      return list[state.polyIdx];
    };

    const colors = {
      allowed: { fill: 0x00ff88, alpha: 0.18, stroke: 0x00ff88, hFill: 0xffffff },
      blocked: { fill: 0xff3355, alpha: 0.25, stroke: 0xff3355, hFill: 0xffffff },
    };

    // живой превью: применяем маску к BG-воде (если на сцене есть LocationMgr)
    const previewApply = () => this.s.locationMgr?.setWaterMaskFromCastMask?.(mask);

    const repaintPolys = () => {
      const drawSet = (g, polys, col) => {
        g.clear();
        polys.forEach(poly => {
          if (!Array.isArray(poly) || poly.length < 3) return;
          g.fillStyle(col.fill, col.alpha).lineStyle(2, col.stroke, 0.9);
          g.beginPath();
          const p0 = toXY(poly[0]); g.moveTo(p0.x, p0.y);
          for (let i = 1; i < poly.length; i++) { const p = toXY(poly[i]); g.lineTo(p.x, p.y); }
          g.closePath(); g.fillPath(); g.strokePath();
        });
      };
      drawSet(gAllowed, mask.allowedPolys, colors.allowed);
      drawSet(gBlocked, mask.blockedPolys, colors.blocked);
    };

    const rebuildHandles = () => {
      handles.removeAll(true);
      const active = ensurePoly(state.layer);
      const col = (state.layer === 'allowedPolys') ? colors.allowed : colors.blocked;

      for (let i = 0; i < active.length; i++) {
        const { x, y } = toXY(active[i]);
        const c = this.s.add.circle(x, y, 7, col.hFill, 1)
          .setStrokeStyle(2, 0x1b2638, 0.8)
          .setInteractive({ draggable: true });

        c.on('drag', (_p, dragX, dragY) => {
          const uv = toUV(dragX, dragY);
          active[i][0] = uv.u; active[i][1] = uv.v;
          c.setPosition(dragX, dragY);
          repaintPolys(); previewApply();
        });
        this.s.input.setDraggable(c, true);
        handles.add(c);
      }
    };

    const repaintAll = () => { repaintPolys(); rebuildHandles(); previewApply(); };

    const addAtCursor = () => {
      const active = ensurePoly(state.layer);
      const ptr = this.s.input.activePointer;
      const uv = toUV(ptr.worldX ?? ptr.x, ptr.worldY ?? ptr.y);
      LocationEditor._insertPointIntoNearestEdge(active, uv);
      repaintAll();
      this.s.showToast?.(state.layer === 'blockedPolys' ? 'Добавлена КРАСНАЯ точка' : 'Добавлена ЗЕЛЁНАЯ точка');
    };

    // события — вешаем на overlay, чтобы после destroy всё ушло вместе
    const onOverlayPointerDown = (p) => {
      const active = ensurePoly(state.layer);
      const uv = toUV(p.worldX ?? p.x, p.worldY ?? p.y);
      if (p.event?.shiftKey) { LocationEditor._insertPointIntoNearestEdge(active, uv); repaintAll(); return; }
      if (p.event?.altKey)   { const idx = LocationEditor._findNearestVertex(active, uv); if (idx >= 0) { active.splice(idx,1); repaintAll(); } return; }
    };
    overlay.on('pointerdown', onOverlayPointerDown);

    // клавиши — глобальные
    const roundN = (x, n = 3) => Math.round(x * Math.pow(10, n)) / Math.pow(10, n);
    const roundPolys = (polys, n = 3) => polys.map(poly => poly.map(([u, v]) => [roundN(u, n), roundN(v, n)]));

    const onKey = (e) => {
      if (e.code === 'KeyG' && !e.ctrlKey) { state.layer = 'allowedPolys'; this.s.showToast?.('Слой: ЗЕЛЁНЫЙ (allowed)'); repaintAll(); }
      if (e.code === 'KeyR' && !e.ctrlKey) { state.layer = 'blockedPolys'; this.s.showToast?.('Слой: КРАСНЫЙ (blocked)'); repaintAll(); }
      if (e.code === 'KeyG' && e.ctrlKey) { addAtCursor(); e.preventDefault(); }
      if (e.code === 'KeyR' && e.ctrlKey) { state.layer = 'blockedPolys'; addAtCursor(); e.preventDefault(); }
      if (e.code === 'KeyN' && !e.ctrlKey) {
        mask[state.layer].push([]); state.polyIdx = mask[state.layer].length - 1; repaintAll();
        this.s.showToast?.('Новый полигон в текущем слое');
      }
      // SAVE → в буфер готовый блок castMask
      if (e.code === 'KeyS' && !e.ctrlKey) {
        const A = roundPolys(mask.allowedPolys, 3);
        const B = roundPolys(mask.blockedPolys, 3);
        mask.allowedPolys = A; mask.blockedPolys = B;
        repaintAll();
        const payload = `castMask: ${JSON.stringify({ allowedPolys: A, blockedPolys: B }, null, 2)}`;
        console.log(payload);
        if (navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(payload)
            .then(() => this.s.showToast?.('castMask сохранён в буфер'))
            .catch(() => this.s.showToast?.('castMask выведен в консоль'));
        } else {
          this.s.showToast?.('castMask выведен в консоль');
        }
      }
      if (e.code === 'Escape') this.stopCastMaskEditor();
    };
    this.s.input.keyboard?.on('keydown', onKey);

    // ресайз: обновить геометрию
    const onResize = () => {
      W = this.s.scale.width;
      const wb = this._waterBounds();
      TOP = wb.top; SHORE = wb.shore; Hwater = Math.max(1, SHORE - TOP);
      overlay.setSize(this.s.scale.width, this.s.scale.height);
      repaintAll();
    };
    this.s.scale.on('resize', onResize);

    this._maskEdit = { overlay, gAllowed, gBlocked, handles, onKey, onResize };

    repaintAll();
    this.s.showToast?.('Редактор маски: G/R — слой, Ctrl+G/R — точка, Shift=добавить, Alt=удалить, N — новый, S — сохранить, Esc — выход');
  }

  stopCastMaskEditor() {
    const E = this._maskEdit; if (!E) return;

    // вернуть курсор
    try { if (this._prevCursor != null) this.s.input.manager.canvas.style.cursor = this._prevCursor; } catch {}

    this.s.input.keyboard?.off('keydown', E.onKey);
    this.s.scale.off('resize', E.onResize);
    E.overlay?.destroy(); E.gAllowed?.destroy(); E.gBlocked?.destroy(); E.handles?.destroy();

    this._maskEdit = null;
  }

  // ---------------- SpeciesAreas editor ----------------
  startSpeciesAreasEditor() {
    if (this._spEdit) return; // уже активен
    this.stopCastMaskEditor();

    const loc = (this.loc.speciesAreas ||= []);
    const speciesList = Object.keys((this.s.SPAWN_TABLES||{})[this.locId] || {});
    let curSpIdx = Math.max(0, speciesList.indexOf((loc[0]?.speciesId)||speciesList[0]||'pike'));
    const curSpecies = () => speciesList[curSpIdx] || 'pike';

    // размеры
    let W = this.s.scale.width;
    let { top: TOP, shore: SHORE } = this._waterBounds();
    let Hwater = Math.max(1, SHORE - TOP);

    // Курсор
    this._prevCursor = this.s.input.manager?.canvas?.style?.cursor || '';
    try { this.s.input.manager.canvas.style.cursor = 'crosshair'; } catch {}

    const overlay = this.s.add.rectangle(0,0,W,this.s.scale.height,0x000000,0).setOrigin(0).setDepth(7000).setInteractive();
    const g = this.s.add.graphics().setDepth(7001);
    const handles = this.s.add.container(0,0).setDepth(7002);

    const toXY = ([u,v]) => ({ x: u*W, y: TOP + v*Hwater });
    const toUV = (x,y) => {
      return {
        u: Phaser.Math.Clamp(x/Math.max(1,W), 0, 1),
        v: Phaser.Math.Clamp((y-TOP)/Math.max(1,Hwater), 0, 1)
      };
    };

    const ensureLayer = () => {
      const id = curSpecies();
      let layer = this.loc.speciesAreas.find(a => a.speciesId === id);
      if (!layer) { layer = { speciesId:id, mult:1.5, polys:[] }; this.loc.speciesAreas.push(layer); }
      return layer;
    };

    const repaint = () => {
      g.clear(); handles.removeAll(true);
      for (const a of this.loc.speciesAreas) {
        const active = a.speciesId === curSpecies();
        const col = active ? 0xffff66 : 0x66ccff;
        const alpha = active ? 0.25 : 0.12;
        g.lineStyle(2, col, 0.9);
        g.fillStyle(col, alpha);
        for (const poly of (a.polys||[])) {
          if (poly.length < 3) continue;
          const p0 = toXY(poly[0]); g.beginPath(); g.moveTo(p0.x, p0.y);
          for (let i=1;i<poly.length;i++){ const p=toXY(poly[i]); g.lineTo(p.x,p.y); }
          g.closePath(); g.fillPath(); g.strokePath();
        }
      }

      const layer = ensureLayer();
      for (const poly of (layer.polys||[])) {
        poly.forEach((uv, vi) => {
          const {x,y} = toXY(uv);
          const c = this.s.add.circle(x,y,7,0xffffff,1).setStrokeStyle(2,0x1b2638,0.8)
            .setInteractive({ draggable:true });
          this.s.input.setDraggable(c, true);
          c.on('drag', (_p, dx, dy) => {
            const p = toUV(dx, dy);
            poly[vi][0] = p.u; poly[vi][1] = p.v; repaint();
          });
          handles.add(c);
        });
      }

      const info = this.s.add.text(100, 330,
        `Вид: ${curSpecies()} (mult=${ensureLayer().mult.toFixed(2)})  |  Shift+клик=точка  Alt+клик=удалить  N=новый полигон  [ ]=множитель  Q/E=вид  S=лог  Esc=выход`,
        { fontSize:'16px', color:'#ffffff', }).setDepth(7003).setScrollFactor(0).setOrigin(0,0);
      handles.add(info);
    };

    const onOverlayPointerDown = (p) => {
      const layer = ensureLayer();
      const ptr = { x:p.worldX ?? p.x, y:p.worldY ?? p.y };
      const uv = toUV(ptr.x, ptr.y);
      if (p.event?.shiftKey) {
        if (!layer.polys.length) layer.polys.push([]);
        const poly = layer.polys[layer.polys.length-1];
        LocationEditor._insertPointIntoNearestEdge(poly, uv);
        repaint(); return;
      }
      if (p.event?.altKey) {
        const poly = layer.polys[layer.polys.length-1];
        if (poly?.length) {
          const idx = LocationEditor._findNearestVertex(poly, uv);
          if (idx >= 0) { poly.splice(idx,1); repaint(); }
        }
        return;
      }
    };
    overlay.on('pointerdown', onOverlayPointerDown);

    const onKey = (e) => {
      const layer = ensureLayer();
      if (e.code === 'KeyN') { layer.polys.push([]); repaint(); }
      if (e.code === 'BracketLeft')  { layer.mult = Math.max(1, +(layer.mult - 0.1).toFixed(2)); repaint(); }
      if (e.code === 'BracketRight') { layer.mult = Math.min(8, +(layer.mult + 0.1).toFixed(2)); repaint(); }
      if (e.code === 'KeyQ') { curSpIdx = (curSpIdx - 1 + speciesList.length) % speciesList.length; repaint(); }
      if (e.code === 'KeyE') { curSpIdx = (curSpIdx + 1) % speciesList.length; repaint(); }

      if (e.code === 'KeyS' && !e.ctrlKey) {
        const filled = this.loc.speciesAreas.filter(a => a.polys?.some(poly => poly.length >= 3));
        const clean = filled.map(a => ({
          speciesId: a.speciesId,
          mult: +a.mult.toFixed(2),
          polys: a.polys
            .filter(poly => poly.length >= 3)
            .map(poly => poly.map(([u,v]) => [+u.toFixed(3), +v.toFixed(3)]))
        }));
        const txt = `speciesAreas: ${JSON.stringify(clean, null, 2)}`;
        console.log(txt);
        this.s.showToast?.('SpeciesAreas (заполненные) → в консоль');
      }
      if (e.code === 'KeyS' && e.ctrlKey) {
        e.preventDefault();
        const polys = (layer.polys || []).filter(p => p.length >= 3);
        const one = [{
          speciesId: layer.speciesId,
          mult: +layer.mult.toFixed(2),
          polys: polys.map(poly => poly.map(([u,v]) => [+u.toFixed(3), +v.toFixed(3)]))
        }];
        const txt = `speciesAreas: ${JSON.stringify(one, null, 2)}`;
        console.log(txt);
        this.s.showToast?.(`Только активный вид: ${layer.speciesId} → в консоль`);
      }

      if (e.code === 'Escape') this.stopSpeciesAreasEditor();
    };
    this.s.input.keyboard?.on('keydown', onKey);

    const onResize = () => {
      W = this.s.scale.width;
      const wb = this._waterBounds();
      TOP = wb.top; SHORE = wb.shore; Hwater = Math.max(1, SHORE - TOP);
      overlay.setSize(this.s.scale.width, this.s.scale.height);
      repaint();
    };
    this.s.scale.on('resize', onResize);

    this._spEdit = { overlay, g, handles, onKey, onResize };

    repaint();
    this.s.showToast?.('Редактор зон видов запущен (см. панель сверху)');
  }

  stopSpeciesAreasEditor() {
    const E = this._spEdit; if (!E) return;

    try { if (this._prevCursor != null) this.s.input.manager.canvas.style.cursor = this._prevCursor; } catch {}

    this.s.input.keyboard?.off('keydown', E.onKey);
    this.s.scale.off('resize', E.onResize);
    E.overlay?.destroy(); E.g?.destroy(); E.handles?.destroy();
    this._spEdit = null;
  }
}

export default LocationEditor;
