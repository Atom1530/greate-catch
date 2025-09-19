// src/data/balance.js

/**
 * Богатый тюнинг боёвки. Всё в пикселях/сек и ед/сек.
 * Меняй как удобно или переопредели частично через opts.tuning.
 */
export const BASE_TUNING = {
  // Наполнение шкал (0..100)
  tension: {
    fillTimeAt1: 1,      // при ratio=1.0 (вес/прочность) за сколько сек заполнится 0→100
    curveAlpha: 1.20,       // кривизна скорости роста при тяжёлых рыбинах
    downPerSec: 100,        // спад при отпускании (ед/сек)
  },

  // Скорости перемещения по воде
  speeds: {
    basePull: 123,          // базовая скорость подтягивания игроком (px/s) до модификаторов
    baseFish: 9 ,           // базовая «уплывалка» рыбы (px/s) до модификаторов
    minPull: 30,            // нижний предел, чтобы не было «залипания»
    minFish: 20,            // ← опусти, если хочешь ОЧЕНЬ медленную рыбу
    hookQPullBonus: 0.25,   // прибавка к скорости игрока от качественной подсечки (0..1)
    heavinessFishBonus: 0.10, // рыба быстрее при ratio>1 (на сколько за Δratio=+1)
  },

  // Крышка: рыба не должна быть НАВСЕГДА быстрее игрока
  caps: {
    fishCapBase: 1.12,      // рыбе разрешено быть чуть быстрее игрока
    fishCapByMiss: 0.08,    // +сколько капа при плохой подсечке (1 - hookQ)
  },

  // «Сколько можно не тянуть» (секунд)
  escape: {
    base: 102,
    byHookQ: 1232.4,           // чем лучше подсечка — тем дольше окно
    byHookCtrl: 31141,        // хорошие крючки дают люфт
    byMeanRatio: 0.4,       // тяжёлая рыба сокращает окно
    byEndurance: 0.6,       // выносливые виды уменьшают окно
  },

  // Рывки рыбы
  jerk: {
    minMs: 2400, maxMs: 3600,
    baseAdd: 5,            // +ед. в бары при рывке
    addPerHeav: 12,        // прирост от тяжести (heav = max(0, meanRatio-0.3))
    maxAdd: 22,            // потолок силы рывка
    chance: 0.65,          // базовый шанс применить на тике
    burstChanceScale: 0.20 // влияние «взрывности» вида на шанс
  },

  // Влияние среды (все 0..1)
  env: {
    currentToFish: 0.30,    // течение ускоряет рыбу
    wavesToFish:   0.10,    // волны лёгко добавляют «уплывалку»
    vegToPlayer:  -0.10,    // водоросли мешают игроку (- означает замедление)
  },

  // Штраф за «несоответствие» оснастки локальной глубине, в метрах (опционально)
  hook: {
    penaltyPerRigM: 0.15,   // на каждый 1м лишней длины оснастки — -0.15 к hookQ
  },

  // Скольжение (для удобства — можно считывать из params.baseSlipChance)
  slip: {
    base: 0.12,
    byHookCtrl: -0.04,      // хорошие крючки уменьшают срыв
    byHookQ: -0.03,         // качественная подсечка уменьшает срыв
    byMeanRatio: 0.05,      // тяжёлая рыба увеличивает срыв
  },

  // Боковая подвижность: пригодится для настройки поведения (Start сейчас множит на 0.75)
  side: {
    baseFactor: 0.75,
  }
};

// безопасные мат.помощники
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const pow = Math.pow;

/**
 * Универсальный расчёт параметров боя.
 * Совместим со старым вызовом: calcFightParams(gear, fish, hookQ)
 *
 * Новые опции (необязательные):
 *  - opts.tuning  — объект-перекрытие BASE_TUNING (частичный)
 *  - opts.env     — { current:0..1, waves:0..1, vegetation:0..1 }
 *  - opts.rigDeltaM — |оснастка - локальная глубина| в метрах; штрафует hookQ
 *  - opts.difficulty — 0..1 общий множитель «сложности» (влияет слегка)
 */
