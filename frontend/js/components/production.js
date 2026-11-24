// Production record types, display, form fields and request bodies.
import { h } from './dom.js';
import { alertBox, statusLabel } from './alerts.js';
import { inputField, selectField, radioField, textareaField } from './forms.js';
import { formatNumber } from '../utils/format.js';
import { formatDate, formatUtcAsUgandaDateTime } from '../utils/dates.js';

export const RECORD_TYPES = {
  weights: { path: 'weights', type: 'weight', label: 'Bird weights', one: 'weight record', add: 'Add a weight record', layersOnly: false,
    intro: 'Weigh some birds and record their weights, one by one or as a sample with its average.' },
  eggs: { path: 'eggs', type: 'eggs', label: 'Egg collections', one: 'egg collection record', add: 'Add an egg collection record', layersOnly: true,
    intro: 'Eggs collected from a layer flock, by collection time and kind of egg.' },
  feed: { path: 'feed', type: 'feed', label: 'Feed consumption', one: 'feed record', add: 'Add a feed record', layersOnly: false,
    intro: 'The feed a flock ate in one day.' },
  water: { path: 'water', type: 'water', label: 'Drinking water', one: 'drinking-water record', add: 'Add a drinking-water record', layersOnly: false,
    intro: 'The drinking water a flock used in one day (not water for cleaning or other uses).' },
};
export const TYPE_ORDER = ['weights', 'eggs', 'feed', 'water'];

export const FEED_STAGES = {
  broiler: ['unknown', 'starter', 'grower', 'finisher', 'other'],
  layer: ['unknown', 'starter', 'grower', 'pre_lay', 'layer', 'other'],
};
export const FEED_STAGE_LABELS = {
  unknown: 'Not known', starter: 'Starter (chick) feed', grower: 'Grower feed', finisher: 'Finisher feed',
  pre_lay: 'Pre-lay feed', layer: 'Layer feed', other: 'Other feed',
};
export const COLLECTION_PERIODS = { morning: 'Morning', midday: 'Midday', evening: 'Evening', extra: 'Extra collection' };
export const EGG_CATEGORIES = {
  goodEggs: 'Good eggs (clean, whole, from the nests)',
  secondGradeEggs: 'Second-grade eggs (cracked, dirty or misshapen, from the nests)',
  floorEggs: 'Floor eggs (laid outside the nests)',
};
export const METHOD_LABELS = { measured: 'Measured', estimated: 'Estimated', mixed: 'Measured and estimated' };
const WEIGHT_METHOD_LABELS = { individual: 'Each bird weighed (individual weights)', aggregate: 'A sample with its average weight' };

export const FIELD_LABELS = {
  recordDate: 'Date', notes: 'Notes', weights: 'Weights of the birds', sampleSize: 'Number of birds weighed',
  averageWeight: 'Average weight', averageWeightG: 'Average weight (g)', minWeightG: 'Lightest (g)', maxWeightG: 'Heaviest (g)',
  sampleWeightsG: 'Weights (g)', method: 'How the birds were weighed', unit: 'Unit', enteredUnit: 'Unit typed',
  enteredWeights: 'Weights as typed', enteredAverageWeight: 'Average as typed', collectionPeriod: 'Collection time',
  goodEggs: 'Good eggs', secondGradeEggs: 'Second-grade eggs', floorEggs: 'Floor eggs', feedStage: 'Feed stage',
  quantity: 'Quantity', quantityKg: 'Quantity (kg)', quantityLitres: 'Quantity (litres)', enteredQuantity: 'Quantity as typed',
  measurementMethod: 'Measured or estimated', flockId: 'Flock', reason: 'Reason for the correction', expectedVersion: 'Version',
};

const num = (value, unit) => (value === null || value === undefined ? 'Not given' : `${formatNumber(value)}${unit ? ` ${unit}` : ''}`);
const row = (label, value) => (value === null || value === undefined || value === '' ? null : [h('dt', {}, label), h('dd', {}, value)]);

