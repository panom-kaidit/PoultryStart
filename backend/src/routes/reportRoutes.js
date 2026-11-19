// Routes for reports:
const express = require('express');
const controller = require('../controllers/reportController');
const validate = require('../middleware/validate');
const { requirePermission } = require('../middleware/farmAccess');
const { flockReportRules, periodReportRules } = require('../validators/reportValidators');

const router = express.Router({ mergeParams: true });

router.use(requirePermission('reports:view'));
router.get('/flocks/:flockId', flockReportRules, validate, controller.flockReport);
router.get('/mortality', periodReportRules, validate, controller.mortalityReport);
router.get('/tasks', periodReportRules, validate, controller.taskReport);

module.exports = router;
