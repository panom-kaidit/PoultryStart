// Database operations for the "farm_memberships" table: which users can
// access which farm, and in which role (owner / manager / worker).
const { getDb } = require('../config/database');

function toMembership(row) {
  if (!row) return null;
  return {
    id: row.id,
    farmId: row.farm_id,
    userId: row.user_id,
    role: row.role,
    addedBy: row.added_by,
    createdAt: row.created_at,
  };
}

// A member as shown in the farm's member list: membership + user details.
function toMember(row) {
  if (!row) return null;
  return {
    id: row.id, // membership ID, used in /members/:memberId
    userId: row.user_id,
    name: row.name,
    email: row.email,
    role: row.role,
    addedBy: row.added_by,
    joinedAt: row.created_at,
  };
}

const MEMBER_SELECT = `
  SELECT farm_memberships.*, users.name, users.email
    FROM farm_memberships
    JOIN users ON users.id = farm_memberships.user_id`;

function create({ farmId, userId, role, addedBy }) {
  const result = getDb()
    .prepare('INSERT INTO farm_memberships (farm_id, user_id, role, added_by) VALUES (?, ?, ?, ?)')
    .run(farmId, userId, role, addedBy);
  return findById(result.lastInsertRowid);
}

function findById(id) {
  return toMembership(getDb().prepare('SELECT * FROM farm_memberships WHERE id = ?').get(id));
}

// The membership of one user on one farm, or null if they have no access.
function findByFarmAndUser(farmId, userId) {
  const row = getDb()
    .prepare('SELECT * FROM farm_memberships WHERE farm_id = ? AND user_id = ?')
    .get(farmId, userId);
  return toMembership(row);
}

// One member of a farm. Checking farm_id stops a member ID from another
// farm being used here.
function findMember(farmId, membershipId) {
  const row = getDb()
    .prepare(`${MEMBER_SELECT} WHERE farm_memberships.farm_id = ? AND farm_memberships.id = ?`)
    .get(farmId, membershipId);
  return toMember(row);
}

// All members of a farm: owner first, then managers, then workers.
function findMembersOfFarm(farmId) {
  const rows = getDb()
    .prepare(
      `${MEMBER_SELECT}
        WHERE farm_memberships.farm_id = ?
        ORDER BY CASE farm_memberships.role WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 ELSE 2 END,
                 users.name`
    )
    .all(farmId);
  return rows.map(toMember);
}

function updateRole(membershipId, role) {
  getDb()
    .prepare('UPDATE farm_memberships SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(role, membershipId);
}

function remove(membershipId) {
  getDb().prepare('DELETE FROM farm_memberships WHERE id = ?').run(membershipId);
}

module.exports = {
  create,
  findById,
  findByFarmAndUser,
  findMember,
  findMembersOfFarm,
  updateRole,
  remove,
};
