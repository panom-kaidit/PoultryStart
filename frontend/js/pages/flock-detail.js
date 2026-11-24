// The Flock hub page: one flock's overview, history, health, money and details.
import { h, pageHeading, setContent } from '../components/dom.js';
import { alertBox, statusLabel, setFlash, takeFlash } from '../components/alerts.js';
import { loadingBlock, errorBlock } from '../components/loading.js';
import {
  inputField, selectField, radioField, textareaField, setFieldVisible, guardSubmit, showErrors, clearErrors,
  formValues, fillForm, saveDraft, takeDraft,
} from '../components/forms.js';
import { confirmDialog } from '../components/confirm.js';
import {
  MOVEMENT_LABELS, OTHER_MOVEMENT_TYPES, CLOSURE_REASON_LABELS, signedChange, formatChange,
  correctionAmountFor, flockCapacityPanel,
} from '../components/flocks.js';
import { getFlock, listMovements, recordMovement, closeFlock, deleteFlock } from '../api/flocks.js';
import { getAdvice } from '../api/advisor.js';
import { getDashboard } from '../api/reports.js';
import { getTopics } from '../api/guidance.js';
import { getSummary } from '../api/production.js';
import { listFlockObservations } from '../api/health.js';
import { listExpenses, getExpenseSummary } from '../api/expenses.js';
import { tabs, stageProgress } from '../components/ui.js';
import { disclaimerBox, observationItem, HEALTH_DISCLAIMER } from '../components/health.js';
import { summaryBlock, expenseItem } from '../components/expenses.js';
import { stageBar, shortLabel, hubTabs, pickTab } from '../farm/flocks-view.js';
import { addDaysIso } from '../farm/today-data.js';
import { canDo, canOpen } from '../farm/access.js';
import { navigate } from '../router.js';
import { POULTRY_TYPE_LABELS, STARTING_STAGE_LABELS, labelFor, formatNumber } from '../utils/format.js';
import { ugandaToday, formatDate, formatUtcAsUgandaDateTime } from '../utils/dates.js';

const MOVEMENT_FIELD_LABELS = {
  movementType: 'Type of change', birdChange: 'Number of birds', movementDate: 'Date', reason: 'Reason',
  notes: 'Notes', birdsAgeWeeks: 'Age of the additional birds (weeks)', correctsMovementId: 'Entry',
  replacesMovementId: 'Current correction',
};
const DETAIL_LABELS = {
  arrivalDate: 'Arrival date', startingStage: 'Age group on arrival', ageAtArrivalWeeks: 'Age on arrival (weeks)',
  malesReceived: 'Males received', femalesReceived: 'Females received', capacityAtArrival: 'Space check on arrival',
};
const MILESTONE_LABELS = { first_egg_date: 'First-egg date', expected_sale_date: 'Expected sale date' };

const row = (label, value) => (value === null || value === undefined || value === '' ? null : [h('dt', {}, label), h('dd', {}, value)]);
const userText = (label, text) => (text ? h('p', { class: 'user-text' }, h('strong', {}, `${label}: `), text) : null);

function birdsCard(flock) {
  const t = flock.movementTotals || {};
  return h('section', { class: 'card', 'aria-labelledby': 'flock-birds' },
    h('h2', { id: 'flock-birds' }, 'Birds'),
    h('p', { class: 'big-number' }, h('span', { class: 'big-number__value' }, formatNumber(flock.liveBirds)), ' birds alive now'),
    h('dl', { class: 'details' },
      row('Received on arrival', formatNumber(flock.birdsReceived)),
      t.additional_received ? row('Added later', `+${formatNumber(t.additional_received)}`) : null,
      t.mortality ? row('Deaths', formatNumber(t.mortality)) : null,
      t.culled ? row('Culled', formatNumber(t.culled)) : null,
      t.sold ? row('Sold', formatNumber(t.sold)) : null,
      t.transferred_out ? row('Transferred out', formatNumber(t.transferred_out)) : null,
      t.correction ? row('Corrections (in total)', formatChange(t.correction)) : null),
    h('p', { class: 'small-print' }, '"Birds alive now" is worked out by PoultryStart from every entry in the history below, including corrections.'));
}

function detailsCard(flock, { canEdit, farmId }) {
  const stage = labelFor(STARTING_STAGE_LABELS, flock.startingStage);
  const age = flock.currentAgeWeeks != null
    ? `${flock.currentAgeWeeks} week${flock.currentAgeWeeks === 1 ? '' : 's'}${flock.status === 'closed' ? ` (when closed, ${formatDate(flock.ageAsOf)})` : ''}`
    : 'Not known';
  return h('section', { class: 'card', 'aria-labelledby': 'flock-details' },
    h('h2', { id: 'flock-details' }, 'Flock details'),
    h('dl', { class: 'details' },
      row('Type', labelFor(POULTRY_TYPE_LABELS, flock.poultryType)),
      row('Arrival date', formatDate(flock.arrivalDate)),
      row('Age of the birds', age),
      row('Age group on arrival', flock.startingStage !== 'day_old' && flock.ageAtArrivalWeeks != null
        ? `${stage}, ${flock.ageAtArrivalWeeks} weeks old` : stage),
      row('Breed or strain', flock.breedStrain),
      row('Supplier or hatchery', flock.supplier),
      row('Males received', flock.malesReceived != null ? formatNumber(flock.malesReceived) : null),
      row('Females received', flock.femalesReceived != null ? formatNumber(flock.femalesReceived) : null),
      flock.poultryType === 'layer' ? row('First-egg date', flock.firstEggDate ? formatDate(flock.firstEggDate) : 'Not recorded yet') : null,
      flock.poultryType === 'broiler' ? row('Expected sale date', flock.expectedSaleDate ? formatDate(flock.expectedSaleDate) : 'Not entered yet') : null,
      flock.status === 'closed' ? row('Closed', `${formatDate(String(flock.closedAt).slice(0, 10))}: ${CLOSURE_REASON_LABELS[flock.closureReason] || flock.closureReason}`) : null),
    userText('Vaccination notes', flock.vaccinationNotes),
    userText('Notes', flock.notes),
    userText('Closure notes', flock.closureNotes),
    canEdit ? h('div', { class: 'button-row' }, h('a', { class: 'button button--secondary', href: `#/farms/${farmId}/flocks/${flock.id}/edit` }, 'Edit flock details')) : null);
}

