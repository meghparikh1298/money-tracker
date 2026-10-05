let type = CONFIG.defaultType, editing = null, shown = CONFIG.pageSize;
const byNewest = (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt);

function showLogin() { $('app').hidden = true; $('login').hidden = false; }
function showApp() { $('login').hidden = true; $('app').hidden = false; }

function renderUser() {
  const name = (user && user.name) || 'Account';
  $('uName').textContent = name;
  const av = $('avatar'); av.innerHTML = '';
  if (user && user.picture) { const i = el('img'); i.src = user.picture; i.alt = ''; i.referrerPolicy = 'no-referrer'; av.appendChild(i); }
  else av.textContent = name[0].toUpperCase();
}

// ---------- Home ----------
function renderHome() {
  const m = localDate().slice(0, 7), box = $('summary');
  box.innerHTML = ''; box.style.gridTemplateColumns = `repeat(${CONFIG.entryTypes.length + 1},1fr)`;
  const card = (label, value, cls) => { const d = el('div'); d.append(el('span', '', label), el('b', cls, value)); box.appendChild(d); };
  let bal = 0;
  CONFIG.entryTypes.forEach(t => {
    const sum = data.entries.filter(e => e.type === t.id && e.date.slice(0, 7) === m).reduce((a, e) => a + e.amount, 0);
    bal += t.sign * sum; card(t.label + ' (this month)', money(sum), t.cls);
  });
  const pos = CONFIG.entryTypes.find(t => t.sign > 0), neg = CONFIG.entryTypes.find(t => t.sign < 0);
  card('Balance', (bal < 0 ? '-' : '') + money(Math.abs(bal)), bal < 0 ? neg && neg.cls : pos && pos.cls);

  const rows = data.entries.slice().sort(byNewest);
  const ul = $('list'); ul.innerHTML = '';
  if (!rows.length) ul.appendChild(el('li', 'empty', 'No transactions yet. Click “+ Add Entry” to start.'));
  rows.slice(0, shown).forEach(e => {
    const t = typeOf(e.type), li = el('li'); li.title = 'Click to edit';
    const main = el('div', 'main'), cat = el('div', 'cat', e.category);
    if (e.subcategory) cat.appendChild(el('i', '', ' › ' + e.subcategory));
    const extras = CONFIG.extraFields.map(x => e[x.field] ? (x.metaLabel ? x.metaLabel + ' ' : '') + e[x.field] : '');
    const meta = [e.date].concat(CONFIG.lists.map(l => e[l.field]), extras, [e.note]).filter(Boolean).join(' · ');
    main.append(cat, el('div', 'meta', meta));
    li.append(main, el('div', 'amt ' + t.cls, (t.sign > 0 ? '+' : '-') + money(e.amount)));
    li.onclick = () => openDlg(e);
    ul.appendChild(li);
  });
  $('moreBtn').hidden = rows.length <= shown;
  $('moreBtn').textContent = `Show ${CONFIG.pageSize} more`;
}

