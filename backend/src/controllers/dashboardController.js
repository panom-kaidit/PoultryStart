// Handles GET /api/farms/:farmId/dashboard (owner and manager; read-only).
const service = require('../services/dashboardService');
const { sendSuccess } = require('../utils/response');

function dashboard(req, res) {
  sendSuccess(res, 200, service.dashboard(req.farm, req.membership));
}

module.exports = { dashboard };
