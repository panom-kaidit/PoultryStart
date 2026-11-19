// Handles expense business operations: recording, correcting, voiding and summarising.
const { runInImmediateTransaction } = require('../config/database');
const farmModel = require('../models/farmModel');
const flockModel = require('../models/flockModel');
const expenseModel = require('../models/expenseModel');
const AppError = require('../utils/AppError');
const { ugandaToday, addDays, daysBetween } = require('../utils/dates');
const { CATEGORIES, MAX_RANGE_DAYS, DEFAULT_RANGE_DAYS, SUMMARY_NOTE } = require('../data/expenses');

const CORRECTABLE = ['expenseDate', 'category', 'amount', 'description', 'flockId'];

const invalid = (field, message) => {
  throw new AppError(400, 'Some of the information provided is invalid.', [{ field, message }]);
};
const nowUtc = () => new Date().toISOString().replace('T', ' ').slice(0, 19);

function checkExpenseDate(date) {
  if (date > ugandaToday()) invalid('expenseDate', 'The expense date cannot be in the future.');
}

function checkFlock(farm, flockId) {
  if (flockId == null) return null;
  const flock = flockModel.findByIdForFarm(farm.id, flockId);
  if (!flock) throw new AppError(404, 'Flock not found.');
  return flock;
}

function getExpenseOrFail(farm, expenseId) {
  const expense = expenseModel.findForFarm(farm.id, expenseId);
  if (!expense) throw new AppError(404, 'Expense not found.');
  return expense;
}

const withHistory = (expense) => ({ ...expense, corrections: expenseModel.findCorrections(expense.id) });

function rangeOf(query) {
  const today = ugandaToday();
  let { from, to } = query;
  if (query.date) { from = query.date; to = query.date; }
  to = to || (from ? addDays(from, DEFAULT_RANGE_DAYS - 1) : today);
  from = from || addDays(to, -(DEFAULT_RANGE_DAYS - 1));
  if (to < from) invalid('to', '"to" cannot be before "from".');
  if (daysBetween(from, to) + 1 > MAX_RANGE_DAYS) invalid('to', `Choose a range of at most ${MAX_RANGE_DAYS} days.`);
  return { from, to };
}

function filtersOf(farm, query) {
  const filters = {};
  if (query.category) filters.category = query.category;
  if (query.flockId === 'none') filters.flockId = 'none';
  else if (query.flockId) filters.flockId = checkFlock(farm, Number(query.flockId)).id;
  return filters;
}

function monthsOf(from, to) {
  const months = [];
  let [year, month] = from.slice(0, 7).split('-').map(Number);
  const last = to.slice(0, 7);
  for (;;) {
    const key = `${year}-${String(month).padStart(2, '0')}`;
    months.push(key);
    if (key >= last) return months;
    month += 1;
    if (month === 13) { month = 1; year += 1; }
  }
}

function createExpense(farm, data, userId) {
  return runInImmediateTransaction(() => {
    checkExpenseDate(data.expenseDate);
    checkFlock(farm, data.flockId);
    const { currency } = farmModel.findById(farm.id);
    const expense = expenseModel.create({ farmId: farm.id, currency, createdBy: userId }, {
      expenseDate: data.expenseDate,
      category: data.category,
      amount: data.amount,
      description: data.description,
      flockId: data.flockId ?? null,
    });
    return withHistory(expense);
  });
}

function listExpenses(farm, query) {
  const range = rangeOf(query);
  const filters = filtersOf(farm, query);
  const includeVoided = query.includeVoided !== 'false';
  const expenses = expenseModel.list({ farmId: farm.id, ...range, ...filters, includeVoided });
  return { ...range, ...filters, includeVoided, expenses };
}

function getExpense(farm, expenseId) {
  return withHistory(getExpenseOrFail(farm, expenseId));
}

