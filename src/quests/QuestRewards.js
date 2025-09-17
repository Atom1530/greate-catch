// src/quests/QuestRewards.js
let _sink = null;

/** Сцена/HUD может зарегистрировать обработчик, куда падать награды */
export function setRewardSink(fn){
  _sink = (typeof fn === 'function') ? fn : null;
}

/** Вызвать, когда надо начислить награду */
export function grantReward(reward){
  if (!_sink || !reward) return;
  try { _sink(reward); } catch {}
}
