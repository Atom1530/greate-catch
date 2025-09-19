// src/ui/ChatOverlay.js
export class ChatOverlay {
  constructor(scene, client, roomId, opts = {}) {
    this.s = scene;
    this.client = client;
    this.roomId = roomId;

    // Опции
    this.anchor = (opts.anchor === 'right') ? 'right' : 'left';
    this.w      = opts.w ?? 320;
    this.h      = opts.h ?? 220;
    this.pad    = opts.pad ?? 14;
    this.depth  = opts.depth ?? 1600;
    this.raise  = opts.raise ?? 0; // ← на сколько пикселей приподнять снизу
    this.maxMessages = opts.maxMessages ?? 80;

    this.isOpen = true;
    this.usersCount = 0;
    this._lines = [];

    // Корневая группа
    this.g = scene.add.container(0, 0).setDepth(this.depth);

    // Фон
    this.bg = scene.add.rectangle(0, 0, this.w, this.h, 0x0f1421, 0.86)
      .setOrigin(0)
      .setStrokeStyle(2, 0xffffff, 0.16)
      .setInteractive({ useHandCursor: false });
    this.g.add(this.bg);

    // Титул
    this.title = scene.add.text(10, 8, 'Чат', {
      fontFamily:'Arial, sans-serif', fontSize:'14px', color:'#cfe2ff'
    }).setOrigin(0,0);
    this.g.add(this.title);

    // Кнопка сворачивания
    this.btnToggle = scene.add.text(this.w - 10, 6, '▾', {
      fontFamily:'Arial, sans-serif', fontSize:'18px', color:'#cfe2ff'
    }).setOrigin(1,0).setInteractive({ useHandCursor:true });
    this.btnToggle.on('pointerdown', () => this.toggle());
    this.g.add(this.btnToggle);

    // Лог сообщений
    this.log = scene.add.text(10, 28, '', {
      fontFamily:'Arial, sans-serif',
      fontSize:'14px',
      color:'#e8f1ff',
      wordWrap:{ width: this.w - 20 }
    }).setOrigin(0,0);
    this.g.add(this.log);

    // DOM-инпут + кнопка отправки
    const inputW = this.w - 20 - 58;
    const html = `
      <div style="display:flex; gap:8px; width:${this.w - 20}px">
        <input id="chatMsg" type="text" placeholder="Написать..."
               style="flex:1;width:${inputW}px;padding:8px;border-radius:8px;
                      border:1px solid #445;background:#0e1220;color:#fff;outline:none;">
        <button id="chatSend"
                style="width:50px;padding:8px 6px;border-radius:8px;border:1px solid #5a6;
                       background:#24345a;color:#cfe;cursor:pointer;">Send</button>
      </div>`;
    this.dom = scene.add.dom(10, this.h - 12).setOrigin(0,1).createFromHTML(html);
    this.g.add(this.dom); // ← чтобы инпут «привязался» к панели

    const inputEl = this.dom.getChildByID('chatMsg');
    const sendEl  = this.dom.getChildByID('chatSend');

    const send = () => {
      const text = String(inputEl?.value ?? '').trim();
      if (!text) return;
      this.client?.send?.(text);
      inputEl.value = '';
    };

    sendEl?.addEventListener('click', (e) => { e.stopPropagation(); send(); });
    inputEl?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
      e.stopPropagation();
    });

    // Подписки на клиент
    this.offMessage = this.client?.on?.('message', (m) => this._push(m));
    this.offUsers   = this.client?.on?.('users',   (p) => this._setUsers(p?.count|0));
    this.offStatus  = this.client?.on?.('status',  () => this._refreshTitle());

    // Позиционирование и ресайз
    this._place();
    scene.scale.on('resize', this._place, this);

    // Подключение к комнате
    this.client?.join?.(this.roomId);
    this._refreshTitle();
  }

  // История
  async loadHistory(_, limit = 40) {
    try {
      const arr = await this.client?.loadHistory?.(limit);
      if (Array.isArray(arr)) arr.forEach((m) => this._push(m));
    } catch {}
  }

  // Сервисные
  _nick(u){ return u?.username || u?.name || u?.email || u?.id || 'player'; }

  _lineFor(msg){
    const time = msg?.ts ? new Date(msg.ts) : null;
    const hh = time ? String(time.getHours()).padStart(2,'0') : '--';
    const mm = time ? String(time.getMinutes()).padStart(2,'0') : '--';

    if (msg?.kind === 'catch') {
      const p = msg.payload || {};
      const who = this._nick(msg.user);
      const w = (p.weightKg != null) ? `, ${(+p.weightKg).toFixed(2)} кг` : '';
      const len = (p.lengthCm != null) ? `, ${p.lengthCm|0} см` : '';
      return `[${hh}:${mm}] 🎣 ${who}: поймал ${p.name || p.fishId}${w}${len}`;
    }
    if (msg?.kind === 'system') return `[${hh}:${mm}] ✳ ${msg.text || ''}`;
    return `[${hh}:${mm}] ${this._nick(msg.user)}: ${msg?.text || ''}`;
  }

  _push(msg){
    const line = this._lineFor(msg);
    if (!line) return;
    this._lines.push(line);
    if (this._lines.length > this.maxMessages)
      this._lines.splice(0, this._lines.length - this.maxMessages);
    this.log.setText(this._lines.join('\n'));
  }

  _setUsers(n){ this.usersCount = n|0; this._refreshTitle(); }
  _refreshTitle(){
    const rn = this.roomId || 'room';
    const cnt = this.usersCount ? ` • ${this.usersCount}` : '';
    this.title.setText(`Локация: ${rn}${cnt}`);
  }

  toggle(){
    this.isOpen = !this.isOpen;
    this.btnToggle.setText(this.isOpen ? '▾' : '▸');
    this.bg.setDisplaySize(this.w, this.isOpen ? this.h : 28);
    this.dom.setVisible(this.isOpen);
    this.log.setVisible(this.isOpen);
    this._place();
  }

  _place(){
    const W = this.s.scale.width, H = this.s.scale.height;
    const x = (this.anchor === 'right') ? (W - this.w - this.pad) : this.pad;
    const yBase = H - (this.isOpen ? this.h : 28) - this.pad;
    const y = Math.max(0, yBase - this.raise); // ← поднять на this.raise
    this.g.setPosition(x, y);
  }

  destroy(){
    this.s.scale.off('resize', this._place, this);
    this.offMessage?.(); this.offUsers?.(); this.offStatus?.();
    try { this.client?.leave?.(this.roomId); } catch {}
    this.g?.destroy(); this.dom?.destroy(); this.bg?.destroy();
    this.log?.destroy(); this.title?.destroy(); this.btnToggle?.destroy();
  }
}

export default ChatOverlay;
