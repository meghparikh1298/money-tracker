// Shared add/edit entry dialog (used by Transactions and Search)
let type = CONFIG.defaultType, editing = null, afterChange = () => {};

function mountDialog() {
  if ($('dlg')) return;
  const d = document.createElement('dialog'); d.id = 'dlg';
  d.innerHTML = `<form id="form"><h2 id="dlgTitle">Add entry</h2>
    <div class="seg" id="typeSeg" role="group" aria-label="Entry type"></div><div class="grid" id="fields"></div>
    <div class="actions"><button type="button" id="delBtn" class="btn danger" hidden>Delete</button><span class="grow"></span>
    <button type="button" id="cancelBtn" class="btn">Cancel</button><button type="submit" class="btn primary">Save</button></div></form>`;
  document.body.appendChild(d);
}

function initEntryForm(cb) {
  afterChange = cb || afterChange;
  mountDialog(); buildForm();
  $('form').onsubmit = saveEntry;
  $('cancelBtn').onclick = () => $('dlg').close();
  $('dlg').onclick = ev => { if (ev.target === $('dlg')) $('dlg').close(); };
  $('delBtn').onclick = () => {
    if (!editing || !confirm('Delete this entry?')) return;
    data.entries = data.entries.filter(x => x.id !== editing.id);
    $('dlg').close(); afterChange(); persist();
  };
}

// One transaction row; clicking it opens the edit dialog
function entryRow(e) {
  const t = typeOf(e.type), li = el('li'); li.title = 'Click to edit';
  const main = el('div', 'main'), cat = el('div', 'cat', e.category);
  if (e.subcategory) cat.appendChild(el('i', '', ' › ' + e.subcategory));
  const extras = CONFIG.extraFields.map(x => e[x.field] ? (x.metaLabel ? x.metaLabel + ' ' : '') + e[x.field] : '');
  const meta = [e.date].concat(CONFIG.lists.map(l => e[l.field] ? (l.metaLabel ? l.metaLabel + ' ' : '') + e[l.field] : ''), extras, [e.note]).filter(Boolean).join(' · ');
  main.append(cat, el('div', 'meta', meta));
  li.append(main, el('div', 'amt ' + t.cls, (t.sign > 0 ? '+' : '-') + money(e.amount)));
  li.onclick = () => openDlg(e);
  return li;
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
  CONFIG.lists.forEach(l => { const s = select(!l.optional); field(l.field, l.label, s); if (l.allowAdd) s.onchange = () => addInline(l); });
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
function fillList(l, selected) {
  fillSelect(l.field, data[l.key], selected, l.optional ? '— None —' : undefined);
  const s = $(l.field); s.dataset.prev = s.value;
  if (l.allowAdd) { const o = el('option', '', '＋ Add new…'); o.value = '__new__'; s.appendChild(o); }
}
function addInline(l) {   // “＋ Add new…” chosen in a dropdown
  const s = $(l.field);
  if (s.value !== '__new__') { s.dataset.prev = s.value; return; }
  const name = (prompt('New ' + l.singular + ' name') || '').trim();
  if (!name) { fillList(l, s.dataset.prev); return; }
  const same = data[l.key].find(v => v.toLowerCase() === name.toLowerCase());
  if (!same) { data[l.key].push(name); persist(); }
  fillList(l, same || name);
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
  CONFIG.lists.forEach(l => fillList(l, entry && entry[l.field]));
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
  $('dlg').close(); afterChange(); persist();
}