// Input rules for readiness responses and checklist items (FR-04, FR-05).
const { body } = require('express-validator');
const { AREAS, ANSWERS, NEEDED_BY } = require('../data/readinessContent');

const STAGE_KEYS = Object.keys(NEEDED_BY);
const neededByRule = (chain) =>
  chain.isIn(STAGE_KEYS).withMessage(`neededBy must be one of: ${STAGE_KEYS.join(', ')}.`);

// JSON true/false only (not "yes", 1 or "true"), so the meaning is clear.
const booleanField = (field, label) =>
  body(field)
    .optional()
    .custom((value) => {
      if (typeof value !== 'boolean') throw new Error(`${label} must be true or false.`);
      return true;
    });

const notesField = (field) =>
  body(field)
    .optional({ values: 'null' })
    .isString().withMessage('Notes must be text.')
    .trim()
    .isLength({ max: 500 }).withMessage('Notes must be at most 500 characters.');

// PATCH .../responses   { "responses": [ { "questionId": 1, "answer": "yes", "notes": "..." } ] }
const saveResponsesRules = [
  body('responses')
    .isArray({ min: 1, max: 50 }).withMessage('Send "responses" as a list of 1 to 50 answers.'),
  body('responses.*.questionId')
    .isInt({ min: 1 }).withMessage('Each answer needs a valid questionId.')
    .toInt(),
  body('responses.*.answer')
    .isIn(ANSWERS).withMessage('Each answer must be "yes", "no" or "partly".'),
  notesField('responses.*.notes'),
];

const itemNameRule = (chain) =>
  chain
    .isString().withMessage('Item name is required.')
    .trim()
    .notEmpty().withMessage('Item name is required.')
    .isLength({ max: 100 }).withMessage('Item name must be at most 100 characters.');

const categoryRule = (chain) =>
  chain.isIn(AREAS).withMessage(`Category must be one of: ${AREAS.join(', ')}.`);

// POST .../resources   (a custom item)
const createResourceRules = [
  itemNameRule(body('itemName')),
  categoryRule(body('category')),
  booleanField('isRequired', 'isRequired'),
  booleanField('isAvailable', 'isAvailable'),
  neededByRule(body('neededBy').optional()),
  notesField('notes'),
];

const UPDATABLE = ['itemName', 'category', 'isRequired', 'isAvailable', 'neededBy', 'notes'];

// PATCH .../resources/:itemId
const updateResourceRules = [
  body().custom((value) => {
    if (!value || !UPDATABLE.some((key) => key in value)) {
      throw new Error(`Send at least one field to update: ${UPDATABLE.join(', ')}.`);
    }
    return true;
  }),
  itemNameRule(body('itemName').optional()),
  categoryRule(body('category').optional()),
  booleanField('isRequired', 'isRequired'),
  booleanField('isAvailable', 'isAvailable'),
  neededByRule(body('neededBy').optional()),
  notesField('notes'),
];

module.exports = { saveResponsesRules, createResourceRules, updateResourceRules };
