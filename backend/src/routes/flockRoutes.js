// Routes for /api/farms/:farmId/flocks
const express = require('express');
const flockController = require('../controllers/flockController');
const validate = require('../middleware/validate');
const { requirePermission } = require('../middleware/farmAccess');
const {
  createFlockRules, listFlocksRules, updateFlockRules, closeFlockRules,
} = require('../validators/flockValidators');
const flockMovementRoutes = require('./flockMovementRoutes');

const router = express.Router({ mergeParams: true });

// View: Owner, Manager and Worker. Record a flock: Owner and Manager.
router.get('/', requirePermission('flocks:view'), listFlocksRules, validate, flockController.listFlocks);
router.post('/', requirePermission('flocks:manage'), createFlockRules, validate, flockController.createFlock);
router.get('/:flockId', requirePermission('flocks:view'), flockController.getFlock);

// Edit and close: Owner and Manager.
router.patch('/:flockId', requirePermission('flocks:manage'), updateFlockRules, validate, flockController.updateFlock);
router.post('/:flockId/close', requirePermission('flocks:manage'), closeFlockRules, validate, flockController.closeFlock);
router.delete('/:flockId', requirePermission('records:delete'), flockController.deleteFlock);

// Bird movements of one flock.
router.use('/:flockId/movements', flockMovementRoutes);

module.exports = router;
