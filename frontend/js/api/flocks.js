// Flock and bird-movement endpoints. 
import { get, post, patch, del } from './client.js';

const base = (farmId) => `/farms/${encodeURIComponent(farmId)}/flocks`;
const one = (farmId, flockId) => `${base(farmId)}/${encodeURIComponent(flockId)}`;

export function listFlocks(farmId) {
  return get(base(farmId));
}

export function createFlock(farmId, details) {
  return post(base(farmId), details);
}

export function getFlock(farmId, flockId) {
  return get(one(farmId, flockId));
}

// Descriptive fields, arrival corrections (with correctionReason) or milestones.
export function updateFlock(farmId, flockId, changes) {
  return patch(one(farmId, flockId), changes);
}

// closureReason: 'completed' | 'ended_early'.
export function closeFlock(farmId, flockId, details) {
  return post(`${one(farmId, flockId)}/close`, details);
}

// Owner only; refused (409) once the flock has history. -> { removedTasks }
export function deleteFlock(farmId, flockId) {
  return del(one(farmId, flockId));
}

export function listMovements(farmId, flockId) {
  return get(`${one(farmId, flockId)}/movements`);
}

// birdChange is signed. Corrections send correctsMovementId or replacesMovementId.
export function recordMovement(farmId, flockId, movement) {
  return post(`${one(farmId, flockId)}/movements`, movement);
}
