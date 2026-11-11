/* Sell-UP · panel restauratora */
const $ = s => document.querySelector(s);
const sb = supabase.createClient(SELLUP.url, SELLUP.key);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let shops = [], cur = null, items = [], tab = 'menu', booted = false;

/* ---------- gotowe propozycje (kebab) ---------- */
const PV = [ // składniki: [nazwa, kolor, cena]
  ['Ogórki konserwowe', '#9bbf3a', 0], ['Ogórki kiszone', '#7fa83a', 0], ['Ser żółty', '#ffc233', 3], ['Kukurydza', '#ffd23f', 0],
  ['Oliwki', '#2e2a25', 2], ['Czerwona kapusta', '#8a2b6e', 0], ['Papryka', '#e5412d', 0], ['Rukola', '#4c9a3c', 0],
  ['Pieczarki', '#cdb89a', 2], ['Ananas', '#f5d25a', 2], ['Jajko', '#f6efe0', 3], ['Bekon', '#b8443a', 4],
  ['Halloumi', '#f3e6b5', 4], ['Buraczki', '#7a1f3d', 0], ['Marchewka', '#f08a24', 0], ['Kiszona kapusta', '#cfd98a', 0],
  ['Czerwona cebula', '#a8326b', 0], ['Pomidorki koktajlowe', '#d6322a', 0], ['Groszek', '#7cc04a', 0], ['Pepperoni', '#c23b22', 2]
];
const PS = [ // sosy: [nazwa bez „Sos”, kolor]
  ['Serowy', '#ffcc4d'], ['BBQ', '#6b2e17'], ['Tzatziki', '#e9efe0'], ['Musztardowy', '#d9a521'], ['Curry', '#e0a800'], ['Słodkie chili', '#e5342a'],
  ['Majonezowy', '#f5f0e1'], ['Ketchup', '#c8261a'], ['Miętowy', '#cfe8c0'], ['Harissa', '#b3261e'], ['Pomidorowy', '#d6452b'], ['Ziołowy', '#eef0d8']
];
const PF = [ // formy: [nazwa, wygląd jak, cena]
  ['Kebab na talerzu', 'box', 32], ['Rollo 50 cm', 'wrap', 34], ['Bułka XXL', 'bun', 32]
];
const PD = [ // gotowe dania: nazwa, forma, mięso, porcje, składniki
  { name: 'Kebab Greko', form: 'wrap', meat: 'chicken', mp: 1, lada: { lettuce: 1, tomato: 1, cucumber: 1, feta: 1, oliwki: 1, tzatziki: 1 } },
  { name: 'Kebab Americano', form: 'bun', meat: 'beef', mp: 1, lada: { cabbage: 1, bekon: 1, ser_zolty: 1, kukurydza: 1, bbq: 1, ketchup: 1 } },
  { name: 'Kebab Hawajski', form: 'wrap', meat: 'chicken', mp: 1, lada: { lettuce: 1, ananas: 1, ser_zolty: 1, kukurydza: 1, serowy: 1 } }
];

/* ---------- narzędzia ---------- */
function toast(t, bad){ const e = $('#toast'); e.textContent = t; e.classList.toggle('bad', !!bad); e.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => e.classList.remove('show'), 1900); }
const n2 = v => String(Number(v)).replace('.', ',');
const pn = v => { const x = parseFloat(String(v).replace(',', '.')); return isFinite(x) && x >= 0 && x < 10000 ? Math.round(x * 100) / 100 : null; };
const slug = s => s.toLowerCase().replace(/ł/g, 'l').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 24);
const isKebab = () => cur && cur.module === 'kebab';
const kindOf = m => m.kind === 'product' ? (m.data && m.data.area ? 'form' : 'product')
  : m.kind === 'extra' ? 'extra'
  : (m.data && m.data.lada) ? m.data.lada.kind
  : (m.code.startsWith('meat_') && m.code !== 'meat_extra') ? 'meat' : 'opt';
const ladaIds = () => new Set(items.filter(m => m.data && m.data.lada).map(m => m.data.lada.id));
const hexOk = c => /^#[0-9a-f]{6}$/i.test(c || '');

/* ---------- logowanie ---------- */
$('#lf').onsubmit = async e => { e.preventDefault(); $('#lb').disabled = true; $('#le').textContent = '';
  const { error } = await sb.auth.signInWithPassword({ email: $('#em').value.trim(), password: $('#pw').value }); $('#lb').disabled = false;
  if (error) $('#le').textContent = 'Zły e-mail lub hasło'; };
