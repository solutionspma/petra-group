/**
 * Document Depot — loads catalog from /data/documents.json (relative to site root).
 */

const DATA_URL = new URL('../data/documents.json', import.meta.url);
const EMAIL_OVERRIDE_KEY = 'tpg_email_profiles_override';

function applyLocalEmailOverride(data) {
  try {
    const raw = localStorage.getItem(EMAIL_OVERRIDE_KEY);
    if (!raw) return;
    const o = JSON.parse(raw);
    if (!o?.people || !Array.isArray(o.people)) return;
    data.emailProfiles.people = data.emailProfiles.people.map((p) => {
      const patch = o.people.find((x) => x.leaderId === p.leaderId);
      if (!patch) return p;
      const n = { ...p };
      if (patch.downloads) n.downloads = patch.downloads;
      if (patch.androidFlipTutorial !== undefined) n.androidFlipTutorial = patch.androidFlipTutorial;
      return n;
    });
    const banner = document.getElementById('depot-preview-banner');
    if (banner) {
      banner.hidden = false;
      banner.textContent =
        'Preview mode: leadership email rows reflect a merge stored in this browser only. Deploy files + documents.json for all users.';
    }
  } catch (e) {
    console.warn('Email profile override ignored', e);
  }
}

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

function renderLeaderSection(data) {
  const root = document.getElementById('depot-leaders');
  if (!root || !data.emailProfiles || !data.leaders) return;

  const leaderMap = Object.fromEntries(data.leaders.map((l) => [l.id, l]));

  root.innerHTML = data.emailProfiles.people
    .map((person) => {
      const leader = leaderMap[person.leaderId];
      if (!leader) return '';

      const imgSrc = leader.teamImage
        ? `/assets/images/team/${encodeURIComponent(leader.teamImage)}`
        : '';

      const downloadsHtml = person.downloads
        .map((d) => {
          const href = resolvePath(d.path);
          const isIos = d.kind === 'mobileconfig';
          const canUse = d.status === 'live';
          const badge =
            d.status === 'live'
              ? '<span class="depot-badge depot-badge-live">Ready</span>'
              : '<span class="depot-badge depot-badge-pending">Awaiting file</span>';

          const btnClass = isIos ? 'depot-btn depot-btn-primary' : 'depot-btn depot-btn-secondary';
          const label = canUse
            ? isIos
              ? 'Install profile'
              : 'Download'
            : isIos
              ? 'Profile not published yet'
              : 'Unavailable';

          const control = canUse
            ? isIos
              ? `<a class="${btnClass}" href="${escapeHtml(href)}" target="_blank" rel="noopener">${escapeHtml(label)}</a>`
              : `<a class="${btnClass}" href="${escapeHtml(href)}" download>${escapeHtml(label)}</a>`
            : `<button type="button" class="${btnClass}" disabled>${escapeHtml(label)}</button>`;

          return `
            <div class="depot-action-row">
              <span class="depot-action-label">${escapeHtml(d.label)} ${badge}</span>
              ${control}
            </div>`;
        })
        .join('');

      const hasAndroidDoc = person.downloads.some((d) => d.kind !== 'mobileconfig');
      const flipTutorialRow = hasAndroidDoc
        ? `<div class="depot-action-row depot-flip-row">
            <span class="depot-action-label">Android — screen-by-screen</span>
            <a class="depot-btn depot-btn-outline" href="email-setup-cards.html?leader=${encodeURIComponent(person.leaderId)}">Flip-card tutorial</a>
          </div>`
        : '';

      const avatarHtml = imgSrc
        ? `<img class="depot-leader-avatar" src="${escapeHtml(imgSrc)}" alt="" width="72" height="72" loading="lazy" onerror="this.style.display='none'">`
        : `<div class="depot-leader-avatar" aria-hidden="true"></div>`;

      return `
        <article class="depot-leader-card" data-leader-id="${escapeHtml(person.leaderId)}">
          <div class="depot-leader-head">
            ${avatarHtml}
            <div class="depot-leader-meta">
              <h3>${escapeHtml(leader.name)}</h3>
              <span>${escapeHtml(leader.title)}</span>
              ${
                leader.email
                  ? `<span class="depot-leader-email"><a href="mailto:${escapeHtml(leader.email)}">${escapeHtml(leader.email)}</a></span>`
                  : ''
              }
            </div>
          </div>
          <div class="depot-leader-actions">
            ${downloadsHtml}
            ${flipTutorialRow}
          </div>
        </article>`;
    })
    .join('');

  const help = document.getElementById('depot-email-help');
  if (help && data.emailProfiles) {
    help.innerHTML = `
      <details class="depot-help">
        <summary>iPhone &amp; iPad — how installation works</summary>
        <p>${escapeHtml(data.emailProfiles.iphoneHelp)}</p>
      </details>
      <details class="depot-help" style="margin-top:12px">
        <summary>Android (Samsung, etc.)</summary>
        <p>${escapeHtml(data.emailProfiles.androidHelp)}</p>
      </details>`;
  }
}

