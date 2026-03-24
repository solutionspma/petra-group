/**
 * Step cards for Android / Outlook email help — one full screen per step (no flip).
 * Enriches with server values parsed from the same published mail settings file as the company mail slot.
 */

import { extractMailSettingsFromMobileConfigUrl } from './plist-email-extract.js';

const DATA_URL = new URL('../data/documents.json', import.meta.url);
const EMAIL_OVERRIDE_KEY = 'tpg_email_profiles_override';

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function formatBody(text) {
  if (!text) return '';
  let h = escapeHtml(text);
  h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  return h.replace(/\n/g, '<br>');
}

function resolvePath(path) {
  if (!path) return '#';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (path.startsWith('/')) return path;
  return `/${path}`;
}

function applyPlaceholders(str, ctx) {
  if (!str) return '';
  return str
    .replace(/\{\{fullName\}\}/g, ctx.fullName)
    .replace(/\{\{firstName\}\}/g, ctx.firstName)
    .replace(/\{\{email\}\}/g, ctx.email)
    .replace(/\{\{company\}\}/g, ctx.company);
}

function mergePeopleOverride(people) {
  try {
    const raw = localStorage.getItem(EMAIL_OVERRIDE_KEY);
    if (!raw) return people;
    const o = JSON.parse(raw);
    if (!o?.people) return people;
    return people.map((p) => {
      const patch = o.people.find((x) => x.leaderId === p.leaderId);
      if (!patch) return p;
      const n = { ...p };
      if (patch.downloads) n.downloads = patch.downloads;
      if (patch.androidFlipTutorial !== undefined) n.androidFlipTutorial = patch.androidFlipTutorial;
      return n;
    });
  } catch {
    return people;
  }
}

function buildServerStepFromNormalized(leader, n) {
  const copies = [];
  const email = String(n.emailAddress || leader.email || '').trim();
  if (email) copies.push({ label: 'Email address', value: email });

  const inc = n.incoming || {};
  const out = n.outgoing || {};
  const isEx = n.protocol === 'exchange' || n.source === 'eas';

  if (isEx) {
    if (inc.host) copies.push({ label: 'Server / host', value: inc.host });
    if (inc.port) copies.push({ label: 'Port', value: String(inc.port) });
  } else {
    if (inc.host) copies.push({ label: 'Incoming (IMAP) server', value: inc.host });
    if (inc.port) copies.push({ label: 'Incoming port', value: String(inc.port) });
    copies.push({
      label: 'Incoming security',
      value: inc.ssl ? 'SSL/TLS on' : 'Off or STARTTLS — confirm with IT if unsure',
    });
    if (inc.username) copies.push({ label: 'Username (incoming)', value: inc.username });
    if (out.host) copies.push({ label: 'Outgoing (SMTP) server', value: out.host });
    if (out.port) copies.push({ label: 'SMTP port', value: String(out.port) });
    copies.push({
      label: 'Outgoing security',
      value: out.ssl ? 'SSL/TLS on' : 'STARTTLS or app default',
    });
    if (out.username) copies.push({ label: 'Username (outgoing)', value: out.username });
  }

  return {
    title: 'Server details (from your organization’s mail file)',
    body: 'These **hostnames, ports, and security settings** were read from the same **published staff mail settings file** your organization uses for company mail. **Copy** each line into **Outlook** or **Samsung Email** when the app asks for manual or advanced setup. You do not need to install anything from that file on Android—only use the values below.',
    tip: 'If this box is empty or values look wrong, the file may still be updating. Use **Guided setup** in the Document Depot or ask technical.',
    copies,
    image: '',
  };
}

async function mergeMailFileStep(leader, person, steps) {
  const mc = person.downloads?.find((d) => d.kind === 'mobileconfig');
  if (!mc?.path) return steps;

  const url = resolvePath(mc.path);
  const result = await extractMailSettingsFromMobileConfigUrl(url);
  if (!result.ok || !result.normalized) return steps;

  let n = result.normalized;
  if (!n.emailAddress && leader.email) n = { ...n, emailAddress: leader.email };

  const inc = n.incoming || {};
  const usedAuto =
    Boolean(inc.host) || n.protocol === 'exchange' || n.source === 'eas';
  if (!usedAuto) return steps;

  const serverStep = buildServerStepFromNormalized(leader, n);
  if (!serverStep.copies?.length) return steps;
  if (!steps.length) return [serverStep];
  return [steps[0], serverStep, ...steps.slice(1)];
}

