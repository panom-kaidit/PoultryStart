// Handles HTTP requests for production records:
//   /api/farms/:farmId/flocks/:flockId/records/{weights|eggs|feed|water}
//   /api/farms/:farmId/production-records (all flocks of a farm)
const service = require('../services/productionRecordService');
const { sendSuccess } = require('../utils/response');
const { parseId } = require('../utils/ids');
const { RECORD_TYPES } = require('../data/productionRecords');

const flockIdOf = (req) => parseId(req.params.flockId, 'Flock ID');
const recordIdOf = (req) => parseId(req.params.recordId, 'Record ID');

// One set of handlers per record type.
function handlersFor(type) {
  const label = RECORD_TYPES[type].label;
  return {
    create(req, res) {
      const record = service.createRecord(type, req.farm, flockIdOf(req), req.validated, req.user.id);
      sendSuccess(res, 201, { record }, `${label} saved.`);
    },
    list(req, res) {
      sendSuccess(res, 200, service.listRecords(type, req.farm, flockIdOf(req), req.query));
    },
    summary(req, res) {
      sendSuccess(res, 200, { summary: service.summary(type, req.farm, flockIdOf(req), req.query) });
    },
    get(req, res) {
      sendSuccess(res, 200, { record: service.getRecord(type, req.farm, flockIdOf(req), recordIdOf(req)) });
    },
    correct(req, res) {
      const record = service.correctRecord(type, req.farm, flockIdOf(req), recordIdOf(req), req.validated, req.user.id);
      sendSuccess(res, 200, { record }, `${label} corrected. The earlier values are kept in its correction history.`);
    },
  };
}

function listFarmRecords(req, res) {
  sendSuccess(res, 200, service.listFarmRecords(req.farm, req.query));
}

module.exports = { handlersFor, listFarmRecords };
