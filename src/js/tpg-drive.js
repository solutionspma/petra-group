/**
 * TPG My Drive — Supabase or browser demo; OneDrive-style UI.
 */
import { isDriveConfigured } from './supabase-runtime-config.js';

const DEMO_STORAGE_KEY = 'tpg_mydrive_demo_v1';
const DEMO_USER_LABEL = 'Demo session (this browser only)';
const WELCOME_KEY = 'tpg_drive_welcome_dismissed';

let supabase = null;
let DRIVE_BUCKET = 'tpg-private';
let currentUserId = null;
/** @type {{ name: string, size: number|null, updated: string, path: string, demo: boolean }[]} */
let rawFileItems = [];
let appChromeBound = false;
let isDemoSession = false;

const $ = (id) => document.getElementById(id);

function useDemoMode() {
  const q = new URLSearchParams(window.location.search).get('demo');
  if (q === '1' || q === 'true') return true;
  return !isDriveConfigured();
}

function setStatus(msg, isErr = false) {
  const appPanel = $('drive-app-panel');
  const inApp = appPanel && !appPanel.hidden;
  const el = inApp ? $('drive-status-app') : $('drive-status');
  if (!el) return;
  el.textContent = msg || '';
  el.style.color = isErr ? '#b71c1c' : inApp ? '#555' : '#333';
}

function formatBytes(n) {
  if (n == null || Number.isNaN(n)) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function showPreApp() {
  const pre = $('drive-pre-app');
  const app = $('drive-app-panel');
  if (pre) pre.hidden = false;
  if (app) app.hidden = true;
}

function showAppShell() {
  const pre = $('drive-pre-app');
  const app = $('drive-app-panel');
  if (pre) pre.hidden = true;
  if (app) app.hidden = false;
  bindAppChrome();
  applyWelcomeVisibility();
  applyViewModeClass();
}

function bindAppChrome() {
  if (appChromeBound) return;
  appChromeBound = true;

  $('drive-nav-files')?.addEventListener('click', (e) => e.preventDefault());

  $('drive-view-grid')?.addEventListener('click', () => {
    $('drive-view-grid')?.classList.add('is-active');
    $('drive-view-list')?.classList.remove('is-active');
    $('drive-app-panel')?.classList.remove('od-view-list');
    $('drive-app-panel')?.classList.add('od-view-grid');
  });

  $('drive-view-list')?.addEventListener('click', () => {
    $('drive-view-list')?.classList.add('is-active');
    $('drive-view-grid')?.classList.remove('is-active');
    $('drive-app-panel')?.classList.remove('od-view-grid');
    $('drive-app-panel')?.classList.add('od-view-list');
  });

  $('drive-sort')?.addEventListener('change', () => renderAllFiles());
  $('drive-sidebar-search')?.addEventListener('input', () => renderAllFiles());

  $('drive-welcome-dismiss')?.addEventListener('click', () => {
    try {
      localStorage.setItem(WELCOME_KEY, '1');
    } catch {
      /* ignore */
    }
    $('drive-welcome').hidden = true;
  });
}

function applyWelcomeVisibility() {
  const w = $('drive-welcome');
  if (!w) return;
  try {
    w.hidden = localStorage.getItem(WELCOME_KEY) === '1';
  } catch {
    w.hidden = false;
  }
}

function applyViewModeClass() {
  const shell = $('drive-app-panel');
  if (!shell) return;
  shell.classList.add('od-view-grid');
  shell.classList.remove('od-view-list');
}

function getFilteredSortedItems() {
  const q = ($('drive-sidebar-search')?.value || '').trim().toLowerCase();
  const sort = $('drive-sort')?.value || 'date-desc';

  let items = [...rawFileItems];
  if (q) items = items.filter((f) => f.name.toLowerCase().includes(q));

  items.sort((a, b) => {
    switch (sort) {
      case 'name-asc':
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      case 'name-desc':
        return b.name.localeCompare(a.name, undefined, { sensitivity: 'base' });
      case 'date-asc':
        return (a.updated || '').localeCompare(b.updated || '');
      case 'date-desc':
      default:
        return (b.updated || '').localeCompare(a.updated || '');
    }
  });
  return items;
}

function renderAllFiles() {
  const items = getFilteredSortedItems();
  const grid = $('drive-file-grid');
  const tbody = $('drive-file-tbody');
  const empty = $('drive-empty');

  if (!grid || !tbody) return;

  if (!items.length) {
    grid.innerHTML = '';
    tbody.innerHTML = '';
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;

  grid.innerHTML = items
    .map(
      (f) => `
    <div class="od-tile-wrap" role="group" aria-label="${escapeHtml(f.name)}">
      <div class="od-tile" data-name="${escapeHtml(f.name)}" data-demo="${f.demo ? '1' : '0'}" data-path="${escapeHtml(f.path)}" tabindex="0">
        <div class="od-tile-actions">
          <button type="button" class="od-tile-action drive-dl" title="Download">↓</button>
          <button type="button" class="od-tile-action del drive-del" title="Delete">×</button>
        </div>
        <span class="od-tile-icon" aria-hidden="true">📄</span>
        <div class="od-tile-meta">
          <span class="od-tile-name">${escapeHtml(f.name)}</span>
          <span class="od-tile-size">${escapeHtml(formatBytes(f.size))}</span>
        </div>
      </div>
    </div>`
    )
    .join('');

  tbody.innerHTML = items
    .map(
      (f) => `
    <tr data-name="${escapeHtml(f.name)}" data-demo="${f.demo ? '1' : '0'}" data-path="${escapeHtml(f.path)}">
      <td>${escapeHtml(f.name)}</td>
      <td>${escapeHtml(formatBytes(f.size))}</td>
      <td class="od-list-muted">${f.updated ? escapeHtml(f.updated.slice(0, 19).replace('T', ' ')) : '—'}</td>
      <td class="od-table-actions">
        <button type="button" class="od-btn od-btn-light od-btn-sm drive-dl">Download</button>
        <button type="button" class="od-btn od-btn-light od-btn-sm drive-del" style="color:#b71c1c">Delete</button>
      </td>
    </tr>`
    )
    .join('');

  const bindRow = (root) => {
    root.querySelectorAll('.drive-dl').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const row = btn.closest('[data-name]');
        const name = row?.getAttribute('data-name');
        const demo = row?.getAttribute('data-demo') === '1';
        const path = row?.getAttribute('data-path') || '';
        if (demo) downloadDemoFile(name);
        else downloadFile(path, name);
      });
    });
    root.querySelectorAll('.drive-del').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const row = btn.closest('[data-name]');
        const name = row?.getAttribute('data-name');
        const demo = row?.getAttribute('data-demo') === '1';
        const path = row?.getAttribute('data-path') || '';
        if (demo) deleteDemoFile(name);
        else deleteFile(path);
      });
    });
  };

  bindRow(grid);
  bindRow(tbody);
}

