// Shared filter engine used by Search and by the report builder.
// A filter is a plain object; empty values are simply left out, e.g.
// { q: 'zomato', preset: '2', category: 'Food', min: 100 }

const isoDate = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

function presetRange(p) {
  if (!p || p.from == null) return { from: '', to: '' };
  const n = new Date();
  return { from: isoDate(new Date(n.getFullYear(), n.getMonth() + p.from, 1)), to: isoDate(new Date(n.getFullYear(), n.getMonth() + p.to + 1, 0)) };
}
function resolveRange(f) {
  if (f.preset != null && f.preset !== '') return presetRange(CONFIG.datePresets[+f.preset]);   // presets stay "live"
  return { from: f.from || '', to: f.to || '' };
}

function applyFilters(entries, f) {
  const r = resolveRange(f), words = f.q ? f.q.toLowerCase().split(/\s+/).filter(Boolean) : [];
  return entries.filter(e => {
    if (r.from && e.date < r.from) return false;
    if (r.to && e.date > r.to) return false;
    if (f.type && e.type !== f.type) return false;
    if (f.category && e.category !== f.category) return false;
    if (f.subcategory && e.subcategory !== f.subcategory) return false;
    for (const l of CONFIG.lists) if (f[l.field] && e[l.field] !== f[l.field]) return false;
    if (f.min != null && e.amount < f.min) return false;
    if (f.max != null && e.amount > f.max) return false;
    if (words.length) {
      const hay = [e.category, e.subcategory, e.note, e.amount].concat(CONFIG.lists.map(l => e[l.field]), CONFIG.extraFields.map(x => e[x.field])).join(' ').toLowerCase();
      if (!words.every(w => hay.includes(w))) return false;
    }
    return true;
  });
}

// pairs = [[value, label], ...]; allLabel adds a first "" option
function fillPairs(select, pairs, allLabel) {
  const cur = select.value; select.innerHTML = '';
  const all = allLabel != null ? [['', allLabel]].concat(pairs) : pairs;
  all.forEach(([v, t]) => { const o = el('option', '', t); o.value = v; select.appendChild(o); });
  if (all.some(p => p[0] === cur)) select.value = cur;
}
const allCategories = () => [...new Set(CONFIG.entryTypes.flatMap(t => Object.keys(data.categories[t.id] || {})))];
const subsFor = cat => [...new Set(CONFIG.entryTypes.flatMap(t => (data.categories[t.id] || {})[cat] || []))];

// Builds the filter controls inside `box`. Returns { get, set, clear, refresh }.
function buildFilters(box, onChange, opt = {}) {
  box.innerHTML = ''; box.classList.add('filters');
  const c = {};
  const add = (name, label, node, cls) => {
    c[name] = node; const l = el('label', cls || ''); l.append(label, node); box.appendChild(l);
    node.addEventListener('input', () => {
      if (name === 'category') fillSubs();
      if (name === 'preset') applyPreset();
      if ((name === 'from' || name === 'to') && c.preset.value !== '') c.preset.value = '';
      onChange && onChange();
    });
  };
  const sel = () => el('select'), inp = t => { const i = el('input'); i.type = t; return i; };
  if (!opt.noText) { const q = inp('search'); q.placeholder = 'Search note, category, group, amount…'; add('q', 'Search', q, 'wide'); }
  add('preset', 'Period', sel()); add('from', 'From', inp('date')); add('to', 'To', inp('date'));
  add('type', 'Type', sel()); add('category', 'Category', sel()); add('subcategory', 'Subcategory', sel());
  CONFIG.lists.forEach(l => add(l.field, l.label, sel()));
  [['min', 'Min amount'], ['max', 'Max amount']].forEach(([n, t]) => { const i = inp('number'); i.min = '0'; i.step = '0.01'; i.inputMode = 'decimal'; add(n, t, i); });

  function fillSubs() { fillPairs(c.subcategory, subsFor(c.category.value).map(v => [v, v]), 'All'); }
  function applyPreset() {
    if (c.preset.value === '') return;
    const r = presetRange(CONFIG.datePresets[+c.preset.value]); c.from.value = r.from; c.to.value = r.to;
  }
  function refresh() {
    fillPairs(c.preset, CONFIG.datePresets.map((p, i) => [String(i), p.label]), 'Custom / any date');
    fillPairs(c.type, CONFIG.entryTypes.map(t => [t.id, t.label]), 'All types');
    fillPairs(c.category, allCategories().map(v => [v, v]), 'All categories');
    fillSubs();
    CONFIG.lists.forEach(l => fillPairs(c[l.field], (data[l.key] || []).map(v => [v, v]), 'All'));
  }
  function get() {
    const f = {};
    if (c.q && c.q.value.trim()) f.q = c.q.value.trim();
    if (c.preset.value !== '') f.preset = c.preset.value;
    else { if (c.from.value) f.from = c.from.value; if (c.to.value) f.to = c.to.value; }
    ['type', 'category', 'subcategory'].concat(CONFIG.lists.map(l => l.field)).forEach(n => { if (c[n].value) f[n] = c[n].value; });
    ['min', 'max'].forEach(n => { if (c[n].value !== '') f[n] = +c[n].value; });
    return f;
  }
  function set(f) {
    refresh(); f = f || {};
    if (c.q) c.q.value = f.q || '';
    c.preset.value = f.preset != null ? f.preset : ''; c.from.value = f.from || ''; c.to.value = f.to || '';
    applyPreset();
    c.type.value = f.type || ''; c.category.value = f.category || ''; fillSubs(); c.subcategory.value = f.subcategory || '';
    CONFIG.lists.forEach(l => { c[l.field].value = f[l.field] || ''; });
    c.min.value = f.min != null ? f.min : ''; c.max.value = f.max != null ? f.max : '';
  }
  refresh();
  return { get, set, refresh, clear: () => set({}) };
}