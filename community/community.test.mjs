import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
process.env.NODE_ENV = 'test';
process.env.SOCRATES_TEST_REPOSITORY = 'student-fixture/science-story';
const { REPOSITORY, QUESTION_COUNTS, CHAPTER_NAMES, scoreMarks, parsePacket, buildScoreDraftUrl, buildCommentDraftUrl, parseIssueSubmission, buildCommunitySnapshot, emptyCommunitySnapshot, validateCommunitySnapshot, sameCommunityData } = await import('./community.mjs');

const now = '2026-09-09T12:00:00.000Z';
const runId = '00000000-0000-4000-8000-000000000001';
const packet = (chapter = 'research', marks = 'f'.repeat(QUESTION_COUNTS[chapter])) => ({ version: 1, chapter, runId, completedAt: now, marks });
const issue = (number, body, overrides = {}) => ({ number, state: 'open', user: { id: number, login: `player-${number}`, type: 'User' }, created_at: new Date(Date.parse(now) + number * 1000).toISOString(), body, ...overrides });
const scoreIssue = (number, marks = 'f'.repeat(16), overrides = {}, fields = {}) => issue(number, buildScoreDraftUrl(packet('research', marks), fields).body, overrides);

void test('all eleven chapters publish to independent boards through the exact draft parser', () => {
  const ids = ['research','mrna','tsunami','cholera','hans','forgery','pulsar','aircraft','argon','nucleus','chirality'];
  assert.deepEqual(Object.keys(QUESTION_COUNTS), ids);
  const issues = ids.map((id, index) => {
    const draft = buildScoreDraftUrl(packet(id), { nickname: '本地测试', comment: id + ' 的测试评论' });
    assert.ok(draft.body.includes(CHAPTER_NAMES[id]));
    assert.equal(parseIssueSubmission(draft.body).packet.chapter, id);
    return issue(index + 1, draft.body, { user: { id: 77, login: 'fixture-scout', type: 'User' } });
  });
  const snapshot = buildCommunitySnapshot(issues, now);
  assert.deepEqual(validateCommunitySnapshot(snapshot), snapshot);
  for (const id of ids) {
    assert.equal(snapshot.chapters[id].totalPlayers, 1);
    assert.equal(snapshot.chapters[id].entries[0].totalQuestions, QUESTION_COUNTS[id]);
    assert.equal(snapshot.chapters[id].entries[0].score, 100);
    assert.equal(snapshot.chapters[id].comments[0].body, id + ' 的测试评论');
    assert.equal(scoreMarks(id, 'f'.repeat(QUESTION_COUNTS[id] - 1)), null);
  }
  const withdrawn = buildCommunitySnapshot(issues.map(row => row.number === 3 ? {...row,state:'closed'} : row), now);
  assert.equal(withdrawn.chapters.tsunami.totalPlayers, 0);
  for (const id of ids.filter(id => id !== 'tsunami')) assert.deepEqual(withdrawn.chapters[id], snapshot.chapters[id]);
});

void test('cached two-chapter snapshots retain real records and normalize nine empty boards', () => {
  const original = buildCommunitySnapshot([scoreIssue(1)], now);
  const legacy = { ...original, chapters: {research: original.chapters.research, mrna: original.chapters.mrna} };
  assert.deepEqual(validateCommunitySnapshot(legacy), original);
  assert.equal(Object.keys(legacy.chapters).length, 2, 'validation does not mutate received JSON');
  assert.equal(validateCommunitySnapshot({...legacy,chapters:{...legacy.chapters,unknown:{}}}), null);
});

test('both chapters recompute 100 / 60 / 30 per question, including rounding', () => {
  assert.equal(scoreMarks('research', 'f'.repeat(16)).score, 100);
  assert.equal(scoreMarks('mrna', 'r'.repeat(20)).score, 60);
  assert.equal(scoreMarks('research', 'h'.repeat(16)).score, 30);
  assert.deepEqual(scoreMarks('research', 'f'.repeat(14) + 'rh'), { score: 93, firstCorrectCount: 14, correctedCount: 1, hintedCount: 1, totalQuestions: 16 });
});

test('unknown chapters, missing questions and invented outcomes never become scores', () => {
  for (const [chapter, marks] of [['unknown', 'f'.repeat(16)], ['research', 'f'.repeat(15)], ['research', 'f'.repeat(20)], ['mrna', 'f'.repeat(19) + 'x'], ['research', null]]) assert.equal(scoreMarks(chapter, marks), null);
});

