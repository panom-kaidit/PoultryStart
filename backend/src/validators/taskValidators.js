// Defines validation rules for daily tasks.
const { body, query } = require('express-validator');
const { ugandaToday, isIsoDate } = require('../utils/dates');
const { CUSTOM_TASK_TYPES } = require('../data/customTaskTypes');

const TIME_SLOTS = ['morning', 'midday', 'evening', 'any'];
const DISPLAY_STATUSES = ['pending', 'overdue', 'missed', 'completed', 'cancelled'];

const optionalText = (field, label, max) => body(field)
  .optional({ values: 'null' })
  .isString().withMessage(`${label} must be text.`)
  .trim()
  .isLength({ max }).withMessage(`${label} must be at most ${max} characters.`);

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
  query('status').optional().isIn(DISPLAY_STATUSES)
    .withMessage(`Status filter must be one of: ${DISPLAY_STATUSES.join(', ')}.`),
  query('flockId').optional().isInt({ min: 1 }).withMessage('flockId must be a positive whole number.'),
  query('assignedTo').optional().custom((value) => {
    if (value === 'me' || value === 'unassigned' || /^[1-9]\d*$/.test(value)) return true;
    throw new Error('assignedTo must be "me", "unassigned" or a user ID.');
  }),
];

const FLOCK_PATH = '/api/farms/:farmId/flocks/:flockId';
const MORTALITY_FORM = `Record deaths in the flock's mortality form (POST ${FLOCK_PATH}/movements).`;
const FEED_RECORDS = `Feed amounts belong in the flock's feed consumption records (POST ${FLOCK_PATH}/records/feed).`;
const WATER_RECORDS = `Drinking-water amounts belong in the flock's drinking-water records (POST ${FLOCK_PATH}/records/water).`;
const FEED_OR_WATER_RECORDS = `Feed and drinking-water amounts belong in the flock's feed or drinking-water records ` +
  `(POST ${FLOCK_PATH}/records/feed or /records/water).`;
const HEALTH_RECORDS = `Health notes belong in the flock's health observations (POST ${FLOCK_PATH}/records/health).`;
const TEMPERATURE = 'PoultryStart Version 1 does not keep temperature records. Describe what you noticed in the task notes.';
const EGG_RECORDS = `Egg numbers belong in the flock's egg collection records (POST ${FLOCK_PATH}/records/eggs).`;
const WEIGHT_RECORDS = `Body weights belong in the flock's weight records (POST ${FLOCK_PATH}/records/weights).`;
const MEASUREMENT_FIELDS = {
  birdsLost: MORTALITY_FORM,
  birdChange: MORTALITY_FORM,
  mortality: MORTALITY_FORM,
  deaths: MORTALITY_FORM,
  deadBirds: MORTALITY_FORM,
  quantity: FEED_OR_WATER_RECORDS,
  unit: FEED_OR_WATER_RECORDS,
  feedKg: FEED_RECORDS,
  feedQuantity: FEED_RECORDS,
  waterLitres: WATER_RECORDS,
  waterQuantity: WATER_RECORDS,
  temperature: TEMPERATURE,
  healthObservation: HEALTH_RECORDS,
  eggs: EGG_RECORDS,
  eggsCollected: EGG_RECORDS,
  eggCount: EGG_RECORDS,
  crackedEggs: EGG_RECORDS,
  floorEggs: EGG_RECORDS,
  weight: WEIGHT_RECORDS,
  weightKg: WEIGHT_RECORDS,
  averageWeight: WEIGHT_RECORDS,
  bodyWeight: WEIGHT_RECORDS,
};
const COMPLETION_FIELDS = ['notes', 'problemReported'];

const completeTaskRules = [
  body().custom((value) => {
    const keys = Object.keys(value || {});
    const measurements = keys.filter((key) => Object.hasOwn(MEASUREMENT_FIELDS, key));
    if (measurements.length > 0) {
      throw new Error(`Task completion does not record measurements (${measurements.join(', ')}). ` +
        [...new Set(measurements.map((key) => MEASUREMENT_FIELDS[key]))].join(' '));
    }
    const unknown = keys.filter((key) => !COMPLETION_FIELDS.includes(key));
    if (unknown.length > 0) {
      throw new Error(`Unknown field${unknown.length === 1 ? '' : 's'}: ${unknown.join(', ')}. ` +
        `Completing a task accepts only: ${COMPLETION_FIELDS.join(', ')}.`);
    }
    return true;
  }),
  optionalText('notes', 'Notes', 1000),
  body('problemReported')
    .optional()
    .custom((value) => {
      if (typeof value !== 'boolean') throw new Error('problemReported must be true or false.');
      return true;
    }),
  body('notes').custom((value, { req }) => {
    if (req.body.problemReported === true && (typeof value !== 'string' || value.trim() === '')) {
      throw new Error('Describe the problem in notes when reporting a problem.');
    }
    return true;
  }),
];

const reasonRule = (field, message, max) => body(field)
  .isString().withMessage(message)
  .trim()
  .notEmpty().withMessage(message)
  .isLength({ max }).withMessage(`${field} must be at most ${max} characters.`);

const reopenTaskRules = [reasonRule('reason', 'Give a reason for reopening the task.', 500)];
const reviewNoteRules = [reasonRule('note', 'Write the review note.', 1000)];

module.exports = {
  createTaskRules, updateTaskRules, cancelTaskRules, listTasksRules, completeTaskRules, reopenTaskRules, reviewNoteRules,
  TIME_SLOTS, DISPLAY_STATUSES, MEASUREMENT_FIELDS,
};
