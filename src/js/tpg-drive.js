/**
 * TPG My Drive — private files per Supabase user (Storage + Auth + RLS).
 * Supabase client loaded from CDN (no bundler).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  DRIVE_BUCKET,
  isDriveConfigured,
} from './supabase-runtime-config.js';

let supabase = null;
let currentUserId = null;

const $ = (id) => document.getElementById(id);

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

async function init() {
  const setup = $('drive-setup-msg');

  if (!isDriveConfigured()) {
    if (setup) setup.hidden = false;
    return;
  }

  if (setup) setup.hidden = true;

  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

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

document.addEventListener('DOMContentLoaded', init);
