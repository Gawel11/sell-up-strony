/* Sell-UP: powiadomienia push (tylko powiadomienia, bez pamięci podręcznej stron) */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = { title: 'Nowa wiadomość', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || d.venue || 'Powiadomienie', {
    body: d.body || '', tag: d.tag || undefined, renotify: true, data: { url: d.url || '/' },
    icon: d.icon || '/selll-szkic/apple-touch-icon.png', badge: '/selll-szkic/favicon.png', vibrate: [200, 100, 200]
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(ws => {
    for (const w of ws) { if (w.url.startsWith(url) && 'focus' in w) return w.focus(); }
    return self.clients.openWindow(url);
  }));
});
