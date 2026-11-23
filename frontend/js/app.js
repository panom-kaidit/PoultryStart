// Start-up and page switching: finds the route, checks the login, loads the open farm and the user's role on it
// (GET /farms/:id), checks the role may open the screen, and draws the page in its frame.
import { h, setContent } from './components/dom.js';
import { appShell, publicShell } from './components/navigation.js';
import { setFlash } from './components/alerts.js';
import { loadingBlock } from './components/loading.js';
import { clearDrafts } from './components/forms.js';
import { onUnauthorized } from './api/client.js';
import { logout as logoutRequest } from './api/auth.js';
import { isLoggedIn, endSession, onSessionEnd, setReturnTo } from './auth/auth.js';
import { requireLogin, ensureUser, roleMayOpen } from './auth/guards.js';
import { openFarm, clearFarm, getCurrentFarm } from './farm/farm.js';
import { FEATURES, canDo, labelFor } from './farm/access.js';
import { morePage } from './pages/more.js';
import { todayPage } from './pages/today.js';
import { styleguidePage } from './pages/styleguide.js';
import { parseHash, matchRoute, navigate, currentHash, startRouter } from './router.js';
import { APP_NAME } from './config.js';
import { loginPage } from './pages/login.js';
import { registerPage } from './pages/register.js';
import { farmsPage } from './pages/farms.js';
import { newFarmSetupPage, farmSetupPage } from './pages/setup.js';
import { clearSetupState } from './farm/setup-flow.js';
import { accountPage } from './pages/account.js';
import { farmSettingsPage } from './pages/farm-settings.js';
import { editFarmPage } from './pages/edit-farm.js';
import { membersPage } from './pages/members.js';
import { readinessListPage } from './pages/readiness-list.js';
import { readinessAssessmentPage } from './pages/readiness-assessment.js';
import { flocksListPage } from './pages/flocks-list.js';
import { createFlockPage } from './pages/create-flock.js';
import { flockDetailPage } from './pages/flock-detail.js';
import { editFlockPage } from './pages/edit-flock.js';
// The task list page asks for tasks, which GENERATES today's tasks: it is only drawn when the user opens
// #/farms/:id/tasks.
import { tasksListPage } from './pages/tasks-list.js';
import { taskDetailPage } from './pages/task-detail.js';
import { taskFormPage } from './pages/task-form.js';
import { recordsOverviewPage } from './pages/records-overview.js';
import { recordsListPage } from './pages/records-list.js';
import { recordFormPage } from './pages/record-form.js';
import { recordDetailPage } from './pages/record-detail.js';
import { healthOverviewPage } from './pages/health-overview.js';
import { healthListPage } from './pages/health-list.js';
import { healthFlockPage } from './pages/health-flock.js';
import { healthFormPage } from './pages/health-form.js';
import { healthDetailPage } from './pages/health-detail.js';
import { expensesOverviewPage } from './pages/expenses-overview.js';
import { expensesListPage } from './pages/expenses-list.js';
import { expensesFlockPage } from './pages/expenses-flock.js';
import { expenseFormPage } from './pages/expense-form.js';
import { expenseDetailPage } from './pages/expense-detail.js';
import { guidanceHomePage } from './pages/guidance-home.js';
import { guidanceTypePage } from './pages/guidance-type.js';
import { guidanceArticlesPage } from './pages/guidance-articles.js';
import { guidanceArticlePage } from './pages/guidance-article.js';
import { advisorPage } from './pages/advisor.js';
import { dashboardPage } from './pages/dashboard.js';
import { reportsPage } from './pages/reports.js';
import { reportPage } from './pages/report.js';
import { comingSoonPage } from './pages/coming-soon.js';
import { notFoundPage, farmErrorPage, notAvailableForRolePage, generalErrorPage } from './pages/errors.js';

// More specific addresses first ("/farms/new" before "/farms/:farmId").
const guidancePage = (context) => (['broiler', 'layer'].includes(context.params.code)
  ? guidanceTypePage({ ...context, params: { poultryType: context.params.code } }) : guidanceArticlePage(context));

// Old addresses that now open a newer screen (the query string is kept).
const REDIRECTS = [
  { from: '/farms/new', to: () => '/setup/birds?new=1' },
  // Opening a farm (every role) lands on Today, never the task list: opening that list makes the backend
  // generate today's tasks, which must only happen when the user deliberately asks for them.
  { from: '/farms/:farmId', to: ({ farmId }) => `/farms/${farmId}/today` },
  { from: '/farms/:farmId/home', to: ({ farmId }) => `/farms/${farmId}/today` },
];

