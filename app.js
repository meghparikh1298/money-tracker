// ====== CONFIG: paste your Client ID here ======
const CONFIG = {
  CLIENT_ID: '1049846042399-rf5rsddh0g6t3es2cv0j2bi1hqe8j7gj.apps.googleusercontent.com',
  FILE_NAME: 'money-tracker.json',
  // drive.file = only the file this app creates; userinfo.profile = your name & photo
  SCOPE: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile',
  payments: ['UPI', 'Credit Card', 'Cash'],
  accounts: ['HDFC', 'BoB', 'SBI'],
  defaults: {   // starting categories -> subcategories (editable later in Settings)
    income:  { 'Salary': [], 'Received from friend/family': [], 'Stocks': [], 'Dividends': [], 'Interest': [] },
    expense: { 'Food': [], 'Groceries': [], 'Entertainment': [], 'Bills': [] }
  }
};
// ===============================================

const $ = id => document.getElementById(id);
const K = { cache: 'mt-cache', dirty: 'mt-dirty', signed: 'mt-signed', user: 'mt-user' };
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const FILES = 'https://www.googleapis.com/drive/v3/files';

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
const nowIso = () => new Date().toISOString();
const localDate = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const inr = n => '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const byNewest = (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt);

function normalize(d) {
  if (!d || !Array.isArray(d.entries)) d = { entries: [] };
  d.version = 2;
  if (!d.categories) d.categories = JSON.parse(JSON.stringify(CONFIG.defaults));
  d.entries.forEach(e => {
    e.id = e.id || uid();
    e.subcategory = e.subcategory || '';
    e.createdAt = e.createdAt || e.date + 'T00:00:00.000Z';
    e.updatedAt = e.updatedAt || e.createdAt;
  });
  return d;
}

let data = normalize(null), fileId = null, type = 'expense', editing = null, shown = 20;
let user = JSON.parse(localStorage.getItem(K.user) || 'null');
let tokenClient = null, accessToken = null, tokenExpiry = 0, pending = null, saveChain = Promise.resolve();

function setState(t) { $('saveState').textContent = t; }
function banner(msg) { $('banner').textContent = msg || ''; $('banner').hidden = !msg; }

// ---------- Google sign-in ----------
function initAuth() {
  if (!window.google || !google.accounts) { setTimeout(initAuth, 150); return; }
  if (CONFIG.CLIENT_ID.startsWith('PASTE_')) { banner('Set CLIENT_ID at the top of app.js first.'); return; }
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CONFIG.CLIENT_ID,
    scope: CONFIG.SCOPE,
    callback: resp => {
      if (resp.error) { pending && pending.rej(new Error(resp.error)); pending = null; return; }
      accessToken = resp.access_token;
      tokenExpiry = Date.now() + (resp.expires_in - 60) * 1000;
      localStorage.setItem(K.signed, '1');
      pending && pending.res(accessToken); pending = null;
    },
    error_callback: e => { pending && pending.rej(new Error(e.type || 'auth_failed')); pending = null; }
  });
  if (localStorage.getItem(K.signed)) start(false);
}

function getToken(prompt) {
  if (accessToken && Date.now() < tokenExpiry) return Promise.resolve(accessToken);
  return new Promise((res, rej) => { pending = { res, rej }; tokenClient.requestAccessToken({ prompt: prompt || '' }); });
}

async function drive(url, opts = {}) {
  const t = await getToken();
  const r = await fetch(url, { ...opts, headers: { Authorization: 'Bearer ' + t, ...(opts.headers || {}) } });
  if (r.status === 401) { accessToken = null; throw new Error('Session expired'); }
  if (!r.ok) throw new Error('Google Drive error ' + r.status);
  return r;
}

async function loadProfile() {
  try {
    const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: 'Bearer ' + accessToken } });
    if (!r.ok) return;
    const p = await r.json();
    user = { name: p.name || p.given_name || '', picture: p.picture || '' };
    localStorage.setItem(K.user, JSON.stringify(user));
    renderUser();
  } catch (e) {}
}

// ---------- Drive JSON file ----------
async function loadFromDrive() {
  const q = encodeURIComponent(`name='${CONFIG.FILE_NAME}' and trashed=false`);
  const list = await (await drive(`${FILES}?q=${q}&fields=files(id)`)).json();
  if (list.files.length) {
    fileId = list.files[0].id;
    data = normalize(await (await drive(`${FILES}/${fileId}?alt=media`)).json());
  } else {
    const b = 'mtboundary';
    const body = `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      JSON.stringify({ name: CONFIG.FILE_NAME, mimeType: 'application/json' }) +
      `\r\n--${b}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(data)}\r\n--${b}--`;
    const created = await (await drive(`${UPLOAD}?uploadType=multipart&fields=id`, {
      method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${b}` }, body
    })).json();
    fileId = created.id;
  }
}

