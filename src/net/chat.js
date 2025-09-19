// Простенький клиент чата поверх socket.io (если есть backend)
// src/net/chat.js
import { API_BASE, Auth } from './api.js';

export class ChatClient {
  constructor(ioLib, baseUrl = API_BASE) {
    this.ioLib = ioLib;
    this.baseUrl = (baseUrl || '').replace(/\/$/, '');
    this.socket = null;
    this.roomId = null;
    this._listeners = new Map();
  }

  _emitLocal(e, p) {
    const s = this._listeners.get(e);
    if (!s) return;
    s.forEach(fn => { try { fn(p); } catch {} });
  }
  on(e, fn) {
    if (!this._listeners.has(e)) this._listeners.set(e, new Set());
    this._listeners.get(e).add(fn);
    return () => this.off(e, fn);
  }
  off(e, fn) { const s = this._listeners.get(e); if (s) s.delete(fn); }

  _ensureSocket() {
    if (this.socket) return;
    if (!this.ioLib || !this.baseUrl) return;

    this.socket = this.ioLib(this.baseUrl + '/chat', {
      transports: ['websocket'],
      auth: { token: Auth.token || '' }
    });

    this.socket.on('connect',    () => this._emitLocal('status', { connected: true }));
    this.socket.on('disconnect', () => this._emitLocal('status', { connected: false }));

    // сообщения
    this.socket.on('message', (m) => this._emitLocal('message', m));

    // нормализованное событие presence (server → 'room-users')
    this.socket.on('room-users', (d) => {
      const info = {
        roomId:   d?.roomId,
        occupants: d?.count ?? d?.occupants ?? 0,
        capacity:  d?.capacity ?? 100
      };
      // новый единый канал:
      this._emitLocal('roomInfo', info);
      // бэк-совместимость со старым кодом (если где-то ещё слушают 'users'):
      this._emitLocal('users', { roomId: info.roomId, count: info.occupants, capacity: info.capacity });
    });

    this.socket.on('error', (e) => this._emitLocal('error', e));
  }

  // унифицированный помощник для ack с таймаутом
  _withAck(event, payload, okEvent, errEvent, timeoutMs = 800) {
    return new Promise((resolve) => {
      if (!this.socket) return resolve({ ok: false, reason: 'no_socket' });

      let done = false;
      const finish = (res) => {
        if (done) return;
        done = true;
        try { this.socket.off(okEvent, onOk); } catch {}
        try { this.socket.off(errEvent, onErr); } catch {}
        resolve(res);
      };

      const to = setTimeout(() => {
        // сервер без ack? Считаем ок, presence всё равно прилетит отдельно.
        finish({ ok: true, timeout: true });
      }, timeoutMs);

      const onOk  = (data) => { clearTimeout(to); finish(data && data.ok != null ? data : { ok: true, ...(data||{}) }); };
      const onErr = (data) => { clearTimeout(to); finish({ ok: false, ...(data || {}) }); };

      this.socket.once(okEvent, onOk);
      this.socket.once(errEvent, onErr);
      this.socket.emit(event, payload);
    });
  }

  async join(roomId) {
    if (!roomId) return { ok: false, reason: 'bad_room' };
    this._ensureSocket();
    if (!this.socket) return { ok: false, reason: 'no_socket' };

    if (this.roomId && this.roomId !== roomId) {
      // мягко выйдем из прошлой (без ожидания)
      try { await this.leave(this.roomId); } catch {}
    }
    this.roomId = roomId;

    // ожидаем серверные ack-события (если есть). Иначе сработает таймаут-ок.
    const res = await this._withAck('join', { roomId }, 'joined', 'join-error');
    return res?.ok ? { ok: true, occupants: res.occupants, capacity: res.capacity } : res;
  }

  async leave(roomId = this.roomId) {
    if (!this.socket || !roomId) return { ok: true };
    const res = await this._withAck('leave', { roomId }, 'left', 'leave-error');
    if (this.roomId === roomId) this.roomId = null;
    return res?.ok ? { ok: true } : res;
  }

