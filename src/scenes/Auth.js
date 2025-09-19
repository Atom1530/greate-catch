// src/scenes/Auth.js
import { API_BASE, Auth } from '../net/api.js';
import VM from '../vm.js';
import { LocationMgr } from '../locations/LocationMgr.js';
import PhotoBank from '../assets/PhotoBank.js';
import Phaser from "phaser";

export default class AuthScene extends Phaser.Scene {
  constructor(){ super('Auth'); }

  preload(){}

  create(){
    const W = this.scale.width, H = this.scale.height;
    const cx = Math.floor(W/2), cy = Math.floor(H/2);
    const panelW = Math.min(460, W - 60), panelH = 380;

    // === 1) ФОН: градиент ===
    const makeGradient = () => {
      const key = '__auth_grad__';
      const tex = this.textures.get(key);
      if (tex) this.textures.remove(key);
      const t = this.textures.createCanvas(key, this.scale.width, this.scale.height);
      const ctx = t.getContext();
      const g = ctx.createLinearGradient(0, 0, 0, this.scale.height);
      g.addColorStop(0.00, '#0a0d1a');
      g.addColorStop(0.45, '#0d1631');
      g.addColorStop(1.00, '#0a1326');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.scale.width, this.scale.height);
      t.refresh();
      return key;
    };
    const bgKey = makeGradient();
    const bg = this.add.image(0,0,bgKey).setOrigin(0).setDepth(-20);

    // Виньетка
    const vignette = this.add.graphics().setDepth(-19);
    vignette.fillStyle(0x000000, 0.35);
    vignette.fillRect(0, 0, W, H);
    vignette.setBlendMode(Phaser.BlendModes.MULTIPLY);

    // === 1.1) «Пузырьки» без ParticleEmitter (совместимо с 3.55/3.60+)
    // Текстура точки
    const mkDot = () => {
      const key = '__dot8__';
      if (this.textures.exists(key)) return key;
      const g = this.make.graphics({ x:0, y:0, add:false });
      g.fillStyle(0xffffff, 1);
      g.fillCircle(8, 8, 8);
      g.generateTexture(key, 16, 16);
      g.destroy();
      return key;
    };
    const dotKey = mkDot();

    const bubbles = this.add.container(0, 0).setDepth(-10);
    let spawnArea = { left: 30, right: W - 30, bottom: H + 10 };

    const spawnBubble = () => {
      const x = Phaser.Math.Between(spawnArea.left, spawnArea.right);
      const yStart = spawnArea.bottom;
      const life = Phaser.Math.Between(3200, 5600);
      const dy = Phaser.Math.Between(140, 220);
      const dx = Phaser.Math.Between(-30, 30);
      const scale = Phaser.Math.FloatBetween(0.18, 0.34);

      const img = this.add.image(x, yStart, dotKey)
        .setAlpha(0.26)
        .setScale(scale)
        .setBlendMode(Phaser.BlendModes.ADD);
      bubbles.add(img);

      this.tweens.add({
        targets: img,
        x: x + dx,
        y: yStart - dy,
        alpha: 0,
        duration: life,
        ease: 'Sine.out',
        onComplete: () => img.destroy()
      });
    };

    const bubbleTimer = this.time.addEvent({
      delay: 90,
      loop: true,
      callback: spawnBubble
    });

    // === 2) ПАНЕЛЬ: тень + стекло + подсветка ===
    const shadow = this.add.rectangle(cx+4, cy+6, panelW, panelH, 0x000000, 0.35).setDepth(1);
    const panel  = this.add.rectangle(cx, cy, panelW, panelH, 0x121725, 0.88)
      .setStrokeStyle(2, 0xffffff, 0.18).setDepth(2);
    const glow   = this.add.rectangle(cx, cy, panelW+10, panelH+10, 0x2b74ff, 0.07).setDepth(1.5);
    this.tweens.add({
      targets: glow, alpha: { from: 0.05, to: 0.12 },
      duration: 2000, yoyo: true, repeat: -1, ease: 'Sine.inOut'
    });