function buildDefaultAndroidTutorial(leader) {
  const fullName = leader.name || 'Team member';
  const firstName = fullName.split(/\s+/)[0] || fullName;
  const email = leader.email || 'your work email address';
  const company = 'The Petra Group / TPG Benefits';

  const P = (s) => applyPlaceholders(s, { fullName, firstName, email, company });

  return {
    title: P('Work email — Android, tablet, or desktop'),
    subtitle: P('Everything for each step is on one screen. Use Next and Back.'),
    steps: [
      {
        title: P('Works on phone, tablet, or laptop'),
        body: P(
          '{{firstName}}, use these steps in **full screen** on whatever device you’re using. Each **Next** moves to the next screen—whether you’re on a Galaxy, Pixel, or a desktop browser.'
        ),
        tip: P('If text feels small, pinch-zoom or rotate to landscape.'),
      },
      {
        title: P('Install Microsoft Outlook'),
        body: P(
          'On Android: open **Google Play Store** → search **Microsoft Outlook** (publisher: Microsoft Corporation) → **Install**.\n\nOn a computer: install Outlook desktop or use **outlook.office.com** in Chrome/Edge for a similar path.'
        ),
        tip: P('Outlook is usually the fastest path for Microsoft 365 / Exchange mail.'),
      },
      {
        title: P('Start adding your account'),
        body: P(
          'Open **Outlook** → tap **Add account** (or **Get started**) → choose **Office 365** or **Exchange** if asked.'
        ),
      },
      {
        title: P('Enter your work email'),
        body: P('Type **{{email}}** exactly. Continue to the sign-in or password screen your organization uses.'),
      },
      {
        title: P('Sign in & security'),
        body: P(
          'Complete password and **multi-factor authentication** (text, Authenticator app, etc.) if your IT policy requires it.'
        ),
        tip: P('If you’re stuck on “can’t sign in,” confirm Wi‑Fi/cellular and try again in a few minutes.'),
      },
      {
        title: P('If the app asks for a server'),
        body: P(
          'Some setups need a server hostname (often **outlook.office365.com** for M365). Your admin or **{{company}}** technical contact can confirm. You can also open the **server settings** text file from the Document Depot on another tab.'
        ),
      },
      {
        title: P('Samsung Email (optional)'),
        body: P(
          'Alternative: **Settings → Accounts → Add account → Exchange**. Use the same email and server details from your provider.'
        ),
      },
      {
        title: P('You’re set'),
        body: P(
          'Mail should sync within a few minutes. If folders are empty, pull down to refresh. Need help? Contact **{{company}}** technical support.'
        ),
      },
    ],
  };
}

function normalizeTutorial(raw, leader) {
  let r = raw;
  if (!r || !Array.isArray(r.steps) || r.steps.length === 0) {
    r = buildDefaultAndroidTutorial(leader);
  }
  const ctx = {
    fullName: leader.name || '',
    firstName: (leader.name || '').split(/\s+/)[0] || '',
    email: leader.email || 'your work email address',
    company: 'The Petra Group / TPG Benefits',
  };
  const title = applyPlaceholders(r.title || 'Email setup', ctx);
  const subtitle = applyPlaceholders(r.subtitle || '', ctx);
  const steps = r.steps.map((s) => ({
    title: applyPlaceholders(s.title || '', ctx),
    body: applyPlaceholders(s.body || '', ctx),
    tip: s.tip ? applyPlaceholders(s.tip, ctx) : '',
    image: s.image || '',
    copies: Array.isArray(s.copies)
      ? s.copies.map((c) => ({
          label: applyPlaceholders(c.label || '', ctx),
          value: applyPlaceholders(String(c.value ?? ''), ctx),
        }))
      : [],
  }));
  return { title, subtitle, steps };
}

async function loadContext(leaderId) {
  const res = await fetch(DATA_URL);
  const data = await res.json();
  data.emailProfiles.people = mergePeopleOverride(data.emailProfiles.people);

  const leader = (data.leaders || []).find((l) => l.id === leaderId);
  const person = (data.emailProfiles?.people || []).find((p) => p.leaderId === leaderId);

  if (!leader || !person) return null;

  let { title, subtitle, steps } = normalizeTutorial(person.androidFlipTutorial, leader);
  steps = await mergeMailFileStep(leader, person, steps);

  return { leader, tutorial: { title, subtitle, steps } };
}

