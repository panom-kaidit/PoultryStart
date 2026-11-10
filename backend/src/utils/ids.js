// Reads an ID from the URL (e.g. /api/farms/3/members/7) and checks that it
// is a positive whole number. Returns the number, or throws 400.
const AppError = require('./AppError');

function parseId(value, label = 'ID') {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) {
    throw new AppError(400, `${label} must be a positive whole number.`);
  }
  return id;
}

module.exports = { parseId };
