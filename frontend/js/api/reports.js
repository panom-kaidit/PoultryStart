// Dashboard and report endpoints
import { get } from './client.js';
import { queryString } from './production.js';

const base = (farmId) => `/farms/${encodeURIComponent(farmId)}`;

export function getDashboard(farmId) {
  return get(`${base(farmId)}/dashboard`);
}

export function getFlockReport(farmId, flockId, { from, to } = {}) {
  return get(`${base(farmId)}/reports/flocks/${encodeURIComponent(flockId)}${queryString({ from, to })}`);
}

export function getMortalityReport(farmId, { from, to, flockId } = {}) {
  return get(`${base(farmId)}/reports/mortality${queryString({ from, to, flockId })}`);
}

export function getTaskReport(farmId, { from, to, flockId } = {}) {
  return get(`${base(farmId)}/reports/tasks${queryString({ from, to, flockId })}`);
}