function describeValue(value) {
  if (value === null || value === undefined) return 'not set';
  if (typeof value === 'object') return value.status || JSON.stringify(value);
  return String(value);
}

function changeHistoryCard(flock) {
  const arrival = flock.arrivalCorrections || [];
  const milestones = flock.milestoneChanges || [];
  if (arrival.length === 0 && milestones.length === 0) return null;
  return h('section', { class: 'card', 'aria-labelledby': 'flock-changes' },
    h('h2', { id: 'flock-changes' }, 'Changes to the flock\'s details'),
    h('ul', { class: 'item-list' },
      arrival.map((c) => h('li', { class: 'item' },
        h('p', { class: 'item__title' }, 'Arrival details corrected'),
        h('ul', { class: 'plain-list' }, Object.entries(c.changes).map(([field, change]) =>
          h('li', {}, `${DETAIL_LABELS[field] || field}: ${describeValue(change.from)} → ${describeValue(change.to)}`))),
        userText('Reason', c.reason),
        h('p', { class: 'small-print' }, `By ${c.correctedByName || 'unknown'}, ${formatUtcAsUgandaDateTime(c.correctedAt)}`))),
      milestones.map((c) => h('li', { class: 'item' },
        h('p', { class: 'item__title' }, `${MILESTONE_LABELS[c.milestone] || c.milestone}: ${c.fromValue ? formatDate(c.fromValue) : 'not set'} → ${formatDate(c.toValue)}`),
        userText('Reason', c.reason),
        h('p', { class: 'small-print' }, `By ${c.changedByName || 'unknown'}, ${formatUtcAsUgandaDateTime(c.changedAt)}`)))));
}

