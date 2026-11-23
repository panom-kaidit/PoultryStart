// Shows the backend's space and bird-capacity check 
import { h } from './dom.js';
import { statusLabel } from './alerts.js';
import { formatArea, formatNumber } from '../utils/format.js';

const STATUS = {
  within_capacity: ['success', 'Within the recommended capacity'],
  above_capacity: ['warning', 'Above the recommended capacity'],
  incomplete: ['info', 'More information needed'],
  house_not_built: ['info', 'No poultry house yet'],
};

const MISSING_LABELS = {
  houseLengthM: 'House length',
  houseWidthM: 'House width',
  numberOfBirds: 'Number of birds you plan to keep',
};

const DENSITY_LABELS = { standard: 'Standard', conservative: 'Conservative (more space per bird)' };

function detail(label, value) {
  return value === null || value === undefined ? [] : [h('dt', {}, label), h('dd', {}, value)];
}

export function capacityPanel(capacity, { headingLevel = 'h2' } = {}) {
  if (!capacity) return null;
  const [kind, text] = STATUS[capacity.status] || ['info', capacity.status];
  return h('section', { class: 'card capacity', 'aria-label': 'Space and bird-capacity check' },
    h(headingLevel, {}, 'Space and bird-capacity check'),
    h('p', {}, statusLabel(kind, text)),
    capacity.message ? h('p', {}, capacity.message) : null,
    h('dl', { class: 'details' },
      detail('Birds you plan to keep', capacity.plannedBirds != null ? formatNumber(capacity.plannedBirds) : null),
      detail('Recommended capacity', capacity.recommendedCapacity != null ? `${formatNumber(capacity.recommendedCapacity)} birds` : null),
      detail('Usable floor area', capacity.space?.usableAreaM2 != null ? formatArea(capacity.space.usableAreaM2) : null),
      detail('Floor area needed', capacity.requiredAreaM2 != null ? formatArea(capacity.requiredAreaM2) : null),
      detail('Space standard used', capacity.densityMode
        ? `${DENSITY_LABELS[capacity.densityMode] || capacity.densityMode}${capacity.densityModeReason ? `. ${capacity.densityModeReason}` : ''}`
        : null)),
    capacity.missing?.length
      ? h('div', {}, h('h3', {}, 'Information still needed'),
        h('ul', { class: 'plain-list' }, capacity.missing.map((name) => h('li', {}, MISSING_LABELS[name] || name))))
      : null,
    capacity.guidance?.length
      ? h('div', {}, h('h3', {}, 'What you can do'),
        h('ul', { class: 'plain-list' }, capacity.guidance.map((line) => h('li', {}, line))))
      : null,
    capacity.researchLimitations?.length
      ? h('div', {}, h('h3', {}, 'Limitations'),
        h('ul', { class: 'plain-list' }, capacity.researchLimitations.map((line) => h('li', {}, line))))
      : null,
    capacity.disclaimer ? h('p', { class: 'small-print' }, capacity.disclaimer) : null);
}
