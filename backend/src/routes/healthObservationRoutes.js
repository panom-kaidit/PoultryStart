// Routes for health observations:
const express = require('express');
const controller = require('../controllers/healthObservationController');
const validate = require('../middleware/validate');
const { requirePermission } = require('../middleware/farmAccess');
const { createRules, correctionRules, listRules, farmListRules } = require('../validators/healthObservationValidators');

const flockHealthRoutes = express.Router({ mergeParams: true });
flockHealthRoutes.get('/', requirePermission('health:view'), listRules, validate, controller.list);
flockHealthRoutes.post('/', requirePermission('health:create'), createRules, validate, controller.create);
flockHealthRoutes.get('/:observationId', requirePermission('health:view'), controller.get);
flockHealthRoutes.post('/:observationId/corrections', requirePermission('health:correct'), correctionRules, validate, controller.correct);

const farmHealthRoutes = express.Router({ mergeParams: true });
farmHealthRoutes.get('/', requirePermission('health:view'), farmListRules, validate, controller.listFarm);

module.exports = { flockHealthRoutes, farmHealthRoutes };