export function recordFacts(path, record, { full = false } = {}) {
  if (path === 'weights') {
    return [
      row('Birds weighed', formatNumber(record.sampleSize)),
      row('Average weight', `${num(record.averageWeightG, 'g')}${record.averageWeightKg != null ? ` (${formatNumber(record.averageWeightKg)} kg)` : ''}`),
      record.minWeightG != null ? row('Lightest and heaviest', `${num(record.minWeightG, 'g')} – ${num(record.maxWeightG, 'g')}`) : null,
      row('How', WEIGHT_METHOD_LABELS[record.method] || record.method),
      full && record.ageWeeks != null ? row('Age of the birds', `${record.ageWeeks} week${record.ageWeeks === 1 ? '' : 's'}`) : null,
      full && record.enteredUnit ? row('As typed', record.method === 'individual' && record.enteredWeights
        ? `${record.enteredWeights.join(', ')} ${record.enteredUnit}` : `${record.enteredAverageWeight ?? ''} ${record.enteredUnit} (average)`) : null,
      full && record.sampleWeightsG ? row('Weights (g)', record.sampleWeightsG.map((w) => formatNumber(w)).join(', ')) : null,
    ];
  }
  if (path === 'eggs') {
    return [
      row('Collection time', COLLECTION_PERIODS[record.collectionPeriod] || record.collectionPeriod),
      row('Good eggs', formatNumber(record.goodEggs)),
      row('Second-grade eggs', formatNumber(record.secondGradeEggs)),
      row('Floor eggs', formatNumber(record.floorEggs)),
      row('Total', formatNumber(record.totalEggs)),
    ];
  }
  const isFeed = path === 'feed';
  return [
    row('Quantity', isFeed ? num(record.quantityKg, 'kg') : num(record.quantityLitres, 'L')),
    isFeed ? row('Feed stage', FEED_STAGE_LABELS[record.feedStage] || record.feedStage) : null,
    row('Measured or estimated', METHOD_LABELS[record.measurementMethod] || record.measurementMethod),
    full && record.enteredUnit ? row('As typed', `${record.enteredQuantity} ${record.enteredUnit}`) : null,
  ];
}

export function populationWarning(record) {
  if (!record.exceedsPopulation) return null;
  return alertBox('warning', (record.warnings || []).map((w) => w.message).join(' ')
    || `This record counts more birds than the ${record.populationOnDate} the flock's records now show on its date.`,
  { title: 'Check this record' });
}

export function versionNote(record) {
  return record.version > 1 ? statusLabel('info', `Corrected (version ${record.version})`) : null;
}

function describe(value) {
  if (value === null || value === undefined || value === '') return 'not given';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'number') return formatNumber(value);
  return String(value);
}

export function correctionHistory(record) {
  const corrections = record.corrections || [];
  return h('section', { class: 'card', 'aria-labelledby': 'record-history' },
    h('h2', { id: 'record-history' }, `Correction history (${corrections.length})`),
    corrections.length === 0
      ? h('p', {}, 'This record has not been corrected. It is shown as it was first saved.')
      : h('ul', { class: 'item-list' }, corrections.map((c) => h('li', { class: 'item' },
        h('p', { class: 'item__title' }, `Version ${c.versionFrom} → ${c.versionTo}`),
        h('ul', { class: 'plain-list' }, Object.entries(c.changes || {}).map(([field, change]) =>
          h('li', {}, `${FIELD_LABELS[field] || field}: ${describe(change.from)} → ${describe(change.to)}`))),
        h('p', { class: 'user-text' }, h('strong', {}, 'Reason: '), c.reason),
        h('p', { class: 'small-print' }, `By ${c.correctedByName || 'unknown'}, ${formatUtcAsUgandaDateTime(c.correctedAt)}`)))));
}

export const recordHref = (farmId, path, record) => `#/farms/${farmId}/records/${path}/${record.flockId}/${record.id}`;

export function recordDateText(record) {
  return formatDate(record.recordDate);
}

export function parseWeights(text) {
  const parts = String(text || '').split(/[\s,;]+/).filter(Boolean);
  if (parts.length === 0) return { error: 'Type the weight of each bird weighed.' };
  const bad = parts.filter((p) => !/^\d+(\.\d+)?$/.test(p) || Number(p) <= 0);
  if (bad.length) return { error: `These are not weights: ${bad.join(', ')}. Use numbers only, separated by spaces or commas.` };
  return { weights: parts.map(Number) };
}