    const title = this.add.text(cx, cy - panelH/2 + 16, 'Реєстрація / Вхід', {
      fontFamily:'Arial, sans-serif', fontSize:'20px', color:'#ffffff'
    }).setOrigin(0.5,0).setDepth(3);

    const divider = this.add.rectangle(
    cx, cy - panelH/2 + 40, panelW - 32, 2, 0xffffff, 0.12
    ).setDepth(3);

    // === 3) ФОРМА (ID/имена — прежние) ===
    const extraGuestBtn = (!API_BASE)
      ? `<button id="btnGuest" type="button"
             style="width:100%;padding:10px;border-radius:10px;border:1px dashed #5a6;color:#cfe;background:transparent">
           Увійти як гість
         </button>`
      : '';

    const domEl = this.add.dom(cx, cy + 16).createFromHTML(`
      <form id="authForm" autocomplete="on"
            style="display:flex;flex-direction:column;gap:10px;width:${panelW-60}px;
                   font-family: Arial, sans-serif;">
        <input id="email" name="username" type="text" placeholder="Email або нік"
               autocapitalize="none" autocomplete="username email" spellcheck="false"
               style="padding:10px;border-radius:10px;border:1px solid #445;background:#0e1220;color:#fff;
                      outline:none;box-shadow:0 0 0 0 rgba(43,116,255,0.0);" />
        <input id="username" name="reg_username" type="text" placeholder="Нік (для реєстрації)"
               autocapitalize="none" autocomplete="nickname" spellcheck="false"
               style="padding:10px;border-radius:10px;border:1px solid #445;background:#0e1220;color:#fff;
                      outline:none;" />

        <div style="position:relative;display:flex;align-items:center;">
          <input id="pass" name="password" type="password" placeholder="Пароль"
                 autocomplete="current-password"
                 style="flex:1;padding:10px;border-radius:10px;border:1px solid #445;background:#0e1220;color:#fff;
                        outline:none;" />
          <button id="togglePass" type="button"
                  title="Показать/скрыть пароль"
                  style="position:absolute;right:8px;top:50%;transform:translateY(-50%);
                         background:transparent;border:none;color:#bcd;cursor:pointer;font-size:16px;">👁</button>
        </div>

        <div id="pbarWrap" style="margin-top:6px;height:6px;border-radius:4px;background:#1a2336;overflow:hidden;">
          <div id="pbar" style="height:100%;width:0%;background:#2b74ff;"></div>
        </div>

        <div style="display:flex;gap:12px;margin-top:8px;">
          <button id="btnReg"  type="button"
                  style="flex:1;padding:10px;border-radius:10px;border:none;background:#2b74ff;color:#fff;cursor:pointer;">
            Зареєструватися
          </button>
          <button id="btnLog"  type="submit"
                  style="flex:1;padding:10px;border-radius:10px;border:1px solid #5a6;color:#cfe;background:transparent;cursor:pointer">
            Увійти
          </button>
        </div>

        ${extraGuestBtn}

        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;">
          <div id="hint" style="color:#9ab;min-height:16px;font:12px Arial;"></div>
          <div id="caps" style="color:#ffcc66;font:12px Arial;opacity:0.0;transition:opacity .2s;">Caps Lock</div>
        </div>
        <div id="err"  style="color:#f88;min-height:20px;font:12px Arial;"></div>
      </form>
    `).setDepth(4);

    const root = domEl.node;
    const $ = (sel)=> root.querySelector(sel);

