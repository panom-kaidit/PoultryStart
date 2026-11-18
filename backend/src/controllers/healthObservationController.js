// Handles HTTP requests for health observations
const service = require('../services/healthObservationService');
const { sendSuccess } = require('../utils/response');
const { parseId } = require('../utils/ids');
const { DISCLAIMER } = require('../data/healthObservations');

const flockIdOf = (req) => parseId(req.params.flockId, 'Flock ID');
const observationIdOf = (req) => parseId(req.params.observationId, 'Observation ID');

function create(req, res) {
  const observation = service.createObservation(req.farm, flockIdOf(req), req.validated, req.user.id);
  sendSuccess(res, 201, { observation, disclaimer: DISCLAIMER }, 'Health observation saved.');
}

function list(req, res) {
  sendSuccess(res, 200, { ...service.listObservations(req.farm, flockIdOf(req), req.query), disclaimer: DISCLAIMER });
}

function get(req, res) {
  const observation = service.getObservation(req.farm, flockIdOf(req), observationIdOf(req));
  sendSuccess(res, 200, { observation, disclaimer: DISCLAIMER });
}

function correct(req, res) {
  const observation = service.correctObservation(req.farm, flockIdOf(req), observationIdOf(req), req.validated, req.user.id);
  sendSuccess(res, 200, { observation, disclaimer: DISCLAIMER },
    'Health observation corrected. The earlier values are kept in its correction history.');
}

function listFarm(req, res) {
  sendSuccess(res, 200, { ...service.listFarmObservations(req.farm, req.query), disclaimer: DISCLAIMER });
}

module.exports = { create, list, get, correct, listFarm };
