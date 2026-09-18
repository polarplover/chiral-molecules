import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const workerSource = await readFile(new URL('../chirality-sw.js', import.meta.url), 'utf8');
const workerUrl = 'https://fixture-student.github.io/socrates-question/chirality-sw.js';

 test('offline fallback uses the installed chapter cache when an older cache has the same URL', async () => {
  const listeners = new Map();
  const cachesByName = new Map();
  const key = request => new URL(typeof request === 'string' ? request : request.url, workerUrl).href;
  const response = body => ({
    ok: true,
    body,
    clone() { return response(body); },
  });
  const caches = {
    async open(name) {
      if (!cachesByName.has(name)) {
        const entries = new Map();
        cachesByName.set(name, {
          async addAll(files) {
            for (const file of files) await this.put(file, response('current-v3'));
          },
          async put(request, value) {
            entries.set(key(request), value.clone());
          },
          async match(request) {
            return entries.get(key(request))?.clone();
          },
        });
      }
      return cachesByName.get(name);
    },
    async match(request, options = {}) {
      const candidates = options.cacheName === undefined
        ? cachesByName.values()
        : [cachesByName.get(options.cacheName)].filter(Boolean);
      for (const cache of candidates) {
        const hit = await cache.match(request);
        if (hit !== undefined) return hit;
      }
      return undefined;
    },
  };
  const request = { method: 'GET', url: new URL('./chirality.html', workerUrl).href };
  const oldCache = await caches.open('socrates-chirality-v2');
  await oldCache.put(request, response('stale-v2'));

  let networkAttempts = 0;
  runInNewContext(workerSource, {
    URL,
    caches,
    self: {
      location: { href: workerUrl },
      addEventListener(name, callback) { listeners.set(name, callback); },
      clients: { async claim() {} },
    },
    async fetch() {
      networkAttempts++;
      throw new Error('offline');
    },
  }, { filename: 'chirality-sw.js' });

  const installation = [];
  listeners.get('install')({ waitUntil(promise) { installation.push(promise); } });
  assert.ok(installation.length > 0);
  await Promise.all(installation);
  assert.equal((await cachesByName.get('socrates-chirality-v3').match(request)).body, 'current-v3');
  assert.equal((await caches.match(request)).body, 'stale-v2', 'unscoped lookup searches caches in creation order');

  let pendingResponse;
  const background = [];
  listeners.get('fetch')({
    request,
    respondWith(promise) { pendingResponse = promise; },
    waitUntil(promise) { background.push(promise); },
  });
  assert.ok(pendingResponse, 'the chapter request must be intercepted');
  const fallback = await pendingResponse;
  await Promise.all(background);
  assert.equal(networkAttempts, 1);
  assert.equal(fallback?.body, 'current-v3', 'offline content must come from the current worker cache');
});
