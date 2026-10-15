// Filter engine + filter controls (Search page; later also the report builder).
// A filter is a plain object; empty values are left out. Multi-value filters are arrays, e.g.
//   { preset: '0', category: ['Food', 'Bills'], account: ['HDFC'], min: 100, q: 'zomato' }
//   { preset: 'custom', from: '2026-01-01', to: '2026-03-31' }

const isoDate = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const CUSTOM = 'custom';

// A period shortcut from config.js: { label, from, to, unit? }.
// from/to are offsets from the current month (or the current year when unit is 'year').
function presetRange(p) {
  if (!p || p.from == null) return { from: '', to: '' };
  const n = new Date(), y = n.getFullYear(), m = n.getMonth();
  if (p.unit === 'year') return { from: isoDate(new Date(y + p.from, 0, 1)), to: isoDate(new Date(y + p.to, 11, 31)) };
  return { from: isoDate(new Date(y, m + p.from, 1)), to: isoDate(new Date(y, m + p.to + 1, 0)) };
}
const hasPreset = f => f.preset != null && f.preset !== '' && f.preset !== CUSTOM;
// A chosen shortcut stays "live": "This month" always means the current month.
const resolveRange = f => hasPreset(f) ? presetRange(CONFIG.datePresets[+f.preset]) : { from: f.from || '', to: f.to || '' };

const pick = (selected, v) => !selected || !selected.length || selected.includes(v);   // empty selection = everything

function matches(e, f) {
  const r = resolveRange(f);
  if (r.from && e.date < r.from) return false;
  if (r.to && e.date > r.to) return false;
  if (!pick(f.type, e.type) || !pick(f.category, e.category) || !pick(f.subcategory, e.subcategory)) return false;
  for (const l of CONFIG.lists) if (!pick(f[l.field], e[l.field])) return false;
  if (f.min != null && e.amount < f.min) return false;
  if (f.max != null && e.amount > f.max) return false;
  if (f.q) {
    const hay = [e.category, e.subcategory, e.note, e.amount, e.date]
      .concat(CONFIG.lists.map(l => e[l.field]), CONFIG.extraFields.map(x => e[x.field])).join(' ').toLowerCase();
    if (!f.q.toLowerCase().split(/\s+/).filter(Boolean).every(w => hay.includes(w))) return false;
  }
  return true;
}

// ---------- option lists ----------
const catsFor = types => [...new Set((types && types.length ? types : CONFIG.entryTypes.map(t => t.id))
  .flatMap(id => Object.keys(data.categories[id] || {})))];
const subsFor = cats => {
  const out = new Set();
  CONFIG.entryTypes.forEach(t => {
    const m = data.categories[t.id] || {};
    (cats && cats.length ? cats : Object.keys(m)).forEach(c => (m[c] || []).forEach(s => out.add(s)));
  });
  return [...out];
};
const shortLabel = s => s.replace(/\s*\(.*?\)\s*$/, '');      // "Group (trip, event…)" -> "Group"