export function typeFields(path, { poultryType, prefix, isCorrection = false }) {
  const id = (name) => `${prefix}-${name}`;
  if (path === 'weights') {
    return [
      radioField({ name: 'weightMode', label: 'How were the birds weighed?', required: true, value: 'individual',
        options: [{ value: 'individual', label: 'Each bird weighed: I have the weight of every bird' },
          { value: 'aggregate', label: 'A sample: I have the number of birds and their average weight' }] }),
      radioField({ name: 'unit', label: 'Unit', required: true, value: 'g',
        options: [{ value: 'g', label: 'Grams (g)' }, { value: 'kg', label: 'Kilograms (kg)' }] }),
      textareaField({ name: 'weights', id: id('weights'), label: 'Weight of each bird', required: true, rows: 3,
        hint: 'One number per bird, separated by spaces, commas or new lines. For example: 950 1010 980' }),
      h('p', { class: 'small-print', id: id('weights-count'), 'aria-live': 'polite' }),
      inputField({ name: 'sampleSize', id: id('sample'), label: 'Number of birds weighed', type: 'number', required: true,
        attrs: { min: '1', step: '1', inputmode: 'numeric' } }),
      inputField({ name: 'averageWeight', id: id('average'), label: 'Average weight', type: 'number', required: true,
        attrs: { min: '0', step: 'any', inputmode: 'decimal' } }),
    ];
  }
  if (path === 'eggs') {
    return [
      selectField({ name: 'collectionPeriod', id: id('period'), label: 'Collection time', required: !isCorrection,
        placeholder: isCorrection ? undefined : 'Choose…', options: Object.entries(COLLECTION_PERIODS).map(([value, label]) => ({ value, label })) }),
      ...Object.entries(EGG_CATEGORIES).map(([name, label]) => inputField({ name, id: id(name), label, type: 'number',
        hint: name === 'goodEggs' ? 'Leave a number empty if there were none of that kind.' : undefined,
        attrs: { min: '0', step: '1', inputmode: 'numeric' } })),
    ];
  }
  const isFeed = path === 'feed';
  return [
    isFeed ? selectField({ name: 'feedStage', id: id('stage'), label: 'Feed stage',
      options: (FEED_STAGES[poultryType] || FEED_STAGES.broiler).map((value) => ({ value, label: FEED_STAGE_LABELS[value] || value })),
      hint: 'A day has either ONE record with "Not known", or one record per named stage, so the same feed is never counted twice.' }) : null,
    inputField({ name: 'quantity', id: id('quantity'), label: isFeed ? 'Feed eaten' : 'Drinking water used', type: 'number', required: !isCorrection,
      attrs: { min: '0', step: 'any', inputmode: 'decimal' } }),
    radioField({ name: 'unit', label: 'Unit', required: true, value: isFeed ? 'kg' : 'L',
      options: isFeed ? [{ value: 'kg', label: 'Kilograms (kg)' }, { value: 'g', label: 'Grams (g)' }]
        : [{ value: 'L', label: 'Litres (L)' }, { value: 'ml', label: 'Millilitres (ml)' }] }),
    radioField({ name: 'measurementMethod', label: 'Was it measured or estimated?', required: true,
      options: [{ value: 'measured', label: 'Measured (weighed or measured)' }, { value: 'estimated', label: 'Estimated (a guess)' }] }),
  ];
}

export function updateWeightFields(form, setFieldVisible, prefix) {
  if (!form.querySelector('input[name="weightMode"]')) return;
  const mode = form.querySelector('input[name="weightMode"]:checked')?.value || 'individual';
  setFieldVisible(form, 'weights', mode === 'individual');
  setFieldVisible(form, 'sampleSize', mode === 'aggregate');
  setFieldVisible(form, 'averageWeight', mode === 'aggregate');
  const counter = form.querySelector(`#${prefix}-weights-count`);
  if (counter) {
    const parsed = parseWeights(form.elements.weights?.value);
    counter.textContent = mode === 'individual' && parsed.weights ? `${parsed.weights.length} bird weight${parsed.weights.length === 1 ? '' : 's'} typed.` : '';
  }
}

const text = (values, name) => (typeof values[name] === 'string' ? values[name].trim() : undefined);
const numberOf = (values, name) => (text(values, name) ? Number(text(values, name)) : undefined);

