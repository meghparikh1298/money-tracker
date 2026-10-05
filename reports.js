let month = localDate().slice(0, 7);

function shiftMonth(n) {
  const [y, m] = month.split('-').map(Number), d = new Date(y, m - 1 + n, 1);
  month = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  renderReports();
}

function renderReports() {
  $('month').value = month;
  const inc = CONFIG.entryTypes.find(t => t.sign > 0), exp = CONFIG.entryTypes.find(t => t.sign < 0);
  const rows = data.entries.filter(e => e.date.slice(0, 7) === month);
  const sum = a => a.reduce((s, e) => s + e.amount, 0);
  const isInvest = e => e.category.toLowerCase() === INVESTMENT.toLowerCase();

  const income = sum(rows.filter(e => e.type === inc.id));
  const expenses = rows.filter(e => e.type === exp.id);
  const invest = sum(expenses.filter(isInvest));
  const spend = sum(expenses) - invest;

  // Chart 1: income vs spend vs investment
  const plot = $('plot'); plot.innerHTML = '';
  const bars = [
    { label: inc.label, value: income, cls: inc.cls },
    { label: 'Spend', value: spend, cls: exp.cls },
    { label: INVESTMENT, value: invest, cls: 'invc' }
  ];
  const max = Math.max(...bars.map(b => b.value), 1);
  bars.forEach(b => {
    const col = el('div', 'pcol ' + b.cls), bar = el('div', 'cbar');
    bar.style.height = `calc((100% - 56px) * ${b.value / max})`;
    col.append(el('div', 'cval', money(b.value)), bar, el('div', 'clab', b.label));
    plot.appendChild(col);
  });
  const left = income - spend - invest;
  $('left').textContent = `Left after spend and investment: ${left < 0 ? '-' : ''}${money(Math.abs(left))}`;

  // Chart 2: expense by category
  const byCat = {};
  expenses.forEach(e => { byCat[e.category] = (byCat[e.category] || 0) + e.amount; });
  const items = Object.keys(byCat).map(k => ({ label: k, value: byCat[k], cls: k.toLowerCase() === INVESTMENT.toLowerCase() ? 'invc' : exp.cls }))
    .sort((a, b) => b.value - a.value);
  const cb = $('catbars'); cb.innerHTML = '';
  if (items.length) hbars(cb, items); else cb.appendChild(el('p', 'muted', 'No expenses in this month.'));
}

document.addEventListener('DOMContentLoaded', () => {
  $('prev').onclick = () => shiftMonth(-1);
  $('next').onclick = () => shiftMonth(1);
  $('month').onchange = () => { if ($('month').value) { month = $('month').value; renderReports(); } };
  initPage('reports', renderReports);
});