$('#out').onclick = async () => { await sb.auth.signOut(); location.reload(); };
sb.auth.onAuthStateChange((ev, s) => { if (ev === 'SIGNED_IN' || ev === 'INITIAL_SESSION') s ? boot() : ($('#loginView').hidden = false); });
async function boot(){
  if (booted) return; booted = true; $('#loginView').hidden = true;
  const { data: staff } = await sb.from('restaurant_staff').select('role, restaurants(id, slug, name, module)').in('role', ['owner', 'manager']);
  shops = (staff || []).map(s => s.restaurants).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
  if (!shops.length){ booted = false; $('#loginView').hidden = false; $('#le').textContent = 'To konto nie ma dostępu do panelu (tylko właściciel lub manager).'; await sb.auth.signOut(); return; }
  $('#app').hidden = false;
  $('#rs').innerHTML = shops.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
  $('#rs').onchange = () => pick($('#rs').value);
  let last = null; try { last = localStorage.getItem('panel-shop'); } catch (e) {}
  await pick(shops.some(s => s.id === last) ? last : shops[0].id); $('#rs').value = cur.id;
}
async function load(){
  const [{ data: r }, { data: m }] = await Promise.all([
    sb.from('restaurants').select('is_open, phone, address, delivery_fee, free_delivery_from, min_order, settings').eq('id', cur.id).single(),
    sb.from('menu_items').select('id, kind, code, name, price, variants, data, active, sort').eq('restaurant_id', cur.id).order('sort')
  ]);
  cur.info = r; items = m || [];
}
async function pick(id){
  cur = shops.find(s => s.id === id); try { localStorage.setItem('panel-shop', id); } catch (e) {}
  $('#seeSite').href = '../' + cur.slug + '/';
  await load();
  const tabs = [['menu', 'Menu i ceny']]; if (isKebab()) tabs.push(['ready', 'Gotowe dania'], ['look', 'Wygląd']); tabs.push(['shop', 'Dane lokalu']);
  if (!tabs.some(t => t[0] === tab)) tab = 'menu';
  $('#tabs').innerHTML = tabs.map(([k, t]) => `<button class="tab" data-t="${k}" aria-pressed="${k === tab}">${t}</button>`).join('');
  $('#tabs').querySelectorAll('.tab').forEach(b => b.onclick = () => { tab = b.dataset.t; $('#tabs').querySelectorAll('.tab').forEach(x => x.setAttribute('aria-pressed', x === b)); render(); });
  render();
}
function render(){ if (!cur) return; ({ menu: renderMenu, ready: renderReady, look: renderLook, shop: renderShop })[tab](); }
async function saveSettings(patch){
  const s = { ...(cur.info.settings || {}), ...patch };
  const { error } = await sb.from('restaurants').update({ settings: s }).eq('id', cur.id);
  if (error){ toast('Nie zapisano: ' + error.message, true); return false; }
  cur.info.settings = s; return true;
}