test('packet strictly rejects claimed score, unknown versions, invalid dates and identifiers', () => {
  assert.deepEqual(parsePacket(JSON.stringify(packet())), packet());
  for (const candidate of [{ ...packet(), score: 100 }, { ...packet(), version: 2 }, { ...packet(), completedAt: 'not a date' }, { ...packet(), runId: '../../../main' }, { ...packet(), marks: 'legacy' }, null, [], '{broken']) assert.equal(parsePacket(candidate), null);
});

test('reference packets and drafts preserve their explicit source without changing scoring', () => {
  const reference = { ...packet('mrna', 'f'.repeat(8) + 'r'.repeat(12)), recordType: 'reference' };
  assert.deepEqual(parsePacket(JSON.stringify(reference)), reference);
  const draft = buildScoreDraftUrl(reference, { nickname: '继续调查' });
  assert.match(draft.body, /旧存档参考成绩为 \*\*76 \/ 100\*\*/);
  assert.match(draft.body, /榜单会标记为参考成绩/);
  assert.deepEqual(parseIssueSubmission(draft.body).packet, reference);
  const snapshot = buildCommunitySnapshot([issue(1, draft.body)], now);
  const entry = snapshot.chapters.mrna.entries[0];
  assert.equal(entry.recordType, 'reference');
  assert.equal(entry.score, 76);
  assert.equal(entry.firstCorrectCount, 8);
  assert.equal(entry.correctedCount, 12);
  assert.deepEqual(validateCommunitySnapshot(snapshot), snapshot);
});

test('optional record type accepts only reference and does not admit unknown packet fields', () => {
  for (const recordType of ['full', 'legacy', '', null, false, 1, {}, undefined]) assert.equal(parsePacket({ ...packet(), recordType }), null);
  assert.equal(parsePacket({ ...packet(), recordType: 'reference', score: 100 }), null);
  assert.equal(parsePacket({ ...packet(), recordType: 'reference', source: 'trusted' }), null);
  const body = buildScoreDraftUrl({ ...packet(), recordType: 'reference' }).body;
  assert.equal(parseIssueSubmission(body.replace('"reference"', '"full"')), null);
});

test('GitHub drafts round-trip Chinese, quotes and HTML as data with no privileged query parameters', () => {
  const fields = { nickname: '石头侦探', comment: '试试“引号”与 <img src=x onerror=alert(1)>。\n下一行仍然是文字。', rating: 4 };
  const draft = buildScoreDraftUrl(packet(), fields);
  const url = new URL(draft.url);
  assert.equal(url.origin, 'https://github.com');
  assert.equal(url.pathname, `/${REPOSITORY}/issues/new`);
  assert.equal(url.searchParams.has('labels'), false);
  assert.equal(url.searchParams.get('body'), draft.body);
  assert.equal(draft.copyRequired, false);
  const record = parseIssueSubmission(draft.body);
  assert.equal(record.nickname, fields.nickname);
  assert.equal(record.comment, fields.comment);
  assert.equal(record.rating, 4);
  assert.deepEqual(record.packet, packet());
});

test('oversized encoded drafts keep full copyable text and use a short valid destination', () => {
  const draft = buildCommentDraftUrl({ chapter: 'mrna', nickname: '科学', comment: '🧪'.repeat(500), rating: 5 });
  assert.equal(draft.copyRequired, true);
  assert.ok(draft.url.length < 1000);
  assert.equal(new URL(draft.url).searchParams.has('body'), false);
  assert.equal(parseIssueSubmission(draft.body).comment, '🧪'.repeat(500));
});

test('comments need content or a rating; text limits count Unicode code points', () => {
  assert.throws(() => buildCommentDraftUrl({ chapter: 'research' }));
  assert.throws(() => buildCommentDraftUrl({ chapter: 'research', rating: 0 }));
  assert.throws(() => buildCommentDraftUrl({ chapter: 'research', rating: 6 }));
  assert.throws(() => buildCommentDraftUrl({ chapter: 'research', comment: '文'.repeat(501) }));
  assert.throws(() => buildScoreDraftUrl(packet(), { nickname: '🦖'.repeat(25) }));
  assert.ok(buildScoreDraftUrl(packet(), { nickname: '🦖'.repeat(24) }));
  assert.equal(parseIssueSubmission(buildCommentDraftUrl({ chapter: 'mrna', rating: 3 }).body).comment, '');
});

