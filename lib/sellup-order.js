/* Sell-UP: wspólne okno „Dane do zamówienia” + wysyłka do bazy + śledzenie statusu.
   Użycie: SellUpOrder.open({ slug, mode, chooseMode, total(mode), items, phone, onSuccess(srv, mode) })
           SellUpOrder.track(id, token, status => ...)  → zwraca funkcję zatrzymującą */
(function () {
  const C = window.SELLUP, sb = window.supabase.createClient(C.url, C.key);
  const css = `
.suo-wrap{position:fixed;inset:0;z-index:2000;display:grid;place-items:end center;background:rgba(0,0,0,.6);opacity:0;transition:opacity .25s;font-family:inherit}
.suo-wrap.show{opacity:1}
.suo{width:min(520px,100%);max-height:94vh;overflow:auto;background:var(--suo-bg,#1b1916);color:var(--suo-fg,#f4ede2);border-radius:24px 24px 0 0;padding:20px 20px calc(18px + env(safe-area-inset-bottom,0px));transform:translateY(40px);transition:transform .3s cubic-bezier(.2,.9,.25,1);box-shadow:0 -20px 60px rgba(0,0,0,.5)}
.suo-wrap.show .suo{transform:none}
@media (min-width:700px){.suo-wrap{place-items:center}.suo{border-radius:24px}}
.suo h2{margin:0 0 14px;font-size:26px;line-height:1.1}
.suo .x{float:right;width:36px;height:36px;border-radius:50%;border:0;background:rgba(255,255,255,.1);color:inherit;font-size:17px;cursor:pointer}
.suo label{display:flex;flex-direction:column;gap:6px;margin:0 0 12px}
.suo label span{font-size:12px;letter-spacing:.07em;text-transform:uppercase;opacity:.65;font-weight:700}
.suo input{font:inherit;font-size:16px;color:inherit;background:rgba(255,255,255,.07);border:1.5px solid rgba(255,255,255,.14);border-radius:12px;padding:13px 14px}
.suo input:focus{outline:none;border-color:var(--suo-accent,#ff6a1f)}
.suo label.bad input{border-color:#ff5d5d}
.suo .seg{display:grid;grid-template-columns:1fr 1fr;background:rgba(255,255,255,.07);border-radius:99px;padding:4px;margin:0 0 12px}
.suo .seg button{padding:10px;border-radius:99px;border:0;background:none;color:inherit;font:inherit;font-weight:700;opacity:.6;cursor:pointer}
.suo .seg button[aria-pressed="true"]{background:rgba(255,255,255,.14);opacity:1}
.suo .lbl{font-size:12px;letter-spacing:.07em;text-transform:uppercase;opacity:.65;font-weight:700;margin:6px 0 8px}
.suo .tot{display:flex;justify-content:space-between;font-weight:800;font-size:18px;padding-top:10px;border-top:1px solid rgba(255,255,255,.12);margin-top:6px}
.suo .tot small{display:block;font-weight:500;font-size:12px;opacity:.6}
.suo .err{color:#ff8a8a;font-weight:600;min-height:1.2em;margin:10px 0 0}
.suo .go{width:100%;margin-top:12px;padding:16px;border-radius:99px;border:0;background:var(--suo-accent,#ff6a1f);color:var(--suo-accent-fg,#fff);font:inherit;font-weight:800;font-size:16px;cursor:pointer}
.suo .go:disabled{opacity:.5}
.suo .fine{font-size:12px;opacity:.55;margin:10px 0 0;text-align:center}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  const zl = n => Number(n).toFixed(2).replace('.', ',') + ' zł';
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function open(o) {
    let mode = o.mode || 'delivery', pay = 'cash', busy = false;
    const saved = (() => { try { return JSON.parse(localStorage.getItem('sellup-dane') || '{}'); } catch (e) { return {}; } })();
    const w = document.createElement('div'); w.className = 'suo-wrap';
    w.innerHTML = `<form class="suo" novalidate>
      <button type="button" class="x" aria-label="Zamknij">✕</button>
      <h2>Dane do zamówienia</h2>
      ${o.chooseMode ? `<div class="seg" data-g="mode"><button type="button" data-v="delivery">Dostawa</button><button type="button" data-v="pickup">Odbiór osobisty</button></div>` : ''}
      <label><span>Imię</span><input name="n" autocomplete="given-name" maxlength="80" value="${esc(saved.n)}"></label>
      <label><span>Telefon</span><input name="p" type="tel" inputmode="tel" autocomplete="tel" maxlength="20" placeholder="np. 500 600 700" value="${esc(saved.p)}"></label>
      <label class="addr"><span>Adres dostawy</span><input name="a" autocomplete="street-address" maxlength="200" placeholder="ulica, numer, mieszkanie, miasto" value="${esc(saved.a)}"></label>
      <label><span>Uwagi (opcjonalnie)</span><input name="t" maxlength="300" placeholder="np. kod do domofonu, bez cebuli"></label>
      <div class="lbl">Płatność przy odbiorze</div>
      <div class="seg" data-g="pay"><button type="button" data-v="cash">Gotówka</button><button type="button" data-v="card_on_delivery">Karta</button></div>
      <div class="tot"><span>Do zapłaty<small class="dl"></small></span><span class="sum"></span></div>
      <p class="err"></p>
      <button class="go" type="submit">Zamawiam</button>
      <p class="fine">Zamówienie trafia od razu do kuchni. Status zobaczysz na następnym ekranie.</p>
    </form>`;
    document.body.appendChild(w); document.body.style.overflow = 'hidden';
    const f = w.querySelector('form'), q = s => f.querySelector(s);
    const paint = () => {
      f.querySelectorAll('[data-g="mode"] button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === mode));
      f.querySelectorAll('[data-g="pay"] button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === pay));
      q('.addr').hidden = mode !== 'delivery';
      const t = o.total(mode); q('.sum').textContent = zl(t.total); q('.dl').textContent = mode === 'delivery' ? (t.del ? 'w tym dostawa ' + zl(t.del) : 'dostawa gratis') : 'odbiór osobisty';
    };
    f.querySelectorAll('[data-g] button').forEach(b => b.onclick = () => { if (b.parentNode.dataset.g === 'mode') mode = b.dataset.v; else pay = b.dataset.v; paint(); });
    const close = () => { w.classList.remove('show'); document.body.style.overflow = ''; setTimeout(() => w.remove(), 250); };
    q('.x').onclick = close; w.addEventListener('click', e => { if (e.target === w) close(); });
    paint(); requestAnimationFrame(() => w.classList.add('show'));
    setTimeout(() => (q('[name=n]').value ? q('[name=p]') : q('[name=n]')).focus(), 300);
    f.onsubmit = async e => {
      e.preventDefault(); if (busy) return;
      const n = q('[name=n]').value.trim(), p = q('[name=p]').value.trim(), a = q('[name=a]').value.trim(), t = q('[name=t]').value.trim();
      f.querySelectorAll('label').forEach(l => l.classList.remove('bad'));
      const bad = !n ? 'n' : !/^[0-9 +()-]{9,20}$/.test(p) ? 'p' : (mode === 'delivery' && a.length < 5) ? 'a' : null;
      if (bad) { const i = q(`[name=${bad}]`); i.closest('label').classList.add('bad'); i.focus(); q('.err').textContent = { n: 'Podaj imię', p: 'Podaj poprawny numer telefonu', a: 'Podaj adres dostawy' }[bad]; return; }
      busy = true; q('.go').disabled = true; q('.go').textContent = 'Wysyłam…'; q('.err').textContent = '';
      const { data, error } = await sb.rpc('place_order', { p_restaurant: o.slug, p_items: o.items, p_mode: mode, p_name: n, p_phone: p, p_address: mode === 'delivery' ? a : null, p_note: t || null, p_payment: pay });
      busy = false; q('.go').disabled = false; q('.go').textContent = 'Zamawiam';
      if (error) { q('.err').textContent = (error.message || 'Nie udało się wysłać zamówienia') + (o.phone ? '. Możesz też zadzwonić: ' + o.phone : ''); return; }
      try { localStorage.setItem('sellup-dane', JSON.stringify({ n, p, a })); localStorage.setItem('sellup-last-' + o.slug, JSON.stringify({ id: data.id, t: data.track_token, no: data.number, mode, at: Date.now() })); } catch (e2) {}
      close(); o.onSuccess(data, mode);
    };
  }
  function track(id, token, cb) {
    let last = null; const tick = async () => { const { data } = await sb.rpc('track_order', { p_id: id, p_token: token }); if (data && data.status !== last) { last = data.status; cb(last, data); if (['done', 'cancelled'].includes(last)) clearInterval(t); } };
    const t = setInterval(tick, 8000); tick(); return () => clearInterval(t);
  }
  function last(slug) { try { const l = JSON.parse(localStorage.getItem('sellup-last-' + slug) || 'null'); return l && Date.now() - l.at < 3 * 3600e3 ? l : null; } catch (e) { return null; } }
  async function isOpen(slug) { const { data } = await sb.from('restaurants').select('is_open').eq('slug', slug).maybeSingle(); return !data || data.is_open; }
  function closedBar(show) { let b = document.getElementById('suoClosed'); if (show && !b) { b = document.createElement('div'); b.id = 'suoClosed'; b.style.cssText = 'position:relative;z-index:1500;background:#7d2f2f;color:#fff;text-align:center;font-weight:700;padding:10px 16px'; b.textContent = 'Teraz nie przyjmujemy zamówień online. Zapraszamy później!'; document.body.prepend(b); } if (!show && b) b.remove(); }
  window.SellUpOrder = { open, track, last, isOpen, closedBar, zl };
})();
