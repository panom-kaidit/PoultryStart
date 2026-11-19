// Defines validation rules for guidance and Advisor queries.
const { query } = require('express-validator');
const { TOPICS, POULTRY_TYPES, STAGES } = require('../data/guidanceContent');

const ALL_STAGES = [...new Set([...Object.keys(STAGES.broiler), ...Object.keys(STAGES.layer)]), 'any'];
const ALLOWED_QUERY = ['poultryType', 'topic', 'stage', 'q'];

const listGuidanceRules = [
  query().custom((value) => {
    const unknown = Object.keys(value || {}).filter((key) => !ALLOWED_QUERY.includes(key));
    if (unknown.length > 0) throw new Error(`Unknown filter: ${unknown.join(', ')}. Use: ${ALLOWED_QUERY.join(', ')}.`);
    return true;
  }),
  query('poultryType').optional().isIn(POULTRY_TYPES).withMessage(`poultryType must be one of: ${POULTRY_TYPES.join(', ')}.`),
  query('topic').optional().isIn(Object.keys(TOPICS)).withMessage(`topic must be one of: ${Object.keys(TOPICS).join(', ')}.`),
  query('stage').optional().isIn(ALL_STAGES).withMessage(`stage must be one of: ${ALL_STAGES.join(', ')}.`)
    .custom((value, { req }) => {
      const type = req.query.poultryType;
      if (value !== 'any' && (type === 'broiler' || type === 'layer') && !STAGES[type][value]) {
        throw new Error(`For ${type} articles, stage must be one of: ${Object.keys(STAGES[type]).join(', ')}, any.`);
      }
      return true;
    }),
  query('q').optional().isString().withMessage('q must be text.').trim()
    .isLength({ min: 2, max: 100 }).withMessage('Search text must be 2 to 100 characters.'),
];

const advisorRules = [
  query().custom((value) => {
    const unknown = Object.keys(value || {}).filter((key) => key !== 'flockId');
    if (unknown.length > 0) throw new Error(`Unknown filter: ${unknown.join(', ')}. Use: flockId.`);
    return true;
  }),
  query('flockId').optional().isInt({ min: 1 }).withMessage('flockId must be a positive whole number.'),
];

module.exports = { listGuidanceRules, advisorRules };
