// Shared by index.html and settings.html
const $ = id => document.getElementById(id);
const K = { cache: 'mt-cache', dirty: 'mt-dirty', signed: 'mt-signed', user: 'mt-user', token: 'mt-token' };
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const FILES = 'https://www.googleapis.com/drive/v3/files';

const clone = o => JSON.parse(JSON.stringify(o));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
const nowIso = () => new Date().toISOString();
const localDate = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const money = n => CONFIG.currency.symbol + Number(n).toLocaleString(CONFIG.currency.locale, { maximumFractionDigits: 2 });
const typeOf = id => CONFIG.entryTypes.find(t => t.id === id) || CONFIG.entryTypes[0];

function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function fillSelect(id, items, selected, blank) {
  const s = $(id); s.innerHTML = '';
  const list = items.slice(); if (selected && !list.includes(selected)) list.push(selected);
  if (blank) { const o = el('option', '', blank); o.value = ''; s.appendChild(o); }
  list.forEach(v => { const o = el('option', '', v); o.value = v; s.appendChild(o); });
  s.value = selected || (blank ? '' : list[0] || '');
}
function setState(t) { const s = $('saveState'); if (s) s.textContent = t; }
function banner(msg) { const b = $('banner'); if (b) { b.textContent = msg || ''; b.hidden = !msg; } }

function normalize(d) {
  if (!d || !Array.isArray(d.entries)) d = { entries: [] };
  d.version = 3;
  d.categories = d.categories || {};
  CONFIG.entryTypes.forEach(t => { if (!d.categories[t.id]) d.categories[t.id] = clone(CONFIG.defaults.categories[t.id] || {}); });
  CONFIG.lists.forEach(l => { if (!Array.isArray(d[l.key]) || !d[l.key].length) d[l.key] = (CONFIG.defaults[l.key] || []).slice(); });
  d.entries.forEach(e => {
    e.id = e.id || uid();
    e.subcategory = e.subcategory || '';
    e.createdAt = e.createdAt || e.date + 'T00:00:00.000Z';
    e.updatedAt = e.updatedAt || e.createdAt;
  });
  return d;
}

let data = normalize(null), fileId = null, onProfile = null;
let user = JSON.parse(localStorage.getItem(K.user) || 'null');
let tokenClient = null, accessToken = null, tokenExpiry = 0, pending = null, saveChain = Promise.resolve();
try { const t = JSON.parse(sessionStorage.getItem(K.token) || 'null'); if (t && t.exp > Date.now()) { accessToken = t.t; tokenExpiry = t.exp; } } catch (e) {}

function loadCache() {
  try { const c = localStorage.getItem(K.cache); if (c) { data = normalize(JSON.parse(c)); return true; } } catch (e) {}
  return false;
}

// ---------- Google sign-in ----------
function gisReady() {
  return new Promise((res, rej) => {
    if (CONFIG.CLIENT_ID.startsWith('PASTE_')) return rej(new Error('Set CLIENT_ID in config.js'));
    let n = 0;
    (function wait() {
      if (window.google && google.accounts) {
        if (!tokenClient) tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: CONFIG.CLIENT_ID,
          scope: CONFIG.SCOPE,
          callback: resp => {
            if (resp.error) { pending && pending.rej(new Error(resp.error)); pending = null; return; }
            accessToken = resp.access_token;
            tokenExpiry = Date.now() + (resp.expires_in - 60) * 1000;
            sessionStorage.setItem(K.token, JSON.stringify({ t: accessToken, exp: tokenExpiry }));
            localStorage.setItem(K.signed, '1');
            pending && pending.res(accessToken); pending = null;
          },
          error_callback: e => { pending && pending.rej(new Error(e.type || 'auth_failed')); pending = null; }
        });
        return res();
      }
      if (++n > 100) return rej(new Error('Google script failed to load'));
      setTimeout(wait, 150);
    })();
  });
}

async function getToken(prompt) {
  if (accessToken && Date.now() < tokenExpiry) return accessToken;
  await gisReady();
  return new Promise((res, rej) => { pending = { res, rej }; tokenClient.requestAccessToken({ prompt: prompt || '' }); });
}

async function drive(url, opts = {}) {
  const t = await getToken();
  const r = await fetch(url, { ...opts, headers: { Authorization: 'Bearer ' + t, ...(opts.headers || {}) } });
  if (r.status === 401) { accessToken = null; sessionStorage.removeItem(K.token); throw new Error('Session expired'); }
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
    onProfile && onProfile();
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
      if (!fileId) throw new Error('not connected yet');
      await drive(`${UPLOAD}/${fileId}?uploadType=media`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
      });
      localStorage.removeItem(K.dirty);
      setState('Saved to Drive');
    } catch (e) {
      setState('Not saved');
      banner('Could not save to Google Drive (' + e.message + '). Your change is kept on this device and will sync next time.');
    }
  });
}

// Sign in (or restore session), then load the Drive file. Unsynced local changes win.
async function connect(interactive) {
  await getToken(interactive ? 'select_account' : '');
  loadProfile();
  const dirty = localStorage.getItem(K.dirty), local = data;
  setState('Loading…');
  await loadFromDrive();
  if (dirty) { data = local; persist(); }
  localStorage.setItem(K.cache, JSON.stringify(data));
  if (!dirty) setState('Loaded from Drive');
}

function signOut() {
  if (accessToken && window.google) google.accounts.oauth2.revoke(accessToken, () => {});
  accessToken = null; fileId = null; user = null; data = normalize(null);
  Object.values(K).forEach(k => { localStorage.removeItem(k); sessionStorage.removeItem(k); });
}
