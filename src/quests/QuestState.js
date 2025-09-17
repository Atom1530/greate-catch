// src/quests/QuestState.js
import { getAllNPC } from '../data/QuestDB.js';
import { emitQuestProgress } from './QuestEvents.js';

const LS_KEY = 'rf_quest_state_v1';
let _state = load() || { npcs: {}, trackedNpcId: null };

function load(){ try { return JSON.parse(localStorage.getItem(LS_KEY)); } catch { return null; } }
function save(){ try { localStorage.setItem(LS_KEY, JSON.stringify(_state)); } catch {} }
function ensureNpc(npcId){ if (!_state.npcs[npcId]) _state.npcs[npcId] = { stageIndex: 0, tasks: {} }; return _state.npcs[npcId]; }

function emit(type, detail={}){ emitQuestProgress({ type, ...detail }); }


export const QuestState = {
  getNPC(npcId){ return ensureNpc(npcId); },

  // ── трекинг активного NPC ─────────────────────────────────
  getTrackedNpcId(){ return _state.trackedNpcId ?? null; },
  setTrackedNpcId(npcId){
    _state.trackedNpcId = npcId || null;
    save(); emit('tracked-change', { npcId: _state.trackedNpcId });
  },

  getActiveStage(npcId){
    const npcDef = getAllNPC().find(n => n.id === npcId);
    if (!npcDef) return null;
    const stIx = ensureNpc(npcId).stageIndex | 0;
    return npcDef.stages?.[stIx] ?? null;
  },

  isTaskDone(npcId, task){
    const rec = ensureNpc(npcId).tasks[task.id] || {};
    if (task.countGoal != null) return (rec.count|0) >= (task.countGoal|0);
    return !!rec.done;
  },

  addTaskCount(npcId, taskId, delta = 1){
    const npc = ensureNpc(npcId);
    const rec = npc.tasks[taskId] || (npc.tasks[taskId] = { count: 0 });
    rec.count = Math.max(0, (rec.count|0) + (delta|0));
    save(); emit('task-count', { npcId, taskId, count: rec.count });
    return rec.count;
  },

  markTaskDone(npcId, taskId, v = true){
    const npc = ensureNpc(npcId);
    npc.tasks[taskId] = { ...(npc.tasks[taskId]||{}), done: !!v };
    save(); emit('task-done', { npcId, taskId });
  },

  tryAdvanceStage(npcId){
    const npcDef = getAllNPC().find(n => n.id === npcId);
    if (!npcDef) return false;
    const npc = ensureNpc(npcId);
    const stage = npcDef.stages?.[npc.stageIndex|0];
    if (!stage) return false;

    const tasks = Array.isArray(stage.tasks) ? stage.tasks : [];
    const allDone = tasks.every(t => this.isTaskDone(npcId, t));
    if (allDone){
      const finishedIndex = npc.stageIndex|0;
      npc.stageIndex = finishedIndex + 1;
      save();
      emit('stage-complete', { npcId, stageIndex: finishedIndex });
      emit('stage-changed',  { npcId, stageIndex: npc.stageIndex });
      return true;
    }
    return false;
  },
  // ДОБАВЬ внутрь export const QuestState = { ... }

  /** Все задачи текущей стадии выполнены? */
  isStageComplete(npcId){
    const npcDef = getAllNPC().find(n => n.id === npcId);
    if (!npcDef) return false;
    const stIx = ensureNpc(npcId).stageIndex | 0;
    const stage = npcDef.stages?.[stIx];
    if (!stage) return false;
    const tasks = Array.isArray(stage.tasks) ? stage.tasks : [];
    return tasks.every(t => this.isTaskDone(npcId, t));
  },

  /** Прогресс первой считаемой задачи текущей стадии (для хедера модалки) */
  getHeaderProgress(npcId){
    const npcDef = getAllNPC().find(n => n.id === npcId);
    if (!npcDef) return { cur:0, goal:0, task:null };
    const stIx = ensureNpc(npcId).stageIndex | 0;
    const stage = npcDef.stages?.[stIx];
    if (!stage) return { cur:0, goal:0, task:null };

    const pick = (stage.tasks||[]).find(t => !this.isTaskDone(npcId,t) && t.countGoal!=null)
              || (stage.tasks||[]).find(t => t.countGoal!=null)
              || null;

    if (!pick) return { cur:0, goal:0, task:null };
    const rec = (ensureNpc(npcId).tasks[pick.id]) || { count:0 };
    const cur  = Math.min(rec.count|0, pick.countGoal|0);
    const goal = pick.countGoal|0;
    return { cur, goal, task: pick };
  },

  /** Кнопка «Забрати нагороду»: инкремент стадии и очистка задач. Возвращает reward или null. */
  claimStageReward(npcId){
    const npcDef = getAllNPC().find(n => n.id === npcId);
    if (!npcDef) return null;
    const npc = ensureNpc(npcId);
    const stIx = npc.stageIndex | 0;
    const stage = npcDef.stages?.[stIx];
    if (!stage) return null;

    const tasks = Array.isArray(stage.tasks) ? stage.tasks : [];
    const allDone = tasks.every(t => this.isTaskDone(npcId, t));
    if (!allDone) return null;

    const reward = stage.reward || null;
    npc.stageIndex = stIx + 1;
    npc.tasks = {};                 // очистили прогресс задач
    save();
    emit('stage-claimed', { npcId, stageIndex: stIx });
    emit('stage-changed', { npcId, stageIndex: npc.stageIndex });
    return reward;
  },


  resetAll(){ _state = { npcs: {}, trackedNpcId: null }; save(); emit('reset'); }
};

export default QuestState;
