/* sell-up: prawdziwa kuchnia demo w każdym demie.
   Zakładka „Kuchnia” przy lewej krawędzi. Pokazuje na żywo zamówienia złożone w tym demie
   (dane klientów zamaskowane w bazie) i pozwala zmieniać statusy, które klient widzi u siebie. */
(function () {
  if (window.__sellupKitchen) return; window.__sellupKitchen = 1;
  var SB = 'https://medldonrwgoxfryandbp.supabase.co',
      KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1lZGxkb25yd2dveGZyeWFuZGJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ0MjQ5OTYsImV4cCI6MjExMDAwMDk5Nn0.F4S0Wv3PXhb3ii5IQWsOuNZwSYq84Dnf3diAvfTcY20';
  var page = (location.pathname.split('/').filter(Boolean)[0] || '');
  var MAP = { 'kebab': ['zar'], 'pizza': ['forno450'], 'dym-burger': ['dym-burger'], 'obiady-domowe': ['obiady-domowe'], 'razem': ['forno450', 'zar'] };
  var SLUGS = MAP[page]; if (!SLUGS) return;
  var COOK = { pizza: ['W piecu', 'Do pieca'], kebab: ['Kroimy', 'Kroimy'], burger: ['Na grillu', 'Na grill'], obiady: ['Gotujemy', 'Gotujemy'] };
  var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var zl = function (n) { return Number(n).toFixed(2).replace('.', ',') + ' zł'; };
  function rpc(fn, body) {
    return fetch(SB + '/rest/v1/rpc/' + fn, { method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error((j && j.message) || 'Błąd'); return j; }); });
  }
  var css = '' +
    '.suk-tab{position:fixed;right:0;top:calc(50% + 195px);z-index:2147483000;transform:translateY(-50%);writing-mode:vertical-rl;rotate:180deg;font:700 12px/1 system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#1a0d05;background:#ffb15c;border:0;border-radius:0 12px 12px 0;padding:14px 9px;cursor:pointer;box-shadow:0 6px 22px rgba(0,0,0,.35);opacity:.94;transition:opacity .2s,padding .2s}' +
    '.suk-tab:hover{opacity:1;padding-right:13px}.suk-tab b{display:inline-block;rotate:180deg;margin-bottom:6px;min-width:18px;height:18px;line-height:18px;text-align:center;border-radius:99px;background:#d6331f;color:#fff;font-size:11px;letter-spacing:0}' +
    '.suk-tab.ring{animation:sukr 1s ease 3}@keyframes sukr{50%{box-shadow:0 0 0 8px rgba(255,177,92,.45),0 6px 22px rgba(0,0,0,.35)}}' +
    '.suk{position:fixed;inset:0;z-index:2147483002;background:#0f0f0f;color:#f2f2f2;font:15px/1.35 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;display:flex;flex-direction:column;opacity:0;visibility:hidden;transition:opacity .25s,visibility .25s;color-scheme:dark}' +
    '.suk.on{opacity:1;visibility:visible}.suk *{box-sizing:border-box}' +
    '.suk-top{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:12px 16px;padding-top:calc(12px + env(safe-area-inset-top,0px));background:#151515;border-bottom:1px solid #2c2c2c}' +
    '.suk-top h2{margin:0;font-size:19px;font-weight:800}.suk-top h2 small{color:#9a9a9a;font-weight:500;margin-left:6px;font-size:14px}' +
    '.suk-live{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;color:#7fd17a}.suk-live i{width:9px;height:9px;border-radius:50%;background:#7fd17a;box-shadow:0 0 8px #7fd17a}' +
    '.suk-r{margin-left:auto;display:flex;gap:8px;align-items:center}.suk-r button{padding:9px 14px;border-radius:99px;border:0;background:#2a2a2a;color:#f2f2f2;font:700 13px system-ui,sans-serif;cursor:pointer}' +
    '.suk-body{flex:1;display:flex;gap:12px;padding:12px 16px;overflow:auto;align-items:flex-start}' +
    '.suk-qr{flex:none;width:220px;background:#171717;border-radius:16px;padding:16px;text-align:center;position:sticky;top:0}.suk-qr p{margin:0 0 10px;font-size:13.5px;color:#cfcfcf}.suk-qr b{color:#ffb15c}.suk-qr .q{background:#fff;border-radius:12px;padding:10px;display:inline-block}' +
    '@media(max-width:900px){.suk-qr{display:none}}' +
    '.suk-board{flex:1;display:grid;grid-template-columns:repeat(4,minmax(230px,1fr));gap:12px;align-items:start;min-width:0}' +
    '@media(max-width:1100px){.suk-board{grid-template-columns:repeat(4,80vw);overflow-x:auto;scroll-snap-type:x mandatory}.suk-col{scroll-snap-align:start}}' +
    '.suk-col{background:#171717;border-radius:16px;padding:10px;display:flex;flex-direction:column;gap:10px;min-height:50vh}' +
    '.suk-col h3{margin:2px 4px;font-size:13px;letter-spacing:.1em;text-transform:uppercase;display:flex;justify-content:space-between}' +
    '.suk-col[data-st=new] h3{color:#ffb15c}.suk-col[data-st=cooking] h3{color:#ff7a3d}.suk-col[data-st=ready] h3{color:#7fd17a}.suk-col[data-st=delivering] h3{color:#6cb6ff}' +
    '.suk-empty{color:#666;font-size:13px;text-align:center;padding:22px 8px;line-height:1.5}' +
    '.suk-card{background:#202020;border-radius:14px;padding:12px;border-left:5px solid #444;display:flex;flex-direction:column;gap:8px}' +
    '.suk-card[data-st=new]{border-left-color:#ffb15c}.suk-card[data-st=cooking]{border-left-color:#ff7a3d}.suk-card[data-st=ready]{border-left-color:#7fd17a}.suk-card[data-st=delivering]{border-left-color:#6cb6ff}' +
    '.suk-card.flash{animation:sukf 1s ease 5}@keyframes sukf{50%{background:#4a2f12}}' +
    '.suk-h{display:flex;justify-content:space-between;align-items:baseline}.suk-h b{font-size:24px}.suk-h span{font-size:13px;color:#9a9a9a}' +
    '.suk-meta{display:flex;gap:6px;flex-wrap:wrap;font-size:12.5px}.suk-meta span{background:#2a2a2a;border-radius:7px;padding:3px 8px;color:#d0d0d0}.suk-meta .k{background:#3b3b3b;color:#fff;font-weight:700}.suk-meta .pk{background:#24321f;color:#a9e39b}.suk-meta .dl{background:#1f2a36;color:#9fcbff}' +
    '.suk-items{list-style:none;margin:0;padding:0;display:grid;gap:6px}.suk-items li{display:grid;grid-template-columns:auto 1fr;gap:8px;font-size:15px}.suk-items small{display:block;color:#bcbcbc;font-size:12.5px;margin-top:2px}' +
    '.suk-note{background:#3a2a17;color:#ffd9a8;border-radius:8px;padding:6px 9px;font-size:13px}.suk-grp{background:#2b2140;color:#d9c8ff;border-radius:8px;padding:6px 9px;font-size:13px;font-weight:600}' +
    '.suk-tot{display:flex;justify-content:space-between;font-size:13.5px;color:#9a9a9a}.suk-tot b{color:#f2f2f2}' +
    '.suk-act button{width:100%;padding:13px;border-radius:10px;border:0;font:800 15px system-ui,sans-serif;cursor:pointer;background:#ffb15c;color:#1a0d05}.suk-act button.r{background:#7fd17a;color:#0b1a0a}.suk-act button.d{background:#6cb6ff;color:#04121f}.suk-act button:disabled{opacity:.5}' +
    '.suk-hint{padding:0 16px 12px;color:#8a8a8a;font-size:12.5px}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  var tab = document.createElement('button'); tab.type = 'button'; tab.className = 'suk-tab'; tab.innerHTML = 'Kuchnia';
  var ov = document.createElement('div'); ov.className = 'suk'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Kuchnia demo');
  ov.innerHTML = '<div class="suk-top"><h2>Kuchnia <small class="suk-n"></small></h2><span class="suk-live"><i></i>na żywo</span>' +
    '<div class="suk-r"><button type="button" class="suk-snd">🔔 Dźwięk</button><button type="button" class="suk-x">✕ Wróć do strony</button></div></div>' +
    '<div class="suk-body"><div class="suk-qr"><p><b>Zamów z telefonu</b> i zobacz, jak zamówienie wpada tutaj z dzwonkiem.</p><div class="q"></div><p style="margin:10px 0 0;font-size:12px;color:#8a8a8a">Tak wygląda ekran kuchni u Ciebie w lokalu.</p></div><div class="suk-board"></div></div>' +
    '<div class="suk-hint">Kuchnia demonstracyjna: widać tu zamówienia złożone w tym demie, numery telefonów są ukryte. Zmiana statusu od razu pokazuje się klientowi na telefonie.</div>';
  function add() { document.body.appendChild(tab); document.body.appendChild(ov); }
  if (document.body) add(); else document.addEventListener('DOMContentLoaded', add);
  var q = function (s) { return ov.querySelector(s); };
  var orders = [], seen = null, sound = true, ac = null, timer = null, open = false, busy = {};
  function ding() {
    if (!sound) return;
    try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume();
      [[880, 0], [1320, .18], [880, .5], [1320, .68]].forEach(function (x) { var o = ac.createOscillator(), g = ac.createGain(); o.type = 'triangle'; o.frequency.value = x[0];
        g.gain.setValueAtTime(0, ac.currentTime + x[1]); g.gain.linearRampToValueAtTime(.35, ac.currentTime + x[1] + .02); g.gain.exponentialRampToValueAtTime(.001, ac.currentTime + x[1] + .4);
        o.connect(g).connect(ac.destination); o.start(ac.currentTime + x[1]); o.stop(ac.currentTime + x[1] + .45); }); } catch (e) {}
  }
  var mins = function (t) { var m = Math.max(0, Math.floor((Date.now() - new Date(t)) / 60000)); return m < 1 ? 'teraz' : m + ' min'; };
  function card(o) {
    var c = COOK[o.module] || ['W przygotowaniu', 'Przyjmij'];
    var items = (o.items || []).map(function (i) {
      var sub = [i.variant, i.label, (i.options || []).map(function (x) { return x.name.toLowerCase() + (x.qty > 1 ? ' ×' + x.qty : ''); }).join(', '), i.note ? '„' + i.note + '”' : ''].filter(Boolean).map(esc).join(' · ');
      return '<li><b>' + i.qty + '×</b><span>' + esc(i.name) + (sub ? '<small>' + sub + '</small>' : '') + '</span></li>'; }).join('');
    var act = '';
    if (o.status === 'new') act = '<button data-id="' + o.id + '" data-to="cooking">' + c[1] + '</button>';
    if (o.status === 'cooking') act = '<button class="r" data-id="' + o.id + '" data-to="ready">Gotowe, pakuj</button>';
    if (o.status === 'ready') act = o.mode === 'delivery' ? '<button class="d" data-id="' + o.id + '" data-to="delivering">Kierowca wziął</button>' : '<button class="r" data-id="' + o.id + '" data-to="done">Wydane klientowi</button>';
    if (o.status === 'delivering') act = '<button class="r" data-id="' + o.id + '" data-to="done">Dostarczone</button>';
    var grp = o.group_number ? '<div class="suk-grp">🔗 Wspólne zamówienie W' + o.group_number + ((o.group_parts || []).length ? ' · razem z: ' + o.group_parts.map(function (p) { return esc(p.name) + ' #' + esc(p.number); }).join(', ') : '') + '</div>' : '';
    return '<div class="suk-card' + (o._flash ? ' flash' : '') + '" data-st="' + o.status + '"><div class="suk-h"><b>#' + o.number + '</b><span data-t="' + o.created_at + '">' + mins(o.created_at) + '</span></div>' +
      '<div class="suk-meta">' + (SLUGS.length > 1 ? '<span class="k">' + esc(o.kitchen) + '</span>' : '') + '<span class="' + (o.mode === 'delivery' ? 'dl' : 'pk') + '">' + (o.mode === 'delivery' ? 'Dostawa' + (o.street ? ': ' + esc(o.street) : '') : 'Odbiór') + '</span><span>' + esc(o.name) + '</span><span>' + esc(o.phone) + '</span></div>' +
      grp + '<ul class="suk-items">' + items + '</ul>' + (o.note ? '<div class="suk-note">' + esc(o.note) + '</div>' : '') +
      '<div class="suk-tot"><span>' + (o.payment === 'cash' ? 'Gotówka' : o.payment === 'card_on_delivery' ? 'Karta przy odbiorze' : 'Online') + '</span><b>' + zl(o.total) + '</b></div><div class="suk-act">' + act + '</div></div>';
  }
  function render() {
    var mod = (orders[0] && orders[0].module) || ({ kebab: 'kebab', pizza: 'pizza', 'dym-burger': 'burger', 'obiady-domowe': 'obiady' }[page]);
    var cols = [['new', 'Nowe'], ['cooking', (COOK[mod] || ['W przygotowaniu'])[0]], ['ready', 'Gotowe do wydania'], ['delivering', 'W drodze']];
    if (SLUGS.length > 1) cols[1][1] = 'W przygotowaniu';
    q('.suk-board').innerHTML = cols.map(function (cl) { var l = orders.filter(function (o) { return o.status === cl[0]; });
      return '<div class="suk-col" data-st="' + cl[0] + '"><h3>' + cl[1] + '<b>' + l.length + '</b></h3>' + (l.map(card).join('') || (cl[0] === 'new' ? '<div class="suk-empty">Brak nowych zamówień.<br>Złóż zamówienie na tej stronie albo zeskanuj kod telefonem. Pojawi się tu po kilku sekundach.</div>' : '<div class="suk-empty">—</div>')) + '</div>'; }).join('');
    orders.forEach(function (o) { o._flash = false; });
  }
  function badge() { var n = orders.filter(function (o) { return o.status === 'new'; }).length; tab.innerHTML = (n ? '<b>' + n + '</b>' : '') + 'Kuchnia'; }
  function load() {
    return rpc('demo_kitchen', { p_slugs: SLUGS }).then(function (list) {
      var ids = {}; orders.forEach(function (o) { ids[o.id] = 1; });
      var fresh = (list || []).filter(function (o) { return !ids[o.id] && o.status === 'new'; });
      if (seen !== null && fresh.length) { fresh.forEach(function (o) { o._flash = true; }); ding(); tab.classList.remove('ring'); void tab.offsetWidth; tab.classList.add('ring'); }
      orders = (list || []).filter(function (o) { return o.status !== 'done'; });
      orders.forEach(function (o) { if (fresh.some(function (f) { return f.id === o.id; })) o._flash = seen !== null; });
      seen = 1; badge(); if (open) render();
    }).catch(function () {});
  }
  function schedule() { clearTimeout(timer); timer = setTimeout(function () { load().then(schedule); }, open ? 3000 : 12000); }
  load().then(schedule);
  function qr() {
    var box = q('.q'); if (box.childNodes.length) return;
    var make = function () { try { new QRCode(box, { text: location.origin + location.pathname, width: 168, height: 168, colorDark: '#000000', colorLight: '#ffffff' }); } catch (e) {} };
    if (window.QRCode) return make();
    var s = document.createElement('script'); s.src = '/bulkaikromka/qrcode.min.js'; s.onload = make; document.head.appendChild(s);
  }
  tab.addEventListener('click', function () {
    open = true; ov.classList.add('on'); document.documentElement.style.overflow = 'hidden'; tab.classList.remove('ring');
    q('.suk-n').textContent = SLUGS.length > 1 ? 'Pizza + Kebab' : ((orders[0] && orders[0].kitchen) || document.title);
    render(); qr(); load().then(schedule);
    try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); ac.resume(); } catch (e) {}
  });
  q('.suk-x').addEventListener('click', function () { open = false; ov.classList.remove('on'); document.documentElement.style.overflow = ''; schedule(); });
  q('.suk-snd').addEventListener('click', function () { sound = !sound; this.textContent = sound ? '🔔 Dźwięk' : '🔕 Cisza'; if (sound) ding(); });
  q('.suk-board').addEventListener('click', function (e) {
    var b = e.target.closest('[data-to]'); if (!b || busy[b.dataset.id]) return;
    busy[b.dataset.id] = 1; b.disabled = true;
    rpc('demo_set_status', { p_id: b.dataset.id, p_status: b.dataset.to }).then(function () {
      var o = orders.find(function (x) { return x.id === b.dataset.id; }); if (o) { o.status = b.dataset.to; if (o.status === 'done') orders = orders.filter(function (x) { return x !== o; }); }
      delete busy[b.dataset.id]; badge(); render();
    }).catch(function (er) { delete busy[b.dataset.id]; b.disabled = false; alert(er.message); });
  });
  setInterval(function () { if (open) ov.querySelectorAll('[data-t]').forEach(function (el) { el.textContent = mins(el.dataset.t); }); }, 20000);
})();
