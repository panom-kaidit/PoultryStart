// Database operations for the "daily_tasks" table.
// (The full task module is added later; this starts with what the
// member module needs.)
const { getDb } = require('../config/database');

// When a member leaves a farm, their unfinished tasks on that farm become
// unassigned so the owner or a manager can give them to someone else.
// Completed tasks keep their history.
function unassignPendingTasks(farmId, userId) {
  getDb()
    .prepare(
      `UPDATE daily_tasks SET assigned_to = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE farm_id = ? AND assigned_to = ? AND status = 'pending'`
    )
    .run(farmId, userId);
}

module.exports = { unassignPendingTasks };
