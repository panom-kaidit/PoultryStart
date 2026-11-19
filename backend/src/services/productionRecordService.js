// Handles production record business operations.
const { runInImmediateTransaction } = require('../config/database');
const flockModel = require('../models/flockModel');
const flockMovementModel = require('../models/flockMovementModel');
const recordModel = require('../models/productionRecordModel');
const AppError = require('../utils/AppError');
const { ugandaToday, addDays, daysBetween } = require('../utils/dates');
const {
  FEED_STAGES, LIMITS, MAX_RANGE_DAYS, DEFAULT_RANGE_DAYS, ACTUAL_RECORDS_NOTE, EGG_CATEGORIES, RECORD_TYPES,
} = require('../data/productionRecords');

const invalid = (field, message) => {
  throw new AppError(400, 'Some of the information provided is invalid.', [{ field, message }]);
};
const round = (n, places) => Math.round(n * 10 ** places) / 10 ** places;

function getFlockOrFail(farm, flockId) {
  const flock = flockModel.findByIdForFarm(farm.id, flockId);
  if (!flock) throw new AppError(404, 'Flock not found.');
  return flock;
}

const populationOn = (flock, date) => flockMovementModel.liveBirdCountOn(flock.id, date);

function checkRecordDate(flock, date) {
  if (date > ugandaToday()) invalid('recordDate', 'The record date cannot be in the future.');
  if (date < flock.arrivalDate) invalid('recordDate', `The record date cannot be before the flock arrived (${flock.arrivalDate}).`);
  if (flock.status === 'closed' && flock.closedAt && date > flock.closedAt.slice(0, 10)) {
    invalid('recordDate', `This flock was closed on ${flock.closedAt.slice(0, 10)}. Records can only be dated on or before that day.`);
  }
}

const toGrams = (value, unit) => round(unit === 'kg' ? value * 1000 : value, 1);
const toKg = (value, unit) => round(unit === 'g' ? value / 1000 : value, 3);
const toLitres = (value, unit) => round(unit === 'ml' ? value / 1000 : value, 3);

function weightValues(flock, input) {
  checkRecordDate(flock, input.recordDate);
  const limit = LIMITS.birdWeightG;
  const inRange = (g) => g >= limit.min && g <= limit.max;
  let values;
  if (input.method === 'individual') {
    const weights = input.weightsG;
    if (!weights.every(inRange)) {
      invalid('weights', `Each bird's weight must be between ${limit.min} g and ${limit.max / 1000} kg. Check the unit (g or kg).`);
    }
    values = {
      method: 'individual',
      sampleSize: weights.length,
      averageWeightG: round(weights.reduce((a, b) => a + b, 0) / weights.length, 1),
      minWeightG: Math.min(...weights),
      maxWeightG: Math.max(...weights),
      sampleWeightsG: weights,
    };
  } else {
    if (!inRange(input.averageWeightG)) {
      invalid('averageWeight', `The average weight must be between ${limit.min} g and ${limit.max / 1000} kg. Check the unit (g or kg).`);
    }
    values = { method: 'aggregate', sampleSize: input.sampleSize, averageWeightG: input.averageWeightG,
      minWeightG: null, maxWeightG: null, sampleWeightsG: null };
  }
  const population = populationOn(flock, input.recordDate);
  if (values.sampleSize > population) {
    invalid('sampleSize', `${values.sampleSize} birds weighed is more than the ${population} birds the flock had on ${input.recordDate}.`);
  }
  const entered = {
    enteredUnit: input.enteredUnit ?? null,
    enteredWeights: input.method === 'individual' ? (input.enteredWeights ?? null) : null,
    enteredAverageWeight: input.method === 'aggregate' ? (input.enteredAverageWeight ?? null) : null,
  };
  return { recordDate: input.recordDate, ...values, ...entered, notes: input.notes ?? null };
}

