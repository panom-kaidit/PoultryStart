// Handles database operations for health observations and their correction history.
const { getDb } = require('../config/database');

const FIELDS = Object.freeze({
  observationDate: 'observation_date',
  observation: 'observation',
  birdsAffected: 'birds_affected',
  actionTaken: 'action_taken',
  vetContacted: 'vet_contacted',
  extensionOfficerContacted: 'extension_officer_contacted',
});
const BOOLEAN_FIELDS = new Set(['vetContacted', 'extensionOfficerContacted']);

const toColumnValue = (field, value) => (BOOLEAN_FIELDS.has(field) && value != null ? (value ? 1 : 0) : value);

function toObservation(row) {
  if (!row) return null;
  const observation = { id: row.id, farmId: row.farm_id, flockId: row.flock_id };
  for (const [field, column] of Object.entries(FIELDS)) {
    observation[field] = BOOLEAN_FIELDS.has(field) ? row[column] === 1 : row[column];
  }
  return {
    ...observation,
    version: row.version,
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT = `SELECT o.*, users.name AS created_by_name
                  FROM health_observations o LEFT JOIN users ON users.id = o.created_by`;

function create({ farmId, flockId, createdBy }, values) {
  const fields = Object.keys(FIELDS).filter((f) => values[f] !== undefined);
  const columns = ['farm_id', 'flock_id', 'created_by', ...fields.map((f) => FIELDS[f])];
  const params = [farmId, flockId, createdBy, ...fields.map((f) => toColumnValue(f, values[f]))];
  const result = getDb()
    .prepare(`INSERT INTO health_observations (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`)
    .run(...params);
  return findById(result.lastInsertRowid);
}

function findById(id) {
  return toObservation(getDb().prepare(`${SELECT} WHERE o.id = ?`).get(id));
}

function findForFlock(farmId, flockId, id) {
  return toObservation(getDb().prepare(`${SELECT} WHERE o.id = ? AND o.flock_id = ? AND o.farm_id = ?`).get(id, flockId, farmId));
}

function list({ farmId, flockId, from, to }) {
  const where = ['o.farm_id = @farmId', 'o.observation_date >= @from', 'o.observation_date <= @to'];
  if (flockId) where.push('o.flock_id = @flockId');
  return getDb()
    .prepare(`${SELECT} WHERE ${where.join(' AND ')} ORDER BY o.observation_date DESC, o.id DESC`)
    .all({ farmId, flockId, from, to })
    .map(toObservation);
}

function applyCorrection(observation, { values, changes, reason, correctedBy }) {
  const db = getDb();
  db.prepare(
    `INSERT INTO health_observation_corrections
       (farm_id, flock_id, observation_id, version_from, version_to, changes, reason, corrected_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(observation.farmId, observation.flockId, observation.id, observation.version, observation.version + 1,
    JSON.stringify(changes), reason, correctedBy);
  const fields = Object.keys(FIELDS).filter((f) => values[f] !== undefined);
  const set = fields.map((f) => `${FIELDS[f]} = ?, `).join('');
  db.prepare(`UPDATE health_observations SET ${set}version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND version = ?`)
    .run(...fields.map((f) => toColumnValue(f, values[f])), observation.id, observation.version);
  return findById(observation.id);
}

function findCorrections(observationId) {
  return getDb()
    .prepare(
      `SELECT c.*, users.name AS corrected_by_name
         FROM health_observation_corrections c LEFT JOIN users ON users.id = c.corrected_by
        WHERE c.observation_id = ? ORDER BY c.version_to`
    )
    .all(observationId)
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

function countForFlockBetween(flockId, from, to) {
  return getDb()
    .prepare('SELECT COUNT(*) AS n FROM health_observations WHERE flock_id = ? AND observation_date >= ? AND observation_date <= ?')
    .get(flockId, from, to).n;
}

function countForFlock(flockId) {
  return getDb().prepare('SELECT COUNT(*) AS n FROM health_observations WHERE flock_id = ?').get(flockId).n;
}

function countsByFlockBetween(farmId, from, to) {
  return getDb()
    .prepare(
      `SELECT flock_id, COUNT(*) AS observations,
              SUM(CASE WHEN vet_contacted = 0 AND extension_officer_contacted = 0 THEN 1 ELSE 0 END) AS without_contact
         FROM health_observations
        WHERE farm_id = ? AND observation_date >= ? AND observation_date <= ?
        GROUP BY flock_id`
    )
    .all(farmId, from, to)
    .map((row) => ({ flockId: row.flock_id, observations: row.observations, withoutContact: row.without_contact }));
}

module.exports = {
  FIELDS, create, findById, findForFlock, list, applyCorrection, findCorrections, countForFlockBetween, countForFlock,
  countsByFlockBetween,
};
