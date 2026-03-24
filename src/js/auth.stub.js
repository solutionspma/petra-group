/**
 * Auth stub — browser-only session + master account.
 *
 * Supabase migration (map 1:1):
 * - Replace loginMaster / completeMasterPasswordChange with supabase.auth.signInWithPassword / updateUser
 * - Store role in profiles.role or auth.users.app_metadata.role; keep `master` as highest privilege
 * - mustChangePassword → check profiles.must_change_password or user metadata
 * - Remove tpg_master_credential from localStorage; use Supabase only for password hashes
 */

let currentUser = null;

export const MASTER_EMAIL = 'solutions@pitchmarketing.agency';
export const MASTER_INITIAL_PASSWORD = 'Enter123456!';

const STORAGE_USER = 'user';
const STORAGE_MASTER_CREDENTIAL = 'tpg_master_credential';

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function readMasterCredential() {
  try {
    const raw = localStorage.getItem(STORAGE_MASTER_CREDENTIAL);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function persistUser(user) {
  currentUser = user;
  localStorage.setItem(STORAGE_USER, JSON.stringify(user));
}

export function fakeLogin(role) {
  currentUser = {
    id: Math.random().toString(36).slice(2),
    role,
    loginTime: new Date().toISOString(),
    authProvider: 'stub',
  };
  localStorage.setItem(STORAGE_USER, JSON.stringify(currentUser));
  return currentUser;
}

export function getCurrentUser() {
  if (currentUser) return currentUser;
  const stored = localStorage.getItem(STORAGE_USER);
  if (stored) {
    try {
      currentUser = JSON.parse(stored);
      return currentUser;
    } catch {
      return null;
    }
  }
  return null;
}

export function getCurrentRole() {
  const user = getCurrentUser();
  return user?.role || null;
}

export function isLoggedIn() {
  return getCurrentUser() !== null;
}

export function isMaster() {
  return getCurrentUser()?.role === 'master';
}

export function logout() {
  currentUser = null;
  localStorage.removeItem(STORAGE_USER);
}

export function loginPath() {
  return '/login.html';
}

export function setPasswordPath() {
  return '/set-password.html';
}

/**
 * Master email/password login. Returns { ok, error?, mustChangePassword? }
 */
export async function loginMaster(email, password) {
  const normalized = (email || '').trim().toLowerCase();
  if (normalized !== MASTER_EMAIL.toLowerCase()) {
    return { ok: false, error: 'Use the portal shortcuts below, or enter the site owner email.' };
  }

  const cred = readMasterCredential();
  let passwordOk = false;
  let mustChangePassword = false;

  if (cred && cred.passwordHash) {
    const hash = await sha256Hex(password);
    passwordOk = hash === cred.passwordHash;
  } else {
    passwordOk = password === MASTER_INITIAL_PASSWORD;
    mustChangePassword = true;
  }

  if (!passwordOk) {
    return { ok: false, error: 'Invalid email or password.' };
  }

  const user = {
    id: cred?.id || `master-${normalized.replace(/[^a-z0-9]/g, '-')}`,
    email: MASTER_EMAIL,
    role: 'master',
    loginTime: new Date().toISOString(),
    authProvider: 'stub',
    mustChangePassword,
  };

  persistUser(user);
  return { ok: true, mustChangePassword };
}

/**
 * After first login with the initial password — set real password (stored as SHA-256 locally until Supabase).
 */
export async function completeMasterPasswordChange(newPassword, confirmPassword) {
  const user = getCurrentUser();
  if (!user || user.role !== 'master') {
    return { ok: false, error: 'Not signed in as site owner.' };
  }
  if (newPassword.length < 10) {
    return { ok: false, error: 'Use at least 10 characters for your new password.' };
  }
  if (newPassword !== confirmPassword) {
    return { ok: false, error: 'Passwords do not match.' };
  }
  if (newPassword === MASTER_INITIAL_PASSWORD) {
    return { ok: false, error: 'Choose a different password than the initial temporary one.' };
  }

  const hash = await sha256Hex(newPassword);
  const cred = readMasterCredential() || {};
  localStorage.setItem(
    STORAGE_MASTER_CREDENTIAL,
    JSON.stringify({
      ...cred,
      email: MASTER_EMAIL,
      passwordHash: hash,
      updatedAt: new Date().toISOString(),
    })
  );

  const next = { ...user, mustChangePassword: false };
  persistUser(next);
  return { ok: true };
}

export function requireAuth() {
  if (!isLoggedIn()) {
    window.location.href = loginPath();
    return false;
  }

  const user = getCurrentUser();
  if (user.role === 'master' && user.mustChangePassword) {
    const path = window.location.pathname || '';
    if (!path.endsWith('set-password.html')) {
      window.location.href = setPasswordPath();
      return false;
    }
  }

  return true;
}

export function requireRole(requiredRole) {
  if (!requireAuth()) return false;

  const user = getCurrentUser();
  if (user.role === 'master') return true;

  const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
  if (!roles.includes(user.role)) {
    window.location.href = loginPath();
    return false;
  }

  return true;
}

export function requireMaster() {
  if (!requireAuth()) return false;
  if (getCurrentUser().role !== 'master') {
    window.location.href = loginPath();
    return false;
  }
  return true;
}
