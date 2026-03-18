/* ═══════════════════════════════════════════════════
   عقاري PWA — Service Worker
   يدعم العمل بدون إنترنت ويسرّع تحميل الصفحات
═══════════════════════════════════════════════════ */

const CACHE_NAME = 'aqari-v4';
const STATIC_CACHE = 'aqari-static-v4';
const DYNAMIC_CACHE = 'aqari-dynamic-v4';

// الملفات التي تُحفظ عند التثبيت (تعمل بدون نت)
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

// ── التثبيت: حفظ الملفات الأساسية ──────────────────
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(function(cache) {
      return cache.addAll(STATIC_ASSETS.map(url => {
        return new Request(url, { cache: 'reload' });
      })).catch(function(err) {
        console.warn('[SW] بعض الملفات لم تُحفظ:', err);
        // حفظ ما أمكن حفظه
        return Promise.all(
          STATIC_ASSETS.map(url =>
            cache.add(url).catch(() => {})
          )
        );
      });
    })
  );
  self.skipWaiting();
});

// ── التفعيل: تنظيف الكاش القديم ─────────────────────
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys
          .filter(key => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
          .map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// ── الطلبات: استراتيجية Cache First للملفات الثابتة ──
self.addEventListener('fetch', function(event) {
  var url = event.request.url;

  // تجاهل طلبات POST وطلبات خارجية (خرائط، CDN)
  if (event.request.method !== 'GET') return;
  if (url.includes('tile.openstreetmap') || url.includes('arcgisonline') || url.includes('nominatim')) return;
  if (url.includes('cdnjs.cloudflare') || url.includes('fontawesome')) {
    // للـ CDN: شبكة أولاً ثم كاش
    event.respondWith(
      fetch(event.request)
        .then(function(res) {
          var clone = res.clone();
          caches.open(DYNAMIC_CACHE).then(c => c.put(event.request, clone));
          return res;
        })
        .catch(function() {
          return caches.match(event.request);
        })
    );
    return;
  }

  // للملفات الداخلية: كاش أولاً ثم شبكة
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) return cached;
      return fetch(event.request).then(function(res) {
        if (res && res.status === 200) {
          var clone = res.clone();
          caches.open(DYNAMIC_CACHE).then(c => c.put(event.request, clone));
        }
        return res;
      }).catch(function() {
        // بدون إنترنت: عرض الصفحة الرئيسية
        if (event.request.headers.get('accept').includes('text/html')) {
          return caches.match('/index.html');
        }
      });
    })
  );
});

// ── رسائل من التطبيق ─────────────────────────────────
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
