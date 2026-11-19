// Handles daily task business operations.
const { runInTransaction, runInImmediateTransaction } = require('../config/database');
const taskModel = require('../models/taskModel');
const flockModel = require('../models/flockModel');
const productionRecordModel = require('../models/productionRecordModel');
const healthObservationModel = require('../models/healthObservationModel');
const expenseModel = require('../models/expenseModel');
const farmModel = require('../models/farmModel');
const { taskGuidanceLinks } = require('./guidanceService');
const membershipModel = require('../models/membershipModel');
const AppError = require('../utils/AppError');
const { roleHasPermission } = require('../utils/permissions');
const { CUSTOM_TASK_TYPES, DEFAULT_CUSTOM_TASK_TYPE, customTypeOfCode } = require('../data/customTaskTypes');
const { ugandaToday, addDays } = require('../utils/dates');
const { findTemplate, RECORD_LINKS, SOURCE_TYPES, labelsOf } = require('../data/taskTemplates');
const { generateTasks } = require('./taskGenerator');

const invalid = (field, message) => {
  throw new AppError(400, 'Some of the information provided is invalid.', [{ field, message }]);
};

const EDITABLE_FIELDS = ['title', 'description', 'dueDate', 'timeSlot', 'flockId', 'assignedTo'];

const canManage = (membership) => roleHasPermission(membership.role, 'tasks:manage');

const canSee = (task, membership) => canManage(membership)
  || task.assignedTo === null || task.assignedTo === membership.userId;

const WEEK_EXTRA_DAYS = 6;
const lastDayOf = (task) => (task.frequency === 'weekly' ? addDays(task.dueDate, WEEK_EXTRA_DAYS) : task.dueDate);

function displayStatusOf(task, today = ugandaToday()) {
  if (task.cancelledAt) return 'cancelled';
  if (task.status === 'completed') return 'completed';
  if (lastDayOf(task) >= today) return 'pending';
  return task.frequency === 'daily' ? 'missed' : 'overdue';
}

const ugandaDateOf = (utcTimestamp) => ugandaToday(new Date(`${utcTimestamp.replace(' ', 'T')}Z`));

function completedLateOf(task) {
  if (task.status !== 'completed' || !task.completedAt) return undefined;
  return ugandaDateOf(task.completedAt) > lastDayOf(task);
}

function recordLinksFor(task, template, viewer) {
  if (!template.recordLinks) return [];
  const flock = task.flockId ? flockModel.findById(task.flockId) : null;
  const from = task.dueDate;
  const to = lastDayOf(task);
  return template.recordLinks
    .filter((type) => type !== 'egg_records' || (flock && flock.poultryType === 'layer' && Boolean(flock.firstEggDate)))
    .filter((type) => !RECORD_LINKS[type].permission || (viewer && roleHasPermission(viewer.role, RECORD_LINKS[type].permission)))
    .map((type) => {
      const { path, farmPath, recordType, permission, ...link } = RECORD_LINKS[type];
      const result = { type, ...link };
      if (farmPath) {
        const filters = { ...(flock ? { flockId: flock.id } : {}), ...(template.recordLinkFilters?.[type] || {}) };
        const qs = new URLSearchParams(filters).toString();
        result.path = `/api/farms/${task.farmId}/${farmPath}${qs ? `?${qs}` : ''}`;
        result.recordType = recordType;
        result.recordsForTaskPeriod = expenseModel.countActiveBetween(task.farmId, { ...filters, from, to });
        return result;
      }
      if (flock && path) result.path = `/api/farms/${task.farmId}/flocks/${flock.id}/${path}`;
      if (flock && recordType) {
        result.recordType = recordType;
        result.recordsForTaskPeriod = recordType === 'health'
          ? healthObservationModel.countForFlockBetween(flock.id, from, to)
          : productionRecordModel.countForFlockBetween(recordType, flock.id, from, to);
      }
      return result;
    });
}

function poultryTypeOf(task) {
  const flock = task.flockId ? flockModel.findById(task.flockId) : null;
  return flock ? flock.poultryType : farmModel.findById(task.farmId)?.poultryType;
}

function present(task, today = ugandaToday(), viewer = null) {
  const taskType = customTypeOfCode(task.templateCode);
  const result = { ...task, taskType, displayStatus: displayStatusOf(task, today) };
  if (task.status === 'completed' && task.completedAt) result.completedLate = completedLateOf(task);
  if (taskType === 'vet_plan') result.disclaimer = CUSTOM_TASK_TYPES.vet_plan.disclaimer;
  const template = task.source === 'generated' ? findTemplate(task.templateCode) : null;
  if (template) {
    result.guidance = {
      basis: template.basis,
      labels: labelsOf(template),
      sources: template.sources.map((code) => ({ code, ...SOURCE_TYPES[code] })),
    };
    result.recordLinks = recordLinksFor(task, template, viewer);
    result.recordLink = result.recordLinks[0] || null;
    result.guidanceLinks = taskGuidanceLinks(template.code, poultryTypeOf(task));
  }
  return result;
}

