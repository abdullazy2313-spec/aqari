/* عقاري SW v20 — Pre-cache everything */
const V = 'v20';
const PRECACHE = 'aqari-pre-' + V;
const RUNTIME  = 'aqari-run-' + V;

/* ملفات تُخزَّن فوراً عند التثبيت */
const PRECACHE_URLS = [
  '/aqari/',
  '/aqari/index.html',
  '/aqari/login.html',
  '/aqari/add-property.html',
  '/aqari/details.html',
  '/aqari/favorites.html',
  '/aqari/messages.html',
  '/aqari/chat.html',
  '/aqari/notifications.html',
  '/aqari/profile.html',
  '/aqari/settings.html',
  '/aqari/filter.html',
  '/aqari/map.html',
  '/aqari/css/style.css',
  '/aqari/js/app.js',
  '/aqari/manifest.json',
  '/aqari/icons/icon-192.png',
  '/aqari/icons/icon-512.png',
  /* Font Awesome — أهم شيء */
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-solid-900.woff2',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-regular-400.woff2',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-brands-400.woff2',
  /* Leaflet */
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
];

/* التثبيت: خزّن كل شيء */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(PRECACHE).then(cache => {
      /* خزّن ما أمكن — لا تفشل إذا فشل ملف واحد */
      return Promise.allSettled(
        PRECACHE_URLS.map(url =>
          cache.add(url).catch(e => console.warn('[SW] skip:', url))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

/* التفعيل: احذف الكاش القديم */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== PRECACHE && k !== RUNTIME)
            .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

/* الطلبات: Cache First للكل ما عدا Firebase */
self.addEventListener('fetch', event => {
  const url = event.request.url;
  if (event.request.method !== 'GET') return;

  /* Firebase — لا تتدخل أبداً */
  if (url.includes('googleapis.com') ||
      url.includes('firebaseio.com') ||
      url.includes('firestore.googleapis.com') ||
      url.includes('identitytoolkit.googleapis.com') ||
      url.includes('securetoken.googleapis.com')) return;

  /* صور OpenStreetMap — Network Only (لا يمكن تخزينها) */
  if (url.includes('tile.openstreetmap.org') ||
      url.includes('arcgisonline.com')) {
    event.respondWith(fetch(event.request).catch(() => new Response('', {status: 503})));
    return;
  }

  /* كل شيء آخر: Cache First → Network fallback */
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        /* خزّن في runtime cache */
        const clone = response.clone();
        caches.open(RUNTIME).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => {
        /* بدون إنترنت: أرجع HTML الرئيسية */
        if (event.request.headers.get('accept')?.includes('text/html')) {
          return caches.match('/aqari/index.html');
        }
      });
    })
  );
});