function matchesSearch(doc, q) {
  if (!q) return true;
  const hay = `${doc.title} ${doc.description || ''} ${(doc.tags || []).join(' ')}`.toLowerCase();
  return hay.includes(q);
}

function renderDocumentGrid(data, state) {
  const root = document.getElementById('depot-documents');
  if (!root) return;

  const q = state.query.trim().toLowerCase();
  const cat = state.categoryId;

  const filtered = (data.documents || []).filter((doc) => {
    if (cat !== 'all' && doc.categoryId !== cat) return false;
    return matchesSearch(doc, q);
  });

  if (filtered.length === 0) {
    root.innerHTML =
      '<p class="depot-empty">No documents match this filter. Try another category or clear the search.</p>';
    return;
  }

  root.innerHTML = filtered
    .map((doc) => {
      const files =
        (doc.files || []).length > 0
          ? doc.files
              .map(
                (f) =>
                  `<a class="depot-btn depot-btn-secondary" style="margin-top:8px" href="${escapeHtml(resolvePath(f.path))}" download>${escapeHtml(f.label)}</a>`
              )
              .join('')
          : '<p class="depot-doc-meta">No files attached yet.</p>';

      const tags = (doc.tags || [])
        .map((t) => `<span class="depot-tag">${escapeHtml(t)}</span>`)
        .join('');

      const catName =
        (data.categories || []).find((c) => c.id === doc.categoryId)?.name || doc.categoryId;

      return `
        <article class="depot-doc-card" data-doc-id="${escapeHtml(doc.id)}">
          <div class="depot-tag-list">${tags}</div>
          <h3>${escapeHtml(doc.title)}</h3>
          <p>${escapeHtml(doc.description || '')}</p>
          <p class="depot-doc-meta">${escapeHtml(catName)} · v${escapeHtml(doc.version || '?')} · Updated ${escapeHtml(doc.updated || '')}</p>
          ${files}
        </article>`;
    })
    .join('');
}

function renderCategoryChips(data, state, onChange) {
  const root = document.getElementById('depot-category-chips');
  if (!root) return;

  root.innerHTML = (data.categories || [])
    .map((c) => {
      const pressed = c.id === state.categoryId;
      return `<button type="button" class="depot-chip" data-cat="${escapeHtml(c.id)}" aria-pressed="${pressed}">${escapeHtml(c.name)}</button>`;
    })
    .join('');

  root.querySelectorAll('.depot-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      onChange(btn.getAttribute('data-cat'));
    });
  });
}

function updateChipPressed(state) {
  document.querySelectorAll('.depot-chip').forEach((btn) => {
    btn.setAttribute('aria-pressed', btn.getAttribute('data-cat') === state.categoryId);
  });
}

function setupAdminTool() {
  const input = document.getElementById('depot-admin-file');
  const out = document.getElementById('depot-admin-snippet');
  if (!input || !out) return;

  input.addEventListener('change', () => {
    const file = input.files && input.files[0];
    if (!file) {
      out.value = '';
      return;
    }
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
    const path = `/assets/documents/email-profiles/${safeName}`;
    out.value = JSON.stringify(
      {
        hint: 'Add under emailProfiles.people[].downloads or documents[].files',
        exampleFileEntry: {
          label: file.name,
          kind: file.name.endsWith('.mobileconfig') ? 'mobileconfig' : 'pdf',
          path,
          status: file.name.endsWith('.mobileconfig') ? 'live' : 'live',
        },
        deploySteps: [
          `Save the file as: src/assets/documents/email-profiles/${safeName}`,
          'Run npm run build and deploy dist/',
        ],
      },
      null,
      2
    );
  });
}

async function init() {
  let data;
  try {
    const res = await fetch(DATA_URL);
    data = await res.json();
  } catch (e) {
    console.error(e);
    document.getElementById('depot-documents').innerHTML =
      '<p class="depot-empty">Could not load document catalog. Check your connection and try again.</p>';
    return;
  }

  applyLocalEmailOverride(data);

  const metaTitle = document.getElementById('depot-meta-title');
  const metaSub = document.getElementById('depot-meta-sub');
  if (metaTitle) metaTitle.textContent = data.meta?.title || 'Document Depot';
  if (metaSub) metaSub.textContent = data.meta?.subtitle || '';

  const emailIntro = document.getElementById('depot-email-intro');
  if (emailIntro && data.emailProfiles?.description) {
    emailIntro.textContent = data.emailProfiles.description;
  }

  renderLeaderSection(data);

  const state = {
    categoryId: 'all',
    query: '',
  };

  const hash = window.location.hash.replace(/^#/, '');
  if (hash && (data.categories || []).some((c) => c.id === hash)) {
    state.categoryId = hash;
  }

  const search = document.getElementById('depot-search');
  if (search) {
    search.addEventListener('input', () => {
      state.query = search.value;
      renderDocumentGrid(data, state);
    });
  }

  renderCategoryChips(data, state, (catId) => {
    state.categoryId = catId;
    updateChipPressed(state);
    renderDocumentGrid(data, state);
  });

  renderDocumentGrid(data, state);

  setupAdminTool();
}

document.addEventListener('DOMContentLoaded', init);
