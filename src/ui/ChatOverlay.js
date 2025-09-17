export default class ChatOverlay {
  constructor(scene, chatClient, roomId){
    this.s = scene;
    this.chat = chatClient;
    this.roomId = roomId;
    this.depth = 3000;

    const W = scene.scale.width, H = scene.scale.height;
    const w = Math.min(380, Math.floor(W*0.42));
    const h = Math.min(240, Math.floor(H*0.38));
    const x = 12, y = H - h - 12;

    this.root = scene.add.container(x,y).setDepth(this.depth);

    const bg = scene.add.rectangle(0,0,w,h,0x0b0f18,0.78).setOrigin(0,0)
      .setStrokeStyle(2,0xffffff,0.15).setInteractive();
    this.root.add(bg);

    this.list = scene.add.text(8, 8, '', {
      fontFamily:'Arial', fontSize:'12px', color:'#cfe',
      wordWrap:{ width:w-16 }
    }).setOrigin(0,0);
    this.root.add(this.list);

    // input
    const dom = scene.add.dom(8, h-8).createFromHTML(`
      <input id="chatInput" type="text" placeholder="Повідомлення..."
        style="width:${w-16}px; padding:6px 8px; border-radius:8px; border:1px solid #456; background:#0c1323; color:#fff; font-size:14px;">
    `).setOrigin(0,1);
    this.root.add(dom);

    this.history = [];

    this.chat.on('chat:new', (msg)=> this.pushMsg(msg));
  }

  async loadHistory(API, limit=50){
    try {
      const rows = await API.chatHistory(this.roomId, limit);
      rows.forEach(r=> this.pushMsg(r,false));
      this.render();
    } catch {}
  }

  pushMsg(m, renderNow=true){
    if (m.type === 'chat'){
      this.history.push(`[${m.username}] ${m.text}`);
    } else if (m.type === 'catch'){
      const p = m.payload || {};
      const fish = p.name || p.fishId || 'улов';
      const w = p.weightKg != null ? `, ${p.weightKg.toFixed?.(2)||p.weightKg} кг` : '';
      this.history.push(`🎣 ${m.username} спіймав ${fish}${w}`);
    }
    if (this.history.length > 100) this.history.splice(0, this.history.length-100);
    if (renderNow) this.render();
  }

  render(){
    this.list.setText(this.history.slice(-12).join('\n'));
  }

  focusInput(){
    const el = this.root.getAt(2).node?.querySelector?.('#chatInput');
    if (el){ el.focus(); }
  }

  destroy(){ this.root?.destroy(); }
}
