// One health observation with its history and corrections.
import { h, pageHeading, setContent } from '../components/dom.js';
import { alertBox, takeFlash } from '../components/alerts.js';
import { loadingBlock, errorBlock } from '../components/loading.js';
import {
  inputField, textareaField, guardSubmit, showErrors, clearErrors, formValues, fillForm, saveDraft, takeDraft,
} from '../components/forms.js';
import {
  disclaimerBox, healthBreadcrumbs, contactLabels, birdsAffectedText, populationWarning, healthCorrectionHistory,
  observationFields, formValuesOfObservation, correctionBodyOf, HEALTH_FIELD_LABELS,
} from '../components/health.js';
import { getObservation, correctObservation } from '../api/health.js';
import { getFlock } from '../api/flocks.js';
import { canDo } from '../farm/access.js';
import { formatDate, ugandaToday, formatUtcAsUgandaDateTime } from '../utils/dates.js';

export function healthDetailPage({ user, farmContext, params, query }) {
  const { farm } = farmContext;
  const flockId = Number(params.flockId);
  const observationId = Number(params.observationId);
  const fromTask = query.taskId && /^[1-9]\d*$/.test(query.taskId) ? query.taskId : null;
  const mayCorrect = canDo(farm.myRole, 'health:correct');
  let openCorrection = query.correct === '1';
  const heading = pageHeading('Health observation');
  const messages = h('div', { 'aria-live': 'polite' });
  const body = h('div', {}, loadingBlock('Loading the observation…'));
  const draftId = `fix-health-${observationId}`;
  let flock = null;
  let warned = false;

  function announce(kind, text, options) {
    const box = alertBox(kind, text, options);
    messages.replaceChildren(box);
    box.focus();
  }

  function correctionSection(observation) {
    const summary = h('div', { 'aria-live': 'polite' });
    const form = h('form', { class: 'form', hidden: true },
      h('p', {}, `You are correcting version ${observation.version}. Change only what was wrong. The earlier values stay in the correction history.`),
      inputField({ name: 'observationDate', id: 'fix-health-date', label: 'Date', type: 'date', required: true, attrs: { max: ugandaToday() } }),
      observationFields({ prefix: 'fix-health' }),
      textareaField({ name: 'reason', id: 'fix-health-reason', label: 'Reason for the correction', required: true, maxlength: 500, rows: 2,
        hint: 'For example "Wrong date" or "Counted again: 4 birds, not 14".' }),
      h('div', { class: 'button-row' },
        h('button', { type: 'submit', class: 'button' }, 'Save the correction'),
        h('button', { type: 'button', class: 'button button--secondary', onclick: () => { form.hidden = true; toggle.hidden = false; toggle.focus(); } }, 'Cancel')));
    fillForm(form, formValuesOfObservation(observation));
    const toggle = h('button', { type: 'button', class: 'button button--secondary' }, 'Correct this observation');
    const open = () => { form.hidden = false; toggle.hidden = true; };
    toggle.addEventListener('click', () => { open(); form.elements.observationDate.focus(); });
    const draft = takeDraft(draftId, user.id);
    if (draft) {
      fillForm(form, draft);
      open();
      summary.append(alertBox('info', 'We kept your correction from before your session expired. Check it and save again. Nothing was saved yet.'));
    } else if (openCorrection) {
      open();
    }

    guardSubmit(form, async () => {
      clearErrors(form, summary);
      const values = formValues(form);
      const built = correctionBodyOf(observation, values);
      if (!built.body) {
        summary.replaceChildren(alertBox('info', 'Nothing has changed, so there is nothing to correct.'));
        return;
      }
      try {
        const { data, message } = await correctObservation(farm.id, flockId, observationId, built.body);
        openCorrection = false;
        render(data.observation, data.disclaimer);
        announce('success', message || 'Health observation corrected.');
      } catch (error) {
        if (error.status === 401) { saveDraft(draftId, user.id, values); return; }
        if (error.status === 409 && (error.details || []).some((d) => d.field === 'expectedVersion')) {
          openCorrection = false;
          await load();
          announce('warning', `${error.message} The observation and its history have been loaded again. Your correction was not saved.`,
            { title: 'Changed by someone else' });
          return;
        }
        showErrors(form, error, summary, HEALTH_FIELD_LABELS);
      }
    }, { busyText: 'Saving…' });

    return h('section', { class: 'card', 'aria-labelledby': 'observation-correct' },
      h('h2', { id: 'observation-correct' }, 'Correct this observation'),
      h('p', {}, 'A correction keeps the earlier values and your reason in the history. Observations cannot be deleted.'),
      summary, h('div', {}, toggle), form);
  }

  function render(observation, disclaimer) {
    const dateText = formatDate(observation.observationDate);
    heading.textContent = `Health observation: ${dateText}`;
    setContent(body,
      healthBreadcrumbs(farm, [flock.name, `#/farms/${farm.id}/health/flocks/${flockId}`], [dateText]),
      disclaimerBox(disclaimer),
      fromTask ? h('p', {}, h('a', { href: `#/farms/${farm.id}/tasks/${fromTask}` }, 'Back to the task'),
        h('span', { class: 'small-print' }, ' (saving an observation does not mark the task as done)')) : null,
      observation.exceedsPopulation ? h('div', {}, populationWarning(observation),
        h('p', {}, "The warning comes from the flock's current records. If a death or other change was recorded or corrected meanwhile, ",
          h('button', { type: 'button', class: 'button button--secondary button--small', onclick: () => load({ recheck: true }) }, 'Check again'))) : null,
      h('section', { class: 'card', 'aria-labelledby': 'observation-values' },
        h('h2', { id: 'observation-values' }, 'The observation'),
        h('p', {}, observation.version > 1 ? `Corrected: version ${observation.version}. The earlier values are in the correction history below.`
          : 'As first saved (version 1).'),
        h('dl', { class: 'details' },
          h('dt', {}, 'Flock'), h('dd', {}, h('a', { href: `#/farms/${farm.id}/flocks/${flockId}` }, flock.name), flock.status === 'closed' ? ' (closed)' : ''),
          h('dt', {}, 'Date'), h('dd', {}, dateText),
          h('dt', {}, 'What was noticed'), h('dd', { class: 'user-text' }, observation.observation),
          h('dt', {}, 'Birds affected'), h('dd', {}, birdsAffectedText(observation)),
          observation.exceedsPopulation
            ? [h('dt', {}, 'Birds in the flock on that date'), h('dd', {}, String(observation.populationOnDate))] : null,
          h('dt', {}, 'What was done'), h('dd', { class: 'user-text' }, observation.actionTaken || 'Not written down')),
        contactLabels(observation),
        h('p', { class: 'small-print' }, `Recorded by ${observation.createdByName || 'unknown'}, ${formatUtcAsUgandaDateTime(observation.createdAt)}`)),
      mayCorrect ? correctionSection(observation)
        : (query.correct === '1' ? alertBox('info', 'Only the farm owner or a manager can correct a health observation. Ask them if something here is wrong.',
          { title: 'Correction not available' }) : null),
      healthCorrectionHistory(observation));
  }

  async function load({ recheck = false } = {}) {
    try {
      const [{ data: flockData }, { data }] = await Promise.all([getFlock(farm.id, flockId), getObservation(farm.id, flockId, observationId)]);
      if (!body.isConnected) return;
      flock = flockData.flock;
      const cleared = warned && !data.observation.exceedsPopulation;
      warned = Boolean(data.observation.exceedsPopulation);
      render(data.observation, data.disclaimer);
      if (cleared) announce('success', "The population warning has cleared: the flock's records now show enough birds on that date.");
      else if (recheck) announce('warning', "Checked again: the flock's records still show fewer birds on that date than the birds affected.");
    } catch (error) {
      if (error.status === 401 || !body.isConnected) return;
      setContent(body, errorBlock(error, {
        onRetry: error.status === 0 || error.status >= 500 ? load : undefined,
        actions: [h('a', { class: 'button', href: `#/farms/${farm.id}/health` }, 'Health observations')],
      }));
    }
  }
  load();

  return h('div', {}, heading, takeFlash(), messages, body);
}