const ROUTES = [
  { path: '/__styleguide', public: true, open: true, title: 'Components', page: styleguidePage },
  { path: '/login', public: true, full: true, title: 'Log in', page: loginPage },
  { path: '/register', public: true, full: true, title: 'Create an account', page: registerPage },
  { path: '/farms', title: 'My farms', active: 'farms', page: farmsPage },
  // Guided farm setup before the farm exists (any logged-in user; the creator becomes the owner).
  { path: '/setup/:step', title: 'Set up your farm', active: 'farms', full: true, page: newFarmSetupPage },
  { path: '/account', title: 'Your account', active: 'account', page: accountPage },
  // Guidance: any logged-in user, with or without a farm. keepFarm: an open farm's menu stays (from memory;
  // nothing is requested).
  { path: '/guidance', title: 'Poultry guidance', active: 'guidance', keepFarm: true, wide: true, page: guidanceHomePage },
  { path: '/guidance/articles', title: 'Guidance articles', active: 'guidance', keepFarm: true, page: guidanceArticlesPage },
  // /guidance/broiler and /guidance/layer: the type pages; any other: an article code.
  { path: '/guidance/:code', title: 'Guidance', active: 'guidance', keepFarm: true, wide: true, page: guidancePage },
  { path: '/learn', title: 'Learn', active: 'learn', keepFarm: true, wide: true, page: guidanceHomePage },
  { path: '/learn/articles', title: 'Guidance articles', active: 'learn', keepFarm: true, page: guidanceArticlesPage },
  { path: '/learn/:code', title: 'Guidance', active: 'learn', keepFarm: true, wide: true, page: guidancePage },
  // Money is the owner's expenses screen; Record opens the records screen.
  { path: '/farms/:farmId/money', farm: true, feature: 'expenses', title: 'Money' },
  { path: '/farms/:farmId/record', farm: true, feature: 'records', subPage: 'record', action: 'production:create', title: 'Record today', nav: 'record' },
  { path: '/farms/:farmId/:feature', farm: true },
  { path: '/farms/:farmId/settings/edit', farm: true, feature: 'settings', subPage: 'edit', action: 'farm:update', title: 'Edit farm details' },
  { path: '/farms/:farmId/flocks/new', farm: true, feature: 'flocks', subPage: 'new', action: 'flocks:manage', title: 'Record a new flock' },
  { path: '/farms/:farmId/flocks/:flockId', farm: true, feature: 'flocks', subPage: 'detail', itemParam: 'flockId', title: 'Flock' },
  { path: '/farms/:farmId/tasks/new', farm: true, feature: 'tasks', subPage: 'new', action: 'tasks:manage', title: 'New task' },
  { path: '/farms/:farmId/tasks/:taskId', farm: true, feature: 'tasks', subPage: 'detail', itemParam: 'taskId', title: 'Task' },
  { path: '/farms/:farmId/tasks/:taskId/edit', farm: true, feature: 'tasks', subPage: 'edit', itemParam: 'taskId', action: 'tasks:manage', title: 'Edit task' },
  { path: '/farms/:farmId/records/:recordType', farm: true, feature: 'records', subPage: 'list', title: 'Production records' },
  { path: '/farms/:farmId/records/:recordType/new', farm: true, feature: 'records', subPage: 'new', action: 'production:create', title: 'Add a production record' },
  { path: '/farms/:farmId/records/:recordType/:flockId/:recordId', farm: true, feature: 'records', subPage: 'detail',
    itemParams: ['flockId', 'recordId'], title: 'Production record' },
  { path: '/farms/:farmId/health/all', farm: true, feature: 'health', subPage: 'list', title: 'All health observations' },
  { path: '/farms/:farmId/health/new', farm: true, feature: 'health', subPage: 'new', action: 'health:create', title: 'Record a health observation' },
  { path: '/farms/:farmId/health/flocks/:flockId', farm: true, feature: 'health', subPage: 'flock', itemParam: 'flockId', title: 'Health observations of a flock' },
  { path: '/farms/:farmId/health/flocks/:flockId/:observationId', farm: true, feature: 'health', subPage: 'detail',
    itemParams: ['flockId', 'observationId'], title: 'Health observation' },
  { path: '/farms/:farmId/expenses/all', farm: true, feature: 'expenses', subPage: 'list', title: 'All expenses' },
  { path: '/farms/:farmId/expenses/new', farm: true, feature: 'expenses', subPage: 'new', action: 'expenses:record', title: 'Record an expense' },
  { path: '/farms/:farmId/expenses/:expenseId', farm: true, feature: 'expenses', subPage: 'detail', itemParam: 'expenseId', title: 'Expense' },
  { path: '/farms/:farmId/expenses/flocks/:flockId', farm: true, feature: 'expenses', subPage: 'flock', itemParam: 'flockId', title: 'Expenses of a flock' },
  // One report (owner and manager; R6 is checked again on the page: owner only).
  { path: '/farms/:farmId/reports/:reportKey', farm: true, feature: 'reports', subPage: 'report', title: 'Report' },
  { path: '/farms/:farmId/flocks/:flockId/edit', farm: true, feature: 'flocks', subPage: 'edit', itemParam: 'flockId', action: 'flocks:manage', title: 'Edit flock' },
  // Guided setup once the farm exists: the owner's readiness screens (managers and workers are refused).
  { path: '/farms/:farmId/setup/:step', farm: true, feature: 'readiness', subPage: 'setup', action: 'readiness:manage', full: true, title: 'Set up your farm' },
  { path: '/farms/:farmId/readiness/:assessmentId', farm: true, feature: 'readiness', subPage: 'assessment', itemParam: 'assessmentId', title: 'Readiness assessment' },
];

