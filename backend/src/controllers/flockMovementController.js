// Handles HTTP requests for /api/farms/:farmId/flocks/:flockId/movements.
const flockMovementService = require('../services/flockMovementService');
const { sendSuccess } = require('../utils/response');
const { parseId } = require('../utils/ids');

function listMovements(req, res) {
  sendSuccess(res, 200, flockMovementService.listMovements(req.farm, parseId(req.params.flockId, 'Flock ID')));
}

function recordMovement(req, res) {
  const result = flockMovementService.recordMovement(
    req.farm, parseId(req.params.flockId, 'Flock ID'), req.validated, req.user.id
  );
  let message = `Recorded. The flock now has ${result.flock.liveBirds} live birds.`;
  if (result.capacityCheck && result.capacityCheck.status !== 'within_capacity') {
    message += ' Warning: please read the space check (capacityCheck).';
  }
  sendSuccess(res, 201, result, message);
}

module.exports = { listMovements, recordMovement };
