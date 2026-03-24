/**
 * TPG My Drive — Supabase Storage when configured; otherwise local browser demo (no backend).
 */
import { isDriveConfigured } from './supabase-runtime-config.js';

const DEMO_STORAGE_KEY = 'tpg_mydrive_demo_v1';
const DEMO_USER_LABEL = 'Demo session (this browser only)';

let supabase = null;
let DRIVE_BUCKET = 'tpg-private';
let currentUserId = null;

const $ = (id) => document.getElementById(id);

function useDemoMode() {
  const q = new URLSearchParams(window.location.search).get('demo');
  if (q === '1' || q === 'true') return true;
  return !isDriveConfigured();
}

function setStatus(msg, isErr = false) {
  const el = $('drive-status');
  if (!el) return;
  el.textContent = msg || '';
  el.style.color = isErr ? '#b71c1c' : '#333';
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

/* ---------- Demo (localStorage) ---------- */

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
    setStatus('Storage full or blocked — try smaller files or another browser.', true);
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

async function refreshDemoFileList() {
  const tbody = $('drive-file-tbody');
  if (!tbody) return;

  const files = loadDemoFiles().sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));

  if (!files.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="drive-muted">No files yet. Upload below.</td></tr>';
    return;
  }

  tbody.innerHTML = files
    .map((item) => {
      const path = `demo/${item.name}`;
      return `<tr data-path="${escapeHtml(path)}" data-name="${escapeHtml(item.name)}">
        <td>${escapeHtml(item.name)}</td>
        <td>${formatBytes(item.size)}</td>
        <td class="drive-muted">${item.updated_at ? escapeHtml(item.updated_at.slice(0, 19).replace('T', ' ')) : '—'}</td>
        <td class="drive-actions">
          <button type="button" class="btn drive-dl" style="padding:6px 12px;font-size:0.85rem">Download</button>
          <button type="button" class="btn drive-del" style="padding:6px 12px;font-size:0.85rem;background:#444;color:#fff">Delete</button>
        </td>
      </tr>`;
    })
    .join('');

  tbody.querySelectorAll('tr').forEach((tr) => {
    const name = tr.getAttribute('data-name');
    tr.querySelector('.drive-dl')?.addEventListener('click', () => downloadDemoFile(name));
    tr.querySelector('.drive-del')?.addEventListener('click', () => deleteDemoFile(name));
  });
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
  if (!confirm('Delete this file from demo storage?')) return;
  const next = loadDemoFiles().filter((f) => f.name !== name);
  saveDemoFiles(next);
  setStatus('File removed.');
  refreshDemoFileList();
}

async function handleDemoUpload(fileList) {
  if (!fileList?.length) return;
  setStatus('Uploading…');
  const existing = loadDemoFiles();
  const byName = Object.fromEntries(existing.map((f) => [f.name, f]));

  for (const file of fileList) {
    try {
      const entry = await readFileAsEntry(file);
      byName[entry.name] = entry;
    } catch (e) {
      setStatus(e.message || 'Upload failed', true);
      await refreshDemoFileList();
      return;
    }
  }

  saveDemoFiles(Object.values(byName));
  setStatus('Upload complete.');
  $('drive-file-input').value = '';
  await refreshDemoFileList();
}

function initDemoDrive() {
  $('drive-setup-msg') && ($('drive-setup-msg').hidden = true);
  const banner = $('drive-demo-banner');
  if (banner) banner.hidden = false;

  $('drive-auth-panel').hidden = true;
  $('drive-app-panel').hidden = false;
  $('drive-user-email').textContent = DEMO_USER_LABEL;

  $('drive-signout').textContent = 'Clear all demo files';
  $('drive-signout').onclick = async () => {
    if (!confirm('Remove every file from demo My Drive in this browser?')) return;
    localStorage.removeItem(DEMO_STORAGE_KEY);
    setStatus('Demo storage cleared.');
    refreshDemoFileList();
  };

  $('drive-file-input')?.addEventListener('change', (e) => handleDemoUpload(e.target.files));
  $('drive-upload-btn')?.addEventListener('click', () => $('drive-file-input')?.click());

  refreshDemoFileList();
}

/* ---------- Supabase ---------- */

async function refreshFileList() {
  const tbody = $('drive-file-tbody');
  if (!tbody || !supabase || !currentUserId) return;

  tbody.innerHTML = '<tr><td colspan="4">Loading…</td></tr>';

  const { data, error } = await supabase.storage.from(DRIVE_BUCKET).list(currentUserId, {
    limit: 200,
    offset: 0,
    sortBy: { column: 'updated_at', order: 'desc' },
  });

  if (error) {
    tbody.innerHTML = `<tr><td colspan="4" style="color:#b71c1c">${escapeHtml(error.message)}</td></tr>`;
    return;
  }

  const rows = data || [];

  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="drive-muted">No files yet. Upload below.</td></tr>';
    return;
  }

  tbody.innerHTML = rows
    .map((item) => {
      const path = `${currentUserId}/${item.name}`;
      return `<tr data-path="${escapeHtml(path)}" data-name="${escapeHtml(item.name)}">
        <td>${escapeHtml(item.name)}</td>
        <td>${formatBytes(item.metadata?.size)}</td>
        <td class="drive-muted">${item.updated_at ? escapeHtml(item.updated_at.slice(0, 19).replace('T', ' ')) : '—'}</td>
        <td class="drive-actions">
          <button type="button" class="btn drive-dl" style="padding:6px 12px;font-size:0.85rem">Download</button>
          <button type="button" class="btn drive-del" style="padding:6px 12px;font-size:0.85rem;background:#444;color:#fff">Delete</button>
        </td>
      </tr>`;
    })
    .join('');

  tbody.querySelectorAll('tr').forEach((tr) => {
    const path = tr.getAttribute('data-path');
    const name = tr.getAttribute('data-name');
    tr.querySelector('.drive-dl')?.addEventListener('click', () => downloadFile(path, name));
    tr.querySelector('.drive-del')?.addEventListener('click', () => deleteFile(path));
  });
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
  if (!confirm('Delete this file from your private drive?')) return;
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
  $('drive-auth-panel').hidden = true;
  $('drive-app-panel').hidden = false;
  $('drive-user-email').textContent = user.email || user.id;
  refreshFileList();
}

function showGuestUI() {
  currentUserId = null;
  $('drive-auth-panel').hidden = false;
  $('drive-app-panel').hidden = true;
}

async function initSupabaseDrive() {
  $('drive-demo-banner') && ($('drive-demo-banner').hidden = true);
  $('drive-setup-msg') && ($('drive-setup-msg').hidden = true);

  const mod = await import('./supabase-runtime-config.js');
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.49.1');

  DRIVE_BUCKET = mod.DRIVE_BUCKET || 'tpg-private';
  supabase = createClient(mod.SUPABASE_URL, mod.SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  $('drive-signout').textContent = 'Sign out';
  $('drive-signout').onclick = null;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.user) showAuthedUI(session.user);
  else showGuestUI();

  supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user) showAuthedUI(session.user);
    else showGuestUI();
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
