// src/quests/QuestHooks.js
import { QuestState } from './QuestState.js';
import { getAllNPC } from '../data/QuestDB.js';
import { matchTask } from './QuestKinds.js';
import { emitQuestProgress } from './QuestEvents.js';


// Единая обработка для любого события (ev): 'catch' | 'wallet' | 'shop' | 'level' | 'inventory'
function processEvent(ev, payload, ctx = {}) {
  const tracked = QuestState.getTrackedNpcId();
  const targets = tracked ? getAllNPC().filter(n => n.id === tracked) : getAllNPC();

  const ctxExt = { ...ctx, ev };

  for (const npc of targets) {
    const stage = QuestState.getActiveStage(npc.id);
    if (!stage || !Array.isArray(stage.tasks) || !stage.tasks.length) continue;

    let changed = false;

    for (const t of stage.tasks) {
      if (QuestState.isTaskDone(npc.id, t)) continue;

      if (!matchTask(t, payload, ctxExt)) continue;

      if (t.countGoal != null) QuestState.addTaskCount(npc.id, t.id, 1);
      else                     QuestState.markTaskDone(npc.id, t.id, true);
      changed = true;
    }

    if (changed){
  emitQuestProgress({ type: ev });
}
    if (tracked) break;
  }
}

// ── Публичные хуки ───────────────────────────────────────────────────────────
export function onCatch(pick, ctx = {}) { processEvent('catch', pick, ctx); }
export function onWalletChange(wallet){ processEvent('wallet', wallet, {}); }
export function onLevelChange(progress){ processEvent('level', progress, {}); }
export function onItemBought(purchase){ processEvent('shop', purchase, {}); }
// inventory = { rods:[], reels:[], lines:[], hooks:[], items:[], baits:[] ... }
export function onInventoryChange(inventory){ processEvent('inventory', inventory, {}); }
