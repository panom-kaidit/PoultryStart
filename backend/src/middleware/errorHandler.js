// Handles errors and sends consistent JSON responses.
const AppError = require('../utils/AppError');

// For URLs that do not match any route.
function notFound(req, res, next) {
  next(new AppError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}
// Error handling middlewares.
function errorHandler(err, req, res, next) {
  let statusCode = 500;
  let message = 'Something went wrong on the server. Please try again.';
  let details;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    details = err.details;
  } else if (err.type === 'entity.parse.failed') {
    statusCode = 400;
    message = 'The request body is not valid JSON.';
  } else if (err.type === 'entity.too.large') {
    statusCode = 413;
    message = 'The request body is too large.';
  } else if (typeof err.code === 'string' && err.code.startsWith('SQLITE_CONSTRAINT')) {
    // A database rule was broken. Validation should normally catch this first.
    statusCode = err.code === 'SQLITE_CONSTRAINT_UNIQUE' ? 409 : 400;
    message = 'The data conflicts with existing records or breaks a data rule.';
  }

  // Log unexpected errors for the developer, but never send internal
  if (statusCode === 500) {
    console.error(err);
  }

  const body = { success: false, error: { message } };
  if (details) body.error.details = details;
  res.status(statusCode).json(body);
}

module.exports = { notFound, errorHandler };
