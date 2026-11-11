// Handles HTTP requests for /api/farms/:farmId/tasks (FR-07).
const taskService = require('../services/taskService');
const { sendSuccess } = require('../utils/response');
const { parseId } = require('../utils/ids');

const taskIdOf = (req) => parseId(req.params.taskId, 'Task ID');

function createTask(req, res) {
  const task = taskService.createTask(req.farm, req.validated, req.user.id);
  sendSuccess(res, 201, { task }, 'Task created.');
}

function listTasks(req, res) {
  const tasks = taskService.listTasks(req.farm, req.membership, req.query);
  sendSuccess(res, 200, { tasks });
}

function getTask(req, res) {
  sendSuccess(res, 200, { task: taskService.getTask(req.farm, req.membership, taskIdOf(req)) });
}

function updateTask(req, res) {
  const task = taskService.updateTask(req.farm, req.membership, taskIdOf(req), req.validated);
  sendSuccess(res, 200, { task }, 'Task updated.');
}

function cancelTask(req, res) {
  const task = taskService.cancelTask(req.farm, req.membership, taskIdOf(req), req.validated.reason, req.user.id);
  sendSuccess(res, 200, { task }, 'Task cancelled. It stays in the task history.');
}

module.exports = { createTask, listTasks, getTask, updateTask, cancelTask };