/* ---------- Demo ---------- */

function loadDemoFiles() {
  try {
    const raw = localStorage.getItem(DEMO_STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveDemoFiles(files) {
  try {
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(files));
  } catch (e) {
    setStatus('Storage full or blocked — try smaller files.', true);
    throw e;
  }
}

function readFileAsEntry(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const dataUrl = r.result;
      const comma = dataUrl.indexOf(',');
      const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : '';
      resolve({
        name: file.name,
        mime: file.type || 'application/octet-stream',
        base64,
        size: file.size,
        updated_at: new Date().toISOString(),
      });
    };
    r.onerror = () => reject(new Error('Could not read file'));
    r.readAsDataURL(file);
  });
}

function syncRawFromDemo() {
  rawFileItems = loadDemoFiles().map((f) => ({
    name: f.name,
    size: f.size ?? null,
    updated: f.updated_at || '',
    path: `demo/${f.name}`,
    demo: true,
  }));
}

function refreshDemoFileList() {
  syncRawFromDemo();
  renderAllFiles();
}

function downloadDemoFile(name) {
  const files = loadDemoFiles();
  const item = files.find((f) => f.name === name);
  if (!item) return;
  setStatus('');
  try {
    const bin = atob(item.base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const blob = new Blob([bytes], { type: item.mime || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    setStatus('Could not build download.', true);
  }
}

function deleteDemoFile(name) {
  if (!confirm('Delete this file?')) return;
  saveDemoFiles(loadDemoFiles().filter((f) => f.name !== name));
  setStatus('File removed.');
  refreshDemoFileList();
}

async function handleDemoUpload(fileList) {
  if (!fileList?.length) return;
  setStatus('Uploading…');
  const byName = Object.fromEntries(loadDemoFiles().map((f) => [f.name, f]));
  for (const file of fileList) {
    try {
      const entry = await readFileAsEntry(file);
      byName[entry.name] = entry;
    } catch (e) {
      setStatus(e.message || 'Upload failed', true);
      refreshDemoFileList();
      return;
    }
  }
  saveDemoFiles(Object.values(byName));
  setStatus('Upload complete.');
  $('drive-file-input').value = '';
  refreshDemoFileList();
}

function initDemoDrive() {
  isDemoSession = true;
  $('drive-setup-msg') && ($('drive-setup-msg').hidden = true);
  $('drive-demo-banner') && ($('drive-demo-banner').hidden = false);
  $('drive-storage-hint').textContent = 'Browser storage (demo) — not synced';
  $('drive-breadcrumb').textContent = 'My Drive · Demo';

  showAppShell();

  $('drive-user-email').textContent = DEMO_USER_LABEL;
  $('drive-signout').textContent = 'Clear all files';
  $('drive-signout').onclick = () => {
    if (!confirm('Remove all demo files in this browser?')) return;
    localStorage.removeItem(DEMO_STORAGE_KEY);
    setStatus('Cleared.');
    refreshDemoFileList();
  };

  $('drive-file-input')?.addEventListener('change', (e) => handleDemoUpload(e.target.files));
  $('drive-upload-btn')?.addEventListener('click', () => $('drive-file-input')?.click());

  refreshDemoFileList();
}

/* ---------- Supabase ---------- */

async function refreshFileList() {
  if (!supabase || !currentUserId) return;
  rawFileItems = [];
  const { data, error } = await supabase.storage.from(DRIVE_BUCKET).list(currentUserId, {
    limit: 200,
    offset: 0,
    sortBy: { column: 'updated_at', order: 'desc' },
  });

  if (error) {
    setStatus(error.message, true);
    rawFileItems = [];
    renderAllFiles();
    return;
  }

  rawFileItems = (data || []).map((item) => ({
    name: item.name,
    size: item.metadata?.size ?? null,
    updated: item.updated_at || '',
    path: `${currentUserId}/${item.name}`,
    demo: false,
  }));

  renderAllFiles();
}

async function downloadFile(path, filename) {
  setStatus('');
  const { data, error } = await supabase.storage.from(DRIVE_BUCKET).createSignedUrl(path, 120);
  if (error) {
    setStatus(error.message, true);
    return;
  }
  const a = document.createElement('a');
  a.href = data.signedUrl;
  a.download = filename || 'download';
  a.target = '_blank';
  a.rel = 'noopener';
  a.click();
}

async function deleteFile(path) {
  if (!confirm('Delete this file?')) return;
  setStatus('');
  const { error } = await supabase.storage.from(DRIVE_BUCKET).remove([path]);
  if (error) {
    setStatus(error.message, true);
    return;
  }
  setStatus('File removed.');
  await refreshFileList();
}

async function handleUpload(fileList) {
  if (!fileList?.length || !supabase || !currentUserId) return;
  setStatus('Uploading…');
  for (const file of fileList) {
    const path = `${currentUserId}/${file.name}`;
    const { error } = await supabase.storage.from(DRIVE_BUCKET).upload(path, file, {
      upsert: true,
      contentType: file.type || 'application/octet-stream',
    });
    if (error) {
      setStatus(error.message, true);
      await refreshFileList();
      return;
    }
  }
  setStatus('Upload complete.');
  $('drive-file-input').value = '';
  await refreshFileList();
}

function showAuthedUI(user) {
  currentUserId = user.id;
  isDemoSession = false;
  $('drive-demo-banner') && ($('drive-demo-banner').hidden = true);
  $('drive-storage-hint').textContent = 'Private cloud (Supabase)';
  $('drive-breadcrumb').textContent = `My Drive · ${user.email || user.id}`;

  showAppShell();

  $('drive-user-email').textContent = user.email || user.id;
  $('drive-signout').textContent = 'Sign out';
  $('drive-signout').onclick = null;

  refreshFileList();
}

function showGuestUI() {
  currentUserId = null;
  isDemoSession = false;
  showPreApp();
  const auth = $('drive-auth-panel');
  if (auth) auth.hidden = false;
}

async function initSupabaseDrive() {
  $('drive-demo-banner') && ($('drive-demo-banner').hidden = true);
  $('drive-setup-msg') && ($('drive-setup-msg').hidden = true);

  const mod = await import('./supabase-runtime-config.js');
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.49.1');

  DRIVE_BUCKET = mod.DRIVE_BUCKET || 'tpg-private';
  supabase = createClient(mod.SUPABASE_URL, mod.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.user) {
    $('drive-auth-panel').hidden = true;
    showAuthedUI(session.user);
  } else {
    showGuestUI();
  }

  supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user) {
      $('drive-auth-panel').hidden = true;
      showAuthedUI(session.user);
    } else {
      showGuestUI();
    }
  });

  $('drive-signin-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    setStatus('');
    const email = $('drive-email').value.trim();
    const password = $('drive-password').value;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setStatus(error.message, true);
  });

  $('drive-signout')?.addEventListener('click', async () => {
    if (isDemoSession) return;
    await supabase.auth.signOut();
    setStatus('Signed out.');
  });

  $('drive-file-input')?.addEventListener('change', (e) => handleUpload(e.target.files));
  $('drive-upload-btn')?.addEventListener('click', () => $('drive-file-input')?.click());
}

async function init() {
  if (useDemoMode()) {
    initDemoDrive();
    return;
  }
  await initSupabaseDrive();
}

document.addEventListener('DOMContentLoaded', init);
