// Defines validation rules for dashboard and report queries.
const { query } = require('express-validator');
const { isIsoDate } = require('../utils/dates');

const onlyQuery = (allowed) => query().custom((value) => {
  const unknown = Object.keys(value || {}).filter((key) => !allowed.includes(key));
  if (unknown.length > 0) {
    throw new Error(allowed.length
      ? `Unknown filter: ${unknown.join(', ')}. Use: ${allowed.join(', ')}.`
      : `Unknown filter: ${unknown.join(', ')}. This request takes no filters.`);
  }
  return true;
});

const dateQuery = (field) => query(field).optional().custom((value) => {
  if (!isIsoDate(value)) throw new Error(`${field} must be a real date written as YYYY-MM-DD.`);
  return true;
});

const flockIdQuery = query('flockId').optional()
  .matches(/^[1-9]\d*$/).withMessage('flockId must be a positive whole number.');

const dashboardRules = [onlyQuery([])];

const flockReportRules = [onlyQuery(['from', 'to']), dateQuery('from'), dateQuery('to')];

const periodReportRules = [onlyQuery(['from', 'to', 'flockId']), dateQuery('from'), dateQuery('to'), flockIdQuery];

module.exports = { dashboardRules, flockReportRules, periodReportRules };
