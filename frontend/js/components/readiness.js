// Words for the backend's readiness statuses and areas. The status is always the backend's; the frontend never
// calculates readiness or a score.
import { h } from './dom.js';
import { statusLabel } from './alerts.js';

export const READINESS_STATUS = {
  not_started: {
    kind: 'info', label: 'Not started',
    explanation: 'No questions have been answered yet.',
  },
  in_progress: {
    kind: 'info', label: 'In progress',
    explanation: 'Some required questions are not answered yet, or the space check still needs the house measurements.',
  },
  not_ready: {
    kind: 'warning', label: 'Not ready yet',
    explanation: 'Something needed before the birds arrive is not in place yet: a required answer is "No" or "Partly", '
      + 'a required item is not available, or the house is too small or not built yet.',
  },
  ready: {
    kind: 'success', label: 'Ready',
    explanation: 'Everything this assessment checks before the birds arrive is in place.',
  },
};

export const AREA_LABELS = { housing: 'Housing', equipment: 'Equipment', feed: 'Feed', water: 'Water', other: 'Other' };
export const ANSWER_LABELS = { yes: 'Yes', partly: 'Partly', no: 'No' };

export const READINESS_DISCLAIMER = 'The readiness assessment helps you prepare. It does not guarantee good results, '
  + 'and it does not replace advice from a veterinarian or an extension officer.';

export function readinessStatusLabel(status) {
  const known = READINESS_STATUS[status];
  return statusLabel(known ? known.kind : 'info', known ? known.label : String(status));
}

export function readinessStatusBlock(status, { withExplanation = true } = {}) {
  const known = READINESS_STATUS[status];
  return h('div', { class: 'readiness-status' },
    h('p', {}, h('span', {}, 'Status: '), readinessStatusLabel(status)),
    withExplanation && known ? h('p', {}, known.explanation) : null);
}
