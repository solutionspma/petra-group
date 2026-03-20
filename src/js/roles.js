export const ROLES = {
  ADMIN: 'admin',
  OFFICER: 'officer',
  AGENT: 'agent',
  BROKER: 'broker',
  MANAGEMENT: 'management',
  VIEWER: 'viewer'
};

export function hasPermission(role, action) {
  const permissions = {
    admin: ['*'],
    officer: ['view', 'edit', 'manage_agents', 'manage_content'],
    management: ['view', 'edit', 'publish', 'manage_docs'],
    broker: ['view', 'edit_self', 'view_resources', 'training_access'],
    agent: ['view', 'edit_self', 'view_resources', 'training_access'],
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
    management: 'Management',
    broker: 'Broker',
    agent: 'Agent',
    viewer: 'Viewer'
  };
  return labels[role] || 'Unknown';
}
