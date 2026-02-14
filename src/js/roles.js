export const ROLES = {
  ADMIN: 'admin',
  OFFICER: 'officer',
  AGENT: 'agent',
  VIEWER: 'viewer'
};

export function hasPermission(role, action) {
  const permissions = {
    admin: ['*'],
    officer: ['view', 'edit', 'manage_agents', 'manage_content'],
    agent: ['view', 'edit_self', 'view_resources'],
    viewer: ['view']
  };

  if (!role) return false;
  return (
    permissions[role]?.includes(action) ||
    permissions[role]?.includes('*') ||
    false
  );
}

export function getRoleLabel(role) {
  const labels = {
    admin: 'Administrator',
    officer: 'Officer',
    agent: 'Agent',
    viewer: 'Viewer'
  };
  return labels[role] || 'Unknown';
}