/* ---------- menu ---------- */
function rowHTML(m){
  const v = m.variants || [], d = m.data || {};
  const price = v.length ? v.map(x => `<label>${esc(x.name)}<input inputmode="decimal" data-id="${m.id}" data-v="${esc(x.id)}" value="${n2(x.price)}"></label>`).join('') : `<label>zł<input inputmode="decimal" data-id="${m.id}" value="${n2(m.price)}"></label>`;
  return `<div class="row${m.active ? '' : ' off'}" data-row="${m.id}"><div class="nm">${hexOk(d.color) ? `<i class="dot" style="background:${d.color}"></i>` : ''}<span>${esc(m.name)}</span></div><div class="pr">${price}</div>${d.custom ? `<button class="x" data-del="${m.id}" title="Usuń">✕</button>` : ''}<button class="sw" data-sw="${m.id}" aria-pressed="${m.active}" aria-label="Dostępne"></button></div>`;
}
function renderMenu(){
  const vis = items.filter(m => !m.code.endsWith('_half'));
  let groups;
  if (isKebab()){
    const by = k => vis.filter(m => kindOf(m) === k);
    groups = [['Formy podania', by('form'), 'form'], ['Mięsa', by('meat')], ['Składniki', by('veg'), 'veg'], ['Sosy', by('sauce'), 'sauce'], ['Dodatki i napoje', by('extra'), 'extra'], ['Dopłaty za dodatkowe porcje', by('opt')]];
  } else groups = [['Dania', vis.filter(m => m.kind === 'product' && m.code !== 'custom')], ['Baza do kreatora', vis.filter(m => m.code === 'custom')], ['Składniki i opcje', vis.filter(m => m.kind === 'option')], ['Dodatki, napoje, desery', vis.filter(m => m.kind === 'extra')]];
  $('#main').innerHTML = '<p class="hint">Zmiany zapisują się od razu i są widoczne na stronie. Wyłącz przełącznik, gdy czegoś brakuje.</p>' +
    groups.filter(g => g[1].length || g[2]).map(([t, l, add]) => `<h3><span>${t}</span>${add ? `<button class="btn s" data-add="${add}">+ Dodaj</button>` : ''}</h3><div class="g2">${l.map(rowHTML).join('')}</div>`).join('');
  $('#main').querySelectorAll('.pr input').forEach(i => i.onchange = () => savePrice(i));
  $('#main').querySelectorAll('.sw').forEach(b => b.onclick = () => toggle(b));
  $('#main').querySelectorAll('[data-add]').forEach(b => b.onclick = () => openAdd(b.dataset.add));
  $('#main').querySelectorAll('[data-del]').forEach(b => b.onclick = () => { if (b.dataset.sure){ del(b.dataset.del); return; } b.dataset.sure = 1; b.textContent = '?'; b.title = 'Kliknij jeszcze raz, żeby usunąć'; setTimeout(() => { b.textContent = '✕'; delete b.dataset.sure; }, 2500); });
}
async function savePrice(i){
  const m = items.find(x => x.id === i.dataset.id), p = pn(i.value);
  if (p === null){ toast('Podaj poprawną cenę', true); renderMenu(); return; }
  let upd;
  if (i.dataset.v){ const vs = m.variants.map(v => v.id === i.dataset.v ? { ...v, price: p } : v); upd = { variants: vs, price: vs[0].price }; } else upd = { price: p };
  const { error } = await sb.from('menu_items').update(upd).eq('id', m.id);
  if (error){ toast('Nie zapisano: ' + error.message, true); return; }
  Object.assign(m, upd);
  const half = items.find(x => x.code === m.code + '_half');
  if (half && m.kind === 'option'){ const hv = m.variants.length ? m.variants.map(v => ({ ...v, price: Math.round(v.price * .6 * 2) / 2 })) : []; const hu = { variants: hv, price: hv.length ? hv[0].price : Math.round(m.price * .6 * 2) / 2 }; await sb.from('menu_items').update(hu).eq('id', half.id); Object.assign(half, hu); }
  i.value = n2(p); toast('Zapisano ✓');
}
async function toggle(b){
  const m = items.find(x => x.id === b.dataset.sw), on = !m.active;
  const ids = items.filter(x => x.id === m.id || x.code === m.code + '_half').map(x => x.id);
  const { error } = await sb.from('menu_items').update({ active: on }).in('id', ids);
  if (error){ toast('Nie zapisano: ' + error.message, true); return; }
  items.forEach(x => { if (ids.includes(x.id)) x.active = on; });
  b.setAttribute('aria-pressed', on); b.closest('.row').classList.toggle('off', !on); toast(on ? 'Włączone ✓' : 'Wyłączone ✓');
}
async function del(id){
  const { error } = await sb.from('menu_items').delete().eq('id', id);
  if (error){ toast('Nie usunięto: ' + error.message, true); return; }
  items = items.filter(x => x.id !== id); render(); toast('Usunięte ✓');
}

