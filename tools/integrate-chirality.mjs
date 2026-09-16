// Narrow, assertion-checked edits to the upstream compiled release, not a rebuild.
// Run once against the audited upstream version; committed index.html is ready to serve.
import { readFile, writeFile } from 'node:fs/promises';
const path = new URL('../index.html', import.meta.url);
let html = await readFile(path, 'utf8');
if (html.includes('CHIRALITY_INTEGRATION_V1')) { console.log('Integration already present.'); process.exit(0); }
function replace(before, after) {
  if (html.split(before).length !== 2) throw new Error(`Expected exactly one integration anchor: ${before.slice(0,90)}`);
  html = html.replace(before, after);
}
replace('<script type="module">', '<!-- CHIRALITY_INTEGRATION_V1 --><script src="./site-config.js"></script><script src="./chapters/chirality/entry.js"></script><script type="module">');
replace('var Q=`yaoyuzhang1/socrates-question`;', 'var Q=globalThis.SOCRATES_CONFIG.repository;');
replace('argon:12,nucleus:12}),Ll=', 'argon:12,nucleus:12,chirality:6}),Ll=');
replace('nucleus:`金箔背后的反击`}),Rl=', 'nucleus:`金箔背后的反击`,chirality:`镜子里的两种分子：零度读数的秘密`}),Rl=');
replace('function Ql(e){let t=Zl(e)', 'function Ql(e){globalThis.SOCRATES_CONFIG.assertConfigured();let t=Zl(e)');
replace('e.repository!==`yaoyuzhang1/socrates-question`', 'e.repository!==Q');
replace('e.issueUrl!==`https://github.com/yaoyuzhang1/socrates-question/issues/${e.issueNumber}`', 'e.issueUrl!==`https://github.com/${Q}/issues/${e.issueNumber}`');
replace('var ru=`https://github.com/yaoyuzhang1/socrates-question`,iu=`https://raw.githubusercontent.com/yaoyuzhang1/socrates-question/main/community.json`', 'var ru=globalThis.SOCRATES_CONFIG.repositoryUrl,iu=globalThis.SOCRATES_CONFIG.snapshotUrl');
replace('catch{y(`请填写昵称，并将评论控制在500字以内。单独评价时需要填写评论。`)}', 'catch(e){y(e.message||`请检查填写内容。`)}');
replace('href:`${ru}/issues`', 'href:ru?`${ru}/issues`:`./community/README.md`');
replace('function Ru(){let[e,t]=(0,C.useState)(null)', 'function ChiralityCard(){return (0,G.jsxs)(`section`,{className:`cq-results`,\'aria-label\':`新增科学调查`,children:[(0,G.jsx)(`p`,{className:`cq-kicker`,children:`新增短篇 · 7—9 分钟 · 6 道推理`}),(0,G.jsx)(`h2`,{children:`镜子里的两种分子：零度读数的秘密`}),(0,G.jsx)(`p`,{children:`仪器显示零，是没有作用，还是相反作用恰好抵消？从一份异常记录开始，亲手分组、预测，再重新拼回那个零。`}),(0,G.jsx)(`p`,{className:`cq-muted`,children:`化学 · 生命科学 · 实验推理 / 4/5 · 进阶`}),(0,G.jsx)(`a`,{className:`cq-primary`,href:`./chirality.html`,children:`翻开 / 继续这份调查 →`})]})}function Ru(){let[e,t]=(0,C.useState)(null)');
replace('(0,G.jsx)(gu,{onChoose:o,ready:n})', '(0,G.jsx)(ChiralityCard,{}),(0,G.jsx)(gu,{onChoose:o,ready:n})');
await writeFile(path, html);
console.log('Added chapter entrance and updated all compiled community destinations.');
