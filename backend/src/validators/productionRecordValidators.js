// Defines validation rules for production records.
const { body, query } = require('express-validator');
const { isIsoDate } = require('../utils/dates');
const {
  COLLECTION_PERIODS, MEASUREMENT_METHODS, WEIGHT_UNITS, FEED_UNITS, WATER_UNITS, LIMITS, RECORD_TYPES,
} = require('../data/productionRecords');

const ALLOWED = {
  weight: ['recordDate', 'weights', 'sampleSize', 'averageWeight', 'unit', 'notes'],
  eggs: ['recordDate', 'collectionPeriod', 'goodEggs', 'secondGradeEggs', 'floorEggs', 'notes'],
  feed: ['recordDate', 'feedStage', 'quantity', 'unit', 'measurementMethod', 'notes'],
  water: ['recordDate', 'quantity', 'unit', 'measurementMethod', 'notes'],
};
const CORRECTION_ONLY = ['expectedVersion', 'reason'];

const onlyFields = (type, extra = []) => body().custom((value) => {
  const allowed = [...ALLOWED[type], ...extra];
  const unknown = Object.keys(value || {}).filter((key) => !allowed.includes(key));
  if (unknown.length > 0) {
    throw new Error(`Unknown field${unknown.length === 1 ? '' : 's'}: ${unknown.join(', ')}. ` +
      `A ${RECORD_TYPES[type].label.toLowerCase()} accepts: ${allowed.join(', ')}.`);
  }
  return true;
});

const dateRule = (field, required) => {
  const chain = body(field);
  return (required ? chain : chain.optional()).custom((value) => {
    if (!isIsoDate(value)) throw new Error('The record date must be a real date written as YYYY-MM-DD.');
    return true;
  });
};
const notesRule = body('notes').optional({ values: 'null' })
  .isString().withMessage('Notes must be text.').trim()
  .isLength({ max: 1000 }).withMessage('Notes must be at most 1000 characters.');
const positiveNumber = (field, label, required, max) => {
  const chain = body(field);
  return (required ? chain : chain.optional())
    .isFloat({ gt: 0, max }).withMessage(`${label} must be a number above 0.`)
    .toFloat();
};
const count = (field, label) => body(field).optional()
  .isInt({ min: 0, max: LIMITS.eggsPerRecord }).withMessage(`${label} must be a whole number, 0 or more.`)
  .toInt();
const unitRule = (units) => body('unit').optional().isIn(units).withMessage(`Unit must be one of: ${units.join(', ')}.`);
const methodRule = (required) => {
  const chain = body('measurementMethod');
  return (required ? chain : chain.optional()).isIn(MEASUREMENT_METHODS)
    .withMessage('measurementMethod must be "measured" or "estimated".');
};

const weightShape = (isCorrection) => body().custom((value) => {
  const hasList = value && value.weights !== undefined;
  const hasAggregate = value && (value.sampleSize !== undefined || value.averageWeight !== undefined);
  if (hasList && hasAggregate) {
    throw new Error('Send either "weights" (each bird weighed) or "sampleSize" with "averageWeight", not both.');
  }
  if (!isCorrection && !hasList && !(value && value.sampleSize !== undefined && value.averageWeight !== undefined)) {
    throw new Error('Send "weights" (the weight of each bird weighed), or "sampleSize" and "averageWeight".');
  }
  return true;
});
const weightRules = (isCorrection) => [
  weightShape(isCorrection),
  body('weights').optional()
    .isArray({ min: 1, max: LIMITS.individualWeights })
    .withMessage(`weights must be a list of 1 to ${LIMITS.individualWeights} bird weights.`),
  body('weights.*').isFloat({ gt: 0 }).withMessage('Each weight must be a number above 0.').toFloat(),
  body('sampleSize').optional().isInt({ min: 1, max: 1000000 }).withMessage('sampleSize must be a whole number, 1 or more.').toInt(),
  positiveNumber('averageWeight', 'averageWeight', false, 1000000),
  unitRule(WEIGHT_UNITS),
];

const eggRules = (isCorrection) => [
  (isCorrection ? body('collectionPeriod').optional() : body('collectionPeriod'))
    .isIn(COLLECTION_PERIODS).withMessage(`collectionPeriod must be one of: ${COLLECTION_PERIODS.join(', ')}.`),
  count('goodEggs', 'goodEggs'),
  count('secondGradeEggs', 'secondGradeEggs'),
  count('floorEggs', 'floorEggs'),
];

const feedRules = (isCorrection) => [
  body('feedStage').optional().isString().withMessage('feedStage must be text.'),
  positiveNumber('quantity', 'quantity', !isCorrection, 100000000),
  unitRule(FEED_UNITS),
  methodRule(!isCorrection),
];

const waterRules = (isCorrection) => [
  positiveNumber('quantity', 'quantity', !isCorrection, 1000000000),
  unitRule(WATER_UNITS),
  methodRule(!isCorrection),
];

const TYPE_RULES = { weight: weightRules, eggs: eggRules, feed: feedRules, water: waterRules };

const createRules = (type) => [onlyFields(type), dateRule('recordDate', true), notesRule, ...TYPE_RULES[type](false)];

const correctionRules = (type) => [
  onlyFields(type, CORRECTION_ONLY),
  body().custom((value) => {
    if (!value || !ALLOWED[type].some((key) => key in value)) {
      throw new Error(`Send at least one field to correct: ${ALLOWED[type].join(', ')}.`);
    }
    return true;
  }),
  body('expectedVersion').isInt({ min: 1 }).withMessage('expectedVersion (the version you are correcting) is required.').toInt(),
  body('reason').isString().withMessage('Give a reason for the correction.').trim()
    .notEmpty().withMessage('Give a reason for the correction.')
    .isLength({ max: 500 }).withMessage('The reason must be at most 500 characters.'),
  dateRule('recordDate', false),
  notesRule,
  ...TYPE_RULES[type](true),
];

const dateQuery = (field) => query(field).optional().custom((value) => {
  if (!isIsoDate(value)) throw new Error(`${field} must be a real date written as YYYY-MM-DD.`);
  return true;
});
const listRules = [dateQuery('from'), dateQuery('to'), dateQuery('date')];

const farmListRules = [
  query('type').isIn(Object.keys(RECORD_TYPES)).withMessage(`type must be one of: ${Object.keys(RECORD_TYPES).join(', ')}.`),
  query('flockId').optional().isInt({ min: 1 }).withMessage('flockId must be a positive whole number.'),
  ...listRules,
];

module.exports = { createRules, correctionRules, listRules, farmListRules, ALLOWED };