function eggValues(flock, input, excludeId) {
  if (flock.poultryType !== 'layer') invalid('flockId', 'Egg production records are only for layer flocks.');
  if (!flock.firstEggDate) {
    throw new AppError(409, 'No first-egg date has been recorded for this flock. The owner or a manager must record ' +
      'the first-egg date (on the flock) before egg production can be recorded.');
  }
  checkRecordDate(flock, input.recordDate);
  if (input.recordDate < flock.firstEggDate) {
    invalid('recordDate', `Egg records cannot be dated before the first-egg date (${flock.firstEggDate}).`);
  }
  const values = {
    recordDate: input.recordDate,
    collectionPeriod: input.collectionPeriod,
    goodEggs: input.goodEggs ?? 0,
    secondGradeEggs: input.secondGradeEggs ?? 0,
    floorEggs: input.floorEggs ?? 0,
    notes: input.notes ?? null,
  };
  const dayTotal = recordModel.eggsOnDay(flock.id, values.recordDate, excludeId)
    + values.goodEggs + values.secondGradeEggs + values.floorEggs;
  const population = populationOn(flock, values.recordDate);
  if (dayTotal > population) {
    invalid('goodEggs', `That makes ${dayTotal} eggs on ${values.recordDate}, more than the ${population} birds the flock ` +
      'had on that day (a hen lays at most one egg a day). Please check the numbers.');
  }
  return values;
}

function feedValues(flock, input) {
  checkRecordDate(flock, input.recordDate);
  const stage = input.feedStage || 'unknown';
  if (!FEED_STAGES[flock.poultryType].includes(stage)) {
    invalid('feedStage', `For ${flock.poultryType} flocks the feed stage must be one of: ${FEED_STAGES[flock.poultryType].join(', ')}.`);
  }
  const quantityKg = toKg(input.quantity, input.unit);
  if (quantityKg <= 0) invalid('quantity', 'The quantity is too small to record.');
  if (quantityKg > LIMITS.feedKg) invalid('quantity', `${quantityKg} kg in one day looks like a typing mistake. Check the unit (kg or g).`);
  return {
    recordDate: input.recordDate, feedStage: stage, quantityKg, enteredQuantity: input.quantity, enteredUnit: input.unit,
    measurementMethod: input.measurementMethod, notes: input.notes ?? null,
  };
}

function waterValues(flock, input) {
  checkRecordDate(flock, input.recordDate);
  const quantityLitres = toLitres(input.quantity, input.unit);
  if (quantityLitres <= 0) invalid('quantity', 'The quantity is too small to record.');
  if (quantityLitres > LIMITS.waterLitres) invalid('quantity', `${quantityLitres} L in one day looks like a typing mistake. Check the unit (L or ml).`);
  return {
    recordDate: input.recordDate, quantityLitres, enteredQuantity: input.quantity, enteredUnit: input.unit,
    measurementMethod: input.measurementMethod, notes: input.notes ?? null,
  };
}

const BUILDERS = { weight: weightValues, eggs: eggValues, feed: feedValues, water: waterValues };

function inputFromRequest(type, data) {
  if (type === 'weight') {
    const unit = data.unit || 'g';
    return Array.isArray(data.weights)
      ? { recordDate: data.recordDate, method: 'individual', weightsG: data.weights.map((w) => toGrams(w, unit)),
        enteredUnit: unit, enteredWeights: data.weights, notes: data.notes }
      : { recordDate: data.recordDate, method: 'aggregate', sampleSize: data.sampleSize, averageWeightG: toGrams(data.averageWeight, unit),
        enteredUnit: unit, enteredAverageWeight: data.averageWeight, notes: data.notes };
  }
  if (type === 'feed') return { ...data, unit: data.unit || 'kg' };
  if (type === 'water') return { ...data, unit: data.unit || 'L' };
  return { ...data };
}

