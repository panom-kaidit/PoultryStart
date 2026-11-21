// Defines validation rules for flocks and bird movements.
const { body, query } = require('express-validator');
const { ugandaToday, isIsoDate } = require('../utils/dates');

const optionalText = (field, label, max) => body(field)
  .optional({ values: 'null' })
  .isString().withMessage(`${label} must be text.`)
  .trim()
  .isLength({ max }).withMessage(`${label} must be at most ${max} characters.`);

const createFlockRules = [
  optionalText('name', 'Flock name', 100),

  body('poultryType')
    .isIn(['broiler', 'layer']).withMessage('Poultry type must be "broiler" or "layer".'),

  body('startingStage')
    .optional()
    .isIn(['day_old', 'pullet', 'point_of_lay'])
    .withMessage('Starting stage must be "day_old", "pullet" or "point_of_lay".'),
  body('ageAtArrivalWeeks')
    .optional({ values: 'null' })
    .isInt({ min: 0, max: 100 }).withMessage('Age at arrival must be a whole number of weeks.')
    .toInt(),

  body('arrivalDate')
    .custom((value) => {
      if (!isIsoDate(value)) throw new Error('Arrival date must be a real date written as YYYY-MM-DD.');
      if (value > ugandaToday()) {
        throw new Error('Arrival date cannot be in the future. Record the flock once the birds have arrived.');
      }
      return true;
    }),

  body('birdsReceived')
    .isInt({ min: 1, max: 1000000 })
    .withMessage('Birds received must be a whole number from 1 to 1,000,000.')
    .toInt(),

  optionalText('breedStrain', 'Breed or strain', 100),
  optionalText('supplier', 'Supplier or hatchery', 150),

  body('malesReceived')
    .optional({ values: 'null' })
    .isInt({ min: 0, max: 1000000 }).withMessage('Males received must be a whole number, 0 or more.')
    .toInt(),
  body('femalesReceived')
    .optional({ values: 'null' })
    .isInt({ min: 0, max: 1000000 }).withMessage('Females received must be a whole number, 0 or more.')
    .toInt(),

  optionalText('vaccinationNotes', 'Vaccination notes', 1000),
  optionalText('notes', 'Notes', 1000),
];

const MOVEMENT_DIRECTION = {
  mortality: 'out',
  culled: 'out',
  sold: 'out',
  transferred_out: 'out',
  additional_received: 'in',
  correction: 'either',
};
const MOVEMENT_LABEL = {
  mortality: 'Mortality', culled: 'Culling', sold: 'A sale', transferred_out: 'A transfer out',
  additional_received: 'Additional birds',
};

const recordMovementRules = [
  body('movementType')
    .custom((value) => {
      if (value === 'received') {
        throw new Error('The birds received on arrival are recorded automatically when the flock is created.');
      }
      if (!Object.hasOwn(MOVEMENT_DIRECTION, value)) {
        throw new Error(`Movement type must be one of: ${Object.keys(MOVEMENT_DIRECTION).join(', ')}.`);
      }
      return true;
    }),

  body('birdChange')
    .isInt({ min: -1000000, max: 1000000 }).withMessage('Bird change must be a whole number of birds.')
    .bail()
    .toInt()
    .custom((value, { req }) => {
      const isReplacement = req.body.movementType === 'correction' && req.body.replacesMovementId != null;
      if (value === 0 && !isReplacement) throw new Error('Bird change cannot be 0.');
      const direction = MOVEMENT_DIRECTION[req.body.movementType];
      if (direction === 'out' && value > 0) {
        throw new Error(`${MOVEMENT_LABEL[req.body.movementType]} reduces the flock: enter a negative number, e.g. -${value}.`);
      }
      if (direction === 'in' && value < 0) {
        throw new Error(`${MOVEMENT_LABEL[req.body.movementType]} increases the flock: enter a positive number, e.g. ${-value}.`);
      }
      return true;
    }),

  body('movementDate')
    .optional()
    .custom((value) => {
      if (!isIsoDate(value)) throw new Error('Movement date must be a real date written as YYYY-MM-DD.');
      if (value > ugandaToday()) throw new Error('Movement date cannot be in the future.');
      return true;
    }),

  body('correctsMovementId')
    .optional({ values: 'null' })
    .isInt({ min: 1 }).withMessage('correctsMovementId must be a movement ID.')
    .toInt(),

  body('replacesMovementId')
    .optional({ values: 'null' })
    .isInt({ min: 1 }).withMessage('replacesMovementId must be a movement ID.')
    .toInt(),

  body('reason')
    .optional({ values: 'null' })
    .isString().withMessage('Reason must be text.')
    .trim()
    .isLength({ max: 500 }).withMessage('Reason must be at most 500 characters.'),

  optionalText('notes', 'Notes', 1000),

  body('birdsAgeWeeks')
    .optional({ values: 'null' })
    .isInt({ min: 0, max: 100 }).withMessage('Age of the additional birds must be a whole number of weeks.')
    .toInt(),

  body().custom((value) => {
    const type = value && value.movementType;
    if (type === 'correction') {
      if (value.correctsMovementId == null) throw new Error('A correction must give correctsMovementId (the movement being corrected).');
      if (typeof value.reason !== 'string' || value.reason.trim() === '') throw new Error('A correction must give a reason.');
    } else if (value && (value.correctsMovementId != null || value.replacesMovementId != null)) {
      throw new Error('Only a correction can refer to another movement (correctsMovementId, replacesMovementId).');
    }
    if (type === 'additional_received' && value.birdsAgeWeeks == null) {
      throw new Error('Give the age of the additional birds in weeks (birdsAgeWeeks), so they can be checked against this flock.');
    }
    if (type !== 'additional_received' && value && value.birdsAgeWeeks != null) {
      throw new Error('birdsAgeWeeks is only used for additional birds.');
    }
    return true;
  }),
];

