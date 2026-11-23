// Daily task endpoints.

import { get, post, patch } from './client.js';

const base = (farmId) => `/farms/${encodeURIComponent(farmId)}/tasks`;
const one = (farmId, taskId) => `${base(farmId)}/${encodeURIComponent(taskId)}`;

export function listTasks(farmId) {
  return get(base(farmId));
}

export function getTask(farmId, taskId) {
  return get(one(farmId, taskId));
}

export function createTask(farmId, details) {
  return post(base(farmId), details);
}

export function updateTask(farmId, taskId, changes) {
  return patch(one(farmId, taskId), changes);
}

export function cancelTask(farmId, taskId, reason) {
  return post(`${one(farmId, taskId)}/cancel`, { reason });
}

export function completeTask(farmId, taskId, { notes, problemReported }) {
  const body = { problemReported: problemReported === true };
  if (notes) body.notes = notes;
  return post(`${one(farmId, taskId)}/complete`, body);
}

export function reopenTask(farmId, taskId, reason) {
  return post(`${one(farmId, taskId)}/reopen`, { reason });
}

export function addReviewNote(farmId, taskId, note) {
  return post(`${one(farmId, taskId)}/notes`, { note });
}
