// Database operations for the "flocks" table.

const { getDb } = require('../config/database');
const flockMovementModel = require('./flockMovementModel');

// Fields set when the flock is created.
const CREATE_FIELDS = {
  name: 'name',
  poultryType: 'poultry_type',
  startDate: 'start_date',
  initialBirdCount: 'initial_bird_count',
  startingStage: 'starting_stage',
  ageAtArrivalWeeks: 'age_at_arrival_weeks',
  breedStrain: 'breed_strain',
  supplier: 'supplier',
  malesReceived: 'males_received',
  femalesReceived: 'females_received',
  vaccinationNotes: 'vaccination_notes',
  notes: 'notes',
  capacityStatus: 'capacity_status',
  recommendedCapacity: 'recommended_capacity',
  densityMode: 'density_mode',
};
// fields that can be change later
const UPDATE_FIELDS = {
  name: 'name',
  startDate: 'start_date',
  startingStage: 'starting_stage',
  ageAtArrivalWeeks: 'age_at_arrival_weeks',
  breedStrain: 'breed_strain',
  supplier: 'supplier',
  malesReceived: 'males_received',
  femalesReceived: 'females_received',
  vaccinationNotes: 'vaccination_notes',
  notes: 'notes',
  capacityStatus: 'capacity_status',
  recommendedCapacity: 'recommended_capacity',
  densityMode: 'density_mode',
  status: 'status',
  closedAt: 'closed_at',
  closureReason: 'closure_reason',
  closureNotes: 'closure_notes',
  firstEggDate: 'first_egg_date',
  expectedSaleDate: 'expected_sale_date',
};

// Every flock is read together with its live bird count.
const SELECT_FLOCK = `
  SELECT flocks.*,
         (SELECT COALESCE(SUM(m.bird_change), 0) FROM flock_bird_movements m WHERE m.flock_id = flocks.id) AS live_birds
    FROM flocks`;

