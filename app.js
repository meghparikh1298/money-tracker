// ====== CONFIG: edit this section ======
const CONFIG = {
  CLIENT_ID: '1049846042399-rf5rsddh0g6t3es2cv0j2bi1hqe8j7gj.apps.googleusercontent.com',
  FILE_NAME: 'money-tracker.json',
  SCOPE: 'https://www.googleapis.com/auth/drive.file', // only files this app creates
  income:   ['Salary', 'Received from friend/family', 'Stocks', 'Dividends', 'Interest'],
  expense:  ['Food', 'Groceries', 'Entertainment', 'Bills'],
  payments: ['UPI', 'Credit Card', 'Cash'],
  accounts: ['HDFC', 'BoB', 'SBI']
};
// =======================================

const $ = id => document.getElementById(id);
const CACHE_KEY = 'mt-cache', DIRTY_KEY = 'mt-dirty', SIGNED_KEY = 'mt-signed';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const FILES = 'https://www.googleapis.com/drive/v3/files';

let data = { version: 1, entries: [] };
let fileId = null, type = 'expense';
let tokenClient = null, accessToken = null, tokenExpiry = 0, pending = null;
let saveChain = Promise.resolve();

const inr = n => '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const setState = t => { $('saveState').textContent = t; };
function banner(msg) { $('banner').textContent = msg || ''; $('banner').hidden = !msg; }

// ---------- Google sign-in (Google Identity Services) ----------
function initAuth() {
  if (!window.google || !google.accounts) { setTimeout(initAuth, 150); return; }
  if (CONFIG.CLIENT_ID.startsWith('PASTE_')) {
    banner('Set CLIENT_ID in app.js first (see README steps).'); return;
  }
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CONFIG.CLIENT_ID,
    scope: CONFIG.SCOPE,
    callback: resp => {
      if (resp.error) { pending && pending.rej(new Error(resp.error)); pending = null; return; }
      accessToken = resp.access_token;
      tokenExpiry = Date.now() + (resp.expires_in - 60) * 1000;
      localStorage.setItem(SIGNED_KEY, '1');
      pending && pending.res(accessToken); pending = null;
    },
    error_callback: e => { pending && pending.rej(new Error(e.type || 'auth_failed')); pending = null; }
  });
  // If the user signed in before, try to restore the session silently.
  if (localStorage.getItem(SIGNED_KEY)) start(false);
}

function getToken(prompt) {
  if (accessToken && Date.now() < tokenExpiry) return Promise.resolve(accessToken);
  return new Promise((res, rej) => {
    pending = { res, rej };
    tokenClient.requestAccessToken({ prompt: prompt || '' });
  });
}

async function drive(url, opts = {}) {
  const t = await getToken();
  const r = await fetch(url, { ...opts, headers: { Authorization: 'Bearer ' + t, ...(opts.headers || {}) } });
  if (r.status === 401) { accessToken = null; throw new Error('Session expired'); }
  if (!r.ok) throw new Error('Google Drive error ' + r.status);
  return r;
}

// ---------- Drive JSON file ----------
async function loadFromDrive() {
  const q = encodeURIComponent(`name='${CONFIG.FILE_NAME}' and trashed=false`);
  const list = await (await drive(`${FILES}?q=${q}&fields=files(id)`)).json();
  if (list.files.length) {
    fileId = list.files[0].id;
    const remote = await (await drive(`${FILES}/${fileId}?alt=media`)).json();
    if (remote && Array.isArray(remote.entries)) data = remote;
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
  localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  localStorage.setItem(DIRTY_KEY, '1');
  setState('Saving…');
  saveChain = saveChain.then(async () => {
    try {
      await drive(`${UPLOAD}/${fileId}?uploadType=media`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
      });
      localStorage.removeItem(DIRTY_KEY);
      setState('Saved to Drive');
    } catch (e) {
      setState('Not saved – click Sign in to retry');
      banner('Could not save to Google Drive (' + e.message + '). Your change is kept on this device; sign in again to sync.');
    }
  });
}

// ---------- Start / stop ----------
async function start(interactive) {
  try {
    banner('');
    setState('Signing in…');
    await getToken(interactive ? 'select_account' : '');
    // Show cached copy instantly while Drive loads
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) { try { data = JSON.parse(cached); } catch (e) {} }
    showApp(); render();
    const dirty = localStorage.getItem(DIRTY_KEY);
    const local = data;
    await loadFromDrive();
    if (dirty) { data = local; persist(); }   // unsynced local changes win
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    setState(dirty ? 'Saving…' : 'Loaded from Drive');
    render();
  } catch (e) {
    $('signInBtn').hidden = false;
    setState('');
    if (interactive) banner('Sign-in failed: ' + e.message);
  }
}

