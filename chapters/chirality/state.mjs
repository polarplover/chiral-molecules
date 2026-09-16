import { PAGES, QUESTIONS, CRYSTALS, INITIAL_CHOICES, REFLECTION_CHOICES } from './data.mjs';
import { scoreMarks, parsePacket } from '../../community/community.mjs';
export const STORAGE_KEY = 'socrates-chirality-investigation-v1';
const uuid = () => globalThis.crypto.randomUUID();
export function freshState(runId = uuid()) {
  return { version: 1, chapter: 'chirality', runId, revision: 0, cursor: 0, furthest: 0, answers: {}, groups: Array(8).fill(null), initial: null, reflection: { evidence: null, text: '' }, completedAt: null };
}
export function passed(state, question) { return state.answers[question.id]?.choices.includes(question.answer) ?? false; }
export function canAdvance(state) {
  const page = PAGES[state.cursor];
  if (!page) return false;
  if (page.quiz !== undefined && !passed(state, QUESTIONS[page.quiz])) return false;
  return page.interaction !== 'sort' || state.groups.every((side, i) => side === CRYSTALS[i]);
}
export function transition(state, action, now = new Date().toISOString()) {
  const page = PAGES[state.cursor];
  const next = structuredClone(state);
  switch (action.type) {
    case 'visit':
      if (!Number.isInteger(action.index) || action.index < 0 || action.index > state.furthest) return state;
      next.cursor = action.index; break;
    case 'advance':
      if (!canAdvance(state)) return state;
      next.cursor++; next.furthest = Math.max(next.furthest, next.cursor);
      if (next.cursor === PAGES.length && !next.completedAt) next.completedAt = now;
      break;
    case 'hint':
    case 'choose': {
      if (!page || page.quiz === undefined) return state;
      const q = QUESTIONS[page.quiz];
      if (passed(state, q)) return state;
      if (action.type === 'choose' && (!Number.isInteger(action.choice) || !q.options[action.choice])) return state;
      const answer = next.answers[q.id] ?? { choices: [], hinted: false };
      if (action.type === 'hint') answer.hinted = true;
      else answer.choices.push(action.choice);
      next.answers[q.id] = answer; break;
    }
    case 'classify':
      if (page?.interaction !== 'sort' || !Number.isInteger(action.index) || action.index < 0 || action.index >= 8 || action.side !== CRYSTALS[action.index]) return state;
      next.groups[action.index] = action.side; break;
    case 'initial':
      if (page?.interaction !== 'initial' || state.furthest > state.cursor || state.initial !== null || !Number.isInteger(action.choice) || !INITIAL_CHOICES[action.choice]) return state;
      next.initial = action.choice; break;
    case 'reflection':
      if (page?.interaction !== 'reflect') return state;
      if (action.evidence !== undefined && (action.evidence === null || Number.isInteger(action.evidence) && REFLECTION_CHOICES[action.evidence])) next.reflection.evidence = action.evidence;
      if (typeof action.text === 'string') next.reflection.text = Array.from(action.text).slice(0, 500).join('');
      break;
    default: return state;
  }
  next.revision++; return next;
}
// Validate persisted data and clamp the bookmark to the first unfinished gate.
export function restore(raw) {
  try {
    const saved = JSON.parse(raw);
    if (!saved || saved.version !== 1 || saved.chapter !== 'chirality' || !/^[0-9a-f-]{36}$/i.test(saved.runId)) return null;
    const state = freshState(saved.runId);
    if (!Number.isSafeInteger(saved.furthest) || saved.furthest < 0 || saved.furthest > PAGES.length) return null;
    state.revision = Number.isSafeInteger(saved.revision) && saved.revision >= 0 ? saved.revision : 0;
    state.furthest = saved.furthest;
    for (const [i, page] of PAGES.entries()) {
      if (i > state.furthest) break;
      if (page.quiz !== undefined) {
        const q = QUESTIONS[page.quiz], a = saved.answers?.[q.id];
        if (a && Array.isArray(a.choices) && a.choices.every(c => Number.isInteger(c) && q.options[c]) && typeof a.hinted === 'boolean') {
          const correct = a.choices.indexOf(q.answer);
          state.answers[q.id] = { choices: correct < 0 ? a.choices.slice(0, 200) : a.choices.slice(0, correct + 1), hinted: a.hinted };
        }
        if (i < state.furthest && !passed(state, q)) state.furthest = i;
      }
      if (page.interaction === 'sort') {
        state.groups = CRYSTALS.map((side, j) => saved.groups?.[j] === side ? side : null);
        if (i < state.furthest && state.groups.some(s => s === null)) state.furthest = i;
      }
    }
    state.cursor = Number.isInteger(saved.cursor) ? Math.max(0, Math.min(saved.cursor, state.furthest)) : 0;
    state.initial = state.furthest >= 1 && Number.isInteger(saved.initial) && INITIAL_CHOICES[saved.initial] ? saved.initial : null;
    if (state.furthest >= 12) {
      state.reflection = { evidence: Number.isInteger(saved.reflection?.evidence) && REFLECTION_CHOICES[saved.reflection.evidence] ? saved.reflection.evidence : null, text: typeof saved.reflection?.text === 'string' ? Array.from(saved.reflection.text).slice(0, 500).join('') : '' };
    }
    if (state.furthest === PAGES.length && typeof saved.completedAt === 'string' && Number.isFinite(Date.parse(saved.completedAt))) state.completedAt = saved.completedAt;
    return state;
  } catch { return null; }
}
export function marks(state) {
  return QUESTIONS.map(q => !passed(state, q) ? '' : state.answers[q.id].hinted ? 'h' : state.answers[q.id].choices[0] === q.answer ? 'f' : 'r').join('');
}
export function result(state) { return state.completedAt && state.furthest === PAGES.length ? scoreMarks('chirality', marks(state)) : null; }
export function packet(state) {
  return result(state) ? parsePacket({ version: 1, chapter: 'chirality', runId: state.runId, completedAt: state.completedAt, marks: marks(state) }) : null;
}
export function clues(state) { return PAGES.slice(0, Math.min(state.furthest + 1, PAGES.length)).filter(p => p.clue && (p.interaction !== 'sort' || state.groups.every(Boolean))); }
export function notes(state) {
  const stats = result(state);
  return ['# 镜子里的两种分子 · 我的调查记录', '', ...clues(state).map(p => `- ${p.clue}`), '', '## 不计分的反思（仅本机）', `起点：${INITIAL_CHOICES[state.initial] ?? '未选择'}`, `最有影响的证据：${REFLECTION_CHOICES[state.reflection.evidence] ?? '未选择'}`, state.reflection.text, '', `成绩：${stats ? stats.score + '/100' : '尚未完成'}`].join('\n');
}
