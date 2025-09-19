// src/net/RoomService.js
// Единая точка для join/leave комнаты, presence и чата.
// Работает поверх ChatClient/LocalChatClient.

export class RoomService {
  /**
   * @param {ChatClient|LocalChatClient} client
   * @param {object} opts
   *  - onInfo: ({ roomId, occupants, capacity }) => void
   *  - onMessage: (msg) => void
   *  - onError: (err) => void
   */
  constructor(client, opts = {}) {
    this.client = client;
    this.onInfo = opts.onInfo || (()=>{});
    this.onMessage = opts.onMessage || (()=>{});
    this.onError = opts.onError || (()=>{});

    this.currentRoom = null;
    this.state = Object.create(null); // roomId -> {occupants, capacity}

    // прокидываем события транспорта
    client.on?.('roomInfo', (info) => {
      const { roomId, occupants = 0, capacity = 100 } = info || {};
      this.state[roomId] = { occupants, capacity };
      if (roomId === this.currentRoom) this.onInfo({ roomId, occupants, capacity });
    });
    client.on?.('message', (msg) => this.onMessage(msg));
    client.on?.('error', (e) => this.onError(e));
  }

  getRoomInfo(roomId = this.currentRoom){
    return this.state[roomId] || { occupants: 0, capacity: 100 };
  }

  async join(roomId){
    if (!roomId) return { ok:false, reason:'bad_room' };
    const res = await this.client.join?.(roomId);
    if (res?.ok) {
      this.currentRoom = roomId;
      const { occupants = 0, capacity = 100 } = res;
      this.state[roomId] = { occupants, capacity };
      this.onInfo({ roomId, occupants, capacity });
      return { ok: true };
    }
    return res || { ok:false, reason:'unknown' };
  }

  async leave(roomId = this.currentRoom){
    if (!roomId) return { ok:true };
    try {
      await this.client.leave?.(roomId);
    } catch {}
    if (this.currentRoom === roomId) this.currentRoom = null;
    return { ok:true };
  }

  async switchTo(roomId){
    const prev = this.currentRoom;
    if (prev === roomId) return { ok:true, same:true };
    // попробуем войти в новую ДО окончательного выхода из старой,
    // чтобы не остаться без чата, если сервер строгий
    const joinRes = await this.join(roomId);
    if (!joinRes?.ok) return joinRes; // например, full
    if (prev) await this.leave(prev);
    return { ok:true };
  }

  async send(text){
    if (!this.currentRoom || !text) return;
    return this.client.send?.(this.currentRoom, text);
  }

  async loadHistory(limit=40){
    if (!this.currentRoom) return [];
    return this.client.history?.(this.currentRoom, limit) || [];
  }
}

export default RoomService;
