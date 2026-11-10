// Validates the request body against a set of express-validator rules.
const { validationResult, matchedData } = require('express-validator');
const AppError = require('../utils/AppError');

function validate(req, res, next) {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    const details = result.array().map((err) => ({ field: err.path, message: err.msg }));
    throw new AppError(400, 'Some of the information provided is invalid.', details);
  }
 
  req.validated = matchedData(req, { locations: ['body'], includeOptionals: true });
  next();
}

module.exports = validate;
