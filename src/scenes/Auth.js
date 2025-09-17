//  /src/scenes/Auth.js
import Phaser from 'phaser';
import { API, Auth } from '../net/api.js';

export default class AuthScene extends Phaser.Scene {
  constructor(){ super('Auth'); }

  preload(){}

  create(){
    const W = this.scale.width, H = this.scale.height;
    const cx = W/2, cy = H/2, panelW = Math.min(420, W-60), panelH = 300;

    const panel = this.add.rectangle(cx, cy, panelW, panelH, 0x101420, 1)
      .setStrokeStyle(2, 0xffffff, 0.18);

    const title = this.add.text(cx, cy - panelH/2 + 16, 'Реєстрація / Вхід', {
      fontFamily:'Arial', fontSize:'20px', color:'#fff'
    }).setOrigin(0.5,0);

    // HTML-инпуты через DOMElement (удобно для мобилки)
    this.add.dom(cx, cy-20).createFromHTML(`
      <div style="display:flex; flex-direction:column; gap:8px; width:${panelW-60}px">
        <input id="email"    type="text" placeholder="Email або username" style="padding:8px;border-radius:8px;border:1px solid #445;background:#0e1220;color:#fff" />
        <input id="username" type="text" placeholder="Нік (для реєстрації)" style="padding:8px;border-radius:8px;border:1px solid #445;background:#0e1220;color:#fff" />
        <input id="pass"     type="password" placeholder="Пароль" style="padding:8px;border-radius:8px;border:1px solid #445;background:#0e1220;color:#fff" />
        <div style="display:flex; gap:12px; margin-top:8px;">
          <button id="btnReg"  style="flex:1;padding:10px;border-radius:10px;border:none;background:#2b74ff;color:#fff">Зареєструватися</button>
          <button id="btnLog"  style="flex:1;padding:10px;border-radius:10px;border:1px solid #5a6;color:#cfe">Увійти</button>
        </div>
        <div id="err" style="color:#f88; min-height:20px; font:12px Arial;"></div>
      </div>
    `);

    const dom = document;
    const byId = (id)=> dom.getElementById(id);
    const showErr = (t)=> { const e = byId('err'); if (e) e.textContent = t || ''; };

    const goStart = async ()=>{
      try{
        // подтянуть state и стартануть Start
        this.scene.start('Start', {});
      }catch(e){ showErr('Помилка запуску'); }
    };

    byId('btnReg')?.addEventListener('click', async ()=>{
      showErr('');
      const email = byId('email').value.trim();
      const username = byId('username').value.trim();
      const pass = byId('pass').value;
      try{
        const r = await API.register(email, username, pass);
        Auth.token = r.token;
        await goStart();
      }catch(err){ showErr('Реєстрація не вдалася'); }
    });

    byId('btnLog')?.addEventListener('click', async ()=>{
      showErr('');
      const emailOrUsername = byId('email').value.trim();
      const pass = byId('pass').value;
      try{
        const r = await API.login(emailOrUsername, pass);
        Auth.token = r.token;
        await goStart();
      }catch(err){ showErr('Невірні дані'); }
    });
  }
}
