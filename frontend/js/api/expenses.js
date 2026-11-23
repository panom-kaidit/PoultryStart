// Expense endpoints.
import { get, post } from './client.js';
import { queryString } from './production.js';

const base = (farmId) => `/farms/${encodeURIComponent(farmId)}/expenses`;

export function listExpenses(farmId, { from, to, category, flockId, includeVoided } = {}) {
  return get(`${base(farmId)}${queryString({ from, to, category, flockId, includeVoided })}`);
}

export function getExpenseSummary(farmId, { from, to, category, flockId } = {}) {
  return get(`${base(farmId)}/summary${queryString({ from, to, category, flockId })}`);
}

export function getExpense(farmId, expenseId) {
  return get(`${base(farmId)}/${encodeURIComponent(expenseId)}`);
}

export function createExpense(farmId, body) {
  return post(base(farmId), body);
}

// A correction ({ changed fields, expectedVersion, reason }) or a void ({ voided: true, expectedVersion, reason }).
export function correctExpense(farmId, expenseId, body) {
  return post(`${base(farmId)}/${encodeURIComponent(expenseId)}/corrections`, body);
}
