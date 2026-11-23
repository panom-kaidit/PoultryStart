// The farm form fields of Edit farm details: only fields the backend accepts (backend/src/validators/farmValidators.js).
import { h } from './dom.js';
import { inputField, selectField, radioField, setFieldVisible } from './forms.js';
import { EXPERIENCE_LABELS, MANAGEMENT_MODE_LABELS, HOUSE_STATUS_LABELS } from '../utils/format.js';

export const FARM_FIELD_LABELS = {
  name: 'Farm name', location: 'Location', poultryType: 'Poultry type', numberOfBirds: 'Number of birds',
  experienceLevel: 'Experience with poultry', farmSize: 'Farm size', managementMode: 'Who manages the farm',
  currency: 'Currency', startingStage: 'Age of the birds when they arrive', startingAgeWeeks: 'Age on arrival (weeks)',
  houseStatus: 'Poultry house', houseLengthM: 'House length', houseWidthM: 'House width',
  nonUsableAreaM2: 'Area not used by the birds', startAssessment: 'Readiness assessment',
};

const options = (labels) => Object.entries(labels).map(([value, label]) => ({ value, label }));


const OLDER_LAYER_STAGES = [
  { value: 'pullet', label: 'Pullets (growing birds, 7 to 14 weeks old)' },
  { value: 'point_of_lay', label: 'Point-of-lay pullets (15 to 20 weeks old)' },
];

export function farmFields({ mode = 'create' } = {}) {
  const editing = mode === 'edit';
  return [
    h('h2', { class: 'form-section-title' }, 'About the farm'),
    inputField({ name: 'name', label: 'Farm name', required: true, attrs: { maxlength: '100', autocomplete: 'off' } }),
    inputField({ name: 'location', label: 'Location', required: true, hint: 'For example: Mukono, Uganda.', attrs: { maxlength: '150' } }),
    radioField({
      name: 'poultryType', label: 'Poultry type', required: true,
      hint: editing ? 'The poultry type cannot change while the farm has active flocks of the other type.' : undefined,
      options: [{ value: 'broiler', label: 'Broilers (meat birds)' }, { value: 'layer', label: 'Layers (egg birds)' }],
    }),
    inputField({
      name: 'numberOfBirds', label: 'Number of birds you plan to keep', type: 'number', required: true,
      hint: 'A whole number. Use 0 if you have not decided yet.',
      attrs: { min: '0', max: '1000000', step: '1', inputmode: 'numeric' },
    }),
    selectField({ name: 'experienceLevel', label: 'Experience with poultry', required: true, placeholder: 'Choose…', options: options(EXPERIENCE_LABELS) }),
    inputField({
      name: 'farmSize', label: 'Farm size',
      hint: editing ? 'In your own words. Leave it empty to remove it.' : 'In your own words, for example "Half an acre".',
      attrs: { maxlength: '100' },
    }),
    editing
      ? selectField({ name: 'managementMode', label: 'Who manages the farm', required: true, options: options(MANAGEMENT_MODE_LABELS) })
      : selectField({ name: 'managementMode', label: 'Who manages the farm', placeholder: 'Not stated', options: options(MANAGEMENT_MODE_LABELS) }),
    editing
      ? inputField({
        name: 'currency', label: 'Currency', required: true,
        hint: 'A 3-letter code such as UGX. Expenses already recorded keep the currency they were recorded in.',
        attrs: { maxlength: '3', pattern: '[A-Za-z]{3}', autocomplete: 'off' },
      })
      : inputField({
        name: 'currency', label: 'Currency', hint: 'A 3-letter code. Leave it empty to use UGX (Uganda shillings).',
        attrs: { maxlength: '3', pattern: '[A-Za-z]{3}', autocomplete: 'off' },
      }),

    h('h2', { class: 'form-section-title', id: 'section-birds' }, 'Your birds (layers)'),
    selectField({
      name: 'startingStage', label: 'Age of the birds when they arrive', placeholder: 'Day-old chicks (usual)',
      options: OLDER_LAYER_STAGES,
      hint: 'Only for layers. These age ranges are PoultryStart planning definitions.',
    }),
    inputField({
      name: 'startingAgeWeeks', label: 'Age on arrival (weeks)', type: 'number', required: true,
      hint: 'The actual age of the birds, in whole weeks.',
      attrs: { min: '0', max: '100', step: '1', inputmode: 'numeric' },
    }),

    h('h2', { class: 'form-section-title' }, 'Poultry house'),
    selectField({ name: 'houseStatus', label: 'Poultry house', placeholder: 'Not stated', options: options(HOUSE_STATUS_LABELS) }),
    inputField({
      name: 'houseLengthM', label: 'House length (metres)', type: 'number', hint: 'Measure the inside of the house.',
      attrs: { min: '0.01', max: '500', step: '0.01', inputmode: 'decimal' },
    }),
    inputField({ name: 'houseWidthM', label: 'House width (metres)', type: 'number', attrs: { min: '0.01', max: '500', step: '0.01', inputmode: 'decimal' } }),
    inputField({
      name: 'nonUsableAreaM2', label: 'Area not used by the birds (m²)', type: 'number',
      hint: 'Stores, feed rooms or passages inside the house. Leave empty if there are none.',
      attrs: { min: '0', max: '250000', step: '0.01', inputmode: 'decimal' },
    }),
  ];
}

// Shows only the fields that apply: the starting stage for layers, the age for older layers, the house size
// unless there is no house yet.
export function updateVisibleFields(form) {
  const type = form.querySelector('input[name="poultryType"]:checked')?.value;
  form.querySelector('#section-birds').hidden = type !== 'layer';
  setFieldVisible(form, 'startingStage', type === 'layer');
  const stage = type === 'layer' ? form.elements.startingStage.value : '';
  setFieldVisible(form, 'startingAgeWeeks', stage === 'pullet' || stage === 'point_of_lay');
  const noHouse = form.elements.houseStatus.value === 'not_built';
  for (const name of ['houseLengthM', 'houseWidthM', 'nonUsableAreaM2']) setFieldVisible(form, name, !noHouse);
}