function inputFromCorrection(type, record, data) {
  const pick = (field) => (data[field] !== undefined ? data[field] : record[field]);
  if (type === 'weight') {
    const unit = data.unit || 'g';
    const base = { recordDate: pick('recordDate'), notes: pick('notes') };
    if (Array.isArray(data.weights)) {
      return { ...base, method: 'individual', weightsG: data.weights.map((w) => toGrams(w, unit)), enteredUnit: unit, enteredWeights: data.weights };
    }
    if (data.averageWeight !== undefined) {
      return { ...base, method: 'aggregate', sampleSize: data.sampleSize ?? record.sampleSize,
        averageWeightG: toGrams(data.averageWeight, unit), enteredUnit: unit, enteredAverageWeight: data.averageWeight };
    }
    if (data.sampleSize !== undefined) {
      const wasAggregate = record.method === 'aggregate';
      return { ...base, method: 'aggregate', sampleSize: data.sampleSize, averageWeightG: record.averageWeightG,
        enteredUnit: wasAggregate ? record.enteredUnit : null, enteredAverageWeight: wasAggregate ? record.enteredAverageWeight : null };
    }
    return record.method === 'individual'
      ? { ...base, method: 'individual', weightsG: record.sampleWeightsG, enteredUnit: record.enteredUnit, enteredWeights: record.enteredWeights }
      : { ...base, method: 'aggregate', sampleSize: record.sampleSize, averageWeightG: record.averageWeightG,
        enteredUnit: record.enteredUnit, enteredAverageWeight: record.enteredAverageWeight };
  }
  if (type === 'eggs') {
    return Object.fromEntries(['recordDate', 'collectionPeriod', 'goodEggs', 'secondGradeEggs', 'floorEggs', 'notes']
      .map((f) => [f, pick(f)]));
  }
  const quantityGiven = data.quantity !== undefined;
  return {
    recordDate: pick('recordDate'),
    ...(type === 'feed' ? { feedStage: pick('feedStage') } : {}),
    quantity: quantityGiven ? data.quantity : record.enteredQuantity,
    unit: quantityGiven ? (data.unit || (type === 'feed' ? 'kg' : 'L')) : record.enteredUnit,
    measurementMethod: pick('measurementMethod'),
    notes: pick('notes'),
  };
}

function checkDuplicate(type, flock, values, excludeId) {
  const clash = type === 'weight'
    ? (excludeId ? null : recordModel.findIdenticalWeight(flock.id, values))
    : recordModel.findClash(type, flock.id, values, excludeId);
  if (!clash && type === 'feed') {
    const conflict = recordModel.findFeedStageConflict(flock.id, values.recordDate, values.feedStage, excludeId);
    if (conflict) {
      throw new AppError(409, values.feedStage === 'unknown'
        ? `There is already a ${conflict.feedStage} feed record for ${values.recordDate} (record ${conflict.id}). A day has either ` +
          'one record with an unknown stage or records per named stage. Record the stage, or correct the existing record.'
        : `There is already a feed record with an unknown stage for ${values.recordDate} (record ${conflict.id}). Correct that ` +
          'record (for example to give its stage) instead of adding a second one, so the same feed is not counted twice.',
      [{ field: 'feedStage', message: `Existing record: ${conflict.id}.` }]);
    }
  }
  if (!clash) return;
  const what = {
    weight: 'An identical weight record already exists for this day',
    eggs: `There is already a ${values.collectionPeriod} egg collection record for ${values.recordDate}`,
    feed: `There is already a ${values.feedStage} feed record for ${values.recordDate}`,
    water: `There is already a drinking-water record for ${values.recordDate}`,
  }[type];
  throw new AppError(409, `${what} (record ${clash.id}). To change it, record a correction.`,
    [{ field: 'recordDate', message: `Existing record: ${clash.id}.` }]);
}

function populationCheck(type, record, flock, cache) {
  if (type !== 'weight' && type !== 'eggs') return {};
  const key = record.recordDate;
  if (!cache.has(key)) cache.set(key, populationOn(flock, key));
  const population = cache.get(key);
  const counted = type === 'weight' ? record.sampleSize : recordModel.eggsOnDay(flock.id, record.recordDate);
  const exceeds = counted > population;
  return {
    populationOnDate: population,
    exceedsPopulation: exceeds,
    warnings: exceeds ? [{
      code: 'exceeds_population',
      message: type === 'weight'
        ? `${record.sampleSize} birds weighed, but the flock's records now show ${population} birds on ${record.recordDate}. ` +
          'A later backdated movement may explain it. Check and correct this record or the movement.'
        : `The eggs of ${record.recordDate} (${counted}) are more than the ${population} birds the flock's records now show on ` +
          'that day. A later backdated movement may explain it. Check and correct the records or the movement.',
    }] : [],
  };
}

