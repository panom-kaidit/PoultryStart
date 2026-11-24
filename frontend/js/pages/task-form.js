// The page for creating or editing a task.
import { h, pageHeading, setContent } from '../components/dom.js';
import { alertBox, setFlash } from '../components/alerts.js';
import { loadingBlock, errorBlock } from '../components/loading.js';
import {
  inputField, selectField, radioField, textareaField, guardSubmit, showErrors, clearErrors, formValues, fillForm, saveDraft, takeDraft,
} from '../components/forms.js';
import { TIME_SLOT_LABELS, isOpen } from '../components/tasks.js';
import { createTask, updateTask, getTask } from '../api/tasks.js';
import { listFlocks } from '../api/flocks.js';
import { listMembers } from '../api/members.js';
import { updateCachedTask } from '../farm/task-cache.js';
import { navigate } from '../router.js';
import { ROLE_LABELS } from '../utils/format.js';
import { ugandaToday } from '../utils/dates.js';

const TASK_TYPES = [
  { value: 'general', label: 'Custom task' },
  { value: 'vet_plan', label: 'Vet or supplier plan reminder: enter the vaccination or treatment exactly as your vet or chick supplier gave it' },
  { value: 'sale_preparation', label: 'Sale preparation' },
];
const LABELS = {
  title: 'Title', description: 'Description', dueDate: 'Due date', timeSlot: 'Time of day', taskType: 'Type of task',
  flockId: 'For', assignedTo: 'Assigned to',
};

export function taskBody(values, original = null) {
  const text = (name) => (typeof values[name] === 'string' ? values[name].trim() : undefined);
  const id = (name) => (text(name) === undefined ? undefined : (text(name) === '' ? null : Number(text(name))));
  const next = {
    title: text('title'),
    description: text('description') === '' ? null : text('description'),
    dueDate: text('dueDate'),
    timeSlot: text('timeSlot'),
    flockId: id('flockId'),
    assignedTo: id('assignedTo'),
  };
  const body = {};
  for (const [key, value] of Object.entries(next)) {
    if (value === undefined) continue;
    if (original) {
      if ((original[key] ?? null) !== value) body[key] = value;
    } else if (value !== null) body[key] = value;
  }
  if (!original && text('taskType')) body.taskType = text('taskType');
  return body;
}

export function taskFormPage({ user, farmContext, params }) {
  const { farm } = farmContext;
  const editing = params.taskId !== undefined;
  const taskId = editing ? Number(params.taskId) : null;
  const heading = pageHeading(editing ? 'Edit task' : 'New task');
  const body = h('div', {}, loadingBlock('Loading…'));
  const draftId = editing ? `edit-task-${taskId}` : `new-task-${farm.id}`;

  function build({ task, flocks, members }) {
    const onlyAssign = editing && task.source === 'generated';
    const today = ugandaToday();
    const activeFlocks = flocks.filter((f) => f.status === 'active' || (editing && f.id === task.flockId));
    const summary = h('div', { 'aria-live': 'polite' });
    const assigneeField = selectField({
      name: 'assignedTo', label: 'Assigned to', placeholder: 'Nobody (anyone on the farm can do it)',
      options: members.map((m) => ({ value: String(m.userId), label: `${m.name} (${ROLE_LABELS[m.role] || m.role})` })),
      hint: 'A farm worker sees only the tasks assigned to them and the tasks assigned to nobody.',
    });
    const form = h('form', { class: 'form' },
      onlyAssign ? h('p', {}, 'This task comes from the PoultryStart task catalogue: it can only be assigned to someone else.') : [
        inputField({ name: 'title', label: 'Title', required: true, attrs: { maxlength: '150' } }),
        textareaField({ name: 'description', label: 'Description', maxlength: 1000 }),
        inputField({ name: 'dueDate', label: 'Due date', type: 'date', required: true, value: today, hint: 'Today or later.', attrs: { min: today } }),
        selectField({ name: 'timeSlot', label: 'Time of day', value: 'any',
          options: Object.entries(TIME_SLOT_LABELS).map(([value, label]) => ({ value, label })) }),
        editing ? null : radioField({ name: 'taskType', label: 'Type of task', value: 'general', options: TASK_TYPES,
          hint: 'PoultryStart never creates vaccination schedules or medicine doses.' }),
        selectField({ name: 'flockId', label: 'For', placeholder: 'The whole farm (no flock)',
          options: activeFlocks.map((f) => ({ value: String(f.id), label: `Flock: ${f.name}` })),
          hint: 'Only active flocks can have new tasks.' }),
      ],
      assigneeField,
      h('div', { class: 'button-row' },
        h('button', { type: 'submit', class: 'button' }, editing ? 'Save changes' : 'Create the task'),
        h('a', { class: 'button button--secondary', href: editing ? `#/farms/${farm.id}/tasks/${taskId}` : `#/farms/${farm.id}/tasks?view=cached` }, 'Cancel')));

    if (editing) {
      fillForm(form, {
        ...(onlyAssign ? {} : {
          title: task.title, description: task.description || '', dueDate: task.dueDate, timeSlot: task.timeSlot,
          flockId: task.flockId != null ? String(task.flockId) : '',
        }),
        assignedTo: task.assignedTo != null ? String(task.assignedTo) : '',
      });
    }
    let restored = null;
    const draft = takeDraft(draftId, user.id);
    if (draft) {
      fillForm(form, draft);
      restored = alertBox('info', 'We kept what you had entered before your session expired. Check it and save again. Nothing was saved yet.');
    }

    guardSubmit(form, async () => {
      clearErrors(form, summary);
      const values = formValues(form);
      const request = taskBody(values, editing ? task : null);
      if (editing && Object.keys(request).length === 0) {
        summary.replaceChildren(alertBox('info', 'Nothing has changed, so there is nothing to save.'));
        return;
      }
      try {
        const { data, message } = editing ? await updateTask(farm.id, taskId, request) : await createTask(farm.id, request);
        updateCachedTask(farm.id, data.task);
        setFlash('success', message || (editing ? 'Task updated.' : 'Task created.'));
        navigate(`/farms/${farm.id}/tasks/${data.task.id}`);
      } catch (error) {
        if (error.status === 401) { saveDraft(draftId, user.id, values); return; }
        showErrors(form, error, summary, LABELS);
      }
    }, { busyText: 'Saving…' });

    setContent(body, restored, summary, h('div', { class: 'card' }, form));
  }

  async function load() {
    try {
      const [task, { data: flockData }, { data: memberData }] = await Promise.all([
        editing ? getTask(farm.id, taskId).then((r) => r.data.task) : Promise.resolve(null),
        listFlocks(farm.id),
        listMembers(farm.id),
      ]);
      if (!body.isConnected) return;
      if (editing && !isOpen(task)) {
        setContent(body, alertBox('info', 'Only an open task can be changed. This task is done, missed or cancelled.'),
          h('a', { class: 'button', href: `#/farms/${farm.id}/tasks/${taskId}` }, 'Back to the task'));
        return;
      }
      if (editing) heading.textContent = task.source === 'generated' ? `Assign: ${task.title}` : `Edit: ${task.title}`;
      build({ task, flocks: flockData.flocks, members: memberData.members });
    } catch (error) {
      if (error.status === 401 || !body.isConnected) return;
      setContent(body, errorBlock(error, { onRetry: error.status === 0 || error.status >= 500 ? load : undefined }));
    }
  }
  load();
  return h('div', {}, heading, body);
}
