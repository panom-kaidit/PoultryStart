// Handles HTTP requests for /api/farms.

const farmService = require('../services/farmService');
const { sendSuccess } = require('../utils/response');

function createFarm(req, res) {
  const result = farmService.createFarm(req.user.id, req.validated);
  const message = result.readinessAssessment
    ? 'Farm created. The readiness assessment has started; you can stop and continue at any time.'
    : 'Farm created. You can start the readiness assessment later from the farm dashboard.';
  sendSuccess(res, 201, result, message);
}

function listFarms(req, res) {
  const farms = farmService.listFarmsForUser(req.user.id);
  sendSuccess(res, 200, { farms });
}

function getFarm(req, res) {
  sendSuccess(res, 200, farmService.getFarm(req.farm, req.membership));
}

function updateFarm(req, res) {
  const result = farmService.updateFarm(req.farm, req.validated, req.membership);
  sendSuccess(res, 200, result, 'Farm updated successfully.');
}

function deleteFarm(req, res) {
  farmService.deleteFarm(req.farm.id);
  sendSuccess(res, 200, undefined, 'Farm and all its records were deleted.');
}

module.exports = { createFarm, listFarms, getFarm, updateFarm, deleteFarm };
