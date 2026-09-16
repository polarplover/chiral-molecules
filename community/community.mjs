// Shared by the browser and the GitHub Actions snapshot builder. No credentials belong here.
import { CONFIG } from './config.mjs';
export const REPOSITORY = CONFIG.repository;
export const SNAPSHOT_URL = CONFIG.snapshotUrl;
export const QUESTION_COUNTS = Object.freeze({ research:16, mrna:20, tsunami:12, cholera:12, hans:12, forgery:12, pulsar:12, aircraft:12, argon:12, nucleus:12, chirality:6 });
export const CHAPTER_NAMES = Object.freeze({ research:'恐龙灭绝', mrna:'Karikó与mRNA', tsunami:'没有震感的海啸', cholera:'宽街幸存者的秘密', hans:'全城最会算数的马', forgery:'我必须证明这幅名画是假的', pulsar:'来自星空的心跳', aircraft:'没有弹孔的地方', argon:'空气里多出来的一点重量', nucleus:'金箔背后的反击', chirality:'镜子里的两种分子：零度读数的秘密' });
const CHAPTERS = Object.keys(QUESTION_COUNTS);
const RECORD_FENCE = 'socrates-question';
const MAX_BODY = 20_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LOGIN = /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i;
const plainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exactKeys = (value, keys) => plainObject(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const isChapter = value => CHAPTERS.includes(value);
const dateString = value => typeof value === 'string' && value.length <= 30 && Number.isFinite(Date.parse(value)) && /^\d{4}-\d\d-\d\dT/.test(value);
const integer = value => Number.isSafeInteger(value) && value >= 0;
const compareText = (a, b) => a < b ? -1 : a > b ? 1 : 0;

function textField(value, maximum, allowEmpty = true) {
  if (typeof value !== 'string') return null;
  const normalized = value.normalize('NFC').trim();
  // oxlint-disable-next-line no-control-regex -- Reject control and bidi formatting characters in public submissions.
  if ((!allowEmpty && normalized.length === 0) || Array.from(normalized).length > maximum || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(normalized)) return null;
  return normalized;
}

/** Return recomputed statistics, or null when the chapter / marks are invalid. */
export function scoreMarks(chapter, marks) {
  if (!isChapter(chapter) || typeof marks !== 'string' || marks.length !== QUESTION_COUNTS[chapter] || !/^[frh]+$/.test(marks)) return null;
  const firstCorrectCount = marks.split('').filter(mark => mark === 'f').length;
  const correctedCount = marks.split('').filter(mark => mark === 'r').length;
  const hintedCount = marks.split('').filter(mark => mark === 'h').length;
  const totalQuestions = QUESTION_COUNTS[chapter];
  return { score: Math.round((100 * firstCorrectCount + 60 * correctedCount + 30 * hintedCount) / totalQuestions), firstCorrectCount, correctedCount, hintedCount, totalQuestions };
}

/** Strict versioned, compact self-reported record; it is not proof of honest play. */
export function parsePacket(input) {
  let value = input;
  if (typeof input === 'string') { try { value = JSON.parse(input); } catch { return null; } }
  const hasRecordType = plainObject(value) && Object.hasOwn(value, 'recordType');
  if (!exactKeys(value, ['version', 'chapter', 'runId', 'completedAt', 'marks', ...(hasRecordType ? ['recordType'] : [])]) || hasRecordType && value.recordType !== 'reference' || value.version !== 1 || !scoreMarks(value.chapter, value.marks) || typeof value.runId !== 'string' || !UUID.test(value.runId) || !dateString(value.completedAt)) return null;
  return { version: 1, chapter: value.chapter, runId: value.runId.toLowerCase(), completedAt: new Date(value.completedAt).toISOString(), marks: value.marks, ...(hasRecordType ? { recordType: 'reference' } : {}) };
}

function submission(input) {
  if (!plainObject(input) || !['score', 'comment'].includes(input.kind)) return null;
  const fields = ['app', 'version', 'kind', 'chapter', 'nickname', 'comment', 'rating', ...(input.kind === 'score' ? ['packet'] : [])];
  if (!exactKeys(input, fields) || input.app !== 'socrates-question' || input.version !== 1 || !isChapter(input.chapter)) return null;
  const nickname = textField(input.nickname, 24);
  const comment = textField(input.comment, 500);
  if (nickname === null || /[\r\n\t]/.test(nickname) || comment === null || !(input.rating === null || (Number.isInteger(input.rating) && input.rating >= 1 && input.rating <= 5))) return null;
  const common = { app: 'socrates-question', version: 1, kind: input.kind, chapter: input.chapter, nickname, comment, rating: input.rating };
  if (input.kind === 'comment') return comment || input.rating !== null ? common : null;
  const packet = parsePacket(input.packet);
  return packet?.chapter === input.chapter ? { ...common, packet } : null;
}

function bodyFor(record) {
  const stats = record.kind === 'score' ? scoreMarks(record.chapter, record.packet.marks) : null;
  const introduction = stats ? `我完成了《${CHAPTER_NAMES[record.chapter]}》，${record.packet.recordType === 'reference' ? '旧存档参考成绩' : '本次自报成绩'}为 **${stats.score} / 100**。${record.packet.recordType === 'reference' ? '此成绩依据旧版保存的作答结果还原，榜单会标记为参考成绩。' : ''}` : `我想对《${CHAPTER_NAMES[record.chapter]}》提交评论。`;
  return [introduction, '', '本帖公开发布后，GitHub账号、显示名、成绩及填写的评论会进入游戏社区。关闭本帖可从下次更新的榜单中撤回。成绩用于交流，不作为正式考核凭证。', '', '下面是游戏生成的提交记录；请保留记录格式。显示名、评论与星级也包含在记录中。', '', `\`\`\`${RECORD_FENCE}`, JSON.stringify(record, null, 2), '```', ''].join('\n');
}

function draft(record) {
  CONFIG.assertConfigured();
  const body = bodyFor(record);
  const url = new URL(`https://github.com/${REPOSITORY}/issues/new`);
  url.searchParams.set('template', record.kind === 'score' ? 'score.md' : 'comment.md');
  url.searchParams.set('title', `${record.kind === 'score' ? '成绩' : '评论'} · ${CHAPTER_NAMES[record.chapter]}`);
  url.searchParams.set('body', body);
  const copyRequired = url.href.length > 7000;
  if (copyRequired) url.searchParams.delete('body');
  return { url: url.href, body, copyRequired };
}

export function buildScoreDraftUrl(packetInput, { nickname = '', comment = '', rating = null } = {}) {
  const packet = parsePacket(packetInput);
  const record = packet && submission({ app: 'socrates-question', version: 1, kind: 'score', chapter: packet.chapter, nickname, comment, rating, packet });
  if (!record) throw new TypeError('成绩记录或填写内容不完整：显示名最多24字，评论最多500字，星级为1至5。');
  return draft(record);
}

export function buildCommentDraftUrl({ chapter, nickname = '', comment = '', rating = null }) {
  const record = submission({ app: 'socrates-question', version: 1, kind: 'comment', chapter, nickname, comment, rating });
  if (!record) throw new TypeError('请填写评论或星级；显示名最多24字，评论最多500字。');
  return draft(record);
}

/** Parse only one explicitly marked record; all issue text remains untrusted data. */
export function parseIssueSubmission(body) {
  if (typeof body !== 'string' || body.length > MAX_BODY) return null;
  const blocks = [...body.matchAll(/^```socrates-question\s*\r?\n([\s\S]*?)\r?\n```\s*$/gm)];
  if (blocks.length !== 1) return null;
  try { return submission(JSON.parse(blocks[0][1])); } catch { return null; }
}

export function emptyCommunitySnapshot(updatedAt = new Date().toISOString()) {
  return { version: 1, updatedAt, repository: REPOSITORY, source: 'github-issues', selfReported: true, chapters: Object.fromEntries(CHAPTERS.map(chapter => [chapter,{ entries: [], totalPlayers: 0, comments: [] }])) };
}

// Prefer the higher score, then a complete current record over a reference record.
// Dates only make selection deterministic; equal scores still share a rank.
const compareScores = (a, b) => b.score - a.score || Number(a.recordType === 'reference') - Number(b.recordType === 'reference') || compareText(a.submittedAt, b.submittedAt) || a.issueNumber - b.issueNumber;

/** Reduce current OPEN issues. Closing an issue removes both its score and comment. */
export function buildCommunitySnapshot(issues, updatedAt = new Date().toISOString()) {
  if (!Array.isArray(issues) || !dateString(updatedAt)) throw new TypeError('Invalid snapshot inputs.');
  const snapshot = emptyCommunitySnapshot(new Date(updatedAt).toISOString());
  const scores = Object.fromEntries(CHAPTERS.map(chapter => [chapter,new Map()]));
  const comments = Object.fromEntries(CHAPTERS.map(chapter => [chapter,new Map()]));
  for (const issue of issues) {
    if (!plainObject(issue) || issue.state !== 'open' || issue.pull_request || issue.user?.type !== 'User' || !Number.isSafeInteger(issue.user.id) || issue.user.id <= 0 || typeof issue.user.login !== 'string' || !LOGIN.test(issue.user.login) || !integer(issue.number) || issue.number === 0 || !dateString(issue.created_at)) continue;
    if (Array.isArray(issue.labels) && issue.labels.some(label => (typeof label === 'string' ? label : label?.name) === 'community-hidden')) continue;
    const record = parseIssueSubmission(issue.body);
    if (!record) continue;
    const author = { login: issue.user.login, nickname: record.nickname || issue.user.login.slice(0, 24), submittedAt: new Date(issue.created_at).toISOString(), issueNumber: issue.number, issueUrl: `https://github.com/${REPOSITORY}/issues/${issue.number}` };
    if (record.kind === 'score') {
      const entry = { ...author, ...scoreMarks(record.chapter, record.packet.marks), completedAt: record.packet.completedAt, ...(record.packet.recordType === 'reference' ? { recordType: 'reference' } : {}) };
      const previous = scores[record.chapter].get(issue.user.id);
      if (!previous || compareScores(entry, previous) < 0) scores[record.chapter].set(issue.user.id, entry);
    }
    if (record.comment || record.rating !== null) {
      const item = { ...author, body: record.comment, rating: record.rating };
      const previous = comments[record.chapter].get(issue.user.id);
      if (!previous || item.submittedAt > previous.submittedAt || (item.submittedAt === previous.submittedAt && item.issueNumber > previous.issueNumber)) comments[record.chapter].set(issue.user.id, item);
    }
  }
  for (const chapter of CHAPTERS) {
    const entries = [...scores[chapter].values()].sort(compareScores);
    let rank = 0;
    snapshot.chapters[chapter] = {
      totalPlayers: entries.length,
      entries: entries.slice(0, 100).map((entry, index) => { if (index === 0 || entry.score !== entries[index - 1].score) rank = index + 1; return { rank, ...entry }; }),
      comments: [...comments[chapter].values()].sort((a, b) => compareText(b.submittedAt, a.submittedAt) || b.issueNumber - a.issueNumber).slice(0, 30),
    };
  }
  return snapshot;
}

/** Return a canonical safe-to-render snapshot or null. Render all text as text, never HTML. */
export function validateCommunitySnapshot(value) {
  if (!exactKeys(value, ['version', 'updatedAt', 'repository', 'source', 'selfReported', 'chapters']) || value.version !== 1 || !dateString(value.updatedAt) || value.repository !== REPOSITORY || value.source !== 'github-issues' || value.selfReported !== true || !plainObject(value.chapters) || !Object.hasOwn(value.chapters,'research') || !Object.hasOwn(value.chapters,'mrna') || Object.keys(value.chapters).some(chapter => !isChapter(chapter))) return null;
  const result = emptyCommunitySnapshot(new Date(value.updatedAt).toISOString());
  for (const chapter of CHAPTERS) {
    // A cached two-chapter snapshot remains readable while the live workflow upgrades.
    const data = value.chapters[chapter] ?? { entries:[],totalPlayers:0,comments:[] };
    if (!exactKeys(data, ['entries', 'totalPlayers', 'comments']) || !Array.isArray(data.entries) || !integer(data.totalPlayers) || data.entries.length !== Math.min(100, data.totalPlayers) || !Array.isArray(data.comments) || data.comments.length > 30) return null;
    const entries = [], comments = [], players = new Set(), commenters = new Set();
    const author = item => {
      if (typeof item.login !== 'string' || !LOGIN.test(item.login) || textField(item.nickname, 24, false) !== item.nickname || /[\r\n\t]/.test(item.nickname) || !integer(item.issueNumber) || item.issueNumber === 0 || item.issueUrl !== `https://github.com/${REPOSITORY}/issues/${item.issueNumber}` || !dateString(item.submittedAt)) return null;
      return { login: item.login, nickname: item.nickname, submittedAt: new Date(item.submittedAt).toISOString(), issueNumber: item.issueNumber, issueUrl: item.issueUrl };
    };
    for (const item of data.entries) {
      const hasRecordType = plainObject(item) && Object.hasOwn(item, 'recordType');
      if (!exactKeys(item, ['rank', 'login', 'nickname', 'submittedAt', 'issueNumber', 'issueUrl', 'score', 'firstCorrectCount', 'correctedCount', 'hintedCount', 'totalQuestions', 'completedAt', ...(hasRecordType ? ['recordType'] : [])]) || hasRecordType && item.recordType !== 'reference') return null;
      const identity = author(item);
      if (!identity || players.has(item.login.toLowerCase()) || !integer(item.rank) || item.rank === 0 || !dateString(item.completedAt) || !integer(item.firstCorrectCount) || !integer(item.correctedCount) || !integer(item.hintedCount) || item.totalQuestions !== QUESTION_COUNTS[chapter] || item.firstCorrectCount + item.correctedCount + item.hintedCount !== item.totalQuestions) return null;
      const expected = Math.round((100 * item.firstCorrectCount + 60 * item.correctedCount + 30 * item.hintedCount) / item.totalQuestions);
      const previous = entries.at(-1);
      if (item.score !== expected || (previous && item.score > previous.score) || item.rank !== (previous?.score === item.score ? previous.rank : entries.length + 1)) return null;
      players.add(item.login.toLowerCase());
      entries.push({ rank: item.rank, ...identity, score: item.score, firstCorrectCount: item.firstCorrectCount, correctedCount: item.correctedCount, hintedCount: item.hintedCount, totalQuestions: item.totalQuestions, completedAt: new Date(item.completedAt).toISOString(), ...(hasRecordType ? { recordType: 'reference' } : {}) });
    }
    for (const item of data.comments) {
      if (!exactKeys(item, ['login', 'nickname', 'submittedAt', 'issueNumber', 'issueUrl', 'body', 'rating'])) return null;
      const identity = author(item);
      if (!identity || commenters.has(item.login.toLowerCase()) || textField(item.body, 500) !== item.body || !(item.rating === null || (Number.isInteger(item.rating) && item.rating >= 1 && item.rating <= 5)) || (!item.body && item.rating === null) || (comments.at(-1)?.submittedAt < item.submittedAt)) return null;
      commenters.add(item.login.toLowerCase());
      comments.push({ ...identity, body: item.body, rating: item.rating });
    }
    result.chapters[chapter] = { entries, totalPlayers: data.totalPlayers, comments };
  }
  return result;
}

/** Compare the canonical public records, excluding only the rebuild timestamp. */
export function sameCommunityData(left, right) {
  const a = validateCommunitySnapshot(left), b = validateCommunitySnapshot(right);
  if (!a || !b) return false;
  delete a.updatedAt;
  delete b.updatedAt;
  return JSON.stringify(a) === JSON.stringify(b);
}
