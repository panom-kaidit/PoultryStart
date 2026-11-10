// Handles HTTP requests for /api/farms.

const farmService = require('../services/farmService');
const { sendSuccess } = require('../utils/response');

function createFarm(req, res) {
  const farm = farmService.createFarm(req.user.id, req.validated);
  sendSuccess(res, 201, { farm }, 'Farm created successfully.');
}

function listFarms(req, res) {
  const farms = farmService.listFarmsForUser(req.user.id);
  sendSuccess(res, 200, { farms });
}

function getFarm(req, res) {
  const farm = farmService.getFarm(req.farm, req.membership);
  sendSuccess(res, 200, { farm });
}

function updateFarm(req, res) {
  const farm = farmService.updateFarm(req.farm.id, req.validated, req.membership);
  sendSuccess(res, 200, { farm }, 'Farm updated successfully.');
}

function deleteFarm(req, res) {
  farmService.deleteFarm(req.farm.id);
  sendSuccess(res, 200, undefined, 'Farm and all its records were deleted.');
}

module.exports = { createFarm, listFarms, getFarm, updateFarm, deleteFarm };
