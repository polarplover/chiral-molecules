// Offline support for the new chapter only. Original chapter requests are untouched.
const CACHE = 'socrates-chirality-v3';
const FILES = ['./styles/typography.css','./chirality.html','./site-config.js','./chapters/chirality/app.mjs','./chapters/chirality/data.mjs','./chapters/chirality/state.mjs','./chapters/chirality/visuals.mjs','./chapters/chirality/style.css','./community/community.mjs','./community/config.mjs','./pics/chirality-ai-01-laboratory.png','./pics/chirality-ai-02-microscope.png','./pics/chirality-ai-03-sealed-record.jpg','./pics/chirality-ai-04-recombination.jpg','./pics/chirality-ai-05-reflection.jpg'];
const URLS = new Set(FILES.map(path => new URL(path, self.location.href).href));
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES))));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || !URLS.has(event.request.url)) return;
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok) { const copy=response.clone(); event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy))); }
    return response;
  }).catch(()=>caches.match(event.request, { cacheName: CACHE })));
});
