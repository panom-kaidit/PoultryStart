// Input rules for daily tasks 
const { body, query } = require('express-validator');
const { ugandaToday, isIsoDate } = require('../utils/dates');
const { CUSTOM_TASK_TYPES } = require('../data/customTaskTypes');

const TIME_SLOTS = ['morning', 'midday', 'evening', 'any'];

const optionalText = (field, label, max) => body(field)
  .optional({ values: 'null' })
  .isString().withMessage(`${label} must be text.`)
  .trim()
  .isLength({ max }).withMessage(`${label} must be at most ${max} characters.`);

// A due date: a real date, today or later
const dueDateRule = (chain) => chain.custom((value) => {
  if (!isIsoDate(value)) throw new Error('Due date must be a real date written as YYYY-MM-DD.');
  if (value < ugandaToday()) throw new Error('Due date cannot be in the past.');
  return true;
});

const titleRule = (chain) => chain
  .isString().withMessage('Title is required.')
  .trim()
  .notEmpty().withMessage('Title is required.')
  .isLength({ max: 150 }).withMessage('Title must be at most 150 characters.');

// null = no flock / unassigned.
const optionalId = (field, label) => body(field)
  .optional({ values: 'null' })
  .isInt({ min: 1 }).withMessage(`${label} must be a positive whole number.`)
  .toInt();

const createTaskRules = [
  titleRule(body('title')),
  optionalText('description', 'Description', 1000),
  dueDateRule(body('dueDate')),
  body('timeSlot').optional().isIn(TIME_SLOTS).withMessage(`Time slot must be one of: ${TIME_SLOTS.join(', ')}.`),
  body('taskType')
    .optional()
    .isIn(Object.keys(CUSTOM_TASK_TYPES))
    .withMessage(`Task type must be one of: ${Object.keys(CUSTOM_TASK_TYPES).join(', ')}.`),
  optionalId('flockId', 'Flock ID'),
  optionalId('assignedTo', 'Assignee'),
];

// Fields that are never changed through an edit, with what to do instead.
const PROTECTED_FIELDS = {
  status: 'Completing and reopening tasks are separate actions.',
  completedAt: 'Completing and reopening tasks are separate actions.',
  completedBy: 'Completing and reopening tasks are separate actions.',
  cancelledAt: 'Use POST .../cancel with a reason to cancel a task.',
  cancelReason: 'Use POST .../cancel with a reason to cancel a task.',
  source: 'The source of a task cannot be changed.',
  taskType: 'The task type cannot be changed. Cancel the task and create a new one.',
  templateCode: 'The task type cannot be changed. Cancel the task and create a new one.',
  farmId: 'A task cannot be moved to another farm.',
};
const EDITABLE_FIELDS = ['title', 'description', 'dueDate', 'timeSlot', 'flockId', 'assignedTo'];

const updateTaskRules = [
  body().custom((value) => {
    const blocked = Object.keys(value || {}).filter((key) => Object.hasOwn(PROTECTED_FIELDS, key));
    if (blocked.length > 0) throw new Error(blocked.map((key) => `${key}: ${PROTECTED_FIELDS[key]}`).join(' '));
    if (!value || !EDITABLE_FIELDS.some((key) => key in value)) {
      throw new Error(`Send at least one field to update: ${EDITABLE_FIELDS.join(', ')}.`);
    }
    return true;
  }),
  titleRule(body('title').optional()),
  optionalText('description', 'Description', 1000),
  dueDateRule(body('dueDate').optional()),
  body('timeSlot').optional().isIn(TIME_SLOTS).withMessage(`Time slot must be one of: ${TIME_SLOTS.join(', ')}.`),
  optionalId('flockId', 'Flock ID'),
  optionalId('assignedTo', 'Assignee'),
];

const cancelTaskRules = [
  body('reason')
    .isString().withMessage('Give a reason for cancelling the task.')
    .trim()
    .notEmpty().withMessage('Give a reason for cancelling the task.')
    .isLength({ max: 500 }).withMessage('Reason must be at most 500 characters.'),
];

const dateQuery = (field) => query(field)
  .optional()
  .custom((value) => {
    if (!isIsoDate(value)) throw new Error(`${field} must be a real date written as YYYY-MM-DD.`);
    return true;
  });

const listTasksRules = [
  dateQuery('from'),
  dateQuery('to'),
  query('to').optional().custom((value, { req }) => {
    if (req.query.from && isIsoDate(req.query.from) && value < req.query.from) throw new Error('"to" cannot be before "from".');
    return true;
  }),
  query('status').optional().isIn(['pending', 'completed', 'cancelled'])
    .withMessage('Status filter must be "pending", "completed" or "cancelled".'),
  query('flockId').optional().isInt({ min: 1 }).withMessage('flockId must be a positive whole number.'),
  query('assignedTo').optional().custom((value) => {
    if (value === 'me' || value === 'unassigned' || /^[1-9]\d*$/.test(value)) return true;
    throw new Error('assignedTo must be "me", "unassigned" or a user ID.');
  }),
];

module.exports = { createTaskRules, updateTaskRules, cancelTaskRules, listTasksRules, TIME_SLOTS };
