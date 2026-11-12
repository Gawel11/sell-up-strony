/* sell-up: delikatne „Chcesz taką aplikację?” w demach.
   Pionowa zakładka przy prawej krawędzi, po ~25 s jedno mrugnięcie z dymkiem.
   Kliknięcie otwiera krótki formularz, zgłoszenie trafia do bazy (submit_lead). */
(function () {
  if (window.__sellupLead) return; window.__sellupLead = 1;
  var SB = 'https://medldonrwgoxfryandbp.supabase.co',
      KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1lZGxkb25yd2dveGZyeWFuZGJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ0MjQ5OTYsImV4cCI6MjExMDAwMDk5Nn0.F4S0Wv3PXhb3ii5IQWsOuNZwSYq84Dnf3diAvfTcY20';
  var demo = (location.pathname.split('/').filter(Boolean)[0] || 'demo');
  var CONSENT = 'Zgadzam się na kontakt telefoniczny i e-mailowy w sprawie oferty sell-up.pl. Dane służą tylko do odpowiedzi na to zgłoszenie. W każdej chwili mogę poprosić o ich usunięcie.';
  var css = '' +
    '.sul-tab{position:fixed;right:0;top:50%;z-index:2147483000;transform:translateY(-50%);writing-mode:vertical-rl;rotate:180deg;font:700 12px/1 system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#070908;background:linear-gradient(180deg,#b9ff2e,#3cf0b4);border:0;border-radius:0 12px 12px 0;padding:16px 9px;cursor:pointer;box-shadow:0 6px 22px rgba(0,0,0,.35);opacity:.92;transition:opacity .2s,padding .2s}' +
    '.sul-tab:hover{opacity:1;padding-right:13px}' +
    '.sul-tab.pulse{animation:sulp 1.4s ease 2}@keyframes sulp{50%{box-shadow:0 0 0 8px rgba(185,255,46,.35),0 6px 22px rgba(0,0,0,.35)}}' +
    '.sul-tip{position:fixed;right:44px;top:50%;transform:translate(8px,-50%);z-index:2147483000;max-width:220px;background:#070908;color:#f2f7ea;font:500 13.5px/1.35 system-ui,sans-serif;padding:11px 14px;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.4);opacity:0;pointer-events:none;transition:all .4s}' +
    '.sul-tip.on{opacity:1;transform:translate(0,-50%)}' +
    '.sul-ov{position:fixed;inset:0;z-index:2147483001;background:rgba(5,7,6,.6);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);display:flex;align-items:flex-end;justify-content:center;opacity:0;visibility:hidden;transition:all .3s}' +
    '.sul-ov.on{opacity:1;visibility:visible}' +
    '.sul-box{width:100%;max-width:440px;background:#0d110e;color:#f2f7ea;border-radius:24px 24px 0 0;padding:22px 20px calc(22px + env(safe-area-inset-bottom,0px));font:15px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;box-shadow:0 -10px 40px rgba(0,0,0,.5);transform:translateY(30px);transition:transform .35s;position:relative}' +
    '.sul-ov.on .sul-box{transform:none}@media(min-width:600px){.sul-ov{align-items:center}.sul-box{border-radius:24px}}' +
    '.sul-box h3{margin:0 0 6px;font:800 22px/1.15 system-ui,sans-serif;color:#b9ff2e}.sul-box p{margin:0 0 14px;color:#b9c6ad;font-size:14px}' +
    '.sul-box input{display:block;width:100%;box-sizing:border-box;margin:0 0 10px;padding:13px 14px;border-radius:12px;border:0;background:rgba(242,247,234,.07);color:#f2f7ea;font:16px system-ui,sans-serif;box-shadow:inset 0 0 0 1px rgba(242,247,234,.16);outline:none}' +
    '.sul-box input:focus{box-shadow:inset 0 0 0 2px #b9ff2e}' +
    '.sul-box label{display:flex;gap:10px;align-items:flex-start;font-size:12.5px;color:#a9b79c;margin:4px 0 12px;cursor:pointer}.sul-box label input{width:20px;height:20px;flex:none;margin:1px 0 0;accent-color:#b9ff2e}' +
    '.sul-box button.go{width:100%;height:50px;border:0;border-radius:999px;background:#b9ff2e;color:#070908;font:800 16px system-ui,sans-serif;cursor:pointer}' +
    '.sul-x{position:absolute;right:14px;top:14px;width:36px;height:36px;border-radius:50%;border:0;background:rgba(242,247,234,.1);color:#f2f7ea;font:700 16px system-ui;cursor:pointer}' +
    '.sul-err{color:#ff8a6b;font-size:13px;min-height:1em;margin:0 0 8px;font-weight:700}' +
    '.sul-ph{position:relative;display:flex!important;align-items:center;gap:10px;margin:0 0 10px!important;padding:12px 14px;border-radius:12px;background:rgba(242,247,234,.07);box-shadow:inset 0 0 0 1px rgba(242,247,234,.16);color:#f2f7ea!important;font-size:14px!important;cursor:pointer}' +
    '.sul-ph input{position:absolute;inset:0;opacity:0;width:100%!important;height:100%!important;margin:0!important;cursor:pointer}.sul-ph small{display:block;color:#9fb08f;font-size:12px}.sul-ph img{width:46px;height:46px;object-fit:cover;border-radius:8px;margin-left:auto}' +
    '.sul-hp{position:absolute;left:-9999px;width:1px;height:1px;opacity:0}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  var tab = document.createElement('button'); tab.className = 'sul-tab'; tab.type = 'button'; tab.textContent = 'Chcesz taką aplikację?';
  var tip = document.createElement('div'); tip.className = 'sul-tip'; tip.textContent = 'Taka aplikacja dla Twojego lokalu? Zostaw numer, oddzwonimy.';
  var ov = document.createElement('div'); ov.className = 'sul-ov';
  ov.innerHTML = '<div class="sul-box" role="dialog" aria-modal="true" aria-label="Chcesz taką aplikację?"><button class="sul-x" type="button" aria-label="Zamknij">✕</button>' +
    '<div class="sul-form"><h3>Chcesz taką aplikację?</h3><p>Zrobimy podgląd z Twoim menu i logo. Rozmawiamy tylko z właścicielami lokali, dlatego prosimy o NIP i zdjęcie lokalu.</p>' +
    '<input name="name" placeholder="Imię" maxlength="80" autocomplete="given-name"><input name="venue" placeholder="Nazwa lokalu" maxlength="120" autocomplete="organization">' +
    '<input name="nip" inputmode="numeric" placeholder="NIP lokalu *" maxlength="13" autocomplete="off">' +
    '<label class="sul-ph"><input name="photo" type="file" accept="image/*"><span>📷 Zdjęcie lokalu * <small>szyld, wejście albo wnętrze</small></span><img alt="" hidden></label>' +
    '<input name="phone" type="tel" inputmode="tel" placeholder="Telefon *" maxlength="20" autocomplete="tel"><input class="sul-hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">' +
    '<label><input type="checkbox" name="consent"><span>' + CONSENT + ' <a href="/prawne/polityka-prywatnosci.html" target="_blank" style="color:#b9ff2e">Polityka prywatności</a></span></label><div class="sul-err" role="alert"></div><button class="go" type="button">Wyślij</button>' +
    '</div>' +
    '<div class="sul-ok" style="display:none;text-align:center;padding:24px 0"><h3>Dziękujemy!</h3><p style="margin:0">Oddzwonimy najszybciej, jak to możliwe.</p></div></div>';
  function add() { document.body.appendChild(tab); document.body.appendChild(tip); document.body.appendChild(ov); }
  if (document.body) add(); else document.addEventListener('DOMContentLoaded', add);
  function open() { ov.classList.add('on'); tip.classList.remove('on'); }
  function close() { ov.classList.remove('on'); }
  tab.addEventListener('click', open);
  ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
  ov.querySelector('.sul-x').addEventListener('click', close);
  var shown = false; try { shown = sessionStorage.getItem('sulTip') === '1'; } catch (e) {}
  if (!shown) setTimeout(function () {
    if (ov.classList.contains('on')) return;
    tab.classList.add('pulse'); tip.classList.add('on');
    try { sessionStorage.setItem('sulTip', '1'); } catch (e) {}
    setTimeout(function () { tip.classList.remove('on'); }, 6000);
  }, 25000);
  function nipOk(v) { var d = String(v).replace(/\D/g, ''); if (d.length !== 10) return false; var w = [6,5,7,2,3,4,5,6,7], s = 0; for (var i = 0; i < 9; i++) s += d[i] * w[i]; s %= 11; return s !== 10 && s === +d[9]; }
  async function uploadPhoto(file) {
    var blob;
    try { var bm = await createImageBitmap(file); var k = Math.min(1, 1600 / Math.max(bm.width, bm.height)); var c = document.createElement('canvas'); c.width = Math.round(bm.width * k); c.height = Math.round(bm.height * k); c.getContext('2d').drawImage(bm, 0, 0, c.width, c.height); blob = await new Promise(function (r) { c.toBlob(r, 'image/jpeg', .82); }); }
    catch (e) { if (/^image\/(jpeg|png|webp)$/.test(file.type)) blob = file; else throw new Error('Nie udało się odczytać zdjęcia. Wybierz zdjęcie JPG lub PNG.'); }
    var ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg', path = 'leads/' + crypto.randomUUID() + '.' + ext;
    var r = await fetch(SB + '/storage/v1/object/lead-photos/' + path, { method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': blob.type || 'image/jpeg', 'x-upsert': 'false' }, body: blob });
    if (!r.ok) throw new Error('Nie udało się wysłać zdjęcia. Spróbuj ponownie.'); return path;
  }
  ov.querySelector('.sul-ph input').addEventListener('change', function () { var fl = this.files[0], im = ov.querySelector('.sul-ph img'); if (fl) { im.src = URL.createObjectURL(fl); im.hidden = false; } });
  var q = function (n) { return ov.querySelector('[name=' + n + ']'); }, err = ov.querySelector('.sul-err'), btn = ov.querySelector('.go');
  btn.addEventListener('click', async function () {
    err.textContent = '';
    if (q('website').value) return;
    var ph = q('phone').value.replace(/[^0-9+]/g, '');
    if (ph.length < 9) { err.textContent = 'Podaj numer telefonu (min. 9 cyfr).'; q('phone').focus(); return; }
    if (!nipOk(q('nip').value)) { err.textContent = 'Podaj poprawny NIP lokalu (10 cyfr).'; q('nip').focus(); return; }
    if (!q('photo').files[0]) { err.textContent = 'Dodaj zdjęcie lokalu.'; return; }
    if (!q('consent').checked) { err.textContent = 'Zaznacz zgodę na kontakt.'; return; }
    btn.disabled = true; btn.textContent = 'Wysyłam zdjęcie…';
    try {
      var path = await uploadPhoto(q('photo').files[0]); btn.textContent = 'Wysyłam…';
      var h = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };
      var r = await fetch(SB + '/rest/v1/rpc/submit_lead', { method: 'POST', headers: h, body: JSON.stringify({
        p_name: q('name').value || null, p_venue: q('venue').value || null, p_city: null, p_phone: ph, p_email: null,
        p_segment: demo, p_package: null, p_message: null, p_source: 'demo ' + demo, p_consent: true, p_consent_text: CONSENT, p_nip: q('nip').value.replace(/\D/g, ''), p_photo: path }) });
      var j = await r.json(); if (!r.ok) throw new Error(j && j.message ? j.message : 'Nie udało się wysłać.');
      fetch(SB + '/functions/v1/lead-mail', { method: 'POST', headers: h, body: JSON.stringify({ id: j }) }).catch(function () {});
      ov.querySelector('.sul-form').style.display = 'none'; ov.querySelector('.sul-ok').style.display = 'block';
    } catch (e) { err.textContent = e.message || 'Nie udało się wysłać.'; btn.disabled = false; btn.textContent = 'Wyślij'; }
  });
})();