function persist() {
  localStorage.setItem(K.cache, JSON.stringify(data));
  localStorage.setItem(K.dirty, '1');
  setState('Saving…');
  saveChain = saveChain.then(async () => {
    try {
      if (!fileId) throw new Error('not connected');
      await drive(`${UPLOAD}/${fileId}?uploadType=media`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
      });
      localStorage.removeItem(K.dirty);
      setState('Saved to Drive');
    } catch (e) {
      setState('Not saved');
      banner('Could not save to Google Drive (' + e.message + '). Your change is kept on this device; sign in again to sync.');
    }
  });
}

// ---------- Session ----------
function showLogin() { $('app').hidden = true; $('login').hidden = false; }
function showApp() { $('login').hidden = true; $('app').hidden = false; }

async function start(interactive) {
  try {
    banner(''); setState('Signing in…');
    await getToken(interactive ? 'select_account' : '');
    loadProfile();
    showApp(); renderAll();
    const dirty = localStorage.getItem(K.dirty), local = data;
    setState('Loading…');
    await loadFromDrive();
    if (dirty) { data = local; persist(); }
    localStorage.setItem(K.cache, JSON.stringify(data));
    if (!dirty) setState('Loaded from Drive');
    renderAll();
  } catch (e) {
    showLogin(); setState('');
    if (interactive) banner('Sign-in failed: ' + e.message);
  }
}

function signOut() {
  if (accessToken) google.accounts.oauth2.revoke(accessToken, () => {});
  accessToken = null; fileId = null; user = null; data = normalize(null);
  Object.values(K).forEach(k => localStorage.removeItem(k));
  $('menu').hidden = true; showLogin();
}

// ---------- UI helpers ----------
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function fillSelect(id, items, selected, blank) {
  const s = $(id); s.innerHTML = '';
  const list = items.slice(); if (selected && !list.includes(selected)) list.push(selected);
  if (blank) { const o = el('option', '', blank); o.value = ''; s.appendChild(o); }
  list.forEach(v => { const o = el('option', '', v); o.value = v; s.appendChild(o); });
  s.value = selected || (blank ? '' : list[0] || '');
}
function renderUser() {
  const name = (user && user.name) || 'Account';
  $('uName').textContent = name;
  const av = $('avatar'); av.innerHTML = '';
  if (user && user.picture) { const i = el('img'); i.src = user.picture; i.alt = ''; i.referrerPolicy = 'no-referrer'; av.appendChild(i); }
  else av.textContent = name[0].toUpperCase();
}
function view(name) { $('home').hidden = name !== 'home'; $('settings').hidden = name !== 'settings'; $('menu').hidden = true; if (name === 'settings') renderSettings(); }
function renderAll() { renderUser(); renderHome(); if (!$('settings').hidden) renderSettings(); }

// ---------- Home ----------
function renderHome() {
  const m = localDate().slice(0, 7);
  let inc = 0, exp = 0;
  data.entries.filter(e => e.date.slice(0, 7) === m).forEach(e => e.type === 'income' ? inc += e.amount : exp += e.amount);
  $('sumInc').textContent = inr(inc); $('sumExp').textContent = inr(exp);
  const bal = inc - exp;
  $('sumBal').textContent = (bal < 0 ? '-' : '') + inr(Math.abs(bal));
  $('sumBal').className = bal < 0 ? 'exp' : 'inc';

  const rows = data.entries.slice().sort(byNewest);
  const ul = $('list'); ul.innerHTML = '';
  if (!rows.length) { ul.appendChild(el('li', 'empty', 'No transactions yet. Click “+ Add Entry” to start.')); }
  rows.slice(0, shown).forEach(e => {
    const li = el('li'); li.title = 'Click to edit';
    const main = el('div', 'main');
    const cat = el('div', 'cat', e.category);
    if (e.subcategory) cat.appendChild(el('i', '', ' › ' + e.subcategory));
    main.append(cat, el('div', 'meta', [e.date, e.payment, e.account, e.note].filter(Boolean).join(' · ')));
    li.append(main, el('div', 'amt ' + (e.type === 'income' ? 'inc' : 'exp'), (e.type === 'income' ? '+' : '-') + inr(e.amount)));
    li.onclick = () => openDlg(e);
    ul.appendChild(li);
  });
  $('moreBtn').hidden = rows.length <= shown;
}

