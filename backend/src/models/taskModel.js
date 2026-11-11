
const { getDb } = require('../config/database');

// Fields a new task can be given (API name -> column).
const CREATE_FIELDS = {
  farmId: 'farm_id',
  flockId: 'flock_id',
  title: 'title',
  description: 'description',
  dueDate: 'due_date',
  assignedTo: 'assigned_to',
  createdBy: 'created_by',
  source: 'source',
  templateCode: 'template_code',
  frequency: 'frequency',
  timeSlot: 'time_slot',
  occurrence: 'occurrence',
  generationKey: 'generation_key',
};

// Fields that can be edited on a pending task.
const UPDATE_FIELDS = {
  flockId: 'flock_id', 
  title: 'title',
  description: 'description',
  dueDate: 'due_date',
  assignedTo: 'assigned_to',
  timeSlot: 'time_slot',
};

function toTask(row) {
  if (!row) return null;
  return {
    id: row.id,
    farmId: row.farm_id,
    flockId: row.flock_id,
    title: row.title,
    description: row.description,
    dueDate: row.due_date, 
    status: row.status,
    assignedTo: row.assigned_to,
    createdBy: row.created_by,
    source: row.source,
    templateCode: row.template_code,
    frequency: row.frequency,
    timeSlot: row.time_slot,
    occurrence: row.occurrence,
    generationKey: row.generation_key,
    completedBy: row.completed_by,
    completedAt: row.completed_at, // UTC
    completionNotes: row.completion_notes,
    problemReported: row.problem_reported === 1,
    cancelledAt: row.cancelled_at, // UTC
    cancelledBy: row.cancelled_by,
    cancelReason: row.cancel_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toEvent(row) {
  return {
    id: row.id,
    taskId: row.task_id,
    eventType: row.event_type,
    note: row.note,
    previousCompletion: row.event_type === 'reopened'
      ? {
        completedBy: row.previous_completed_by,
        completedAt: row.previous_completed_at,
        completionNotes: row.previous_completion_notes,
        problemReported: row.previous_problem_reported === 1,
      }
      : null,
    userId: row.user_id,
    userName: row.user_name, 
    createdAt: row.created_at, 
  };
}

const insertSql = (fields, conflictClause = '') => {
  const columns = fields.map((key) => CREATE_FIELDS[key]);
  return `INSERT INTO daily_tasks (${columns.join(', ')}) VALUES (${fields.map((key) => `@${key}`).join(', ')}) ${conflictClause}`;
};

// A custom task (or any task without a generation key).
function create(data) {
  const fields = Object.keys(CREATE_FIELDS).filter((key) => data[key] !== undefined);
  const result = getDb().prepare(insertSql(fields)).run(data);
  return findById(result.lastInsertRowid);
}


function createGenerated(input) {
  const data = { ...input, source: 'generated' };
  const fields = Object.keys(CREATE_FIELDS).filter((key) => data[key] !== undefined);
  const sql = insertSql(fields,
    'ON CONFLICT (farm_id, generation_key) WHERE generation_key IS NOT NULL DO NOTHING');
  const result = getDb().prepare(sql).run(data);
  if (result.changes === 1) return { created: true, task: findById(result.lastInsertRowid) };
  return { created: false, task: findByGenerationKey(data.farmId, data.generationKey) };
}

function findById(id) {
  return toTask(getDb().prepare('SELECT * FROM daily_tasks WHERE id = ?').get(id));
}

// Only finds the task if it belongs to this farm.
function findByIdForFarm(farmId, id) {
  return toTask(getDb().prepare('SELECT * FROM daily_tasks WHERE id = ? AND farm_id = ?').get(id, farmId));
}

function findByGenerationKey(farmId, generationKey) {
  return toTask(getDb().prepare('SELECT * FROM daily_tasks WHERE farm_id = ? AND generation_key = ?').get(farmId, generationKey));
}

// Order of the day's time slots when listing.
const SLOT_ORDER = "CASE time_slot WHEN 'morning' THEN 1 WHEN 'midday' THEN 2 WHEN 'evening' THEN 3 ELSE 4 END";

function findForFarm(farmId, { from, to, flockId, status, assignedTo, visibleToUserId } = {}) {
  const where = ['farm_id = @farmId'];
  if (from) where.push('due_date >= @from');
  if (to) where.push('due_date <= @to');
  if (flockId) where.push('flock_id = @flockId');
  if (status === 'pending') where.push("status = 'pending' AND cancelled_at IS NULL");
  if (status === 'completed') where.push("status = 'completed'");
  if (status === 'cancelled') where.push('cancelled_at IS NOT NULL');
  if (assignedTo === 'unassigned') where.push('assigned_to IS NULL');
  else if (assignedTo) where.push('assigned_to = @assignedTo');
  if (visibleToUserId) where.push('(assigned_to = @visibleToUserId OR assigned_to IS NULL)');
  return getDb()
    .prepare(`SELECT * FROM daily_tasks WHERE ${where.join(' AND ')} ORDER BY due_date, ${SLOT_ORDER}, id`)
    .all({ farmId, from, to, flockId, assignedTo, visibleToUserId })
    .map(toTask);
}

// Edits a PENDING, not cancelled task.
function update(id, data) {
  const fields = Object.keys(UPDATE_FIELDS).filter((key) => data[key] !== undefined);
  if (fields.length > 0) {
    const set = fields.map((key) => `${UPDATE_FIELDS[key]} = @${key}`).join(', ');
    const result = getDb()
      .prepare(`UPDATE daily_tasks SET ${set}, updated_at = CURRENT_TIMESTAMP
                 WHERE id = @id AND status = 'pending' AND cancelled_at IS NULL`)
      .run({ ...data, id });
    if (result.changes === 0) return null;
  }
  return findById(id);
}

// Marks a pending, not cancelled task as completed.
function markCompleted(id, { userId, notes = null, problemReported = false }) {
  const result = getDb()
    .prepare(
      `UPDATE daily_tasks
          SET status = 'completed', completed_by = ?, completed_at = CURRENT_TIMESTAMP,
              completion_notes = ?, problem_reported = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'pending' AND cancelled_at IS NULL`
    )
    .run(userId, notes, problemReported ? 1 : 0, id);
  return result.changes === 1;
}

// Cancels a pending task 
function cancel(id, { userId, reason }) {
  const result = getDb()
    .prepare(
      `UPDATE daily_tasks
          SET cancelled_at = CURRENT_TIMESTAMP, cancelled_by = ?, cancel_reason = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'pending' AND cancelled_at IS NULL`
    )
    .run(userId, reason, id);
  return result.changes === 1;
}

// Flock closed
function cancelPendingForFlockFrom(flockId, fromDate, { userId, reason }) {
  return getDb()
    .prepare(
      `UPDATE daily_tasks
          SET cancelled_at = CURRENT_TIMESTAMP, cancelled_by = ?, cancel_reason = ?, updated_at = CURRENT_TIMESTAMP
        WHERE flock_id = ? AND status = 'pending' AND cancelled_at IS NULL AND due_date >= ?`
    )
    .run(userId, reason, flockId, fromDate).changes;
}

// Milestone changed 
function cancelPendingGenerated(flockId, templateCodes, fromDate, { userId, reason }) {
  if (templateCodes.length === 0) return 0;
  const placeholders = templateCodes.map(() => '?').join(', ');
  return getDb()
    .prepare(
      `UPDATE daily_tasks
          SET cancelled_at = CURRENT_TIMESTAMP, cancelled_by = ?, cancel_reason = ?, updated_at = CURRENT_TIMESTAMP
        WHERE flock_id = ? AND source = 'generated' AND template_code IN (${placeholders})
          AND status = 'pending' AND cancelled_at IS NULL AND due_date >= ?`
    )
    .run(userId, reason, flockId, ...templateCodes, fromDate).changes;
}

// Reopens a completed task
function reopen(id, { userId, reason }) {
  const db = getDb();
  return db.transaction(() => {
    const task = findById(id);
    if (!task || task.status !== 'completed') return false;
    db.prepare(
      `INSERT INTO task_events (task_id, event_type, note, previous_completed_by, previous_completed_at,
                                previous_completion_notes, previous_problem_reported, user_id)
       VALUES (?, 'reopened', ?, ?, ?, ?, ?, ?)`
    ).run(id, reason, task.completedBy, task.completedAt, task.completionNotes, task.problemReported ? 1 : 0, userId);
    db.prepare(
      `UPDATE daily_tasks
          SET status = 'pending', completed_by = NULL, completed_at = NULL, completion_notes = NULL,
              problem_reported = 0, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`
    ).run(id);
    return true;
  })();
}

// An owner/manager review note 
function addReviewNote(id, { userId, note }) {
  getDb()
    .prepare("INSERT INTO task_events (task_id, event_type, note, user_id) VALUES (?, 'review_note', ?, ?)")
    .run(id, note, userId);
}

// The audit history of a task, oldest first, with the user's name only.
function findEvents(taskId) {
  return getDb()
    .prepare(
      `SELECT e.*, users.name AS user_name
         FROM task_events e LEFT JOIN users ON users.id = e.user_id
        WHERE e.task_id = ? ORDER BY e.id`
    )
    .all(taskId)
    .map(toEvent);
}

// History = completed, or has audit events. Such tasks are never deleted.
function hasHistory(taskId) {
  return getDb()
    .prepare(
      `SELECT 1 FROM daily_tasks t
        WHERE t.id = ? AND (t.status = 'completed' OR EXISTS (SELECT 1 FROM task_events e WHERE e.task_id = t.id))`
    )
    .get(taskId) !== undefined;
}

// How many of a flock's tasks have history 
function countWithHistoryForFlock(flockId) {
  return getDb()
    .prepare(
      `SELECT COUNT(*) AS n FROM daily_tasks t
        WHERE t.flock_id = ? AND (t.status = 'completed' OR EXISTS (SELECT 1 FROM task_events e WHERE e.task_id = t.id))`
    )
    .get(flockId).n;
}

// Deletes a task. 
function remove(id) {
  getDb().prepare('DELETE FROM daily_tasks WHERE id = ?').run(id);
}

function unassignPendingTasks(farmId, userId) {
  getDb()
    .prepare(
      `UPDATE daily_tasks SET assigned_to = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE farm_id = ? AND assigned_to = ? AND status = 'pending' AND cancelled_at IS NULL`
    )
    .run(farmId, userId);
}

module.exports = {
  create,
  createGenerated,
  findById,
  findByIdForFarm,
  findByGenerationKey,
  findForFarm,
  update,
  markCompleted,
  cancel,
  cancelPendingForFlockFrom,
  cancelPendingGenerated,
  reopen,
  addReviewNote,
  findEvents,
  hasHistory,
  countWithHistoryForFlock,
  remove,
  unassignPendingTasks,
};
