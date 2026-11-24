// Task statuses, names, record links and the "Mark as done" form.
import { EXPENSE_CATEGORIES } from './expenses.js';
import { articleHref } from './guidance.js';
import { h } from './dom.js';
import { statusLabel, alertBox } from './alerts.js';
import { textareaField, checkboxField, guardSubmit, showErrors, clearErrors, formValues, fillForm, saveDraft, takeDraft } from './forms.js';
import { completeTask } from '../api/tasks.js';
import { listFlocks } from '../api/flocks.js';
import { listMembers } from '../api/members.js';
import { canOpen } from '../farm/access.js';
import { formatDate } from '../utils/dates.js';

export const TASK_STATUS = {
  pending: ['info', 'To do'],
  overdue: ['warning', 'Overdue'],
  missed: ['error', 'Missed'],
  completed: ['success', 'Done'],
  cancelled: ['info', 'Cancelled'],
};

export const FREQUENCY_LABELS = {
  daily: 'Daily task',
  weekly: 'Weekly task (can be done on any day of its week)',
  interval: 'Repeats every few days',
  once: 'One-off task',
};

export const TIME_SLOT_LABELS = { morning: 'Morning', midday: 'Midday', evening: 'Evening', any: 'Any time of day' };

export function taskStatusLabel(task) {
  const [kind, text] = TASK_STATUS[task.displayStatus] || ['info', task.displayStatus];
  return statusLabel(kind, task.displayStatus === 'completed' && task.completedLate ? 'Done late' : text);
}


export const isOpen = (task) => task.displayStatus === 'pending' || task.displayStatus === 'overdue';

export const MISSED_EXPLANATION = 'This daily task was not done on its day. It stays missed: nobody can complete it now. '
  + 'The farm owner or a manager can add a review note.';


export async function loadNames(farm) {
  const [{ data: flockData }, members] = await Promise.all([
    listFlocks(farm.id),
    canOpen(farm.myRole, 'members') ? listMembers(farm.id).then((r) => r.data.members) : Promise.resolve([]),
  ]);
  return {
    flocks: new Map(flockData.flocks.map((f) => [f.id, f])),
    members: new Map(members.map((m) => [m.userId, m.name])),
  };
}

export function flockText(task, names) {
  if (task.flockId == null) return 'Farm task (not for one flock)';
  const flock = names.flocks.get(task.flockId);
  return flock ? `Flock: ${flock.name}${flock.status === 'closed' ? ' (closed)' : ''}` : 'Flock task';
}

export function personText(userId, names, user) {
  if (userId == null) return null;
  if (userId === user.id) return 'you';
  return names.members.get(userId) || 'another farm member';
}

export function dueText(task) {
  return task.frequency === 'weekly' ? `Week starting ${formatDate(task.dueDate)}` : `Due ${formatDate(task.dueDate)}`;
}

export function recordLinkTarget(farm, task, link) {
  if (link.type === 'flock_mortality' || link.type === 'flock_sale' || link.type === 'flock_correction') {
    return task.flockId ? { href: `#/farms/${farm.id}/flocks/${task.flockId}`, planned: null } : null;
  }
  
  if (link.type === 'expenses') {
    let category = null;
    try { category = new URL(link.path || '', 'http://link.invalid').searchParams.get('category'); } catch { category = null; }
    const query = new URLSearchParams({
      ...(task.flockId ? { flockId: String(task.flockId) } : {}),
      ...(category && EXPENSE_CATEGORIES[category] ? { category } : {}),
      taskId: String(task.id),
    });
    return { href: `#/farms/${farm.id}/expenses/new?${query}`, planned: null };
  }
  if (link.type === 'health_records') {
    const query = new URLSearchParams({ ...(task.flockId ? { flockId: String(task.flockId) } : {}), taskId: String(task.id) });
    return { href: `#/farms/${farm.id}/health/new?${query}`, planned: null };
  }
  
  const path = PRODUCTION_LINKS[link.type];
  if (path) {
    const query = new URLSearchParams({ ...(task.flockId ? { flockId: String(task.flockId) } : {}), taskId: String(task.id) });
    return { href: `#/farms/${farm.id}/records/${path}/new?${query}`, planned: null };
  }
  return { href: `#/farms/${farm.id}/records`, planned: null };
}