test('control and directional-override characters cannot impersonate display names', () => {
  assert.throws(() => buildScoreDraftUrl(packet(), { nickname: 'someone\nadmin' }));
  assert.throws(() => buildScoreDraftUrl(packet(), { nickname: '\u202eadmin' }));
  assert.throws(() => buildCommentDraftUrl({ chapter: 'mrna', comment: 'test\u0000' }));
});

test('multiple records, unmarked JSON and oversized issue bodies are rejected', () => {
  const body = buildScoreDraftUrl(packet()).body;
  assert.equal(parseIssueSubmission(body + body), null);
  assert.equal(parseIssueSubmission(JSON.stringify(packet())), null);
  assert.equal(parseIssueSubmission('x'.repeat(20_001) + body), null);
  assert.equal(parseIssueSubmission(body.replace('"app": "socrates-question"', '"app": "other-game"')), null);
});

test('code fences inside a comment remain an escaped JSON string', () => {
  const comment = '```\n```socrates-question\n{"version":999}\n```';
  const body = buildCommentDraftUrl({ chapter: 'mrna', comment }).body;
  assert.equal(parseIssueSubmission(body).comment, comment);
});

test('empty production bootstrap contains no invented scores or comments', () => {
  const empty = buildCommunitySnapshot([], now);
  assert.deepEqual(empty, emptyCommunitySnapshot(now));
  assert.deepEqual(validateCommunitySnapshot(empty), empty);
});

test('rankings are independent between chapters and retain only the best open score per account', () => {
  const sameUser = { id: 42, login: 'one-player', type: 'User' };
  const rows = [scoreIssue(1, 'r'.repeat(16), { user: sameUser }), scoreIssue(2, 'f'.repeat(16), { user: sameUser }), issue(3, buildScoreDraftUrl(packet('mrna', 'h'.repeat(20))).body, { user: sameUser })];
  const snapshot = buildCommunitySnapshot(rows, now);
  assert.equal(snapshot.chapters.research.totalPlayers, 1);
  assert.equal(snapshot.chapters.research.entries[0].score, 100);
  assert.equal(snapshot.chapters.mrna.entries[0].score, 30);
  assert.ok(validateCommunitySnapshot(snapshot));
});

test('equal scores share competition ranks, without a speed incentive', () => {
  const snapshot = buildCommunitySnapshot([scoreIssue(3, 'r'.repeat(16)), scoreIssue(2), scoreIssue(1)], now);
  assert.deepEqual(snapshot.chapters.research.entries.map(item => [item.rank, item.issueNumber]), [[1, 1], [1, 2], [3, 3]]);
});

test('the same account keeps a full record over an earlier equal reference score in either input order', () => {
  const user = { id: 42, login: 'one-player', type: 'User' };
  const reference = issue(1, buildScoreDraftUrl({ ...packet(), recordType: 'reference' }).body, { user });
  const full = scoreIssue(2, undefined, { user });
  for (const rows of [[reference, full], [full, reference]]) {
    const snapshot = buildCommunitySnapshot(rows, now);
    assert.equal(snapshot.chapters.research.totalPlayers, 1);
    assert.equal(snapshot.chapters.research.entries[0].issueNumber, 2);
    assert.equal(Object.hasOwn(snapshot.chapters.research.entries[0], 'recordType'), false);
  }
  const higherReference = buildCommunitySnapshot([reference, scoreIssue(2, 'r'.repeat(16), { user })], now);
  assert.equal(higherReference.chapters.research.entries[0].issueNumber, 1);
  assert.equal(higherReference.chapters.research.entries[0].recordType, 'reference');
});

test('full and reference records share competition ranks while full records are listed first on a tie', () => {
  const reference = issue(1, buildScoreDraftUrl({ ...packet(), recordType: 'reference' }).body);
  const rows = [reference, scoreIssue(2), scoreIssue(3, 'r'.repeat(16))];
  const snapshot = buildCommunitySnapshot(rows, now);
  assert.deepEqual(snapshot.chapters.research.entries.map(entry => [entry.rank, entry.issueNumber]), [[1, 2], [1, 1], [3, 3]]);
  assert.deepEqual(buildCommunitySnapshot(rows.toReversed(), now), snapshot);
  assert.deepEqual(validateCommunitySnapshot(snapshot), snapshot);
});

