// Handles HTTP requests for /api/farms/:farmId/flocks 
const flockService = require('../services/flockService');
const { sendSuccess } = require('../utils/response');
const { parseId } = require('../utils/ids');

function createFlock(req, res) {
  const result = flockService.createFlock(req.farm, req.validated, req.user.id);
  const message = result.warnings.length > 0
    ? `Flock recorded with ${result.warnings.length} warning${result.warnings.length === 1 ? '' : 's'}. Please read them.`
    : 'Flock recorded.';
  sendSuccess(res, 201, result, message);
}

function listFlocks(req, res) {
  sendSuccess(res, 200, { flocks: flockService.listFlocks(req.farm, req.query.status) });
}

function getFlock(req, res) {
  const flock = flockService.getFlock(req.farm, parseId(req.params.flockId, 'Flock ID'));
  sendSuccess(res, 200, { flock });
}

function updateFlock(req, res) {
  const result = flockService.updateFlock(req.farm, parseId(req.params.flockId, 'Flock ID'), req.validated, req.user.id);
  const message = result.arrivalCorrection
    ? 'Flock updated. The arrival correction was recorded and the space check was recalculated.'
    : 'Flock updated.';
  sendSuccess(res, 200, result, message);
}

function closeFlock(req, res) {
  const flock = flockService.closeFlock(req.farm, parseId(req.params.flockId, 'Flock ID'), req.validated);
  sendSuccess(res, 200, { flock }, 'Flock closed. Its records are kept and can still be viewed.');
}

function deleteFlock(req, res) {
  flockService.deleteFlock(req.farm, parseId(req.params.flockId, 'Flock ID'));
  sendSuccess(res, 200, undefined, 'Flock deleted.');
}

module.exports = { createFlock, listFlocks, getFlock, updateFlock, closeFlock, deleteFlock };
