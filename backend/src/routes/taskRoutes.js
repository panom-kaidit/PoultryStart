// Routes for /api/farms/:farmId/tasks
const express = require('express');
const taskController = require('../controllers/taskController');
const validate = require('../middleware/validate');
const { requirePermission } = require('../middleware/farmAccess');
const {
  createTaskRules, updateTaskRules, cancelTaskRules, listTasksRules, completeTaskRules, reopenTaskRules, reviewNoteRules,
} = require('../validators/taskValidators');

const router = express.Router({ mergeParams: true });

router.get('/', requirePermission('tasks:view'), listTasksRules, validate, taskController.listTasks);
router.post('/', requirePermission('tasks:manage'), createTaskRules, validate, taskController.createTask);
router.get('/:taskId', requirePermission('tasks:view'), taskController.getTask);
router.patch('/:taskId', requirePermission('tasks:manage'), updateTaskRules, validate, taskController.updateTask);
router.post('/:taskId/cancel', requirePermission('tasks:manage'), cancelTaskRules, validate, taskController.cancelTask);

router.post('/:taskId/complete', requirePermission('tasks:complete'), completeTaskRules, validate, taskController.completeTask);
router.post('/:taskId/reopen', requirePermission('tasks:reopen'), reopenTaskRules, validate, taskController.reopenTask);
router.post('/:taskId/notes', requirePermission('tasks:manage'), reviewNoteRules, validate, taskController.addReviewNote);

module.exports = router;