function correctExpense(farm, expenseId, data, userId) {
  return runInImmediateTransaction(() => {
    const current = getExpenseOrFail(farm, expenseId);
    if (current.version !== data.expectedVersion) {
      throw new AppError(409, `This expense was changed meanwhile (it is now version ${current.version}, you sent ` +
        `${data.expectedVersion}). Reload it and correct it again.`, [{ field: 'expectedVersion', message: `Current version: ${current.version}.` }]);
    }

    let values;
    let changes;
    if (data.voided === true) {
      if (current.voided) throw new AppError(409, 'This expense is already voided.');
      values = { voided: true, voidReason: data.reason, voidedBy: userId, voidedAt: nowUtc() };
      changes = { voided: { from: false, to: true } };
    } else {
      const sent = CORRECTABLE.filter((field) => data[field] !== undefined);
      if (current.voided && sent.some((field) => field !== 'flockId')) {
        throw new AppError(409, 'This expense was voided. Only its flock link can still be corrected; a voided expense ' +
          'cannot be un-voided or changed otherwise.');
      }
      values = Object.fromEntries(CORRECTABLE.map((field) => [field, data[field] !== undefined ? data[field] : current[field]]));
      checkExpenseDate(values.expenseDate);
      checkFlock(farm, values.flockId);
      changes = {};
      for (const field of CORRECTABLE) {
        const from = current[field] ?? null;
        const to = values[field] ?? null;
        if (from !== to) changes[field] = { from, to };
      }
      if (Object.keys(changes).length === 0) invalid('reason', 'The correction does not change anything.');
    }
    const corrected = expenseModel.applyCorrection(current, { values, changes, reason: data.reason, correctedBy: userId });
    return withHistory(corrected);
  });
}

function summary(farm, query) {
  const range = rangeOf(query);
  const filters = filtersOf(farm, query);
  const all = expenseModel.list({ farmId: farm.id, ...range, ...filters, includeVoided: true });
  const active = all.filter((e) => !e.voided);
  const months = monthsOf(range.from, range.to);

  const byCurrency = new Map();
  for (const e of active) {
    if (!byCurrency.has(e.currency)) byCurrency.set(e.currency, []);
    byCurrency.get(e.currency).push(e);
  }
  const totalOf = (list) => ({ total: list.reduce((sum, e) => sum + e.amount, 0), count: list.length });
  const currencies = [...byCurrency.keys()].sort().map((currency) => {
    const list = byCurrency.get(currency);
    const flocks = new Map();
    for (const e of list) {
      const key = e.flockId ?? 'none';
      if (!flocks.has(key)) flocks.set(key, { flockId: e.flockId, flockName: e.flockName, list: [] });
      flocks.get(key).list.push(e);
    }
    const byFlock = [...flocks.values()]
      .sort((a, b) => (a.flockId === null) - (b.flockId === null) || String(a.flockName).localeCompare(String(b.flockName)))
      .map(({ flockId, flockName, list: items }) => ({
        flockId, flockName, label: flockId === null ? 'Not linked to a flock' : flockName, ...totalOf(items),
      }));
    return {
      currency,
      ...totalOf(list),
      byCategory: Object.entries(CATEGORIES).map(([category, label]) => ({
        category, label, ...totalOf(list.filter((e) => e.category === category)),
      })),
      byMonth: months.map((month) => ({
        month,
        from: month === range.from.slice(0, 7) ? range.from : `${month}-01`,
        to: month === range.to.slice(0, 7) ? range.to : addDays(`${months[months.indexOf(month) + 1]}-01`, -1),
        ...totalOf(list.filter((e) => e.expenseDate.startsWith(month))),
      })),
      byFlock,
    };
  });
  return {
    ...range,
    ...filters,
    farmCurrency: farmModel.findById(farm.id).currency,
    note: SUMMARY_NOTE,
    voidedExcluded: all.length - active.length,
    currencies,
  };
}

module.exports = { createExpense, listExpenses, getExpense, correctExpense, summary };
