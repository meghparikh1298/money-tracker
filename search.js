const f = {};   // current filter values (shared with filters.js)
let sort = CONFIG.sortOptions[0].id, shown = CONFIG.searchPageSize, built = false;

const sorters = {
  newest: (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
  oldest: (a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt),
  high: (a, b) => b.amount - a.amount,
  low: (a, b) => a.amount - b.amount
};

function drawFilters() {
  buildFilters($('filters'), f, () => { shown = CONFIG.searchPageSize; renderResults(); });
}

function renderSearch() {
  // Build once; rebuild after the Drive sync only if the user hasn't touched anything yet.
  if (!built || !Object.keys(f).length) { drawFilters(); built = true; }
  renderResults();
}

function renderResults() {
  const rows = data.entries.filter(e => matches(e, f)).sort(sorters[sort]);
  $('count').textContent = `${rows.length} of ${data.entries.length} transactions`;

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
  if (!rows.length) ul.appendChild(el('li', 'empty', 'No transactions match these filters.'));
  rows.slice(0, shown).forEach(e => ul.appendChild(entryRow(e)));   // click a row to edit it
  $('moreBtn').hidden = rows.length <= shown;
  $('moreBtn').textContent = `Show ${CONFIG.searchPageSize} more`;
}

document.addEventListener('DOMContentLoaded', () => {
  initEntryForm(renderResults);
  const s = el('select'); s.setAttribute('aria-label', 'Sort');
  CONFIG.sortOptions.forEach(o => { const x = el('option', '', o.label); x.value = o.id; s.appendChild(x); });
  s.onchange = () => { sort = s.value; renderResults(); };
  $('clearBtn').before(s);
  $('clearBtn').onclick = () => { Object.keys(f).forEach(k => delete f[k]); shown = CONFIG.searchPageSize; drawFilters(); renderResults(); };
  $('moreBtn').onclick = () => { shown += CONFIG.searchPageSize; renderResults(); };
  initPage('search', renderSearch);
});