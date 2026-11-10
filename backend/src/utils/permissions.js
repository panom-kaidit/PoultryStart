// Permission utilities

const ROLES = Object.freeze({
  OWNER: 'owner',
  MANAGER: 'manager',
  WORKER: 'worker',
});

const ALL_ROLES = [ROLES.OWNER, ROLES.MANAGER, ROLES.WORKER];
const OWNER_ONLY = [ROLES.OWNER];
const OWNER_AND_MANAGER = [ROLES.OWNER, ROLES.MANAGER];

const PERMISSIONS = Object.freeze({
  // Farm profile 
  'farm:view': ALL_ROLES,
  'farm:update': OWNER_ONLY,
  'farm:delete': OWNER_ONLY,

  // Members
  'members:view': OWNER_AND_MANAGER,
  'members:manage': OWNER_ONLY,

  // Readiness assessment and resource checklist 
  'readiness:manage': OWNER_ONLY,

  // Flocks, Workers can view so they can pick a flock when recording.
  'flocks:view': ALL_ROLES,
  'flocks:manage': OWNER_AND_MANAGER,

  // Daily tasks
  'tasks:view': ALL_ROLES,
  'tasks:manage': OWNER_AND_MANAGER,
  'tasks:complete': ALL_ROLES,

  // Farm activity records
  'activities:view': ALL_ROLES,
  'activities:record': ALL_ROLES,
  'activities:update': ALL_ROLES,

  // Expenses 
  'expenses:manage': OWNER_ONLY,

  // Dashboard . Managers get it without the expense summary.
  'dashboard:view': OWNER_AND_MANAGER,

  // Deleting records: owner only
  'records:delete': OWNER_ONLY,
});

function roleHasPermission(role, permission) {
  const allowedRoles = PERMISSIONS[permission];
  if (!allowedRoles) {
    // A typo in a permission name should fail loudly during development.
    throw new Error(`Unknown permission: ${permission}`);
  }
  return allowedRoles.includes(role);
}

module.exports = { ROLES, PERMISSIONS, roleHasPermission };