function showApp() {
  $('welcome').hidden = true; $('app').hidden = false;
  $('signInBtn').hidden = true; $('signOutBtn').hidden = false;
}

function signOut() {
  if (accessToken) google.accounts.oauth2.revoke(accessToken, () => {});
  accessToken = null; fileId = null; data = { version: 1, entries: [] };
  localStorage.removeItem(SIGNED_KEY); localStorage.removeItem(CACHE_KEY); localStorage.removeItem(DIRTY_KEY);
  $('app').hidden = true; $('welcome').hidden = false;
  $('signInBtn').hidden = false; $('signOutBtn').hidden = true; setState('');
}

// ---------- UI ----------
function fillSelect(id, items) {
  $(id).innerHTML = '';
  items.forEach(v => { const o = document.createElement('option'); o.value = o.textContent = v; $(id).appendChild(o); });
}
function setType(t) {
  type = t;
  document.querySelectorAll('.seg button').forEach(b => b.classList.toggle('on', b.dataset.type === t));
  fillSelect('category', CONFIG[t]);
}
function shiftMonth(n) {
  const [y, m] = $('month').value.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  $('month').value = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  render();
}

function render() {
  const m = $('month').value;
  const rows = data.entries.filter(e => e.date.slice(0, 7) === m)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  let inc = 0, exp = 0;
  rows.forEach(e => e.type === 'income' ? inc += e.amount : exp += e.amount);
  $('sumInc').textContent = inr(inc);
  $('sumExp').textContent = inr(exp);
  const bal = inc - exp;
  $('sumBal').textContent = (bal < 0 ? '-' : '') + inr(Math.abs(bal));
  $('sumBal').className = bal < 0 ? 'exp' : 'inc';

  const ul = $('list'); ul.innerHTML = '';
  if (!rows.length) { ul.innerHTML = '<li class="empty">No entries this month. Add your first one above.</li>'; return; }
  rows.forEach(e => {
    const li = document.createElement('li');
    const main = document.createElement('div'); main.className = 'main';
    const cat = document.createElement('div'); cat.className = 'cat'; cat.textContent = e.category;
    const meta = document.createElement('div'); meta.className = 'meta';
    meta.textContent = [e.date, e.payment, e.account, e.note].filter(Boolean).join(' · ');
    main.append(cat, meta);
    const amt = document.createElement('div');
    amt.className = 'amt ' + (e.type === 'income' ? 'inc' : 'exp');
    amt.textContent = (e.type === 'income' ? '+' : '-') + inr(e.amount);
    const del = document.createElement('button');
    del.className = 'del'; del.textContent = '✕'; del.setAttribute('aria-label', 'Delete entry');
    del.onclick = () => {
      if (!confirm('Delete this entry?')) return;
      data.entries = data.entries.filter(x => x.id !== e.id);
      render(); persist();
    };
    li.append(main, amt, del); ul.appendChild(li);
  });
}

function init() {
  const today = new Date().toISOString().slice(0, 10);
  $('date').value = today; $('month').value = today.slice(0, 7);
  fillSelect('payment', CONFIG.payments); fillSelect('account', CONFIG.accounts); setType('expense');

  document.querySelectorAll('.seg button').forEach(b => b.onclick = () => setType(b.dataset.type));
  $('prev').onclick = () => shiftMonth(-1);
  $('next').onclick = () => shiftMonth(1);
  $('month').onchange = render;
  $('signInBtn').onclick = () => tokenClient ? start(true) : banner('Google sign-in is not ready yet. Check CLIENT_ID in app.js.');
  $('signOutBtn').onclick = signOut;

  $('form').onsubmit = ev => {
    ev.preventDefault();
    const amount = parseFloat($('amount').value);
    if (!(amount > 0)) return;
    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      date: $('date').value, type, category: $('category').value, amount,
      payment: $('payment').value, account: $('account').value, note: $('note').value.trim()
    };
    data.entries.push(entry);
    $('month').value = entry.date.slice(0, 7);
    $('amount').value = ''; $('note').value = '';
    render(); persist();
  };
  initAuth();
}
document.addEventListener('DOMContentLoaded', init);
