import { getCurrentUser, logout } from './auth.stub.js';

document.addEventListener('DOMContentLoaded', () => {
  // Check if user is logged in and update nav
  const user = getCurrentUser();
  const authNav = document.getElementById('auth-nav');

  if (user && authNav) {
    authNav.innerHTML = `
      <span>Logged in as <strong>${user.role}</strong></span>
      <button onclick="handleLogout()" class="btn">Logout</button>
    `;
  }
});

window.handleLogout = function () {
  logout();
  window.location.href = '/index.html';
};
