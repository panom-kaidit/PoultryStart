// Routes for poultry guidance :
const express = require('express');
const controller = require('../controllers/guidanceController');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const { listGuidanceRules } = require('../validators/guidanceValidators');

const router = express.Router();

router.use(authenticate);
router.get('/', listGuidanceRules, validate, controller.list);
router.get('/topics', controller.topics);
router.get('/:code', controller.get);

module.exports = router;
