// The Edit flock page: details, milestone and arrival corrections.
import { h, pageHeading, setContent } from '../components/dom.js';
import { alertBox, setFlash } from '../components/alerts.js';
import { loadingBlock, errorBlock } from '../components/loading.js';
import {
  inputField, selectField, textareaField, setFieldVisible, guardSubmit, showErrors, clearErrors,
  formValues, fillForm, saveDraft, takeDraft,
} from '../components/forms.js';
import { flockCapacityPanel } from '../components/flocks.js';
import { getFlock, listMovements, updateFlock } from '../api/flocks.js';
import { navigate } from '../router.js';
import { ugandaToday, formatDate } from '../utils/dates.js';
import { FLOCK_FIELD_LABELS } from './create-flock.js';

const DESCRIPTIVE = ['name', 'breedStrain', 'supplier', 'vaccinationNotes', 'notes'];
const LABELS = { ...FLOCK_FIELD_LABELS, correctionReason: 'Reason', firstEggDate: 'First-egg date', expectedSaleDate: 'Expected sale date' };
const text = (value) => (value === null || value === undefined ? '' : String(value));

export function descriptiveChanges(flock, values) {
  const changes = {};
  for (const field of DESCRIPTIVE) {
    if (values[field] === undefined) continue;
    const value = values[field].trim();
    const next = value === '' && field !== 'name' ? null : value;
    if ((flock[field] ?? null) !== next) changes[field] = next;
  }
  return changes;
}

export function arrivalChanges(flock, values) {
  const changes = {};
  if (values.arrivalDate && values.arrivalDate !== flock.arrivalDate) changes.arrivalDate = values.arrivalDate;
  if (flock.poultryType === 'layer') {
    const stage = values.startingStage || 'day_old';
    if (stage !== flock.startingStage) changes.startingStage = stage;
    if (stage !== 'day_old') {
      const age = values.ageAtArrivalWeeks === '' || values.ageAtArrivalWeeks === undefined ? null : Number(values.ageAtArrivalWeeks);
      if (age !== (flock.ageAtArrivalWeeks ?? null)) changes.ageAtArrivalWeeks = age;
    }
  }
  for (const field of ['malesReceived', 'femalesReceived']) {
    const next = values[field] === '' || values[field] === undefined ? null : Number(values[field]);
    if (next !== (flock[field] ?? null)) changes[field] = next;
  }
  return changes;
}

