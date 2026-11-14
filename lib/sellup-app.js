/* sell-up: strona lokalu działa jak aplikacja (PWA).
   Bez żadnych przycisków na stronie: telefon sam proponuje „Dodaj do ekranu głównego”. */
(function () {
  if (window.__sellupApp) return; window.__sellupApp = 1;
  if (!document.querySelector('link[rel=manifest]')) { var l = document.createElement('link'); l.rel = 'manifest'; l.href = 'manifest.webmanifest'; document.head.appendChild(l); }
  if (!document.querySelector('link[rel=apple-touch-icon]')) { var a = document.createElement('link'); a.rel = 'apple-touch-icon'; a.href = 'icon-192.png'; document.head.appendChild(a); }
  if (!document.querySelector('meta[name=apple-mobile-web-app-capable]')) { var m = document.createElement('meta'); m.name = 'apple-mobile-web-app-capable'; m.content = 'yes'; document.head.appendChild(m); }
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function () {});
})();