test('closing, removing or hiding an issue withdraws both its score and comment', () => {
  const rows = [scoreIssue(1, 'f'.repeat(16), {}, { comment: '留下思考', rating: 5 })];
  assert.equal(buildCommunitySnapshot(rows, now).chapters.research.comments.length, 1);
  assert.equal(buildCommunitySnapshot([{ ...rows[0], state: 'closed' }], now).chapters.research.entries.length, 0);
  assert.equal(buildCommunitySnapshot([], now).chapters.research.comments.length, 0);
  assert.equal(buildCommunitySnapshot([{ ...rows[0], labels: [{ name: 'community-hidden' }] }], now).chapters.research.comments.length, 0);
});

test('withdrawing a best result restores the account’s earlier still-open result', () => {
  const sameUser = { id: 42, login: 'one-player', type: 'User' };
  const rows = [scoreIssue(1, 'r'.repeat(16), { user: sameUser }), scoreIssue(2, 'f'.repeat(16), { user: sameUser, state: 'closed' })];
  assert.equal(buildCommunitySnapshot(rows, now).chapters.research.entries[0].score, 60);
});

test('comments display only each account’s latest open contribution in that chapter', () => {
  const sameUser = { id: 42, login: 'one-player', type: 'User' };
  const rows = [issue(1, buildCommentDraftUrl({ chapter: 'mrna', comment: '第一条' }).body, { user: sameUser }), issue(2, buildCommentDraftUrl({ chapter: 'mrna', comment: '第二条', rating: 4 }).body, { user: sameUser })];
  const comments = buildCommunitySnapshot(rows, now).chapters.mrna.comments;
  assert.equal(comments.length, 1);
  assert.equal(comments[0].body, '第二条');
  assert.equal(comments[0].rating, 4);
});

test('pull requests, bots and forged author metadata cannot enter community output', () => {
  const rows = [scoreIssue(1, undefined, { pull_request: {} }), scoreIssue(2, undefined, { user: { id: 2, login: 'test-bot', type: 'Bot' } }), scoreIssue(3, undefined, { user: { id: 3, login: 'https://bad.example', type: 'User' } }), scoreIssue(4, undefined, { user: { id: -1, login: 'player', type: 'User' } })];
  assert.equal(buildCommunitySnapshot(rows, now).chapters.research.totalPlayers, 0);
});

test('issue URLs come from verified issue numbers, never from an untrusted URL field', () => {
  const snapshot = buildCommunitySnapshot([scoreIssue(1, undefined, { html_url: 'javascript:alert(1)' })], now);
  assert.equal(snapshot.chapters.research.entries[0].issueUrl, `https://github.com/${REPOSITORY}/issues/1`);
});

test('fallback names stay bounded while keeping the full GitHub login in its own field', () => {
  const login = 'a'.repeat(39);
  const snapshot = buildCommunitySnapshot([scoreIssue(1, undefined, { user: { id: 1, login, type: 'User' } })], now);
  assert.equal(snapshot.chapters.research.entries[0].nickname.length, 24);
  assert.equal(snapshot.chapters.research.entries[0].login, login);
  assert.ok(validateCommunitySnapshot(snapshot));
});

test('top 100 and latest 30 limits preserve the full distinct-player count', () => {
  const rows = Array.from({ length: 110 }, (_, index) => scoreIssue(index + 1, undefined, {}, { comment: `发现 ${index + 1}` }));
  const snapshot = buildCommunitySnapshot(rows, now);
  assert.equal(snapshot.chapters.research.totalPlayers, 110);
  assert.equal(snapshot.chapters.research.entries.length, 100);
  assert.equal(snapshot.chapters.research.comments.length, 30);
  assert.ok(validateCommunitySnapshot(snapshot));
});

test('remote snapshots reject altered scores, rank order, links, identities and unknown keys', () => {
  const snapshot = buildCommunitySnapshot([scoreIssue(1), scoreIssue(2, 'r'.repeat(16))], now);
  for (const mutate of [copy => { copy.chapters.research.entries[0].score = 999; }, copy => { copy.chapters.research.entries[1].rank = 1; }, copy => { copy.chapters.research.entries[0].issueUrl = 'javascript:alert(1)'; }, copy => { copy.chapters.research.entries[1].login = 'player-1'; }, copy => { copy.secret = 'unexpected'; }, copy => { copy.chapters.research.totalPlayers = 0; }]) {
    const copy = structuredClone(snapshot); mutate(copy); assert.equal(validateCommunitySnapshot(copy), null);
  }
});

