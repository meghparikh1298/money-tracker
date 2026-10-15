const f = {};   // the current period + filters (edited by filters.js)
let sort = CONFIG.sortOptions[0].id, shown = CONFIG.searchPageSize, ui = null;

const sorters = {
  newest: (a, b) => b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || ''),
  oldest: (a, b) => a.date.localeCompare(b.date) || (a.createdAt || '').localeCompare(b.createdAt || ''),
  high: (a, b) => b.amount - a.amount,
  low: (a, b) => a.amount - b.amount
};

// Start with the period shortcut chosen in config.js (This month)
function defaults() { if (CONFIG.searchDefaultPreset != null) f.preset = String(CONFIG.searchDefaultPreset); }

// One result row (read-only)
function resultRow(e) {
  const t = typeOf(e.type), li = el('li'); li.style.cursor = 'default';
  const main = el('div', 'main'), cat = el('div', 'cat', e.category);
  if (e.subcategory) cat.appendChild(el('i', '', ' › ' + e.subcategory));
  const extras = CONFIG.extraFields.map(x => e[x.field] ? (x.metaLabel ? x.metaLabel + ' ' : '') + e[x.field] : '');
  const lists = CONFIG.lists.map(l => e[l.field] ? (l.metaLabel ? l.metaLabel + ' ' : '') + e[l.field] : '');
  main.append(cat, el('div', 'meta', [e.date].concat(lists, extras, [e.note]).filter(Boolean).join(' · ')));
  li.append(main, el('div', 'amt ' + t.cls, (t.sign > 0 ? '+' : '-') + money(e.amount)));
  return li;
}

function renderResults() {
  const rows = data.entries.filter(e => matches(e, f)).sort(sorters[sort] || sorters.newest);
  const r = resolveRange(f), period = (r.from || r.to) ? `${r.from || '…'} to ${r.to || '…'}` : 'all time';
  $('count').textContent = `${rows.length} of ${data.entries.length} transactions · ${period}`;

  // totals for the matching transactions
  const box = $('summary'); box.innerHTML = '';
  const card = (label, value, cls) => { const d = el('div'); d.append(el('span', '', label), el('b', cls, value)); box.appendChild(d); };
  let net = 0;
  CONFIG.entryTypes.forEach(t => {
    const sum = rows.filter(e => e.type === t.id).reduce((a, e) => a + e.amount, 0);
    net += t.sign * sum; card(t.label, money(sum), t.cls);
  });
  const pos = CONFIG.entryTypes.find(t => t.sign > 0), neg = CONFIG.entryTypes.find(t => t.sign < 0);
  card('Net', (net < 0 ? '-' : '') + money(Math.abs(net)), net < 0 ? neg && neg.cls : pos && pos.cls);

  const ul = $('list'); ul.innerHTML = '';
  if (!rows.length) ul.appendChild(el('li', 'empty', 'No transactions match this period and these filters.'));
  rows.slice(0, shown).forEach(e => ul.appendChild(resultRow(e)));
  $('moreBtn').hidden = rows.length <= shown;
  $('moreBtn').textContent = `Show ${CONFIG.searchPageSize} more`;
}

// Called with the cached data first, then again after the Drive sync
function renderSearch() {
  if (!ui) ui = buildFilters($('filters'), f, () => { shown = CONFIG.searchPageSize; renderResults(); });
  else ui.refresh();
  renderResults();
}

document.addEventListener('DOMContentLoaded', () => {
  defaults();
  const s = $('sort');
  CONFIG.sortOptions.forEach(o => { const x = el('option', '', o.label); x.value = o.id; s.appendChild(x); });
  s.onchange = () => { sort = s.value; renderResults(); };
  $('resetBtn').onclick = () => {
    Object.keys(f).forEach(k => delete f[k]); defaults();
    shown = CONFIG.searchPageSize; if (ui) ui.refresh(true); renderResults();
  };
  $('moreBtn').onclick = () => { shown += CONFIG.searchPageSize; renderResults(); };
  initPage('search', renderSearch);
});
