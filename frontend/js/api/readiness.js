// Readiness assessment endpoints
import { get, post, patch } from './client.js';

const base = (farmId) => `/farms/${encodeURIComponent(farmId)}/readiness`;
const one = (farmId, assessmentId) => `${base(farmId)}/${encodeURIComponent(assessmentId)}`;

export function listAssessments(farmId) {
  return get(base(farmId));
}

// Starts a NEW assessment (earlier ones are kept).
export function startAssessment(farmId) {
  return post(base(farmId));
}

export function getAssessment(farmId, assessmentId) {
  return get(one(farmId, assessmentId));
}

// responses: [{ questionId, answer: 'yes' | 'no' | 'partly', notes? }] (1 to 50)
export function saveResponses(farmId, assessmentId, responses) {
  return patch(`${one(farmId, assessmentId)}/responses`, { responses });
}

// The owner's own checklist item.
export function addResource(farmId, assessmentId, item) {
  return post(`${one(farmId, assessmentId)}/resources`, item);
}

// Default items: only isAvailable and notes can change.
export function updateResource(farmId, assessmentId, itemId, changes) {
  return patch(`${one(farmId, assessmentId)}/resources/${encodeURIComponent(itemId)}`, changes);
}
