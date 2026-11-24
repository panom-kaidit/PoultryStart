// The page for recording a new flock.
import { h, pageHeading, setContent } from '../components/dom.js';
import { alertBox } from '../components/alerts.js';
import {
  inputField, selectField, textareaField, setFieldVisible, guardSubmit, showErrors, clearErrors,
  formValues, fillForm, saveDraft, takeDraft,
} from '../components/forms.js';
import { flockCapacityPanel } from '../components/flocks.js';
import { createFlock } from '../api/flocks.js';
import { POULTRY_TYPE_LABELS, labelFor } from '../utils/format.js';
import { ugandaToday } from '../utils/dates.js';

export const FLOCK_FIELD_LABELS = {
  name: 'Flock name', poultryType: 'Poultry type', arrivalDate: 'Arrival date', birdsReceived: 'Birds received',
  startingStage: 'Age of the birds when they arrived', ageAtArrivalWeeks: 'Age on arrival (weeks)',
  breedStrain: 'Breed or strain', supplier: 'Supplier or hatchery', malesReceived: 'Males received',
  femalesReceived: 'Females received', vaccinationNotes: 'Vaccination notes', notes: 'Notes',
};

const LAYER_STAGES = [
  { value: 'pullet', label: 'Pullets (growing birds, 7 to 14 weeks old)' },
  { value: 'point_of_lay', label: 'Point-of-lay pullets (15 to 20 weeks old)' },
];

export function flockRequestBody(values, poultryType) {
  const text = (name) => (typeof values[name] === 'string' ? values[name].trim() : '');
  const body = {
    poultryType,
    arrivalDate: text('arrivalDate'),
    birdsReceived: Number(text('birdsReceived')),
  };
  for (const name of ['name', 'breedStrain', 'supplier', 'vaccinationNotes', 'notes']) if (text(name)) body[name] = text(name);
  if (poultryType === 'layer' && text('startingStage')) {
    body.startingStage = text('startingStage');
    if (text('ageAtArrivalWeeks')) body.ageAtArrivalWeeks = Number(text('ageAtArrivalWeeks'));
  }
  for (const name of ['malesReceived', 'femalesReceived']) if (text(name)) body[name] = Number(text(name));
  return body;
}

function resultView(farm, data, message) {
  const { flock, capacityCheck, planComparison, warnings } = data;
  return h('div', {},
    alertBox('success', message || 'Flock recorded.', { title: 'Flock recorded' }),
    warnings?.length ? alertBox('warning', 'Please read:', { title: 'Warnings', items: warnings.map((w) => w.message) }) : null,
    h('section', { class: 'card', 'aria-labelledby': 'new-flock' },
      h('h2', { id: 'new-flock' }, flock.name),
      h('dl', { class: 'details' },
        h('dt', {}, 'Birds received'), h('dd', {}, String(flock.birdsReceived)),
        h('dt', {}, 'Birds alive now'), h('dd', {}, String(flock.liveBirds))),
      planComparison?.message ? h('p', {}, `Compared with the farm plan: ${planComparison.message}`) : null),
    flockCapacityPanel(capacityCheck, { title: 'Space check on arrival' }),
    h('div', { class: 'button-row' },
      h('a', { class: 'button', href: `#/farms/${farm.id}/flocks/${flock.id}` }, 'Open the flock'),
      h('a', { class: 'button button--secondary', href: `#/farms/${farm.id}/flocks` }, 'All flocks')));
}

export function createFlockPage({ user, farmContext }) {
  const { farm } = farmContext;
  const draftId = `create-flock-${farm.id}`;
  const today = ugandaToday();
  const isLayer = farm.poultryType === 'layer';
  const summary = h('div', { 'aria-live': 'polite' });
  const container = h('div', {});

  const form = h('form', { class: 'form' },
    h('p', {}, h('strong', {}, 'Poultry type: '), labelFor(POULTRY_TYPE_LABELS, farm.poultryType),
      h('span', { class: 'small-print' }, ' (the farm\'s type)')),
    inputField({ name: 'name', label: 'Flock name', hint: 'For example "Batch 1". Leave it empty and PoultryStart names it for you.', attrs: { maxlength: '100' } }),
    inputField({ name: 'arrivalDate', label: 'Arrival date', type: 'date', required: true, value: today,
      hint: 'The day the birds arrived. It cannot be in the future.', attrs: { max: today } }),
    inputField({ name: 'birdsReceived', label: 'Birds received', type: 'number', required: true,
      hint: 'The actual number of birds that arrived (alive).', attrs: { min: '1', max: '1000000', step: '1', inputmode: 'numeric' } }),
    isLayer ? selectField({ name: 'startingStage', label: 'Age of the birds when they arrived', placeholder: 'Day-old chicks (usual)',
      options: LAYER_STAGES, hint: 'These age ranges are PoultryStart planning definitions.' }) : null,
    isLayer ? inputField({ name: 'ageAtArrivalWeeks', label: 'Age on arrival (weeks)', type: 'number', required: true,
      attrs: { min: '0', max: '100', step: '1', inputmode: 'numeric' } }) : null,
    h('h2', { class: 'form-section-title' }, 'More details (optional)'),
    inputField({ name: 'breedStrain', label: 'Breed or strain', attrs: { maxlength: '100' } }),
    inputField({ name: 'supplier', label: 'Supplier or hatchery', attrs: { maxlength: '150' } }),
    inputField({ name: 'malesReceived', label: 'Males received', type: 'number', attrs: { min: '0', max: '1000000', step: '1', inputmode: 'numeric' } }),
    inputField({ name: 'femalesReceived', label: 'Females received', type: 'number', attrs: { min: '0', max: '1000000', step: '1', inputmode: 'numeric' } }),
    textareaField({ name: 'vaccinationNotes', label: 'Vaccination notes',
      hint: 'What the supplier or your veterinarian told you. PoultryStart does not give vaccination schedules.', maxlength: 1000 }),
    textareaField({ name: 'notes', label: 'Notes', maxlength: 1000 }),
    h('div', { class: 'button-row' },
      h('button', { type: 'submit', class: 'button' }, 'Record the flock'),
      h('a', { class: 'button button--secondary', href: `#/farms/${farm.id}/flocks` }, 'Cancel')));

  const updateFields = () => {
    if (!isLayer) return;
    const stage = form.elements.startingStage.value;
    setFieldVisible(form, 'ageAtArrivalWeeks', stage === 'pullet' || stage === 'point_of_lay');
  };
  form.addEventListener('change', updateFields);
  updateFields();

  let restored = null;
  const draft = takeDraft(draftId, user.id);
  if (draft) {
    fillForm(form, draft);
    updateFields();
    restored = alertBox('info', 'We kept what you had entered before your session expired. Check it, then select "Record the flock" again. Nothing was saved yet.');
  }

  guardSubmit(form, async () => {
    clearErrors(form, summary);
    const values = formValues(form);
    try {
      const { data, message } = await createFlock(farm.id, flockRequestBody(values, farm.poultryType));
      setContent(container, resultView(farm, data, message));
      container.querySelector('.alert')?.focus();
    } catch (error) {
      if (error.status === 401) {
        saveDraft(draftId, user.id, values);
        return;
      }
      showErrors(form, error, summary, FLOCK_FIELD_LABELS);
    }
  }, { busyText: 'Recording…' });

  setContent(container,
    h('p', { class: 'page-intro' }, 'Record the flock on the day the birds arrive. The number received becomes the first entry of the flock\'s history.'),
    restored, summary, h('div', { class: 'card' }, form));
  return h('div', {}, pageHeading('Record a new flock'), container);
}