/* ---------- dodawanie pozycji (kebab) ---------- */
async function insertItem(row){
  const { data, error } = await sb.from('menu_items').insert({ restaurant_id: cur.id, max_qty: 3, active: true, variants: [], ...row }).select('id, kind, code, name, price, variants, data, active, sort').single();
  if (error) throw new Error(error.message);
  items.push(data); return data;
}
const nextSort = () => Math.max(0, ...items.map(m => m.sort || 0)) + 1;
function newVeg(name, color, price){
  const id = slug(name) || 'skladnik', ex = items.find(m => m.data && m.data.lada && m.data.lada.id === id);
  if (ex) return ex.active ? null : sb.from('menu_items').update({ active: true }).eq('id', ex.id).then(() => { ex.active = true; return ex; });
  return insertItem({ kind: 'option', code: id, name, price, sort: nextSort(), data: { lada: { id, kind: 'veg', size: 28, n: 3 }, color, custom: true } });
}
function newSauce(short, color){
  const id = slug(short) || 'sos', ex = items.find(m => m.data && m.data.lada && m.data.lada.id === id);
  if (ex) return ex.active ? null : sb.from('menu_items').update({ active: true }).eq('id', ex.id).then(() => { ex.active = true; return ex; });
  return insertItem({ kind: 'option', code: 'sauce_' + id, name: 'Sos ' + short.toLowerCase(), price: 0, sort: nextSort(), data: { lada: { id, kind: 'sauce', size: 38, n: 1 }, short, color, custom: true } });
}
function newForm(name, like, price){
  const base = items.find(m => m.code === like && m.data && m.data.area); if (!base) throw new Error('Brak formy wzorcowej');
  const code = 'f_' + (slug(name) || 'forma'); if (items.some(m => m.code === code)) throw new Error('Taka forma już istnieje');
  return insertItem({ kind: 'product', code, name, price, sort: nextSort(), data: { ...base.data, short: name, label: name.toLowerCase(), custom: true } });
}
function modal(html){ const o = document.createElement('div'); o.className = 'ov'; o.innerHTML = `<div class="md">${html}</div>`; o.addEventListener('click', e => { if (e.target === o) o.remove(); }); document.body.appendChild(o); return o; }
function openAdd(kind){
  const title = { veg: 'Nowy składnik', sauce: 'Nowy sos', extra: 'Nowy dodatek / napój', form: 'Nowa forma podania' }[kind];
  const used = new Set(items.map(m => (m.data && m.data.lada && m.data.lada.id) || ''));
  const presets = kind === 'veg' ? PV.filter(p => !used.has(slug(p[0]))) : kind === 'sauce' ? PS.filter(p => !used.has(slug(p[0]))) : kind === 'form' ? PF.filter(p => !items.some(m => m.code === 'f_' + slug(p[0]))) : [];
  const forms = items.filter(m => kindOf(m) === 'form' && !(m.data && m.data.custom));
  const o = modal(`<h4>${title}</h4>
    ${presets.length ? `<p class="hint">Gotowe propozycje (kliknij, żeby dodać od razu):</p><div class="chips">${presets.map((p, i) => `<button class="chip" data-p="${i}">${kind === 'veg' ? `<i class="dot" style="background:${p[1]}"></i>` : ''}${esc(p[0])}${kind === 'veg' && p[2] ? ` · +${p[2]} zł` : ''}${kind === 'form' ? ` · ${p[2]} zł` : ''}</button>`).join('')}</div><p class="hint">Albo dodaj własny:</p>` : ''}
    <label class="f">Nazwa</label><input class="in" id="a_name" maxlength="40" placeholder="${kind === 'sauce' ? 'np. Serowy' : kind === 'form' ? 'np. Kebab na talerzu' : 'np. Ogórki konserwowe'}">
    <div class="flex"><div><label class="f">${kind === 'sauce' ? 'Dopłata (zł, 0 = w cenie)' : kind === 'veg' ? 'Dopłata (zł, 0 = w cenie)' : 'Cena (zł)'}</label><input class="in" id="a_price" inputmode="decimal" value="${kind === 'form' ? '30' : '0'}"></div>
    ${kind === 'veg' || kind === 'sauce' ? `<div class="fit"><label class="f">Kolor</label><input type="color" id="a_color" value="${kind === 'sauce' ? '#ffcc4d' : '#9bbf3a'}"></div>` : ''}</div>
    ${kind === 'form' ? `<label class="f">Wygląd taki jak</label><select class="in" id="a_like">${forms.map(f => `<option value="${f.code}">${esc(f.name)}</option>`).join('')}</select>` : ''}
    ${kind === 'extra' ? `<label class="f">Podpis (opcjonalnie)</label><input class="in" id="a_sub" maxlength="40" placeholder="np. 0,33 l, zimny">` : ''}
    <p class="err" id="a_err"></p><button class="btn w" id="a_ok">Dodaj</button>`);
  const run = async fn => { try { await fn(); toast('Dodane ✓'); o.remove(); render(); } catch (e) { o.querySelector('#a_err').textContent = e.message; } };
  o.querySelectorAll('[data-p]').forEach(b => b.onclick = () => run(async () => { const p = presets[+b.dataset.p]; if (kind === 'veg') await newVeg(p[0], p[1], p[2]); else if (kind === 'sauce') await newSauce(p[0], p[1]); else await newForm(p[0], p[1], p[2]); }));
  o.querySelector('#a_ok').onclick = () => run(async () => {
    const name = o.querySelector('#a_name').value.trim(), price = pn(o.querySelector('#a_price').value);
    if (!name) throw new Error('Wpisz nazwę'); if (price === null) throw new Error('Podaj poprawną cenę');
    const color = (o.querySelector('#a_color') || {}).value;
    if (kind === 'veg'){ if (items.some(m => m.data && m.data.lada && m.data.lada.id === slug(name))) throw new Error('Taki składnik już jest'); await newVeg(name, color, price); }
    else if (kind === 'sauce'){ if (items.some(m => m.data && m.data.lada && m.data.lada.id === slug(name))) throw new Error('Taki sos już jest'); await newSauce(name.replace(/^sos\s+/i, ''), color); const s = items.find(m => m.code === 'sauce_' + slug(name.replace(/^sos\s+/i, ''))); if (s && price){ await sb.from('menu_items').update({ price }).eq('id', s.id); s.price = price; } }
    else if (kind === 'form') await newForm(name, o.querySelector('#a_like').value, price);
    else { const code = 'x_' + (slug(name) || 'dodatek'); if (items.some(m => m.code === code)) throw new Error('Taki dodatek już jest'); await insertItem({ kind: 'extra', code, name, price, sort: nextSort(), data: { sub: o.querySelector('#a_sub').value.trim(), short: name, custom: true } }); }
  });
}

