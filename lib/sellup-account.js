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
  function fire() { subs.forEach(function (f) { try { f(!!tok()); } catch (e) {} }); }

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
    '.sua-strip{display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:16px;background:rgba(127,127,127,.12);box-shadow:inset 0 0 0 1px rgba(127,127,127,.22);margin:0 0 14px;text-align:left;font-size:14px;line-height:1.35}' +
    '.sua-strip>div{flex:1;min-width:0}.sua-strip b{display:block;font-size:15px}.sua-strip span{opacity:.7;font-size:13px}' +
    '.sua-strip button{flex:none;padding:10px 14px;border-radius:99px;border:0;font:inherit;font-weight:800;font-size:13.5px;cursor:pointer;background:var(--sua-accent,#ff9a3c);color:var(--sua-accent-fg,#1d1209)}' +
    '.sua-strip button.g{background:rgba(127,127,127,.18);color:inherit;font-weight:700}' +
    '.sua .qrb{background:#fff;border-radius:18px;padding:14px;width:max-content;margin:6px auto 10px}.sua .qrb img,.sua .qrb canvas{display:block}' +
    '.sua .big{text-align:center;font-size:26px;font-weight:800;letter-spacing:.18em;margin:0 0 6px}.sua .ctr{text-align:center}' +
    '.sua .dots{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin:6px 0 10px}.sua .dots i{width:30px;height:30px;border-radius:50%;border:2px dashed rgba(127,127,127,.5)}' +
    '.sua .dots i.on{border:0;background:var(--sua-accent,#ff9a3c);box-shadow:0 0 12px var(--sua-accent,#ff9a3c)}' +
    '.sua .rw{background:rgba(120,210,120,.16);border-radius:14px;padding:10px 12px;font-weight:700;text-align:center;margin:0 0 10px}' +
    '.sua .pts{text-align:center;font-size:40px;font-weight:800;margin:4px 0}.sua .pts small{font-size:16px;opacity:.6}';
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
          setTok(j.token); fire(); close({ name: j.name, code: j.code });
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
        el.innerHTML = '<div class="sua-strip"><div><b>' + (m.name ? 'Cześć, ' + escH(m.name) + '!' : 'Jesteś zalogowany') + '</b><span>Karta na koncie · kod ' + escH(m.code) + '</span></div><button type="button" data-q>Pokaż kod</button><button type="button" class="g" data-out>Wyloguj</button></div>';
        o.onCard && o.onCard(m.card, m); return m;
      }).catch(function () { el.innerHTML = ''; o.onCard && o.onCard(null, null); });
    }
    el.onclick = function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if ('in' in b.dataset) login({ venue: o.venue }).then(draw).catch(function () {});
      if ('out' in b.dataset) window.SellUpAccount.logout().then(draw);
      if ('q' in b.dataset) window.SellUpAccount.me(o.slug).then(function (m) { showCode(m.code, o.venue); });
    };
    subs.push(function () { draw(); });
    return draw();
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
  window.SellUpAccount = {
    logged: function () { return !!tok(); },
    onChange: function (f) { subs.push(f); },
    login: login,
    open: open,
    strip: strip,
    showCode: showCode,
    me: function (slug) { return rpc('cust_me', { p_token: tok(), p_restaurant: slug || null }); },
    setName: function (n) { return rpc('cust_set_name', { p_token: tok(), p_name: n }); },
    favSave: function (slug, name, data) { return rpc('cust_fav_save', { p_token: tok(), p_restaurant: slug, p_name: name, p_data: data }); },
    favDel: function (id) { return rpc('cust_fav_delete', { p_token: tok(), p_id: id }); },
    placeOrder: function (slug, items, note) { return rpc('cust_place_order', { p_token: tok(), p_restaurant: slug, p_items: items, p_note: note || null }); },
    track: function (id, track) { return rpc('track_order', { p_id: id, p_token: track }); },
    attach: function (order, track) { return tok() ? rpc('cust_attach_order', { p_token: tok(), p_order: order, p_track: track }) : Promise.resolve(null); },
    logout: function () { var t = tok(); setTok(''); fire(); return t ? rpc('cust_logout', { p_token: t }).catch(function () {}) : Promise.resolve(); },
    staff: {
      card: function (slug, code) { return rpc('staff_card', { p_restaurant: slug, p_code: code }); },
      stamp: function (slug, code, n, amount) { return rpc('staff_stamp', { p_restaurant: slug, p_code: code, p_count: n || 1, p_amount: amount == null ? null : amount }); },
      redeem: function (slug, code, reward) { return rpc('staff_redeem', { p_restaurant: slug, p_code: code, p_reward: reward || null }); }
    }
  };
})();
