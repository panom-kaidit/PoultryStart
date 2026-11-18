// Handles the reports under /api/farms/:farmId/reports (owner and manager; read-only).
const service = require('../services/reportService');
const { parseId } = require('../utils/ids');
const { sendSuccess } = require('../utils/response');

function flockReport(req, res) {
  sendSuccess(res, 200, service.flockReport(req.farm, parseId(req.params.flockId, 'Flock ID'), req.query));
}

function mortalityReport(req, res) {
  sendSuccess(res, 200, service.mortalityReport(req.farm, req.query));
}

function taskReport(req, res) {
  sendSuccess(res, 200, service.taskReport(req.farm, req.query));
}

module.exports = { flockReport, mortalityReport, taskReport };