// ---------- Add / edit dialog ----------
function setType(t, keepCat) {
  type = t;
  document.querySelectorAll('.seg button').forEach(b => b.classList.toggle('on', b.dataset.type === t));
  fillSelect('category', Object.keys(data.categories[t]), keepCat);
  fillSub();
}
function fillSub(selected) {
  fillSelect('subcategory', data.categories[type][$('category').value] || [], selected, '— None —');
}
function openDlg(entry) {
  editing = entry || null;
  $('dlgTitle').textContent = entry ? 'Edit entry' : 'Add entry';
  setType(entry ? entry.type : 'expense', entry && entry.category);
  fillSub(entry && entry.subcategory);
  fillSelect('payment', CONFIG.payments, entry && entry.payment);
  fillSelect('account', CONFIG.accounts, entry && entry.account);
  $('date').value = entry ? entry.date : localDate();
  $('amount').value = entry ? entry.amount : '';
  $('note').value = entry ? entry.note || '' : '';
  $('delBtn').hidden = !entry;
  $('dlg').showModal();
}
function saveEntry(ev) {
  ev.preventDefault();
  const amount = parseFloat($('amount').value);
  if (!(amount > 0)) return;
  const f = { date: $('date').value, type, category: $('category').value, subcategory: $('subcategory').value,
    amount, payment: $('payment').value, account: $('account').value, note: $('note').value.trim() };
  if (editing) Object.assign(editing, f, { updatedAt: nowIso() });
  else { const t = nowIso(); data.entries.push({ id: uid(), ...f, createdAt: t, updatedAt: t }); }
  $('dlg').close(); renderHome(); persist();
}

// ---------- Settings: manage categories ----------
function renderSettings() {
  [['income', 'catIncome'], ['expense', 'catExpense']].forEach(([t, boxId]) => {
    const box = $(boxId); box.innerHTML = '';
    const cats = data.categories[t];
    Object.keys(cats).forEach(name => {
      const card = el('div', 'cat');
      const head = el('div', 'head', name);
      const del = el('button', 'x', '🗑'); del.title = 'Delete category'; del.setAttribute('aria-label', 'Delete ' + name);
      del.onclick = () => { if (confirm(`Delete category “${name}”? Existing entries keep their name.`)) { delete cats[name]; persist(); renderSettings(); } };
      head.appendChild(del);
      const chips = el('div', 'chips');
      cats[name].forEach(s => {
        const c = el('span', 'chip', s);
        const x = el('button', 'x', '✕'); x.setAttribute('aria-label', 'Remove ' + s);
        x.onclick = () => { cats[name] = cats[name].filter(v => v !== s); persist(); renderSettings(); };
        c.appendChild(x); chips.appendChild(c);
      });
      card.append(head, chips, addForm('Add subcategory', v => {
        if (!cats[name].some(s => s.toLowerCase() === v.toLowerCase())) cats[name].push(v);
      }));
      box.appendChild(card);
    });
    box.appendChild(addForm('New ' + t + ' category', v => {
      if (!Object.keys(cats).some(c => c.toLowerCase() === v.toLowerCase())) cats[v] = [];
    }));
  });
}
function addForm(placeholder, onAdd) {
  const f = el('form', 'add');
  const i = el('input'); i.placeholder = placeholder; i.maxLength = 40; i.setAttribute('aria-label', placeholder);
  const b = el('button', 'btn', 'Add'); b.type = 'submit';
  f.append(i, b);
  f.onsubmit = ev => { ev.preventDefault(); const v = i.value.trim(); if (!v) return; onAdd(v); persist(); renderSettings(); };
  return f;
}

// ---------- Init ----------
function init() {
  $('signInBtn').onclick = () => tokenClient ? start(true) : banner('Google sign-in is not ready. Check CLIENT_ID in app.js.');
  $('signOutBtn').onclick = signOut;
  $('addBtn').onclick = () => openDlg(null);
  $('moreBtn').onclick = () => { shown += 20; renderHome(); };
  $('goSettings').onclick = () => view('settings');
  $('backBtn').onclick = () => view('home');
  $('avatar').onclick = ev => { ev.stopPropagation(); $('menu').hidden = !$('menu').hidden; };
  document.addEventListener('click', ev => { if (!ev.target.closest('.acct')) $('menu').hidden = true; });
  document.querySelectorAll('.seg button').forEach(b => b.onclick = () => setType(b.dataset.type));
  $('category').onchange = () => fillSub();
  $('form').onsubmit = saveEntry;
  $('cancelBtn').onclick = () => $('dlg').close();
  $('dlg').onclick = ev => { if (ev.target === $('dlg')) $('dlg').close(); };
  $('delBtn').onclick = () => {
    if (!editing || !confirm('Delete this entry?')) return;
    data.entries = data.entries.filter(x => x.id !== editing.id);
    $('dlg').close(); renderHome(); persist();
  };

  // Returning user: show the cached copy instantly, then sync in the background.
  const cached = localStorage.getItem(K.cache);
  if (localStorage.getItem(K.signed) && cached) {
    try { data = normalize(JSON.parse(cached)); showApp(); renderAll(); } catch (e) {}
  }
  initAuth();
}
document.addEventListener('DOMContentLoaded', init);
