// Health observation endpoints.
import { get, post } from './client.js';
import { queryString } from './production.js';

const flockBase = (farmId, flockId) =>
  `/farms/${encodeURIComponent(farmId)}/flocks/${encodeURIComponent(flockId)}/records/health`;

export function listFarmObservations(farmId, { flockId, from, to } = {}) {
  return get(`/farms/${encodeURIComponent(farmId)}/health-observations${queryString({ flockId, from, to })}`);
}

export function listFlockObservations(farmId, flockId, { from, to } = {}) {
  return get(`${flockBase(farmId, flockId)}${queryString({ from, to })}`);
}

export function getObservation(farmId, flockId, observationId) {
  return get(`${flockBase(farmId, flockId)}/${encodeURIComponent(observationId)}`);
}

export function createObservation(farmId, flockId, body) {
  return post(flockBase(farmId, flockId), body);
}

// The changed fields + expectedVersion + reason.
export function correctObservation(farmId, flockId, observationId, body) {
  return post(`${flockBase(farmId, flockId)}/${encodeURIComponent(observationId)}/corrections`, body);
}
