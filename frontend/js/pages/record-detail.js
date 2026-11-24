// One production record with its history and corrections.
import { h, pageHeading, setContent } from '../components/dom.js';
import { alertBox, takeFlash } from '../components/alerts.js';
import { loadingBlock, errorBlock } from '../components/loading.js';
import {
  inputField, textareaField, setFieldVisible, guardSubmit, showErrors, clearErrors, formValues, fillForm, saveDraft, takeDraft,
} from '../components/forms.js';
import {
  RECORD_TYPES, FIELD_LABELS, recordFacts, populationWarning, versionNote, correctionHistory, typeFields, updateWeightFields,
  formValuesOf, correctionBody, recordDateText,
} from '../components/production.js';
import { getRecord, correctRecord, queryString } from '../api/production.js';
import { getFlock } from '../api/flocks.js';
import { canDo } from '../farm/access.js';
import { notFoundPage } from './errors.js';
import { typesForFarm } from './records-overview.js';
import { ugandaToday, formatUtcAsUgandaDateTime } from '../utils/dates.js';

export function recordDetailPage({ user, farmContext, params, query }) {
  const { farm } = farmContext;
  const path = params.recordType;
  if (!RECORD_TYPES[path] || !typesForFarm(farm).includes(path)) return notFoundPage();
  const info = RECORD_TYPES[path];
  const flockId = Number(params.flockId);
  const recordId = Number(params.recordId);
  const fromTask = query.taskId && /^[1-9]\d*$/.test(query.taskId) ? query.taskId : null;
  const heading = pageHeading(info.label);
  const messages = h('div', { 'aria-live': 'polite' });
  const body = h('div', {}, loadingBlock('Loading the record…'));
  const draftId = `fix-record-${path}-${recordId}`;
  let flock = null;

  function announce(kind, text, options) {
    const box = alertBox(kind, text, options);
    messages.replaceChildren(box);
    box.focus();
  }

  function correctionSection(record) {
    const summary = h('div', { 'aria-live': 'polite' });
    const form = h('form', { class: 'form', hidden: true },
      h('p', {}, `You are correcting version ${record.version}. Change only what was wrong. The earlier values stay in the correction history.`),
      inputField({ name: 'recordDate', id: 'fix-date', label: 'Date', type: 'date', required: true, attrs: { max: ugandaToday() } }),
      typeFields(path, { poultryType: flock.poultryType, prefix: 'fix', isCorrection: true }),
      textareaField({ name: 'notes', id: 'fix-notes', label: 'Notes', maxlength: 1000, rows: 2, hint: 'Leave it empty to remove the notes.' }),
      textareaField({ name: 'reason', id: 'fix-reason', label: 'Reason for the correction', required: true, maxlength: 500, rows: 2,
        hint: 'For example "Typed 1500 instead of 150".' }),
      h('div', { class: 'button-row' },
        h('button', { type: 'submit', class: 'button' }, 'Save the correction'),
        h('button', { type: 'button', class: 'button button--secondary', onclick: () => { form.hidden = true; toggle.hidden = false; toggle.focus(); } }, 'Cancel')));
    fillForm(form, formValuesOf(path, record));
    const update = () => updateWeightFields(form, setFieldVisible, 'fix');
    form.addEventListener('change', update);
    form.addEventListener('input', update);
    const toggle = h('button', { type: 'button', class: 'button button--secondary' }, 'Correct this record');
    toggle.addEventListener('click', () => {
      form.hidden = false;
      toggle.hidden = true;
      form.elements.recordDate.focus();
    });
    const draft = takeDraft(draftId, user.id);
    if (draft) {
      fillForm(form, draft);
      form.hidden = false;
      toggle.hidden = true;
      summary.append(alertBox('info', 'We kept your correction from before your session expired. Check it and save again. Nothing was saved yet.'));
    }
    update();

    guardSubmit(form, async () => {
      clearErrors(form, summary);
      const values = formValues(form);
      const built = correctionBody(path, record, values);
      if (built.errors) {
        showErrors(form, { message: 'Please check the correction.', details: built.errors }, summary, FIELD_LABELS);
        return;
      }
      if (!built.body) {
        summary.replaceChildren(alertBox('info', 'Nothing has changed, so there is nothing to correct.'));
        return;
      }
      try {
        const { data, message } = await correctRecord(farm.id, flockId, path, recordId, built.body);
        render(data.record);
        announce('success', message || 'Record corrected.');
      } catch (error) {
        if (error.status === 401) { saveDraft(draftId, user.id, values); return; }
        if (error.status === 409 && (error.details || []).some((d) => d.field === 'expectedVersion')) {
          await load();
          announce('warning', `${error.message} The record and its history have been loaded again. Your correction was not saved.`,
            { title: 'Changed by someone else' });
          return;
        }
        showErrors(form, error, summary, FIELD_LABELS);
      }
    }, { busyText: 'Saving…' });

    return h('section', { class: 'card', 'aria-labelledby': 'record-correct' },
      h('h2', { id: 'record-correct' }, 'Correct this record'),
      h('p', {}, 'A correction keeps the earlier values and your reason in the record\'s history. Records cannot be deleted.'),
      summary, h('div', {}, toggle), form);
  }

  function render(record) {
    heading.textContent = `${info.label}: ${recordDateText(record)}`;
    setContent(body,
      h('nav', { class: 'breadcrumbs', 'aria-label': 'Breadcrumb' },
        h('ol', {},
          h('li', {}, h('a', { href: `#/farms/${farm.id}/records` }, 'Production records')),
          h('li', {}, h('a', { href: `#/farms/${farm.id}/records/${path}${queryString({ flockId })}` }, info.label)),
          h('li', { 'aria-current': 'page' }, recordDateText(record)))),
      fromTask ? h('p', {}, h('a', { href: `#/farms/${farm.id}/tasks/${fromTask}` }, 'Back to the task'),
        h('span', { class: 'small-print' }, ' (saving a record does not mark the task as done)')) : null,
      populationWarning(record),
      h('section', { class: 'card', 'aria-labelledby': 'record-values' },
        h('h2', { id: 'record-values' }, 'The record'),
        h('p', {}, versionNote(record)),
        h('dl', { class: 'details' },
          h('dt', {}, 'Flock'), h('dd', {}, h('a', { href: `#/farms/${farm.id}/flocks/${flockId}` }, flock.name),
            flock.status === 'closed' ? ' (closed)' : ''),
          h('dt', {}, 'Date'), h('dd', {}, recordDateText(record)),
          recordFacts(path, record, { full: true }),
          record.exceedsPopulation || record.populationOnDate != null
            ? [h('dt', {}, 'Birds in the flock on that date'), h('dd', {}, String(record.populationOnDate))] : null),
        record.notes ? h('p', { class: 'user-text' }, h('strong', {}, 'Notes: '), record.notes) : null,
        h('p', { class: 'small-print' }, `Recorded by ${record.createdByName || 'unknown'}, ${formatUtcAsUgandaDateTime(record.createdAt)}`)),
      canDo(farm.myRole, 'production:correct') ? correctionSection(record) : null,
      correctionHistory(record));
  }

  async function load() {
    try {
      const [{ data: flockData }, { data }] = await Promise.all([getFlock(farm.id, flockId), getRecord(farm.id, flockId, path, recordId)]);
      if (!body.isConnected) return;
      flock = flockData.flock;
      render(data.record);
    } catch (error) {
      if (error.status === 401 || !body.isConnected) return;
      setContent(body, errorBlock(error, {
        onRetry: error.status === 0 || error.status >= 500 ? load : undefined,
        actions: [h('a', { class: 'button', href: `#/farms/${farm.id}/records/${path}` }, `All ${info.label.toLowerCase()}`)],
      }));
    }
  }
  load();

  return h('div', {}, heading, takeFlash(), messages, body);
}
