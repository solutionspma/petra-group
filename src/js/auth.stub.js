let currentUser = null;

export function fakeLogin(role) {
  currentUser = {
    id: Math.random().toString(36).slice(2),
    role: role,
    loginTime: new Date().toISOString(),
  };
  localStorage.setItem('user', JSON.stringify(currentUser));
  return currentUser;
}

export function getCurrentUser() {
  if (currentUser) return currentUser;
  const stored = localStorage.getItem('user');
  if (stored) {
    try {
      currentUser = JSON.parse(stored);
      return currentUser;
    } catch (e) {
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

export function logout() {
  currentUser = null;
  localStorage.removeItem('user');
}

export function requireAuth() {
  if (!isLoggedIn()) {
    window.location.href = '/portal/login.html';
    return false;
  }
  return true;
}

export function requireRole(requiredRole) {
  if (!requireAuth()) return false;

  const user = getCurrentUser();
  const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];

  if (!roles.includes(user.role)) {
    window.location.href = '/portal/login.html';
    return false;
  }

  return true;
}
