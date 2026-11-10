// Input rules for creating and updating a farm.
const { body } = require('express-validator');

const POULTRY_TYPES = ['broiler', 'layer'];
const EXPERIENCE_LEVELS = ['beginner', 'some_experience', 'experienced'];
const MANAGEMENT_MODES = ['independent', 'with_team'];

// Builds the rules. For "create", the main fields are required;
function farmRules({ isUpdate }) {
  const required = (chain) => (isUpdate ? chain.optional() : chain);

  return [
    required(body('name'))
      .isString().withMessage('Farm name is required.')
      .trim()
      .notEmpty().withMessage('Farm name is required.')
      .isLength({ max: 100 }).withMessage('Farm name must be at most 100 characters.'),

    required(body('location'))
      .isString().withMessage('Location is required.')
      .trim()
      .notEmpty().withMessage('Location is required.')
      .isLength({ max: 150 }).withMessage('Location must be at most 150 characters.'),

    required(body('poultryType'))
      .isIn(POULTRY_TYPES).withMessage('Poultry type must be "broiler" or "layer".'),

    required(body('numberOfBirds'))
      .isInt({ min: 0, max: 1000000 }).withMessage('Number of birds must be a whole number from 0 to 1,000,000.')
      .toInt(),

    required(body('experienceLevel'))
      .isIn(EXPERIENCE_LEVELS)
      .withMessage('Experience level must be "beginner", "some_experience" or "experienced".'),

    body('farmSize')
      .optional({ values: 'null' })
      .isString().withMessage('Farm size must be text, e.g. "Half an acre".')
      .trim()
      .isLength({ max: 100 }).withMessage('Farm size must be at most 100 characters.'),

    body('managementMode')
      .optional()
      .isIn(MANAGEMENT_MODES).withMessage('Management mode must be "independent" or "with_team".'),

    body('currency')
      .optional()
      .isString().withMessage('Currency must be a 3-letter code such as UGX.')
      .trim()
      .toUpperCase()
      .matches(/^[A-Z]{3}$/).withMessage('Currency must be a 3-letter code such as UGX.'),
  ];
}

// For updates: reject an empty request body.
const atLeastOneField = body().custom((value) => {
  const allowed = ['name', 'location', 'poultryType', 'numberOfBirds', 'experienceLevel',
    'farmSize', 'managementMode', 'currency'];
  if (!value || !allowed.some((key) => key in value)) {
    throw new Error(`Send at least one field to update: ${allowed.join(', ')}.`);
  }
  return true;
});

const createFarmRules = farmRules({ isUpdate: false });
const updateFarmRules = [atLeastOneField, ...farmRules({ isUpdate: true })];

module.exports = { createFarmRules, updateFarmRules };
