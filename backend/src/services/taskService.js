// Business logic for daily tasks 
const { runInTransaction, runInImmediateTransaction } = require('../config/database');
const taskModel = require('../models/taskModel');
const flockModel = require('../models/flockModel');
const membershipModel = require('../models/membershipModel');
const AppError = require('../utils/AppError');
const { roleHasPermission } = require('../utils/permissions');
const { CUSTOM_TASK_TYPES, DEFAULT_CUSTOM_TASK_TYPE, customTypeOfCode } = require('../data/customTaskTypes');

const invalid = (field, message) => {
  throw new AppError(400, 'Some of the information provided is invalid.', [{ field, message }]);
};

const EDITABLE_FIELDS = ['title', 'description', 'dueDate', 'timeSlot', 'flockId', 'assignedTo'];

const canManage = (membership) => roleHasPermission(membership.role, 'tasks:manage');

const canSee = (task, membership) => canManage(membership)
  || task.assignedTo === null || task.assignedTo === membership.userId;

// The status shown to users.
function displayStatusOf(task) {
  if (task.cancelledAt) return 'cancelled';
  return task.status; // 'pending' or 'completed'
}

// A task as returned by the API.
function present(task) {
  const taskType = customTypeOfCode(task.templateCode);
  const result = { ...task, taskType, displayStatus: displayStatusOf(task) };
  if (taskType === 'vet_plan') result.disclaimer = CUSTOM_TASK_TYPES.vet_plan.disclaimer;
  return result;
}

// The flock must be an ACTIVE flock of this farm (a closed flock is read-only).
function checkFlock(farm, flockId) {
  const flock = flockModel.findByIdForFarm(farm.id, flockId);
  if (!flock) invalid('flockId', `Flock ${flockId} was not found on this farm.`);
  if (flock.status !== 'active') invalid('flockId', `Flock "${flock.name}" is closed. Tasks can only be linked to active flocks.`);
}

// The assignee must be a member of this farm (owner, manager or worker).
function checkAssignee(farm, userId) {
  if (!membershipModel.findByFarmAndUser(farm.id, userId)) {
    invalid('assignedTo', `User ${userId} is not a member of this farm. Add them to the farm first.`);
  }
}

// The task, if it exists on this farm AND this member may see it.
// Otherwise "not found", so workers learn nothing about other workers' tasks.
function getVisibleTaskOrFail(farm, membership, taskId) {
  const task = taskModel.findByIdForFarm(farm.id, taskId);
  if (!task || !canSee(task, membership)) throw new AppError(404, 'Task not found.');
  return task;
}

// ---- Public functions used by the controller --------------------------

// Creates a custom task (owner or manager).
function createTask(farm, data, userId) {
  if (data.flockId != null) checkFlock(farm, data.flockId);
  if (data.assignedTo != null) checkAssignee(farm, data.assignedTo);
  const taskType = data.taskType || DEFAULT_CUSTOM_TASK_TYPE;

  return runInTransaction(() => {
    const task = taskModel.create({
      farmId: farm.id,
      flockId: data.flockId ?? null,
      title: data.title,
      description: data.description ?? null,
      dueDate: data.dueDate,
      timeSlot: data.timeSlot || 'any',
      assignedTo: data.assignedTo ?? null,
      createdBy: userId,
      source: 'custom',
      templateCode: CUSTOM_TASK_TYPES[taskType].code,
      frequency: 'once',
    });
    return present(task);
  });
}

// Lists the farm's tasks visible to this member, with optional filters.
function listTasks(farm, membership, filters) {
  let { assignedTo } = filters;
  if (assignedTo === 'me') assignedTo = membership.userId;
  else if (assignedTo && assignedTo !== 'unassigned') assignedTo = Number(assignedTo);
  return taskModel.findForFarm(farm.id, {
    from: filters.from,
    to: filters.to,
    flockId: filters.flockId ? Number(filters.flockId) : undefined,
    status: filters.status,
    assignedTo,
    visibleToUserId: canManage(membership) ? undefined : membership.userId,
  }).map(present);
}

// One task with its audit history.
function getTask(farm, membership, taskId) {
  const task = getVisibleTaskOrFail(farm, membership, taskId);
  return { ...present(task), history: taskModel.findEvents(task.id) };
}

// Edits a pending task (owner or manager)
function updateTask(farm, membership, taskId, data) {
  return runInImmediateTransaction(() => {
    const task = getVisibleTaskOrFail(farm, membership, taskId);
    if (task.cancelledAt) throw new AppError(409, 'This task was cancelled and can no longer be changed.');
    if (task.status !== 'pending') throw new AppError(409, 'This task is completed and can no longer be changed.');

    const sent = Object.fromEntries(EDITABLE_FIELDS.filter((key) => data[key] !== undefined).map((key) => [key, data[key]]));
    if (task.source === 'generated') {
      const other = Object.keys(sent).filter((key) => key !== 'assignedTo');
      if (other.length > 0) {
        invalid(other[0], 'A task created from the PoultryStart catalogue can only be reassigned.');
      }
    }
    if (sent.flockId != null) checkFlock(farm, sent.flockId);
    if (sent.assignedTo != null) checkAssignee(farm, sent.assignedTo);

    const updated = taskModel.update(task.id, sent);
    if (!updated) throw new AppError(409, 'This task is no longer pending and was not changed.');
    return { ...present(updated), history: taskModel.findEvents(task.id) };
  });
}

// Cancels a pending task with a reason (owner or manager).
function cancelTask(farm, membership, taskId, reason, userId) {
  return runInImmediateTransaction(() => {
    const task = getVisibleTaskOrFail(farm, membership, taskId);
    if (task.cancelledAt) throw new AppError(409, 'This task is already cancelled.');
    if (task.status !== 'pending') throw new AppError(409, 'A completed task cannot be cancelled.');
    if (!taskModel.cancel(task.id, { userId, reason })) {
      throw new AppError(409, 'This task is no longer pending and was not cancelled.');
    }
    return { ...present(taskModel.findById(task.id)), history: taskModel.findEvents(task.id) };
  });
}

module.exports = { createTask, listTasks, getTask, updateTask, cancelTask, displayStatusOf };
