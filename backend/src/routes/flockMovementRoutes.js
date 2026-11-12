// Routes for /api/farms/:farmId/flocks/:flockId/movements (FR-06, FR-09)
// Mounted in flockRoutes.js; farm membership has already been checked.
const express = require('express');
const flockMovementController = require('../controllers/flockMovementController');
const validate = require('../middleware/validate');
const { requirePermission } = require('../middleware/farmAccess');
const { recordMovementRules } = require('../validators/flockValidators');
const AppError = require('../utils/AppError');
const { roleHasPermission } = require('../utils/permissions');

const router = express.Router({ mergeParams: true });

// Mortality: every role ('flocks:record_mortality'). Every other movement
// (culling, sales, transfers out, additional birds, corrections) changes the
// flock's numbers by a management decision: Owner and Manager only
// ('flocks:manage'). Workers therefore cannot use corrections either.
function requireMovementTypePermission(req, res, next) {
  const permission = req.validated.movementType === 'mortality' ? 'flocks:record_mortality' : 'flocks:manage';
  if (!roleHasPermission(req.membership.role, permission)) {
    throw new AppError(403, 'Your role on this farm only allows recording mortality.');
  }
  next();
}

router.get('/', requirePermission('flocks:view'), flockMovementController.listMovements);
router.post('/',
  requirePermission('flocks:record_mortality'), // the least any movement needs
  recordMovementRules, validate,
  requireMovementTypePermission,
  flockMovementController.recordMovement);

module.exports = router;
