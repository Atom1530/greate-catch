// src/time/TimeCycle.js
import VM from '../vm.js';

// По умолчанию: сутки идут 60 реальных минут, фазы привязаны к часам
export const TimeCfgDefault = {
  dayLengthMin: 10,          // 1 «игровые сутки» = 60 мин
  startClock:   '09:01',     // во сколько запустить первые сутки
  // Фиксированное расписание фаз по 24ч
  schedule: {
    dawn:  '06:00',          // 06:00–10:00
    day:   '10:00',          // 10:00–18:00
    dusk:  '18:00',          // 18:00–22:00
    night: '22:00',          // 22:00–06:00 (со свёрткой через полночь)
  },
};

// Порядок следования фаз
const ORDER = ['dawn','day','dusk','night'];

export class TimeCycle {
  constructor(scene, cfg = {}, onPhaseChange) {
    this.s   = scene;
    this.cfg = { ...TimeCfgDefault, ...cfg };
    this.onPhaseChange = onPhaseChange;

    // нормализуем расписание в минуты от начала суток [0..1439]
    this._schedMin = this._buildSchedule(this.cfg.schedule);

    // точка отсчёта (реальное время) и сдвиг по игровым суткам (минуты 0..1439)
    this.anchorMs  = VM.get?.('clockAnchorMs') ?? Date.now();
    this.offsetMin = VM.get?.('clockOffsetMin');
    if (typeof this.offsetMin !== 'number') {
      this.offsetMin = this._parseHHMM(this.cfg.startClock);
      VM.set?.('clockOffsetMin', this.offsetMin);
    }
    VM.set?.('clockAnchorMs', this.anchorMs);

    this.curPhase = null;

    this.timer = scene.time.addEvent({
      delay: 1000, loop: true, callback: () => this._tick()
    });
    this._tick(true);
  }

  dispose(){ this.timer?.remove(); }

  // --- утилиты ---------------------------------------------------------------

  _parseHHMM(hhmm = '00:00') {
    const [h,m] = String(hhmm).split(':').map(n => parseInt(n, 10) || 0);
    return ((h % 24) * 60 + (m % 60)) % 1440;
  }

  _buildSchedule(schedule) {
    const s = { ...TimeCfgDefault.schedule, ...(schedule || {}) };
    // преобразуем в минуты
    const mins = ORDER.map(k => [k, this._parseHHMM(s[k])]);
    // убедимся, что порядок соответствует ORDER (он уже упорядочен)
    return mins; // [['dawn',360], ['day',600], ['dusk',1080], ['night',1320]]
  }

  _totalMs(){ return (this.cfg.dayLengthMin|0) * 60 * 1000; }

  // «положение на суточной окружности» в миллисекундах сим-суток
  _progressMs() {
    const passed = Date.now() - this.anchorMs;   // реальное прошедшее
    const total  = this._totalMs();              // длительность одних сим-суток
    // offsetMin — положение старта в минутах 24ч; растягиваем под total
    const baseMs = Math.floor(((this.offsetMin|0) % 1440) / 1440 * total);
    let p = (passed + baseMs) % total;
    if (p < 0) p += total;
    return p;
  }

  // текущие 24ч (0..1), hh:mm и фаза с прогрессом t (0..1)
  getInfo() {
    // 0..1 по суткам
    const pct24 = (this._progressMs() / this._totalMs()) % 1;
    // минуты 0..1439
    const mins24 = Math.floor(pct24 * 1440);
    const h = Math.floor(mins24 / 60) % 24;
    const m = mins24 % 60;
    const clock = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;

    // вычисляем фазу по расписанию
    const { phase, next, t } = this._phaseAt(mins24);

    return { phase, next, t, h, m, clock, pct24 };
  }

  _phaseAt(mins24) {
    const S = this._schedMin; // [['dawn',360], ...]
    // helper: продолжительность от a до b по кругу суток
    const span = (a, b) => (b - a + 1440) % 1440;

    // найдём ту пару [start_i, start_{i+1}) которая содержит текущие минуты
    for (let i = 0; i < S.length; i++) {
      const curName = S[i][0];
      const curStart = S[i][1];
      const nextName = S[(i+1) % S.length][0];
      const nextStart = S[(i+1) % S.length][1];

      const dur = span(curStart, nextStart) || 1; // чтобы не делить на 0
      const into = span(curStart, mins24);

      // попали ли мы в интервал [curStart, nextStart) с учётом свёртки
      const inInterval = (curStart <= nextStart)
        ? (mins24 >= curStart && mins24 < nextStart)
        : (mins24 >= curStart || mins24 < nextStart); // через полночь

      if (inInterval) {
        return { phase: curName, next: nextName, t: into / dur };
      }
    }

    // На всякий случай (не должно происходить): считаем что ночь, t=0
    return { phase: 'night', next: 'dawn', t: 0 };
  }

  _tick(initial = false) {
    const { phase } = this.getInfo();
    if (initial || phase !== this.curPhase) {
      this.curPhase = phase;
      this.onPhaseChange?.(phase);
    }
  }

  // (необязательный) быстрый сеттер времени — удобно для дебага:
  // tc.setClock('18:30') → мгновенно «перемотать» часы
  setClock(hhmm) {
    this.offsetMin = this._parseHHMM(hhmm);
    VM.set?.('clockOffsetMin', this.offsetMin);
    // принудительно дёрнем тик — чтобы колбэки/часы обновились сразу
    this._tick(true);
  }
}

export default TimeCycle;