function present(type, record, flock, cache = new Map()) {
  const result = { ...record, ...(flock ? populationCheck(type, record, flock, cache) : {}) };
  if (type === 'weight' && flock) {
    const arrivalWeeks = flock.startingStage === 'day_old' ? 0 : (flock.ageAtArrivalWeeks ?? 0);
    result.ageWeeks = Math.floor((arrivalWeeks * 7 + daysBetween(flock.arrivalDate, record.recordDate)) / 7);
    result.averageWeightKg = round(record.averageWeightG / 1000, 3);
  }
  return result;
}
const withHistory = (type, record, flock) => ({ ...present(type, record, flock), corrections: recordModel.findCorrections(type, record.id) });

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

function createRecord(type, farm, flockId, data, userId) {
  return runInImmediateTransaction(() => {
    const flock = getFlockOrFail(farm, flockId);
    const values = BUILDERS[type](flock, inputFromRequest(type, data), 0);
    checkDuplicate(type, flock, values, 0);
    const record = recordModel.create(type, { farmId: farm.id, flockId: flock.id, createdBy: userId }, values);
    return withHistory(type, record, flock);
  });
}

function listRecords(type, farm, flockId, query) {
  const flock = getFlockOrFail(farm, flockId);
  const range = rangeOf(query);
  const cache = new Map();
  return { ...range, records: recordModel.list(type, { farmId: farm.id, flockId: flock.id, ...range }).map((r) => present(type, r, flock, cache)) };
}

function getRecord(type, farm, flockId, recordId) {
  const flock = getFlockOrFail(farm, flockId);
  const record = recordModel.findForFlock(type, farm.id, flock.id, recordId);
  if (!record) throw new AppError(404, `${RECORD_TYPES[type].label} not found.`);
  return withHistory(type, record, flock);
}

function correctRecord(type, farm, flockId, recordId, data, userId) {
  return runInImmediateTransaction(() => {
    const flock = getFlockOrFail(farm, flockId);
    const record = recordModel.findForFlock(type, farm.id, flock.id, recordId);
    if (!record) throw new AppError(404, `${RECORD_TYPES[type].label} not found.`);
    if (record.version !== data.expectedVersion) {
      throw new AppError(409, `This record was changed by someone else (it is now version ${record.version}, you sent ` +
        `${data.expectedVersion}). Reload it and correct it again.`, [{ field: 'expectedVersion', message: `Current version: ${record.version}.` }]);
    }
    const values = BUILDERS[type](flock, inputFromCorrection(type, record, data), record.id);
    checkDuplicate(type, flock, values, record.id);

    const changes = {};
    for (const field of Object.keys(recordModel.FIELDS[type])) {
      const from = record[field] ?? null;
      const to = values[field] ?? null;
      if (JSON.stringify(from) !== JSON.stringify(to)) changes[field] = { from, to };
    }
    if (Object.keys(changes).length === 0) invalid('reason', 'The correction does not change anything.');
    const corrected = recordModel.applyCorrection(type, record, { values, changes, reason: data.reason, correctedBy: userId });
    return withHistory(type, corrected, flock);
  });
}