export function editFlockPage({ user, farmContext, params }) {
  const { farm } = farmContext;
  const flockId = Number(params.flockId);
  const heading = pageHeading('Edit flock');
  const body = h('div', {}, loadingBlock('Loading the flock…'));
  const backHref = `#/farms/${farm.id}/flocks/${flockId}?tab=details`;

  async function save(form, summary, changes, draftId, extraLabels = {}) {
    clearErrors(form, summary);
    const values = formValues(form);
    if (Object.keys(changes).length === 0) {
      summary.replaceChildren(alertBox('info', 'Nothing has changed, so there is nothing to save.'));
      return;
    }
    try {
      const { data, message } = await updateFlock(farm.id, flockId, changes);
      const notes = [...(data.milestones?.warnings || []).map((w) => w.message)];
      setFlash(notes.length ? 'warning' : 'success', [message || 'Flock updated.', ...notes].join(' '));
      if (data.arrivalCorrection?.capacityCheck && data.arrivalCorrection.capacityCheck.status !== 'within_capacity') {
        summary.replaceChildren(alertBox('warning', message || 'Flock updated.'), flockCapacityPanel(data.arrivalCorrection.capacityCheck, { title: 'Space check on arrival (recalculated)' }),
          h('a', { class: 'button', href: backHref }, 'Back to the flock'));
        return;
      }
      navigate(`/farms/${farm.id}/flocks/${flockId}?tab=details`);
    } catch (error) {
      if (error.status === 401) { saveDraft(draftId, user.id, values); return; }
      showErrors(form, error, summary, { ...LABELS, ...extraLabels });
    }
  }

  function withDraft(form, draftId) {
    const draft = takeDraft(draftId, user.id);
    if (!draft) return null;
    fillForm(form, draft);
    return alertBox('info', 'We kept what you had entered before your session expired. Check it and save again. Nothing was saved yet.');
  }

  function descriptiveSection(flock) {
    const draftId = `flock-details-${flock.id}`;
    const summary = h('div', { 'aria-live': 'polite' });
    const form = h('form', { class: 'form' },
      inputField({ name: 'name', label: 'Flock name', required: true, value: flock.name, attrs: { maxlength: '100' } }),
      inputField({ name: 'breedStrain', label: 'Breed or strain', value: text(flock.breedStrain), attrs: { maxlength: '100' } }),
      inputField({ name: 'supplier', label: 'Supplier or hatchery', value: text(flock.supplier), attrs: { maxlength: '150' } }),
      textareaField({ name: 'vaccinationNotes', label: 'Vaccination notes', value: flock.vaccinationNotes, maxlength: 1000,
        hint: 'What the supplier or your veterinarian told you. PoultryStart does not give vaccination schedules.' }),
      textareaField({ name: 'notes', label: 'Notes', value: flock.notes, maxlength: 1000 }),
      h('div', { class: 'button-row' }, h('button', { type: 'submit', class: 'button' }, 'Save details')));
    const restored = withDraft(form, draftId);
    guardSubmit(form, () => save(form, summary, descriptiveChanges(flock, formValues(form)), draftId), { busyText: 'Saving…' });
    return h('section', { class: 'card', 'aria-labelledby': 'edit-details' },
      h('h2', { id: 'edit-details' }, 'Flock details'),
      h('p', { class: 'small-print' }, 'Leave a field empty to remove it. These details never change the bird numbers.'),
      restored, summary, form);
  }

  function milestoneSection(flock) {
    const isLayer = flock.poultryType === 'layer';
    const field = isLayer ? 'firstEggDate' : 'expectedSaleDate';
    const label = isLayer ? 'First-egg date' : 'Expected sale date';
    const current = flock[field];
    const draftId = `flock-milestone-${flock.id}`;
    const summary = h('div', { 'aria-live': 'polite' });
    const today = ugandaToday();
    const form = h('form', { class: 'form' },
      inputField({ name: field, label, type: 'date', required: true, value: text(current),
        hint: isLayer ? 'The day this flock laid its first eggs. Not in the future, and not before the flock arrived.'
          : 'When you expect to sell the birds. You decide this; PoultryStart does not set a sale age.',
        attrs: isLayer ? { min: flock.arrivalDate, max: today } : { min: flock.arrivalDate } }),
      current ? textareaField({ name: 'correctionReason', label: 'Reason for changing the date', required: true, maxlength: 500, rows: 2 }) : null,
      h('div', { class: 'button-row' }, h('button', { type: 'submit', class: 'button' }, current ? 'Change the date' : 'Save the date')));
    const restored = withDraft(form, draftId);
    guardSubmit(form, () => {
      const values = formValues(form);
      const changes = values[field] && values[field] !== current ? { [field]: values[field] } : {};
      if (current && Object.keys(changes).length) changes.correctionReason = values.correctionReason.trim();
      return save(form, summary, changes, draftId);
    }, { busyText: 'Saving…' });
    return h('section', { class: 'card', 'aria-labelledby': 'edit-milestone' },
      h('h2', { id: 'edit-milestone' }, label),
      h('p', {}, current ? `Saved: ${formatDate(current)}. A changed date is kept in the flock's history.` : 'Not recorded yet.',
        ' Daily tasks that depend on this date follow it.'),
      restored, summary, form);
  }

  function arrivalSection(flock, onlyReceived) {
    if (!onlyReceived) {
      return h('section', { class: 'card', 'aria-labelledby': 'edit-arrival' },
        h('h2', { id: 'edit-arrival' }, 'Arrival details'),
        h('p', {}, 'The arrival details can no longer be changed: the flock already has other entries in its history. '
          + 'A wrong number of birds is fixed with a correction in the flock\'s history.'));
    }
    const isLayer = flock.poultryType === 'layer';
    const draftId = `flock-arrival-${flock.id}`;
    const summary = h('div', { 'aria-live': 'polite' });
    const today = ugandaToday();
    const form = h('form', { class: 'form' },
      inputField({ name: 'arrivalDate', label: 'Arrival date', type: 'date', required: true, value: flock.arrivalDate, attrs: { max: today } }),
      isLayer ? selectField({ name: 'startingStage', label: 'Age of the birds when they arrived', placeholder: 'Day-old chicks',
        value: flock.startingStage === 'day_old' ? '' : flock.startingStage,
        options: [{ value: 'pullet', label: 'Pullets (growing birds, 7 to 14 weeks old)' }, { value: 'point_of_lay', label: 'Point-of-lay pullets (15 to 20 weeks old)' }] }) : null,
      isLayer ? inputField({ name: 'ageAtArrivalWeeks', label: 'Age on arrival (weeks)', type: 'number', required: true,
        value: text(flock.ageAtArrivalWeeks), attrs: { min: '0', max: '100', step: '1', inputmode: 'numeric' } }) : null,
      inputField({ name: 'malesReceived', label: 'Males received', type: 'number', value: text(flock.malesReceived), attrs: { min: '0', step: '1', inputmode: 'numeric' } }),
      inputField({ name: 'femalesReceived', label: 'Females received', type: 'number', value: text(flock.femalesReceived), attrs: { min: '0', step: '1', inputmode: 'numeric' } }),
      textareaField({ name: 'correctionReason', label: 'Reason for the correction', required: true, maxlength: 500, rows: 2 }),
      h('div', { class: 'button-row' }, h('button', { type: 'submit', class: 'button' }, 'Correct the arrival details')));
    const update = () => {
      if (isLayer) setFieldVisible(form, 'ageAtArrivalWeeks', form.elements.startingStage.value !== '');
    };
    form.addEventListener('change', update);
    const restored = withDraft(form, draftId);
    update();
    guardSubmit(form, () => {
      const values = formValues(form);
      const changes = arrivalChanges(flock, values);
      if (Object.keys(changes).length) changes.correctionReason = values.correctionReason.trim();
      return save(form, summary, changes, draftId, { correctionReason: 'Reason for the correction' });
    }, { busyText: 'Saving…' });
    return h('section', { class: 'card', 'aria-labelledby': 'edit-arrival' },
      h('h2', { id: 'edit-arrival' }, 'Correct the arrival details'),
      h('p', {}, 'Possible only while the flock has no history besides the birds received. The correction and your reason are kept, and the space check on arrival is worked out again. '
        + 'The number of birds received is not changed here: use a correction in the flock\'s history.'),
      restored, summary, form);
  }

  async function load() {
    try {
      const [{ data: flockData }, { data: movementsData }] = await Promise.all([getFlock(farm.id, flockId), listMovements(farm.id, flockId)]);
      if (!body.isConnected) return;
      const { flock } = flockData;
      heading.textContent = `Edit ${flock.name}`;
      if (flock.status !== 'active') {
        setContent(body, alertBox('info', 'This flock is closed. Closed flocks are kept as records and cannot be changed or reopened.', { title: 'Read-only' }),
          h('a', { class: 'button', href: backHref }, 'Back to the flock'));
        return;
      }
      setContent(body,
        h('p', {}, h('a', { href: backHref }, 'Back to the flock')),
        descriptiveSection(flock),
        milestoneSection(flock),
        arrivalSection(flock, movementsData.movements.length === 1));
    } catch (error) {
      if (error.status === 401 || !body.isConnected) return;
      setContent(body, errorBlock(error, { actions: [h('a', { class: 'button', href: `#/farms/${farm.id}/flocks` }, 'All flocks')] }));
    }
  }
  load();
  return h('div', {}, heading, body);
}
