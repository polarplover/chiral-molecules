// Original vector diagrams. All labels are authored here, never player input.
const colors = { ink: '#244d43', muted: '#728176', gold: '#b28c42', paper: '#f1efdf' };
const label = (x, y, text, size = 17, fill = colors.ink) => `<text x="${x}" y="${y}" fill="${fill}" font-size="${size}" text-anchor="middle">${text}</text>`;
const line = (x1, y1, x2, y2, dashed = false) => `<path d="M${x1} ${y1}L${x2} ${y2}" fill="none" stroke="${colors.ink}" stroke-width="2" ${dashed ? 'stroke-dasharray="5 5"' : ''}/>`;
const arrow = (x1, y1, x2, y2) => `${line(x1, y1, x2, y2)}<path d="M${x2 - 7} ${y2 - 5}L${x2} ${y2}L${x2 - 7} ${y2 + 5}" fill="none" stroke="${colors.ink}" stroke-width="2"/>`;
function vial(x, y, caption, readout = '?') {
  return `<g transform="translate(${x} ${y})"><path d="M-22 0H22V42L50 99Q56 116 36 116H-36Q-56 116-50 99L-22 42Z" fill="#fffdf5" stroke="${colors.ink}" stroke-width="2.5"/><path d="M-34 70H34L48 100Q54 111 34 111H-34Q-54 111-48 100Z" fill="#d9e1ce"/>${label(0, 96, readout, 27)}${label(0, 145, caption, 16)}</g>`;
}
function dial(x, y, reading, angle = 0) {
  return `<g transform="translate(${x} ${y})"><circle r="45" fill="#fffdf5" stroke="${colors.ink}" stroke-width="2"/>${line(0,-36,0,36,true)}<g transform="rotate(${angle})">${line(0,-36,0,36)}<circle cy="-34" r="4" fill="${colors.gold}"/></g>${label(0,74,reading,20)}</g>`;
}
export function crystalMarkup(side, small = false) {
  return `<svg viewBox="0 0 120 120" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"><g ${side === 'right' ? 'transform="translate(120 0) scale(-1 1)"' : ''}><path d="M39 14L81 14L99 36V87L70 108L22 90V39Z" fill="#e0e7d6" stroke="#244d43" stroke-width="2"/><path d="M39 14L49 43L22 39M49 43H78L99 36M49 43V87L22 90M49 87L70 108M49 87L78 85L99 87M78 43V85" fill="none" stroke="#7a8f79" stroke-width="1.5"/><path d="M22 39L39 14L49 43Z" fill="#ba964c" stroke="#244d43" stroke-width="3"/>${small ? '' : '<path d="M5 24L25 31" stroke="#244d43" stroke-width="2"/><circle cx="7" cy="24" r="4" fill="#244d43"/>'}</g></svg>`;
}
function crystals(x, y, side) {
  return `<g transform="translate(${x} ${y}) scale(.7)">${crystalMarkup(side).replace(/<svg[^>]*>|<\/svg>/g, '')}</g>`;
}
function tetra(x, mirror = false) {
  return `<g transform="translate(${x} 158) ${mirror ? 'scale(-1 1)' : ''}">${line(0,0,0,-67)}${line(0,0,-62,40)}<path d="M0 0L61 31L51 47Z" fill="#b28c42"/><path d="M0 0L21 8M4 9L24 17M9 19L28 27M14 28L33 38M20 38L37 47" stroke="#244d43" stroke-width="2"/><circle r="14" fill="#244d43"/><circle cy="-77" r="12" fill="#d9e1ce" stroke="#244d43" stroke-width="2"/><rect x="-76" y="31" width="25" height="25" fill="#fffdf5" stroke="#244d43" stroke-width="2"/><path d="M64 27L77 51H51Z" fill="#b28c42" stroke="#244d43" stroke-width="2"/><path d="M34 44L45 56L34 68L23 56Z" fill="#fffdf5" stroke="#244d43" stroke-width="2"/></g>`;
}
export function diagram(kind) {
  let drawing = '', alt = '';
  if (kind === 'instrument') {
    alt = '旋光仪简图：光源、偏振片、样品管和方向标尺；A 明显旋转，B 约零。';
    drawing = `${label(310,34,'同一束光，经过不同样品',20)}<circle cx="66" cy="118" r="18" fill="#e9d79c" stroke="#b28c42"/>${arrow(90,118,145,118)}<rect x="157" y="77" width="16" height="82" rx="5" fill="#b7c6b3"/>${arrow(183,118,236,118)}<rect x="246" y="95" width="157" height="46" rx="15" fill="#fffdf5" stroke="#244d43" stroke-width="2"/>${arrow(414,118,468,118)}${dial(530,118,'方向标尺',0)}${label(65,191,'光源',14)}${label(164,191,'偏振片',14)}${label(327,191,'样品管',14)}${label(168,265,'A：明显旋转',22)}${label(452,265,'B：约 0°',22)}${label(310,315,'仪器读到的是总效果',15)}`;
  } else if (kind === 'zero') {
    alt = '中央近零读数，周围是等待调查的问号，不显示分离结果。';
    drawing = `${dial(310,145,'B · 约 0°',0)}${label(130,123,'为什么？',22)}${label(490,199,'还缺什么证据？',18)}${line(182,130,250,141,true)}${line(369,148,437,175,true)}${label(310,295,'先记下一个起点，不急着判对错',18)}`;
  } else if (kind === 'controls') {
    alt = '空白近零、已知旋光对照正常、B仍近零；浓度和光程等保持可比。';
    drawing = `${vial(110,74,'空白','≈ 0')}${vial(310,74,'已知旋光对照','正常')}${vial(510,74,'B 重测','≈ 0')}${label(310,284,'同浓度 · 同光程 · 同温度 · 同波长 · 同溶剂',17)}${label(310,316,'读数可靠，并不自动选定解释',15)}`;
  } else if (kind === 'crystals') {
    alt = '两枚晶体整体相似，描粗的小晶面分别位于镜像两侧；尚未测量两组溶液。';
    drawing = `${crystals(145,60,'left')}${crystals(390,60,'right')}${line(310,54,310,236,true)}${label(189,216,'看小晶面的方向',18)}${label(432,216,'另一侧也有一枚',18)}${label(310,288,'同样朝向摆放，再放大比较',17)}`;
  } else if (['sealed-separate','separate'].includes(kind)) {
    const open = kind === 'separate';
    alt = open ? '分别溶解的两份样品，测得加α与减α，符号为教学示意。' : '两组晶体分别溶解，记录均封存，读数未揭示。';
    drawing = `${crystals(80,39,'left')}${crystals(405,39,'right')}${vial(150,130,'一组溶液',open?'+α':'?')}${vial(470,130,'另一组溶液',open?'−α':'?')}${label(310,40,open?'分离记录已打开':'测量记录 · 尚未打开',19)}${label(310,323,open?'α 为示意符号，不是历史角度数据':'在看到记录前，先留下预测',15)}`;
  } else if (['sealed-remix','remix'].includes(kind)) {
    const open = kind === 'remix';
    alt = open ? '两份相反旋光样品等量重新混合，总读数约零。' : '已知相反作用的样品重新混合，最终读数封存。';
    const output = open ? dial(501,139,'约 0°',0) : `<rect x="451" y="88" width="100" height="105" rx="8" fill="#e6e5d5" stroke="#244d43"/>${label(501,150,'?',38)}${label(501,217,'记录封存',17)}`;
    drawing = `${vial(90,69,'一份','+α')}${vial(267,69,'另一份','−α')}${arrow(337,139,414,139)}${output}${label(310,278,'取相当物质的量 · 浓度匹配 · 条件相同',17)}${label(310,316,open?'先预测，再重建出原现象':'模型要先交出预测',15)}`;
  } else if (kind === 'dissolve') {
    alt = '完整晶体溶解成为分散的组成单位，但溶液的旋光差异仍存在。';
    drawing = `${crystals(50,90,'left')}${arrow(175,157,259,157)}<rect x="290" y="68" width="235" height="170" rx="20" fill="#fffdf5" stroke="#244d43" stroke-width="2"/>${[0,1,2,3,4,5].map((i)=>`<circle cx="${330+i%3*74}" cy="${111+Math.floor(i/3)*81}" r="12" fill="#d5dfc8" stroke="#244d43"/><path d="M${324+i%3*74} ${106+Math.floor(i/3)*81}l13 8" stroke="#244d43"/>`).join('')}${label(109,264,'完整晶格',17)}${label(412,264,'溶液中的组成单位',17)}${label(310,313,'外形消失，旋光差异仍保留',19)}`;
  } else if (kind === 'molecules') {
    alt = '以四种不同符号表示四个不同基团的四面体与其镜像；实楔朝前、虚楔朝后，是空间概念图。';
    drawing = `${tetra(170)}${tetra(450,true)}${line(310,45,310,256,true)}${label(310,31,'镜面',14)}${label(170,267,'一种空间排列',17)}${label(450,267,'它的镜像',17)}${label(310,317,'楔形表示前后深度；符号不是分子的真实外形',14)}`;
  } else if (kind === 'biology') {
    alt = '微生物作用使两种形式消耗不等，剩余物呈负方向旋光。示意不表示测量比例。';
    drawing = `${vial(110,80,'相关混合物','≈ 0')}${arrow(174,146,253,146)}<ellipse cx="310" cy="137" rx="35" ry="57" transform="rotate(25 310 137)" fill="#d9e1ce" stroke="#244d43" stroke-width="2"/>${label(310,232,'生物过程',17)}${arrow(370,146,436,146)}${vial(505,80,'剩余液','负向')}${label(310,293,'两个镜像形式，没有被同样快地消耗',18)}`;
  } else if (kind === 'pocket') {
    alt = '同一个具有三维结构的口袋与镜像形状的接触点可能不同；一图三点匹配，另一图第三点错开，是类比而非真实酶结构。';
    drawing = [155,465].map((x,i)=>`<path d="M${x-103} 65H${x+103}V243H${x-103}Z M${x-55} 99V196H${x+57}V137H${x+23}V99Z" fill="#dbe3ce" fill-rule="evenodd" stroke="#829678"/><path d="M${x-39} 110H${x+8}V151H${x+41}V182H${x-39}Z" fill="#c8a256" stroke="#244d43" stroke-width="2" ${i?'transform="translate('+2*x+' 0) scale(-1 1)"':''}/>${label(x,282,i?'第三处接触可能错开':'三处接触可能匹配',17)}`).join('')+label(310,321,'前后深度被压缩为平面示意，不能当作真实结构图',14);
  } else if (kind === 'notebook') {
    alt = '调查笔记由起点、证据、判断三部分组成。';
    drawing = `<rect x="141" y="36" width="338" height="263" rx="8" fill="#fffdf5" stroke="#9ca68b"/>${[91,162,233].map((y,i)=>`${label(194,y,String(i+1).padStart(2,'0'),26,colors.gold)}${label(337,y,['当时怎样想','后来看到什么','为什么改变'][i],20)}${line(231,y+22,438,y+22,true)}`).join('')}`;
  } else {
    alt = '证据链：竞争模型、分离测量、重组验证、保留边界。';
    drawing = ['提出模型','分离测量','重组验证','保留边界'].map((text,i)=>`<rect x="${26+i*152}" y="117" width="111" height="77" rx="8" fill="#e0e7d6" stroke="#728176"/>${label(82+i*152,162,text,17)}${i<3?arrow(139+i*152,155,171+i*152,155):''}`).join('')+label(310,265,'把猜测变成经受过检验的解释',20);
  }
  return `<svg viewBox="0 0 620 350" role="img" aria-label="${alt}" xmlns="http://www.w3.org/2000/svg" style="font-family:system-ui,sans-serif"><rect width="620" height="350" rx="12" fill="#f1efdf"/><path d="M20 20H600M20 330H600" stroke="#dcdcc9"/>${drawing}</svg>`;
}
