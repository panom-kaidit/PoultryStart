// Production record endpoints (weights, eggs, feed, water). View and create: every role. Correct: owner and
// manager. Nobody deletes. Without dates the backend lists the last 31 days (at most 366). Nothing here
// generates tasks.
import { get, post } from './client.js';

const flockBase = (farmId, flockId, path) =>
  `/farms/${encodeURIComponent(farmId)}/flocks/${encodeURIComponent(flockId)}/records/${encodeURIComponent(path)}`;

// Only the filters that are set, as a query string.
export function queryString(filters = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : '';
}

// Records of one type across the farm (or one flock). Here the type is 'weight', not the path 'weights'.
export function listFarmRecords(farmId, { type, flockId, from, to } = {}) {
  return get(`/farms/${encodeURIComponent(farmId)}/production-records${queryString({ type, flockId, from, to })}`);
}

export function getSummary(farmId, flockId, path, { from, to } = {}) {
  return get(`${flockBase(farmId, flockId, path)}/summary${queryString({ from, to })}`);
}

export function getRecord(farmId, flockId, path, recordId) {
  return get(`${flockBase(farmId, flockId, path)}/${encodeURIComponent(recordId)}`);
}

export function createRecord(farmId, flockId, path, body) {
  return post(flockBase(farmId, flockId, path), body);
}

// The changed fields + expectedVersion + reason.
export function correctRecord(farmId, flockId, path, recordId, body) {
  return post(`${flockBase(farmId, flockId, path)}/${encodeURIComponent(recordId)}/corrections`, body);
}
