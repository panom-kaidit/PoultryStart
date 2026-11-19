// Handles health observation business operations.
const { runInImmediateTransaction } = require('../config/database');
const flockModel = require('../models/flockModel');
const flockMovementModel = require('../models/flockMovementModel');
const healthModel = require('../models/healthObservationModel');
const AppError = require('../utils/AppError');
const { ugandaToday, addDays, daysBetween } = require('../utils/dates');
const { MAX_RANGE_DAYS, DEFAULT_RANGE_DAYS } = require('../data/productionRecords');

const invalid = (field, message) => {
  throw new AppError(400, 'Some of the information provided is invalid.', [{ field, message }]);
};

function getFlockOrFail(farm, flockId) {
  const flock = flockModel.findByIdForFarm(farm.id, flockId);
  if (!flock) throw new AppError(404, 'Flock not found.');
  return flock;
}

const populationOn = (flock, date) => flockMovementModel.liveBirdCountOn(flock.id, date);

function checkObservationDate(flock, date) {
  if (date > ugandaToday()) invalid('observationDate', 'The observation date cannot be in the future.');
  if (date < flock.arrivalDate) invalid('observationDate', `The observation date cannot be before the flock arrived (${flock.arrivalDate}).`);
  if (flock.status === 'closed' && flock.closedAt && date > flock.closedAt.slice(0, 10)) {
    invalid('observationDate', `This flock was closed on ${flock.closedAt.slice(0, 10)}. Observations can only be dated on or before that day.`);
  }
}

function valuesFor(flock, data) {
  checkObservationDate(flock, data.observationDate);
  const values = {
    observationDate: data.observationDate,
    observation: data.observation,
    birdsAffected: data.birdsAffected ?? null,
    actionTaken: data.actionTaken ? data.actionTaken : null,
    vetContacted: data.vetContacted ?? false,
    extensionOfficerContacted: data.extensionOfficerContacted ?? false,
  };
  if (values.birdsAffected !== null) {
    const population = populationOn(flock, values.observationDate);
    if (values.birdsAffected > population) {
      invalid('birdsAffected', `${values.birdsAffected} birds affected is more than the ${population} birds the flock had on ` +
        `${values.observationDate}. Please check the number.`);
    }
  }
  return values;
}

function present(observation, flock, cache = new Map()) {
  const key = observation.observationDate;
  if (!cache.has(key)) cache.set(key, populationOn(flock, key));
  const population = cache.get(key);
  const exceeds = observation.birdsAffected !== null && observation.birdsAffected > population;
  return {
    ...observation,
    populationOnDate: population,
    exceedsPopulation: exceeds,
    warnings: exceeds ? [{
      code: 'exceeds_population',
      message: `${observation.birdsAffected} birds affected, but the flock's records now show ${population} birds on ` +
        `${observation.observationDate}. A later backdated movement may explain it. Check the observation or the movement.`,
    }] : [],
  };
}
const withHistory = (observation, flock) => ({ ...present(observation, flock), corrections: healthModel.findCorrections(observation.id) });

function rangeOf(query) {
  const today = ugandaToday();
  let { from, to } = query;
  if (query.date) { from = query.date; to = query.date; }
  to = to || (from ? addDays(from, DEFAULT_RANGE_DAYS - 1) : today);
  from = from || addDays(to, -(DEFAULT_RANGE_DAYS - 1));
  if (to < from) invalid('to', '"to" cannot be before "from".');
  if (daysBetween(from, to) + 1 > MAX_RANGE_DAYS) invalid('to', `Choose a range of at most ${MAX_RANGE_DAYS} days.`);
  return { from, to };
}

function createObservation(farm, flockId, data, userId) {
  return runInImmediateTransaction(() => {
    const flock = getFlockOrFail(farm, flockId);
    const observation = healthModel.create({ farmId: farm.id, flockId: flock.id, createdBy: userId }, valuesFor(flock, data));
    return withHistory(observation, flock);
  });
}

function listObservations(farm, flockId, query) {
  const flock = getFlockOrFail(farm, flockId);
  const range = rangeOf(query);
  const cache = new Map();
  return { flockId: flock.id, ...range,
    observations: healthModel.list({ farmId: farm.id, flockId: flock.id, ...range }).map((o) => present(o, flock, cache)) };
}

function getObservation(farm, flockId, observationId) {
  const flock = getFlockOrFail(farm, flockId);
  const observation = healthModel.findForFlock(farm.id, flock.id, observationId);
  if (!observation) throw new AppError(404, 'Health observation not found.');
  return withHistory(observation, flock);
}

function correctObservation(farm, flockId, observationId, data, userId) {
  return runInImmediateTransaction(() => {
    const flock = getFlockOrFail(farm, flockId);
    const current = healthModel.findForFlock(farm.id, flock.id, observationId);
    if (!current) throw new AppError(404, 'Health observation not found.');
    if (current.version !== data.expectedVersion) {
      throw new AppError(409, `This observation was changed by someone else (it is now version ${current.version}, you sent ` +
        `${data.expectedVersion}). Reload it and correct it again.`, [{ field: 'expectedVersion', message: `Current version: ${current.version}.` }]);
    }
    const merged = Object.fromEntries(Object.keys(healthModel.FIELDS)
      .map((field) => [field, data[field] !== undefined ? data[field] : current[field]]));
    const values = valuesFor(flock, merged);

    const changes = {};
    for (const field of Object.keys(healthModel.FIELDS)) {
      const from = current[field] ?? null;
      const to = values[field] ?? null;
      if (from !== to) changes[field] = { from, to };
    }
    if (Object.keys(changes).length === 0) invalid('reason', 'The correction does not change anything.');
    const corrected = healthModel.applyCorrection(current, { values, changes, reason: data.reason, correctedBy: userId });
    return withHistory(corrected, flock);
  });
}

function listFarmObservations(farm, query) {
  const flockId = query.flockId ? Number(query.flockId) : undefined;
  if (flockId) getFlockOrFail(farm, flockId);
  const range = rangeOf(query);
  const flocks = new Map();
  const caches = new Map();
  const observations = healthModel.list({ farmId: farm.id, flockId, ...range }).map((o) => {
    if (!flocks.has(o.flockId)) { flocks.set(o.flockId, flockModel.findById(o.flockId)); caches.set(o.flockId, new Map()); }
    return present(o, flocks.get(o.flockId), caches.get(o.flockId));
  });
  return { ...(flockId ? { flockId } : {}), ...range, observations };
}

module.exports = { createObservation, listObservations, getObservation, correctObservation, listFarmObservations };
