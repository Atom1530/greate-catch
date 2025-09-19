// /src/scenes/Boot.js
import { Auth } from '../net/api.js';
import VM from '../vm.js';

export default class Boot extends Phaser.Scene {
  constructor(){ super('Boot'); }

  async create(){
    try { await Auth.ensure(); } catch {}
    const uid = Auth?.user?.id || 'guest';

    // единая инициализация VM на запуск/смену аккаунта
    VM.init({ persist: true, key: `rf.vm.u:${uid}` });

        // если локация не задана — ставим lake
    if (!VM.get?.('locationId')) VM.set?.('locationId', 'lake');

    this.scene.start(Auth.isAuthed ? 'Start' : 'Auth');
  }
}
