/* sell-up: „aplikacja” w demach.
   Instalacja na telefonie (PWA), karta pieczątek, punkty, polecenia,
   przykładowe powiadomienie PUSH i PUSH z geolokalizacji (symulacja w demie). */
(function () {
  if (window.__sellupApp) return; window.__sellupApp = 1;
  var DEMO = (location.pathname.split('/').filter(Boolean)[0] || 'demo');
  var CFG = {
    'kebab':        { name: 'Kebab & Grill',  color: '#ff6a2b', icon: '🥙', stamps: 10, reward: 'kebab w bułce gratis', push: ['🔥 Rożen się kręci!', 'Dziś boxy −15% do 15:00. Zamów w aplikacji.'], geo: ['📍 Jesteś 80 m od nas', 'Wpadnij teraz – frytki do kebaba gratis przez 30 min.'] },
    'pizza':        { name: 'Forno 450',      color: '#e8423a', icon: '🍕', stamps: 8,  reward: 'pizza gratis',          push: ['🍕 Piec rozgrzany do 450°C', 'Piątek: druga pizza −50%. Zamów w aplikacji.'], geo: ['📍 Jesteś tuż obok', 'Wejdź, a lemoniada do pizzy gratis.'] },
    'dym-burger':   { name: 'DYM Burger',     color: '#f5a400', icon: '🍔', stamps: 10, reward: 'burger gratis',         push: ['🍔 Smash Tuesday', 'Double w cenie single tylko dziś w aplikacji.'], geo: ['📍 Czujesz zapach grilla?', 'Jesteś obok nas – shake gratis do burgera przez 30 min.'] },
    'obiady-domowe':{ name: 'Obiady Domowe',  color: '#2f7a52', icon: '🥣', stamps: 10, reward: 'obiad gratis',          push: ['🥣 Dziś: żurek + schabowy', 'Zestaw dnia 29 zł. Zostało 18 porcji.'], geo: ['📍 Pora obiadu, a Ty obok nas', 'Wpadnij – kompot do zestawu gratis.'] }
  };
  var C = CFG[DEMO] || { name: document.title || 'Twój lokal', color: '#b9ff2e', icon: '⭐', stamps: 10, reward: 'nagroda', push: ['🔔 Promocja', 'Nowa promocja w aplikacji.'], geo: ['📍 Jesteś obok nas', 'Wpadnij po rabat.'] };

  /* ---- PWA: manifest + service worker ---- */
  if (!document.querySelector('link[rel=manifest]')) { var l = document.createElement('link'); l.rel = 'manifest'; l.href = 'manifest.webmanifest'; document.head.appendChild(l); }
  if (!document.querySelector('link[rel=apple-touch-icon]')) { var a = document.createElement('link'); a.rel = 'apple-touch-icon'; a.href = 'icon-192.png'; document.head.appendChild(a); }
  var reg = null;
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').then(function (r) { reg = r; }).catch(function () {});
  var deferred = null;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; });
  var standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  var iOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

  /* ---- stan karty (w pamięci przeglądarki, demo) ---- */
  var KEY = 'sul-app-' + DEMO, S;
  try { S = JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { S = null; }
  if (!S) S = { st: 3, pts: 120 };
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }

  var css = '' +
    '.sua-tab{position:fixed;left:0;top:50%;z-index:2147483000;transform:translateY(-50%);writing-mode:vertical-rl;font:700 12px/1 system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#fff;background:' + C.color + ';border:0;border-radius:0 12px 12px 0;padding:16px 9px;cursor:pointer;box-shadow:0 6px 22px rgba(0,0,0,.35);opacity:.94}' +
    '.sua-tab:hover{padding-left:13px}' +
    '.sua-ov{position:fixed;inset:0;z-index:2147483001;background:rgba(5,7,6,.6);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);display:flex;align-items:flex-end;justify-content:center;opacity:0;visibility:hidden;transition:all .3s}' +
    '.sua-ov.on{opacity:1;visibility:visible}' +
    '.sua-box{position:relative;width:100%;max-width:420px;max-height:92vh;overflow:auto;background:#f6f3ec;color:#1b1714;border-radius:26px 26px 0 0;padding:20px 18px calc(20px + env(safe-area-inset-bottom,0px));font:15px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;box-shadow:0 -10px 40px rgba(0,0,0,.5);transform:translateY(30px);transition:transform .35s}' +
    '.sua-ov.on .sua-box{transform:none}@media(min-width:600px){.sua-ov{align-items:center}.sua-box{border-radius:26px}}' +
    '.sua-x{position:absolute;right:14px;top:14px;width:36px;height:36px;border-radius:50%;border:0;background:rgba(0,0,0,.08);font:700 16px system-ui;cursor:pointer;color:#1b1714}' +
    '.sua-h{display:flex;gap:12px;align-items:center;margin:0 0 14px}.sua-ic{width:52px;height:52px;border-radius:14px;background:' + C.color + ';display:grid;place-items:center;font-size:26px;box-shadow:0 8px 18px -8px ' + C.color + '}' +
    '.sua-h b{display:block;font-size:19px}.sua-h small{color:#6b625a;font-size:13px}' +
    '.sua-card{background:#fff;border-radius:18px;padding:14px;box-shadow:0 10px 24px -14px rgba(0,0,0,.35)}' +
    '.sua-t{display:flex;justify-content:space-between;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#6b625a}.sua-t b{color:#1b1714;letter-spacing:0}' +
    '.sua-st{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:12px 0 10px}' +
    '.sua-st i{aspect-ratio:1;border-radius:50%;border:2px dashed #d9d1c6;display:grid;place-items:center;font-style:normal;font-size:18px;transition:all .35s cubic-bezier(.3,1.6,.5,1)}' +
    '.sua-st i.on{border:0;background:' + C.color + ';box-shadow:0 4px 10px -3px ' + C.color + '}.sua-st i.pop{transform:scale(1.3)}' +
    '.sua-rw{font-size:13px;color:#6b625a}.sua-rw b{color:#1b1714}' +
    '.sua-row{display:flex;gap:10px;margin:12px 0 0}.sua-row div{flex:1;background:#fff;border-radius:14px;padding:10px 12px;font-size:12px;font-weight:700;color:#6b625a;box-shadow:0 6px 16px -12px rgba(0,0,0,.3)}.sua-row div b{display:block;font-size:20px;color:#1b1714;margin-top:2px}' +
    '.sua-b{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:48px;margin:10px 0 0;border:0;border-radius:14px;background:' + C.color + ';color:#fff;font:800 15px system-ui,sans-serif;cursor:pointer}' +
    '.sua-b.g{background:#fff;color:#1b1714;box-shadow:inset 0 0 0 1.5px #e4ddd2}' +
    '.sua-sec{margin:16px 0 4px;font-size:11.5px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#8a8078}' +
    '.sua-note{font-size:12px;color:#8a8078;margin:12px 0 0;text-align:center}' +
    '.sua-ios{display:none;margin:10px 0 0;padding:12px;border-radius:12px;background:#fff;font-size:13.5px;line-height:1.45}' +
    '.sua-nf{position:fixed;left:50%;top:max(12px,env(safe-area-inset-top,0px));z-index:2147483002;width:min(420px,calc(100% - 20px));display:flex;gap:10px;align-items:flex-start;padding:12px 14px;border-radius:18px;background:rgba(245,245,245,.92);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);box-shadow:0 14px 34px -8px rgba(0,0,0,.45);color:#111;font:13px/1.35 system-ui,sans-serif;transform:translate(-50%,-150%);transition:transform .55s cubic-bezier(.2,1.2,.4,1)}' +
    '.sua-nf.on{transform:translate(-50%,0)}.sua-nf .i{width:36px;height:36px;flex:none;border-radius:10px;background:' + C.color + ';display:grid;place-items:center;font-size:18px}.sua-nf b{display:block}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var tab = document.createElement('button'); tab.type = 'button'; tab.className = 'sua-tab'; tab.textContent = '📱 Aplikacja';
  var ov = document.createElement('div'); ov.className = 'sua-ov';
  ov.innerHTML = '<div class="sua-box" role="dialog" aria-modal="true" aria-label="Aplikacja ' + C.name + '"><button class="sua-x" type="button" aria-label="Zamknij">✕</button>' +
    '<div class="sua-h"><div class="sua-ic">' + C.icon + '</div><div><b>' + C.name + '</b><small>Twoja aplikacja lokalu</small></div></div>' +
    '<div class="sua-card"><div class="sua-t">Karta lojalnościowa <b class="sua-c"></b></div><div class="sua-st"></div><div class="sua-rw">Za <b>' + C.stamps + ' pieczątek</b> ' + C.reward + '</div>' +
    '<button class="sua-b g sua-add" type="button">＋ Dodaj pieczątkę (demo)</button></div>' +
    '<div class="sua-row"><div>Punkty<b class="sua-p"></b></div><div>Polecenia<b>+50 pkt</b></div></div>' +
    '<div class="sua-sec">Aplikacja na telefonie</div>' +
    '<button class="sua-b sua-inst" type="button">📲 Zainstaluj aplikację</button><div class="sua-ios">Na iPhonie: stuknij <b>Udostępnij</b> (kwadrat ze strzałką) i wybierz <b>„Do ekranu początkowego”</b>.</div>' +
    '<div class="sua-sec">Powiadomienia (podgląd)</div>' +
    '<button class="sua-b g sua-push" type="button">🔔 Pokaż przykładowe powiadomienie</button>' +
    '<button class="sua-b g sua-geo" type="button">📍 Symuluj: jesteś 80 m od lokalu</button>' +
    '<button class="sua-b g sua-ref" type="button">🎁 Poleć znajomemu (+50 pkt dla obojga)</button>' +
    '<p class="sua-note">Wersja demonstracyjna: pieczątki i punkty zapisują się tylko w tej przeglądarce.</p></div>';
  var nf = document.createElement('div'); nf.className = 'sua-nf'; nf.innerHTML = '<div class="i">' + C.icon + '</div><div><b></b><span></span></div>';
  function add() { document.body.appendChild(tab); document.body.appendChild(ov); document.body.appendChild(nf); render(); }
  if (document.body) add(); else document.addEventListener('DOMContentLoaded', add);

  function q(s) { return ov.querySelector(s); }
  function render(pop) {
    var box = q('.sua-st'); box.innerHTML = '';
    box.style.gridTemplateColumns = 'repeat(' + (C.stamps > 8 ? 5 : 4) + ',1fr)';
    for (var i = 0; i < C.stamps; i++) { var e = document.createElement('i'); if (i < S.st) { e.className = 'on'; e.textContent = C.icon; } if (pop && i === S.st - 1) e.classList.add('pop'); box.appendChild(e); }
    q('.sua-c').textContent = S.st + '/' + C.stamps; q('.sua-p').textContent = S.pts;
    if (pop) setTimeout(function () { var p = box.querySelector('.pop'); if (p) p.classList.remove('pop'); }, 320);
    q('.sua-inst').style.display = standalone ? 'none' : '';
  }
  function show(t, b) {
    if (reg && 'Notification' in window && Notification.permission === 'granted') {
      reg.showNotification(t, { body: b, icon: 'icon-192.png', badge: 'icon-192.png', tag: 'sul-demo' }).catch(function () {});
    }
    nf.querySelector('b').textContent = t; nf.querySelector('span').textContent = b; nf.classList.add('on');
    clearTimeout(show._t); show._t = setTimeout(function () { nf.classList.remove('on'); }, 4500);
  }
  function askPush(then) {
    if (!('Notification' in window) || Notification.permission !== 'default') return then();
    Notification.requestPermission().then(then, then);
  }
  tab.addEventListener('click', function () { ov.classList.add('on'); });
  ov.addEventListener('click', function (e) { if (e.target === ov) ov.classList.remove('on'); });
  q('.sua-x').addEventListener('click', function () { ov.classList.remove('on'); });
  q('.sua-add').addEventListener('click', function () {
    S.st++; S.pts += 10;
    if (S.st >= C.stamps) { render(true); save(); setTimeout(function () { show('🎉 Masz nagrodę!', 'Odbierz: ' + C.reward + '. Karta zaczyna się od nowa.'); S.st = 0; save(); render(); }, 600); return; }
    save(); render(true);
  });
  q('.sua-inst').addEventListener('click', function () {
    if (deferred) { deferred.prompt(); deferred.userChoice.finally(function () { deferred = null; }); return; }
    q('.sua-ios').style.display = 'block';
    if (!iOS) q('.sua-ios').innerHTML = 'W menu przeglądarki (⋮) wybierz <b>„Zainstaluj aplikację”</b> albo <b>„Dodaj do ekranu głównego”</b>.';
  });
  q('.sua-push').addEventListener('click', function () { askPush(function () { setTimeout(function () { show(C.push[0], C.push[1]); }, 600); }); });
  q('.sua-geo').addEventListener('click', function () { askPush(function () { setTimeout(function () { show(C.geo[0], C.geo[1]); }, 600); }); });
  q('.sua-ref').addEventListener('click', function () {
    var link = location.origin + location.pathname + '?polecenie=' + Math.random().toString(36).slice(2, 8);
    var done = function () { S.pts += 50; save(); render(); show('🎁 Link polecający skopiowany', 'Gdy znajomy zamówi, oboje dostaniecie +50 pkt.'); };
    if (navigator.share) navigator.share({ title: C.name, text: 'Zamawiam tu jedzenie, dostaniesz +50 pkt na start:', url: link }).then(done, function () {});
    else if (navigator.clipboard) navigator.clipboard.writeText(link).then(done, done); else done();
  });
})();
