/* ═══════════════════════════════════════════════════
   عقاري PWA — Service Worker v5.0
   ✅ مزامنة بين الأجهزة — Network First للبيانات
   ✅ Cache First للملفات الثابتة فقط
═══════════════════════════════════════════════════ */

const CACHE_VERSION = 'v5';
const STATIC_CACHE  = 'aqari-static-' + CACHE_VERSION;
const DYNAMIC_CACHE = 'aqari-dynamic-' + CACHE_VERSION;

/* الملفات الثابتة التي تُحفظ عند التثبيت */
const STATIC_ASSETS = [
  '/index.html',
  '/login.html',
  '/add-property.html',
  '/map.html',
  '/details.html',
  '/favorites.html',
  '/messages.html',
  '/chat.html',
  '/notifications.html',
  '/profile.html',
  '/settings.html',
  '/filter.html',
  '/css/style.css',
  '/js/app.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

/* ── التثبيت ──────────────────────────────────────── */
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(function(cache) {
      return Promise.all(
        STATIC_ASSETS.map(url =>
          cache.add(new Request(url, { cache: 'reload' })).catch(() => {})
        )
      );
    })
  );
  self.skipWaiting();
});

/* ── التفعيل: حذف الكاش القديم ────────────────────── */
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys
          .filter(key => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
          .map(key => {
            console.log('[SW] حذف كاش قديم:', key);
            return caches.delete(key);
          })
      );
    })
  );
  self.clients.claim();
});

/* ── معالجة الطلبات ───────────────────────────────── */
self.addEventListener('fetch', function(event) {
  const url = event.request.url;
  const req = event.request;

  /* تجاهل غير GET */
  if (req.method !== 'GET') return;

  /* تجاهل Firebase وخدمات خارجية حساسة — تذهب للشبكة دائماً */
  if (
    url.includes('firestore.googleapis.com') ||
    url.includes('firebase.googleapis.com') ||
    url.includes('firebaseio.com') ||
    url.includes('googleapis.com')
  ) {
    return; /* لا تتدخل — دع المتصفح يتعامل معها مباشرة */
  }

  /* خرائط وCDN: شبكة أولاً ثم كاش */
  if (
    url.includes('tile.openstreetmap') ||
    url.includes('arcgisonline') ||
    url.includes('nominatim') ||
    url.includes('cdnjs.cloudflare') ||
    url.includes('fontawesome') ||
    url.includes('unsplash.com')
  ) {
    event.respondWith(networkFirstStrategy(req));
    return;
  }

  /* الملفات الداخلية (.html, .css, .js): كاش أولاً ثم شبكة */
  /* لكن بعد إحضار الشبكة نحدّث الكاش (Stale While Revalidate) */
  event.respondWith(staleWhileRevalidate(req));
});

/* ── استراتيجية: Stale While Revalidate ─────────────
   يعرض الكاش فوراً، ويحدّثه من الشبكة في الخلفية.
   الزيارة التالية تحصل على أحدث نسخة.
────────────────────────────────────────────────────*/
function staleWhileRevalidate(req) {
  return caches.open(STATIC_CACHE).then(function(staticCache) {
    return caches.open(DYNAMIC_CACHE).then(function(dynCache) {
      return caches.match(req).then(function(cached) {
        /* تحديث الكاش في الخلفية دائماً */
        const networkFetch = fetch(req).then(function(res) {
          if (res && res.status === 200 && res.type !== 'opaque') {
            const clone = res.clone();
            /* احفظ HTML/CSS/JS في static، والباقي في dynamic */
            if (req.url.match(/\.(html|css|js)(\?.*)?$/)) {
              staticCache.put(req, clone);
            } else {
              dynCache.put(req, clone);
            }
          }
          return res;
        }).catch(function() { return null; });

        /* أعد الكاش فوراً إن وُجد، وإلا انتظر الشبكة */
        return cached || networkFetch.then(function(res) {
          if (res) return res;
          /* بدون إنترنت وبدون كاش */
          if (req.headers.get('accept') && req.headers.get('accept').includes('text/html')) {
            return caches.match('/index.html');
          }
          return new Response('', { status: 503 });
        });
      });
    });
  });
}

/* ── استراتيجية: Network First ──────────────────────*/
function networkFirstStrategy(req) {
  return fetch(req).then(function(res) {
    if (res && res.status === 200) {
      const clone = res.clone();
      caches.open(DYNAMIC_CACHE).then(c => c.put(req, clone));
    }
    return res;
  }).catch(function() {
    return caches.match(req).then(function(cached) {
      return cached || new Response('', { status: 503 });
    });
  });
}

/* ── رسائل من التطبيق ────────────────────────────── */
self.addEventListener('message', function(event) {
  if (!event.data) return;

  /* إجبار التحديث الفوري */
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  /* مسح كاش معين عند الطلب */
  if (event.data.type === 'CLEAR_CACHE') {
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k)))
    ).then(() => {
      event.source && event.source.postMessage({ type: 'CACHE_CLEARED' });
    });
  }
});
