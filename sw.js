/* ═══════════════════════════════════════════════════
   عقاري PWA — Service Worker v9.0
   ✅ Network First للـ HTML — يعرض دائماً الأحدث
   ✅ Cache First للصور والـ CSS فقط
   ✅ تحديث تلقائي بدون مسح الكاش
═══════════════════════════════════════════════════ */

/* غيّر هذا الرقم عند أي تعديل — يجبر التحديث الفوري */
const VERSION     = 'v9.0';
const CACHE_HTML  = 'aqari-html-'  + VERSION;
const CACHE_ASSET = 'aqari-asset-' + VERSION;

/* ── التثبيت ── */
self.addEventListener('install', function(event) {
  console.log('[SW] تثبيت', VERSION);
  /* تفعيل فوري بدون انتظار */
  self.skipWaiting();
});

/* ── التفعيل: حذف كل الكاش القديم ── */
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.map(function(key) {
          /* احذف أي كاش لا يطابق النسخة الحالية */
          if (key !== CACHE_HTML && key !== CACHE_ASSET) {
            console.log('[SW] حذف كاش قديم:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  /* السيطرة الفورية على جميع الصفحات المفتوحة */
  self.clients.claim();
  /* أبلغ كل الصفحات بالتحديث */
  self.clients.matchAll().then(function(clients) {
    clients.forEach(function(client) {
      client.postMessage({ type: 'SW_UPDATED', version: VERSION });
    });
  });
});

/* ── معالجة الطلبات ── */
self.addEventListener('fetch', function(event) {
  var url  = event.request.url;
  var req  = event.request;

  /* تجاهل non-GET */
  if (req.method !== 'GET') return;

  /* تجاهل Firebase والخدمات الخارجية تماماً */
  if (
    url.includes('firestore.googleapis.com') ||
    url.includes('firebase.googleapis.com') ||
    url.includes('googleapis.com') ||
    url.includes('firebaseio.com') ||
    url.includes('gstatic.com/firebasejs')
  ) return;

  /* الخرائط والـ CDN: شبكة أولاً */
  if (
    url.includes('openstreetmap') ||
    url.includes('arcgisonline')  ||
    url.includes('nominatim')     ||
    url.includes('cdnjs.cloudflare') ||
    url.includes('fontawesome')   ||
    url.includes('unsplash.com')
  ) {
    event.respondWith(networkFirst(req, CACHE_ASSET));
    return;
  }

  /* ملفات HTML: شبكة أولاً دائماً — يضمن ظهور التعديلات فوراً */
  if (
    url.includes('.html') ||
    url.endsWith('/') ||
    url.includes('/aqari/') ||
    req.headers.get('accept') && req.headers.get('accept').includes('text/html')
  ) {
    event.respondWith(networkFirstHtml(req));
    return;
  }

  /* JS و CSS: شبكة أولاً مع كاش احتياطي */
  if (url.includes('.js') || url.includes('.css')) {
    event.respondWith(networkFirst(req, CACHE_ASSET));
    return;
  }

  /* الصور والأيقونات: كاش أولاً (لا تتغير كثيراً) */
  if (url.includes('.png') || url.includes('.jpg') || url.includes('.webp') || url.includes('.ico') || url.includes('/icons/')) {
    event.respondWith(cacheFirst(req, CACHE_ASSET));
    return;
  }

  /* الباقي: شبكة أولاً */
  event.respondWith(networkFirst(req, CACHE_ASSET));
});

/* ── Network First للـ HTML (بدون حفظ في الكاش) ── */
function networkFirstHtml(req) {
  return fetch(req, { cache: 'no-cache' }).then(function(res) {
    if (res && res.ok) return res;
    /* بدون إنترنت: جرب الكاش */
    return caches.match(req).then(function(cached) {
      return cached || caches.match('/aqari/index.html') || caches.match('/index.html');
    });
  }).catch(function() {
    return caches.match(req).then(function(cached) {
      return cached || caches.match('/aqari/index.html') || caches.match('/index.html');
    });
  });
}

/* ── Network First مع كاش احتياطي ── */
function networkFirst(req, cacheName) {
  return fetch(req).then(function(res) {
    if (res && res.ok && res.type !== 'opaque') {
      var clone = res.clone();
      caches.open(cacheName).then(function(cache) { cache.put(req, clone); });
    }
    return res;
  }).catch(function() {
    return caches.match(req);
  });
}

/* ── Cache First للصور ── */
function cacheFirst(req, cacheName) {
  return caches.match(req).then(function(cached) {
    if (cached) return cached;
    return fetch(req).then(function(res) {
      if (res && res.ok) {
        var clone = res.clone();
        caches.open(cacheName).then(function(cache) { cache.put(req, clone); });
      }
      return res;
    }).catch(function() { return new Response('', {status: 503}); });
  });
}

/* ── رسائل من التطبيق ── */
self.addEventListener('message', function(event) {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data.type === 'GET_VERSION') {
    event.source && event.source.postMessage({ type: 'VERSION', version: VERSION });
  }
});
