let currentUser = null;

export function fakeLogin(role) {
  currentUser = {
    id: Math.random().toString(36),
    role: role,
    loginTime: new Date().toISOString()
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

export function isLoggedIn() {
  return getCurrentUser() !== null;
}

export function logout() {
  currentUser = null;
  localStorage.removeItem('user');
}

export function requireAuth() {
  if (!isLoggedIn()) {
    window.location.href = '/login.html';
  }
}