/* ---------- gotowe dania ---------- */
let ready = [];
function readyPrice(r){
  const f = items.find(m => m.code === r.form), me = items.find(m => m.code === 'meat_' + r.meat), ex = items.find(m => m.code === 'meat_extra'), ev = items.find(m => m.code === 'extra_portion');
  if (!f || !me) return null;
  let p = Number(f.price) + Number(me.price) + ((r.mp || 1) - 1) * Number(ex ? ex.price : 0);
  for (const [id, n] of Object.entries(r.lada || {})){ const m = items.find(x => x.data && x.data.lada && x.data.lada.id === id); if (!m) continue; p += Number(m.price) ? Number(m.price) * n : (n - 1) * Number(ev ? ev.price : 1); }
  return p;
}
function renderReady(){
  ready = JSON.parse(JSON.stringify((cur.info.settings || {}).ready || []));
  paintReady();
}
function paintReady(){
  const forms = items.filter(m => kindOf(m) === 'form' && m.active), meats = items.filter(m => kindOf(m) === 'meat' && m.active), lada = items.filter(m => m.data && m.data.lada && m.active);
  const missing = PD.filter(p => !ready.some(r => r.name === p.name));
  $('#main').innerHTML = `<p class="hint">Gotowe dania to szybkie propozycje na stronie („Nasze typowe dania”). Klient może je zamówić jednym kliknięciem albo dalej zmienić w kreatorze. Cena liczy się sama z form, mięsa i składników.</p>
  ${missing.length ? `<div class="chips">${missing.map((p, i) => `<button class="chip" data-pd="${PD.indexOf(p)}">+ ${esc(p.name)}</button>`).join('')}</div>` : ''}
  <div class="ready">${ready.map((r, i) => { const pr = readyPrice(r); return `<div class="card" data-i="${i}">
    <div class="flex"><div><label class="f">Nazwa dania</label><input class="in" data-k="name" value="${esc(r.name)}" maxlength="40"></div><div class="fit"><label class="f">Cena</label><div class="price-tag" style="padding:11px 0">${pr === null ? '—' : n2(pr) + ' zł'}</div></div></div>
    <div class="grid"><div><label class="f">Forma podania</label><select class="in" data-k="form">${forms.map(f => `<option value="${f.code}"${f.code === r.form ? ' selected' : ''}>${esc(f.name)}</option>`).join('')}</select></div>
    <div><label class="f">Mięso</label><select class="in" data-k="meat">${meats.map(m => `<option value="${m.code.slice(5)}"${m.code.slice(5) === r.meat ? ' selected' : ''}>${esc(m.name)}</option>`).join('')}</select></div></div>
    <label class="f">Składniki (kliknij: 1 porcja, ponownie: 2 porcje, trzeci raz: wyłącz)</label>
    <div class="chips">${lada.map(m => { const n = (r.lada || {})[m.data.lada.id] || 0; return `<button class="chip" data-l="${m.data.lada.id}" aria-pressed="${n > 0}">${hexOk(m.data.color) ? `<i class="dot" style="background:${m.data.color}"></i>` : ''}${esc(m.data.short || m.name)}${n > 1 ? ' ×' + n : ''}</button>`; }).join('')}</div>
    <div style="display:flex;gap:8px;margin-top:10px"><button class="btn s" data-save>Zapisz danie</button><button class="btn s d" data-rm>Usuń</button></div></div>`; }).join('')}</div>
  <p style="margin-top:14px"><button class="btn g" id="newDish">+ Nowe danie</button></p>`;
  $('#newDish').onclick = () => { ready.push({ name: 'Nowe danie', form: (forms[0] || {}).code, meat: ((meats[0] || {}).code || 'meat_chicken').slice(5), mp: 1, lada: {} }); paintReady(); };
  $('#main').querySelectorAll('[data-pd]').forEach(b => b.onclick = () => addPresetDish(PD[+b.dataset.pd]));
  $('#main').querySelectorAll('.card[data-i]').forEach(card => {
    const i = +card.dataset.i, r = ready[i];
    card.querySelectorAll('[data-k]').forEach(el => el.onchange = () => { r[el.dataset.k] = el.value; if (el.dataset.k !== 'name') paintReady(); });
    card.querySelectorAll('[data-l]').forEach(b => b.onclick = () => { const id = b.dataset.l, n = ((r.lada || (r.lada = {}))[id] || 0) + 1; if (n > 2) delete r.lada[id]; else r.lada[id] = n; paintReady(); });
    card.querySelector('[data-rm]').onclick = async () => { ready.splice(i, 1); if (await saveSettings({ ready })) { toast('Usunięte ✓'); paintReady(); } };
    card.querySelector('[data-save]').onclick = async () => { card.querySelectorAll('[data-k="name"]').forEach(el => r.name = el.value.trim() || 'Danie'); if (await saveSettings({ ready })) { toast('Zapisano ✓ (widać na stronie po odświeżeniu)'); paintReady(); } };
  });
}
async function addPresetDish(p){
  try {
    for (const id of Object.keys(p.lada)){
      if (items.some(m => m.data && m.data.lada && m.data.lada.id === id)) { const ex = items.find(m => m.data.lada.id === id); if (!ex.active) { await sb.from('menu_items').update({ active: true }).eq('id', ex.id); ex.active = true; } continue; }
      const pv = PV.find(x => slug(x[0]) === id), ps = PS.find(x => slug(x[0]) === id);
      if (pv) await newVeg(pv[0], pv[1], pv[2]); else if (ps) await newSauce(ps[0], ps[1]);
    }
    const dish = JSON.parse(JSON.stringify(p));
    if (!items.some(m => m.code === dish.form && m.active)) dish.form = (items.find(m => kindOf(m) === 'form' && m.active) || {}).code;
    ready.push(dish); paintReady(); toast('Dodane. Kliknij „Zapisz danie”, żeby pokazać na stronie');
  } catch (e) { toast(e.message, true); }
}