export function flockDetailPage({ user, farmContext, params, query = {} }) {
  const { farm } = farmContext;
  const flockId = Number(params.flockId);
  const role = farm.myRole;
  const messages = h('div', { 'aria-live': 'polite' });
  const body = h('div', {}, loadingBlock('Loading the flock…'));
  const heading = pageHeading('Flock');
  let openCorrection = null;

  function announce(kind, text, options) {
    const box = alertBox(kind, text, options);
    messages.replaceChildren(box);
    box.focus();
  }

  async function afterChange(message, extra = null) {
    await load();
    const box = alertBox('success', message);
    messages.replaceChildren(box, extra || '');
    box.focus();
  }

  function mortalityForm(flock) {
    const draftId = `mortality-${flock.id}`;
    const summary = h('div', { 'aria-live': 'polite' });
    const today = ugandaToday();
    const form = h('form', { class: 'form' },
      inputField({ name: 'birds', id: 'death-birds', label: 'Number of birds that died', type: 'number', required: true,
        attrs: { min: '1', max: '1000000', step: '1', inputmode: 'numeric' } }),
      inputField({ name: 'movementDate', id: 'death-date', label: 'Date of the deaths', type: 'date', required: true, value: today,
        hint: 'The day the birds died.', attrs: { min: flock.arrivalDate, max: today } }),
      inputField({ name: 'reason', id: 'death-reason', label: 'Cause, if known', hint: 'For example "found dead in the morning". This is not a diagnosis.', attrs: { maxlength: '500' } }),
      textareaField({ name: 'notes', id: 'death-notes', label: 'Notes about the deaths', maxlength: 1000, rows: 2 }),
      h('div', { class: 'button-row' }, h('button', { type: 'submit', class: 'button' }, 'Record deaths')));
    const draft = takeDraft(draftId, user.id);
    if (draft) fillForm(form, draft);
    guardSubmit(form, async () => {
      clearErrors(form, summary);
      const values = formValues(form);
      const body = { movementType: 'mortality', birdChange: signedChange('mortality', values.birds), movementDate: values.movementDate };
      if (values.reason.trim()) body.reason = values.reason.trim();
      if (values.notes.trim()) body.notes = values.notes.trim();
      try {
        const { message } = await recordMovement(farm.id, flock.id, body);
        await afterChange(message || 'Recorded.');
      } catch (error) {
        if (error.status === 401) { saveDraft(draftId, user.id, values); return; }
        showErrors(form, error, summary, { ...MOVEMENT_FIELD_LABELS, birdChange: 'Number of birds that died' });
      }
    }, { busyText: 'Recording…' });
    return h('section', { class: 'card', 'aria-labelledby': 'record-deaths' },
      h('h2', { id: 'record-deaths' }, 'Record deaths'),
      h('p', {}, `The flock has ${formatNumber(flock.liveBirds)} birds alive now. Deaths reduce this number.`),
      h('p', { class: 'small-print' }, 'Record deaths here only, not in a health observation. If many birds are sick or dying, contact your veterinarian or extension officer.'),
      draft ? alertBox('info', 'We kept what you had entered before your session expired. Check it and record it again. Nothing was saved yet.') : null,
      summary, form);
  }

  function otherMovementForm(flock) {
    const draftId = `movement-${flock.id}`;
    const summary = h('div', { 'aria-live': 'polite' });
    const extra = h('div', {});
    const today = ugandaToday();
    const form = h('form', { class: 'form' },
      selectField({ name: 'movementType', id: 'move-type', label: 'Type of change', required: true, placeholder: 'Choose…',
        options: OTHER_MOVEMENT_TYPES.map((type) => ({ value: type, label: MOVEMENT_LABELS[type] })) }),
      inputField({ name: 'birds', id: 'move-birds', label: 'Number of birds', type: 'number', required: true,
        attrs: { min: '1', max: '1000000', step: '1', inputmode: 'numeric' } }),
      inputField({ name: 'birdsAgeWeeks', id: 'move-age', label: 'Age of the additional birds (weeks)', type: 'number', required: true,
        hint: 'Only birds of the same age as this flock can be added to it. Birds of another age are recorded as a new flock.',
        attrs: { min: '0', max: '100', step: '1', inputmode: 'numeric' } }),
      inputField({ name: 'movementDate', id: 'move-date', label: 'Date of the change', type: 'date', required: true, value: today,
        attrs: { min: flock.arrivalDate, max: today } }),
      inputField({ name: 'reason', id: 'move-reason', label: 'Reason', attrs: { maxlength: '500' } }),
      textareaField({ name: 'notes', id: 'move-notes', label: 'Notes about the change', maxlength: 1000, rows: 2 }),
      h('div', { class: 'button-row' }, h('button', { type: 'submit', class: 'button' }, 'Record the change')));
    const update = () => setFieldVisible(form, 'birdsAgeWeeks', form.elements.movementType.value === 'additional_received');
    form.addEventListener('change', update);
    const draft = takeDraft(draftId, user.id);
    if (draft) fillForm(form, draft);
    update();
    guardSubmit(form, async () => {
      clearErrors(form, summary);
      extra.replaceChildren();
      const values = formValues(form);
      const type = values.movementType;
      const body = { movementType: type, birdChange: signedChange(type, values.birds), movementDate: values.movementDate };
      if (type === 'additional_received') body.birdsAgeWeeks = Number(values.birdsAgeWeeks);
      if (values.reason.trim()) body.reason = values.reason.trim();
      if (values.notes.trim()) body.notes = values.notes.trim();
      try {
        const { data, message } = await recordMovement(farm.id, flock.id, body);
        await afterChange(message || 'Recorded.',
          data.capacityCheck ? flockCapacityPanel(data.capacityCheck, { title: 'Space check after adding birds' }) : null);
      } catch (error) {
        if (error.status === 401) { saveDraft(draftId, user.id, values); return; }
        showErrors(form, error, summary, MOVEMENT_FIELD_LABELS);
      }
    }, { busyText: 'Recording…' });
    return h('section', { class: 'card', 'aria-labelledby': 'record-other' },
      h('h2', { id: 'record-other' }, 'Record other changes'),
      h('p', {}, 'Additional birds of the same age increase the number of birds alive; culled, sold and transferred birds reduce it.'),
      draft ? alertBox('info', 'We kept what you had entered before your session expired. Check it and record it again. Nothing was saved yet.') : null,
      summary, extra, form);
  }

  function correctionForm(original, corrections) {
    const draftId = `correct-${original.id}`;
    const current = original.birdChangeAfterCorrection;
    const summary = h('div', { 'aria-live': 'polite' });
    const preview = h('p', { class: 'small-print', 'aria-live': 'polite' });
    const minimum = original.movementType === 'received' ? 1 : 0;
    const form = h('form', { class: 'form', hidden: openCorrection !== original.id },
      h('p', {}, `This entry was recorded as ${formatChange(original.birdChange)}`,
        original.correctedByMovementId ? ` and is now corrected to ${formatChange(current)}` : '', '. ',
        'Enter the number of birds it should be. The original entry stays in the history: a correction is added with your reason, ',
        'and the number of birds alive changes by the difference.',
        original.correctedByMovementId ? ' Your correction replaces the correction now in effect.' : ''),
      inputField({ name: 'birds', id: `correct-birds-${original.id}`, label: `Correct number of birds (${MOVEMENT_LABELS[original.movementType].toLowerCase()})`,
        type: 'number', required: true, attrs: { min: String(minimum), max: '1000000', step: '1', inputmode: 'numeric' } }),
      preview,
      textareaField({ name: 'reason', id: `correct-reason-${original.id}`, label: 'Reason for the correction', required: true, maxlength: 500, rows: 2,
        hint: 'For example "Counted twice" or "Wrong flock".' }),
      h('div', { class: 'button-row' },
        h('button', { type: 'submit', class: 'button button--small' }, 'Save the correction'),
        h('button', { type: 'button', class: 'button button--secondary button--small', onclick: () => { openCorrection = null; form.hidden = true; toggle.hidden = false; toggle.focus(); } }, 'Cancel')));
    form.elements.birds.addEventListener('input', () => {
      const value = form.elements.birds.value;
      preview.textContent = value === '' ? ''
        : `This entry will count as ${formatChange(signedChange(original.movementType, value))} instead of ${formatChange(current)}.`;
    });
    const draft = takeDraft(draftId, user.id);
    if (draft) { fillForm(form, draft); form.hidden = false; }

    guardSubmit(form, async () => {
      clearErrors(form, summary);
      const values = formValues(form);
      const birds = Number(values.birds);
      const target = signedChange(original.movementType, birds);
      if (target === current) {
        showErrors(form, { message: 'Nothing to correct.', details: [{ field: 'birds', message: `This entry already counts as ${formatChange(current)}.` }] }, summary);
        return;
      }
      const confirmed = await confirmDialog({
        title: 'Save this correction?',
        message: `${MOVEMENT_LABELS[original.movementType]} on ${formatDate(original.movementDate)} will count as ${formatChange(target)} instead of ${formatChange(current)}. `
          + 'The original entry and earlier corrections stay in the history.',
        confirmLabel: 'Save the correction',
      });
      if (!confirmed) return;
      const body = {
        movementType: 'correction',
        correctsMovementId: original.id,
        birdChange: correctionAmountFor(original, birds),
        reason: values.reason.trim(),
      };
      if (original.correctedByMovementId) body.replacesMovementId = original.correctedByMovementId;
      try {
        const { message } = await recordMovement(farm.id, flockId, body);
        openCorrection = null;
        await afterChange(message || 'Correction recorded.');
      } catch (error) {
        if (error.status === 401) { saveDraft(draftId, user.id, values); return; }
        showErrors(form, error, summary, { ...MOVEMENT_FIELD_LABELS, birdChange: 'Correct number of birds' });
        if (error.status === 409) {
          summary.append(h('p', {}, 'The history changed since you opened it. ',
            h('button', { type: 'button', class: 'button button--secondary button--small', onclick: () => { openCorrection = original.id; load(); } }, 'Reload the history')));
        }
      }
    }, { busyText: 'Saving…' });

    const toggle = h('button', { type: 'button', class: 'button button--secondary button--small',
      'aria-label': `Correct this entry: ${MOVEMENT_LABELS[original.movementType]} on ${formatDate(original.movementDate)}` }, 'Correct this entry');
    toggle.addEventListener('click', () => {
      openCorrection = original.id;
      form.hidden = false;
      toggle.hidden = true;
      form.elements.birds.focus();
    });
    toggle.hidden = !form.hidden;
    return [h('div', {}, toggle), summary, form];
  }

  function movementItem(m, corrections, canCorrect) {
    const corrected = m.correctedByMovementId != null;
    return h('li', { class: 'item movement', dataset: { movementId: String(m.id) } },
      h('p', { class: 'item__title' }, `${MOVEMENT_LABELS[m.movementType] || m.movementType}: ${formatChange(m.birdChange)}`),
      h('p', {}, `${formatDate(m.movementDate)}`, m.birdsAgeWeeks != null ? `, birds ${m.birdsAgeWeeks} weeks old` : ''),
      corrected ? h('p', {}, statusLabel('warning', `Corrected: now counts as ${formatChange(m.birdChangeAfterCorrection)}`)) : null,
      userText('Reason', m.reason),
      userText('Notes', m.notes),
      h('p', { class: 'small-print' }, `Recorded by ${m.recordedByName || 'unknown'}, ${formatUtcAsUgandaDateTime(m.recordedAt)}`),
      corrections.length ? h('div', { class: 'corrections' },
        h('p', { class: 'corrections__title' }, `Corrections of this entry (${corrections.length})`),
        h('ul', { class: 'plain-list' }, corrections.map((c) => h('li', {},
          h('span', {}, `${formatChange(c.correctionAmount)} to this entry`),
          ' – ', h('strong', {}, c.isEffective ? 'in effect' : 'replaced by a later correction'),
          h('br'), userText('Reason', c.reason),
          h('span', { class: 'small-print' }, `Recorded by ${c.recordedByName || 'unknown'}, ${formatUtcAsUgandaDateTime(c.recordedAt)}`))))) : null,
      canCorrect ? correctionForm(m, corrections) : null);
  }

  function historyCard(flock, movementsData) {
    const canCorrect = flock.status === 'active' && canDo(role, 'flocks:manage');
    const all = movementsData.movements;
    const originals = all.filter((m) => m.movementType !== 'correction');
    const correctionsOf = (id) => all.filter((m) => m.movementType === 'correction' && m.correctsMovementId === id);
    const notes = movementsData.fieldNotes || {};
    return h('section', { class: 'card', 'aria-labelledby': 'flock-history' },
      h('h2', { id: 'flock-history' }, 'History of bird numbers'),
      h('p', {}, 'Every change to the number of birds, oldest first. Entries are never changed or deleted: a mistake is fixed by a correction, shown under the entry it corrects.'),
      notes.liveCountCheck ? h('p', { class: 'small-print' }, notes.liveCountCheck) : null,
      h('ul', { class: 'item-list' }, originals.map((m) => movementItem(m, correctionsOf(m.id), canCorrect))));
  }

  function closeSection(flock) {
    const draftId = `close-${flock.id}`;
    const summary = h('div', { 'aria-live': 'polite' });
    const today = ugandaToday();
    const form = h('form', { class: 'form' },
      inputField({ name: 'closureDate', label: 'Closure date', type: 'date', required: true, value: today,
        hint: 'Not before the last recorded change to the birds.', attrs: { min: flock.arrivalDate, max: today } }),
      radioField({ name: 'closureReason', label: 'Why is the flock closing?', required: true,
        options: Object.entries(CLOSURE_REASON_LABELS).map(([value, label]) => ({ value, label })) }),
      textareaField({ name: 'closureNotes', label: 'Closure notes', maxlength: 1000, rows: 2 }),
      h('div', { class: 'button-row' }, h('button', { type: 'submit', class: 'button button--secondary' }, 'Close the flock')));
    const draft = takeDraft(draftId, user.id);
    if (draft) fillForm(form, draft);
    guardSubmit(form, async () => {
      clearErrors(form, summary);
      const values = formValues(form);
      const confirmed = await confirmDialog({
        title: `Close "${flock.name}"?`,
        message: 'Closing is final:',
        items: [
          'a closed flock cannot be reopened, changed or deleted, and no more changes can be recorded for it;',
          'its history and records stay available to view;',
          'its pending tasks due on or after the closure date are cancelled;',
          'a farm task to clean out and rest the house is added.',
        ],
        confirmLabel: 'Close the flock',
      });
      if (!confirmed) return;
      const body = { closureDate: values.closureDate, closureReason: values.closureReason };
      if (values.closureNotes.trim()) body.closureNotes = values.closureNotes.trim();
      try {
        const { message } = await closeFlock(farm.id, flock.id, body);
        await afterChange(message || 'Flock closed.');
      } catch (error) {
        if (error.status === 401) { saveDraft(draftId, user.id, values); return; }
        showErrors(form, error, summary, { closureDate: 'Closure date', closureReason: 'Why is the flock closing?', closureNotes: 'Closure notes', liveBirds: 'Birds alive' });
      }
    }, { busyText: 'Closing…' });
    return h('section', { class: 'card', 'aria-labelledby': 'close-flock' },
      h('h2', { id: 'close-flock' }, 'Close this flock'),
      h('p', {}, 'Close the flock when it has no birds left (all sold, culled, transferred or dead). A closed flock is kept as a record and cannot be reopened.'),
      flock.liveBirds > 0 ? alertBox('info', `This flock still has ${formatNumber(flock.liveBirds)} birds alive. Record what happened to them before closing it.`) : null,
      summary, form);
  }

  function deleteSection(flock) {
    const result = h('div', { 'aria-live': 'polite' });
    const button = h('button', { type: 'button', class: 'button button--danger-outline' }, 'Delete this flock');
    button.addEventListener('click', async () => {
      result.replaceChildren();
      const confirmed = await confirmDialog({
        title: `Delete "${flock.name}"?`,
        message: 'Only a flock recorded by mistake should be deleted. PoultryStart refuses to delete a flock that already has history: '
          + 'recorded changes to its birds, completed tasks, production records, health observations or linked expenses. Such a flock is kept, and can be closed later.',
        confirmLabel: 'Delete the flock',
        danger: true,
      });
      if (!confirmed) return;
      button.disabled = true;
      try {
        const { message } = await deleteFlock(farm.id, flock.id);
        setFlash('success', message || 'Flock deleted.');
        navigate(`/farms/${farm.id}/flocks`);
      } catch (error) {
        button.disabled = false;
        if (error.status === 401) return;
        const box = alertBox('error', `The flock was NOT deleted. ${error.message}`);
        result.replaceChildren(box);
        box.focus();
      }
    });
    return h('section', { class: 'card danger-zone', 'aria-labelledby': 'delete-flock' },
      h('h2', { id: 'delete-flock' }, 'Delete this flock'),
      h('p', {}, 'Only for a flock recorded by mistake. A flock with history cannot be deleted.'),
      result, button);
  }

  const TYPE = { broiler: 'Broilers', layer: 'Layers' };
  const isOwner = canOpen(role, 'expenses');
  const TABS = hubTabs({ canSeeMoney: isOwner });
  let tab = pickTab(query.tab, TABS);
  let state = null;
  const lazy = { health: null, money: null };
  const panel = h('div', { id: 'flock-panel', class: 'hub-panel', role: 'tabpanel' });
  const tabBar = h('div', {});

  const hubHref = (id) => `#/farms/${farm.id}/flocks/${flockId}${id === 'overview' ? '' : `?tab=${id}`}`;

  function selectTab(id, { focusTab = false } = {}) {
    if (id === tab) return;
    tab = id;
    window.history.pushState(null, '', hubHref(id));
    drawTabs();
    drawPanel();
    if (focusTab) tabBar.querySelector(`#tab-${id}`)?.focus();
  }

  function drawTabs() {
    setContent(tabBar, tabs({ label: 'Flock sections', items: TABS, selected: tab, panelId: 'flock-panel',
      onSelect: (id) => selectTab(id, { focusTab: true }) }));
    panel.setAttribute('aria-labelledby', `tab-${tab}`);
  }

  const dayOf = (summary, date) => (summary?.days || []).find((d) => d.date === date) || null;

  function tile(label, value, { warning = false, action = null } = {}) {
    return h('div', { class: `hub-tile${warning ? ' hub-tile--warning' : ''}` },
      h('p', { class: 'hub-tile__label' }, label), h('p', { class: 'hub-tile__value' }, value), action);
  }

  function summaryTiles(s) {
    const { flock, today } = s;
    if (flock.status !== 'active') {
      return [tile('Birds alive', formatNumber(flock.liveBirds)), tile('Birds received', formatNumber(flock.birdsReceived)),
        tile('Closed', flock.closedAt ? formatDate(String(flock.closedAt).slice(0, 10)) : 'Not known')];
    }
    const tiles = [tile('Birds alive', formatNumber(flock.liveBirds))];
    const deaths = s.dash?.mortality.flocks.find((m) => m.flockId === flock.id);
    if (deaths) tiles.push(tile('Died (7 days)', deaths.netDeaths === null ? 'None recorded' : formatNumber(deaths.netDeaths)));
    const record = (path) => (canDo(role, 'production:create')
      ? h('a', { class: 'hub-tile__action', href: `#/farms/${farm.id}/records/${path}/new?flockId=${flock.id}` }, 'Record now') : null);
    if (s.eggs) {
      const d = dayOf(s.eggs, today);
      tiles.push(d ? tile('Eggs today', formatNumber(d.totalEggs)) : tile('Eggs today', 'Not recorded', { warning: true, action: record('eggs') }));
    }
    const feed = dayOf(s.feed, today);
    tiles.push(feed ? tile('Feed today', `${formatNumber(feed.total)} kg`) : tile('Feed today', 'Not recorded', { warning: true, action: record('feed') }));
    const water = dayOf(s.water, today);
    tiles.push(water ? tile('Water today', `${formatNumber(water.total)} L`) : tile('Water today', 'Not recorded', { warning: true, action: record('water') }));
    return tiles;
  }

  function header(s) {
    const { flock } = s;
    const active = flock.status === 'active';
    const adviceFlock = s.advice?.flocks?.find((f) => f.id === flock.id);
    const stageText = active && adviceFlock?.stageLabel ? shortLabel(adviceFlock.stageLabel) : null;
    const badge = active
      ? [stageText, flock.currentAgeWeeks != null ? `week ${flock.currentAgeWeeks}` : null].filter(Boolean).join(' · ')
      : 'Closed';
    const arrivedAs = (labelFor(STARTING_STAGE_LABELS, flock.startingStage) || '').toLowerCase();
    const bar = active ? stageBar(s.topicStages, flock.poultryType, adviceFlock?.stage) : null;
    return h('div', { class: 'hub-head' },
      h('nav', { class: 'hub-crumbs', 'aria-label': 'Breadcrumb' },
        h('a', { href: `#/farms/${farm.id}/flocks` }, 'Flocks Management'), h('span', { 'aria-hidden': 'true' }, ' / '),
        h('span', { 'aria-current': 'page' }, flock.name)),
      h('div', { class: 'hub-titlerow' },
        h('div', { class: 'hub-title' }, heading, badge ? h('span', { class: `hub-badge${active ? '' : ' hub-badge--closed'}` }, badge) : null),
        active ? h('div', { class: 'hub-actions' },
          canDo(role, 'health:create') ? h('a', { class: 'hub-btn hub-btn--secondary', href: `#/farms/${farm.id}/health/new?flockId=${flock.id}` }, 'Report a problem') : null,
          canDo(role, 'production:create') ? h('a', { class: 'hub-btn', href: `#/farms/${farm.id}/record` }, '+ Record today') : null) : null),
      h('p', { class: 'hub-meta' }, `${TYPE[flock.poultryType] || flock.poultryType} · ${formatNumber(flock.birdsReceived)} arrived ${formatDate(flock.arrivalDate)}`
        + (arrivedAs ? ` as ${arrivedAs}` : '')),
      active
        ? (bar ? h('div', { class: 'hub-stages' }, stageProgress({ stages: bar.stages, current: bar.current })) : null)
        : h('p', { class: 'hub-closed' }, `Closed on ${flock.closedAt ? formatDate(String(flock.closedAt).slice(0, 10)) : 'an unknown date'}`
          + ` · ${CLOSURE_REASON_LABELS[flock.closureReason] ? shortLabel(CLOSURE_REASON_LABELS[flock.closureReason]) : 'reason not given'}`
          + '. It is kept as a record and is no longer progressing through stages.'),
      h('div', { class: 'hub-tiles' }, summaryTiles(s)));
  }

  function chartCard(s) {
    const { flock, today } = s;
    const eggs = Boolean(s.eggs);
    const summary = eggs ? s.eggs : s.feed;
    const field = eggs ? 'totalEggs' : 'total';
    const dates = Array.from({ length: 14 }, (_, i) => addDaysIso(today, i - 13));
    const values = dates.map((date) => { const d = dayOf(summary, date); return { date, value: d ? d[field] : null }; });
    const recorded = values.filter((v) => v.value !== null);
    const max = Math.max(0, ...recorded.map((v) => v.value));
    const title = eggs ? 'Eggs per day, last 14 days' : 'Feed per day, last 14 days (kg)';
    const report = canOpen(role, 'reports')
      ? `#/farms/${farm.id}/reports/production?flockId=${flock.id}`
      : `#/farms/${farm.id}/records/${eggs ? 'eggs' : 'feed'}?flockId=${flock.id}`;
    const describe = values.map((v) => `${formatDate(v.date)} ${v.value === null ? 'not recorded' : formatNumber(v.value)}`).join(', ');
    return h('section', { class: 'hub-card hub-chart', 'aria-labelledby': 'hub-chart-title' },
      h('div', { class: 'hub-card__head' }, h('h2', { id: 'hub-chart-title' }, title), h('a', { href: report }, 'Full report')),
      recorded.length === 0
        ? h('p', { class: 'hub-muted' }, `Nothing recorded in the last 14 days.${flock.status === 'active' ? '' : ' The flock is closed.'}`)
        : [h('div', { class: 'hub-bars', role: 'img', 'aria-label': `${title}: ${describe}` }, values.map((v, i) => {
          const bar = h('span', { class: `hub-bars__bar${i === values.length - 1 ? ' is-latest' : ''}` });
          if (v.value !== null) bar.style.height = `${max > 0 ? Math.max(3, Math.round((v.value / max) * 100)) : 3}%`;
          return h('div', { class: `hub-bars__col${v.value === null ? ' is-missing' : ''}` },
            h('span', { class: 'hub-bars__value' }, v.value === null ? '–' : formatNumber(v.value)), v.value === null ? null : bar);
        })),
        h('div', { class: 'hub-bars__ends', 'aria-hidden': 'true' }, h('span', {}, formatDate(dates[0]).replace(/ \d{4}$/, '')), h('span', {}, 'Today')),
        values.some((v) => v.value === null) ? h('p', { class: 'hub-note' }, '– means nothing was recorded that day.') : null]);
  }

  function comingUpCard(s) {
    const t = s.dash?.tasks?.today;
    const mine = t && t.state !== 'not_generated' ? t.openTasks.filter((x) => x.flockId === s.flock.id) : null;
    return h('section', { class: 'hub-card hub-coming', 'aria-labelledby': 'hub-coming-title' },
      h('h2', { id: 'hub-coming-title' }, 'Coming up today'),
      mine && mine.length
        ? h('ul', {}, mine.map((x) => h('li', {}, h('a', { href: `#/farms/${farm.id}/tasks/${x.id}` }, h('span', { class: 'hub-dot', 'aria-hidden': 'true' }), x.title))))
        : h('p', { class: 'hub-muted' }, mine ? 'No open tasks for this flock today.'
          : 'Today\'s tasks are on the task list. Opening it prepares them.'),
      h('a', { class: 'hub-link', href: `#/farms/${farm.id}/tasks` }, 'Open the task list'));
  }

  function adviceCard(s) {
    if (!s.advice) return h('section', { class: 'hub-card' }, h('h2', {}, 'Advice'), h('p', { class: 'hub-muted' }, 'Advice could not be loaded.'));
    const items = s.advice.advice.filter((a) => !a.flockId || a.flockId === s.flock.id).slice(0, 2);
    return h('section', { class: 'hub-card hub-advice', 'aria-labelledby': 'hub-advice-title' },
      h('h2', { id: 'hub-advice-title' }, 'Advice'),
      items.length ? h('ul', {}, items.map((a) => h('li', { class: `hub-advice__item hub-advice__item--${a.priority}` },
        h('span', { class: 'hub-dot', 'aria-hidden': 'true' }),
        h('div', {}, h('p', { class: 'hub-advice__title' }, a.title), h('p', {}, a.message),
          h('a', { href: `#/farms/${farm.id}/advisor?flockId=${s.flock.id}` }, 'Why this advice')))))
        : h('p', { class: 'hub-muted' }, 'No advice from this flock\'s records right now.'),
      h('p', { class: 'hub-note' }, s.advice.limitation));
  }

  function overviewPanel(s) {
    const links = [['feed', 'Feed records'], ['water', 'Water records'], ...(s.flock.poultryType === 'layer' ? [['eggs', 'Egg records']] : []), ['weights', 'Weight records']];
    return h('div', { class: 'hub-overview' },
      h('div', { class: 'hub-main' }, chartCard(s),
        h('section', { class: 'hub-card', 'aria-labelledby': 'hub-records-title' }, h('h2', { id: 'hub-records-title' }, 'Records of this flock'),
          h('div', { class: 'hub-linkrow' }, links.map(([path, label]) => h('a', { href: `#/farms/${farm.id}/records/${path}?flockId=${s.flock.id}` }, label))))),
      h('div', { class: 'hub-side' },
        s.flock.status === 'active' ? comingUpCard(s) : null,
        adviceCard(s),
        s.flock.status === 'active' && canDo(role, 'expenses:record')
          ? h('a', { class: 'hub-btn hub-btn--secondary hub-btn--block', href: `#/farms/${farm.id}/expenses/new?flockId=${s.flock.id}` }, 'Add expense for this flock') : null));
  }

  function historyPanel(s) {
    const { flock } = s;
    const active = flock.status === 'active';
    return h('div', { class: 'hub-stack' },
      active ? null : alertBox('info', 'This flock is closed. It is kept as a record: it cannot be changed or reopened.', { title: 'Read-only' }),
      birdsCard(flock),
      active && canDo(role, 'flocks:record_mortality') ? mortalityForm(flock) : null,
      active && canDo(role, 'flocks:manage') ? otherMovementForm(flock) : null,
      historyCard(flock, s.movementsData));
  }

  function healthPanel(s) {
    const box = h('div', { class: 'hub-stack' }, loadingBlock('Loading the health observations…'));
    const draw = (data) => setContent(box,
      h('div', { class: 'button-row' },
        canDo(role, 'health:create') ? h('a', { class: 'button', href: `#/farms/${farm.id}/health/new?flockId=${s.flock.id}` }, 'Record a health observation') : null,
        h('a', { class: 'button button--secondary', href: `#/farms/${farm.id}/health/flocks/${s.flock.id}` }, 'All observations, by date')),
      h('p', {}, "Notes of what was noticed about these birds' health. Deaths are recorded on the History tab, not here."),
      h('p', {}, `${data.observations.length} observation${data.observations.length === 1 ? '' : 's'} from ${formatDate(data.from)} to ${formatDate(data.to)}.`),
      data.observations.length === 0
        ? h('p', { class: 'card' }, 'No health observations recorded for these dates.')
        : h('ul', { class: 'card-list' }, data.observations.map((o) => observationItem(farm.id, o, s.flock.name))),
      disclaimerBox(data.disclaimer || HEALTH_DISCLAIMER));
    const fetchIt = () => {
      setContent(box, loadingBlock('Loading the health observations…'));
      lazy.health = lazy.health || listFlockObservations(farm.id, flockId).then((r) => r.data);
      lazy.health.then((data) => { if (box.isConnected) draw(data); }).catch((error) => {
        lazy.health = null;
        if (error.status !== 401 && box.isConnected) setContent(box, errorBlock(error, { onRetry: fetchIt }));
      });
    };
    fetchIt();
    return box;
  }

  function moneyPanel(s) {
    const box = h('div', { class: 'hub-stack' }, loadingBlock('Loading the expenses…'));
    const fetchIt = () => {
      setContent(box, loadingBlock('Loading the expenses…'));
      lazy.money = lazy.money || Promise.all([listExpenses(farm.id, { flockId }), getExpenseSummary(farm.id, { flockId })])
        .then(([a, b]) => ({ list: a.data, summary: b.data.summary }));
      lazy.money.then(({ list, summary }) => {
        if (!box.isConnected) return;
        setContent(box,
          h('div', { class: 'button-row' },
            canDo(role, 'expenses:record') ? h('a', { class: 'button', href: `#/farms/${farm.id}/expenses/new?flockId=${s.flock.id}` }, 'Record an expense for this flock') : null,
            h('a', { class: 'button button--secondary', href: `#/farms/${farm.id}/expenses/flocks/${s.flock.id}` }, 'Choose other dates')),
          h('p', {}, `Expenses linked to this flock from ${formatDate(list.from)} to ${formatDate(list.to)}, voided ones included. `
            + 'Farm-wide expenses that are not linked to a flock are not counted here; they are on ',
          h('a', { href: `#/farms/${farm.id}/money` }, 'Money'), '.'),
          summaryBlock(summary, { headingId: 'hub-money-summary', title: 'Totals for this flock', showFlocks: false }),
          list.expenses.length === 0
            ? h('p', { class: 'card' }, 'No expenses linked to this flock for these dates.')
            : h('ul', { class: 'card-list' }, list.expenses.map((e) => expenseItem(farm.id, e))));
      }).catch((error) => {
        lazy.money = null;
        if (error.status !== 401 && box.isConnected) setContent(box, errorBlock(error, { onRetry: fetchIt }));
      });
    };
    fetchIt();
    return box;
  }

  function detailsPanel(s) {
    const { flock } = s;
    const active = flock.status === 'active';
    return h('div', { class: 'hub-stack' },
      active ? null : alertBox('info', 'This flock is closed. It is kept as a record: it cannot be changed or reopened.', { title: 'Read-only' }),
      detailsCard(flock, { canEdit: active && canDo(role, 'flocks:manage'), farmId: farm.id }),
      changeHistoryCard(flock),
      active && canDo(role, 'flocks:manage') ? closeSection(flock) : null,
      active && canDo(role, 'records:delete') ? deleteSection(flock) : null);
  }

  function drawPanel() {
    if (!state) return;
    const make = { overview: overviewPanel, history: historyPanel, health: healthPanel, money: moneyPanel, details: detailsPanel }[tab];
    setContent(panel, make(state));
  }

  async function load() {
    try {
      const [{ data: flockData }, { data: movementsData }, advice, dash, topicStages] = await Promise.all([
        getFlock(farm.id, flockId), listMovements(farm.id, flockId),
        getAdvice(farm.id, { flockId }).then((r) => r.data).catch((error) => { if (error.status === 401) throw error; return null; }),
        canOpen(role, 'dashboard') ? getDashboard(farm.id).then((r) => r.data) : null,
        getTopics().then((r) => r.data.stages).catch(() => null),
      ]);
      if (!body.isConnected) return;
      const { flock } = flockData;
      const today = dash?.date || advice?.date || ugandaToday();
      const from = addDaysIso(today, -13);
      const layingNow = flock.poultryType === 'layer' && flock.firstEggDate && flock.firstEggDate <= today;
      const summary = (path) => getSummary(farm.id, flock.id, path, { from, to: today }).then((r) => r.data.summary);
      const [feed, water, eggs] = await Promise.all([summary('feed'), summary('water'), layingNow ? summary('eggs') : null]);
      state = { flock, movementsData, advice, dash, today, feed, water, eggs, topicStages };
      lazy.health = null;
      lazy.money = null;
      heading.textContent = flock.name;
      drawTabs();
      setContent(body, header(state), tabBar, panel);
      drawPanel();
    } catch (error) {
      if (error.status === 401 || !body.isConnected) return;
      setContent(body, errorBlock(error, {
        onRetry: error.status === 0 || error.status >= 500 ? load : undefined,
        actions: [h('a', { class: 'button', href: `#/farms/${farm.id}/flocks` }, 'All flocks')],
      }));
    }
  }
  setContent(body, loadingBlock('Loading the flock…'));
  load();

  return h('div', { class: 'hub' }, takeFlash(), messages, body);
}