function toFlock(row) {
  if (!row) return null;
  return {
    id: row.id,
    farmId: row.farm_id,
    name: row.name,
    poultryType: row.poultry_type,
    status: row.status, 
    arrivalDate: row.start_date,
    birdsReceived: row.initial_bird_count, 
    liveBirds: row.live_birds,
    startingStage: row.starting_stage || 'day_old',
    ageAtArrivalWeeks: row.age_at_arrival_weeks,
    breedStrain: row.breed_strain,
    supplier: row.supplier,
    malesReceived: row.males_received,
    femalesReceived: row.females_received,
    vaccinationNotes: row.vaccination_notes,
    notes: row.notes,
    capacityAtArrival: {
      status: row.capacity_status,
      recommendedCapacity: row.recommended_capacity,
      densityMode: row.density_mode,
    },
    closedAt: row.closed_at,
    closureReason: row.closure_reason,
    closureNotes: row.closure_notes,
    firstEggDate: row.first_egg_date,
    expectedSaleDate: row.expected_sale_date,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Creates the flock AND its 'received' movement together
function create(farmId, data, createdBy = null) {
  const db = getDb();
  return db.transaction(() => {
    const fields = Object.keys(CREATE_FIELDS).filter((key) => data[key] !== undefined);
    const columns = ['farm_id', 'created_by', ...fields.map((key) => CREATE_FIELDS[key])];
    const values = [farmId, createdBy, ...fields.map((key) => data[key])];
    const result = db
      .prepare(`INSERT INTO flocks (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`)
      .run(...values);

    flockMovementModel.create({
      farmId,
      flockId: result.lastInsertRowid,
      movementType: 'received',
      birdChange: data.initialBirdCount,
      movementDate: data.startDate,
      recordedBy: createdBy,
    });
    return findById(result.lastInsertRowid);
  })();
}

function findById(id) {
  return toFlock(getDb().prepare(`${SELECT_FLOCK} WHERE flocks.id = ?`).get(id));
}

// Only finds the flock if it belongs to this farm 
function findByIdForFarm(farmId, id) {
  return toFlock(getDb().prepare(`${SELECT_FLOCK} WHERE flocks.id = ? AND flocks.farm_id = ?`).get(id, farmId));
}

// Newest arrival first
function findAllForFarm(farmId, { status } = {}) {
  const where = status ? 'WHERE flocks.farm_id = ? AND flocks.status = ?' : 'WHERE flocks.farm_id = ?';
  const params = status ? [farmId, status] : [farmId];
  return getDb()
    .prepare(`${SELECT_FLOCK} ${where} ORDER BY flocks.start_date DESC, flocks.id DESC`)
    .all(...params)
    .map(toFlock);
}

function update(id, data) {
  const fields = Object.keys(UPDATE_FIELDS).filter((key) => data[key] !== undefined);
  if (fields.length === 0) return findById(id);
  const setClause = fields.map((key) => `${UPDATE_FIELDS[key]} = ?`).join(', ');
  getDb()
    .prepare(`UPDATE flocks SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .run(...fields.map((key) => data[key]), id);
  return findById(id);
}

// Removes the flock 
function remove(id) {
  getDb().prepare('DELETE FROM flocks WHERE id = ?').run(id);
}

// ---- Arrival corrections (audit trail, table flock_arrival_corrections) ----

function logArrivalCorrection(flockId, changes, reason, correctedBy) {
  getDb()
    .prepare('INSERT INTO flock_arrival_corrections (flock_id, changes, reason, corrected_by) VALUES (?, ?, ?, ?)')
    .run(flockId, JSON.stringify(changes), reason, correctedBy);
}

// Oldest first, with the name (only) of the user who made each correction.
function findArrivalCorrections(flockId) {
  return getDb()
    .prepare(
      `SELECT c.*, users.name AS corrected_by_name
         FROM flock_arrival_corrections c
         LEFT JOIN users ON users.id = c.corrected_by
        WHERE c.flock_id = ?
        ORDER BY c.id`
    )
    .all(flockId)
    .map((row) => ({
      id: row.id,
      changes: JSON.parse(row.changes),
      reason: row.reason,
      correctedBy: row.corrected_by,
      correctedByName: row.corrected_by_name,
      correctedAt: row.created_at, // UTC
    }));
}

// ---- Milestone history (table flock_milestone_changes) ------------------

const MILESTONES = Object.freeze(['first_egg_date', 'expected_sale_date']);

function logMilestoneChange(flockId, { milestone, fromValue = null, toValue, reason = null, changedBy = null }) {
  getDb()
    .prepare(
      `INSERT INTO flock_milestone_changes (flock_id, milestone, from_value, to_value, reason, changed_by)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(flockId, milestone, fromValue, toValue, reason, changedBy);
}

// Oldest first, with the name (only) of the user who made each change.
function findMilestoneChanges(flockId) {
  return getDb()
    .prepare(
      `SELECT c.*, users.name AS changed_by_name
         FROM flock_milestone_changes c LEFT JOIN users ON users.id = c.changed_by
        WHERE c.flock_id = ? ORDER BY c.id`
    )
    .all(flockId)
    .map((row) => ({
      id: row.id,
      milestone: row.milestone,
      fromValue: row.from_value,
      toValue: row.to_value,
      reason: row.reason,
      changedBy: row.changed_by,
      changedByName: row.changed_by_name,
      changedAt: row.created_at, // UTC
    }));
}

function milestoneVersion(flockId, milestone) {
  return getDb()
    .prepare('SELECT COUNT(*) AS n FROM flock_milestone_changes WHERE flock_id = ? AND milestone = ?')
    .get(flockId, milestone).n;
}

module.exports = {
  create, findById, findByIdForFarm, findAllForFarm, update, remove, logArrivalCorrection, findArrivalCorrections,
  MILESTONES, logMilestoneChange, findMilestoneChanges, milestoneVersion,
};
