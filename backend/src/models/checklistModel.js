// Database operations for the "resource_checklist_items" table (FR-05).
const { getDb } = require('../config/database');

// API field name -> database column. Only these can be changed by updateItem.
const UPDATABLE_FIELDS = {
  itemName: 'item_name',
  category: 'category',
  isRequired: 'is_required',
  isAvailable: 'is_available',
  neededBy: 'needed_by',
  notes: 'notes',
};

const toDbValue = (value) => (typeof value === 'boolean' ? (value ? 1 : 0) : value);

function toItem(row) {
  if (!row) return null;
  return {
    id: row.id,
    farmId: row.farm_id,
    assessmentId: row.assessment_id,
    itemName: row.item_name,
    category: row.category,
    isRequired: row.is_required === 1,
    isAvailable: row.is_available === 1,
    isCustom: row.is_custom === 1,
    neededBy: row.needed_by,
    notes: row.notes,
    updatedAt: row.updated_at,
  };
}

function createItem({ farmId, assessmentId, itemName, category, isRequired, isAvailable, isCustom, neededBy, notes }) {
  const result = getDb()
    .prepare(
      `INSERT INTO resource_checklist_items
         (farm_id, assessment_id, item_name, category, is_required, is_available, is_custom, needed_by, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(farmId, assessmentId, itemName, category,
      toDbValue(isRequired), toDbValue(isAvailable), toDbValue(isCustom), neededBy || 'chick_arrival', notes ?? null);
  return findItemById(result.lastInsertRowid);
}

function findItemById(id) {
  return toItem(getDb().prepare('SELECT * FROM resource_checklist_items WHERE id = ?').get(id));
}

// One item, only if it belongs to this farm AND this assessment.
function findItem(farmId, assessmentId, itemId) {
  const row = getDb()
    .prepare('SELECT * FROM resource_checklist_items WHERE id = ? AND farm_id = ? AND assessment_id = ?')
    .get(itemId, farmId, assessmentId);
  return toItem(row);
}

const CATEGORY_ORDER = `CASE category WHEN 'housing' THEN 1 WHEN 'equipment' THEN 2
  WHEN 'feed' THEN 3 WHEN 'water' THEN 4 ELSE 5 END`;

function findItemsForAssessment(assessmentId) {
  const rows = getDb()
    .prepare(
      `SELECT * FROM resource_checklist_items
        WHERE assessment_id = ?
        ORDER BY ${CATEGORY_ORDER}, is_custom, id`
    )
    .all(assessmentId);
  return rows.map(toItem);
}

function updateItem(itemId, data) {
  const fields = Object.keys(UPDATABLE_FIELDS).filter((key) => data[key] !== undefined);
  if (fields.length === 0) return findItemById(itemId);

  // Column names come from UPDATABLE_FIELDS, never from the request.
  const setClause = fields.map((key) => `${UPDATABLE_FIELDS[key]} = ?`).join(', ');
  const values = fields.map((key) => toDbValue(data[key]));
  getDb()
    .prepare(`UPDATE resource_checklist_items SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .run(...values, itemId);
  return findItemById(itemId);
}

module.exports = { createItem, findItem, findItemsForAssessment, updateItem };