export function createBody(path, values) {
  const body = { recordDate: text(values, 'recordDate') };
  const notes = text(values, 'notes');
  if (notes) body.notes = notes;
  if (path === 'weights') {
    body.unit = values.unit || 'g';
    if ((values.weightMode || 'individual') === 'individual') {
      const parsed = parseWeights(values.weights);
      if (parsed.error) return { errors: [{ field: 'weights', message: parsed.error }] };
      body.weights = parsed.weights;
    } else {
      body.sampleSize = numberOf(values, 'sampleSize');
      body.averageWeight = numberOf(values, 'averageWeight');
    }
    return { body };
  }
  if (path === 'eggs') {
    body.collectionPeriod = values.collectionPeriod;
    for (const name of Object.keys(EGG_CATEGORIES)) if (numberOf(values, name) !== undefined) body[name] = numberOf(values, name);
    return { body };
  }
  if (path === 'feed' && values.feedStage) body.feedStage = values.feedStage;
  body.quantity = numberOf(values, 'quantity');
  body.unit = values.unit;
  body.measurementMethod = values.measurementMethod;
  return { body };
}

export function formValuesOf(path, record) {
  const base = { recordDate: record.recordDate, notes: record.notes || '' };
  if (path === 'weights') {
    const unit = record.enteredUnit || 'g';
    return {
      ...base,
      weightMode: record.method,
      unit,
      weights: record.method === 'individual' ? (record.enteredWeights || record.sampleWeightsG || []).join(' ') : '',
      sampleSize: record.method === 'aggregate' ? String(record.sampleSize) : '',
      averageWeight: record.method === 'aggregate' ? String(record.enteredAverageWeight ?? record.averageWeightG) : '',
    };
  }
  if (path === 'eggs') {
    return { ...base, collectionPeriod: record.collectionPeriod,
      goodEggs: String(record.goodEggs), secondGradeEggs: String(record.secondGradeEggs), floorEggs: String(record.floorEggs) };
  }
  const extra = path === 'feed' ? { feedStage: record.feedStage } : {};
  return { ...base, ...extra, quantity: String(record.enteredQuantity ?? (path === 'feed' ? record.quantityKg : record.quantityLitres)),
    unit: record.enteredUnit || (path === 'feed' ? 'kg' : 'L'), measurementMethod: record.measurementMethod };
}

export function correctionBody(path, record, values) {
  const start = formValuesOf(path, record);
  const changed = (name) => (values[name] ?? '') !== (start[name] ?? '');
  const body = {};
  if (changed('recordDate')) body.recordDate = text(values, 'recordDate');
  if (changed('notes')) body.notes = text(values, 'notes') === '' ? null : text(values, 'notes');
  if (path === 'weights') {
    const mode = values.weightMode || start.weightMode;
    if (mode === 'individual' && (changed('weightMode') || changed('unit') || changed('weights'))) {
      const parsed = parseWeights(values.weights);
      if (parsed.error) return { errors: [{ field: 'weights', message: parsed.error }] };
      Object.assign(body, { weights: parsed.weights, unit: values.unit });
    }
    if (mode === 'aggregate' && (changed('weightMode') || changed('unit') || changed('sampleSize') || changed('averageWeight'))) {
      Object.assign(body, { sampleSize: numberOf(values, 'sampleSize'), averageWeight: numberOf(values, 'averageWeight'), unit: values.unit });
    }
  } else if (path === 'eggs') {
    if (changed('collectionPeriod')) body.collectionPeriod = values.collectionPeriod;
    for (const name of Object.keys(EGG_CATEGORIES)) if (changed(name)) body[name] = numberOf(values, name) ?? 0;
  } else {
    if (path === 'feed' && changed('feedStage')) body.feedStage = values.feedStage;
    if (changed('quantity') || changed('unit')) Object.assign(body, { quantity: numberOf(values, 'quantity'), unit: values.unit });
    if (changed('measurementMethod')) body.measurementMethod = values.measurementMethod;
  }
  if (Object.keys(body).length === 0) return { body: null };
  return { body: { ...body, expectedVersion: record.version, reason: text(values, 'reason') } };
}
