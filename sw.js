/* ═══════════════════════════════════════════
   عقاري — Service Worker v10
   Network First للـ HTML = تحديثات فورية
═══════════════════════════════════════════ */
const VER   = 'v10';
const CACHE = 'aqari-' + VER;

self.addEventListener('install', e => self.skipWaiting());

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  var url = e.request.url;
  if (e.request.method !== 'GET') return;
  if (url.includes('googleapis.com') || url.includes('firebaseio') ||
      url.includes('gstatic.com/firebasejs')) return;
  
  /* HTML: شبكة دائماً */
  if (url.includes('.html') || e.request.headers.get('accept')?.includes('text/html')) {
    e.respondWith(
      fetch(e.request, {cache:'no-cache'}).catch(() => caches.match(e.request))
    );
    return;
  }
  
  /* JS/CSS: شبكة أولاً + كاش */
  if (url.includes('.js') || url.includes('.css')) {
    e.respondWith(
      fetch(e.request).then(r => {
        if (r.ok) { var c = r.clone(); caches.open(CACHE).then(ca => ca.put(e.request, c)); }
        return r;
      }).catch(() => caches.match(e.request))
    );
    return;
  }
  
  /* صور/أيقونات: كاش أولاً */
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(r => {
        if (r.ok) { var c = r.clone(); caches.open(CACHE).then(ca => ca.put(e.request, c)); }
        return r;
      }).catch(() => new Response('', {status: 503}));
    })
  );
});

self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
