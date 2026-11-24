// One task page with its actions and history.
import { h, pageHeading, setContent } from '../components/dom.js';
import { alertBox, statusLabel, takeFlash } from '../components/alerts.js';
import { loadingBlock, errorBlock } from '../components/loading.js';
import { textareaField, guardSubmit, showErrors, clearErrors, formValues, fillForm, saveDraft, takeDraft } from '../components/forms.js';
import { confirmDialog } from '../components/confirm.js';
import {
  taskStatusLabel, isOpen, flockText, personText, dueText, loadNames, completionForm, recordLinksBlock, guidanceLinksBlock,
  FREQUENCY_LABELS, TIME_SLOT_LABELS, MISSED_EXPLANATION,
} from '../components/tasks.js';
import { getTask, cancelTask, reopenTask, addReviewNote } from '../api/tasks.js';
import { updateCachedTask } from '../farm/task-cache.js';
import { canDo } from '../farm/access.js';
import { formatUtcAsUgandaDateTime } from '../utils/dates.js';

const row = (label, value) => (value === null || value === undefined || value === '' ? null : [h('dt', {}, label), h('dd', {}, value)]);
const userText = (label, text) => (text ? h('p', { class: 'user-text' }, h('strong', {}, `${label}: `), text) : null);

export function taskDetailPage({ user, farmContext, params }) {
  const { farm } = farmContext;
  const role = farm.myRole;
  const taskId = Number(params.taskId);
  const heading = pageHeading('Task');
  const messages = h('div', { 'aria-live': 'polite' });
  const body = h('div', {}, loadingBlock('Loading the task…'));
  const backHref = `#/farms/${farm.id}/tasks?view=cached`;
  let names = null;

  function announce(kind, text) {
    const box = alertBox(kind, text);
    messages.replaceChildren(box);
    box.focus();
  }

  function changed(task, message) {
    updateCachedTask(farm.id, task);
    render(task);
    announce('success', message);
  }

  function textActionForm({ id, name, label, hint, button, required = true, confirm, send, draftId }) {
    const summary = h('div', { 'aria-live': 'polite' });
    const form = h('form', { class: 'form' },
      textareaField({ name, id, label, hint, required, maxlength: name === 'note' ? 1000 : 500, rows: 2 }),
      h('div', { class: 'button-row' }, h('button', { type: 'submit', class: 'button button--secondary' }, button)));
    const draft = takeDraft(draftId, user.id);
    if (draft) fillForm(form, draft);
    guardSubmit(form, async () => {
      clearErrors(form, summary);
      const values = formValues(form);
      if (confirm && !(await confirmDialog(confirm))) return;
      try {
        const { data, message } = await send(values[name].trim());
        changed(data.task, message);
      } catch (error) {
        if (error.status === 401) { saveDraft(draftId, user.id, values); return; }
        showErrors(form, error, summary, { [name]: label });
      }
    }, { busyText: 'Saving…' });
    return h('div', {}, summary, form);
  }

  function historyBlock(task) {
    const seesReviewNotes = canDo(role, 'tasks:manage');
    const events = (task.history || []).filter((e) => seesReviewNotes || e.eventType !== 'review_note');
    if (events.length === 0) return null;
    return h('section', { class: 'card', 'aria-labelledby': 'task-history' },
      h('h2', { id: 'task-history' }, 'History'),
      h('ul', { class: 'item-list' }, events.map((e) => h('li', { class: 'item' },
        h('p', { class: 'item__title' }, e.eventType === 'review_note' ? 'Review note' : 'Reopened'),
        userText(e.eventType === 'review_note' ? 'Note' : 'Reason', e.note),
        e.previousCompletion ? h('p', { class: 'small-print' },
          `Earlier completion: ${formatUtcAsUgandaDateTime(e.previousCompletion.completedAt)}`,
          e.previousCompletion.problemReported ? ', problem reported' : '') : null,
        e.previousCompletion?.completionNotes ? userText('Earlier notes', e.previousCompletion.completionNotes) : null,
        h('p', { class: 'small-print' }, `By ${e.userName || 'unknown'}, ${formatUtcAsUgandaDateTime(e.createdAt)}`)))));
  }

  function render(task) {
    heading.textContent = task.title;
    const manage = canDo(role, 'tasks:manage');
    const open = isOpen(task);
    const assigned = personText(task.assignedTo, names, user);
    const completedBy = personText(task.completedBy, names, user);

    setContent(body,
      h('p', {}, taskStatusLabel(task), ' ', h('a', { href: backHref }, 'Back to the task list')),
      task.displayStatus === 'missed' ? alertBox('warning', MISSED_EXPLANATION, { title: 'Missed' }) : null,
      task.disclaimer ? alertBox('info', task.disclaimer) : null,

      h('section', { class: 'card', 'aria-labelledby': 'task-about' },
        h('h2', { id: 'task-about' }, 'About this task'),
        task.description ? h('p', { class: 'user-text' }, task.description) : null,
        h('dl', { class: 'details' },
          row('When', dueText(task)),
          row('Time of day', TIME_SLOT_LABELS[task.timeSlot] || task.timeSlot),
          row('How often', FREQUENCY_LABELS[task.frequency] || task.frequency),
          row('For', flockText(task, names)),
          row('Assigned to', assigned || 'Nobody (anyone on the farm can do it)'),
          row('Created', task.source === 'generated' ? 'By PoultryStart, from its task catalogue' : 'By a farm owner or manager'),
          row('Task code', task.templateCode)),
        manage && open ? h('div', { class: 'button-row' },
          h('a', { class: 'button button--secondary', href: `#/farms/${farm.id}/tasks/${task.id}/edit` },
            task.source === 'generated' ? 'Assign the task' : 'Edit the task')) : null),

      task.displayStatus === 'completed' ? h('section', { class: 'card', 'aria-labelledby': 'task-done' },
        h('h2', { id: 'task-done' }, 'Done'),
        h('dl', { class: 'details' },
          row('Completed', formatUtcAsUgandaDateTime(task.completedAt)),
          row('By', completedBy),
          row('On time?', task.completedLate ? 'Done after its last day' : 'Yes')),
        task.problemReported ? h('p', {}, statusLabel('warning', 'A problem was reported')) : null,
        userText('Notes', task.completionNotes),
        task.problemReported ? h('p', { class: 'small-print' }, 'A reported problem is not a diagnosis. If birds are sick or dying, record a health observation and contact your veterinarian or extension officer.') : null) : null,

      task.displayStatus === 'cancelled' ? h('section', { class: 'card', 'aria-labelledby': 'task-cancelled' },
        h('h2', { id: 'task-cancelled' }, 'Cancelled'),
        h('dl', { class: 'details' }, row('Cancelled', formatUtcAsUgandaDateTime(task.cancelledAt))),
        userText('Reason', task.cancelReason)) : null,

      open && canDo(role, 'tasks:complete') ? h('section', { class: 'card', 'aria-labelledby': 'task-complete' },
        h('h2', { id: 'task-complete' }, 'Mark as done'),
        completionForm({ farm, task, user, idPrefix: 'detail', onDone: changed })) : null,

      task.guidance || task.recordLinks?.length || task.guidanceLinks?.length ? h('section', { class: 'card', 'aria-labelledby': 'task-help' },
        h('h2', { id: 'task-help' }, 'Why and how'),
        task.guidance?.basis ? h('p', {}, task.guidance.basis) : null,
        task.guidance?.labels?.length ? h('p', { class: 'small-print' }, `Evidence: ${task.guidance.labels.join('; ')}`) : null,
        task.guidance?.sources?.length ? h('ul', { class: 'plain-list small-print' },
          task.guidance.sources.map((s) => h('li', {}, `${s.label}: ${s.explanation}`))) : null,
        recordLinksBlock(farm, task),
        guidanceLinksBlock(farm, task)) : null,

      manage ? h('section', { class: 'card', 'aria-labelledby': 'task-review' },
        h('h2', { id: 'task-review' }, 'Add a review note'),
        h('p', {}, 'A review note is kept in the task\'s history. It does not complete or change the task'
          + (task.displayStatus === 'missed' ? ': a missed task stays missed.' : '.')),
        textActionForm({ id: 'review-note', name: 'note', label: 'Review note', button: 'Add the note', draftId: `note-${task.id}`,
          send: (note) => addReviewNote(farm.id, task.id, note) })) : null,

      manage && open ? h('section', { class: 'card', 'aria-labelledby': 'task-cancel' },
        h('h2', { id: 'task-cancel' }, 'Cancel this task'),
        h('p', {}, 'Cancel a task that is no longer needed. It stays in the history with your reason.'),
        textActionForm({ id: 'cancel-reason', name: 'reason', label: 'Reason for cancelling', button: 'Cancel the task', draftId: `cancel-${task.id}`,
          confirm: { title: 'Cancel this task?', message: `"${task.title}" will be cancelled. It stays in the task history and cannot be completed afterwards.`, confirmLabel: 'Cancel the task', cancelLabel: 'Keep the task' },
          send: (reason) => cancelTask(farm.id, task.id, reason) })) : null,

      canDo(role, 'tasks:reopen') && task.displayStatus === 'completed' ? h('section', { class: 'card', 'aria-labelledby': 'task-reopen' },
        h('h2', { id: 'task-reopen' }, 'Reopen this task'),
        h('p', {}, 'Reopen a task that was marked as done by mistake. The earlier completion is kept in the history. '
          + 'A reopened daily task whose day has passed becomes missed.'),
        textActionForm({ id: 'reopen-reason', name: 'reason', label: 'Reason for reopening', button: 'Reopen the task', draftId: `reopen-${task.id}`,
          confirm: { title: 'Reopen this task?', message: 'The task becomes open again. Its earlier completion stays in the history.', confirmLabel: 'Reopen the task' },
          send: (reason) => reopenTask(farm.id, task.id, reason) })) : null,

      historyBlock(task));
  }

  async function load() {
    try {
      const [{ data }, loadedNames] = await Promise.all([getTask(farm.id, taskId), loadNames(farm)]);
      if (!body.isConnected) return;
      names = loadedNames;
      render(data.task);
    } catch (error) {
      if (error.status === 401 || !body.isConnected) return;
      setContent(body, errorBlock(error, {
        onRetry: error.status === 0 || error.status >= 500 ? load : undefined,
        actions: [h('a', { class: 'button', href: backHref }, 'Back to the task list')],
      }));
    }
  }
  load();

  return h('div', {}, heading, takeFlash(), messages, body);
}
