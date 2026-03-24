/**
 * Master-only: stage leadership email profile files, flip-tutorial JSON, and emit deploy artifacts.
 */

import { requireMaster } from './auth.stub.js';

const DATA_URL = new URL('../data/documents.json', import.meta.url);
const OVERRIDE_KEY = 'tpg_email_profiles_override';

function downloadBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function downloadJson(filename, obj) {
  downloadBlob(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' }), filename);
}

function extFromFile(file) {
  const n = file.name || '';
  const i = n.lastIndexOf('.');
  return i >= 0 ? n.slice(i).toLowerCase() : '';
}

function safeExt(ext, fallback) {
  if (!ext || ext.length > 8) return fallback;
  if (!/^\.[a-z0-9]+$/i.test(ext)) return fallback;
  return ext;
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function applyUploadsToPeople(people, filesByLeader) {
  const next = deepClone(people);
  for (const person of next) {
    const lid = person.leaderId;
    const slot = filesByLeader[lid];
    if (!slot) continue;

    for (const d of person.downloads) {
      if (d.kind === 'mobileconfig' && slot.ios) {
        d.path = `/assets/documents/email-profiles/${lid}.mobileconfig`;
        d.status = 'live';
      }
      if (d.kind !== 'mobileconfig' && slot.android) {
        const ext = safeExt(extFromFile(slot.android), '.txt');
        const fname = `${lid}-android${ext}`;
        d.path = `/assets/documents/email-profiles/${fname}`;
        d.status = 'live';
      }
    }
  }
  return next;
}

function applyFlipToPeople(people, flipMap) {
  const next = deepClone(people);
  for (const p of next) {
    if (flipMap[p.leaderId]) {
      p.androidFlipTutorial = flipMap[p.leaderId];
    }
  }
  return next;
}

function readFilesByLeader(root) {
  const leaders = [...root.querySelectorAll('[data-leader-id]')];
  const map = {};
  for (const el of leaders) {
    const id = el.getAttribute('data-leader-id');
    const ios = el.querySelector('input[data-slot="ios"]')?.files?.[0] || null;
    const android = el.querySelector('input[data-slot="android"]')?.files?.[0] || null;
    const flip = el.querySelector('input[data-slot="flip"]')?.files?.[0] || null;
    if (ios || android || flip) map[id] = { ios, android, flip };
  }
  return map;
}

async function collectFlipJson(filesByLeader) {
  const out = {};
  for (const [lid, slot] of Object.entries(filesByLeader)) {
    if (!slot.flip) continue;
    try {
      const text = await slot.flip.text();
      out[lid] = JSON.parse(text);
    } catch (e) {
      throw new Error(`Invalid flip-tutorial JSON for ${lid}: ${e.message}`);
    }
    if (!out[lid].steps || !Array.isArray(out[lid].steps) || !out[lid].steps.length) {
      throw new Error(`Flip JSON for ${lid} must include a non-empty "steps" array.`);
    }
  }
  return out;
}

function renderForm(data, mount) {
  const leaderMap = Object.fromEntries((data.leaders || []).map((l) => [l.id, l]));
  mount.innerHTML = (data.emailProfiles?.people || [])
    .map((person) => {
      const L = leaderMap[person.leaderId];
      const name = L ? `${L.name}` : person.leaderId;
      return `
        <div class="admin-ep-card" data-leader-id="${person.leaderId}">
          <h3>${name}</h3>
          <p class="admin-ep-meta">${L?.title || ''}</p>
          <label>iPhone / iPad profile (.mobileconfig)</label>
          <input type="file" data-slot="ios" accept=".mobileconfig,application/x-apple-aspen-config">
          <label>Android / manual doc (optional — replaces second row file on deploy)</label>
          <input type="file" data-slot="android" accept=".txt,.pdf,.md">
          <label>Flip-card tutorial (optional JSON — see <code>flip-tutorial-TEMPLATE.json</code>)</label>
          <input type="file" data-slot="flip" accept=".json,application/json">
        </div>`;
    })
    .join('');
}

async function main() {
  if (!requireMaster()) return;

  const mount = document.getElementById('admin-ep-form');
  const statusEl = document.getElementById('admin-ep-status');
  let data;

  try {
    const res = await fetch(DATA_URL);
    data = await res.json();
  } catch {
    statusEl.textContent = 'Could not load documents.json.';
    return;
  }

  renderForm(data, mount);

  document.getElementById('admin-ep-download').addEventListener('click', async () => {
    statusEl.textContent = '';
    const filesByLeader = readFilesByLeader(mount);
    let flipMap = {};
    try {
      flipMap = await collectFlipJson(filesByLeader);
    } catch (e) {
      statusEl.textContent = e.message;
      return;
    }

    const hasBinary = Object.values(filesByLeader).some((s) => s.ios || s.android);
    const hasFlip = Object.keys(flipMap).length > 0;
    if (!hasBinary && !hasFlip) {
      statusEl.textContent =
        'Choose at least one file: profile(s), Android doc(s), and/or flip-tutorial JSON per person.';
      return;
    }

    let people = deepClone(data.emailProfiles.people);
    people = applyFlipToPeople(people, flipMap);
    people = applyUploadsToPeople(people, filesByLeader);

    const merged = deepClone(data);
    merged.emailProfiles.people = people;
    merged.meta = merged.meta || {};
    merged.meta.updated = new Date().toISOString().slice(0, 10);

    for (const [lid, slot] of Object.entries(filesByLeader)) {
      if (slot.ios) downloadBlob(slot.ios, `${lid}.mobileconfig`);
      if (slot.android) {
        const ext = safeExt(extFromFile(slot.android), '.txt');
        downloadBlob(slot.android, `${lid}-android${ext}`);
      }
    }

    downloadJson('documents.json', merged);
    statusEl.innerHTML =
      'Downloads started. Put binaries in <code>src/assets/documents/email-profiles/</code>, replace <code>src/data/documents.json</code> with the downloaded file, then <code>npm run build</code> and deploy. Flip JSON is merged into each person’s <code>androidFlipTutorial</code> field.';
  });

  document.getElementById('admin-ep-preview').addEventListener('click', async () => {
    statusEl.textContent = '';
    const filesByLeader = readFilesByLeader(mount);
    let flipMap = {};
    try {
      flipMap = await collectFlipJson(filesByLeader);
    } catch (e) {
      statusEl.textContent = e.message;
      return;
    }

    const hasBinary = Object.values(filesByLeader).some((s) => s.ios || s.android);
    const hasFlip = Object.keys(flipMap).length > 0;
    if (!hasBinary && !hasFlip) {
      statusEl.textContent = 'Nothing selected to preview.';
      return;
    }

    let people = deepClone(data.emailProfiles.people);
    people = applyFlipToPeople(people, flipMap);
    people = applyUploadsToPeople(people, filesByLeader);

    localStorage.setItem(OVERRIDE_KEY, JSON.stringify({ people, savedAt: new Date().toISOString() }));
    statusEl.innerHTML =
      'Saved merge to <strong>this browser only</strong>. Open Document Depot and flip-card links to preview. <button type="button" id="admin-ep-clear-preview">Clear preview</button>';
    document.getElementById('admin-ep-clear-preview').addEventListener('click', () => {
      localStorage.removeItem(OVERRIDE_KEY);
      statusEl.textContent = 'Preview cleared.';
    });
  });
}

document.addEventListener('DOMContentLoaded', main);
