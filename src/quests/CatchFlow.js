// src/quests/CatchFlow.js

import { emitQuestProgress } from './QuestEvents.js';
import { onCatch as questOnCatch } from './QuestHooks.js';
import { openFishCatchModal, openLootModal } from '../ui/CatchModals.js';

export function handleCatch(scene, pick, ctx = {}) {
  function _phaseToTime(t){
  const v = String(t||'').toLowerCase();
  if (v === 'dawn') return 'morning';
  if (v === 'dusk') return 'evening';
  return v;
}

  // Собираем чуть больше контекста, если он доступен в сцене
  const mergedCtx = {
    locationId: ctx.locationId ?? scene.currentLocationId ?? scene.locationId,
    depthM:     ctx.depthM     ?? scene.rigDepthM,
    bait:       ctx.bait       ?? scene.currentBaitId,
    timeOfDay: _phaseToTime(ctx.timeOfDay ?? scene.timeOfDay ?? scene.dayPhase ?? scene.currentTimeOfDay)

  };

  // 1) Квесты — один раз здесь
try {
  questOnCatch(pick, mergedCtx);
  emitQuestProgress({ type: 'onCatch' });
  console.debug('[quests] onCatch', pick, mergedCtx);
} catch (e) {
  console.error('[quests] onCatch error', e);
}

  // 2) UI (модалки)
  if (pick.kind === 'fish') {
    return openFishCatchModal(scene, pick, {
      keepnet: scene.keepnet,
      keepnetFull: (scene.keepnet?.length ?? 0) >= (scene.keepnetCap ?? 0),
      locationId: mergedCtx.locationId,
      depthM:     mergedCtx.depthM,
      bait:       mergedCtx.bait
    });
  } else {
    const coins = pick.reward?.coins | 0;
    return openLootModal(scene, pick, { coins });
  }
}