    // === 4) УТИЛИТЫ UI ===
    const setBusy = (v) => {
      const btns = ['#btnReg','#btnLog','#btnGuest','#togglePass']
        .map(s => $(s)).filter(Boolean);
      btns.forEach(b => { b.disabled = !!v; b.style.opacity = v ? '0.6' : '1'; });
    };
    const showErr  = (t='')=>{
      const e = $('#err'); if (!e) return;
      e.textContent = t;
      if (t) {
        this.tweens.add({
          targets: [panel, shadow, glow, title, divider].forEach(o => o.x = cx),
          x: `+=6`, duration: 45, yoyo:true, repeat: 5, onComplete:()=>{
            [panel, shadow, glow, title].forEach(o => o.x = cx);
          }
        });
      }
    };
    const showHint = (t='')=> { const e = $('#hint'); if (e) e.textContent = t; };
    const setPassBar = (p) => {
      const bar = $('#pbar'); if (!bar) return;
      const clamp = Math.max(0, Math.min(100, p|0));
      bar.style.width = clamp + '%';
      bar.style.background = clamp < 34 ? '#d2635b' : clamp < 67 ? '#e3c05c' : '#2bff9a';
    };
    const goStart = () => this.scene.start('Start');

    // focus-стили
    ['email','username','pass'].forEach(id => {
      const el = $('#'+id);
      if (!el) return;
      el.addEventListener('focus', () => el.style.boxShadow = '0 0 0 2px rgba(43,116,255,0.35)');
      el.addEventListener('blur',  () => el.style.boxShadow = '0 0 0 0 rgba(43,116,255,0.00)');
    });

    // === 5) ЛОКАЛЬНАЯ ВАЛИДАЦИЯ ===
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
    const strength = (s='')=>{
      let p = 0;
      if (s.length >= 6) p += 25;
      if (/[A-ZА-Я]/.test(s)) p += 20;
      if (/[a-zа-я]/.test(s)) p += 20;
      if (/\d/.test(s))       p += 20;
      if (/[^A-Za-z0-9А-Яа-я]/.test(s)) p += 15;
      return Math.min(p, 100);
    };
    $('#pass')?.addEventListener('input', (e)=> setPassBar(strength(e.target.value)));
    $('#email')?.addEventListener('input', ()=> showErr(''));

    // CapsLock индикатор
    const capsEl = $('#caps');
    const updateCaps = (ev) => {
      if (!capsEl || !ev || typeof ev.getModifierState !== 'function') return;
      const on = !!ev.getModifierState('CapsLock');
      capsEl.style.opacity = on ? '1.0' : '0.0';
    };
    ['keyup','keydown'].forEach(t => $('#pass')?.addEventListener(t, updateCaps));

    // Переключатель видимости пароля
    $('#togglePass')?.addEventListener('click', ()=>{
      const p = $('#pass'); if (!p) return;
      p.type = (p.type === 'password') ? 'text' : 'password';
    });

    // Запомнить логин локально
    try {
      const last = localStorage.getItem('rf.auth.last');
      if (last) $('#email').value = last;
    } catch {}

    // === 6) ДЕЙСТВИЯ ===
    $('#authForm')?.addEventListener('submit', async (e)=>{
      e.preventDefault();
      showErr('');
      setBusy(true);
      const emailOrUsername = $('#email')?.value.trim();
      const pass = $('#pass')?.value || '';

      if (emailOrUsername?.includes('@') && !emailRe.test(emailOrUsername)){
        showErr('Невірний формат email');
        setBusy(false);
        return;
      }
      if (!pass || pass.length < 3){
        showErr('Пароль закороткий');
        setBusy(false);
        return;
      }

      try{
        await Auth.login({ emailOrUsername, password: pass });
        try { localStorage.setItem('rf.auth.last', String(emailOrUsername||'')); } catch {}
        goStart();
      }catch{
        if (API_BASE) showErr('Невірні дані або сервер недоступний');
        else showErr('Офлайн-режим: введіть будь-який пароль');
      } finally {
        setBusy(false);
      }
    });