function summary(type, farm, flockId, query) {
  const flock = getFlockOrFail(farm, flockId);
  const range = rangeOf(query);
  const records = recordModel.list(type, { farmId: farm.id, flockId: flock.id, ...range });
  const grouped = new Map();
  for (const r of records) {
    if (!grouped.has(r.recordDate)) grouped.set(r.recordDate, []);
    grouped.get(r.recordDate).push(r);
  }
  const byDate = new Map([...grouped].sort(([a], [b]) => a.localeCompare(b)));
  const base = { flockId: flock.id, ...range, note: ACTUAL_RECORDS_NOTE, daysWithRecords: byDate.size };

  if (type === 'eggs') {
    const days = [...byDate].map(([date, list]) => {
      const sum = (f) => list.reduce((a, r) => a + r[f], 0);
      const populationOnDate = populationOn(flock, date);
      return { date, periodsRecorded: list.map((r) => r.collectionPeriod), goodEggs: sum('goodEggs'),
        secondGradeEggs: sum('secondGradeEggs'), floorEggs: sum('floorEggs'), totalEggs: sum('totalEggs'),
        populationOnDate, exceedsPopulation: sum('totalEggs') > populationOnDate };
    });
    const total = (f) => days.reduce((a, d) => a + d[f], 0);
    const warnings = days.filter((d) => d.exceedsPopulation).map((d) => ({ code: 'exceeds_population', date: d.date,
      message: `${d.totalEggs} eggs on ${d.date}, more than the ${d.populationOnDate} birds the flock's records now show on that day.` }));
    return { ...base, categories: EGG_CATEGORIES, days, warnings,
      totals: { goodEggs: total('goodEggs'), secondGradeEggs: total('secondGradeEggs'), floorEggs: total('floorEggs'), totalEggs: total('totalEggs') } };
  }
  if (type === 'feed' || type === 'water') {
    const field = type === 'feed' ? 'quantityKg' : 'quantityLitres';
    const unit = type === 'feed' ? 'kg' : 'L';
    const days = [...byDate].map(([date, list]) => {
      const methods = new Set(list.map((r) => r.measurementMethod));
      const day = { date, total: round(list.reduce((a, r) => a + r[field], 0), 3), unit,
        measurement: methods.size === 1 ? [...methods][0] : 'mixed' };
      if (type === 'feed') {
        day.byStage = Object.fromEntries(list.map((r) => [r.feedStage, r.quantityKg]));
      }
      return day;
    });
    const total = round(days.reduce((a, d) => a + d.total, 0), 3);
    return { ...base, unit, days, total, averagePerRecordedDay: days.length ? round(total / days.length, 3) : null };
  }
  const cache = new Map();
  const sessions = records.slice().reverse().map((r) => present('weight', r, flock, cache));
  let previous = null;
  const history = sessions.map((s) => {
    const item = { id: s.id, date: s.recordDate, ageWeeks: s.ageWeeks, method: s.method, sampleSize: s.sampleSize,
      averageWeightG: s.averageWeightG, minWeightG: s.minWeightG, maxWeightG: s.maxWeightG,
      populationOnDate: s.populationOnDate, exceedsPopulation: s.exceedsPopulation,
      changeFromPreviousG: previous ? round(s.averageWeightG - previous.averageWeightG, 1) : null,
      daysSincePrevious: previous ? daysBetween(previous.recordDate, s.recordDate) : null };
    previous = s;
    return item;
  });
  return { ...base, unit: 'g', comparison: 'Each session is compared only with this flock\'s previous session.',
    sessions: history, latest: history.length ? history[history.length - 1] : null,
    warnings: sessions.flatMap((s) => s.warnings.map((w) => ({ ...w, date: s.recordDate, recordId: s.id }))) };
}

function listFarmRecords(farm, query) {
  const flockId = query.flockId ? Number(query.flockId) : undefined;
  if (flockId) getFlockOrFail(farm, flockId);
  const range = rangeOf(query);
  const flocks = new Map();
  const caches = new Map();
  const records = recordModel.list(query.type, { farmId: farm.id, flockId, ...range }).map((r) => {
    if (!flocks.has(r.flockId)) { flocks.set(r.flockId, flockModel.findById(r.flockId)); caches.set(r.flockId, new Map()); }
    return present(query.type, r, flocks.get(r.flockId), caches.get(r.flockId));
  });
  return { ...range, recordType: query.type, records };
}

module.exports = { createRecord, listRecords, getRecord, correctRecord, summary, listFarmRecords };
