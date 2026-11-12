// Date-only helpers
const UGANDA_UTC_OFFSET_HOURS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

// Today's date.
function ugandaToday(now = new Date()) {
  return new Date(now.getTime() + UGANDA_UTC_OFFSET_HOURS * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// True for a real calendar date written as YYYY-MM-DD.
function isIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// Whole days from one date to a later one (negative if "to" is earlier).
function daysBetween(from, to) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

// The date a number of days after (or before, if negative) a date.
function addDays(date, days) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

module.exports = { ugandaToday, isIsoDate, daysBetween, addDays };