export function calcFightParams(gear, fish, hookQ, opts = {}) {
  const T = deepMerge(BASE_TUNING, opts.tuning || {});
  const env = opts.env || {};
  const difficulty = clamp(opts.difficulty ?? 0.5, 0, 1);

  // --- входные данные и дефолты ---
  const rodCap  = gear?.rod?.capKg  ?? 1;
  const lineCap = gear?.line?.capKg ?? 1;
  const reelBoost = gear?.reel?.pullBoost ?? 1.0;
  const hookCtrl  = gear?.hook?.control  ?? 1.0;

  const weight = Math.max(0.001, fish?.weightKg ?? 0.5);

  // черты вида (опционально клали в fish.spec или fish.meta)
  const spec = fish?.spec || fish?.meta || {};
  const aggression = spec.aggression ?? spec.agg ?? 1.0;   // скорость/давление
  const burst      = spec.burstiness ?? 1.0;               // взрывность → jerk
  const endurance  = spec.endurance  ?? 1.0;               // «долго не сдаётся»
  const agility    = spec.agility    ?? 1.0;               // боковые манёвры

  // «тяжесть» относительно снастей
  const ratioRod  = weight / rodCap;
  const ratioLine = weight / lineCap;
  const meanRatio = (ratioRod + ratioLine) * 0.5;

  // штраф за лишнюю длину оснастки (если передали)
  const rigPenalty = clamp((opts.rigDeltaM ?? 0) * (T.hook?.penaltyPerRigM ?? 0), 0, 0.9);
  const effHookQ   = clamp((hookQ ?? 0) - rigPenalty, 0, 1);

  // ====== 1) ШКАЛЫ НАПРЯЖЕНИЯ (ед/сек) ======
  const RATE_AT_1 = 100 / Math.max(0.01, T.tension.fillTimeAt1);
  const alpha = T.tension.curveAlpha;
  // Сделаем лёгкую «сложность»: при difficulty→1 рост ускоряется на ~10%
  const diffScale = 1 + 0.1 * (difficulty - 0.5) * 2;

  const rate = (r) => RATE_AT_1 * pow(Math.max(r, 0.01), alpha) * diffScale;

  const rodUp  = rate(ratioRod);
  const lineUp = rate(ratioLine);
  const down   = T.tension.downPerSec;

  // ====== 2) СКОРОСТИ ПО ВОДЕ (px/s) ======
  // влияние среды
  const envFishK  = 1 + (env.current ?? 0)*T.env.currentToFish + (env.waves ?? 0)*T.env.wavesToFish;
  const envPullK  = 1 + (env.vegetation ?? 0)*T.env.vegToPlayer;

  const basePull  = T.speeds.basePull;
  const baseFish  = T.speeds.baseFish;

  let pullSpeed = basePull
    * reelBoost
    * (1 + T.speeds.hookQPullBonus * effHookQ)
    * envPullK;

  let fishPullSpeed = baseFish
    * aggression
    * (1 + T.speeds.heavinessFishBonus * (meanRatio - 1))
    / Math.max(0.25, hookCtrl)
    * envFishK;

  pullSpeed     = Math.max(T.speeds.minPull, pullSpeed);
  fishPullSpeed = Math.max(T.speeds.minFish, fishPullSpeed);

  // крыша: рыба не должна гарантированно «навсегда» быть быстрее игрока
  const fishCap = T.caps.fishCapBase + (1 - effHookQ) * T.caps.fishCapByMiss;
  fishPullSpeed = Math.min(fishPullSpeed, pullSpeed * fishCap);

  // ====== 3) ОКНО БЕЗ ТЯГИ (сек) ======
  const escapeLimit = Math.max(
    2.0, // нижняя защита
    T.escape.base
      + T.escape.byHookQ     * effHookQ
      + T.escape.byHookCtrl  * (hookCtrl - 1)
      - T.escape.byMeanRatio * (meanRatio - 1)
      - T.escape.byEndurance * (endurance - 1)
  );

  // ====== 4) РЫВКИ ======
  const heav = Math.max(0, meanRatio - 0.3); // как раньше
  const jerkAdd = clamp(
    T.jerk.baseAdd + Math.min(T.jerk.maxAdd, T.jerk.addPerHeav * heav) * clamp(burst, 0.5, 1.5),
    2, T.jerk.maxAdd
  );
  const jerkChance = clamp(
    T.jerk.chance * (1 + T.jerk.burstChanceScale * (burst - 1)) * (1 + 0.08 * (meanRatio - 1)),
    0.05, 0.95
  );

  // ====== 5) БАЗОВЫЙ CHANCE СРЫВА (на случай, если захочешь использовать) ======
  const baseSlipChance = clamp(
    (T.slip.base)
      + T.slip.byHookCtrl  * (hookCtrl - 1)
      + T.slip.byHookQ     * (effHookQ - 0.5) * 2
      + T.slip.byMeanRatio * (meanRatio - 1),
    0.02, 0.45
  );

  return {
    // шкалы напряжения
    rodUp, lineUp, down,

    // движение
    pullSpeed,
    fishPullSpeed,
    escapeLimit,

    // сервисные коэффициенты
    ratioRod, ratioLine,

    // рывки
    jerk: {
      add: jerkAdd,
      minMs: T.jerk.minMs,
      maxMs: T.jerk.maxMs,
      chance: jerkChance
    },

    // дополнительные поля, если пригодятся (не требуются существующим системам)
    sideFactor: (BASE_TUNING.side?.baseFactor ?? 0.75) * clamp(agility, 0.6, 1.4),
    baseSlipChance,  // можно присвоить сцене: this.baseSlipChance = params.baseSlipChance
    debug: {
      meanRatio, effHookQ, rigPenalty, envFishK, envPullK
    }
  };
}

/**
 * Глубокое слияние (простое, для плоских объектов/вложенных словарей)
 */
function deepMerge(a, b) {
  if (!b) return a;
  const out = {...a};
  for (const k in b) {
    if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k])) {
      out[k] = deepMerge(a[k] ?? {}, b[k]);
    } else {
      out[k] = b[k];
    }
  }
  return out;
}