const PROTECTED_FIELDS = {
  poultryType: 'The poultry type of a flock cannot be changed.',
  birdsReceived: 'The birds received cannot be edited. Record a correction movement instead.',
  initialBirdCount: 'The birds received cannot be edited. Record a correction movement instead.',
  liveBirds: 'The live bird count is calculated from the movement history. Record a movement instead.',
  status: 'Use POST .../close to close a flock. Closed flocks cannot be reopened.',
  closureDate: 'Use POST .../close to close a flock.',
  closedAt: 'Use POST .../close to close a flock.',
  closureReason: 'Use POST .../close to close a flock.',
  closureNotes: 'Use POST .../close to close a flock.',
  capacityAtArrival: 'The arrival space check is recalculated automatically when arrival details are corrected.',
  farmId: 'A flock cannot be moved to another farm.',
};
const EDITABLE_FIELDS = ['name', 'breedStrain', 'supplier', 'vaccinationNotes', 'notes',
  'arrivalDate', 'startingStage', 'ageAtArrivalWeeks', 'malesReceived', 'femalesReceived',
  'firstEggDate', 'expectedSaleDate'];

const milestoneDateRule = (field, label, { notInFuture }) => body(field)
  .optional({ values: 'undefined' })
  .custom((value) => {
    if (value === null) throw new Error(`The ${label} cannot be removed. Send the correct date instead.`);
    if (!isIsoDate(value)) throw new Error(`The ${label} must be a real date written as YYYY-MM-DD.`);
    if (notInFuture && value > ugandaToday()) throw new Error(`The ${label} cannot be in the future.`);
    return true;
  });

const updateFlockRules = [
  body().custom((value) => {
    const blocked = Object.keys(value || {}).filter((key) => Object.hasOwn(PROTECTED_FIELDS, key));
    if (blocked.length > 0) throw new Error(blocked.map((key) => `${key}: ${PROTECTED_FIELDS[key]}`).join(' '));
    if (!value || !EDITABLE_FIELDS.some((key) => key in value)) {
      throw new Error(`Send at least one field to update: ${EDITABLE_FIELDS.join(', ')}.`);
    }
    return true;
  }),
  body('name')
    .optional()
    .isString().withMessage('Flock name must be text.')
    .trim()
    .notEmpty().withMessage('Flock name cannot be empty.')
    .isLength({ max: 100 }).withMessage('Flock name must be at most 100 characters.'),
  optionalText('breedStrain', 'Breed or strain', 100),
  optionalText('supplier', 'Supplier or hatchery', 150),
  optionalText('vaccinationNotes', 'Vaccination notes', 1000),
  optionalText('notes', 'Notes', 1000),
  body('arrivalDate')
    .optional()
    .custom((value) => {
      if (!isIsoDate(value)) throw new Error('Arrival date must be a real date written as YYYY-MM-DD.');
      if (value > ugandaToday()) throw new Error('Arrival date cannot be in the future.');
      return true;
    }),
  body('startingStage')
    .optional()
    .isIn(['day_old', 'pullet', 'point_of_lay'])
    .withMessage('Starting stage must be "day_old", "pullet" or "point_of_lay".'),
  body('ageAtArrivalWeeks')
    .optional({ values: 'null' })
    .isInt({ min: 0, max: 100 }).withMessage('Age at arrival must be a whole number of weeks.')
    .toInt(),
  body('malesReceived')
    .optional({ values: 'null' })
    .isInt({ min: 0, max: 1000000 }).withMessage('Males received must be a whole number, 0 or more.')
    .toInt(),
  body('femalesReceived')
    .optional({ values: 'null' })
    .isInt({ min: 0, max: 1000000 }).withMessage('Females received must be a whole number, 0 or more.')
    .toInt(),
  milestoneDateRule('firstEggDate', 'first-egg date', { notInFuture: true }),
  milestoneDateRule('expectedSaleDate', 'expected sale date', { notInFuture: false }),
  optionalText('correctionReason', 'Correction reason', 500),
];

const closeFlockRules = [
  body('closureDate')
    .custom((value) => {
      if (!isIsoDate(value)) throw new Error('Closure date must be a real date written as YYYY-MM-DD.');
      if (value > ugandaToday()) throw new Error('Closure date cannot be in the future.');
      return true;
    }),
  body('closureReason')
    .isIn(['completed', 'ended_early']).withMessage('Closure reason must be "completed" or "ended_early".'),
  optionalText('closureNotes', 'Closure notes', 1000),
];

const listFlocksRules = [
  query('status')
    .optional()
    .isIn(['active', 'closed']).withMessage('Status filter must be "active" or "closed".'),
];

module.exports = {
  createFlockRules, listFlocksRules, recordMovementRules, updateFlockRules, closeFlockRules, MOVEMENT_DIRECTION,
};
