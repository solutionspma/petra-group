/**
 * Android guided mail setup — uses parsed technical mail data when available.
 * UI copy avoids referencing other platforms or installer file types.
 */

import {
  extractMailSettingsFromMobileConfigUrl,
  normalizedFromMailSettingsJson,
} from './plist-email-extract.js';

const DATA_URL = new URL('../data/documents.json', import.meta.url);
const EMAIL_OVERRIDE_KEY = 'tpg_email_profiles_override';

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function resolvePath(path) {
  if (!path) return '#';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (path.startsWith('/')) return path;
  return `/${path}`;
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

function formatBodyParagraphs(paragraphs) {
  return (paragraphs || [])
    .filter(Boolean)
    .map((p) => {
      let h = escapeHtml(p);
      h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      return `<p class="ae-step-body">${h}</p>`;
    })
    .join('');
}

function buildStepsFromNormalized(leader, n, androidDocHref) {
  const email = String(n.emailAddress || leader.email || '').trim();
  const steps = [];

  steps.push({
    title: 'Your organization’s mail settings',
    paragraphs: [
      'We read the **technical mail settings** your organization publishes for staff (the same fields your IT uses everywhere). **Copy** each value into **Microsoft Outlook** or **Samsung Email** when prompted—nothing runs in the background without your taps.',
    ],
  });

  steps.push({
    title: 'Get the Outlook app (recommended)',
    paragraphs: [
      'Open **Google Play Store** → search **Microsoft Outlook** (Microsoft Corporation) → **Install**. You can also use **Samsung Email**: **Settings → Accounts and backup → Accounts → Add account**.',
    ],
  });

  if (email) {
    steps.push({
      title: 'Email address',
      paragraphs: ['When the app asks for your **email** or **username**, use exactly this address.'],
      copies: [{ label: 'Email address', value: email }],
    });
  }

  const isExchange = n.protocol === 'exchange' || n.source === 'eas';
  const inc = n.incoming || {};
  const out = n.outgoing || {};

  if (isExchange) {
    const copies = [];
    if (inc.host) copies.push({ label: 'Server / host', value: inc.host });
    if (inc.port) copies.push({ label: 'Port', value: String(inc.port) });
    steps.push({
      title: 'Exchange / Microsoft 365 server',
      paragraphs: copies.length
        ? [
            'If Outlook shows **Advanced settings**, **Server**, or **Domain**, paste the values below. Many accounts skip this because sign-in completes automatically.',
          ]
        : [
            'Often you only need **email** and **password**. If the app still asks for a **server** or **domain**, ask your IT contact for the hostname, or try continuing—**autodiscover** may fill it in.',
          ],
      copies: copies.length ? copies : undefined,
    });
  } else {
    const incCopies = [];
    if (inc.host) incCopies.push({ label: 'Incoming (IMAP) server', value: inc.host });
    if (inc.port) incCopies.push({ label: 'Incoming port', value: String(inc.port) });
    incCopies.push({ label: 'Incoming security', value: inc.ssl ? 'SSL/TLS (recommended)' : 'None / STARTTLS per app' });
    if (inc.username) incCopies.push({ label: 'Username (incoming)', value: inc.username });

    steps.push({
      title: 'Incoming mail (IMAP)',
      paragraphs: ['Enter these under **IMAP** or **Incoming server** in manual setup.'],
      copies: incCopies,
    });

    if (out.host) {
      const outCopies = [
        { label: 'Outgoing (SMTP) server', value: out.host },
        ...(out.port ? [{ label: 'SMTP port', value: String(out.port) }] : []),
        { label: 'Outgoing security', value: out.ssl ? 'SSL/TLS (recommended)' : 'STARTTLS or app default' },
      ];
      if (out.username) outCopies.push({ label: 'Username (outgoing)', value: out.username });
      steps.push({
        title: 'Outgoing mail (SMTP)',
        paragraphs: ['Use these when the app asks for **SMTP** or **outgoing** settings.'],
        copies: outCopies,
      });
    }
  }

  steps.push({
    title: 'Password & verification',
    paragraphs: [
      'Enter your mailbox **password** when prompted. Complete **multi-factor authentication** (Authenticator app or text) if your organization requires it.',
    ],
  });

  const lastParas = [
    'Pull down in the inbox to **refresh** after a minute or two.',
    androidDocHref
      ? 'Keep the **reference sheet** from the Document Depot open in another tab if you want a printable backup.'
      : null,
  ].filter(Boolean);

  steps.push({
    title: 'You’re done',
    paragraphs: lastParas,
  });

  return steps;
}

function buildFallbackSteps(leader, androidDocHref) {
  const email = String(leader.email || '').trim();
  const steps = [
    {
      title: 'Set up work email on Android',
      paragraphs: [
        'We could not read your organization’s **automatic mail details** from the file on the server (it may still be publishing, or the format is not readable in the browser). You’ll follow **general Android steps** instead.',
      ],
    },
    {
      title: 'Install Outlook',
      paragraphs: [
        'From **Google Play**, install **Microsoft Outlook**. Open it → **Add account** → choose **Office 365** or **Exchange** if offered.',
      ],
    },
  ];

  if (email) {
    steps.push({
      title: 'Your email address',
      paragraphs: ['Use this address when the app asks.'],
      copies: [{ label: 'Email address', value: email }],
    });
  }

  steps.push({
    title: 'Server details',
    paragraphs: [
      'If the app asks for **server names** or **ports**, use the values your IT team or **Document Depot reference file** provides.',
      androidDocHref
        ? 'Tap **Download** next to your Android reference row in the Document Depot to open the text or PDF guide.'
        : null,
    ].filter(Boolean),
  });

  steps.push({
    title: 'Need help?',
    paragraphs: [
      'Contact your **TPG Benefits technical** contact if sign-in fails or MFA loops.',
      'You can still open the **step-by-step guide** from the depot for a paced walkthrough with the same tips.',
    ],
  });

  return steps;
}

function renderCopyRows(copies, stepIndex) {
  if (!copies?.length) return '';
  return copies
    .map((c, j) => {
      const id = `ae-copy-${stepIndex}-${j}`;
      return `
      <div class="ae-copy-block">
        <div class="ae-copy-label">${escapeHtml(c.label)}</div>
        <div class="ae-copy-value" id="${id}-val">${escapeHtml(c.value)}</div>
        <button type="button" class="ae-copy-btn" data-copy-target="${id}-val">Copy</button>
      </div>`;
    })
    .join('');
}

let state = { steps: [], index: 0 };

function render() {
  const { steps, index } = state;
  const step = steps[index];
  const main = document.getElementById('ae-main');
  main.innerHTML = `
    <div class="ae-step-kicker">Step ${index + 1} of ${steps.length}</div>
    <h2 class="ae-step-title">${escapeHtml(step.title)}</h2>
    ${formatBodyParagraphs(step.paragraphs)}
    ${renderCopyRows(step.copies, index)}
  `;

  main.querySelectorAll('.ae-copy-btn').forEach((btn) => {
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

  const dots = document.getElementById('ae-dots');
  dots.innerHTML = steps.map((_, i) => `<span class="ae-dot${i === index ? ' is-on' : ''}"></span>`).join('');
  document.getElementById('ae-prev').disabled = index === 0;
  const next = document.getElementById('ae-next');
  next.textContent = index === steps.length - 1 ? 'Back to depot' : 'Next';
}

function go(delta) {
  const { steps, index } = state;
  const next = index + delta;
  if (next < 0) return;
  if (next >= steps.length) {
    if (delta > 0) window.location.href = 'documents.html';
    return;
  }
  state.index = next;
  render();
}

async function init() {
  const params = new URLSearchParams(window.location.search);
  const leaderId = params.get('leader');
  const errEl = document.getElementById('ae-error');
  const page = document.getElementById('ae-page');

  if (!leaderId) {
    page.hidden = true;
    errEl.hidden = false;
    errEl.textContent = 'Open this guide from the Document Depot using your Android setup link.';
    return;
  }

  let data;
  try {
    const res = await fetch(DATA_URL);
    data = await res.json();
  } catch {
    page.hidden = true;
    errEl.hidden = false;
    errEl.textContent = 'Could not load directory data.';
    return;
  }

  data.emailProfiles.people = mergePeopleOverride(data.emailProfiles.people);
  const leader = (data.leaders || []).find((l) => l.id === leaderId);
  const person = (data.emailProfiles?.people || []).find((p) => p.leaderId === leaderId);

  if (!leader || !person) {
    page.hidden = true;
    errEl.hidden = false;
    errEl.textContent = 'Unknown person. Return to the Document Depot and try again.';
    return;
  }

  document.getElementById('ae-h1').textContent = `Android mail — ${leader.name}`;

  const mc = person.downloads.find((d) => d.kind === 'mobileconfig');
  const androidDoc = person.downloads.find((d) => d.kind !== 'mobileconfig' && d.status === 'live');
  const androidDocHref = androidDoc ? resolvePath(androidDoc.path) : '';

  let normalized = null;
  let usedAuto = false;
  if (mc?.path) {
    const url = resolvePath(mc.path);
    const result = await extractMailSettingsFromMobileConfigUrl(url);
    if (result.ok && result.normalized) {
      normalized = result.normalized;
      if (!normalized.emailAddress && leader.email) normalized.emailAddress = leader.email;
      const inc = normalized.incoming || {};
      usedAuto =
        Boolean(inc.host) ||
        normalized.protocol === 'exchange' ||
        normalized.source === 'eas';
    }
  }
  if (!usedAuto && person.mailSettingsForAndroid) {
    const fromJson = normalizedFromMailSettingsJson(person.mailSettingsForAndroid);
    if (fromJson) {
      normalized = fromJson;
      if (!normalized.emailAddress && leader.email) normalized.emailAddress = leader.email;
      const inc = normalized.incoming || {};
      usedAuto =
        Boolean(inc.host) ||
        normalized.protocol === 'exchange' ||
        normalized.source === 'eas';
    }
  }

  const notice = document.getElementById('ae-notice');
  if (!usedAuto) {
    notice.hidden = false;
    notice.textContent =
      'General mode: server names could not be loaded automatically. Use your reference sheet or IT instructions when the app asks for hosts and ports.';
  } else {
    notice.hidden = true;
  }

  document.getElementById('ae-sub').textContent = usedAuto
    ? 'Copy each value when your mail app asks. Swipe or use the buttons to move between screens.'
    : 'Follow these screens, then use your printed reference or IT-provided hosts if needed.';

  state.steps = usedAuto
    ? buildStepsFromNormalized(leader, normalized, androidDocHref)
    : buildFallbackSteps(leader, androidDocHref);
  state.index = 0;
  render();

  document.getElementById('ae-prev').addEventListener('click', () => go(-1));
  document.getElementById('ae-next').addEventListener('click', () => go(1));

  let tx = null;
  const zone = document.getElementById('ae-main');
  zone.addEventListener('touchstart', (e) => {
    tx = e.changedTouches[0].screenX;
  }, { passive: true });
  zone.addEventListener('touchend', (e) => {
    if (tx == null) return;
    const dx = e.changedTouches[0].screenX - tx;
    tx = null;
    if (dx < -40) go(1);
    if (dx > 40) go(-1);
  }, { passive: true });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') go(1);
    if (e.key === 'ArrowLeft') go(-1);
  });
}

document.addEventListener('DOMContentLoaded', init);