/* ---------- wygląd ---------- */
function renderLook(){
  const st = cur.info.settings || {}, b = st.brand || {}, c = st.colors || {};
  $('#main').innerHTML = `<div class="card"><div class="grid">
    <div><label class="f">Nazwa restauracji (na stronie)</label><input class="in" id="l_name" maxlength="30" value="${esc(b.name || cur.name)}"></div>
    <div><label class="f">Podtytuł pod nazwą</label><input class="in" id="l_sub" maxlength="40" value="${esc(b.sub || '')}"></div>
    <div><label class="f">Kolor główny (przyciski, akcenty)</label><input type="color" id="l_fire" value="${hexOk(c.fire) ? c.fire : '#ff6a1f'}"></div>
    <div><label class="f">Kolor dodatkowy</label><input type="color" id="l_amber" value="${hexOk(c.amber) ? c.amber : '#ffb347'}"></div></div>
    <label class="f">Logo (PNG, JPG lub WebP, do 1 MB; najlepiej poziome, na przezroczystym tle)</label>
    ${st.logo ? `<img class="logo-prev" src="${esc(st.logo)}" alt="Logo">` : '<p class="hint">Brak logo, na stronie pokazuje się nazwa tekstem.</p>'}
    <input type="file" id="l_file" accept="image/png,image/jpeg,image/webp" hidden>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn g s" id="l_up">Wgraj logo</button>${st.logo ? '<button class="btn s d" id="l_rm">Usuń logo</button>' : ''}</div>
    <button class="btn w" id="l_save">Zapisz wygląd</button></div>
    <p class="hint">Zmiany widać po odświeżeniu strony restauracji.</p>`;
  $('#l_up').onclick = () => $('#l_file').click();
  $('#l_file').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    if (f.size > 1048576) return toast('Plik jest za duży (max 1 MB)', true);
    const ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[f.type]; if (!ext) return toast('Dozwolone: PNG, JPG, WebP', true);
    const path = `${cur.id}/logo-${Date.now()}.${ext}`;
    const { error } = await sb.storage.from('logos').upload(path, f, { contentType: f.type });
    if (error) return toast('Nie wgrano: ' + error.message, true);
    const url = sb.storage.from('logos').getPublicUrl(path).data.publicUrl;
    if (await saveSettings({ logo: url })) { toast('Logo zapisane ✓'); renderLook(); }
  };
  if ($('#l_rm')) $('#l_rm').onclick = async () => { const s = { ...(cur.info.settings || {}) }; delete s.logo; const { error } = await sb.from('restaurants').update({ settings: s }).eq('id', cur.id); if (error) return toast('Nie zapisano', true); cur.info.settings = s; toast('Logo usunięte ✓'); renderLook(); };
  $('#l_save').onclick = async () => {
    const brand = { ...b, name: $('#l_name').value.trim() || cur.name, sub: $('#l_sub').value.trim() };
    if (await saveSettings({ brand, colors: { ...c, fire: $('#l_fire').value, amber: $('#l_amber').value } })) toast('Zapisano ✓');
  };
}

