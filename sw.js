/* عقاري SW v21 — يمسح كاش profile */
const V = 'v21';
const CACHE = 'aqari-' + V;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = e.request.url;
  if (url.includes('googleapis.com') || url.includes('firebaseio') || url.includes('gstatic.com/firebasejs')) return;
  if (url.includes('tile.openstreetmap.org')) {
    e.respondWith(fetch(e.request).catch(() => new Response('',{status:503})));
    return;
  }
  /* HTML و JS: شبكة دائماً */
  if (url.includes('.html') || url.includes('app.js') || url.includes('style.css')) {
    e.respondWith(fetch(e.request, {cache:'no-store'}).catch(() => caches.match(e.request)));
    return;
  }
  /* الباقي: كاش أولاً */
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => new Response('',{status:503}));
    })
  );
});