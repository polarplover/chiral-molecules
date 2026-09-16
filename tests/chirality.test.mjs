import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CHAPTER, PAGES, QUESTIONS, CRYSTALS } from '../chapters/chirality/data.mjs';
import { freshState, transition, canAdvance, restore, result, marks, packet, clues, STORAGE_KEY } from '../chapters/chirality/state.mjs';
import { diagram } from '../chapters/chirality/visuals.mjs';
const run='00000000-0000-4000-8000-000000000099';
const at='2026-09-16T12:00:00.000Z';
function reach(target, mode = () => 'f') {
  let state=freshState(run);
  while(state.cursor<target){
    const p=PAGES[state.cursor];
    if(p.interaction==='sort')for(let i=0;i<8;i++)state=transition(state,{type:'classify',index:i,side:CRYSTALS[i]});
    if(p.quiz!==undefined){const q=QUESTIONS[p.quiz],mark=mode(p.quiz);if(mark==='h')state=transition(state,{type:'hint'});if(mark==='r')state=transition(state,{type:'choose',choice:(q.answer+1)%q.options.length});state=transition(state,{type:'choose',choice:q.answer});}
    assert.equal(canAdvance(state),true);state=transition(state,{type:'advance'},at);
  }
  return state;
}
test('chapter scope remains 14 short pages, 6 evidence-based questions and two ungraded reflections',()=>{
  assert.equal(PAGES.length,14);assert.equal(QUESTIONS.length,6);assert.equal(PAGES.filter(p=>p.quiz!==undefined).length,6);assert.equal(PAGES.filter(p=>['initial','reflect'].includes(p.interaction)).length,2);assert.equal(CHAPTER.minutes,'7—9 分钟');
  for(const q of QUESTIONS){assert.ok(q.options[q.answer]);assert.ok(q.hint.length>15);assert.equal(new Set(q.options.map(o=>o.explanation)).size,q.options.length);for(const o of q.options)assert.ok(o.explanation.length>20);}
});
test('every wrong answer blocks advance, preserves its reason and permits correction',()=>{
  PAGES.forEach((p,i)=>{if(p.quiz===undefined)return;const q=QUESTIONS[p.quiz];q.options.forEach((o,choice)=>{
    if(choice===q.answer)return;let s=reach(i);s=transition(s,{type:'choose',choice});assert.equal(canAdvance(s),false);assert.equal(transition(s,{type:'advance'}),s);assert.equal(s.answers[q.id].choices.at(-1),choice);assert.ok(o.explanation);s=transition(s,{type:'choose',choice:q.answer});assert.equal(canAdvance(s),true);assert.equal(marks(s).at(-1),'r');
  });});
});
test('all-first, corrected, hinted and mixed scores use equal 100/60/30 weights',()=>{
  for(const [mark,score]of [['f',100],['r',60],['h',30]])assert.equal(result(reach(14,()=>mark)).score,score);
  const mixed=reach(14,i=>['f','r','h'][i%3]);assert.deepEqual(result(mixed),{score:63,firstCorrectCount:2,correctedCount:2,hintedCount:2,totalQuestions:6});assert.equal(marks(mixed),'frhfrh');
});
test('hints never pass gates and cannot be used after completion to change a score',()=>{
  for(const p of PAGES.filter(p=>p.quiz!==undefined)){const index=PAGES.indexOf(p);let s=reach(index);s=transition(s,{type:'hint'});assert.equal(canAdvance(s),false);s=transition(s,{type:'choose',choice:QUESTIONS[p.quiz].answer});assert.equal(marks(s).at(-1),'h');assert.equal(transition(s,{type:'hint'}),s);assert.equal(transition(s,{type:'choose',choice:0}),s);}
});
test('classification requires all eight visible features, never changes score',()=>{
  let s=reach(3);assert.equal(canAdvance(s),false);assert.equal(transition(s,{type:'classify',index:0,side:'right'}),s);for(let i=0;i<8;i++)s=transition(s,{type:'classify',index:i,side:CRYSTALS[i]});assert.equal(canAdvance(s),true);assert.equal(marks(s),'f');
});
test('refresh restores every gate, attempts, hints and completion; invalid futures are clamped',()=>{
  for(let i=0;i<=14;i++){const s=reach(i,j=>['f','r','h'][j%3]);assert.deepEqual(restore(JSON.stringify(s)),s);}
  let s=reach(4);s=transition(s,{type:'choose',choice:0});s=transition(s,{type:'hint'});assert.deepEqual(restore(JSON.stringify(s)),s);
  const forged={...freshState(run),cursor:14,furthest:14,completedAt:at};assert.equal(restore(JSON.stringify(forged)).furthest,2);assert.equal(result(restore(JSON.stringify(forged))),null);assert.equal(restore('{broken'),null);
});
test('initial judgment locks after leaving; reflection is private and cannot enter packet',()=>{
  let s=reach(1);s=transition(s,{type:'initial',choice:2});assert.equal(s.initial,2);assert.equal(transition(s,{type:'initial',choice:0}),s);s=transition(s,{type:'advance'});s=transition(s,{type:'visit',index:1});assert.equal(transition(s,{type:'initial',choice:0}),s);
  s=reach(12);s=transition(s,{type:'reflection',text:'我的私人反思',evidence:3});s=transition(s,{type:'advance'});s=transition(s,{type:'advance'},at);assert.equal(result(s).score,100);assert.doesNotMatch(JSON.stringify(packet(s)),/私人|reflection|evidence|initial/);assert.equal(packet(s).marks,'ffffff');
});
test('bookmarks, clues and visual creation never unlock future evidence',()=>{
  const s=reach(4);assert.equal(transition(s,{type:'visit',index:5}),s);assert.ok(clues(s).every(p=>PAGES.indexOf(p)<=4));assert.doesNotMatch(diagram(PAGES[4].visual),/\+α|−α|方向相反|大小相近/);assert.doesNotMatch(diagram(PAGES[6].visual),/约 0|≈ 0/);assert.match(diagram(PAGES[5].visual),/\+α/);assert.match(diagram(PAGES[7].visual),/约 0/);
  for(const p of PAGES.slice(0,9))assert.doesNotMatch(p.paragraphs.join(''),/手性|对映体|外消旋/);
});
test('new chapter storage has a dedicated key; restart never clears another chapter',async()=>{
  assert.equal(STORAGE_KEY,'socrates-chirality-investigation-v1');const source=await readFile(new URL('../chapters/chirality/app.mjs',import.meta.url),'utf8');assert.doesNotMatch(source,/localStorage\.clear|localStorage\.removeItem/);assert.match(source,/localStorage\.setItem\(STORAGE_KEY/);const old=reach(14);assert.equal(freshState().cursor,0);assert.equal(old.cursor,14);
});
test('relative resources, offline manifest, strict runtime syntax and minimal shelf integration',async()=>{
  const html=await readFile(new URL('../index.html',import.meta.url),'utf8');assert.match(html,/CHIRALITY_INTEGRATION_V1/);assert.match(html,/href:`\.\/chirality.html`/);assert.match(html,/globalThis.SOCRATES_CONFIG.assertConfigured/);assert.doesNotMatch(html,/https:\/\/github\.com\/yaoyuzhang1\/socrates-question\/issues/);assert.doesNotMatch(html,/raw\.githubusercontent\.com\/yaoyuzhang1/);
  const entry=await readFile(new URL('../chirality.html',import.meta.url),'utf8');assert.doesNotMatch(entry,/(?:src|href)="\/(?!\/)/);const app=await readFile(new URL('../chapters/chirality/app.mjs',import.meta.url),'utf8');assert.match(app,/el\.textContent = text/);assert.doesNotMatch(app,/innerHTML\s*=\s*(?:c\.|comment|nickname|state)/);
});

test('narrative artwork stays on its designated evidence stage and is included in offline assets',async()=>{
  const {ARTWORK}=await import('../chapters/chirality/data.mjs');
  assert.deepEqual(PAGES.flatMap((p,i)=>ARTWORK[p.id]?[i+1]:[]),[1,4,5,8,13]);
  assert.equal(ARTWORK['predict-remix'],undefined);
  const worker=await readFile(new URL('../chirality-sw.js',import.meta.url),'utf8');
  for(const art of Object.values(ARTWORK)){
    assert.ok(art.alt.length>15);
    const bytes=await readFile(new URL('../pics/'+art.file,import.meta.url));
    assert.ok(bytes.length>1000);
    assert.ok(worker.includes('./pics/'+art.file));
  }
});
