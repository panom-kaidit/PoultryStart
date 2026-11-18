// Routes for expenses:
const express = require('express');
const controller = require('../controllers/expenseController');
const validate = require('../middleware/validate');
const { requirePermission } = require('../middleware/farmAccess');
const { createRules, correctionRules, listRules, summaryRules } = require('../validators/expenseValidators');

const router = express.Router({ mergeParams: true });

router.get('/', requirePermission('expenses:view'), listRules, validate, controller.list);
router.post('/', requirePermission('expenses:record'), createRules, validate, controller.create);
router.get('/summary', requirePermission('expenses:view'), summaryRules, validate, controller.summary);
router.get('/:expenseId', requirePermission('expenses:view'), controller.get);
router.post('/:expenseId/corrections', requirePermission('expenses:correct'), correctionRules, validate, controller.correct);

module.exports = router;