test('existing snapshots without record type remain unchanged and reference snapshots stay strictly validated', () => {
  const old = buildCommunitySnapshot([scoreIssue(1)], now);
  assert.equal(Object.hasOwn(old.chapters.research.entries[0], 'recordType'), false);
  assert.deepEqual(validateCommunitySnapshot(JSON.parse(JSON.stringify(old))), old);
  const reference = structuredClone(old);
  reference.chapters.research.entries[0].recordType = 'reference';
  assert.deepEqual(validateCommunitySnapshot(reference), reference);
  for (const recordType of ['full', 'legacy', '', null, false, 1, {}, undefined]) {
    const candidate = structuredClone(old);
    candidate.chapters.research.entries[0].recordType = recordType;
    assert.equal(validateCommunitySnapshot(candidate), null);
  }
  for (const fields of [{ score: 999 }, { source: 'trusted' }]) {
    const candidate = structuredClone(reference);
    Object.assign(candidate.chapters.research.entries[0], fields);
    assert.equal(validateCommunitySnapshot(candidate), null);
  }
  assert.equal(sameCommunityData(old, reference), false);
});

test('input ordering does not change ranking or comment selection', () => {
  const rows = [scoreIssue(1), scoreIssue(2), scoreIssue(3, 'r'.repeat(16), {}, { comment: '继续追问' })];
  assert.deepEqual(buildCommunitySnapshot(rows, now), buildCommunitySnapshot(rows.toReversed(), now));
});

test('unchanged records never require a bot commit, regardless of JSON key order or rebuild time', () => {
  const rows = [scoreIssue(1, undefined, {}, { comment: '同一条记录' })];
  const existing = validateCommunitySnapshot(buildCommunitySnapshot(rows, now));
  const fresh = buildCommunitySnapshot(rows, '2026-09-10T12:00:00.000Z');
  assert.equal(sameCommunityData(existing, fresh), true);
  assert.equal(sameCommunityData(existing, buildCommunitySnapshot([], now)), false);
  assert.equal(sameCommunityData(null, fresh), false);
  assert.equal(existing.updatedAt, now);
});

