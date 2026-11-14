/* sell-up demo: minimalny service worker (instalacja aplikacji + powiadomienia) */
self.addEventListener('install',e=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{if(e.request.mode==='navigate'){e.respondWith(fetch(e.request).catch(()=>new Response('<h1 style="font-family:sans-serif">Brak internetu</h1><p style="font-family:sans-serif">Połącz się z siecią, aby zamówić.</p>',{headers:{'Content-Type':'text/html; charset=utf-8'}})));}});
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(self.clients.matchAll({type:'window'}).then(c=>c.length?c[0].focus():self.clients.openWindow('./')));});
