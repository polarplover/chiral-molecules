import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { spawnSync } from 'node:child_process';

const workerSource = await readFile(new URL('../chirality-sw.js', import.meta.url), 'utf8');
const workerUrl = 'https://fixture-student.github.io/socrates-question/chirality-sw.js';

function harness() {
  const listeners = new Map(), stored = new Map(), cacheNames = [], installs = [];
  let online = true, claimed = false;
  const key = request => new URL(typeof request === 'string' ? request : request.url, workerUrl).href;
  const response = body => ({ ok: true, body, clone() { return response(body); } });
  const cache = {
    async addAll(files) {
      installs.push(...files);
      for (const file of files) stored.set(key(file), response('precache:' + file));
    },
    async put(request, value) { stored.set(key(request), value); },
  };
  runInNewContext(workerSource, {
    URL,
    self: { location: { href: workerUrl }, addEventListener(name, callback) { listeners.set(name, callback); }, clients: { async claim() { claimed = true; } } },
    caches: { async open(name) { cacheNames.push(name); return cache; }, async match(request) { return stored.get(key(request)); } },
    async fetch(request) { if (!online) throw new Error('offline'); return response('network:' + key(request)); },
  }, { filename: 'chirality-sw.js' });
  async function dispatch(name, request) {
    const promises = [];
    let result, intercepted = false;
    listeners.get(name)({ request, waitUntil(promise) { promises.push(promise); }, respondWith(promise) { intercepted = true; result = promise; } });
    const value = await result;
    await Promise.all(promises);
    return { intercepted, value };
  }
  return { dispatch, installs, stored, cacheNames, offline() { online = false; }, get claimed() { return claimed; } };
}

test('offline install precaches existing relative files within a GitHub Pages project path', async () => {
  const h = harness();
  await h.dispatch('install');
  assert.ok(h.installs.length >= 9);
  assert.equal(new Set(h.installs).size, h.installs.length);
  for (const path of h.installs) {
    assert.match(path, /^\.\//);
    const url = new URL(path, workerUrl);
    assert.equal(url.origin, new URL(workerUrl).origin);
    assert.ok(url.pathname.startsWith('/socrates-question/'));
    await access(new URL('../' + path.slice(2), import.meta.url));
    assert.ok(h.stored.has(url.href));
  }
  assert.deepEqual([...new Set(h.cacheNames)], ['socrates-chirality-v2']);
});

test('activation claims clients and every precached chapter resource loads while offline', async () => {
  const h = harness();
  await h.dispatch('install');
  await h.dispatch('activate');
  assert.equal(h.claimed, true);
  h.offline();
  for (const path of h.installs) {
    const result = await h.dispatch('fetch', { method: 'GET', url: new URL(path, workerUrl).href });
    assert.equal(result.intercepted, true);
    assert.equal(result.value.body, 'precache:' + path);
  }
});

test('successful network responses update the chapter cache for the next offline visit', async () => {
  const h = harness();
  await h.dispatch('install');
  const request = { method: 'GET', url: new URL('./chirality.html', workerUrl).href };
  const online = await h.dispatch('fetch', request);
  assert.equal(online.value.body, 'network:' + request.url);
  h.offline();
  assert.equal((await h.dispatch('fetch', request)).value.body, online.value.body);
});

test('worker does not intercept original chapters, community data, remote requests or writes', async () => {
  const h = harness();
  const urls = ['./index.html', './comic-art/argon-01.webp', './community.json', './chirality.html?preview=1', 'https://raw.githubusercontent.com/fixture-student/science-game/main/community.json', 'https://github.com/fixture-student/science-game/issues/new', 'https://example.org/socrates-question/chirality.html'];
  for (const path of urls) assert.equal((await h.dispatch('fetch', { method: 'GET', url: new URL(path, workerUrl).href })).intercepted, false, path);
  assert.equal((await h.dispatch('fetch', { method: 'POST', url: new URL('./chirality.html', workerUrl).href })).intercepted, false);
});

test('patched original index inline modules pass the Node syntax checker', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const modules = [...html.matchAll(/<script\b[^>]*\btype=["']module["'][^>]*>([\s\S]*?)<\/script\s*>/gi)].map(match => match[1]).filter(source => source.trim());
  assert.ok(modules.length > 0, 'must inspect at least one real inline module');
  for (const [index, source] of modules.entries()) {
    const checked = spawnSync(process.execPath, ['--check', '--input-type=module'], { input: source, encoding: 'utf8', timeout: 30_000 });
    assert.equal(checked.error, undefined);
    assert.equal(checked.status, 0, `inline module ${index + 1}: ${checked.stderr}`);
  }
});
