
// src/data/pricing.js
// Простые правила цен. Можно расширять по видам.
export const PriceRules = {
  // по-умолчанию
  _default: { kgPrice: 60, premiumMult: 2.5, premiumMinKg: 1.2, recordKg: 5 },

  // примеры видовых настроек:
  'Окунь': { kgPrice: 70, premiumMult: 2.6, premiumMinKg: 1.0, recordKg: 3.5 },
  'Щука':  { kgPrice: 18, premiumMult: 2.2, premiumMinKg: 3.0, recordKg: 9.0 },
  'Карп':  { kgPrice: 12, premiumMult: 2.4, premiumMinKg: 2.5, recordKg: 8.0 },
};

function ruleFor(f) {
  return PriceRules[f?.name] || PriceRules._default;
}

export function isPremium(f) {
  const r = ruleFor(f);
  return (f.weightKg >= r.premiumMinKg);
}

export function isRecord(f) {
  const r = ruleFor(f);
  return (f.weightKg >= r.recordKg);
}

export function priceKg(f) {
  const r = ruleFor(f);
  return Math.round(f.weightKg * r.kgPrice);
}

export function pricePremium(f) {
  const r = ruleFor(f);
  // штучно, дороже за кг
  return Math.round(f.weightKg * r.kgPrice * r.premiumMult);
}

// Разобрать садок на категории и посчитать суммы
export function summarizeKeepnet(keepnet) {
  const small = [];   // мелочь -> продаём оптом «по кг»
  const prem  = [];   // ценная -> штучно
  const rec   = [];   // рекордная -> золото (WIP)

  for (const f of keepnet) {
    if (isRecord(f))      rec.push(f);
    else if (isPremium(f)) prem.push(f);
    else                  small.push(f);
  }

  const sumSmall = small.reduce((s,f)=>s+priceKg(f),0);
  const sumPrem  = prem.reduce((s,f)=>s+pricePremium(f),0);
  const cntRec   = rec.length;

  return { small, prem, rec, sumSmall, sumPrem, cntRec };
}
