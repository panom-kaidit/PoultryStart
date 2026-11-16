// Routes for /api/farms/:farmId/readiness 
// Mounted in farmRoutes.js after authenticate and loadFarmAccess.
const express = require('express');
const readinessController = require('../controllers/readinessController');
const validate = require('../middleware/validate');
const { requirePermission } = require('../middleware/farmAccess');
const {
  saveResponsesRules,
  createResourceRules,
  updateResourceRules,
} = require('../validators/readinessValidators');

const router = express.Router({ mergeParams: true });

// Every readiness route is for the Farm Owner only (Use Case diagram).
router.use(requirePermission('readiness:manage'));

// Assessments
router.get('/', readinessController.listAssessments);
router.post('/', readinessController.createAssessment);
router.get('/:assessmentId', readinessController.getAssessment);
router.patch('/:assessmentId/responses', saveResponsesRules, validate, readinessController.saveResponses);

// Resource checklist of an assessment
router.get('/:assessmentId/resources', readinessController.listResources);
router.post('/:assessmentId/resources', createResourceRules, validate, readinessController.addCustomResource);
router.patch('/:assessmentId/resources/:itemId', updateResourceRules, validate, readinessController.updateResource);

module.exports = router;
