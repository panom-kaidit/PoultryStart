// Backend endpoints for farms (/api/farms).
import { get, post, patch, del } from './client.js';

export function listFarms() {
  return get('/farms');
}

export function createFarm(details) {
  return post('/farms', details);
}

// A farm the user is not a member of is 404.
export function getFarm(farmId) {
  return get(`/farms/${encodeURIComponent(farmId)}`);
}

// Owner only; only the fields sent are changed.
export function updateFarm(farmId, changes) {
  return patch(`/farms/${encodeURIComponent(farmId)}`, changes);
}

// Owner only: deletes the farm and all its records.
export function deleteFarm(farmId) {
  return del(`/farms/${encodeURIComponent(farmId)}`);
}
