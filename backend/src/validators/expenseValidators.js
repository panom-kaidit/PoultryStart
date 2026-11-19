// Defines validation rules for expenses.
const { body, query } = require('express-validator');
const { isIsoDate } = require('../utils/dates');
const { CATEGORIES, AMOUNT_MAX, DESCRIPTION_MAX, REASON_MAX, FIELDS } = require('../data/expenses');

const CATEGORY_LIST = Object.keys(CATEGORIES);

const onlyFields = (allowed) => body().custom((value) => {
  const keys = Object.keys(value || {});
  if (keys.includes('currency')) {
    throw new Error("The currency is taken from the farm when the expense is recorded and cannot be set or changed.");
  }
  const unknown = keys.filter((key) => !allowed.includes(key));
  if (unknown.length > 0) {
    throw new Error(`Unknown field${unknown.length === 1 ? '' : 's'}: ${unknown.join(', ')}. ` +
      `This request accepts: ${allowed.join(', ')}.`);
  }
  return true;
});

const fieldRules = (isCorrection) => {
  const field = (name) => (isCorrection ? body(name).optional() : body(name));
  return [
    field('expenseDate').custom((value) => {
      if (!isIsoDate(value)) throw new Error('The expense date must be a real date written as YYYY-MM-DD.');
      return true;
    }),
    field('category').isIn(CATEGORY_LIST).withMessage(`Category must be one of: ${CATEGORY_LIST.join(', ')}.`),
    field('amount')
      .custom((value) => {
        const text = typeof value === 'number' ? String(value) : value;
        if (typeof text !== 'string' || !/^\d+$/.test(text.trim()) || Number(text) < 1 || Number(text) > AMOUNT_MAX) {
          throw new Error(`The amount must be a whole number from 1 to ${AMOUNT_MAX.toLocaleString('en-US')} ` +
            "(in whole units of the farm's currency, without decimals).");
        }
        return true;
      })
      .toInt(),
    field('description')
      .isString().withMessage('Describe the expense.').trim()
      .notEmpty().withMessage('Describe the expense.')
      .isLength({ max: DESCRIPTION_MAX }).withMessage(`The description must be at most ${DESCRIPTION_MAX} characters.`),
    body('flockId').optional({ values: 'null' })
      .isInt({ min: 1 }).withMessage('flockId must be a positive whole number (or left out for a farm expense).')
      .toInt(),
  ];
};

const createRules = [onlyFields(FIELDS), ...fieldRules(false)];

const CORRECTION_FIELDS = [...FIELDS, 'voided', 'expectedVersion', 'reason'];
const correctionRules = [
  onlyFields(CORRECTION_FIELDS),
  body().custom((value) => {
    const changing = FIELDS.filter((key) => value && key in value);
    if (value && 'voided' in value) {
      if (value.voided !== true) throw new Error('A voided expense cannot be un-voided. Send "voided": true only to void an expense.');
      if (changing.length > 0) {
        throw new Error(`Voiding is a correction of its own: send "voided": true without other fields (${changing.join(', ')}).`);
      }
      return true;
    }
    if (changing.length === 0) throw new Error(`Send at least one field to correct (${FIELDS.join(', ')}), or "voided": true.`);
    return true;
  }),
  body('expectedVersion').isInt({ min: 1 }).withMessage('expectedVersion (the version you are correcting) is required.').toInt(),
  body('reason').isString().withMessage('Give a reason for the correction.').trim()
    .notEmpty().withMessage('Give a reason for the correction.')
    .isLength({ max: REASON_MAX }).withMessage(`The reason must be at most ${REASON_MAX} characters.`),
  body('voided').optional(),
  ...fieldRules(true),
];

const dateQuery = (field) => query(field).optional().custom((value) => {
  if (!isIsoDate(value)) throw new Error(`${field} must be a real date written as YYYY-MM-DD.`);
  return true;
});
const filterRules = [
  dateQuery('from'), dateQuery('to'), dateQuery('date'),
  query('category').optional().isIn(CATEGORY_LIST).withMessage(`category must be one of: ${CATEGORY_LIST.join(', ')}.`),
  query('flockId').optional().custom((value) => {
    if (value === 'none' || /^[1-9]\d*$/.test(value)) return true;
    throw new Error('flockId must be a flock ID, or "none" for expenses not linked to a flock.');
  }),
];
const listRules = [
  ...filterRules,
  query('includeVoided').optional().isIn(['true', 'false']).withMessage('includeVoided must be "true" or "false".'),
];
const summaryRules = filterRules;

module.exports = { createRules, correctionRules, listRules, summaryRules };