const PRODUCTION_LINKS = { weight_records: 'weights', egg_records: 'eggs', feed_records: 'feed', water_records: 'water' };

export function recordLinksBlock(farm, task) {
  const links = task.recordLinks || [];
  if (links.length === 0) return null;
  return h('div', {},
    h('h3', {}, 'Where to record the details'),
    h('p', { class: 'small-print' }, 'Completing the task does not record any numbers. Record them in their own form.'),
    h('ul', { class: 'plain-list' }, links.map((link) => {
      const target = recordLinkTarget(farm, task, link);
      return h('li', {},
        target ? h('a', { href: target.href }, link.label) : link.label,
        target?.planned ? [' ', h('span', { class: 'tag-planned' }, 'Coming later', h('span', { class: 'visually-hidden' }, ` (phase ${target.planned})`))] : null,
        typeof link.recordsForTaskPeriod === 'number'
          ? h('span', { class: 'small-print' }, ` – ${link.recordsForTaskPeriod} recorded for this task's ${task.frequency === 'weekly' ? 'week' : 'day'}`) : null,
        link.message ? h('span', { class: 'small-print' }, ` ${link.message}`) : null);
    })));
}

export function guidanceLinksBlock(farm, task) {
  const links = task.guidanceLinks || [];
  if (links.length === 0) return null;
  return h('div', {},
    h('h3', {}, 'Guidance for this task'),
    h('ul', { class: 'plain-list' }, links.map((link) => {
      const href = articleHref(link.code);
      return h('li', {},
        href ? h('a', { href }, link.title) : link.title,
        h('span', { class: 'small-print' }, ` (article ${link.code})`));
    })));
}

export function completionForm({ farm, task, user, onDone, idPrefix }) {
  const draftId = `complete-${task.id}`;
  const summary = h('div', { 'aria-live': 'polite' });
  const form = h('form', { class: 'form completion-form' },
    checkboxField({ name: 'problemReported', id: `${idPrefix}-problem-${task.id}`, label: 'There was a problem',
      hint: 'If birds are sick or dying, also record a health observation and contact your veterinarian or extension officer.' }),
    textareaField({ name: 'notes', id: `${idPrefix}-notes-${task.id}`, label: 'Notes', maxlength: 1000, rows: 2,
      hint: 'Optional. Required if there was a problem: describe it.' }),
    h('div', { class: 'button-row' }, h('button', { type: 'submit', class: 'button' }, 'Mark as done')));
  const problem = form.elements.problemReported;
  const notes = form.elements.notes;
  problem.addEventListener('change', () => { notes.required = problem.checked; });
  const draft = takeDraft(draftId, user.id);
  if (draft) {
    fillForm(form, draft);
    notes.required = problem.checked;
    summary.append(alertBox('info', 'We kept what you had entered before your session expired. Check it and select "Mark as done" again. Nothing was saved yet.'));
  }
  guardSubmit(form, async () => {
    clearErrors(form, summary);
    const values = formValues(form);
    try {
      const { data, message } = await completeTask(farm.id, task.id, { notes: values.notes.trim(), problemReported: values.problemReported });
      onDone(data.task, message || 'Task completed.');
    } catch (error) {
      if (error.status === 401) { saveDraft(draftId, user.id, values); return; }
      showErrors(form, error, summary, { notes: 'Notes', problemReported: 'There was a problem' });
    }
  }, { busyText: 'Saving…' });
  return h('div', { dataset: { restored: draft ? 'true' : 'false' } }, summary, form);
}
