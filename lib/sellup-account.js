/* Sell-UP: konto klienta (logowanie kodem SMS), karta lojalnościowa, ulubione.
   API:  SellUpAccount.logged()                    → true/false
         SellUpAccount.login({ venue })            → Promise (otwiera okno logowania, kończy się po zalogowaniu)
         SellUpAccount.me(slug)                    → { name, phone, code, card, favorites, history }
         SellUpAccount.favSave(slug, name, data) / favDel(id)
         SellUpAccount.attach(orderId, trackToken) → przypina zamówienie do konta (pieczątka po wydaniu)
         SellUpAccount.setName(name) / logout()
         SellUpAccount.staff.card|stamp|redeem(slug, code, …)   (obsługa / demo)
   Wygląd okna: zmienne CSS --sua-bg, --sua-fg, --sua-accent, --sua-accent-fg na :root. */
(function () {
  if (window.SellUpAccount) return;
  var SB = 'https://medldonrwgoxfryandbp.supabase.co',
      KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1lZGxkb25yd2dveGZyeWFuZGJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ0MjQ5OTYsImV4cCI6MjExMDAwMDk5Nn0.F4S0Wv3PXhb3ii5IQWsOuNZwSYq84Dnf3diAvfTcY20',
      LS = 'su-acct';
  var H = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };
  function tok() { try { return localStorage.getItem(LS) || ''; } catch (e) { return ''; } }
  function setTok(t) { try { t ? localStorage.setItem(LS, t) : localStorage.removeItem(LS); } catch (e) {} }
  function rpc(fn, body) {
    return fetch(SB + '/rest/v1/rpc/' + fn, { method: 'POST', headers: H, body: JSON.stringify(body) }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) {
          var msg = (j && j.message) || 'Coś poszło nie tak';
          if (j && j.code === '28000') { setTok(''); fire(); }
          var e = new Error(msg); e.code = j && j.code; throw e;
        }
        return j;
      });
    });
  }
  function fn(body) {
    return fetch(SB + '/functions/v1/customer-auth', { method: 'POST', headers: H, body: JSON.stringify(body) }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok || j.error) { var e = new Error(j.error || 'Coś poszło nie tak'); e.status = r.status; throw e; } return j; });
    });
  }
  var subs = [];
  // dane do formularzy zamówień (imię i telefon z konta, adres zostaje)
  function remember(m) {
    ['sellup-dane', 'dym-dane', 'od-dane'].forEach(function (k) {
      try { var d = JSON.parse(localStorage.getItem(k) || '{}'); if (m.name) d.n = d.n || m.name; if (m.tel) d.p = m.tel; localStorage.setItem(k, JSON.stringify(d)); } catch (e) {}
    });
  }
  function fire() { subs.forEach(function (f) { try { f(!!tok()); } catch (e) {} }); if (tok()) setTimeout(claimRef, 400); }

  var css = '' +
    '.sua-w{position:fixed;inset:0;z-index:2147483100;display:grid;place-items:end center;background:rgba(0,0,0,.62);opacity:0;transition:opacity .25s;font-family:inherit}' +
    '.sua-w.on{opacity:1}' +
    '.sua{width:min(460px,100%);background:var(--sua-bg,#17130f);color:var(--sua-fg,#f6efe6);border-radius:24px 24px 0 0;padding:22px 20px calc(20px + env(safe-area-inset-bottom,0px));transform:translateY(30px);transition:transform .3s;box-shadow:0 -10px 40px rgba(0,0,0,.4)}' +
    '.sua-w.on .sua{transform:none}@media (min-width:700px){.sua-w{place-items:center}.sua{border-radius:24px}}' +
    '.sua *{box-sizing:border-box}.sua h3{margin:0 0 6px;font-size:23px;line-height:1.15}.sua p{margin:0 0 16px;opacity:.75;font-size:14.5px;line-height:1.45}' +
    '.sua .x{float:right;width:36px;height:36px;border-radius:50%;border:0;background:rgba(255,255,255,.1);color:inherit;font-size:16px;cursor:pointer}' +
    '.sua input{width:100%;font:inherit;font-size:20px;letter-spacing:.04em;color:inherit;background:rgba(255,255,255,.07);border:1.5px solid rgba(255,255,255,.16);border-radius:14px;padding:14px 16px}' +
    '.sua input:focus{outline:none;border-color:var(--sua-accent,#ff9a3c)}.sua input.code{text-align:center;letter-spacing:.5em;font-size:26px;font-weight:800}' +
    '.sua .ph{display:flex;align-items:center;gap:8px}.sua .ph b{font-size:18px;opacity:.7}' +
    '.sua .go{width:100%;margin-top:14px;padding:16px;border-radius:99px;border:0;background:var(--sua-accent,#ff9a3c);color:var(--sua-accent-fg,#1d1209);font:inherit;font-weight:800;font-size:16px;cursor:pointer}' +
    '.sua .go:disabled{opacity:.5}.sua .ln{background:none;border:0;color:inherit;opacity:.7;text-decoration:underline;font:inherit;font-size:13.5px;margin-top:12px;cursor:pointer;padding:4px}' +
    '.sua .err{color:#ff8f8f;font-weight:600;font-size:14px;min-height:1.2em;margin:10px 0 0}' +
    '.sua .fine{font-size:11.5px;opacity:.5;margin:14px 0 0;text-align:center;line-height:1.4}.sua .fine a{color:inherit}' +
    '.sua-strip{display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:16px;background:rgba(127,127,127,.12);box-shadow:inset 0 0 0 1px rgba(127,127,127,.22);margin:0 0 8px;text-align:left;font-size:14px;line-height:1.35}' +
    '.sua-strip>div{flex:1;min-width:0}.sua-strip b{display:block;font-size:15px}.sua-strip span{opacity:.7;font-size:13px}' +
    '.sua-strip button{flex:none;padding:10px 14px;border-radius:99px;border:0;font:inherit;font-weight:800;font-size:13.5px;cursor:pointer;background:var(--sua-accent,#ff9a3c);color:var(--sua-accent-fg,#1d1209)}' +
    '.sua-strip button.g{background:rgba(127,127,127,.18);color:inherit;font-weight:700}' +
    '.sua .qrb{background:#fff;border-radius:18px;padding:14px;width:max-content;margin:6px auto 10px}.sua .qrb img,.sua .qrb canvas{display:block}' +
    '.sua .big{text-align:center;font-size:26px;font-weight:800;letter-spacing:.18em;margin:0 0 6px}.sua .ctr{text-align:center}' +
    '.sua .dots{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin:6px 0 10px}.sua .dots i{width:30px;height:30px;border-radius:50%;border:2px dashed rgba(127,127,127,.5)}' +
    '.sua .dots i.on{border:0;background:var(--sua-accent,#ff9a3c);box-shadow:0 0 12px var(--sua-accent,#ff9a3c)}' +
    '.sua .rw{background:rgba(120,210,120,.16);border-radius:14px;padding:10px 12px;font-weight:700;text-align:center;margin:0 0 10px}' +
    '.sua .pts{text-align:center;font-size:40px;font-weight:800;margin:4px 0}.sua .pts small{font-size:16px;opacity:.6}' +
    '.sua-ord{display:flex;justify-content:space-between;width:100%;margin:0 0 8px;padding:12px 14px;border-radius:14px;border:0;background:rgba(127,127,127,.1);color:inherit;font:inherit;font-weight:700;font-size:14px;cursor:pointer}' +
    '.sua .ol{max-height:60vh;overflow:auto}.sua-o{padding:12px 14px;border-radius:14px;background:rgba(127,127,127,.1);margin:0 0 8px;font-size:14px}.sua-o.act{box-shadow:inset 0 0 0 1.5px var(--sua-accent,#ff9a3c)}' +
    '.sua-o .h{display:flex;justify-content:space-between;align-items:center}.sua-o .h b{font-size:18px}.sua-o .c{padding:4px 10px;border-radius:99px;font-size:12px;font-weight:800;background:rgba(127,127,127,.2)}' +
    '.sua-o .c.lv{background:var(--sua-accent,#ff9a3c);color:var(--sua-accent-fg,#1d1209)}.sua-o .c.rd{background:#3d8a4a;color:#fff}.sua-o small{opacity:.6}' +
    '.sua-o ul{margin:8px 0 6px;padding:0;list-style:none}.sua-o li{margin:0 0 4px}.sua-o li span{display:block;opacity:.6;font-size:12.5px}.sua-o .t{font-weight:800;text-align:right}' +
    '.sua .s3 .nm{font-size:18px;letter-spacing:0}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  function login(o) {
    o = o || {};
    return new Promise(function (resolve, reject) {
      var w = document.createElement('div'); w.className = 'sua-w';
      w.innerHTML = '<div class="sua" role="dialog" aria-modal="true" aria-labelledby="suaT"><button class="x" type="button" aria-label="Zamknij">✕</button>' +
        '<div class="s1"><h3 id="suaT">' + (o.title || 'Zaloguj się') + '</h3><p>' + (o.text || 'Podaj numer telefonu. Wyślemy SMS z kodem. Bez haseł i bez zakładania konta.') + '</p>' +
        '<div class="ph"><b>+48</b><input class="tel" type="tel" inputmode="tel" autocomplete="tel-national" placeholder="500 600 700" maxlength="15"></div>' +
        '<button class="go send" type="button">Wyślij kod SMS</button></div>' +
        '<div class="s2" hidden><h3>Wpisz kod z SMS</h3><p class="to"></p>' +
        '<input class="code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="••••••">' +
        '<button class="go ver" type="button">Zaloguj</button><button class="ln back" type="button">Zmień numer albo wyślij ponownie</button></div>' +
        '<div class="s3" hidden><h3>Jak masz na imię?</h3><p>Obsługa zobaczy je przy zamówieniu, a karta przywita Cię po imieniu.</p>' +
        '<input class="nm" type="text" autocomplete="given-name" maxlength="40" placeholder="np. Kasia">' +
        '<button class="go sv" type="button">Zapisz</button><button class="ln skip" type="button">Pomiń</button></div>' +
        '<div class="err" role="alert"></div>' +
        '<div class="fine">Logując się, akceptujesz <a href="/prawne/regulamin.html" target="_blank">regulamin</a> i <a href="/prawne/polityka-prywatnosci.html" target="_blank">politykę prywatności</a>.</div></div>';
      document.body.appendChild(w); requestAnimationFrame(function () { w.classList.add('on'); });
      var q = function (s) { return w.querySelector(s); }, phone = '', err = q('.err');
      function close(ok) { w.classList.remove('on'); setTimeout(function () { w.remove(); }, 260); ok ? resolve(ok) : reject(new Error('anulowano')); }
      q('.x').onclick = function () { close(); };
      w.addEventListener('click', function (e) { if (e.target === w) close(); });
      setTimeout(function () { q('.tel').focus(); }, 300);
      function send() {
        phone = q('.tel').value.replace(/\D/g, ''); err.textContent = '';
        if (phone.length < 9) { err.textContent = 'Podaj 9 cyfr numeru telefonu'; return; }
        var b = q('.send'); b.disabled = true; b.textContent = 'Wysyłam…';
        fn({ action: 'send', phone: phone, venue: o.venue || '' }).then(function () {
          q('.s1').hidden = true; q('.s2').hidden = false;
          q('.to').textContent = 'Wysłaliśmy go na numer ' + phone.replace(/(\d{3})(?=\d)/g, '$1 ') + '.';
          setTimeout(function () { q('.code').focus(); }, 100);
          if ('OTPCredential' in window) {
            navigator.credentials.get({ otp: { transport: ['sms'] } }).then(function (c) { if (c && c.code) { q('.code').value = c.code; verify(); } }).catch(function () {});
          }
        }).catch(function (e) {
          err.textContent = e.status === 503 ? 'Logowanie SMS włączymy lada chwila. Spróbuj później.' : e.message;
        }).then(function () { b.disabled = false; b.textContent = 'Wyślij kod SMS'; });
      }
      function verify() {
        var c = q('.code').value.replace(/\D/g, ''); err.textContent = '';
        if (c.length !== 6) { err.textContent = 'Wpisz 6 cyfr z SMS'; return; }
        var b = q('.ver'); b.disabled = true; b.textContent = 'Sprawdzam…';
        fn({ action: 'verify', phone: phone, code: c }).then(function (j) {
          setTok(j.token);
          if (j.name) { fire(); close({ name: j.name, code: j.code }); return; }
          q('.s2').hidden = true; q('.s3').hidden = false; setTimeout(function () { q('.nm').focus(); }, 100);
          var done = function (nm) { fire(); close({ name: nm || null, code: j.code }); };
          q('.skip').onclick = function () { done(null); };
          var save = function () { var nm = q('.nm').value.trim(); if (!nm) { err.textContent = 'Wpisz imię albo kliknij „Pomiń”'; return; }
            q('.sv').disabled = true; rpc('cust_set_name', { p_token: tok(), p_name: nm }).then(function () { remember({ name: nm }); done(nm); }).catch(function (e) { err.textContent = e.message; q('.sv').disabled = false; }); };
          q('.sv').onclick = save; q('.nm').addEventListener('keydown', function (e) { if (e.key === 'Enter') save(); });
        }).catch(function (e) { err.textContent = e.message; b.disabled = false; b.textContent = 'Zaloguj'; });
      }
      q('.send').onclick = send; q('.tel').addEventListener('keydown', function (e) { if (e.key === 'Enter') send(); });
      q('.ver').onclick = verify;
      q('.code').addEventListener('input', function () { if (this.value.replace(/\D/g, '').length === 6) verify(); });
      q('.back').onclick = function () { q('.s2').hidden = true; q('.s1').hidden = false; err.textContent = ''; };
    });
  }


  /* ---- gotowe elementy interfejsu ---- */
  var escH = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  function qrLib() {
    if (window.QRCode) return Promise.resolve();
    return new Promise(function (ok) { var s = document.createElement('script'); s.src = '/bulkaikromka/qrcode.min.js'; s.onload = ok; s.onerror = ok; document.head.appendChild(s); });
  }
  function sheet(html) {
    var w = document.createElement('div'); w.className = 'sua-w';
    w.innerHTML = '<div class="sua" role="dialog" aria-modal="true"><button class="x" type="button" aria-label="Zamknij">✕</button>' + html + '</div>';
    document.body.appendChild(w); requestAnimationFrame(function () { w.classList.add('on'); });
    var close = function () { w.classList.remove('on'); setTimeout(function () { w.remove(); }, 260); };
    w.querySelector('.x').onclick = close; w.addEventListener('click', function (e) { if (e.target === w) close(); });
    return { el: w.querySelector('.sua'), close: close };
  }
  function showCode(code, title) {
    var s = sheet('<h3>' + escH(title || 'Twój kod') + '</h3><p>Pokaż ten kod przy ladzie. Obsługa zeskanuje go i doda pieczątkę albo wyda nagrodę.</p><div class="qrb"></div><div class="big">' + escH(code) + '</div>');
    qrLib().then(function () { try { new QRCode(s.el.querySelector('.qrb'), { text: 'SU:' + code, width: 200, height: 200, colorDark: '#111111', colorLight: '#ffffff' }); } catch (e) {} });
  }
  // pasek konta: zaloguj / cześć + kod; onCard(card|null, me|null)
  function strip(el, o) {
    o = o || {};
    function draw() {
      if (!tok()) {
        el.innerHTML = '<div class="sua-strip"><div><b>Zaloguj się numerem telefonu</b><span>Karta zapisze się na koncie i nie zginie, nawet gdy zmienisz telefon.</span></div><button type="button" data-in>Zaloguj</button></div>';
        o.onCard && o.onCard(null, null); return Promise.resolve(null);
      }
      return window.SellUpAccount.me(o.slug).then(function (m) {
        el.innerHTML = '<div class="sua-strip"><div><b>' + (m.name ? 'Cześć, ' + escH(m.name) + '!' : 'Jesteś zalogowany') + '</b><span>Karta na koncie · kod ' + escH(m.code) + '</span></div><button type="button" data-q>Pokaż kod</button><button type="button" class="g" data-out>Wyloguj</button></div>' +
          (o.orders === false ? '' : '<button type="button" class="sua-ord" data-ord>📋 Moje zamówienia <span>›</span></button>') +
          (o.invite === false ? '' : '<button type="button" class="sua-ord" data-inv>🎁 Poleć znajomemu <span>›</span></button>');
        o.onCard && o.onCard(m.card, m); return m;
      }).catch(function () { el.innerHTML = ''; o.onCard && o.onCard(null, null); });
    }
    el.onclick = function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if ('in' in b.dataset) login({ venue: o.venue }).then(draw).catch(function () {});
      if ('out' in b.dataset) window.SellUpAccount.logout().then(draw);
      if ('q' in b.dataset) window.SellUpAccount.me(o.slug).then(function (m) { showCode(m.code, o.venue); });
      if ('ord' in b.dataset) ordersSheet({ slug: o.slug });
      if ('inv' in b.dataset) inviteSheet({ slug: o.slug, venue: o.venue });
    };
    subs.push(function () { draw(); });
    return draw();
  }
  var ST = { new: 'Przyjęte', cooking: 'Przygotowujemy', ready: 'Gotowe', delivering: 'W drodze', done: 'Wydane', cancelled: 'Anulowane' };
  function ordersSheet(o) {
    o = o || {};
    var s = sheet('<h3>Moje zamówienia</h3><p>Aktualne i ostatnie zamówienia w tym lokalu.</p><div class="ol">Wczytuję…</div>'), box = s.el.querySelector('.ol'), t;
    function load() {
      if (!document.body.contains(s.el)) return;
      window.SellUpAccount.orders(o.slug).then(function (L) {
        if (!L.length) { box.innerHTML = '<p class="ctr">Nie masz jeszcze zamówień w tym lokalu.</p>'; return; }
        box.innerHTML = L.map(function (x) {
          var d = new Date(x.created_at), act = ['done', 'cancelled'].indexOf(x.status) < 0;
          return '<div class="sua-o' + (act ? ' act' : '') + '"><div class="h"><b>Nr ' + x.number + '</b><span class="c' + (x.status === 'ready' ? ' rd' : act ? ' lv' : '') + '">' + (ST[x.status] || x.status) + '</span></div>' +
            '<small>' + d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' }) + ', ' + d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }) + (x.mode === 'delivery' ? ' · dostawa' : ' · odbiór') + '</small>' +
            '<ul>' + (x.items || []).map(function (i) { return '<li>' + (i.qty > 1 ? i.qty + '× ' : '') + escH(i.name) + (i.variant ? ' · ' + escH(i.variant) : '') + (i.options && i.options.length ? '<span>' + escH(i.options.join(', ')) + '</span>' : '') + '</li>'; }).join('') + '</ul>' +
            '<div class="t">' + Number(x.total).toFixed(2).replace('.', ',') + ' zł</div></div>';
        }).join('');
        if (L.some(function (x) { return ['done', 'cancelled'].indexOf(x.status) < 0; })) t = setTimeout(load, 5000);
      }).catch(function (e) { box.innerHTML = '<p class="ctr">' + escH(e.message) + '</p>'; });
    }
    load();
  }
  /* ---- powiadomienia push ---- */
  var VAPID = 'BI-m08VahLFLnXeOzzsG-ev6qhk_rUfmMSeTNzedFXo3wAMPNbmpmBICxNhnIbJEFbX2elI8QagYVTupnxEy18M';
  var pushOk = function () { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && location.protocol === 'https:'; };
  function b64u(s) { var p = '='.repeat((4 - s.length % 4) % 4), b = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')), a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; }
  function pushSubscribe(slug) {
    if (!pushOk() || !tok() || !slug) return Promise.resolve(false);
    return navigator.serviceWorker.register('/sw-push.js', { scope: '/' }).then(function () { return navigator.serviceWorker.ready; })
      .then(function (reg) { return reg.pushManager.getSubscription().then(function (s) { return s || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64u(VAPID) }); }); })
      .then(function (sub) { return rpc('cust_push_subscribe', { p_token: tok(), p_restaurant: slug, p_sub: sub.toJSON(), p_ua: navigator.userAgent }); })
      .then(function () { return true; }).catch(function () { return false; });
  }
  function pushEnable(slug) {
    if (!pushOk()) return Promise.resolve(false);
    return Notification.requestPermission().then(function (p) { return p === 'granted' ? pushSubscribe(slug) : false; });
  }
  // po złożeniu zamówienia: zapyta raz (na lokal), czy wysyłać powiadomienia; gdy zgoda już jest – zapisze po cichu
  function pushAfterOrder(slug) {
    slug = slug || pageSlug(); if (!pushOk() || !tok() || !slug) return;
    if (Notification.permission === 'granted') { pushSubscribe(slug); return; }
    if (Notification.permission === 'denied') return;
    var k = 'su-push-asked-' + slug; try { if (localStorage.getItem(k)) return; localStorage.setItem(k, '1'); } catch (e) {}
    setTimeout(function () {
      var s = sheet('<h3>🔔 Dać znać, gdy będzie gotowe?</h3><p>Wyślemy powiadomienie na ten telefon, gdy zamówienie będzie gotowe albo w drodze. Czasem też informację o promocji w tym lokalu.</p><button class="go" type="button">Tak, powiadamiaj mnie</button><button class="ln" type="button">Nie teraz</button>');
      s.el.querySelector('.go').onclick = function () { s.close(); pushEnable(slug); };
      s.el.querySelector('.ln').onclick = function () { s.close(); };
    }, 900);
  }

  /* ---- promocja i danie dnia (ustawiane w panelu) ---- */
  var PROMO = null;
  function promoSheet(force) {
    var d = PROMO; if (!d || (!d.promo && !d.special)) return;
    var key = 'su-promo-seen-' + pageSlug(), ver = new Date().toLocaleDateString('sv-SE') + '|' + (d.promo ? d.promo.v : '') + '|' + (d.special ? d.special.v : '');
    if (!force) { try { if (localStorage.getItem(key) === ver) return; localStorage.setItem(key, ver); } catch (e) {} }
    var h = '';
    if (d.promo) h += '<h3>🔥 ' + escH(d.promo.title || 'Promocja') + '</h3>' + (d.promo.text ? '<p>' + escH(d.promo.text) + '</p>' : '') +
      (d.promo.code ? '<div class="big" style="font-size:22px;border:2px dashed rgba(127,127,127,.5);border-radius:14px;padding:10px;margin:0 0 10px">' + escH(d.promo.code) + '</div>' : '');
    if (d.special) h += '<div class="sua-o" style="margin:' + (d.promo ? '6px' : '0') + ' 0 10px"><div class="h"><b>🍽 Danie dnia</b>' + (d.special.price ? '<span class="c lv">' + escH(String(d.special.price).replace('.', ',')) + ' zł</span>' : '') + '</div><div style="font-weight:800;font-size:17px;margin-top:4px">' + escH(d.special.name || '') + '</div>' + (d.special.text ? '<small>' + escH(d.special.text) + '</small>' : '') + '</div>';
    if (d.promo && d.promo.until) h += '<p class="ctr" style="font-size:13px">Ważne do ' + new Date(d.promo.until).toLocaleString('pl-PL', { weekday: 'long', hour: '2-digit', minute: '2-digit' }) + '</p>';
    h += d.promo && d.promo.code ? '<button class="go use" type="button">Użyj kodu przy zamówieniu</button><button class="ln cl" type="button">Zamknij</button>' : '<button class="go cl" type="button">Super, zamawiam</button>';
    var s = sheet(h);
    s.el.querySelectorAll('.cl').forEach(function (b) { b.onclick = s.close; });
    var u = s.el.querySelector('.use'); if (u) u.onclick = function () { try { localStorage.setItem('su-promo', JSON.stringify({ code: d.promo.code, slug: pageSlug(), at: Date.now() })); } catch (e) {} s.close(); };
  }
  function loadPromo() {
    var sl = pageSlug(); if (!sl) return;
    rpc('promo_info', { p_slug: sl }).then(function (d) {
      PROMO = d;
      var wait = function () { if (document.getElementById('intro')) return setTimeout(wait, 700); promoSheet(false); };
      setTimeout(wait, 1800);
    }).catch(function () {});
  }

  /* ---- polecenia ---- */
  var PMAP = { 'bubble-tea': 'bubble-tea', 'pizza': 'forno450', 'kebab': 'zar', 'dym-burger': 'dym-burger', 'obiady-domowe': 'obiady-domowe', 'bulkaikromka': 'bulkaikromka' };
  var pageSlug = function () { return window.SELLUP_SLUG || PMAP[(location.pathname.split('/').filter(Boolean)[0] || '')] || null; };
  var unitTxt = function (mode, n) { return mode === 'points' ? n + ' pkt' : n === 1 ? '1 pieczątkę' : n + (n < 5 ? ' pieczątki' : ' pieczątek'); };
  (function grab() {
    try { var q = new URLSearchParams(location.search), c = (q.get('od') || q.get('ref') || '').toUpperCase();
      if (/^[0-9A-F]{8}$/.test(c)) localStorage.setItem('su-ref', JSON.stringify({ code: c, slug: pageSlug(), at: Date.now() })); } catch (e) {}
  })();
  function pendingRef() { try { var r = JSON.parse(localStorage.getItem('su-ref') || 'null'); if (r && Date.now() - r.at < 14 * 864e5) return r; } catch (e) {} return null; }
  function claimRef() {
    var r = pendingRef(); if (!r || !tok() || !r.slug) return;
    rpc('cust_claim_referral', { p_token: tok(), p_restaurant: r.slug, p_code: r.code }).then(function (j) {
      try { localStorage.removeItem('su-ref'); } catch (e) {}
      if (j.ok) sheet('<h3>🎁 Zaproszenie przyjęte</h3><p>Zaprosił Cię ' + escH(j.from) + '. Po Twoim pierwszym zakupie oboje dostaniecie po ' + unitTxt(j.mode, j.bonus) + ' na kartę.</p><button class="go" type="button">Super</button>').el.querySelector('.go').onclick = function () { this.closest('.sua-w').querySelector('.x').click(); };
    }).catch(function () {});
  }
  function inviteSheet(o) {
    o = o || {}; var slug = o.slug || pageSlug();
    if (!tok()) { login({ venue: o.venue, text: 'Zaloguj się numerem telefonu, a dostaniesz swój link do zapraszania znajomych.' }).then(function () { inviteSheet(o); }).catch(function () {}); return; }
    var s = sheet('<h3>Poleć znajomemu</h3><div class="iv">Wczytuję…</div>'), box = s.el.querySelector('.iv');
    rpc('cust_referrals', { p_token: tok(), p_restaurant: slug }).then(function (c) {
      if (!c.enabled) { box.innerHTML = '<p>Ten lokal nie prowadzi teraz poleceń.</p>'; return; }
      var link = location.origin + location.pathname + '?od=' + c.code, left = Math.max(0, c.limit - c.used);
      box.innerHTML = '<p>Wyślij znajomemu swój link. Gdy zrobi <b>pierwsze zakupy</b>, oboje dostaniecie po <b>' + unitTxt(c.mode, c.bonus) + '</b>.</p>' +
        '<div class="qrb"></div><div class="ctr" style="font-size:13px;opacity:.7;word-break:break-all;margin-bottom:10px">' + escH(link) + '</div>' +
        '<button class="go sh" type="button">Wyślij zaproszenie</button>' +
        '<p class="ctr" style="margin-top:14px">W tym miesiącu: <b>' + c.used + ' z ' + c.limit + '</b> nagrodzonych poleceń' + (c.pending ? ' · ' + c.pending + ' czeka na pierwszy zakup' : '') + '.</p>' +
        (left ? '' : '<p class="ctr">Limit na ten miesiąc wykorzystany. Znajomi nadal dostaną swoją nagrodę.</p>') +
        '<div class="fine" style="margin-top:6px">Nagroda tylko dla nowych klientów (nowy numer telefonu), po pierwszym zakupie. Maks. ' + c.limit + ' nagrodzone polecenia w miesiącu.</div>';
      qrLib().then(function () { try { new QRCode(box.querySelector('.qrb'), { text: link, width: 170, height: 170, colorDark: '#111111', colorLight: '#ffffff' }); } catch (e) {} });
      box.querySelector('.sh').onclick = function () {
        var txt = (o.venue ? o.venue + ': ' : '') + 'zamów przez mój link, po pierwszym zakupie oboje dostaniemy nagrodę 🎁';
        if (navigator.share) navigator.share({ title: o.venue || 'Zaproszenie', text: txt, url: link }).catch(function () {});
        else if (navigator.clipboard) navigator.clipboard.writeText(link).then(function () { box.querySelector('.sh').textContent = 'Skopiowano link ✓'; });
      };
    }).catch(function (e) { box.innerHTML = '<p>' + escH(e.message) + '</p>'; });
  }
  // gotowe okno karty dla stron bez własnej karty
  function open(o) {
    o = o || {};
    var s = sheet('<h3>' + escH(o.title || 'Twoja karta') + '</h3><div class="st"></div><div class="cd"></div>');
    var cd = s.el.querySelector('.cd');
    strip(s.el.querySelector('.st'), { slug: o.slug, venue: o.venue, onCard: function (c, m) {
      if (!c) { cd.innerHTML = '<p class="ctr">Za każde zamówienie dostajesz pieczątkę. Pełna karta to nagroda gratis.</p>'; return; }
      var h = '';
      if (c.mode === 'points') h += '<div class="pts">' + c.points + ' <small>pkt</small></div>' + (c.rewards_catalog || []).map(function (r) { return '<p class="ctr">' + escH(r.name) + ': ' + r.cost + ' pkt' + (c.points >= r.cost ? ' ✓' : '') + '</p>'; }).join('');
      else {
        h += '<div class="dots">' + Array.from({ length: c.need }, function (_, i) { return '<i class="' + (i < c.stamps ? 'on' : '') + '"></i>'; }).join('') + '</div>';
        h += '<p class="ctr"><b>' + c.stamps + ' z ' + c.need + '</b> · ' + (c.need - c.stamps) + ' do nagrody: ' + escH(c.reward) + '</p>';
        if (c.rewards > 0) h += '<div class="rw">🎁 Masz do odbioru: ' + escH(c.reward) + (c.rewards > 1 ? ' ×' + c.rewards : '') + '</div>';
      }
      h += '<button class="go" type="button" data-code>Pokaż kod przy ladzie</button>';
      cd.innerHTML = h;
      cd.querySelector('[data-code]').onclick = function () { showCode(m.code, o.venue); };
    } });
  }
  setTimeout(function () {
    if (!tok()) {
      var r = pendingRef();
      if (r) { var s0 = sheet('<h3>🎁 Masz zaproszenie od znajomego</h3><p>Zaloguj się numerem telefonu. Po Twoim pierwszym zakupie oboje dostaniecie nagrodę na kartę.</p><button class="go" type="button">Zaloguj się</button>');
        s0.el.querySelector('.go').onclick = function () { s0.close(); login({}).catch(function () {}); }; }
      return;
    }
    claimRef();
    window.SellUpAccount.me().then(function (m) {
      var asked = false; try { asked = localStorage.getItem('su-askname') === '1'; } catch (e) {}
      if (m.name || asked) return;
      try { localStorage.setItem('su-askname', '1'); } catch (e) {}
      var s = sheet('<h3>Jak masz na imię?</h3><p>Obsługa zobaczy je przy zamówieniu, a karta przywita Cię po imieniu.</p><input class="nm" type="text" autocomplete="given-name" maxlength="40" placeholder="np. Kasia"><button class="go" type="button">Zapisz</button><div class="err"></div>');
      var go = s.el.querySelector('.go');
      go.onclick = function () { var nm = s.el.querySelector('.nm').value.trim(); if (!nm) return;
        go.disabled = true; window.SellUpAccount.setName(nm).then(function () { s.close(); fire(); }).catch(function (e) { s.el.querySelector('.err').textContent = e.message; go.disabled = false; }); };
    }).catch(function () {});
  }, 1500);
  try { loadPromo(); } catch (e) {}
  window.SellUpAccount = {
    logged: function () { return !!tok(); },
    onChange: function (f) { subs.push(f); },
    login: login,
    open: open,
    strip: strip,
    showCode: showCode,
    me: function (slug) { return rpc('cust_me', { p_token: tok(), p_restaurant: slug || null }).then(function (m) { remember(m); return m; }); },
    setName: function (n) { return rpc('cust_set_name', { p_token: tok(), p_name: n }).then(function (r) { remember({ name: n }); return r; }); },
    ordersSheet: ordersSheet,
    inviteSheet: inviteSheet,
    promo: function () { return PROMO; }, promoSheet: function () { promoSheet(true); },
    favSave: function (slug, name, data) { return rpc('cust_fav_save', { p_token: tok(), p_restaurant: slug, p_name: name, p_data: data }); },
    favDel: function (id) { return rpc('cust_fav_delete', { p_token: tok(), p_id: id }); },
    placeOrder: function (slug, items, note) { return rpc('cust_place_order', { p_token: tok(), p_restaurant: slug, p_items: items, p_note: note || null }).then(function (r) { pushAfterOrder(slug); return r; }); },
    orders: function (slug) { return rpc('cust_orders', { p_token: tok(), p_restaurant: slug }); },
    track: function (id, track) { return rpc('track_order', { p_id: id, p_token: track }); },
    attach: function (order, track) { if (!tok()) return Promise.resolve(null); return rpc('cust_attach_order', { p_token: tok(), p_order: order, p_track: track }).then(function (r) { pushAfterOrder(); return r; }); },
    push: { supported: pushOk, enable: pushEnable, afterOrder: pushAfterOrder, state: function () { return pushOk() ? Notification.permission : 'unsupported'; } },
    logout: function () { var t = tok(); setTok(''); fire(); return t ? rpc('cust_logout', { p_token: t }).catch(function () {}) : Promise.resolve(); },
    staff: {
      card: function (slug, code) { return rpc('staff_card', { p_restaurant: slug, p_code: code }); },
      stamp: function (slug, code, n, amount) { return rpc('staff_stamp', { p_restaurant: slug, p_code: code, p_count: n || 1, p_amount: amount == null ? null : amount }); },
      redeem: function (slug, code, reward) { return rpc('staff_redeem', { p_restaurant: slug, p_code: code, p_reward: reward || null }); }
    }
  };
})();