function redirectFor(path) {
  const match = matchRoute(REDIRECTS.map((r) => ({ ...r, path: r.from })), path);
  if (!match || (match.params.farmId && !/^[1-9]\d*$/.test(match.params.farmId))) return null;
  return match.route.to(match.params);
}

const appElement = document.getElementById('app');
let renderCount = 0;
let pageShownBefore = false; // false until the first real page is on screen

// The session ends: forget the open farm and any unsaved input.
onSessionEnd(() => {
  clearFarm();
  clearDrafts();
  clearSetupState();
});

// A logged-in request answered 401: remember the page, end the session and show the login page.
// The request is NOT sent again.
let expiring = false;
onUnauthorized(() => {
  if (expiring) return;
  expiring = true;
  setReturnTo(currentHash());
  endSession({ keepReturnTo: true });
  navigate('/login?reason=expired', { replace: true });
});

async function logOut() {
  try {
    await logoutRequest(); // the backend only confirms; it keeps no session
  } catch {
    // Already expired or offline: the token is removed here anyway.
  }
  endSession();
  setFlash('success', 'You have logged out.');
  navigate('/login');
}

function setTitle(title) {
  document.title = title ? `${title} – ${APP_NAME}` : APP_NAME;
}

// Draws a page inside a frame. After a page change the focus moves to the new heading (keyboard and screen
// readers start at the top); on the first page of a visit, and for loading screens, it is left alone.
function show(frame, content, title, { isLoading = false } = {}) {
  setContent(frame.main, content);
  setContent(appElement, frame.root);
  setTitle(title);
  if (isLoading) return;
  if (pageShownBefore) (frame.main.querySelector('h1') || frame.main).focus();
  pageShownBefore = true;
}

let currentUser = null;

// Screens with the wide layout (cards side by side from 900px), by page key.
const WIDE = new Set(['today', 'flocks', 'flocks/detail', 'expenses', 'more', 'reports', 'reports/report']);

function farmFrame(farm, active, wide = false) {
  return appShell({ farm, user: currentUser, active, wide, onLogout: logOut });
}

const plainFrame = (active = null, farm = null, wide = false) => appShell({ farm, user: currentUser, active, wide, onLogout: currentUser ? logOut : null });

