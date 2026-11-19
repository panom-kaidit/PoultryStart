// Handles database operations for production records and their correction history.
const { getDb } = require('../config/database');
const { RECORD_TYPES } = require('../data/productionRecords');

const FIELDS = Object.freeze({
  weight: {
    recordDate: 'record_date', method: 'method', sampleSize: 'sample_size', averageWeightG: 'average_weight_g',
    minWeightG: 'min_weight_g', maxWeightG: 'max_weight_g', sampleWeightsG: 'sample_weights_g',
    enteredUnit: 'entered_unit', enteredWeights: 'entered_weights', enteredAverageWeight: 'entered_average_weight',
    notes: 'notes',
  },
  eggs: {
    recordDate: 'record_date', collectionPeriod: 'collection_period', goodEggs: 'good_eggs',
    secondGradeEggs: 'second_grade_eggs', floorEggs: 'floor_eggs', notes: 'notes',
  },
  feed: {
    recordDate: 'record_date', feedStage: 'feed_stage', quantityKg: 'quantity_kg', enteredQuantity: 'entered_quantity',
    enteredUnit: 'entered_unit', measurementMethod: 'measurement_method', notes: 'notes',
  },
  water: {
    recordDate: 'record_date', quantityLitres: 'quantity_litres', enteredQuantity: 'entered_quantity',
    enteredUnit: 'entered_unit', measurementMethod: 'measurement_method', notes: 'notes',
  },
});
const JSON_FIELDS = new Set(['sampleWeightsG', 'enteredWeights']);

const tableOf = (type) => RECORD_TYPES[type].table;
const toColumnValue = (field, value) => (JSON_FIELDS.has(field) && value != null ? JSON.stringify(value) : value);

