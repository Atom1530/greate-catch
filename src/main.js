// src/main.js
import { Auth } from './net/api.js';
import VM from './vm.js';
import { Start } from './scenes/Start.js';
import Base from './scenes/Base.js';
import AuthScene from './scenes/Auth.js';

(async () => {
  // 1) узнаём юзера (подтягиваем токен из LS)
  try { await Auth.ensure(); } catch {}

  const uid = Auth?.user?.id || 'guest';

  // 2) один раз на весь ран: правильный ключ для этого юзера
  VM.init({ persist: true, key: `rf.vm.u:${uid}` });

  // (опционально) если только что залогинились — мигрируй гостевой сейв:
  if (uid !== 'guest') {
    const guestKey = 'rf.vm.u:guest';
    if (!localStorage.getItem(`rf.vm.u:${uid}`) && localStorage.getItem(guestKey)) {
      localStorage.setItem(`rf.vm.u:${uid}`, localStorage.getItem(guestKey));
    }
  }

  console.log('[BOOT] VM key =', VM._lsKey,
              'raw =', localStorage.getItem(VM._lsKey)); // дебаг: видно, что реально лежит в LS

  const config = {
  type: Phaser.AUTO,
  title: 'Overlord Rising',
  description: '',
  parent: 'game-container',      // <div id="game-container"></div> в index.html
  width: 1280,
  height: 720,
  backgroundColor: '#000000',
  pixelArt: false,
  scene: [Start, Base, AuthScene], // порядок не критичен, главное — чтобы сцена была зарегистрирована
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  dom: { createContainer: true }, // <<< ВКЛЮЧАЕМ DOM, иначе this.add.dom кинет ошибку
};

  new Phaser.Game(config);
})();