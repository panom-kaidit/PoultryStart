// Handles database operations for expenses and their correction history.
const { getDb } = require('../config/database');
const { CATEGORIES } = require('../data/expenses');

const FIELDS = Object.freeze({
  expenseDate: 'expense_date',
  category: 'category',
  amount: 'amount',
  description: 'description',
  flockId: 'flock_id',
  voided: 'voided',
  voidReason: 'void_reason',
  voidedBy: 'voided_by',
  voidedAt: 'voided_at',
});

const toColumnValue = (field, value) => (field === 'voided' ? (value ? 1 : 0) : value);

function toExpense(row) {
  if (!row) return null;
  return {
    id: row.id,
    farmId: row.farm_id,
    flockId: row.flock_id,
    flockName: row.flock_name ?? null,
    expenseDate: row.expense_date,
    category: row.category,
    categoryLabel: CATEGORIES[row.category],
    amount: row.amount,
    currency: row.currency,
    description: row.description,
    voided: row.voided === 1,
    voidReason: row.void_reason,
    voidedBy: row.voided_by,
    voidedAt: row.voided_at,
    copiedFromExpenseRecordId: row.legacy_expense_id,
    version: row.version,
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT = `SELECT e.*, users.name AS created_by_name, flocks.name AS flock_name
                  FROM farm_expenses e
                  LEFT JOIN users ON users.id = e.created_by
                  LEFT JOIN flocks ON flocks.id = e.flock_id`;

function create({ farmId, currency, createdBy }, values) {
  const result = getDb()
    .prepare(`INSERT INTO farm_expenses (farm_id, flock_id, expense_date, category, amount, currency, description, created_by)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(farmId, values.flockId ?? null, values.expenseDate, values.category, values.amount, currency, values.description, createdBy);
  return findById(result.lastInsertRowid);
}

function findById(id) {
  return toExpense(getDb().prepare(`${SELECT} WHERE e.id = ?`).get(id));
}

function findForFarm(farmId, id) {
  return toExpense(getDb().prepare(`${SELECT} WHERE e.id = ? AND e.farm_id = ?`).get(id, farmId));
}

function list({ farmId, from, to, category, flockId, includeVoided = true }) {
  const where = ['e.farm_id = @farmId', 'e.expense_date >= @from', 'e.expense_date <= @to'];
  if (category) where.push('e.category = @category');
  if (flockId === 'none') where.push('e.flock_id IS NULL');
  else if (flockId) where.push('e.flock_id = @flockId');
  if (!includeVoided) where.push('e.voided = 0');
  return getDb()
    .prepare(`${SELECT} WHERE ${where.join(' AND ')} ORDER BY e.expense_date DESC, e.id DESC`)
    .all({ farmId, from, to, category, flockId: flockId === 'none' ? null : flockId })
    .map(toExpense);
}

function applyCorrection(expense, { values, changes, reason, correctedBy }) {
  const db = getDb();
  db.prepare(
    `INSERT INTO expense_corrections (farm_id, expense_id, version_from, version_to, changes, reason, corrected_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(expense.farmId, expense.id, expense.version, expense.version + 1, JSON.stringify(changes), reason, correctedBy);
  const fields = Object.keys(FIELDS).filter((f) => values[f] !== undefined);
  const set = fields.map((f) => `${FIELDS[f]} = ?, `).join('');
  db.prepare(`UPDATE farm_expenses SET ${set}version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND version = ?`)
    .run(...fields.map((f) => toColumnValue(f, values[f])), expense.id, expense.version);
  return findById(expense.id);
}

function findCorrections(expenseId) {
  return getDb()
    .prepare(
      `SELECT c.*, users.name AS corrected_by_name
         FROM expense_corrections c LEFT JOIN users ON users.id = c.corrected_by
        WHERE c.expense_id = ? ORDER BY c.version_to`
    )
    .all(expenseId)
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

function countActiveBetween(farmId, { flockId, category, from, to }) {
  const flockClause = flockId ? 'AND flock_id = @flockId' : '';
  const categoryClause = category ? 'AND category = @category' : '';
  return getDb()
    .prepare(`SELECT COUNT(*) AS n FROM farm_expenses
               WHERE farm_id = @farmId AND voided = 0 AND expense_date >= @from AND expense_date <= @to
               ${flockClause} ${categoryClause}`)
    .get({ farmId, flockId: flockId ?? null, category: category ?? null, from, to }).n;
}

function countForFlock(flockId) {
  return getDb().prepare('SELECT COUNT(*) AS n FROM farm_expenses WHERE flock_id = ?').get(flockId).n;
}

module.exports = {
  FIELDS, create, findById, findForFarm, list, applyCorrection, findCorrections, countActiveBetween, countForFlock,
};
