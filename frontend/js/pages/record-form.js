// The page for adding a production record.
import { h, pageHeading, setContent } from '../components/dom.js';
import { alertBox, setFlash } from '../components/alerts.js';
import { loadingBlock, errorBlock } from '../components/loading.js';
import {
  inputField, selectField, textareaField, setFieldVisible, guardSubmit, showErrors, clearErrors, formValues, fillForm, saveDraft, takeDraft,
} from '../components/forms.js';
import { RECORD_TYPES, FIELD_LABELS, typeFields, updateWeightFields, createBody } from '../components/production.js';
import { createRecord, queryString } from '../api/production.js';
import { listFlocks } from '../api/flocks.js';
import { canDo } from '../farm/access.js';
import { navigate } from '../router.js';
import { notFoundPage } from './errors.js';
import { typeNav, typesForFarm } from './records-overview.js';
import { ugandaToday } from '../utils/dates.js';

export function eligibleFlocks(path, flocks) {
  if (path !== 'eggs') return { eligible: flocks, reasons: [] };
  const eligible = flocks.filter((f) => f.poultryType === 'layer' && f.firstEggDate);
  const reasons = flocks.filter((f) => !eligible.includes(f)).map((f) => ({
    flock: f,
    reason: f.poultryType !== 'layer' ? 'Egg records are only for layer flocks.'
      : 'No first-egg date is recorded for this flock yet. Egg records start from that date.',
  }));
  return { eligible, reasons };
}

