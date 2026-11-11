// Database operations for the "farms" table.
const { getDb } = require('../config/database');

// Fields that can be written to when creating or updating a farm
const WRITABLE_FIELDS = {
  name: 'name',
  location: 'location',
  poultryType: 'poultry_type',
  numberOfBirds: 'number_of_birds',
  experienceLevel: 'experience_level',
  farmSize: 'farm_size',
  managementMode: 'management_mode',
  currency: 'currency',
  startingStage: 'starting_stage',
  startingAgeWeeks: 'starting_age_weeks',
  houseStatus: 'house_status',
  houseLengthM: 'house_length_m',
  houseWidthM: 'house_width_m',
  nonUsableAreaM2: 'non_usable_area_m2',
};

function toFarm(row) {
  if (!row) return null;
  const farm = {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    location: row.location,
    poultryType: row.poultry_type,
    numberOfBirds: row.number_of_birds,
    experienceLevel: row.experience_level,
    farmSize: row.farm_size,
    managementMode: row.management_mode,
    currency: row.currency,
    // Poultry house measurements
    startingStage: row.starting_stage || 'day_old', 
    startingAgeWeeks: row.starting_age_weeks, 
    houseStatus: row.house_status, 
    houseLengthM: row.house_length_m,
    houseWidthM: row.house_width_m,
    nonUsableAreaM2: row.non_usable_area_m2,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  // Present when the query joined the user's membership (see findAllForUser)
  if (row.my_role) farm.myRole = row.my_role;
  return farm;
}

function create(ownerId, data) {
  const fields = Object.keys(WRITABLE_FIELDS).filter((key) => data[key] !== undefined);
  const columns = ['owner_id', ...fields.map((key) => WRITABLE_FIELDS[key])];
  const placeholders = columns.map(() => '?').join(', ');
  const values = [ownerId, ...fields.map((key) => data[key])];

  const result = getDb()
    .prepare(`INSERT INTO farms (${columns.join(', ')}) VALUES (${placeholders})`)
    .run(...values);
  return findById(result.lastInsertRowid);
}

function findById(id) {
  return toFarm(getDb().prepare('SELECT * FROM farms WHERE id = ?').get(id));
}

// All farms a user can access (as owner, manager or worker), with their role.
function findAllForUser(userId) {
  const rows = getDb()
    .prepare(
      `SELECT farms.*, farm_memberships.role AS my_role
         FROM farms
         JOIN farm_memberships ON farm_memberships.farm_id = farms.id
        WHERE farm_memberships.user_id = ?
        ORDER BY farms.created_at DESC, farms.id DESC`
    )
    .all(userId);
  return rows.map(toFarm);
}

function update(id, data) {
  const fields = Object.keys(WRITABLE_FIELDS).filter((key) => data[key] !== undefined);
  if (fields.length === 0) return findById(id);

  // Build the SET clause for the UPDATE statement
  const setClause = fields.map((key) => `${WRITABLE_FIELDS[key]} = ?`).join(', ');
  const values = fields.map((key) => data[key]);

  getDb()
    .prepare(`UPDATE farms SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .run(...values, id);
  return findById(id);
}

// Remove a farm by its ID. 
function remove(id) {
  getDb().prepare('DELETE FROM farms WHERE id = ?').run(id);
}

module.exports = { create, findById, findAllForUser, update, remove };