function renderDots(count, active) {
  const dots = document.getElementById('ft-dots');
  dots.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const d = document.createElement('span');
    d.className = 'ft-dot' + (i === active ? ' is-active' : '');
    dots.appendChild(d);
  }
  document.getElementById('ft-step-num').textContent = `Step ${active + 1} of ${count}`;
}

function renderCopyBlocks(step, stepIndex) {
  if (!step.copies?.length) return '';
  return step.copies
    .map((c, j) => {
      const id = `ft-copy-${stepIndex}-${j}`;
      return `
      <div class="ft-copy-block">
        <div class="ft-copy-label">${escapeHtml(c.label)}</div>
        <div class="ft-copy-value" id="${id}-val">${escapeHtml(c.value)}</div>
        <button type="button" class="ft-copy-btn" data-copy-target="${id}-val">Copy</button>
      </div>`;
    })
    .join('');
}

let state = { index: 0, steps: [] };
let touchStartX = null;

function showStep() {
  const { steps, index } = state;
  const step = steps[index];
  const panel = document.getElementById('ft-step-panel');

  panel.innerHTML = `
    <div class="ft-card-kicker">This step</div>
    <h2>${escapeHtml(step.title)}</h2>
    <div class="ft-body">${formatBody(step.body)}</div>
    ${step.image ? `<img class="ft-img" src="${escapeHtml(step.image.startsWith('/') ? step.image : `/${step.image}`)}" alt="">` : ''}
    ${step.tip ? `<div class="ft-tip">${formatBody(step.tip)}</div>` : ''}
    ${renderCopyBlocks(step, index)}
  `;

  panel.querySelectorAll('.ft-copy-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-copy-target');
      const el = document.getElementById(id);
      const text = el?.textContent || '';
      try {
        await navigator.clipboard.writeText(text);
        btn.textContent = 'Copied';
        btn.classList.add('is-done');
      } catch {
        btn.textContent = 'Select & copy';
      }
    });
  });

  renderDots(steps.length, index);
  document.getElementById('ft-prev').disabled = index === 0;
  document.getElementById('ft-next').textContent = index === steps.length - 1 ? 'Done' : 'Next';
}

function go(delta) {
  const { steps, index } = state;
  const next = index + delta;
  if (next < 0 || next >= steps.length) {
    if (delta > 0 && index === steps.length - 1) {
      window.location.href = 'documents.html';
    }
    return;
  }
  state.index = next;
  showStep();
}

async function init() {
  const params = new URLSearchParams(window.location.search);
  const leaderId = params.get('leader');
  const shell = document.getElementById('ft-shell');
  const err = document.getElementById('ft-error');

  if (!leaderId) {
    if (shell) shell.hidden = true;
    err.hidden = false;
    err.textContent = 'Missing leader. Open this guide from the Document Depot (Android section).';
    return;
  }

  let ctx;
  try {
    ctx = await loadContext(leaderId);
  } catch (e) {
    console.error(e);
    if (shell) shell.hidden = true;
    err.hidden = false;
    err.textContent = 'Could not load setup data. Try again on a connection.';
    return;
  }

  if (!ctx) {
    if (shell) shell.hidden = true;
    err.hidden = false;
    err.textContent = 'Unknown person. Check the link from the depot.';
    return;
  }

  document.getElementById('ft-page-title').textContent = ctx.tutorial.title;
  document.getElementById('ft-page-sub').textContent =
    ctx.tutorial.subtitle || `${ctx.leader.name} · Android / Outlook`;

  state.steps = ctx.tutorial.steps;
  state.index = 0;
  showStep();

  document.getElementById('ft-prev').addEventListener('click', () => go(-1));
  document.getElementById('ft-next').addEventListener('click', () => go(1));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') go(1);
    if (e.key === 'ArrowLeft') go(-1);
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      go(1);
    }
  });

  const zone = document.getElementById('ft-main');
  zone.addEventListener(
    'touchstart',
    (e) => {
      touchStartX = e.changedTouches[0].screenX;
    },
    { passive: true }
  );
  zone.addEventListener(
    'touchend',
    (e) => {
      if (touchStartX == null) return;
      const dx = e.changedTouches[0].screenX - touchStartX;
      touchStartX = null;
      if (dx < -48) go(1);
      if (dx > 48) go(-1);
    },
    { passive: true }
  );
}

document.addEventListener('DOMContentLoaded', init);
