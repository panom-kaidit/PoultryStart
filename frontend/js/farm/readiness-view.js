// Readiness counts, gaps and wording from a saved assessment.
import { assessmentOutdated } from './setup-flow.js';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function readinessCount(detail) {
  const items = detail.resources.filter((r) => r.immediate);
  const questions = detail.questions.filter((q) => q.immediate);
  return {
    ready: items.filter((r) => r.isAvailable).length + questions.filter((q) => q.answer === 'yes').length,
    total: items.length + questions.length,
  };
}

export function readinessGaps(detail) {
  const { summary, capacity } = detail;
  const gaps = [];
  if (capacity && capacity.status !== 'within_capacity') {
    gaps.push({ kind: 'space', title: capacity.status === 'above_capacity' ? 'House size' : capacity.status === 'house_not_built' ? 'Poultry house' : 'House measurements' });
  }
  for (const item of summary.missingResources) gaps.push({ kind: 'resource', title: item.itemName });
  for (const q of summary.needsAttention) gaps.push({ kind: 'question', title: q.questionText, code: q.code });
  if (summary.unansweredRequired.length) gaps.push({ kind: 'unanswered', title: plural(summary.unansweredRequired.length, 'question') + ' not answered' });
  return gaps;
}

export function readinessStatusText(status, todo = 0) {
  switch (status) {
    case 'ready': return { title: 'Ready', text: 'Everything needed before your birds arrive is in place.' };
    case 'not_ready': return { title: 'Not ready yet', text: `${plural(todo, 'thing')} to sort out before your chicks arrive.` };
    case 'in_progress': return { title: 'Not finished', text: 'Some required questions are not answered yet, or the house needs measuring.' };
    default: return { title: 'Not started', text: 'Answer the questions on the checklist to see your results.' };
  }
}

export function ownerReadiness(detail, farm) {
  if (!detail) return { status: 'not_started', none: true };
  if (assessmentOutdated(detail.assessment, farm)) return { status: 'not_started', outdated: true };
  return { status: detail.summary.status, gaps: readinessGaps(detail), count: readinessCount(detail) };
}

export const READINESS_NOT_STARTED = { title: 'Readiness: not checked yet', text: 'See what to have ready before your birds arrive.', action: 'Start the readiness check' };
export const READINESS_OUTDATED = { title: 'Readiness: check your new birds', text: 'Your latest checklist was made for other birds.', action: 'Start a checklist for your birds' };
