// Which screens, nav items and buttons each farm role is shown.
export const FEATURES = Object.freeze({
  today: {
    label: 'Today', phase: null, roles: ['owner', 'manager', 'worker'],
    description: 'What is happening on this farm today.',
  },
  more: {
    label: 'More', phase: null, roles: ['owner', 'manager', 'worker'],
    description: 'Everything else on this farm, and your account.',
  },
  dashboard: {
    label: 'Dashboard', phase: null, roles: ['owner', 'manager'],
    description: 'A summary of your farm: flocks, today\'s tasks, records and reminders.',
  },
  tasks: {
    label: 'Tasks', phase: null, roles: ['owner', 'manager', 'worker'],
    description: 'The daily tasks for your flocks: what to do today and what is done.',
  },
  flocks: {
    label: 'Flocks', phase: null, roles: ['owner', 'manager', 'worker'],
    description: 'Your flocks, their birds and their history.',
  },
  records: {
    label: 'Production records', phase: null, roles: ['owner', 'manager', 'worker'],
    description: 'Bird weights, egg collections, feed and drinking water for each flock.',
  },
  health: {
    label: 'Health observations', phase: null, roles: ['owner', 'manager', 'worker'],
    description: 'Notes of anything unusual seen in a flock (no diagnosis).',
  },
  expenses: {
    label: 'Money', phase: null, roles: ['owner'],
    description: 'Money spent on the farm (farm owner only).',
  },
  advisor: {
    label: 'Advisor', phase: null, roles: ['owner', 'manager', 'worker'],
    description: 'Rule-based advice from what is recorded for this farm (read-only).',
  },
  reports: {
    label: 'Reports', phase: null, roles: ['owner', 'manager'],
    description: 'Summaries of flock numbers, deaths and tasks.',
  },
  readiness: {
    label: 'Readiness assessment', phase: null, roles: ['owner'],
    description: 'Check that the house, equipment, feed and water are ready before the birds arrive (farm owner only).',
  },
  settings: {
    label: 'Farm profile', ownerLabel: 'Farm settings', phase: null, roles: ['owner', 'manager', 'worker'],
    description: 'The farm\'s details and its space check.',
  },
  members: {
    label: 'Members', phase: null, roles: ['owner', 'manager'],
    description: 'The people who work on this farm and their roles.',
  },
});

const MENU = {
  owner: ['dashboard', 'tasks', 'records', 'health', 'expenses', 'advisor', 'reports', 'readiness', 'settings', 'members'],
  manager: ['dashboard', 'tasks', 'records', 'health', 'advisor', 'reports', 'settings', 'members'],
  worker: ['tasks', 'records', 'health', 'advisor', 'settings'],
};

const NAV = Object.freeze([
  { key: 'today', label: 'Today', icon: 'home', path: 'today', feature: 'today' },
  { key: 'flocks', label: 'Flocks', icon: 'egg', path: 'flocks', feature: 'flocks' },
  { key: 'record', label: 'Record today', icon: 'plus', path: 'record', feature: 'records', action: 'production:create', raised: true },
  { key: 'learn', label: 'Learn', icon: 'book', global: '#/learn' },
  { key: 'more', label: 'More', icon: 'more', path: 'more', feature: 'more' },
]);

const SIDEBAR = Object.freeze([
  { key: 'today', label: 'Today', icon: 'home', path: 'today', feature: 'today' },
  { key: 'flocks', label: 'Flocks', icon: 'egg', path: 'flocks', feature: 'flocks' },
  { key: 'learn', label: 'Learn', icon: 'book', global: '#/learn' },
  { key: 'money', label: 'Money', icon: 'money', path: 'money', feature: 'expenses' },
  { key: 'reports', label: 'Reports', icon: 'chart', path: 'reports', feature: 'reports' },
  { key: 'more', label: 'Farm and people', icon: 'sliders', path: 'more', feature: 'more' },
]);

const NAV_FOR_FEATURE = {
  today: 'today', home: 'today', dashboard: 'today', tasks: 'today',
  flocks: 'flocks', records: 'flocks', health: 'flocks',
  record: 'record',
  learn: 'learn', guidance: 'learn', advisor: 'learn',
  more: 'more', expenses: 'more', reports: 'more', readiness: 'more', settings: 'more', members: 'more', farms: 'more', account: 'more',
};

const ACTIONS = Object.freeze({
  'tasks:manage': ['owner', 'manager'],
  'tasks:complete': ['owner', 'manager', 'worker'],
  'tasks:reopen': ['owner', 'manager'],
  'production:create': ['owner', 'manager', 'worker'],
  'production:correct': ['owner', 'manager'],
  'health:create': ['owner', 'manager', 'worker'],
  'health:correct': ['owner', 'manager'],
  'expenses:record': ['owner'],
  'expenses:correct': ['owner'],
  'flocks:manage': ['owner', 'manager'],
  'flocks:record_mortality': ['owner', 'manager', 'worker'],
  'records:delete': ['owner'],
  'farm:update': ['owner'],
  'farm:delete': ['owner'],
  'members:manage': ['owner'],
  'readiness:manage': ['owner'],
});

export function canOpen(role, feature) {
  return Boolean(FEATURES[feature] && FEATURES[feature].roles.includes(role));
}

export function canDo(role, action) {
  return Boolean(ACTIONS[action] && ACTIONS[action].includes(role));
}

export function labelFor(feature, role) {
  const definition = FEATURES[feature];
  return role === 'owner' && definition.ownerLabel ? definition.ownerLabel : definition.label;
}

export function menuFor(role) {
  return (MENU[role] || []).filter((feature) => canOpen(role, feature))
    .map((feature) => ({ feature, ...FEATURES[feature], label: labelFor(feature, role) }));
}

export function navFor(role, farmId) {
  return NAV.filter((item) => item.global || (canOpen(role, item.feature) && (!item.action || canDo(role, item.action))))
    .map((item) => ({ ...item, href: item.global || `#/farms/${farmId}/${item.path}` }));
}

export function navKeyFor(feature) {
  return NAV_FOR_FEATURE[feature] || null;
}

export function sidebarFor(role, farmId) {
  return SIDEBAR.filter((item) => item.global || canOpen(role, item.feature))
    .map((item) => ({ ...item, href: item.global || `#/farms/${farmId}/${item.path}` }));
}

export function sidebarKeyFor(feature) {
  if (feature === 'expenses' || feature === 'money') return 'money';
  if (feature === 'reports') return 'reports';
  return NAV_FOR_FEATURE[feature] || null;
}

export { ACTIONS, NAV };
