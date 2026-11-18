// Handles GET /api/farms/:farmId/advisor (all farm roles; filtered by role).
const service = require('../services/advisorService');
const { sendSuccess } = require('../utils/response');

function advise(req, res) {
  sendSuccess(res, 200, service.advise(req.farm, req.membership, req.query));
}

module.exports = { advise };
