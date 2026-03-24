/**
 * Screen-by-screen flip cards for Android / Outlook email setup.
 * Data: ?leader=<leaderId> + documents.json (androidFlipTutorial or built-in default).
 */

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

function buildDefaultAndroidTutorial(leader) {
  const fullName = leader.name || 'Team member';
  const firstName = fullName.split(/\s+/)[0] || fullName;
  const email = leader.email || 'your work email address';
  const company = 'The Petra Group / TPG Benefits';

  const P = (s) => applyPlaceholders(s, { fullName, firstName, email, company });

  return {
    title: P('Work email — Android, tablet, or desktop'),
    subtitle: P('One screen at a time for {{fullName}}. Tap the card to flip for details.'),
    steps: [
      {
        title: P('Works on phone, tablet, or laptop'),
        body: P(
          '{{firstName}}, use these cards in **full screen** on whatever device you’re holding. Each **Next** is a new step—same flow whether you’re on a Galaxy, Pixel, or a desktop browser.'
        ),
        tip: P('If text is small, pinch-zoom or rotate to landscape.'),
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

  const tutorial = normalizeTutorial(person.androidFlipTutorial, leader);

  return { leader, tutorial };
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

let state = { index: 0, steps: [], flipped: false };
let touchStartX = null;

function showStep() {
  const { steps, index } = state;
  const step = steps[index];
  const inner = document.getElementById('ft-flip-inner');
  inner.classList.remove('is-flipped');
  state.flipped = false;

  document.getElementById('ft-front-title').textContent = step.title;
  document.getElementById('ft-back-body').innerHTML = formatBody(step.body);
  const tipEl = document.getElementById('ft-back-tip');
  if (step.tip) {
    tipEl.hidden = false;
    tipEl.innerHTML = formatBody(step.tip);
  } else {
    tipEl.hidden = true;
  }
  const imgEl = document.getElementById('ft-back-img');
  if (step.image) {
    imgEl.hidden = false;
    imgEl.src = step.image.startsWith('/') ? step.image : `/${step.image}`;
    imgEl.alt = '';
  } else {
    imgEl.hidden = true;
    imgEl.removeAttribute('src');
  }

  renderDots(steps.length, index);
  document.getElementById('ft-prev').disabled = index === 0;
  document.getElementById('ft-next').textContent = index === steps.length - 1 ? 'Done' : 'Next screen';
}

function toggleFlip() {
  const inner = document.getElementById('ft-flip-inner');
  state.flipped = !state.flipped;
  inner.classList.toggle('is-flipped', state.flipped);
}

function go(delta) {
  const next = state.index + delta;
  if (next < 0 || next >= state.steps.length) {
    if (delta > 0 && state.index === state.steps.length - 1) {
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
    err.textContent = 'Missing leader. Open this tutorial from the Document Depot (Android row).';
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
    ctx.tutorial.subtitle || `${ctx.leader.name} · Android / Outlook path`;

  state.steps = ctx.tutorial.steps;
  state.index = 0;
  showStep();

  document.getElementById('ft-prev').addEventListener('click', () => go(-1));
  document.getElementById('ft-next').addEventListener('click', () => go(1));
  document.getElementById('ft-flip-toggle').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleFlip();
  });
  document.getElementById('ft-card').addEventListener('click', (e) => {
    if (e.target.closest('button')) return;
    toggleFlip();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') go(1);
    if (e.key === 'ArrowLeft') go(-1);
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      toggleFlip();
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
