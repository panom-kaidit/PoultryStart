// The page for recording a health observation.
import { h, pageHeading, setContent } from '../components/dom.js';
import { alertBox, setFlash } from '../components/alerts.js';
import { loadingBlock, errorBlock } from '../components/loading.js';
import {
  inputField, selectField, guardSubmit, showErrors, clearErrors, formValues, fillForm, saveDraft, takeDraft,
} from '../components/forms.js';
import {
  disclaimerBox, healthNav, healthBreadcrumbs, observationFields, createObservationBody, HEALTH_FIELD_LABELS,
} from '../components/health.js';
import { createObservation } from '../api/health.js';
import { queryString } from '../api/production.js';
import { listFlocks } from '../api/flocks.js';
import { navigate } from '../router.js';
import { ugandaToday } from '../utils/dates.js';

export function healthFormPage({ user, farmContext, query }) {
  const { farm } = farmContext;
  const body = h('div', {}, loadingBlock('Loading the flocks…'));
  const draftId = `new-health-${farm.id}`;
  const fromTask = query.taskId && /^[1-9]\d*$/.test(query.taskId) ? query.taskId : null;

  async function load() {
    try {
      const { data } = await listFlocks(farm.id);
      if (!body.isConnected) return;
      const flocks = [...data.flocks].sort((a, b) => (a.status === 'active' ? 0 : 1) - (b.status === 'active' ? 0 : 1));
      if (flocks.length === 0) {
        setContent(body, alertBox('info', 'There are no flocks yet. Health observations belong to a flock: record the flock first.', { title: 'Not possible yet' }),
          h('a', { class: 'button button--secondary', href: `#/farms/${farm.id}/flocks` }, 'Go to the flocks'));
        return;
      }
      const requested = query.flockId ? flocks.find((f) => String(f.id) === String(query.flockId)) : null;
      const today = ugandaToday();
      const cancelHref = fromTask ? `#/farms/${farm.id}/tasks/${fromTask}`
        : (requested ? `#/farms/${farm.id}/health/flocks/${requested.id}` : `#/farms/${farm.id}/health`);
      const summary = h('div', { 'aria-live': 'polite' });
      const form = h('form', { class: 'form' },
        selectField({ name: 'flockId', id: 'field-flockId', label: 'Flock', required: true, placeholder: flocks.length > 1 ? 'Choose a flock…' : undefined,
          value: requested ? String(requested.id) : (flocks.length === 1 ? String(flocks[0].id) : undefined),
          options: flocks.map((f) => ({ value: String(f.id), label: `${f.name}${f.status === 'closed' ? ' (closed: dates up to its closure)' : ''}` })) }),
        inputField({ name: 'observationDate', id: 'new-health-date', label: 'Date', type: 'date', required: true, value: today, attrs: { max: today } }),
        observationFields({ prefix: 'new-health' }),
        h('div', { class: 'button-row' },
          h('button', { type: 'submit', class: 'button' }, 'Save the observation'),
          h('a', { class: 'button button--secondary', href: cancelHref }, 'Cancel')));

      const updateDateLimit = () => {
        const flock = flocks.find((f) => String(f.id) === form.elements.flockId.value);
        if (flock?.arrivalDate) form.elements.observationDate.min = flock.arrivalDate; else form.elements.observationDate.removeAttribute('min');
        const closed = flock?.status === 'closed' && flock.closedAt ? String(flock.closedAt).slice(0, 10) : null;
        form.elements.observationDate.max = closed && closed < today ? closed : today;
      };
      form.addEventListener('change', updateDateLimit);

      let restored = null;
      const draft = takeDraft(draftId, user.id);
      if (draft) {
        fillForm(form, draft);
        restored = alertBox('info', 'We kept what you had entered before your session expired. Check it, then select "Save the observation" again. Nothing was saved yet.');
      }
      updateDateLimit();

      guardSubmit(form, async () => {
        clearErrors(form, summary);
        const values = formValues(form);
        if (!values.flockId) {
          showErrors(form, { message: 'Please check the form.', details: [{ field: 'flockId', message: 'Choose the flock.' }] }, summary, HEALTH_FIELD_LABELS);
          return;
        }
        try {
          const { data, message } = await createObservation(farm.id, values.flockId, createObservationBody(values));
          setFlash('success', message || 'Health observation saved.');
          navigate(`/farms/${farm.id}/health/flocks/${data.observation.flockId}/${data.observation.id}${queryString({ taskId: fromTask })}`);
        } catch (error) {
          if (error.status === 401) { saveDraft(draftId, user.id, values); return; }
          showErrors(form, error, summary, HEALTH_FIELD_LABELS);
        }
      }, { busyText: 'Saving…' });

      setContent(body,
        fromTask ? alertBox('info', 'You came here from a task. Saving this observation does not mark the task as done: go back to the task to do that.',
          { title: 'From a task' }) : null,
        fromTask ? h('p', {}, h('a', { href: `#/farms/${farm.id}/tasks/${fromTask}` }, 'Back to the task')) : null,
        query.flockId && !requested ? alertBox('info', 'That flock was not found on this farm. Choose a flock.') : null,
        restored, summary, h('div', { class: 'card' }, form));
    } catch (error) {
      if (error.status === 401 || !body.isConnected) return;
      setContent(body, errorBlock(error, { onRetry: load }));
    }
  }
  load();

  return h('div', {},
    pageHeading('Record a health observation'),
    healthBreadcrumbs(farm, ['Record an observation']),
    healthNav(farm, null),
    disclaimerBox(),
    body);
}
