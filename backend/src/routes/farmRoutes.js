// Routes for /api/farms

const express = require('express');
const farmController = require('../controllers/farmController');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const { loadFarmAccess, requirePermission } = require('../middleware/farmAccess');
const { createFarmRules, updateFarmRules } = require('../validators/farmValidators');
const memberRoutes = require('./memberRoutes');
const readinessRoutes = require('./readinessRoutes');
const flockRoutes = require('./flockRoutes');
const taskRoutes = require('./taskRoutes');
const { farmRecordRoutes } = require('./productionRecordRoutes');
const { farmHealthRoutes } = require('./healthObservationRoutes');
const expenseRoutes = require('./expenseRoutes');
const advisorController = require('../controllers/advisorController');
const { advisorRules } = require('../validators/guidanceValidators');
const dashboardController = require('../controllers/dashboardController');
const { dashboardRules } = require('../validators/reportValidators');
const reportRoutes = require('./reportRoutes');

const router = express.Router();

// Every farm route needs a logged-in user.
router.use(authenticate);

router.post('/', createFarmRules, validate, farmController.createFarm);
router.get('/', farmController.listFarms);

router.get('/:farmId',
  loadFarmAccess, requirePermission('farm:view'),
  farmController.getFarm);

router.patch('/:farmId',
  loadFarmAccess, requirePermission('farm:update'),
  updateFarmRules, validate,
  farmController.updateFarm);

router.delete('/:farmId',
  loadFarmAccess, requirePermission('farm:delete'),
  farmController.deleteFarm);

// Member routes
router.use('/:farmId/members', loadFarmAccess, memberRoutes);
router.use('/:farmId/readiness', loadFarmAccess, readinessRoutes);
router.use('/:farmId/flocks', loadFarmAccess, flockRoutes);
router.use('/:farmId/tasks', loadFarmAccess, taskRoutes);
router.use('/:farmId/production-records', loadFarmAccess, farmRecordRoutes);
router.use('/:farmId/health-observations', loadFarmAccess, farmHealthRoutes);
router.use('/:farmId/expenses', loadFarmAccess, expenseRoutes);

// Poultry Advisor.
router.get('/:farmId/advisor', loadFarmAccess, requirePermission('advisor:view'), advisorRules, validate, advisorController.advise);

// Dashboard and reports.
router.get('/:farmId/dashboard', loadFarmAccess, requirePermission('dashboard:view'), dashboardRules, validate, dashboardController.dashboard);
router.use('/:farmId/reports', loadFarmAccess, reportRoutes);

module.exports = router;