/* ---------- dane lokalu ---------- */
function renderShop(){
  const r = cur.info;
  $('#main').innerHTML = `<div class="card"><div class="open"><span>Przyjmujemy zamówienia online</span><button class="sw" id="open" aria-pressed="${r.is_open}" aria-label="Otwarte"></button></div></div>
  <div class="card"><div class="grid">
  <div><label class="f">Telefon</label><input class="in" id="f_phone" value="${esc(r.phone)}" maxlength="30"></div>
  <div><label class="f">Adres lokalu</label><input class="in" id="f_address" value="${esc(r.address)}" maxlength="120"></div>
  <div><label class="f">Koszt dostawy (zł)</label><input class="in" id="f_fee" inputmode="decimal" value="${n2(r.delivery_fee)}"></div>
  <div><label class="f">Darmowa dostawa od (zł)</label><input class="in" id="f_free" inputmode="decimal" value="${r.free_delivery_from == null ? '' : n2(r.free_delivery_from)}" placeholder="brak"></div>
  <div><label class="f">Minimalne zamówienie (zł)</label><input class="in" id="f_min" inputmode="decimal" value="${n2(r.min_order)}"></div>
  </div><button class="btn w" id="saveShop">Zapisz dane lokalu</button></div>`;
  $('#open').onclick = async () => { const on = !cur.info.is_open; const { error } = await sb.from('restaurants').update({ is_open: on }).eq('id', cur.id); if (error) return toast('Nie zapisano', true); cur.info.is_open = on; $('#open').setAttribute('aria-pressed', on); toast(on ? 'Zamówienia włączone ✓' : 'Zamówienia wyłączone ✓'); };
  $('#saveShop').onclick = async () => {
    const fee = pn($('#f_fee').value), mn = pn($('#f_min').value), fr = $('#f_free').value.trim() === '' ? null : pn($('#f_free').value);
    if (fee === null || mn === null || (fr === null && $('#f_free').value.trim() !== '')) return toast('Sprawdź kwoty', true);
    const upd = { phone: $('#f_phone').value.trim() || null, address: $('#f_address').value.trim() || null, delivery_fee: fee, free_delivery_from: fr, min_order: mn };
    const { error } = await sb.from('restaurants').update(upd).eq('id', cur.id);
    if (error) return toast('Nie zapisano: ' + error.message, true); Object.assign(cur.info, upd); toast('Zapisano ✓');
  };
}
