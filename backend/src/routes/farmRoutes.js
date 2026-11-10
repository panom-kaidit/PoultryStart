// Routes for /api/farms

const express = require('express');
const farmController = require('../controllers/farmController');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const { loadFarmAccess, requirePermission } = require('../middleware/farmAccess');
const { createFarmRules, updateFarmRules } = require('../validators/farmValidators');

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

module.exports = router;