function toRecord(type, row) {
  if (!row) return null;
  const record = { id: row.id, recordType: type, farmId: row.farm_id, flockId: row.flock_id };
  for (const [field, column] of Object.entries(FIELDS[type])) {
    record[field] = JSON_FIELDS.has(field) && row[column] != null ? JSON.parse(row[column]) : row[column];
  }
  if (type === 'eggs') record.totalEggs = row.good_eggs + row.second_grade_eggs + row.floor_eggs;
  return {
    ...record,
    version: row.version,
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const select = (type) => `SELECT r.*, users.name AS created_by_name FROM ${tableOf(type)} r LEFT JOIN users ON users.id = r.created_by`;
const ORDER = {
  eggs: "r.record_date DESC, CASE r.collection_period WHEN 'morning' THEN 1 WHEN 'midday' THEN 2 WHEN 'evening' THEN 3 ELSE 4 END, r.id",
  default: 'r.record_date DESC, r.id DESC',
};

function create(type, { farmId, flockId, createdBy }, values) {
  const fields = Object.keys(FIELDS[type]).filter((f) => values[f] !== undefined);
  const columns = ['farm_id', 'flock_id', 'created_by', ...fields.map((f) => FIELDS[type][f])];
  const params = [farmId, flockId, createdBy, ...fields.map((f) => toColumnValue(f, values[f]))];
  const result = getDb()
    .prepare(`INSERT INTO ${tableOf(type)} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`)
    .run(...params);
  return findById(type, result.lastInsertRowid);
}

function findById(type, id) {
  return toRecord(type, getDb().prepare(`${select(type)} WHERE r.id = ?`).get(id));
}

function findForFlock(type, farmId, flockId, id) {
  return toRecord(type, getDb().prepare(`${select(type)} WHERE r.id = ? AND r.flock_id = ? AND r.farm_id = ?`).get(id, flockId, farmId));
}

function list(type, { farmId, flockId, from, to }) {
  const where = ['r.farm_id = @farmId', 'r.record_date >= @from', 'r.record_date <= @to'];
  if (flockId) where.push('r.flock_id = @flockId');
  return getDb()
    .prepare(`${select(type)} WHERE ${where.join(' AND ')} ORDER BY ${ORDER[type] || ORDER.default}`)
    .all({ farmId, flockId, from, to })
    .map((row) => toRecord(type, row));
}

const UNIQUE_FIELDS = { eggs: ['recordDate', 'collectionPeriod'], feed: ['recordDate', 'feedStage'], water: ['recordDate'] };
function findClash(type, flockId, values, excludeId = 0) {
  const fields = UNIQUE_FIELDS[type];
  if (!fields) return null;
  const where = fields.map((f) => `r.${FIELDS[type][f]} = ?`).join(' AND ');
  return toRecord(type, getDb()
    .prepare(`${select(type)} WHERE r.flock_id = ? AND ${where} AND r.id <> ?`)
    .get(flockId, ...fields.map((f) => values[f]), excludeId));
}

function findFeedStageConflict(flockId, date, stage, excludeId = 0) {
  return toRecord('feed', getDb()
    .prepare(`${select('feed')} WHERE r.flock_id = ? AND r.record_date = ? AND r.id <> ?
               AND (r.feed_stage = 'unknown') <> (? = 'unknown')`)
    .get(flockId, date, excludeId, stage));
}

function findEggRecordsBefore(flockId, date) {
  return getDb()
    .prepare(`${select('eggs')} WHERE r.flock_id = ? AND r.record_date < ? ORDER BY r.record_date, r.id`)
    .all(flockId, date)
    .map((row) => toRecord('eggs', row));
}

function findIdenticalWeight(flockId, values) {
  return toRecord('weight', getDb()
    .prepare(`${select('weight')} WHERE r.flock_id = ? AND r.record_date = ? AND r.method = ? AND r.sample_size = ?
               AND r.average_weight_g = ? AND r.sample_weights_g IS ?`)
    .get(flockId, values.recordDate, values.method, values.sampleSize, values.averageWeightG,
      toColumnValue('sampleWeightsG', values.sampleWeightsG) ?? null));
}

function eggsOnDay(flockId, date, excludeId = 0) {
  return getDb()
    .prepare(`SELECT COALESCE(SUM(good_eggs + second_grade_eggs + floor_eggs), 0) AS n
                FROM egg_collection_records WHERE flock_id = ? AND record_date = ? AND id <> ?`)
    .get(flockId, date, excludeId).n;
}

function applyCorrection(type, record, { values, changes, reason, correctedBy }) {
  const db = getDb();
  db.prepare(
    `INSERT INTO production_record_corrections
       (farm_id, flock_id, record_type, record_id, version_from, version_to, changes, reason, corrected_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(record.farmId, record.flockId, type, record.id, record.version, record.version + 1, JSON.stringify(changes), reason, correctedBy);
  const fields = Object.keys(FIELDS[type]).filter((f) => values[f] !== undefined);
  const set = fields.map((f) => `${FIELDS[type][f]} = ?`).join(', ');
  db.prepare(`UPDATE ${tableOf(type)} SET ${set}, version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND version = ?`)
    .run(...fields.map((f) => toColumnValue(f, values[f])), record.id, record.version);
  return findById(type, record.id);
}

function findCorrections(type, recordId) {
  return getDb()
    .prepare(
      `SELECT c.*, users.name AS corrected_by_name
         FROM production_record_corrections c LEFT JOIN users ON users.id = c.corrected_by
        WHERE c.record_type = ? AND c.record_id = ? ORDER BY c.version_to`
    )
    .all(type, recordId)
    .map((row) => ({
      id: row.id,
      versionFrom: row.version_from,
      versionTo: row.version_to,
      changes: JSON.parse(row.changes),
      reason: row.reason,
      correctedBy: row.corrected_by,
      correctedByName: row.corrected_by_name,
      correctedAt: row.created_at,
    }));
}

function countForFlockBetween(type, flockId, from, to) {
  return getDb()
    .prepare(`SELECT COUNT(*) AS n FROM ${tableOf(type)} WHERE flock_id = ? AND record_date >= ? AND record_date <= ?`)
    .get(flockId, from, to).n;
}

function latestForFlock(type, flockId) {
  return toRecord(type, getDb()
    .prepare(`${select(type)} WHERE r.flock_id = ? ORDER BY r.record_date DESC, r.id DESC LIMIT 1`)
    .get(flockId));
}

function countAllForFlock(flockId) {
  return Object.keys(RECORD_TYPES).reduce((sum, type) =>
    sum + getDb().prepare(`SELECT COUNT(*) AS n FROM ${tableOf(type)} WHERE flock_id = ?`).get(flockId).n, 0);
}

module.exports = {
  FIELDS, create, findById, findForFlock, list, findClash, findIdenticalWeight, findFeedStageConflict, findEggRecordsBefore,
  eggsOnDay, applyCorrection,
  findCorrections, countForFlockBetween, countAllForFlock, latestForFlock,
};
