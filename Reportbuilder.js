// Build-your-own reports. Saved in data.reports (inside money-tracker.json) until you delete them.
const NS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); return n; };
const dimensions = () => CONFIG.report.dimensions.concat(CONFIG.lists.map(l => ({ id: l.field, label: l.label })));
const labelOf = (arr, id) => (arr.find(x => x.id === id) || {}).label || id;
const groupKey = (e, d) => d === 'month' ? e.date.slice(0, 7) : d === 'type' ? typeOf(e.type).label : (e[d] || '(none)');
const colour = k => CONFIG.chartColors[k % CONFIG.chartColors.length];

// ---------- data ----------
function reportItems(r) {
  const g = new Map();
  data.entries.filter(e => matches(e, r.filters || {})).forEach(e => {
    const k = groupKey(e, r.dimension), a = g.get(k) || { sum: 0, n: 0 };
    a.sum += e.amount; a.n++; g.set(k, a);
  });
  const items = [...g].map(([label, a]) => ({ label, value: r.measure === 'count' ? a.n : r.measure === 'avg' ? a.sum / a.n : a.sum }));
  return items.sort(r.dimension === 'month' ? (a, b) => a.label.localeCompare(b.label) : (a, b) => b.value - a.value);
}

// ---------- charts ----------
const charts = {
  bar: (box, items, fmt) => hbars(box, items, fmt),

  column(box, items, fmt) {
    const plot = el('div', 'plot scroll'), max = Math.max(...items.map(i => i.value), 1);
    items.forEach(i => {
      const col = el('div', 'pcol tint'), bar = el('div', 'cbar');
      bar.style.height = `calc((100% - 56px) * ${i.value / max})`;
      col.append(el('div', 'cval', fmt(i.value)), bar, el('div', 'clab', i.label)); plot.appendChild(col);
    });
    box.appendChild(plot);
  },

  pie(box, items, fmt, share) {
    const total = items.reduce((s, i) => s + i.value, 0);
    if (!total) { box.appendChild(el('p', 'muted', 'Nothing to show.')); return; }
    const R = 70, C = 2 * Math.PI * R, svg = svgEl('svg', { viewBox: '0 0 200 200', width: 190, height: 190 });
    const legend = el('ul', 'legend'); let off = 0;
    items.forEach((i, k) => {
      const len = i.value / total * C;
      svg.appendChild(svgEl('circle', { cx: 100, cy: 100, r: R, fill: 'none', stroke: colour(k), 'stroke-width': 38,
        'stroke-dasharray': `${len} ${C - len}`, 'stroke-dashoffset': -off, transform: 'rotate(-90 100 100)' }));
      off += len;
      const li = el('li'), sw = el('span', 'sw'); sw.style.background = colour(k);
      li.append(sw, el('span', 'lt', i.label), el('span', 'lv', fmt(i.value) + (share ? ' · ' + Math.round(i.value / total * 100) + '%' : '')));
      legend.appendChild(li);
    });
    const wrap = el('div', 'piewrap'); wrap.append(svg, legend); box.appendChild(wrap);
  },

  line(box, items, fmt) {
    const W = 640, H = 230, P = 36, n = items.length, max = Math.max(...items.map(i => i.value), 1);
    const x = k => n > 1 ? P + k * (W - 2 * P) / (n - 1) : W / 2, y = v => H - P - v / max * (H - 2 * P);
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img' });
    svg.appendChild(svgEl('line', { x1: P, y1: H - P, x2: W - P, y2: H - P, stroke: 'currentColor', 'stroke-opacity': 0.25 }));
    svg.appendChild(svgEl('polyline', { points: items.map((i, k) => x(k) + ',' + y(i.value)).join(' '), fill: 'none', stroke: 'currentColor', 'stroke-width': 2.5, 'stroke-linejoin': 'round' }));
    const every = Math.ceil(n / 8);
    items.forEach((i, k) => {
      svg.appendChild(svgEl('circle', { cx: x(k), cy: y(i.value), r: 3.5, fill: 'currentColor' }));
      if (k % every && k !== n - 1) return;
      const t = svgEl('text', { x: x(k), y: H - 12, 'text-anchor': 'middle', class: 'svgt' }); t.textContent = i.label; svg.appendChild(t);
      const v = svgEl('text', { x: x(k), y: y(i.value) - 9, 'text-anchor': 'middle', class: 'svgt' }); v.textContent = fmt(i.value); svg.appendChild(v);
    });
    const w = el('div', 'linewrap tint'); w.appendChild(svg); box.appendChild(w);
  },

  table(box, items, fmt, share) {
    const total = items.reduce((s, i) => s + i.value, 0), t = el('table', 'tbl');
    const row = (a, b, c, cls) => { const tr = el('tr', cls); tr.append(el('td', '', a), el('td', 'num', b), el('td', 'num muted', c)); t.appendChild(tr); };
    items.forEach(i => row(i.label, fmt(i.value), share && total ? Math.round(i.value / total * 100) + '%' : ''));
    if (share) row('Total', fmt(total), '', 'total');
    box.appendChild(t);
  }
};

