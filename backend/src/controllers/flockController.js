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
  let message = result.arrivalCorrection
    ? 'Flock updated. The arrival correction was recorded and the space check was recalculated.'
    : 'Flock updated.';
  if (result.milestones.changes.length > 0) {
    message += ' The date was saved in the flock history' +
      (result.milestones.reconciledTasks > 0 ? `, and ${result.milestones.reconciledTasks} pending task(s) that depended on it were cancelled.` : '.');
  }
  if (result.milestones.warnings.length > 0) message += ' Please read the warning.';
  sendSuccess(res, 200, result, message);
}

function closeFlock(req, res) {
  const { flock, cancelledTasks, cleanOutTask } = flockService.closeFlock(req.farm, parseId(req.params.flockId, 'Flock ID'), req.validated, req.user.id);
  sendSuccess(res, 200, { flock, cancelledTasks, cleanOutTask }, 'Flock closed. Its records are kept and can still be viewed.' +
    (cancelledTasks > 0 ? ` ${cancelledTasks} pending task${cancelledTasks === 1 ? ' was' : 's were'} cancelled.` : '') +
    ' A task to clean out and rest the house was added.');
}

function deleteFlock(req, res) {
  const { removedTasks } = flockService.deleteFlock(req.farm, parseId(req.params.flockId, 'Flock ID'));
  sendSuccess(res, 200, { removedTasks }, removedTasks > 0
    ? `Flock deleted, with its ${removedTasks} unfinished task${removedTasks === 1 ? '' : 's'}.`
    : 'Flock deleted.');
}

module.exports = { createFlock, listFlocks, getFlock, updateFlock, closeFlock, deleteFlock };
