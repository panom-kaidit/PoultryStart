// Routes for /api/farms/:farmId/tasks 
const express = require('express');
const taskController = require('../controllers/taskController');
const validate = require('../middleware/validate');
const { requirePermission } = require('../middleware/farmAccess');
const {
  createTaskRules, updateTaskRules, cancelTaskRules, listTasksRules,
} = require('../validators/taskValidators');

const router = express.Router({ mergeParams: true });

router.get('/', requirePermission('tasks:view'), listTasksRules, validate, taskController.listTasks);
router.post('/', requirePermission('tasks:manage'), createTaskRules, validate, taskController.createTask);
router.get('/:taskId', requirePermission('tasks:view'), taskController.getTask);
router.patch('/:taskId', requirePermission('tasks:manage'), updateTaskRules, validate, taskController.updateTask);
router.post('/:taskId/cancel', requirePermission('tasks:manage'), cancelTaskRules, validate, taskController.cancelTask);

module.exports = router;