function drawReport(box, r) {
  box.innerHTML = '';
  const items = reportItems(r);
  if (!items.length) { box.appendChild(el('p', 'muted', 'No transactions match this report’s filters.')); return; }
  const fmt = r.measure === 'count' ? n => String(Math.round(n)) : money;
  (charts[r.chart] || charts.bar)(box, items, fmt, r.measure !== 'avg');
}

// ---------- saved reports on the page ----------
function renderMyReports() {
  const box = $('myReports'); if (!box) return; box.innerHTML = '';
  if (!data.reports.length) { box.appendChild(el('p', 'muted', 'No custom reports yet. Click “＋ New report” to build one.')); return; }
  data.reports.forEach(r => {
    const card = el('section', 'panelbox'), head = el('div', 'rhead'), title = el('div');
    title.append(el('h2', '', r.name),
      el('small', 'muted', `${labelOf(CONFIG.report.charts, r.chart)} · ${labelOf(CONFIG.report.measures, r.measure)} by ${labelOf(dimensions(), r.dimension)}`));
    const edit = el('button', 'btn', 'Edit'), del = el('button', 'btn danger', 'Delete');
    edit.onclick = () => openReport(r);
    del.onclick = () => { if (confirm(`Delete report “${r.name}”?`)) { data.reports = data.reports.filter(x => x.id !== r.id); renderMyReports(); persist(); } };
    const acts = el('div', 'racts'); acts.append(edit, del); head.append(title, acts);
    const body = el('div'); card.append(head, body); box.appendChild(card);
    drawReport(body, r);
  });
}

// ---------- builder dialog ----------
let draft = null, editId = null;
function mountBuilder() {
  if ($('rdlg')) return;
  const d = document.createElement('dialog'); d.id = 'rdlg';
  d.innerHTML = `<form id="rform"><h2 id="rTitle">New report</h2>
    <div class="grid">
      <label class="wide">Report name <input id="rName" required maxlength="60" placeholder="e.g. Monthly spend by category"></label>
      <label>Chart <select id="rChart"></select></label>
      <label>Measure <select id="rMeasure"></select></label>
      <label class="wide">Group by <select id="rDim"></select></label>
    </div>
    <h3 class="subh">Filters <small class="muted">(leave empty to include everything)</small></h3><div id="rFilters"></div>
    <h3 class="subh">Preview</h3><div id="rPreview" class="preview"></div>
    <div class="actions"><button type="button" id="rDel" class="btn danger" hidden>Delete</button><span class="grow"></span>
      <button type="button" id="rCancel" class="btn">Cancel</button><button type="submit" class="btn primary">Save report</button></div></form>`;
  document.body.appendChild(d);
  fillObjSelect('rChart', CONFIG.report.charts); fillObjSelect('rMeasure', CONFIG.report.measures); fillObjSelect('rDim', dimensions());
  ['rChart', 'rMeasure', 'rDim'].forEach(id => $(id).onchange = preview);
  $('rName').oninput = readDraft;
  $('rCancel').onclick = () => d.close();
  d.onclick = ev => { if (ev.target === d) d.close(); };
  $('rDel').onclick = () => {
    if (!editId || !confirm('Delete this report?')) return;
    data.reports = data.reports.filter(x => x.id !== editId); d.close(); renderMyReports(); persist();
  };
  $('rform').onsubmit = saveReport;
}
function readDraft() {
  draft.name = $('rName').value.trim(); draft.chart = $('rChart').value;
  draft.measure = $('rMeasure').value; draft.dimension = $('rDim').value;
}
function preview() { readDraft(); drawReport($('rPreview'), draft); }

function openReport(r) {
  mountBuilder(); editId = r ? r.id : null;
  draft = r ? clone(r) : { name: '', chart: CONFIG.report.charts[0].id, measure: CONFIG.report.measures[0].id, dimension: CONFIG.report.dimensions[0].id };
  draft.filters = draft.filters || {};
  $('rTitle').textContent = r ? 'Edit report' : 'New report';
  $('rName').value = draft.name;
  fillObjSelect('rChart', CONFIG.report.charts, draft.chart);
  fillObjSelect('rMeasure', CONFIG.report.measures, draft.measure);
  fillObjSelect('rDim', dimensions(), draft.dimension);
  $('rDel').hidden = !r;
  buildFilters($('rFilters'), draft.filters, preview);
  preview(); $('rdlg').showModal();
}

function saveReport(ev) {
  ev.preventDefault(); readDraft();
  const t = nowIso(), filters = clean({ ...draft.filters });
  const body = { name: draft.name, chart: draft.chart, measure: draft.measure, dimension: draft.dimension };
  if (Object.keys(filters).length) body.filters = filters;
  if (editId) {
    const r = data.reports.find(x => x.id === editId);
    if (r) { delete r.filters; Object.assign(r, body, { updatedAt: t }); }
  } else data.reports.push({ id: uid(), ...body, createdAt: t, updatedAt: t });
  $('rdlg').close(); renderMyReports(); persist();
}

document.addEventListener('DOMContentLoaded', () => { $('newReport').onclick = () => openReport(null); });