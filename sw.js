/* عقاري SW v11 - يجبر التحديث الفوري */
const V = 'v11-dialogs';
const C = 'aqari-' + V;

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
  self.clients.matchAll({includeUncontrolled:true}).then(clients =>
    clients.forEach(c => c.postMessage({type:'RELOAD'}))
  );
});

self.addEventListener('fetch', e => {
  const url = e.request.url;
  if (e.request.method !== 'GET') return;
  if (url.includes('googleapis.com') || url.includes('firebaseio') || url.includes('gstatic.com/firebasejs')) return;
  if (url.includes('.html') || url.includes('app.js') || url.includes('style.css')) {
    e.respondWith(fetch(e.request, {cache:'no-store'}).catch(() => caches.match(e.request)));
    return;
  }
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).then(res => {
      if (res.ok) { const c = res.clone(); caches.open(C).then(ca => ca.put(e.request, c)); }
      return res;
    }))
  );
});
