// Routes for production records:
const express = require('express');
const controller = require('../controllers/productionRecordController');
const validate = require('../middleware/validate');
const { requirePermission } = require('../middleware/farmAccess');
const { createRules, correctionRules, listRules, farmListRules } = require('../validators/productionRecordValidators');
const { RECORD_TYPES } = require('../data/productionRecords');

const flockRecordRoutes = express.Router({ mergeParams: true });
for (const [type, { path }] of Object.entries(RECORD_TYPES)) {
  const h = controller.handlersFor(type);
  flockRecordRoutes.get(`/${path}`, requirePermission('production:view'), listRules, validate, h.list);
  flockRecordRoutes.get(`/${path}/summary`, requirePermission('production:view'), listRules, validate, h.summary);
  flockRecordRoutes.post(`/${path}`, requirePermission('production:create'), createRules(type), validate, h.create);
  flockRecordRoutes.get(`/${path}/:recordId`, requirePermission('production:view'), h.get);
  flockRecordRoutes.post(`/${path}/:recordId/corrections`, requirePermission('production:correct'), correctionRules(type), validate, h.correct);
}

const farmRecordRoutes = express.Router({ mergeParams: true });
farmRecordRoutes.get('/', requirePermission('production:view'), farmListRules, validate, controller.listFarmRecords);

module.exports = { flockRecordRoutes, farmRecordRoutes };