// ---------- controls ----------
// Draws period + search + "Add filter" into `box`. They edit the object `f` in place and call onChange().
// Returns { refresh(closePanel) } – call it after the data changed (e.g. after the Drive sync) or after f was reset.
function buildFilters(box, f, onChange) {
  box.innerHTML = '';
  const c = {}, listFields = CONFIG.lists.map(l => l.field), multiKeys = ['type', 'category', 'subcategory'].concat(listFields);
  const put = (k, v) => { if (v === '' || v == null || (Array.isArray(v) && !v.length)) delete f[k]; else f[k] = v; };
  let open = false, openKey = null;

  const strs = arr => arr.map(v => ({ value: v, label: v }));
  const fields = () => [
    { key: 'type', label: 'Type', options: () => CONFIG.entryTypes.map(t => ({ value: t.id, label: t.label })) },
    { key: 'category', label: 'Category', options: () => strs(catsFor(f.type)) },
    { key: 'subcategory', label: 'Subcategory', options: () => strs(subsFor(f.category)) }
  ].concat(
    CONFIG.lists.map(l => ({ key: l.field, label: l.label, options: () => strs(data[l.key] || []) })),
    [{ key: 'amount', label: 'Amount', range: true }]
  );
  const isSet = fl => fl.range ? (f.min != null || f.max != null) : !!(f[fl.key] && f[fl.key].length);
  const labelOf = (fl, v) => { const o = fl.options().find(x => x.value === v); return o ? o.label : v; };
  // 1-2 chosen values are listed; more than 2 are shown as a count
  function summaryOf(fl) {
    if (fl.range) {
      const lo = f.min != null, hi = f.max != null;
      return lo && hi ? `${money(f.min)} – ${money(f.max)}` : lo ? `from ${money(f.min)}` : `up to ${money(f.max)}`;
    }
    const names = (f[fl.key] || []).map(v => labelOf(fl, v));
    return names.length > 2 ? `${names.length} values selected` : names.join(', ');
  }

  // ----- 1. period: dropdown (+ From / To when "Custom range")
  const period = el('div', 'period'), pl = el('label'), ps = el('select'), dates = el('div', 'dates');
  ps.setAttribute('aria-label', 'Period'); c.period = ps; pl.append('Period', ps);
  CONFIG.datePresets.forEach((p, i) => { const o = el('option', '', p.label); o.value = String(i); ps.appendChild(o); });
  const oc = el('option', '', CONFIG.customRangeLabel || 'Custom range'); oc.value = CUSTOM; ps.appendChild(oc);
  [['from', 'From'], ['to', 'To']].forEach(([name, label]) => {
    const i = el('input'); i.type = 'date'; c[name] = i; i.addEventListener('input', () => onDate(name));
    const l = el('label'); l.append(label, i); dates.appendChild(l);
  });
  period.append(pl, dates);
  ps.addEventListener('change', () => {
    if (ps.value === CUSTOM) {                       // start the custom range from the dates that were showing
      const r = resolveRange(f), today = localDate();
      f.preset = CUSTOM; put('from', r.from); put('to', r.to > today ? today : r.to);
    } else { delete f.from; delete f.to; f.preset = ps.value; }
    showPeriod(); onChange();
  });
  function showPeriod() {
    const today = localDate();
    ps.value = hasPreset(f) ? f.preset : CUSTOM;
    dates.hidden = hasPreset(f);
    c.from.value = f.from || ''; c.to.value = f.to || '';
    c.from.max = c.to.value || today; c.to.max = today; c.to.min = c.from.value || '';     // nothing later than today
  }
  function onDate(name) {
    const today = localDate();
    if (c[name].value > today) c[name].value = today;
    if (c.from.value && c.to.value && c.from.value > c.to.value) (name === 'from' ? c.to : c.from).value = c[name].value;
    f.preset = CUSTOM; put('from', c.from.value); put('to', c.to.value);
    c.from.max = c.to.value || today; c.to.min = c.from.value || '';
    onChange();
  }

  // ----- 2. search bar (below the line)
  const qrow = el('div', 'qrow'), q = el('input');
  q.type = 'search'; q.placeholder = 'Note, category, group, amount…'; q.setAttribute('aria-label', 'Search'); c.q = q;
  q.addEventListener('input', () => { put('q', q.value.trim()); onChange(); });
  qrow.appendChild(q);

  // ----- 3. "Add filter" button, the chosen filters beside it, and the options panel
  const frow = el('div', 'frow'), panel = el('div', 'fpanel');
  box.append(period, qrow, frow, panel);

  function prune() {                                   // keep dependent selections valid (type -> category -> subcategory)
    if (f.category) put('category', f.category.filter(v => catsFor(f.type).includes(v)));
    if (f.subcategory) put('subcategory', f.subcategory.filter(v => subsFor(f.category).includes(v)));
  }
  function commit() { prune(); renderRow(); renderPanel(); onChange(); }
  function closePanel() { if (open) { open = false; openKey = null; renderRow(); renderPanel(); } }
  function clearField(fl) { if (fl.range) { delete f.min; delete f.max; } else delete f[fl.key]; }

  function renderRow() {
    frow.innerHTML = '';
    const add = el('button', 'btn addf', '＋ Add filter'); add.type = 'button'; add.setAttribute('aria-expanded', String(open));
    add.onclick = () => { open = !open; if (!open) openKey = null; renderRow(); renderPanel(); };
    frow.appendChild(add);
    fields().filter(isSet).forEach(fl => {
      const chip = el('span', 'fchip'), main = el('button', 'fchip-main', `${shortLabel(fl.label)}: ${summaryOf(fl)}`), x = el('button', 'fchip-x', '✕');
      main.type = 'button'; x.type = 'button'; x.setAttribute('aria-label', 'Remove ' + shortLabel(fl.label) + ' filter');
      main.onclick = () => { open = true; openKey = fl.key; renderRow(); renderPanel(); };
      x.onclick = () => { clearField(fl); commit(); };
      chip.append(main, x); frow.appendChild(chip);
    });
  }

  function checkBody(fl) {
    const body = el('div', 'fbody'), opts = fl.options();
    if (!opts.length) { body.appendChild(el('p', 'muted', 'No options yet.')); return body; }
    opts.forEach(o => {
      const l = el('label', 'opt'), cb = el('input'); cb.type = 'checkbox'; cb.checked = (f[fl.key] || []).includes(o.value);
      cb.onchange = () => {
        const cur = new Set(f[fl.key] || []);
        if (cb.checked) cur.add(o.value); else cur.delete(o.value);
        put(fl.key, [...cur]); commit();
      };
      l.append(cb, o.label); body.appendChild(l);
    });
    return body;
  }
  function rangeBody() {
    const body = el('div', 'fbody range');
    [['min', 'Min amount'], ['max', 'Max amount']].forEach(([k, t]) => {
      const i = el('input'); i.type = 'number'; i.min = '0'; i.step = '0.01'; i.inputMode = 'decimal'; i.value = f[k] != null ? f[k] : '';
      i.addEventListener('input', () => { put(k, i.value === '' ? '' : +i.value); renderRow(); onChange(); });   // panel stays, so typing isn't interrupted
      const l = el('label'); l.append(t, i); body.appendChild(l);
    });
    return body;
  }
  function renderPanel() {
    const keep = panel.scrollTop;
    panel.innerHTML = ''; panel.hidden = !open;
    if (!open) return;
    fields().forEach(fl => {
      const sec = el('div', 'fsec' + (openKey === fl.key ? ' open' : '')), head = el('button', 'fhead'); head.type = 'button';
      head.appendChild(el('span', 't', shortLabel(fl.label)));
      if (isSet(fl)) head.appendChild(el('span', 'count', fl.range ? '1' : String(f[fl.key].length)));
      head.appendChild(el('span', 'chev', '›'));
      head.onclick = () => { openKey = openKey === fl.key ? null : fl.key; renderPanel(); };
      sec.appendChild(head);
      if (openKey === fl.key) sec.appendChild(fl.range ? rangeBody() : checkBody(fl));
      panel.appendChild(sec);
    });
    const foot = el('div', 'ffoot'), clear = el('button', 'btn', 'Clear filters'), done = el('button', 'btn primary', 'Done');
    clear.type = 'button'; done.type = 'button';
    clear.onclick = () => { multiKeys.forEach(k => delete f[k]); delete f.min; delete f.max; commit(); };
    done.onclick = closePanel;
    foot.append(clear, done); panel.appendChild(foot);
    panel.scrollTop = keep;
  }

  // clicking anywhere outside this block closes the options panel
  let inside = false;
  box.addEventListener('click', () => { inside = true; }, true);
  document.addEventListener('click', () => { if (!inside) closePanel(); inside = false; });

  function refresh(close) {
    if (close) { open = false; openKey = null; }
    showPeriod();
    if (c.q.value !== (f.q || '')) c.q.value = f.q || '';
    renderRow(); renderPanel();
  }
  refresh(true);
  return { refresh };
}