export function recordFormPage({ user, farmContext, params, query }) {
  const { farm } = farmContext;
  const path = params.recordType;
  if (!RECORD_TYPES[path] || !typesForFarm(farm).includes(path)) return notFoundPage();
  const info = RECORD_TYPES[path];
  const body = h('div', {}, loadingBlock('Loading the flocks…'));
  const draftId = `new-record-${farm.id}-${path}`;
  const fromTask = query.taskId && /^[1-9]\d*$/.test(query.taskId) ? query.taskId : null;

  async function load() {
    try {
      const { data } = await listFlocks(farm.id);
      if (!body.isConnected) return;
      const flocks = [...data.flocks].sort((a, b) => (a.status === 'active' ? 0 : 1) - (b.status === 'active' ? 0 : 1));
      const { eligible, reasons } = eligibleFlocks(path, flocks);

      if (eligible.length === 0) {
        setContent(body, alertBox('info', flocks.length === 0
          ? 'There are no flocks yet. Production records belong to a flock: record the flock first.'
          : `No flock can take ${info.label.toLowerCase()} yet.`, { title: 'Not possible yet', items: reasons.map((r) => `${r.flock.name}: ${r.reason}`) }),
        canDo(farm.myRole, 'flocks:manage') && reasons.some((r) => r.flock.poultryType === 'layer')
          ? h('p', {}, 'The first-egg date is recorded on the flock: open the flock, then "Edit flock details".') : null,
        h('a', { class: 'button button--secondary', href: `#/farms/${farm.id}/flocks` }, 'Go to the flocks'));
        return;
      }

      const requested = query.flockId ? eligible.find((f) => String(f.id) === String(query.flockId)) : null;
      const notEligible = query.flockId && !requested ? reasons.find((r) => String(r.flock.id) === String(query.flockId)) : null;
      const today = ugandaToday();
      const summary = h('div', { 'aria-live': 'polite' });
      const form = h('form', { class: 'form' },
        selectField({ name: 'flockId', id: 'new-flock', label: 'Flock', required: true, placeholder: eligible.length > 1 ? 'Choose a flock…' : undefined,
          value: requested ? String(requested.id) : (eligible.length === 1 ? String(eligible[0].id) : undefined),
          options: eligible.map((f) => ({ value: String(f.id), label: `${f.name}${f.status === 'closed' ? ' (closed: records dated up to its closure)' : ''}` })) }),
        inputField({ name: 'recordDate', id: 'new-date', label: 'Date', type: 'date', required: true, value: today, attrs: { max: today } }),
        typeFields(path, { poultryType: farm.poultryType, prefix: 'new' }),
        textareaField({ name: 'notes', id: 'new-notes', label: 'Notes', maxlength: 1000, rows: 2 }),
        h('div', { class: 'button-row' },
          h('button', { type: 'submit', class: 'button' }, 'Save the record'),
          h('a', { class: 'button button--secondary', href: fromTask ? `#/farms/${farm.id}/tasks/${fromTask}` : `#/farms/${farm.id}/records/${path}` }, 'Cancel')));

      const updateDateLimit = () => {
        const flock = eligible.find((f) => String(f.id) === form.elements.flockId.value);
        const min = flock ? (path === 'eggs' ? flock.firstEggDate : flock.arrivalDate) : null;
        if (min) form.elements.recordDate.min = min; else form.elements.recordDate.removeAttribute('min');
      };
      const update = () => { updateWeightFields(form, setFieldVisible, 'new'); updateDateLimit(); };
      form.addEventListener('change', update);
      form.addEventListener('input', () => updateWeightFields(form, setFieldVisible, 'new'));

      let restored = null;
      const draft = takeDraft(draftId, user.id);
      if (draft) {
        fillForm(form, draft);
        restored = alertBox('info', 'We kept what you had entered before your session expired. Check it, then select "Save the record" again. Nothing was saved yet.');
      }
      update();

      guardSubmit(form, async () => {
        clearErrors(form, summary);
        const values = formValues(form);
        const built = createBody(path, values);
        if (built.errors) {
          showErrors(form, { message: 'Please check the form.', details: built.errors }, summary, FIELD_LABELS);
          return;
        }
        try {
          const { data, message } = await createRecord(farm.id, values.flockId, path, built.body);
          setFlash('success', message || 'Record saved.');
          navigate(`/farms/${farm.id}/records/${path}/${data.record.flockId}/${data.record.id}${queryString({ taskId: fromTask })}`);
        } catch (error) {
          if (error.status === 401) { saveDraft(draftId, user.id, values); return; }
          showErrors(form, error, summary, FIELD_LABELS);
        }
      }, { busyText: 'Saving…' });

      setContent(body,
        fromTask ? alertBox('info', 'You came here from a task. Saving this record does not mark the task as done: go back to the task to do that.',
          { title: 'From a task' }) : null,
        fromTask ? h('p', {}, h('a', { href: `#/farms/${farm.id}/tasks/${fromTask}` }, 'Back to the task')) : null,
        notEligible ? alertBox('info', `${notEligible.flock.name}: ${notEligible.reason} Choose another flock.`) : null,
        path === 'eggs' && reasons.length ? h('p', { class: 'small-print' }, `Not listed: ${reasons.map((r) => r.flock.name).join(', ')} (no first-egg date yet).`) : null,
        path === 'water' ? h('p', { class: 'small-print' }, 'Only the drinking water of the birds. Water used for cleaning or other purposes is not recorded here.') : null,
        path === 'eggs' ? h('p', { class: 'small-print' }, 'Each egg is counted once. The eggs of one day cannot be more than the birds the flock had that day.') : null,
        restored, summary, h('div', { class: 'card' }, form));
    } catch (error) {
      if (error.status === 401 || !body.isConnected) return;
      setContent(body, errorBlock(error, { onRetry: load }));
    }
  }
  load();

  return h('div', {},
    pageHeading(info.add),
    h('p', { class: 'page-intro' }, info.intro),
    typeNav(farm, path),
    h('p', { class: 'small-print' }, 'Other kinds: ', typesForFarm(farm).filter((p) => p !== path).map((p, i) => [i ? ', ' : '',
      h('a', { href: `#/farms/${farm.id}/records/${p}/new${queryString({ flockId: query.flockId, taskId: fromTask })}` }, RECORD_TYPES[p].add)])),
    body);
}

