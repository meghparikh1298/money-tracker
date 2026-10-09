let shown = CONFIG.pageSize;

function showLogin() { $('app').hidden = true; $('login').hidden = false; }
function showApp() { $('login').hidden = true; $('app').hidden = false; }

function renderUser() {
  const name = (user && user.name) || 'Account';
  $('uName').textContent = name;
  const av = $('avatar'); av.innerHTML = '';
  if (user && user.picture) { const i = el('img'); i.src = user.picture; i.alt = ''; i.referrerPolicy = 'no-referrer'; av.appendChild(i); }
  else av.textContent = name[0].toUpperCase();
}

// ---------- Home ----------
function renderHome() {
  const m = localDate().slice(0, 7), box = $('summary');
  box.innerHTML = ''; box.style.gridTemplateColumns = `repeat(${CONFIG.entryTypes.length + 1},1fr)`;
  const card = (label, value, cls) => { const d = el('div'); d.append(el('span', '', label), el('b', cls, value)); box.appendChild(d); };
  let bal = 0;
  CONFIG.entryTypes.forEach(t => {
    const sum = data.entries.filter(e => e.type === t.id && e.date.slice(0, 7) === m).reduce((a, e) => a + e.amount, 0);
    bal += t.sign * sum; card(t.label + ' (this month)', money(sum), t.cls);
  });
  const pos = CONFIG.entryTypes.find(t => t.sign > 0), neg = CONFIG.entryTypes.find(t => t.sign < 0);
  card('Balance', (bal < 0 ? '-' : '') + money(Math.abs(bal)), bal < 0 ? neg && neg.cls : pos && pos.cls);

  const rows = data.entries.slice().sort(byNewest);
  const ul = $('list'); ul.innerHTML = '';
  if (!rows.length) ul.appendChild(el('li', 'empty', 'No transactions yet. Click “+ Add Entry” to start.'));
  rows.slice(0, shown).forEach(e => ul.appendChild(entryRow(e)));
  $('moreBtn').hidden = rows.length <= shown;
  $('moreBtn').textContent = `Show ${CONFIG.pageSize} more`;
}

// ---------- Session ----------
async function go(interactive) {
  try {
    banner('');
    await connect(interactive);
    showApp(); renderUser(); renderHome();
  } catch (e) {
    showLogin(); setState('');
    if (interactive || /CLIENT_ID/.test(e.message)) banner((interactive ? 'Sign-in failed: ' : '') + e.message);
  }
}

function init() {
  mountNav('transactions'); initEntryForm(renderHome); onProfile = renderUser;
  $('signInBtn').onclick = () => go(true);
  $('signOutBtn').onclick = () => { signOut(); $('menu').hidden = true; showLogin(); };
  $('addBtn').onclick = () => openDlg(null);
  $('moreBtn').onclick = () => { shown += CONFIG.pageSize; renderHome(); };
  $('goSettings').onclick = () => { location.href = 'settings.html'; };
  $('avatar').onclick = ev => { ev.stopPropagation(); $('menu').hidden = !$('menu').hidden; };
  document.addEventListener('click', ev => { if (!ev.target.closest('.acct')) $('menu').hidden = true; });
  if (localStorage.getItem(K.signed)) {
    if (loadCache()) { showApp(); renderUser(); renderHome(); }   // instant paint from cache
    go(false);                                                     // then sync with Drive
  }
}
document.addEventListener('DOMContentLoaded', init);