    $('#btnReg')?.addEventListener('click', async ()=>{
      showErr('');
      setBusy(true);
      const email    = $('#email')?.value.trim() || '';
      const username = $('#username')?.value.trim() || undefined;
      const pass     = $('#pass')?.value || '';

      if (email && !emailRe.test(email)){
        showErr('Невірний email для реєстрації');
        setBusy(false);
        return;
      }
      if (!username || username.length < 2){
        showErr('Вкажіть нік (мін. 2 символи)');
        setBusy(false);
        return;
      }
      if ((strength(pass) < 35) || pass.length < 6){
        showErr('Пароль занадто слабкий (мін. 6 символів)');
        setBusy(false);
        return;
      }

      try{
        $('#pass')?.setAttribute('autocomplete','new-password');
        await Auth.register({ email, username, password: pass });
        try { localStorage.setItem('rf.auth.last', String(email||username||'')); } catch {}
        goStart();
      }catch{
        if (API_BASE) showErr('Реєстрація не вдалася');
        else showErr('Офлайн-режим: акаунт створено локально');
      } finally {
        $('#pass')?.setAttribute('autocomplete','current-password');
        setBusy(false);
      }
    });

    // Горячие клавиши: Enter — вход, Ctrl/⌘+Enter — регистрация
    root.addEventListener('keydown', (e)=>{
      if ((e.key === 'Enter' || e.keyCode === 13) && (e.ctrlKey || e.metaKey)){
        e.preventDefault();
        $('#btnReg')?.click();
      }
    });

    // Офлайн-гость (если нет API_BASE)
    $('#btnGuest')?.addEventListener('click', async ()=>{
      showErr('');
      setBusy(true);
      try{
        await Auth.login?.({ emailOrUsername: 'guest', password: 'guest' });
      }catch{}
      goStart();
    });

    setTimeout(()=> $('#email')?.focus(), 0);
    if (!API_BASE) showHint('Працює офлайн-режим: паролі зберігаються локально.');

    // === 7) Тёплая предзагрузка активной локации ===
    const locId = VM.get?.('locationId') || 'lake';
    const warm = new Phaser.Loader.LoaderPlugin(this);
    LocationMgr.loadAssets({ load: warm }, locId);
    PhotoBank.queueForScene({ load: warm, textures: this.textures }, locId);
    warm.on('complete', () => console.log('[Auth] warmup ready for', locId));
    warm.on('loaderror', (file) => console.warn('[Auth] loaderror', file?.key, file?.src));
    warm.start();

    // === 8) Респонсив — обновить фон и область спауна пузырьков
    const onResize = (gameSize)=>{
      const w = gameSize.width, h = gameSize.height;
      bg.setTexture(makeGradient()).setDisplaySize(w, h);
      vignette.clear().fillStyle(0x000000, 0.35).fillRect(0,0,w,h);
      spawnArea = { left: 30, right: w - 30, bottom: h + 10 };
      shadow.setPosition(Math.floor(w/2)+4, Math.floor(h/2)+6);
      panel.setPosition(Math.floor(w/2), Math.floor(h/2));
      glow.setPosition(Math.floor(w/2), Math.floor(h/2));
      title.setPosition(Math.floor(w/2), Math.floor(h/2) - panelH/2 + 16);
      domEl.setPosition(Math.floor(w/2), Math.floor(h/2) + 16);
      divider.setPosition(Math.floor(w/2), Math.floor(h/2) - panelH/2 + 40);

    };
    this.scale.on('resize', onResize);

    // === 9) Чистка ===
    this.events.once('shutdown', ()=>{
      try { domEl?.destroy?.(); } catch {}
      try { warm.off('complete'); warm.off('loaderror'); } catch {}
      this.scale?.off('resize', onResize);
      try { bubbleTimer?.remove?.(); } catch {}
      bubbles?.destroy?.();
      vignette?.destroy?.();
      glow?.destroy?.();
      shadow?.destroy?.();
      bg?.destroy?.();
      divider?.destroy?.();
    });
  }
}