test('workflow uses pinned official actions, trusted main code and only required token permissions', async () => {
  const workflow = await readFile(fileURLToPath(new URL('../.github/workflows/community.yml', import.meta.url)), 'utf8').catch(error => {
    if (error.code !== 'ENOENT') throw error;
    return readFile(new URL('./workflows/community.yml', import.meta.url), 'utf8');
  });
  assert.match(workflow, /contents: write\s+issues: read/);
  assert.match(workflow, /ref: main/);
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.equal([...workflow.matchAll(/uses: actions\/[\w-]+@([0-9a-f]{40})/g)].length, 2);
  assert.doesNotMatch(workflow, /\$\{\{[^}]*github\.event\.(?:issue|comment)/);
  assert.doesNotMatch(workflow, /pull_request_target|secrets\.|pages: write|issues: write/);
});


test('unconfigured production and teacher repositories cannot create public submissions', async () => {
  const { spawnSync } = await import('node:child_process');
  const env = { ...process.env, NODE_ENV: 'production', SOCRATES_TEST_REPOSITORY: 'ignored/fixture' };
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', "import assert from 'node:assert/strict'; import {CONFIG} from './community/config.mjs'; import {buildCommentDraftUrl} from './community/community.mjs'; assert.notEqual(CONFIG.repository,'ignored/fixture'); assert.throws(()=>CONFIG.forRepository('').assertConfigured(),/尚未配置/); if(CONFIG.repository) assert.equal(new URL(buildCommentDraftUrl({chapter:'chirality',comment:'hello'}).url).pathname,'/'+CONFIG.repository+'/issues/new'); else assert.throws(()=>buildCommentDraftUrl({chapter:'chirality',comment:'hello'}),/尚未配置/); assert.throws(()=>CONFIG.forRepository('yaoyuzhang1/socrates-question'),/原作/); assert.throws(()=>CONFIG.forRepository('YAOYUZHANG1/SOCRATES-QUESTION'),/原作/);"], { env, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});

test('chirality mixed marks round to 63 and generate only the configured student destination', () => {
  const marks = 'ffrrhh';
  assert.deepEqual(scoreMarks('chirality',marks), {score:63,firstCorrectCount:2,correctedCount:2,hintedCount:2,totalQuestions:6});
  const draft = buildScoreDraftUrl(packet('chirality',marks),{comment:'<img src=x onerror=alert(1)>',rating:4});
  assert.equal(new URL(draft.url).pathname, '/' + REPOSITORY + '/issues/new');
  const parsed = parseIssueSubmission(draft.body);
  assert.equal(parsed.packet.marks,marks);
  const snapshot = buildCommunitySnapshot([issue(301,draft.body)],now);
  assert.equal(snapshot.chapters.chirality.entries[0].score,63);
  assert.equal(snapshot.chapters.chirality.comments[0].body,'<img src=x onerror=alert(1)>');
  assert.ok(validateCommunitySnapshot(snapshot));
});

test('production snapshot accepts initial empty data and later real configured records',async()=>{
  const {spawnSync}=await import('node:child_process');
  const check=spawnSync(process.execPath,['--input-type=module','-e', `
    import assert from 'node:assert/strict';
    import {readFileSync} from 'node:fs';
    import {CONFIG} from './community/config.mjs';
    import {validateCommunitySnapshot} from './community/community.mjs';
    const snapshot=JSON.parse(readFileSync('community.json','utf8'));
    assert.equal(Object.keys(snapshot.chapters).length,11);
    if(snapshot.repository==='') {
      for(const board of Object.values(snapshot.chapters)) assert.deepEqual(board,{entries:[],totalPlayers:0,comments:[]});
    } else {
      assert.equal(snapshot.repository,CONFIG.repository);
      assert.ok(validateCommunitySnapshot(snapshot));
    }
  `],{env:{...process.env,NODE_ENV:'production'},encoding:'utf8'});
  assert.equal(check.status,0,check.stderr);
});

async function isolatedProject(repository) {
  const {mkdtemp,mkdir,copyFile,writeFile,rm}=await import('node:fs/promises');
  const {tmpdir}=await import('node:os');
  const {join}=await import('node:path');
  const root=await mkdtemp(join(tmpdir(),'socrates-test-'));
  await mkdir(join(root,'community'));
  for(const name of ['sync.mjs','community.mjs','config.mjs']) await copyFile(new URL(name,import.meta.url),join(root,'community',name));
  const config=(await readFile(new URL('../site-config.js',import.meta.url),'utf8')).replace(/const settings = \{[^;]+;/, 'const settings = '+JSON.stringify({repository,branch:'main'})+';');
  await writeFile(join(root,'site-config.js'),config);
  return {root,cleanup:()=>{assert.ok(root.startsWith(join(tmpdir(),'socrates-test-')));return rm(root,{recursive:true,force:true});}};
}

test('sync refuses missing configuration or a mismatched publish repository before networking',async()=>{
  const {spawnSync}=await import('node:child_process');
  const isolated=await isolatedProject('');
  try {
    const unconfigured=spawnSync(process.execPath,['community/sync.mjs'],{cwd:isolated.root,env:{...process.env,NODE_ENV:'production'},encoding:'utf8'});
    assert.notEqual(unconfigured.status,0);
    assert.match(unconfigured.stderr,/尚未配置/);
  } finally {await isolated.cleanup();}
  const mismatch=spawnSync(process.execPath,['community/sync.mjs','--publish'],{env:{...process.env,NODE_ENV:'test',SOCRATES_TEST_REPOSITORY:'student-fixture/science-story',GITHUB_REPOSITORY:'someone-else/project',GITHUB_TOKEN:'non-secret-test-fixture'},encoding:'utf8'});
  assert.notEqual(mismatch.status,0);
  assert.match(mismatch.stderr,/expected repository/);
});


test('a configured deployment can validate a populated snapshot without empty-board assumptions',async()=>{
  const {spawnSync}=await import('node:child_process');
  const isolated=await isolatedProject('deployment-fixture/chirality');
  try {
    const check=spawnSync(process.execPath,['--input-type=module','-e', `
      import assert from 'node:assert/strict';
      import {buildScoreDraftUrl,buildCommunitySnapshot,validateCommunitySnapshot} from './community/community.mjs';
      const draft=buildScoreDraftUrl({version:1,chapter:'chirality',runId:'00000000-0000-4000-8000-000000000001',completedAt:'2026-09-16T12:00:00.000Z',marks:'ffrrhh'},{comment:'Test fixture only'});
      const snapshot=buildCommunitySnapshot([{number:1,state:'open',user:{id:1,login:'fixture-user',type:'User'},created_at:'2026-09-16T12:00:00.000Z',body:draft.body}],'2026-09-16T12:00:00.000Z');
      assert.equal(snapshot.chapters.chirality.totalPlayers,1);
      assert.equal(snapshot.chapters.chirality.entries[0].score,63);
      assert.ok(validateCommunitySnapshot(snapshot));
    `],{cwd:isolated.root,env:{...process.env,NODE_ENV:'production'},encoding:'utf8'});
    assert.equal(check.status,0,check.stderr);
  } finally {await isolated.cleanup();}
});