// ---------- Add / edit dialog (fields are built from CONFIG) ----------
function buildForm() {
  const seg = $('typeSeg'); seg.innerHTML = '';
  CONFIG.entryTypes.forEach(t => {
    const b = el('button', '', t.label); b.type = 'button'; b.dataset.type = t.id;
    b.onclick = () => setType(t.id); seg.appendChild(b);
  });
  const g = $('fields'); g.innerHTML = '';
  const field = (id, label, node, cls) => { node.id = id; const l = el('label', cls || ''); l.id = 'wrap_' + id; l.append(label, node); g.appendChild(l); };
  const input = (t, req) => { const i = el('input'); i.type = t; i.required = !!req; return i; };
  const select = req => { const s = el('select'); s.required = !!req; return s; };
  field('date', 'Date', input('date', true));
  const amt = input('number', true); amt.min = '0.01'; amt.step = '0.01'; amt.inputMode = 'decimal';
  field('amount', `Amount (${CONFIG.currency.symbol})`, amt);
  field('category', 'Category', select(true));
  field('subcategory', 'Subcategory', select(false));
  CONFIG.lists.forEach(l => field(l.field, l.label, select(true)));
  CONFIG.extraFields.forEach(x => {
    const i = input(x.input || 'text');
    if (i.type === 'text') i.maxLength = 80;
    if (x.placeholder) i.placeholder = x.placeholder;
    if (x.suggest) { i.setAttribute('list', 'dl_' + x.field); const dl = el('datalist'); dl.id = 'dl_' + x.field; g.appendChild(dl); }
    field(x.field, x.label, i, x.whenCategory ? 'wide' : '');
  });
  const note = input('text'); note.maxLength = 120;
  field('note', 'Note (optional)', note, 'wide');
  $('category').onchange = () => fillSub();
}
function setType(t, keepCat) {
  type = t;
  document.querySelectorAll('#typeSeg button').forEach(b => b.classList.toggle('on', b.dataset.type === t));
  fillSelect('category', Object.keys(data.categories[t]), keepCat);
  fillSub();
}
function fillSub(selected) {
  fillSelect('subcategory', data.categories[type][$('category').value] || [], selected, '— None —');
  updateExtras();
}
const extraVisible = x => !x.whenCategory || $('category').value.toLowerCase() === x.whenCategory.toLowerCase();
function updateExtras() {
  CONFIG.extraFields.forEach(x => { const show = extraVisible(x); $('wrap_' + x.field).hidden = !show; if (!show) $(x.field).value = ''; });
}
function fillDatalist(field) {
  const dl = $('dl_' + field); dl.innerHTML = '';
  [...new Set(data.entries.map(e => e[field]).filter(Boolean))].sort().forEach(v => { const o = el('option'); o.value = v; dl.appendChild(o); });
}
function openDlg(entry) {
  editing = entry || null;
  $('dlgTitle').textContent = entry ? 'Edit entry' : 'Add entry';
  setType(entry ? entry.type : CONFIG.defaultType, entry && entry.category);
  fillSub(entry && entry.subcategory);
  CONFIG.lists.forEach(l => fillSelect(l.field, data[l.key], entry && entry[l.field]));
  CONFIG.extraFields.forEach(x => { if (extraVisible(x)) $(x.field).value = (entry && entry[x.field]) || ''; if (x.suggest) fillDatalist(x.field); });
  $('date').value = entry ? entry.date : localDate();
  $('amount').value = entry ? entry.amount : '';
  $('note').value = entry ? entry.note || '' : '';
  $('delBtn').hidden = !entry;
  $('dlg').showModal();
}
function saveEntry(ev) {
  ev.preventDefault();
  const amount = parseFloat($('amount').value);
  if (!(amount > 0)) return;
  const f = { date: $('date').value, type, category: $('category').value, subcategory: $('subcategory').value, amount, note: $('note').value.trim() };
  CONFIG.lists.forEach(l => { f[l.field] = $(l.field).value; });
  CONFIG.extraFields.forEach(x => { f[x.field] = extraVisible(x) ? $(x.field).value.trim() : ''; });
  if (editing) clean(Object.assign(editing, f, { updatedAt: nowIso() }));
  else { const t = nowIso(); data.entries.push(clean({ id: uid(), ...f, createdAt: t, updatedAt: t })); }
  $('dlg').close(); renderHome(); persist();
}

// ---------- Session ----------
async function go(interactive) {
  try {
    banner('');
    await connect(interactive);
    showApp(); renderUser(); renderHome();
  } catch (e) {
    showLogin(); setState('');
    if (interactive || /CLIENT_ID/.test(e.message)) banner((interactive ? 'Sign-in failed: ' : '') + e.message);
  }
}

function init() {
  buildForm(); onProfile = renderUser;
  $('signInBtn').onclick = () => go(true);
  $('signOutBtn').onclick = () => { signOut(); $('menu').hidden = true; showLogin(); };
  $('addBtn').onclick = () => openDlg(null);
  $('moreBtn').onclick = () => { shown += CONFIG.pageSize; renderHome(); };
  $('goSettings').onclick = () => { location.href = 'settings.html'; };
  $('avatar').onclick = ev => { ev.stopPropagation(); $('menu').hidden = !$('menu').hidden; };
  document.addEventListener('click', ev => { if (!ev.target.closest('.acct')) $('menu').hidden = true; });
  $('form').onsubmit = saveEntry;
  $('cancelBtn').onclick = () => $('dlg').close();
  $('dlg').onclick = ev => { if (ev.target === $('dlg')) $('dlg').close(); };
  $('delBtn').onclick = () => {
    if (!editing || !confirm('Delete this entry?')) return;
    data.entries = data.entries.filter(x => x.id !== editing.id);
    $('dlg').close(); renderHome(); persist();
  };
  if (localStorage.getItem(K.signed)) {
    if (loadCache()) { showApp(); renderUser(); renderHome(); }   // instant paint from cache
    go(false);                                                     // then sync with Drive
  }
}
document.addEventListener('DOMContentLoaded', init);