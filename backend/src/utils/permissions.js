// Defines the role permission matrix and permission checks.
const ROLES = Object.freeze({
  OWNER: 'owner',
  MANAGER: 'manager',
  WORKER: 'worker',
});

const ALL_ROLES = [ROLES.OWNER, ROLES.MANAGER, ROLES.WORKER];
const OWNER_ONLY = [ROLES.OWNER];
const OWNER_AND_MANAGER = [ROLES.OWNER, ROLES.MANAGER];

const PERMISSIONS = Object.freeze({
  'farm:view': ALL_ROLES,
  'farm:update': OWNER_ONLY,
  'farm:delete': OWNER_ONLY,

  'members:view': OWNER_AND_MANAGER,
  'members:manage': OWNER_ONLY,

  'readiness:manage': OWNER_ONLY,

  'flocks:view': ALL_ROLES,
  'flocks:manage': OWNER_AND_MANAGER,
  'flocks:record_mortality': ALL_ROLES,

  'tasks:view': ALL_ROLES,
  'tasks:manage': OWNER_AND_MANAGER,
  'tasks:complete': ALL_ROLES,
  'tasks:reopen': OWNER_AND_MANAGER,

  'production:view': ALL_ROLES,
  'production:create': ALL_ROLES,
  'production:correct': OWNER_AND_MANAGER,

  'health:view': ALL_ROLES,
  'health:create': ALL_ROLES,
  'health:correct': OWNER_AND_MANAGER,

  'expenses:view': OWNER_ONLY,
  'expenses:record': OWNER_ONLY,
  'expenses:correct': OWNER_ONLY,

  'advisor:view': ALL_ROLES,

  'dashboard:view': OWNER_AND_MANAGER,

  'reports:view': OWNER_AND_MANAGER,

  'records:delete': OWNER_ONLY,
});

function roleHasPermission(role, permission) {
  const allowedRoles = PERMISSIONS[permission];
  if (!allowedRoles) {
    throw new Error(`Unknown permission: ${permission}`);
  }
  return allowedRoles.includes(role);
}

module.exports = { ROLES, PERMISSIONS, roleHasPermission };
