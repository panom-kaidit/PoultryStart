// Shared pieces for the health observation screens.
import { h } from './dom.js';
import { alertBox, statusLabel } from './alerts.js';
import { inputField, textareaField, checkboxField } from './forms.js';
import { formatNumber } from '../utils/format.js';
import { formatDate, formatUtcAsUgandaDateTime } from '../utils/dates.js';

export const HEALTH_DISCLAIMER = 'PoultryStart only keeps your notes. It does not diagnose disease, recommend medicines or replace a '
  + 'veterinarian. If birds are sick or dying, or you suspect a serious disease, contact your veterinarian or extension '
  + 'officer straight away.';

export function disclaimerBox(text) {
  return h('div', { class: 'disclaimer' }, alertBox('warning', text || HEALTH_DISCLAIMER, { title: 'Important' }));
}

export const HEALTH_FIELD_LABELS = {
  observationDate: 'Date', observation: 'What you noticed', birdsAffected: 'Birds affected', actionTaken: 'What you did',
  vetContacted: 'Veterinarian contacted', extensionOfficerContacted: 'Extension officer contacted', flockId: 'Flock',
  reason: 'Reason for the correction', expectedVersion: 'Version',
};

const yesNo = (value) => (value ? 'Yes' : 'No');

export function contactLabels(observation) {
  return h('div', { class: 'tag-row' },
    statusLabel(observation.vetContacted ? 'success' : 'info', `Veterinarian contacted: ${yesNo(observation.vetContacted)}`),
    statusLabel(observation.extensionOfficerContacted ? 'success' : 'info',
      `Extension officer contacted: ${yesNo(observation.extensionOfficerContacted)}`));
}

export function birdsAffectedText(observation) {
  return observation.birdsAffected == null ? 'Not counted' : formatNumber(observation.birdsAffected);
}

// The backend's warning

export function populationWarning(observation) {
  if (!observation.exceedsPopulation) return null;
  return alertBox('warning', (observation.warnings || []).map((w) => w.message).join(' ')
    || `More birds affected than the ${observation.populationOnDate} birds the flock's records now show on that date.`,
  { title: 'Check this observation' });
}

export const observationHref = (farmId, observation) => `#/farms/${farmId}/health/flocks/${observation.flockId}/${observation.id}`;

export function observationItem(farmId, observation, flockName) {
  const text = String(observation.observation || '');
  const short = text.length > 160 ? `${text.slice(0, 160)}…` : text;
  return h('li', { class: 'card observation-card' },
    h('h3', {}, formatDate(observation.observationDate)),
    h('p', { class: 'farm-card__meta' }, 'Flock: ',
      h('a', { href: `#/farms/${farmId}/flocks/${observation.flockId}` }, flockName || 'Open the flock')),
    h('p', { class: 'user-text' }, short),
    h('dl', { class: 'details' },
      h('dt', {}, 'Birds affected'), h('dd', {}, birdsAffectedText(observation))),
    contactLabels(observation),
    observation.version > 1 ? h('p', {}, statusLabel('info', `Corrected (version ${observation.version})`)) : null,
    populationWarning(observation),
    h('p', { class: 'small-print' }, `Recorded by ${observation.createdByName || 'unknown'}, ${formatUtcAsUgandaDateTime(observation.createdAt)}`),
    h('a', { class: 'button button--secondary button--small', href: observationHref(farmId, observation),
      'aria-label': `Open the observation of ${formatDate(observation.observationDate)}${flockName ? `, ${flockName}` : ''}` }, 'Open the observation'));
}

// Free text only: no symptom lists, severity scores, diagnoses or treatment choices.
export function observationFields({ prefix }) {
  const id = (name) => `${prefix}-${name}`;
  return [
    textareaField({ name: 'observation', id: id('observation'), label: 'What you noticed', required: true, rows: 4, maxlength: 1000,
      hint: 'Describe in your own words what you saw, for example how the birds looked or behaved, their droppings, eating or drinking. '
        + 'Do not record deaths here: use the flock\'s "Record deaths" form.' }),
    inputField({ name: 'birdsAffected', id: id('birds'), label: 'Birds affected', type: 'number',
      hint: 'Only if you counted them. Leave it empty if you did not count.', attrs: { min: '1', step: '1', inputmode: 'numeric' } }),
    textareaField({ name: 'actionTaken', id: id('action'), label: 'What you did', rows: 2, maxlength: 1000,
      hint: 'For example: separated the birds, called the vet. PoultryStart gives no treatment advice.' }),
    checkboxField({ name: 'vetContacted', id: id('vet'), label: 'A veterinarian was contacted' }),
    checkboxField({ name: 'extensionOfficerContacted', id: id('extension'), label: 'An extension officer was contacted' }),
  ];
}

