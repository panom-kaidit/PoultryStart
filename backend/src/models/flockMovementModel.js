// Database operations for the "flock_bird_movements" table
const { getDb } = require('../config/database');

const MOVEMENT_TYPES = Object.freeze([
  'received', 
  'additional_received', 
  'mortality',
  'culled',
  'sold',
  'transferred_out',
  'correction', 
]);

function toMovement(row) {
  if (!row) return null;
  return {
    id: row.id,
    farmId: row.farm_id,
    flockId: row.flock_id,
    movementType: row.movement_type,
    birdChange: row.bird_change, 
    birdsAffected: Math.abs(row.bird_change),
    movementDate: row.movement_date, 
    reason: row.reason,
    notes: row.notes,
    correctsMovementId: row.corrects_movement_id,
    replacesMovementId: row.replaces_movement_id,
    correctionAmount: row.correction_amount,
    birdsAgeWeeks: row.birds_age_weeks,
    recordedBy: row.recorded_by,
    ...(row.recorded_by_name !== undefined ? { recordedByName: row.recorded_by_name } : {}),
    recordedAt: row.created_at, // when it was recorded
  };
}

// data
function create(data) {
  const result = getDb()
    .prepare(
      `INSERT INTO flock_bird_movements
         (farm_id, flock_id, movement_type, bird_change, movement_date, reason, notes, corrects_movement_id,
          replaces_movement_id, correction_amount, birds_age_weeks, recorded_by)
       VALUES (@farmId, @flockId, @movementType, @birdChange, @movementDate, @reason, @notes, @correctsMovementId,
          @replacesMovementId, @correctionAmount, @birdsAgeWeeks, @recordedBy)`
    )
    .run({
      reason: null,
      notes: null,
      correctsMovementId: null,
      replacesMovementId: null,
      correctionAmount: null,
      birdsAgeWeeks: null,
      recordedBy: null,
      ...data,
    });
  return findById(result.lastInsertRowid);
}

function findById(id) {
  return toMovement(getDb().prepare('SELECT * FROM flock_bird_movements WHERE id = ?').get(id));
}

// Only finds the movement if it belongs to this flock.
function findByIdForFlock(flockId, id) {
  return toMovement(
    getDb().prepare('SELECT * FROM flock_bird_movements WHERE id = ? AND flock_id = ?').get(id, flockId)
  );
}

// Oldest first, in the order the changes took effect, with the name of the
// user who recorded each one.
function findAllForFlock(flockId) {
  return getDb()
    .prepare(
      `SELECT m.*, users.name AS recorded_by_name
         FROM flock_bird_movements m
         LEFT JOIN users ON users.id = m.recorded_by
        WHERE m.flock_id = ?
        ORDER BY m.movement_date, m.id`
    )
    .all(flockId)
    .map(toMovement);
}

// The EFFECTIVE correction of a movement
function findEffectiveCorrectionOf(movementId) {
  return toMovement(
    getDb().prepare(
      `SELECT * FROM flock_bird_movements c
        WHERE c.corrects_movement_id = ? AND c.movement_type = 'correction'
          AND NOT EXISTS (SELECT 1 FROM flock_bird_movements r WHERE r.replaces_movement_id = c.id)`
    ).get(movementId)
  );
}

function countForFlock(flockId) {
  return getDb().prepare('SELECT COUNT(*) AS n FROM flock_bird_movements WHERE flock_id = ?').get(flockId).n;
}

// Arrival correction only 
function updateReceivedDate(flockId, movementDate) {
  getDb()
    .prepare("UPDATE flock_bird_movements SET movement_date = ? WHERE flock_id = ? AND movement_type = 'received'")
    .run(movementDate, flockId);
}

// Live birds = the sum of all signed changes.
function liveBirdCount(flockId) {
  return getDb()
    .prepare('SELECT COALESCE(SUM(bird_change), 0) AS live FROM flock_bird_movements WHERE flock_id = ?')
    .get(flockId).live;
}

// Birds per movement type, as positive numbers for in/out types and as a signed net value for corrections
function totalsByType(flockId) {
  const totals = Object.fromEntries(MOVEMENT_TYPES.map((type) => [type, 0]));
  getDb()
    .prepare(
      `SELECT movement_type, SUM(bird_change) AS total
         FROM flock_bird_movements WHERE flock_id = ? GROUP BY movement_type`
    )
    .all(flockId)
    .forEach((row) => {
      totals[row.movement_type] = row.movement_type === 'correction' ? row.total : Math.abs(row.total);
    });
  return totals;
}

module.exports = {
  MOVEMENT_TYPES,
  create,
  findById,
  findByIdForFlock,
  findAllForFlock,
  findEffectiveCorrectionOf,
  countForFlock,
  updateReceivedDate,
  liveBirdCount,
  totalsByType,
};