async function render() {
  const thisRender = ++renderCount;
  const isStale = () => thisRender !== renderCount;
  const hash = currentHash();
  const { path, query } = parseHash(hash);

  if (path === '/') {
    navigate(isLoggedIn() ? '/farms' : '/login', { replace: true });
    return;
  }

  const redirect = redirectFor(path);
  if (redirect) {
    const search = hash.includes('?') ? hash.slice(hash.indexOf('?')) : '';
    navigate(`${redirect}${search}`, { replace: true });
    return;
  }

  const match = matchRoute(ROUTES, path);

  if (match?.route.open) {
    show(publicShell(), match.route.page({ query }), match.route.title);
    return;
  }

  // ---- Public pages -------------------------------------------------
  if (match?.route.public) {
    if (isLoggedIn()) {
      navigate('/farms', { replace: true });
      return;
    }
    expiring = false;
    show(publicShell({ full: match.route.full }), match.route.page({ query }), match.route.title);
    return;
  }

  // ---- Everything else needs a login -------------------------------
  if (!requireLogin(hash, navigate)) return;

  const loadingFrame = plainFrame();
  show(loadingFrame, loadingBlock(), 'Loading', { isLoading: true });

  let user;
  try {
    user = await ensureUser();
  } catch (error) {
    if (isStale() || error.status === 401) return; // 401: the login page is already on its way
    show(loadingFrame, generalErrorPage({ error, onRetry: render }), 'Error');
    return;
  }
  if (isStale()) return;
  currentUser = user;

  if (!match) {
    show(plainFrame(), notFoundPage(), 'Page not found');
    return;
  }

  // ---- Pages that are not about one farm ---------------------------
  if (!match.route.farm) {
    const keptFarm = match.route.keepFarm ? getCurrentFarm()?.farm || null : null;
    const frame = match.route.full ? publicShell({ full: true }) : plainFrame(match.route.active, keptFarm, Boolean(match.route.wide));
    show(frame, match.route.page({ user, query, params: match.params, onLogout: logOut }), match.route.title);
    return;
  }

  // ---- Farm pages ----------------------------------------------------
  const farmId = match.params.farmId;
  if (!/^[1-9]\d*$/.test(farmId)) {
    show(plainFrame(), notFoundPage(), 'Page not found');
    return;
  }

  let farmContext;
  try {
    farmContext = await openFarm(Number(farmId));
  } catch (error) {
    if (isStale() || error.status === 401) return;
    // Nothing about the farm is shown (404 = not found OR not a member).
    show(plainFrame(), farmErrorPage({ error, onRetry: render }), 'Farm not available');
    return;
  }
  if (isStale()) return;

  const role = farmContext.farm.myRole;
  const feature = match.route.feature || match.params.feature;
  // The guidance library needs no farm.
  if (feature === 'guidance' && !match.route.feature) {
    navigate('/guidance', { replace: true });
    return;
  }
  const frame = farmFrame(farmContext.farm, match.route.nav || feature,
    WIDE.has(match.route.subPage ? `${feature}/${match.route.subPage}` : feature));
  if (!FEATURES[feature]) {
    show(frame, notFoundPage(), 'Page not found');
    return;
  }
  // The screen must be in the role's menu, and a screen that changes
  // something needs the role's permission for it (the backend checks again).
  if (!roleMayOpen(role, feature) || (match.route.action && !canDo(role, match.route.action))) {
    show(frame, notAvailableForRolePage({ farmContext }), 'Not available');
    return;
  }
  const itemParams = match.route.itemParams || (match.route.itemParam ? [match.route.itemParam] : []);
  if (itemParams.some((name) => !/^[1-9]\d*$/.test(match.params[name]))) {
    show(frame, notFoundPage(), 'Page not found');
    return;
  }

  const context = { user, query, params: match.params, farmContext, feature, onLogout: logOut };
  if (match.route.subPage === 'setup') {
    const setup = farmSetupPage(context);
    if (!setup) show(frame, notFoundPage(), 'Page not found');
    else show(publicShell({ full: true }), setup, `${match.route.title} – ${farmContext.farm.name}`);
    return;
  }
  const pages = {
    today: todayPage,
    more: morePage,
    'records/record': recordsOverviewPage,
    settings: farmSettingsPage,
    'settings/edit': editFarmPage,
    members: membersPage,
    readiness: readinessListPage,
    'readiness/assessment': readinessAssessmentPage,
    flocks: flocksListPage,
    'flocks/new': createFlockPage,
    'flocks/detail': flockDetailPage,
    'flocks/edit': editFlockPage,
    tasks: tasksListPage,
    'tasks/new': taskFormPage,
    'tasks/detail': taskDetailPage,
    'tasks/edit': taskFormPage,
    records: recordsOverviewPage,
    'records/list': recordsListPage,
    'records/new': recordFormPage,
    'records/detail': recordDetailPage,
    health: healthOverviewPage,
    'health/list': healthListPage,
    'health/new': healthFormPage,
    'health/flock': healthFlockPage,
    'health/detail': healthDetailPage,
    expenses: expensesOverviewPage,
    'expenses/list': expensesListPage,
    'expenses/new': expenseFormPage,
    'expenses/flock': expensesFlockPage,
    'expenses/detail': expenseDetailPage,
    advisor: advisorPage,
    dashboard: dashboardPage,
    reports: reportsPage,
    'reports/report': reportPage,
  };
  const pageKey = match.route.subPage ? `${feature}/${match.route.subPage}` : feature;
  const page = (pages[pageKey] || comingSoonPage)(context);
  show(frame, page, `${match.route.title || labelFor(feature, role)} – ${farmContext.farm.name}`);
}

startRouter(() => {
  render().catch(() => {
    show(plainFrame(), h('div', {}, generalErrorPage({ error: null, onRetry: render })), 'Error');
  });
});
