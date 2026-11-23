// Shared pieces for the flock screens.
import { h } from './dom.js';
import { statusLabel } from './alerts.js';
import { formatArea, formatNumber } from '../utils/format.js';

export const MOVEMENT_LABELS = {
  received: 'Birds received on arrival',
  additional_received: 'Additional birds received',
  mortality: 'Deaths',
  culled: 'Culled',
  sold: 'Sold',
  transferred_out: 'Transferred out',
  correction: 'Correction',
};


const DIRECTION = { received: 1, additional_received: 1, mortality: -1, culled: -1, sold: -1, transferred_out: -1 };


export const OTHER_MOVEMENT_TYPES = ['additional_received', 'culled', 'sold', 'transferred_out'];

export const CLOSURE_REASON_LABELS = {
  completed: 'Completed: the flock finished (for example, all birds sold)',
  ended_early: 'Ended early',
};

export function signedChange(movementType, birds) {
  return (DIRECTION[movementType] || 1) * Math.abs(Number(birds));
}

// "+20 birds" / "−5 birds" (with a real minus sign for readability).
export function formatChange(change) {
  const n = Number(change);
  const sign = n > 0 ? '+' : (n < 0 ? '−' : '');
  return `${sign}${formatNumber(Math.abs(n))} bird${Math.abs(n) === 1 ? '' : 's'}`;
}

export function correctionAmountFor(original, birds) {
  return signedChange(original.movementType, birds) - original.birdChange;
}

const CAPACITY_STATUS = {
  within_capacity: ['success', 'Within the recommended capacity'],
  above_capacity: ['warning', 'Above the recommended capacity'],
  incomplete: ['info', 'The space could not be checked'],
  house_not_built: ['info', 'No poultry house in the farm profile'],
};

const row = (label, value) => (value === null || value === undefined ? [] : [h('dt', {}, label), h('dd', {}, value)]);

// The backend's space check for a flock (on arrival, or after adding birds).
export function flockCapacityPanel(check, { title = 'Space check' } = {}) {
  if (!check) return null;
  const [kind, text] = CAPACITY_STATUS[check.status] || ['info', check.status];
  return h('section', { class: 'card', 'aria-label': title },
    h('h2', {}, title),
    h('p', {}, statusLabel(kind, text)),
    check.message ? h('p', {}, check.message) : null,
    h('dl', { class: 'details' },
      row('Birds in this flock', check.birds ? formatNumber(check.birds.thisFlock) : null),
      row('Birds in other active flocks', check.birds && check.birds.otherActiveFlocks ? formatNumber(check.birds.otherActiveFlocks) : null),
      row('Recommended capacity', check.recommendedCapacity != null ? `${formatNumber(check.recommendedCapacity)} birds` : null),
      row('Usable floor area', check.usableAreaM2 != null ? formatArea(check.usableAreaM2) : null),
      row('Floor area needed', check.requiredAreaM2 != null ? formatArea(check.requiredAreaM2) : null)),
    check.guidance?.length ? h('ul', { class: 'plain-list' }, check.guidance.map((line) => h('li', {}, line))) : null,
    check.sharedHouse?.note ? h('p', { class: 'small-print' }, check.sharedHouse.note) : null,
    check.disclaimer ? h('p', { class: 'small-print' }, check.disclaimer) : null);
}

