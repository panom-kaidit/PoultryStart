// Handles HTTP requests for /api/farms/:farmId/readiness.
// The routes have already checked: logged in, member of the farm, and the
// 'readiness:manage' permission (Farm Owner only).
const readinessService = require('../services/readinessService');
const { sendSuccess } = require('../utils/response');
const { parseId } = require('../utils/ids');

const assessmentIdOf = (req) => parseId(req.params.assessmentId, 'Assessment ID');

function listAssessments(req, res) {
  sendSuccess(res, 200, readinessService.listAssessments(req.farm));
}

function createAssessment(req, res) {
  const detail = readinessService.createAssessment(req.farm);
  sendSuccess(res, 201, detail, 'Readiness assessment started.');
}

function getAssessment(req, res) {
  sendSuccess(res, 200, readinessService.getAssessment(req.farm, assessmentIdOf(req)));
}

function saveResponses(req, res) {
  const detail = readinessService.saveResponses(
    req.farm, assessmentIdOf(req), req.validated.responses, req.user.id
  );
  sendSuccess(res, 200, detail, 'Answers saved.');
}

function listResources(req, res) {
  sendSuccess(res, 200, readinessService.listResources(req.farm, assessmentIdOf(req)));
}

function addCustomResource(req, res) {
  const result = readinessService.addCustomResource(req.farm, assessmentIdOf(req), req.validated);
  sendSuccess(res, 201, result, 'Checklist item added.');
}

function updateResource(req, res) {
  const itemId = parseId(req.params.itemId, 'Item ID');
  const result = readinessService.updateResource(req.farm, assessmentIdOf(req), itemId, req.validated);
  sendSuccess(res, 200, result, 'Checklist item updated.');
}

module.exports = {
  listAssessments,
  createAssessment,
  getAssessment,
  saveResponses,
  listResources,
  addCustomResource,
  updateResource,
};
