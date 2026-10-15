// Filter engine + filter controls. Used by the Search page (and later by the report builder).
// A filter is a plain object; empty values are simply left out, e.g.
//   { preset: '2', category: 'Food', min: 100 }

const isoDate = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

// A period shortcut from config.js: { label, from, to, unit? }.
// from/to are offsets from the current month (or the current year when unit is 'year'). No from/to = all time.
function presetRange(p) {
  if (!p || p.from == null) return { from: '', to: '' };
  const n = new Date(), y = n.getFullYear(), m = n.getMonth();
  if (p.unit === 'year') return { from: isoDate(new Date(y + p.from, 0, 1)), to: isoDate(new Date(y + p.to, 11, 31)) };
  return { from: isoDate(new Date(y, m + p.from, 1)), to: isoDate(new Date(y, m + p.to + 1, 0)) };
}
const hasPreset = f => f.preset != null && f.preset !== '';
// A chosen shortcut stays "live": "This month" always means the current month.
const resolveRange = f => hasPreset(f) ? presetRange(CONFIG.datePresets[+f.preset]) : { from: f.from || '', to: f.to || '' };

function matches(e, f) {
  const r = resolveRange(f);
  if (r.from && e.date < r.from) return false;
  if (r.to && e.date > r.to) return false;
  if (f.type && e.type !== f.type) return false;
  if (f.category && e.category !== f.category) return false;
  if (f.subcategory && e.subcategory !== f.subcategory) return false;
  for (const l of CONFIG.lists) if (f[l.field] && e[l.field] !== f[l.field]) return false;
  if (f.min != null && e.amount < f.min) return false;
  if (f.max != null && e.amount > f.max) return false;
  if (f.q) {
    const hay = [e.category, e.subcategory, e.note, e.amount, e.date]
      .concat(CONFIG.lists.map(l => e[l.field]), CONFIG.extraFields.map(x => e[x.field])).join(' ').toLowerCase();
    if (!f.q.toLowerCase().split(/\s+/).filter(Boolean).every(w => hay.includes(w))) return false;
  }
  return true;
}

// ---------- controls ----------
// pairs = [[value, label], ...]; the first option is always "" (= all)
function fillPairs(select, pairs, allLabel, value) {
  const cur = value !== undefined ? value : select.value;
  select.innerHTML = '';
  [['', allLabel]].concat(pairs).forEach(([v, t]) => { const o = el('option', '', t); o.value = v; select.appendChild(o); });
  select.value = pairs.some(p => p[0] === cur) ? cur : '';
}
const catsFor = t => t ? Object.keys(data.categories[t] || {}) : [...new Set(CONFIG.entryTypes.flatMap(x => Object.keys(data.categories[x.id] || {})))];
const subsFor = cat => [...new Set(CONFIG.entryTypes.flatMap(x => (data.categories[x.id] || {})[cat] || []))];

// Draws the period + filter controls into `box`. They edit the object `f` in place and call onChange().
// Returns { refresh } – call it after the data changed (e.g. after the Drive sync).
function buildFilters(box, f, onChange) {
  box.innerHTML = '';
  const c = {}, listFields = CONFIG.lists.map(l => l.field), textual = ['type', 'category', 'subcategory'].concat(listFields);
  const put = (k, v) => { if (v === '' || v == null) delete f[k]; else f[k] = v; };

  // ----- period: quick ranges + custom dates
  const period = el('div', 'period'), pills = el('div', 'pills'), dates = el('div', 'dates');
  period.appendChild(el('span', 'plabel', 'Period'));
  CONFIG.datePresets.forEach((p, i) => {
    const b = el('button', 'pill', p.label); b.type = 'button'; b.dataset.i = String(i);
    b.onclick = () => {
      delete f.from; delete f.to;
      if (p.from == null) delete f.preset; else f.preset = String(i);   // "All time" = no range at all
      showPeriod(); onChange();
    };
    pills.appendChild(b);
  });
  [['from', 'From'], ['to', 'To']].forEach(([name, label]) => {
    const i = el('input'); i.type = 'date'; c[name] = i; i.addEventListener('input', onDate);
    const l = el('label'); l.append(label, i); dates.appendChild(l);
  });
  period.append(pills, dates);

  // ----- filters
  const grid = el('div', 'filters');
  const add = (name, label, node, cls) => { c[name] = node; const l = el('label', cls || ''); l.append(label, node); grid.appendChild(l); };
  const sel = () => el('select');
  const inp = t => { const i = el('input'); i.type = t; return i; };
  const q = inp('search'); q.placeholder = 'Note, category, group, amount…';
  add('q', 'Search', q, 'wide');
  add('type', 'Type', sel()); add('category', 'Category', sel()); add('subcategory', 'Subcategory', sel());
  CONFIG.lists.forEach(l => add(l.field, l.label, sel()));
  [['min', 'Min amount'], ['max', 'Max amount']].forEach(([n, t]) => {
    const i = inp('number'); i.min = '0'; i.step = '0.01'; i.inputMode = 'decimal'; add(n, t, i);
  });
  ['q', 'type', 'category', 'subcategory', 'min', 'max'].concat(listFields).forEach(n => {
    c[n].addEventListener('input', () => changed(n));
    c[n].addEventListener('change', () => changed(n));
  });
  box.append(period, grid);

  function showPills() {
    const r = resolveRange(f), none = !r.from && !r.to;
    pills.querySelectorAll('.pill').forEach(b => {
      const p = CONFIG.datePresets[+b.dataset.i];
      b.classList.toggle('on', p.from == null ? none : f.preset === b.dataset.i);
    });
  }
  function showPeriod() {
    const r = resolveRange(f);
    c.from.value = r.from; c.to.value = r.to;
    showPills();
  }
  function onDate() {                       // typing your own dates replaces any quick range
    delete f.preset; put('from', c.from.value); put('to', c.to.value);
    showPills(); onChange();
  }
  function readControls() {
    put('q', c.q.value.trim());
    textual.forEach(n => put(n, c[n].value));
    ['min', 'max'].forEach(n => put(n, c[n].value === '' ? '' : +c[n].value));
  }
  function changed(name) {
    readControls();
    if (name === 'type' && f.category && !catsFor(f.type).includes(f.category)) { delete f.category; delete f.subcategory; }
    if (name === 'category') delete f.subcategory;
    if (name === 'type' || name === 'category') populate();    // category list follows type, subcategory follows category
    onChange();
  }
  function populate() {
    fillPairs(c.type, CONFIG.entryTypes.map(t => [t.id, t.label]), 'All types', f.type || '');
    fillPairs(c.category, catsFor(f.type).map(v => [v, v]), 'All categories', f.category || '');
    fillPairs(c.subcategory, f.category ? subsFor(f.category).map(v => [v, v]) : [], 'All', f.subcategory || '');
    c.subcategory.disabled = !f.category;
    CONFIG.lists.forEach(l => fillPairs(c[l.field], (data[l.key] || []).map(v => [v, v]), 'All', f[l.field] || ''));
    if (c.q.value !== (f.q || '')) c.q.value = f.q || '';
    c.min.value = f.min != null ? f.min : '';
    c.max.value = f.max != null ? f.max : '';
    showPeriod();
  }

  populate();
  return { refresh: populate };
}
