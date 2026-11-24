// The Edit farm details page (owner only).
import { h, pageHeading, setContent } from '../components/dom.js';
import { alertBox, setFlash } from '../components/alerts.js';
import {
  guardSubmit, showErrors, clearErrors, formValues, fillForm, saveDraft, takeDraft,
} from '../components/forms.js';
import { farmFields, updateVisibleFields, FARM_FIELD_LABELS } from '../components/farm-fields.js';
import { updateFarm } from '../api/farms.js';
import { setCurrentFarm } from '../farm/farm.js';
import { navigate } from '../router.js';

export function formValuesOfFarm(farm) {
  const text = (value) => (value === null || value === undefined ? '' : String(value));
  return {
    name: farm.name,
    location: farm.location,
    poultryType: farm.poultryType,
    numberOfBirds: text(farm.numberOfBirds),
    experienceLevel: farm.experienceLevel,
    farmSize: text(farm.farmSize),
    managementMode: farm.managementMode || 'independent',
    currency: text(farm.currency),
    startingStage: farm.poultryType === 'layer' && farm.startingStage !== 'day_old' ? text(farm.startingStage) : '',
    startingAgeWeeks: text(farm.startingAgeWeeks),
    houseStatus: text(farm.houseStatus),
    houseLengthM: text(farm.houseLengthM),
    houseWidthM: text(farm.houseWidthM),
    nonUsableAreaM2: text(farm.nonUsableAreaM2),
  };
}

const same = (a, b) => (a ?? null) === (b ?? null);

export function farmChanges(farm, values) {
  const changes = {};
  const text = (name) => (typeof values[name] === 'string' ? values[name].trim() : undefined);
  const number = (name) => {
    const value = text(name);
    if (value === undefined) return undefined;
    return value === '' ? null : Number(value);
  };
  const set = (key, value) => {
    if (value !== undefined && !same(farm[key], value)) changes[key] = value;
  };

  set('name', text('name'));
  set('location', text('location'));
  set('poultryType', values.poultryType);
  set('numberOfBirds', number('numberOfBirds'));
  set('experienceLevel', values.experienceLevel);
  set('farmSize', text('farmSize') === '' ? null : text('farmSize'));
  set('managementMode', values.managementMode);
  const currency = text('currency');
  if (currency) set('currency', currency.toUpperCase());
  const stage = values.poultryType === 'layer' ? (text('startingStage') || 'day_old') : 'day_old';
  set('startingStage', stage);
  if (stage !== 'day_old') set('startingAgeWeeks', number('startingAgeWeeks'));
  set('houseStatus', text('houseStatus') === '' ? null : text('houseStatus'));
  for (const name of ['houseLengthM', 'houseWidthM', 'nonUsableAreaM2']) set(name, number(name));
  return changes;
}

export function editFarmPage({ user, farmContext }) {
  const { farm } = farmContext;
  const draftId = `edit-farm-${farm.id}`;
  const summary = h('div', { 'aria-live': 'polite' });
  const form = h('form', { class: 'form' },
    farmFields({ mode: 'edit' }),
    h('div', { class: 'button-row' },
      h('button', { type: 'submit', class: 'button' }, 'Save changes'),
      h('a', { class: 'button button--secondary', href: `#/farms/${farm.id}/settings` }, 'Cancel')));

  form.addEventListener('change', () => updateVisibleFields(form));
  fillForm(form, formValuesOfFarm(farm));
  updateVisibleFields(form);

  let restored = null;
  const draft = takeDraft(draftId, user.id);
  if (draft) {
    fillForm(form, draft);
    updateVisibleFields(form);
    restored = alertBox('info', 'We kept the changes you had made before your session expired. Check them, then select "Save changes" again. Nothing was saved yet.');
  }

  guardSubmit(form, async () => {
    clearErrors(form, summary);
    const values = formValues(form);
    const changes = farmChanges(farm, values);
    if (Object.keys(changes).length === 0) {
      summary.replaceChildren(alertBox('info', 'Nothing has changed, so there is nothing to save.'));
      return;
    }
    try {
      const { data, message } = await updateFarm(farm.id, changes);
      setCurrentFarm(data.farm, data.capacity);
      setFlash('success', message || 'Farm updated successfully.');
      navigate(`/farms/${farm.id}/settings`);
    } catch (error) {
      if (error.status === 401) {
        saveDraft(draftId, user.id, values);
        return;
      }
      showErrors(form, error, summary, FARM_FIELD_LABELS);
    }
  }, { busyText: 'Saving…' });

  const container = h('div', {});
  setContent(container,
    h('p', { class: 'page-intro' }, 'Change what you need and select "Save changes". Only the details you change are saved.'),
    restored,
    summary,
    h('div', { class: 'card' }, form));
  return h('div', {}, pageHeading('Edit farm details'), container);
}
