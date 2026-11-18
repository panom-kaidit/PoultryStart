// Handles HTTP requests for expenses: /api/farms/:farmId/expenses (owner only).
const service = require('../services/expenseService');
const { sendSuccess } = require('../utils/response');
const { parseId } = require('../utils/ids');

const expenseIdOf = (req) => parseId(req.params.expenseId, 'Expense ID');

function create(req, res) {
  const expense = service.createExpense(req.farm, req.validated, req.user.id);
  sendSuccess(res, 201, { expense }, 'Expense saved.');
}

function list(req, res) {
  sendSuccess(res, 200, service.listExpenses(req.farm, req.query));
}

function summary(req, res) {
  sendSuccess(res, 200, { summary: service.summary(req.farm, req.query) });
}

function get(req, res) {
  sendSuccess(res, 200, { expense: service.getExpense(req.farm, expenseIdOf(req)) });
}

function correct(req, res) {
  const expense = service.correctExpense(req.farm, expenseIdOf(req), req.validated, req.user.id);
  sendSuccess(res, 200, { expense }, expense.voided && req.validated.voided === true
    ? 'Expense voided. It is kept with its history and no longer counted in totals.'
    : 'Expense corrected. The earlier values are kept in its correction history.');
}

module.exports = { create, list, summary, get, correct };
