// Shared by Search and the report builder: filter engine + filter form
function presetRange(name) {
  const p = CONFIG.datePresets.find(x => x.label === name);
  if (!p || p.from == null) return {};
  const d = new Date(), y = d.getFullYear(), m = d.getMonth();
  const iso = x => x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
  return { from: iso(new Date(y, m + p.from, 1)), to: iso(new Date(y, m + p.to + 1, 0)) };
}
const rangeOf = f => f.preset ? presetRange(f.preset) : { from: f.from, to: f.to };

function matches(e, f) {
  if (f.type && e.type !== f.type) return false;
  if (f.category && e.category !== f.category) return false;
  if (f.subcategory && e.subcategory !== f.subcategory) return false;
  for (const l of CONFIG.lists) if (f[l.field] && e[l.field] !== f[l.field]) return false;
  const r = rangeOf(f);
  if (r.from && e.date < r.from) return false;
  if (r.to && e.date > r.to) return false;
  if (f.min && e.amount < +f.min) return false;
  if (f.max && e.amount > +f.max) return false;
  if (f.text) {
    const hay = [e.category, e.subcategory, e.note, e.maturityDate, e.date, String(e.amount)]
      .concat(CONFIG.lists.map(l => e[l.field])).join(' ').toLowerCase();
    if (!f.text.toLowerCase().split(/\s+/).filter(Boolean).every(w => hay.includes(w))) return false;
  }
  return true;
}

// Draws the filter form into `box`, editing the object `f` in place; calls onChange() on any change.
function buildFilters(box, f, onChange) {
  box.innerHTML = ''; box.className = 'filters';
  const again = () => { buildFilters(box, f, onChange); onChange(); };
  const add = (label, node, cls) => { const l = el('label', cls || ''); l.append(label, node); box.appendChild(l); return node; };
  const put = (key, v) => { if (v === '' || v == null) delete f[key]; else f[key] = v; };
  const input = (key, type, ph) => {
    const i = el('input'); i.type = type; if (ph) i.placeholder = ph; i.value = f[key] != null ? f[key] : '';
    i.oninput = () => { put(key, i.value); onChange(); }; return i;
  };
  const select = (key, opts, all, rebuild) => {
    const s = el('select'), o0 = el('option', '', all); o0.value = ''; s.appendChild(o0);
    opts.forEach(v => { const o = el('option', '', v.label || v); o.value = v.id || v; s.appendChild(o); });
    s.value = f[key] || '';
    s.onchange = () => { put(key, s.value); rebuild ? rebuild() : onChange(); };
    return s;
  };
  const catsFor = t => t ? Object.keys(data.categories[t] || {}) : [...new Set(CONFIG.entryTypes.flatMap(x => Object.keys(data.categories[x.id] || {})))];
  const subsFor = c => [...new Set(CONFIG.entryTypes.flatMap(x => (data.categories[x.id] || {})[c] || []))];

  add('Search', input('text', 'search', 'Note, category, group, amount…'), 'wide');
  const ps = add('Quick range', select('preset', CONFIG.datePresets.map(p => ({ id: p.label, label: p.label })), 'Any date', () => { delete f.from; delete f.to; again(); }));
  const r = rangeOf(f);
  const dateInput = (key, val) => {
    const i = el('input'); i.type = 'date'; i.value = val || '';
    i.oninput = () => {
      if (f.preset) { const c = rangeOf(f); f.from = c.from; f.to = c.to; delete f.preset; ps.value = ''; }
      put(key, i.value); onChange();
    };
    return i;
  };
  add('From', dateInput('from', r.from)); add('To', dateInput('to', r.to));
  add('Type', select('type', CONFIG.entryTypes, 'All types', () => {
    if (f.category && !catsFor(f.type).includes(f.category)) { delete f.category; delete f.subcategory; } again();
  }));
  add('Category', select('category', catsFor(f.type), 'All categories', () => { delete f.subcategory; again(); }));
  const sub = add('Subcategory', select('subcategory', f.category ? subsFor(f.category) : [], 'All'));
  sub.disabled = !f.category;
  CONFIG.lists.forEach(l => add(l.label, select(l.field, data[l.key] || [], 'All')));
  add('Min amount', input('min', 'number')); add('Max amount', input('max', 'number'));
}