const withHistory = (task, viewer) => ({ ...present(task, undefined, viewer), history: taskModel.findEvents(task.id) });

function assertOpen(task, action) {
  const status = displayStatusOf(task);
  if (status === 'cancelled') throw new AppError(409, `This task was cancelled, so it cannot be ${action}.`);
  if (status === 'completed') throw new AppError(409, `This task is already completed, so it cannot be ${action}.`);
  if (status === 'missed') {
    throw new AppError(409, `This daily task was missed (it was due on ${task.dueDate}), so it cannot be ${action}. ` +
      'A missed task stays missed; an owner or manager can add a review note.');
  }
}

function checkFlock(farm, flockId) {
  const flock = flockModel.findByIdForFarm(farm.id, flockId);
  if (!flock) invalid('flockId', `Flock ${flockId} was not found on this farm.`);
  if (flock.status !== 'active') invalid('flockId', `Flock "${flock.name}" is closed. Tasks can only be linked to active flocks.`);
}

function checkAssignee(farm, userId) {
  if (!membershipModel.findByFarmAndUser(farm.id, userId)) {
    invalid('assignedTo', `User ${userId} is not a member of this farm. Add them to the farm first.`);
  }
}

function getVisibleTaskOrFail(farm, membership, taskId) {
  const task = taskModel.findByIdForFarm(farm.id, taskId);
  if (!task || !canSee(task, membership)) throw new AppError(404, 'Task not found.');
  return task;
}

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

function listTasks(farm, membership, filters) {
  generateTasks(farm, ugandaToday());
  let { assignedTo } = filters;
  if (assignedTo === 'me') assignedTo = membership.userId;
  else if (assignedTo && assignedTo !== 'unassigned') assignedTo = Number(assignedTo);
  return taskModel.findForFarm(farm.id, {
    from: filters.from,
    to: filters.to,
    flockId: filters.flockId ? Number(filters.flockId) : undefined,
    status: filters.status,
    today: ugandaToday(),
    weekStartedFrom: addDays(ugandaToday(), -WEEK_EXTRA_DAYS),
    assignedTo,
    visibleToUserId: canManage(membership) ? undefined : membership.userId,
  }).map((task) => present(task, undefined, membership));
}

function getTask(farm, membership, taskId) {
  return withHistory(getVisibleTaskOrFail(farm, membership, taskId), membership);
}

function updateTask(farm, membership, taskId, data) {
  return runInImmediateTransaction(() => {
    const task = getVisibleTaskOrFail(farm, membership, taskId);
    assertOpen(task, 'changed');

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
    return withHistory(updated, membership);
  });
}

function cancelTask(farm, membership, taskId, reason, userId) {
  return runInImmediateTransaction(() => {
    const task = getVisibleTaskOrFail(farm, membership, taskId);
    if (task.cancelledAt) throw new AppError(409, 'This task is already cancelled.');
    assertOpen(task, 'cancelled');
    if (!taskModel.cancel(task.id, { userId, reason })) {
      throw new AppError(409, 'This task is no longer pending and was not cancelled.');
    }
    return withHistory(taskModel.findById(task.id), membership);
  });
}

function completeTask(farm, membership, taskId, data, userId) {
  return runInImmediateTransaction(() => {
    const task = getVisibleTaskOrFail(farm, membership, taskId);
    assertOpen(task, 'completed');
    const today = ugandaToday();
    if (task.frequency === 'daily' && task.dueDate > today) {
      throw new AppError(409, `This daily task is for ${task.dueDate}. It can only be completed on that day.`);
    }
    const done = taskModel.markCompleted(task.id, {
      userId,
      notes: data.notes || null,
      problemReported: data.problemReported === true,
    });
    if (!done) throw new AppError(409, 'This task is no longer open and was not completed.');
    return withHistory(taskModel.findById(task.id), membership);
  });
}

function reopenTask(farm, membership, taskId, reason, userId) {
  return runInImmediateTransaction(() => {
    const task = getVisibleTaskOrFail(farm, membership, taskId);
    if (task.cancelledAt) throw new AppError(409, 'This task was cancelled, so it cannot be reopened.');
    if (task.status !== 'completed') throw new AppError(409, 'Only a completed task can be reopened.');
    if (!taskModel.reopen(task.id, { userId, reason })) {
      throw new AppError(409, 'This task is no longer completed and was not reopened.');
    }
    return withHistory(taskModel.findById(task.id), membership);
  });
}

function addReviewNote(farm, membership, taskId, note, userId) {
  return runInImmediateTransaction(() => {
    const task = getVisibleTaskOrFail(farm, membership, taskId);
    taskModel.addReviewNote(task.id, { userId, note });
    return withHistory(taskModel.findById(task.id), membership);
  });
}

module.exports = {
  createTask, listTasks, getTask, updateTask, cancelTask, completeTask, reopenTask, addReviewNote, displayStatusOf, completedLateOf,
};
