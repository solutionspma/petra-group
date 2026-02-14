import { getCurrentUser, isLoggedIn } from './auth.stub.js';
import { getRoleLabel } from './roles.js';

document.addEventListener('DOMContentLoaded', () => {
  // Require authentication
  if (!isLoggedIn()) {
    window.location.href = '/login.html';
    return;
  }

  const user = getCurrentUser();
  const roleLabel = getRoleLabel(user.role);

  // Populate dashboard header
  const dashboardHeader = document.getElementById('dashboard-header');
  if (dashboardHeader) {
    dashboardHeader.innerHTML = `
      <h2>Welcome, ${roleLabel}</h2>
      <p>Role: <strong>${user.role}</strong></p>
    `;
  }

  // Load dashboard content based on role
  loadDashboardContent(user.role);
});

function loadDashboardContent(role) {
  const contentArea = document.getElementById('dashboard-content');

  const content = {
    admin: `
      <h3>Administrator Dashboard</h3>
      <p>Full system access available.</p>
      <ul>
        <li>Manage users and roles</li>
        <li>View all content</li>
        <li>System settings</li>
      </ul>
    `,
    officer: `
      <h3>Officer Portal</h3>
      <p>Manage agents and content.</p>
      <ul>
        <li>View team members</li>
        <li>Manage agent profiles</li>
        <li>Edit public content</li>
      </ul>
    `,
    agent: `
      <h3>Agent Portal</h3>
      <p>Manage your profile and resources.</p>
      <ul>
        <li>Edit your profile</li>
        <li>Access resources</li>
        <li>View enrollment materials</li>
      </ul>
    `,
    viewer: `
      <h3>Public Portal</h3>
      <p>Access public resources and information.</p>
    `
  };

  if (contentArea) {
    contentArea.innerHTML = content[role] || '';
  }
}
