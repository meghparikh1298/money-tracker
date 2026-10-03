let openId = null, focusKey = null;

function addForm(key, placeholder, onAdd) {
  const f = el('form', 'add');
  const i = el('input'); i.placeholder = placeholder; i.maxLength = 40; i.dataset.k = key; i.setAttribute('aria-label', placeholder);
  const b = el('button', 'btn', 'Add'); b.type = 'submit';
  f.append(i, b);
  f.onsubmit = ev => {
    ev.preventDefault();
    const v = i.value.trim(); if (!v) return;
    onAdd(v); focusKey = key; persist(); renderSettings();
  };
  return f;
}
const has = (arr, v) => arr.some(s => s.toLowerCase() === v.toLowerCase());

function chip(text, label, onRemove) {
  const c = el('span', 'chip', text);
  const x = el('button', 'x', '✕'); x.type = 'button'; x.setAttribute('aria-label', 'Remove ' + label);
  x.onclick = onRemove; c.appendChild(x); return c;
}

function renderCategories(panel, s) {
  const cats = data.categories[s.type];
  Object.keys(cats).forEach(name => {
    const card = el('div', 'ccard'), head = el('div', 'head', name);
    const del = el('button', 'x', '🗑'); del.type = 'button'; del.title = 'Delete category'; del.setAttribute('aria-label', 'Delete ' + name);
    del.onclick = () => { if (confirm(`Delete category “${name}”?`)) { delete cats[name]; persist(); renderSettings(); } };
    head.appendChild(del);
    const chips = el('div', 'chips');
    cats[name].forEach(sub => chips.appendChild(chip(sub, sub, () => { cats[name] = cats[name].filter(v => v !== sub); persist(); renderSettings(); })));
    card.append(head, chips, addForm(s.id + ':' + name, 'Add subcategory', v => { if (!has(cats[name], v)) cats[name].push(v); }));
    panel.appendChild(card);
  });
  panel.appendChild(addForm(s.id + ':new', 'New ' + typeOf(s.type).label.toLowerCase() + ' category', v => { if (!has(Object.keys(cats), v)) cats[v] = []; }));
}

function renderList(panel, s) {
  const l = CONFIG.lists.find(x => x.key === s.list), items = data[l.key];
  const chips = el('div', 'chips');
  items.forEach(v => chips.appendChild(chip(v, v, () => {
    if (items.length <= 1) { alert('Keep at least one ' + l.singular + '.'); return; }
    data[l.key] = items.filter(x => x !== v); persist(); renderSettings();
  })));
  panel.append(chips, addForm(s.id + ':new', 'New ' + l.singular, v => { if (!has(items, v)) items.push(v); }));
}

function renderSettings() {
  const root = $('sections'); root.innerHTML = '';
  CONFIG.sections.forEach(s => {
    const isOpen = openId === s.id;
    const count = s.kind === 'categories' ? Object.keys(data.categories[s.type]).length : data[s.list].length;
    const box = el('section', 'acc' + (isOpen ? ' open' : ''));
    const head = el('button', 'acc-head'); head.type = 'button'; head.setAttribute('aria-expanded', isOpen);
    head.append(el('span', 't', s.title), el('span', 'count', count), el('span', 'chev', '›'));
    head.onclick = () => { openId = isOpen ? null : s.id; renderSettings(); };
    box.appendChild(head);
    if (isOpen) {
      const body = el('div', 'acc-body');
      (s.kind === 'categories' ? renderCategories : renderList)(body, s);
      box.appendChild(body);
    }
    root.appendChild(box);
  });
  if (focusKey) {
    const i = [...document.querySelectorAll('input[data-k]')].find(x => x.dataset.k === focusKey);
    if (i) i.focus(); focusKey = null;
  }
}

function init() {
  if (!localStorage.getItem(K.signed)) { location.replace('index.html'); return; }
  loadCache(); renderSettings();
  connect(false).then(renderSettings).catch(() => location.replace('index.html'));
}
document.addEventListener('DOMContentLoaded', init);
