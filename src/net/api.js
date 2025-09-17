// src/net/api.js
const API_BASE = (window.API_BASE || '').trim();

const LS_USER  = 'gc_user';
const LS_TOKEN = 'gc_token';
const LS_STATE = 'gc_state';

async function tryFetch(url, opts) {
  if (!API_BASE) throw new Error('offline');
  const r = await fetch(API_BASE + url, { credentials: 'include', ...opts });
  if (!r.ok) throw new Error('http ' + r.status);
  return r.json();
}

export const Auth = {
  isAuthed: false,
  user: null,
  token: null,

  async ensure() {
    const t = localStorage.getItem(LS_TOKEN);
    const u = localStorage.getItem(LS_USER);
    if (t && u) {
      this.isAuthed = true; this.token = t; this.user = JSON.parse(u);
      return true;
    }
    if (!API_BASE) {
      // офлайн-гость
      this.isAuthed = true;
      this.user = { id: 'guest', email: 'guest@local' };
      this.token = 'guest';
      localStorage.setItem(LS_USER, JSON.stringify(this.user));
      localStorage.setItem(LS_TOKEN, this.token);
      return true;
    }
    this.isAuthed = false;
    return false;
  },

  async register({ email, password }) {
    try {
      const data = await tryFetch('/auth/register', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ email, password })
      });
      this.isAuthed = true; this.user = data.user; this.token = data.token;
      localStorage.setItem(LS_USER, JSON.stringify(this.user));
      localStorage.setItem(LS_TOKEN, this.token);
      return { ok:true, offline:false };
    } catch {
      // офлайн-регистрация: локальный «аккаунт»
      const user = { id: email, email };
      const token = 'dev-' + btoa(email).slice(0,16);
      this.isAuthed = true; this.user = user; this.token = token;
      localStorage.setItem(LS_USER, JSON.stringify(user));
      localStorage.setItem(LS_TOKEN, token);
      return { ok:true, offline:true };
    }
  },

  async login({ email, password }) {
    try {
      const data = await tryFetch('/auth/login', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ email, password })
      });
      this.isAuthed = true; this.user = data.user; this.token = data.token;
      localStorage.setItem(LS_USER, JSON.stringify(this.user));
      localStorage.setItem(LS_TOKEN, this.token);
      return { ok:true, offline:false };
    } catch {
      // офлайн-логин
      const user = { id: email || 'guest', email: email || 'guest@local' };
      const token = 'dev-' + btoa((email||'guest') + Date.now()).slice(0,16);
      this.isAuthed = true; this.user = user; this.token = token;
      localStorage.setItem(LS_USER, JSON.stringify(user));
      localStorage.setItem(LS_TOKEN, token);
      return { ok:true, offline:true };
    }
  },

  logout() {
    this.isAuthed = false; this.user = null; this.token = null;
    localStorage.removeItem(LS_USER);
    localStorage.removeItem(LS_TOKEN);
  }
};

export const API = {
  async loadState() {
    try {
      return await tryFetch('/state', { method:'GET' });
    } catch {
      const raw = localStorage.getItem(LS_STATE);
      return raw ? JSON.parse(raw) : null;
    }
  },
  async saveState(state) {
    localStorage.setItem(LS_STATE, JSON.stringify(state)); // всегда дублируем локально
    try {
      return await tryFetch('/state', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(state)
      });
    } catch {
      return { ok:true, offline:true };
    }
  }
};