  /**
   * Отправка сообщения.
   * Совместимость:
   *  - send(text) → берёт текущую комнату this.roomId
   *  - send(roomId, text) → явное указание комнаты (для RoomService старого вида)
   */
  send(a, b) {
    let roomId, text;
    if (typeof b === 'string') { roomId = a; text = b; }
    else { roomId = this.roomId; text = a; }
    const t = String(text || '').trim();
    if (!t || !this.socket || !roomId) return;
    this.socket.emit('send', { roomId, text: t });
  }

  /**
   * Анонс поимки.
   * Совместимость по сигнатуре как у send().
   */
  announceCatch(a, b) {
    let roomId, payload;
    if (b != null) { roomId = a; payload = b; }
    else { roomId = this.roomId; payload = a; }
    if (!this.socket || !roomId) return;
    this.socket.emit('catch', { roomId, payload });
  }

  async loadHistory(limit = 40) {
    if (!API_BASE) return [];
    try {
      const url = `${this.baseUrl}/chat/history?room=${encodeURIComponent(this.roomId)}&limit=${limit}`;
      const r = await fetch(url, {
        credentials: 'include',
        headers: Auth.token ? { Authorization: 'Bearer ' + Auth.token } : {}
      });
      if (!r.ok) throw new Error('http ' + r.status);
      const arr = await r.json();
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  // алиас для старого RoomService, если он зовёт history()
  history(limit = 40) { return this.loadHistory(limit); }

  destroy() {
    try { this.leave(); } catch {}
    if (this.socket) {
      try { this.socket.removeAllListeners?.(); } catch {}
      try { this.socket.close?.(); } catch {}
    }
    this.socket = null;
    this._listeners.clear();
  }
}

// --- ОФЛАЙН-КЛИЕНТ (локальный «эхо»-чат) ---
export class LocalChatClient {
  constructor() {
    this.roomId = null;
    this._listeners = new Map();
  }
  _emitLocal(e, p) {
    const s = this._listeners.get(e);
    if (!s) return;
    s.forEach(fn => { try { fn(p); } catch {} });
  }
  on(e, fn) {
    if (!this._listeners.has(e)) this._listeners.set(e, new Set());
    this._listeners.get(e).add(fn);
    return () => this.off(e, fn);
  }
  off(e, fn) { const s = this._listeners.get(e); if (s) s.delete(fn); }

  async join(roomId) {
    this.roomId = roomId;
    // статус + presence в едином формате
    this._emitLocal('status', { connected: true });
    this._emitLocal('roomInfo', { roomId, occupants: 1, capacity: 100 });
    // бэк-совместимость
    this._emitLocal('users', { roomId, count: 1, capacity: 100 });
    return { ok: true, occupants: 1, capacity: 100 };
  }

  async leave() {
    this._emitLocal('status', { connected: false });
    this.roomId = null;
    return { ok: true };
  }

  // совместимость сигнатур: send(text) ИЛИ send(roomId, text)
  send(a, b) {
    let roomId, text;
    if (typeof b === 'string') { roomId = a; text = b; }
    else { roomId = this.roomId; text = a; }
    const t = String(text || '').trim();
    if (!t || !roomId) return;
    this._emitLocal('message', {
      id: Date.now(),
      kind: 'text',
      text: t,
      ts: Date.now(),
      user: (Auth.user || { id: 'you', username: 'you' }),
      roomId
    });
  }

  // совместимость сигнатур: announceCatch(payload) ИЛИ announceCatch(roomId, payload)
  announceCatch(a, b) {
    let roomId, payload;
    if (b != null) { roomId = a; payload = b; }
    else { roomId = this.roomId; payload = a; }
    if (!roomId) return;
    this._emitLocal('message', {
      id: Date.now(),
      kind: 'catch',
      payload,
      ts: Date.now(),
      user: (Auth.user || { id: 'you', username: 'you' }),
      roomId
    });
  }

  async loadHistory() { return []; }
  history(limit = 40) { return this.loadHistory(limit); }

  destroy() { this._listeners.clear(); }
}

export default ChatClient;
