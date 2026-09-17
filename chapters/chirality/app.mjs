import { CHAPTER, PAGES, QUESTIONS, CRYSTALS, INITIAL_CHOICES, REFLECTION_CHOICES, SOURCES, ARTWORK } from './data.mjs';
import { STORAGE_KEY, freshState, restore, transition, canAdvance, passed, result, packet, clues, notes, marks } from './state.mjs';
import { diagram, crystalMarkup } from './visuals.mjs';
import { buildScoreDraftUrl, buildCommentDraftUrl, validateCommunitySnapshot, SNAPSHOT_URL, REPOSITORY } from '../../community/community.mjs';

const $ = id => document.getElementById(id);
const element = (tag, className, text) => { const el = document.createElement(tag); if (className) el.className = className; if (text !== undefined) el.textContent = text; return el; };
const button = (text, fn, className = '', id = '') => { const el = element('button', className, text); el.type = 'button'; el.onclick = fn; if (id) el.id = id; return el; };
const link = (text, href, external = false) => { const el = element('a', '', text); el.href = href; if (external) { el.target = '_blank'; el.rel = 'noopener noreferrer'; } return el; };
const paragraph = (parent, text, className = '') => parent.append(element('p', className, text));
let state = freshState(), volatile = false, selectedCrystal = 0, dialogReturnFocus = null;
let boardTimer, boardAbort;
function warn(text) { $('storage-warning').hidden = !text; $('storage-warning').textContent = text; }
try { const raw = localStorage.getItem(STORAGE_KEY); state = restore(raw) ?? state; if (raw && !restore(raw)) warn('旧调查记录无法读取，已打开新一轮。其他章节记录不受影响。'); } catch { volatile = true; warn('浏览器暂不允许保存。仍可完成调查；离开前可导出笔记。'); }
function persist() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); volatile = false; } catch { volatile = true; warn('保存失败，本次仍可继续。离开前请导出笔记；刷新可能丢失本次进度。'); } }
function dispatch(action, focusId, rerender = true) {
  try {
    const latest = restore(localStorage.getItem(STORAGE_KEY));
    if (latest && latest.runId !== state.runId) { state = latest; render(); warn('本章在另一标签页重新开始，已载入那一轮记录。'); return; }
    if (latest && latest.revision > state.revision) state = latest;
  } catch { /* Keep playable in memory. */ }
  const next = transition(state, action);
  if (next === state) return;
  state = next; persist();
  if (rerender) { render(); if (focusId) $(focusId)?.focus(); else if (['advance','visit'].includes(action.type)) { $('page-title')?.focus(); window.scrollTo({ top: 0, behavior: 'instant' }); } }
}
window.addEventListener('storage', event => {
  if (event.key !== STORAGE_KEY) return;
  const incoming = restore(event.newValue);
  if (incoming) { state = incoming; render(); warn('已同步另一标签页的本章记录。'); }
});
function showDialog(title) { dialogReturnFocus = document.activeElement; $('dialog-title').textContent = title; $('dialog-body').replaceChildren(); $('dialog').showModal(); return $('dialog-body'); }
function closeDialog() { $('dialog').close(); }
$('close-dialog').onclick = closeDialog;
$('dialog').addEventListener('close', () => { clearInterval(boardTimer); boardAbort?.abort(); dialogReturnFocus?.focus(); });
function downloadNotes() { const url = URL.createObjectURL(new Blob([notes(state)], { type: 'text/markdown;charset=utf-8' })); const a = link('', url); a.download = 'chirality-investigation.md'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
$('clues-button').onclick = () => {
  const body = showDialog('你的线索本');
  const found = clues(state);
  if (!found.length) paragraph(body, '还没有获得线索，继续观察。');
  const list = element('ol'); found.forEach(p => list.append(element('li', '', p.clue))); body.append(list);
  paragraph(body, '仅显示已经到达的证据；当前判断与事后回望只在本机保存。', 'note');
  paragraph(body, `起点：${INITIAL_CHOICES[state.initial] ?? '未选择'}`);
  if (state.furthest >= 12) paragraph(body, `回望：${REFLECTION_CHOICES[state.reflection.evidence] ?? '未选择'} ${state.reflection.text}`);
  body.append(button('导出调查笔记', downloadNotes, 'primary'));
  const details = element('details'); details.append(element('summary', '', '回看已到达的页面'));
  const route = element('div','route-list'); PAGES.slice(0,state.furthest+1).forEach((p,i)=>route.append(button(`${i+1} · ${p.title}`,()=>{closeDialog();dispatch({type:'visit',index:i});}))); details.append(route); body.append(details);
};
$('sources-button').onclick = () => {
  const body = showDialog('史实、示意与现代解释');
  paragraph(body, '本章依据真实发现过程改编，不是 Pasteur 的逐字对白。A/B 编号、八颗晶体、规范化对照、α 符号和页面顺序均为教学安排。');
  paragraph(body, '史料标题及外部页面可能含后续结论；希望保持探索顺序，可以在通关后再展开。', 'note');
  const details = element('details'); details.append(element('summary','','展开科学资料来源（可能含后续结论）'));
  const list = element('ul','source-list'); SOURCES.forEach(([name,url])=>{const li=element('li');li.append(link(name,url,true));list.append(li);}); details.append(list); body.append(details);
  paragraph(body, '科学示意均由本项目用 SVG 绘制，不是史料照片。原作品素材署名与第三方软件许可仍保留。');
  body.append(link('查看完整科学来源与文案边界','./docs/science-sources.md'));
};
function restart() {
  const body = showDialog('重新开始这一关？');
  paragraph(body, '将开启新的本章调查，替换这一关的进度、成绩与反思。其他章节不受影响。你可以先导出本章笔记。');
  const actions=element('div','actions');actions.append(button('先导出笔记',downloadNotes),button('取消',closeDialog),button('只重新开始本章',()=>{state=freshState();selectedCrystal=0;persist();closeDialog();render();$('page-title').focus();},'primary'));body.append(actions);
}
$('restart-button').onclick=restart;
function reflectionControl(parent, initial = false) {
  const choices = initial ? INITIAL_CHOICES : REFLECTION_CHOICES;
  const current = initial ? state.initial : state.reflection.evidence;
  if (!initial) paragraph(parent, `你最初的判断：${INITIAL_CHOICES[state.initial] ?? '当时未选择；不补写过去的判断。'}`, 'feedback');
  const group = element('div','choices'); group.setAttribute('role','group');group.setAttribute('aria-label',initial?'当前判断，不计分':'最有影响的证据，不计分');
  choices.forEach((text,i)=>{const b=button(text,()=>dispatch(initial?{type:'initial',choice:i}:{type:'reflection',evidence:i},`reflection-${i}`),`choice${current===i?' selected':''}`,`reflection-${i}`);b.setAttribute('aria-pressed',String(current===i));b.disabled=initial&&(state.furthest>1||state.initial!==null);group.append(b);});parent.append(group);
  if(initial){paragraph(parent,state.initial!==null?'已记下你的起点。这不是判分题，接下来让证据说话。':state.furthest>1?'当时没有选择，保留这项空白。':'可以不选，直接继续。','saved-reflection');}
  else {const label=element('label','reflection-text','用你自己的话补充（可选，最多500字）');label.htmlFor='reflection-text';const textarea=element('textarea');textarea.id='reflection-text';textarea.maxLength=1000;textarea.value=state.reflection.text;textarea.oninput=()=>dispatch({type:'reflection',text:textarea.value},null,false);parent.append(label,textarea);paragraph(parent,'输入自动保存在本机，不公开。','saved-reflection');}
}
function sortControl(parent) {
  const grid=element('div','sort-grid');grid.setAttribute('role','group');grid.setAttribute('aria-label','八颗晶体');
  CRYSTALS.forEach((side,i)=>{const b=button('',()=>{selectedCrystal=i;render();$(`crystal-${i}`)?.focus();},`crystal${state.groups[i]?' done':''}`,`crystal-${i}`);b.innerHTML=crystalMarkup(side,true);b.append(element('span','',`#${i+1} ${state.groups[i]?(side==='left'?'左组 ✓':'右组 ✓'):'待分组'}`));b.setAttribute('aria-label',`晶体 ${i+1}，小晶面朝${side==='left'?'左':'右'}，${state.groups[i]?'已分组':'待分组'}`);b.setAttribute('aria-pressed',String(selectedCrystal===i));grid.append(b);});parent.append(grid);
  const controls=element('div','sort-controls');
  ['left','right'].forEach(side=>controls.append(button(`把 #${selectedCrystal+1} 放入${side==='left'?'左':'右'}组`,()=>{
    if(CRYSTALS[selectedCrystal]!==side){$('sort-status').textContent='再看标出的那一小块晶面，它朝另一侧。分类不影响成绩。';return;}
    const index=selectedCrystal;const next=state.groups.findIndex((s,i)=>s===null&&i!==index);if(next>=0)selectedCrystal=next;
    dispatch({type:'classify',index,side},`crystal-${selectedCrystal}`);
  })));
  parent.append(controls);const status=element('p','sort-status',state.groups.every(Boolean)?'8 / 8 · 两组已经分好。外形的差别还不是旋光的结论。':`${state.groups.filter(Boolean).length} / 8 · 选中 #${selectedCrystal+1}，按小晶面方向选组。`);status.id='sort-status';status.setAttribute('role','status');parent.append(status);
}
function quizControl(parent, index) {
  const q=QUESTIONS[index], answer=state.answers[q.id], done=passed(state,q), choice=answer?.choices.at(-1);
  const section=element('section','question');section.setAttribute('aria-labelledby','question-title');section.append(element('p','eyebrow',`推理 ${index+1} / 6`));const heading=element('h2','',q.prompt);heading.id='question-title';section.append(heading);
  if(!done){const rules=element('details','rules');rules.append(element('summary','','可以试错与求助 · 查看计分方式'),element('p','','每题等权：首次独立答对100，答错后纠正60，使用提示后掌握30，最后取平均。阅读速度不计分。'));section.append(rules);}
  const group=element('div','choices');group.setAttribute('role','group');group.setAttribute('aria-label','选择答案');
  q.options.forEach((o,i)=>{const b=button('',()=>dispatch({type:'choose',choice:i},'answer-feedback'),`choice${choice===i?(done?' selected':' wrong'):''}`,`answer-${i}`);b.append(element('span','letter',String.fromCharCode(65+i)),element('span','',o.label));b.disabled=done;b.setAttribute('aria-pressed',String(choice===i));group.append(b);});section.append(group);
  if(choice!==undefined){const feedback=element('div',`feedback${done?' correct':''}`);feedback.id='answer-feedback';feedback.tabIndex=-1;feedback.setAttribute('role','status');feedback.append(element('strong','',done?'判断正确 · 线索继续向前':'这条路暂时走不通'));paragraph(feedback,q.options[choice].explanation);if(done)paragraph(feedback,q.reason);else paragraph(feedback,'依据这条反馈，再选一次。');section.append(feedback);}
  if(!done&&!answer?.hinted)section.append(button('需要一点提示（掌握后该题记30）',()=>dispatch({type:'hint'},'hint'),'hint-button'));
  if(answer?.hinted&&!done){const hint=element('div','hint',q.hint);hint.id='hint';hint.tabIndex=-1;hint.setAttribute('role','status');section.append(hint);}
  parent.append(section);
}
function render() {
  $('clue-count').textContent=String(clues(state).length);
  const root=$('app');root.replaceChildren();const shell=element('div','shell');root.append(shell);
  if(state.cursor===PAGES.length){renderResults(shell);return;}
  const p=PAGES[state.cursor];const top=element('div','reading-top');top.append(element('span','',`镜子里的两种分子 · ${String(state.cursor+1).padStart(2,'0')} / 14`),link('全部故事','./index.html'));shell.append(top);
  const progress=element('progress');progress.max=PAGES.length;progress.value=state.cursor+1;progress.setAttribute('aria-label','章节阅读进度');shell.append(progress);
  const grid=element('div','page-grid'),visual=element('section','visual-panel'),read=element('article','read-panel');
  visual.setAttribute('aria-label','本页科学示意');visual.innerHTML=diagram(p.visual);paragraph(visual,p.label,'figure-label');paragraph(visual,`化学 · 生命科学 · 实验推理 / ${CHAPTER.difficulty} / ${CHAPTER.minutes}`,'chapter-tag');
  const art = ARTWORK[p.id];
  if (art) {
    visual.classList.add('has-artwork');
    const figure = element('figure','story-art'), img = element('img');
    img.src = `./pics/${art.file}`; img.alt = art.alt;
    img.width = 1536; img.height = 1024; img.decoding = 'async';
    const caption = element('figcaption','','AI 辅助叙事插画 · 非史料或实测图；科学关系见下方示意。');
    img.onerror = () => { img.hidden = true; caption.textContent = '叙事插画暂未载入；下方科学示意与作答不受影响。'; };
    figure.append(img,caption); visual.prepend(figure);
  }
  paragraph(read,p.phase,'phase');const title=element('h1','',p.title);title.id='page-title';title.tabIndex=-1;read.append(title);p.paragraphs.forEach(t=>paragraph(read,t));
  if(p.interaction==='initial')reflectionControl(read,true);if(p.interaction==='sort')sortControl(read);if(p.interaction==='reflect')reflectionControl(read);
  if(p.quiz!==undefined)quizControl(read,p.quiz);
  if(p.note)paragraph(read,p.note,'note');if(p.detail){const d=element('details');d.append(element('summary','',p.detail[0]),element('p','',p.detail[1]));read.append(d);}
  grid.append(visual,read);shell.append(grid);
  const nav=element('nav','page-nav');nav.setAttribute('aria-label','故事翻页');const prev=button('← 上一页',()=>dispatch({type:'visit',index:state.cursor-1}));prev.disabled=state.cursor===0;
  let nextText=state.cursor===PAGES.length-1?'查看本章成绩 →':'下一页 →';if(!canAdvance(state))nextText=p.interaction==='sort'?'先完成晶体分类':'先完成这次判断';else if(state.cursor===4||state.cursor===6)nextText='打开实验记录 →';
  const next=button(nextText,()=>dispatch({type:'advance'}),'primary','next-page');next.disabled=!canAdvance(state);nav.append(prev,next);shell.append(nav);paragraph(shell,volatile?'本次暂存在内存，请导出调查笔记。':'本章书签与线索自动保存 · 反思不计分 · 可随时回看','save-note');
}
function renderResults(parent) {
  const stats=result(state);const box=element('section','results');parent.append(box);paragraph(box,'调查完成 · 14 页 / 6 道推理','eyebrow');const title=element('h1','','从一个零，到一条证据链');title.id='page-title';title.tabIndex=-1;box.append(title);
  if(!stats){paragraph(box,'记录不完整，不能生成成绩。请重新开始本章。');box.append(button('重新开始',restart));return;}
  const summary=element('div','result-heading'),score=element('div','score',String(stats.score));score.append(element('small','',' / 100'));const intro=element('div');intro.append(element('h2','',stats.score>=90?'独立推理者':stats.score>=70?'证据追踪者':'坚持求证者'));paragraph(intro,'你完成了分离、预测、重建与边界检验。');summary.append(score,intro);box.append(summary);
  const metrics=element('dl','metrics');[['首次独立答对',stats.firstCorrectCount],['纠错后答对',stats.correctedCount],['使用提示后掌握',stats.hintedCount]].forEach(([name,n])=>{const d=element('div');d.append(element('dt','',name));const dd=element('dd','',String(n));dd.append(element('small','',' 题'));d.append(dd);metrics.append(d);});box.append(metrics);
  paragraph(box,'总题数 6。各题等权，按100／60／30取平均后四舍五入；分类、反思和阅读时间不影响分数。','count');
  box.append(element('h2','','值得回看的推理'));const review=element('ol','review-list');const currentMarks=marks(state);QUESTIONS.forEach((q,i)=>{if(currentMarks[i]==='f')return;const li=element('li');li.append(button(`${i+1}. ${q.skill} · ${currentMarks[i]==='h'?'使用过提示':'纠错后掌握'}`,()=>dispatch({type:'visit',index:PAGES.findIndex(p=>p.quiz===i)})));review.append(li);});if(review.children.length)box.append(review);else paragraph(box,'六题均首次独立答对。仍可从线索本回看证据的适用范围。');
  const actions=element('div','actions');actions.append(button('自愿提交成绩与留言',()=>showSubmission(true),'primary'),button('排行榜与玩家评论',openBoard),button('导出本机调查笔记',downloadNotes),button('重新挑战本章',restart));box.append(actions);
  if(!REPOSITORY)paragraph(box,'公开投稿暂不可用，成绩已保存在当前浏览器。你可以导出调查笔记，稍后再试。','note');
  paragraph(box,'分享成绩与感想完全自愿。未主动发布的成绩和调查反思只保存在当前浏览器。','note');
}
function showSubmission(withScore) {
  const body=showDialog(withScore?'自愿提交成绩与留言':'自愿留下评论');
  paragraph(body,'只有你在 GitHub 核对并确认发布，成绩或留言才会公开。本机反思不上传。昵称、星级和评论均可选；单独评论至少填写文字或星级。');
  if(!REPOSITORY){paragraph(body,'站点尚未开放公开投稿，请稍后重试或联系维护者。你的成绩仍保存在当前浏览器。','warning');return;}
  paragraph(body,`公开投稿目的地：${REPOSITORY}`,'note');
  const form=element('form','form');
  const input=(name,text,tag='input')=>{const l=element('label','',text),el=element(tag);el.id=name;l.htmlFor=name;l.append(el);form.append(l);return el;};
  const nickname=input('nickname','昵称（可选，最多24字）');nickname.maxLength=48;
  const rating=input('rating','星级（可选）','select');rating.append(new Option('暂不评分',''));for(let i=1;i<=5;i++)rating.append(new Option(`${i} 星`,String(i)));
  const comment=input('comment','文字意见（可选，最多500字）','textarea');comment.maxLength=1000;
  const consentLabel=element('label','consent'),consent=element('input');consent.type='checkbox';consent.id='public-consent';consentLabel.append(consent,element('span','','我了解账号、昵称、所选星级、成绩及评论将公开；在 GitHub 仍需由我确认。'));form.append(consentLabel);
  const error=element('p','status');error.setAttribute('role','status');const submit=element('button','primary','预览投稿草稿');submit.type='submit';submit.disabled=true;consent.onchange=()=>{submit.disabled=!consent.checked;};form.append(submit,error);body.append(form);
  form.onsubmit=event=>{event.preventDefault();if(!consent.checked)return;try{const fields={nickname:nickname.value,comment:comment.value,rating:rating.value?Number(rating.value):null};const draft=withScore?buildScoreDraftUrl(packet(state),fields):buildCommentDraftUrl({chapter:'chirality',...fields});form.hidden=true;const preview=element('section');preview.append(element('h3','','核对公开内容'));const area=element('textarea','draft');area.readOnly=true;area.setAttribute('aria-label','公开投稿草稿');area.value=draft.body;preview.append(area);if(draft.copyRequired)paragraph(preview,'内容较长：请复制下方完整草稿，在 GitHub 正文中粘贴后再发布。','warning');const actions=element('div','actions');actions.append(button('复制草稿',async()=>{try{await navigator.clipboard.writeText(draft.body);status.textContent='草稿已复制。';}catch{area.focus();area.select();status.textContent='请手动复制已选中的草稿。';}}),link('前往 GitHub 核对并发布 ↗',draft.url,true),button('返回修改',()=>{preview.remove();form.hidden=false;}));const status=element('p','status');status.setAttribute('role','status');preview.append(actions,status);body.append(preview);}catch(e){error.textContent=e.message;}};
}
function openBoard() {
  const body=showDialog('本章排行榜与玩家评论');paragraph(body,'玩家自报学习记录；同一 GitHub 账号保留本章最高分，同分并列，不以速度排名。','note');
  const controls=element('div','actions');const content=element('div');const status=element('p','status');status.setAttribute('role','status');
  const load=async()=>{boardAbort?.abort();boardAbort=new AbortController();const controller=boardAbort;const timeout=setTimeout(()=>controller.abort(),12000);status.textContent='正在读取社区记录……';try{const response=await fetch(`${SNAPSHOT_URL}?refresh=${Date.now()}`,{signal:controller.signal,credentials:'omit',cache:'no-store'});if(!response.ok)throw Error('读取失败');const raw=await response.text();if(raw.length>2e6)throw Error('数据过大');const snapshot=validateCommunitySnapshot(JSON.parse(raw));if(!snapshot)throw Error('数据格式或仓库配置不匹配');if(controller!==boardAbort)return;renderBoard(content,snapshot);status.textContent=REPOSITORY?`快照更新：${new Date(snapshot.updatedAt).toLocaleString('zh-CN')}`:'社区暂未开放，公开记录将在服务恢复后显示。';}catch(e){if(controller!==boardAbort||!$('dialog').open)return;status.textContent=`暂时无法读取社区记录（${e.message}）。本机成绩不受影响，可稍后刷新。`;}finally{clearTimeout(timeout);}};
  controls.append(button('刷新',load),button('写评论',()=>{closeDialog();showSubmission(false);}));body.append(controls,status,content);load();clearInterval(boardTimer);boardTimer=setInterval(()=>{if(!document.hidden)load();},20000);
}
export function renderBoard(parent,snapshot) {
  parent.replaceChildren();const chapter=snapshot.chapters.chirality;paragraph(parent,`本章 ${chapter.totalPlayers} 位参与者`,'board-meta');
  if(!chapter.entries.length)paragraph(parent,'还没有玩家分享成绩。完成本章后，你可以自愿留下第一条记录。','empty');
  else{const table=element('table','board');table.append(element('caption','sr-only','本章成绩排行榜'));const head=element('thead'),row=element('tr');['名次','玩家','成绩','题目状态'].forEach(t=>row.append(element('th','',t)));head.append(row);table.append(head);const tbody=element('tbody');chapter.entries.forEach(e=>{const tr=element('tr');tr.append(element('td','',String(e.rank)));const td=element('td');td.append(link(`${e.nickname} (@${e.login})`,e.issueUrl,true));tr.append(td,element('td','',`${e.score}/100`),element('td','',`${e.firstCorrectCount} 首答 / ${e.correctedCount} 纠错 / ${e.hintedCount} 提示`));tbody.append(tr);});table.append(tbody);parent.append(table);}
  parent.append(element('h3','','玩家评论'));if(!chapter.comments.length)paragraph(parent,'还没有玩家留言。','empty');chapter.comments.forEach(c=>{const article=element('article','comment');article.append(element('strong','',c.nickname),element('small','',` · @${c.login}${c.rating?' · '+c.rating+' 星':''}`));paragraph(article,c.body);article.append(link('查看原投稿 ↗',c.issueUrl,true));parent.append(article);});
}
render();
if('serviceWorker' in navigator && location.protocol!=='file:')navigator.serviceWorker.register('./chirality-sw.js').catch(()=>{});
