// /src/net/api.js
export const API_BASE = (window.API_BASE || '').trim();

const LS_USER  = 'gc_user';
const LS_TOKEN = 'gc_token';
const LS_STATE_PREFIX = 'gc_state:'; // по-пользователю

function stateKey() {
  const uid = (Auth?.user?.id) || 'guest';
  return LS_STATE_PREFIX + uid;
}

async function tryFetch(url, opts) {
  if (!API_BASE) throw new Error('offline');
  const headers = { ...(opts?.headers || {}) };
  if (Auth.token) headers['Authorization'] = 'Bearer ' + Auth.token;
  const r = await fetch(API_BASE + url, {
    credentials: 'include',
    ...opts,
    headers
  });
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
      this.token = t;
      try { this.user = JSON.parse(u) || null; } catch { this.user = null; }
      this.isAuthed = !!this.user;
      return this.isAuthed;
    }
    // ВАЖНО: не автологиним «гостя», чтобы форма показывалась.
    this.isAuthed = false;
    this.user = null;
    this.token = null;
    return false;
  },

  setSession({ token, user }) {
    this.token = token;
    this.user  = user;
    this.isAuthed = true;
    localStorage.setItem(LS_TOKEN, token);
    localStorage.setItem(LS_USER, JSON.stringify(user));
  },

  async register({ email, username, password }) {
    try {
      const data = await tryFetch('/auth/register', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ email, username, password })
      });
      this.setSession({ token: data.token, user: data.user });
      return { ok:true, offline:false, token:data.token, user:data.user };
    } catch {
      // офлайн-регистрация (локальная сессия)
      const user = { id: `local:${email||username}`, username: username || email || 'Player', email: email || '' };
      const token = 'dev-' + btoa((email||username)||'user').slice(0,16);
      this.setSession({ token, user });
      return { ok:true, offline:true, token, user };
    }
  },

  async login({ emailOrUsername, password }) {
    try {
      const data = await tryFetch('/auth/login', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ login: emailOrUsername, password })
      });
      this.setSession({ token: data.token, user: data.user });
      return { ok:true, offline:false, token:data.token, user:data.user };
    } catch {
      // офлайн-логин (локальная сессия)
      const user = { id: `local:${emailOrUsername||'guest'}`, username: emailOrUsername || 'guest', email: '' };
      const token = 'dev-' + btoa((emailOrUsername||'guest') + Date.now()).slice(0,16);
      this.setSession({ token, user });
      return { ok:true, offline:true, token, user };
    }
  },

  logout() {
    this.isAuthed = false; this.user = null; this.token = null;
    localStorage.removeItem(LS_USER);
    localStorage.removeItem(LS_TOKEN);
    // локальные сейвы по пользователю оставляем (полезно).
  }
};

export const API = {
  async loadState() {
    // Сначала пытаемся сетевой стейт:
    try {
      const data = await tryFetch('/state', { method:'GET' });
      return data;
    } catch {
      // Затем — локальный по текущему пользователю
      const raw = localStorage.getItem(stateKey());
      return raw ? JSON.parse(raw) : null;
    }
  },

  async saveState(state) {
    // ВСЕГДА дублируем локально, но по пользователю
    localStorage.setItem(stateKey(), JSON.stringify(state));
    try {
      const data = await tryFetch('/state', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(state)
      });
      return data;
    } catch {
      return { ok:true, offline:true };
    }
  }
};
