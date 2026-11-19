// Defines validation rules for health observations.
const { body, query } = require('express-validator');
const { isIsoDate } = require('../utils/dates');
const { TEXT_MAX, FIELDS, MORTALITY_FIELDS, MORTALITY_MESSAGE } = require('../data/healthObservations');

const onlyFields = (extra = []) => body().custom((value) => {
  const allowed = [...FIELDS, ...extra];
  const keys = Object.keys(value || {});
  if (keys.some((key) => MORTALITY_FIELDS.includes(key))) throw new Error(MORTALITY_MESSAGE);
  const unknown = keys.filter((key) => !allowed.includes(key));
  if (unknown.length > 0) {
    throw new Error(`Unknown field${unknown.length === 1 ? '' : 's'}: ${unknown.join(', ')}. ` +
      `A health observation accepts: ${allowed.join(', ')}.`);
  }
  return true;
});

const yesNo = (field) => body(field).optional().custom((value) => {
  if (typeof value !== 'boolean') throw new Error(`${field} must be true or false.`);
  return true;
});

const fieldRules = (isCorrection) => [
  (isCorrection ? body('observationDate').optional() : body('observationDate')).custom((value) => {
    if (!isIsoDate(value)) throw new Error('The observation date must be a real date written as YYYY-MM-DD.');
    return true;
  }),
  (isCorrection ? body('observation').optional() : body('observation'))
    .isString().withMessage('Describe what you noticed.').trim()
    .notEmpty().withMessage('Describe what you noticed.')
    .isLength({ max: TEXT_MAX }).withMessage(`The observation must be at most ${TEXT_MAX} characters.`),
  body('birdsAffected').optional({ values: 'null' })
    .isInt({ min: 1 }).withMessage('birdsAffected must be a whole number, 1 or more (leave it out if the birds were not counted).')
    .toInt(),
  body('actionTaken').optional({ values: 'null' })
    .isString().withMessage('actionTaken must be text.').trim()
    .isLength({ max: TEXT_MAX }).withMessage(`The action taken must be at most ${TEXT_MAX} characters.`),
  yesNo('vetContacted'),
  yesNo('extensionOfficerContacted'),
];

const createRules = [onlyFields(), ...fieldRules(false)];

const CORRECTION_ONLY = ['expectedVersion', 'reason'];
const correctionRules = [
  onlyFields(CORRECTION_ONLY),
  body().custom((value) => {
    if (!value || !FIELDS.some((key) => key in value)) {
      throw new Error(`Send at least one field to correct: ${FIELDS.join(', ')}.`);
    }
    return true;
  }),
  body('expectedVersion').isInt({ min: 1 }).withMessage('expectedVersion (the version you are correcting) is required.').toInt(),
  body('reason').isString().withMessage('Give a reason for the correction.').trim()
    .notEmpty().withMessage('Give a reason for the correction.')
    .isLength({ max: 500 }).withMessage('The reason must be at most 500 characters.'),
  ...fieldRules(true),
];

const dateQuery = (field) => query(field).optional().custom((value) => {
  if (!isIsoDate(value)) throw new Error(`${field} must be a real date written as YYYY-MM-DD.`);
  return true;
});
const listRules = [dateQuery('from'), dateQuery('to'), dateQuery('date')];

const farmListRules = [
  query('flockId').optional().isInt({ min: 1 }).withMessage('flockId must be a positive whole number.'),
  ...listRules,
];

module.exports = { createRules, correctionRules, listRules, farmListRules };
