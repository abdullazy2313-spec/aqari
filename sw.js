/* SW v24 */
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;const u=e.request.url;if(u.includes('googleapis')||u.includes('firebaseio')||u.includes('gstatic.com/firebasejs'))return;e.respondWith(fetch(e.request,{cache:'no-store'}).catch(()=>caches.match(e.request)));});