const isInv = e => e.category && e.category.toLowerCase() === INVESTMENT.toLowerCase() && typeOf(e.type).sign < 0;
const statusOf = (e, today) => !e.maturityDate ? 'open' : e.maturityDate < today ? 'matured' : 'active';
const daysTo = (d, today) => Math.round((new Date(d) - new Date(today)) / 864e5);
const total = a => a.reduce((s, e) => s + e.amount, 0);

function renderInvestments() {
  const today = localDate(), all = data.entries.filter(isInv);
  const live = all.filter(e => statusOf(e, today) !== 'matured');
  const done = all.filter(e => statusOf(e, today) === 'matured');
  const next = live.filter(e => e.maturityDate).sort((a, b) => a.maturityDate.localeCompare(b.maturityDate))[0];

  const box = $('summary'); box.innerHTML = '';
  const card = (label, value, cls, sub) => {
    const d = el('div'); const b = el('b', cls, value); d.append(el('span', '', label), b);
    if (sub) d.appendChild(el('small', '', sub)); box.appendChild(d);
  };
  card('Total invested', money(total(all)), 'invc', all.length + ' investment' + (all.length === 1 ? '' : 's'));
  card('Active', money(total(live)), '', live.length + ' running');
  card('Matured', money(total(done)), 'inc', done.length + ' closed');
  card('Next maturity', next ? next.maturityDate : '—', '', next ? `${money(next.amount)} · in ${daysTo(next.maturityDate, today)} days` : 'None scheduled');

  // by type (subcategory such as FD / RD)
  const types = {};
  all.forEach(e => { const k = e.subcategory || 'Other'; types[k] = (types[k] || 0) + e.amount; });
  const bt = $('byType'); bt.innerHTML = '';
  const items = Object.keys(types).map(k => ({ label: k, value: types[k], cls: 'invc' })).sort((a, b) => b.value - a.value);
  if (items.length) hbars(bt, items); else bt.appendChild(el('p', 'muted', 'No investments yet. Add an entry with category “' + INVESTMENT + '”.'));

  // list: upcoming first, then open-ended, then matured
  const rank = e => ({ active: 0, open: 1, matured: 2 })[statusOf(e, today)];
  all.sort((a, b) => rank(a) - rank(b) ||
    (rank(a) === 2 ? b.maturityDate.localeCompare(a.maturityDate) : (a.maturityDate || '').localeCompare(b.maturityDate || '')));
  const ul = $('list'); ul.innerHTML = '';
  all.forEach(e => {
    const st = statusOf(e, today), li = el('li'); li.style.cursor = 'default';
    const main = el('div', 'main'), cat = el('div', 'cat', e.subcategory || e.category);
    if (e.subcategory) cat.appendChild(el('i', '', ' › ' + e.category));
    const meta = ['Invested ' + e.date].concat(CONFIG.lists.map(l => e[l.field] ? (l.metaLabel ? l.metaLabel + ' ' : '') + e[l.field] : ''), [e.note]).filter(Boolean).join(' · ');
    main.append(cat, el('div', 'meta', meta));
    const side = el('div', 'side');
    side.appendChild(el('div', 'amt invc', money(e.amount)));
    side.appendChild(el('span', 'badge ' + st,
      st === 'open' ? 'No maturity date' : st === 'matured' ? 'Matured ' + e.maturityDate : `${e.maturityDate} · ${daysTo(e.maturityDate, today)}d left`));
    li.append(main, side); ul.appendChild(li);
  });
}
document.addEventListener('DOMContentLoaded', () => initPage('investments', renderInvestments));