import { Auth } from './api.js';

// подключи socket.io клиент (через <script> в index.html или через сборщик)
export class ChatClient {
  constructor(io, baseUrl) {
    this.enabled = !!(io && baseUrl);
    if (!this.enabled) return;
    this.socket = io(baseUrl, { transports: ['websocket'], path: '/socket.io' });
  }
  join()         { if (!this.enabled) return; /* ... */ }
  leave()        { if (!this.enabled) return; /* ... */ }
  on()           { if (!this.enabled) return; /* ... */ }
  announceCatch(){ if (!this.enabled) return; /* ... */ }
}
