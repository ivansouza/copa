const CACHE = 'copa2026-v9';
const ASSETS = [
  '/copa/',
  '/copa/index.html',
  '/copa/quiz.html',
  '/copa/manifest.json',
  '/copa/icon-192.png',
  '/copa/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // API externa (ESPN): sempre busca da rede (não cachear)
  if (e.request.url.includes('espn.com')) {
    e.respondWith(fetch(e.request).catch(() => new Response(
      JSON.stringify({ error: 'offline' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    )));
    return;
  }

  // Caminho da Copa, indexbkp: sempre da rede (evita cache problemático)
  if (e.request.url.includes('indexbkp')) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Assets estáticos: cache first
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetched = fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(cache => cache.put(e.request, clone));
        return res;
      }).catch(() => cached);
      return cached || fetched;
    })
  );
});