const text = (values, name) => (typeof values[name] === 'string' ? values[name].trim() : undefined);

// A new observation: birds affected and the action only when given (an empty count is "not counted", never zero).
export function createObservationBody(values) {
  const body = {
    observationDate: text(values, 'observationDate'),
    observation: text(values, 'observation'),
    vetContacted: values.vetContacted === true,
    extensionOfficerContacted: values.extensionOfficerContacted === true,
  };
  if (text(values, 'birdsAffected')) body.birdsAffected = Number(text(values, 'birdsAffected'));
  if (text(values, 'actionTaken')) body.actionTaken = text(values, 'actionTaken');
  return body;
}

export function formValuesOfObservation(observation) {
  return {
    observationDate: observation.observationDate,
    observation: observation.observation || '',
    birdsAffected: observation.birdsAffected == null ? '' : String(observation.birdsAffected),
    actionTaken: observation.actionTaken || '',
    vetContacted: Boolean(observation.vetContacted),
    extensionOfficerContacted: Boolean(observation.extensionOfficerContacted),
  };
}


export function correctionBodyOf(observation, values) {
  const start = formValuesOfObservation(observation);
  const body = {};
  if (text(values, 'observationDate') !== start.observationDate) body.observationDate = text(values, 'observationDate');
  if (text(values, 'observation') !== start.observation.trim()) body.observation = text(values, 'observation');
  if (text(values, 'birdsAffected') !== start.birdsAffected) body.birdsAffected = text(values, 'birdsAffected') ? Number(text(values, 'birdsAffected')) : null;
  if (text(values, 'actionTaken') !== start.actionTaken.trim()) body.actionTaken = text(values, 'actionTaken') || null;
  for (const name of ['vetContacted', 'extensionOfficerContacted']) {
    if (Boolean(values[name]) !== start[name]) body[name] = Boolean(values[name]);
  }
  if (Object.keys(body).length === 0) return { body: null };
  return { body: { ...body, expectedVersion: observation.version, reason: text(values, 'reason') } };
}

function describe(field, value) {
  if (value === null || value === undefined || value === '') return field === 'birdsAffected' ? 'not counted' : 'not given';
  if (typeof value === 'boolean') return yesNo(value);
  if (field === 'observationDate') return formatDate(value);
  return String(value);
}

export function healthCorrectionHistory(observation) {
  const corrections = observation.corrections || [];
  return h('section', { class: 'card', 'aria-labelledby': 'observation-history' },
    h('h2', { id: 'observation-history' }, `Correction history (${corrections.length})`),
    corrections.length === 0
      ? h('p', {}, 'This observation has not been corrected. It is shown as it was first saved.')
      : h('ul', { class: 'item-list' }, corrections.map((c) => h('li', { class: 'item' },
        h('p', { class: 'item__title' }, `Version ${c.versionFrom} → ${c.versionTo}`),
        h('ul', { class: 'plain-list' }, Object.entries(c.changes || {}).map(([field, change]) =>
          h('li', { class: 'user-text' }, `${HEALTH_FIELD_LABELS[field] || field}: ${describe(field, change.from)} → ${describe(field, change.to)}`))),
        h('p', { class: 'user-text' }, h('strong', {}, 'Reason: '), c.reason),
        h('p', { class: 'small-print' }, `By ${c.correctedByName || 'unknown'}, ${formatUtcAsUgandaDateTime(c.correctedAt)}`)))));
}

export function healthNav(farm, active) {
  const tab = (key, href, label) => h('li', {},
    h('a', { class: 'section-tab', href, 'aria-current': active === key ? 'page' : undefined }, label));
  return h('nav', { class: 'type-nav', 'aria-label': 'Health observation pages' },
    h('ul', { class: 'section-tabs' },
      tab('overview', `#/farms/${farm.id}/health`, 'Overview'),
      tab('all', `#/farms/${farm.id}/health/all`, 'All observations')));
}

// Breadcrumbs: [label, href] pairs, the last one is the current page.
export function healthBreadcrumbs(farm, ...trail) {
  const items = [['Health observations', `#/farms/${farm.id}/health`], ...trail];
  return h('nav', { class: 'breadcrumbs', 'aria-label': 'Breadcrumb' },
    h('ol', {}, items.map(([label, href], i) => (i === items.length - 1
      ? h('li', { 'aria-current': 'page' }, label)
      : h('li', {}, h('a', { href }, label))))));
}
