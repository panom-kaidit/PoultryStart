// The Daily Tasks page, the only screen that requests the task list.
import { h, pageHeading, setContent } from '../components/dom.js';
import { alertBox, takeFlash } from '../components/alerts.js';
import { loadingBlock, errorBlock, emptyState } from '../components/loading.js';
import {
  taskStatusLabel, isOpen, flockText, personText, dueText, loadNames, completionForm, FREQUENCY_LABELS, TIME_SLOT_LABELS,
  MISSED_EXPLANATION,
} from '../components/tasks.js';
import { listTasks } from '../api/tasks.js';
import { getCachedTasks, setCachedTasks, updateCachedTask } from '../farm/task-cache.js';
import { canDo } from '../farm/access.js';
import { ugandaToday, formatDate } from '../utils/dates.js';

const VIEWS = {
  today: { label: 'Today and overdue', test: (t, today) => t.displayStatus === 'overdue' || (t.displayStatus === 'pending' && t.dueDate <= today) },
  upcoming: { label: 'Coming up', test: (t, today) => t.displayStatus === 'pending' && t.dueDate > today },
  missed: { label: 'Missed', test: (t) => t.displayStatus === 'missed' },
  completed: { label: 'Done', test: (t) => t.displayStatus === 'completed' },
  cancelled: { label: 'Cancelled', test: (t) => t.displayStatus === 'cancelled' },
  all: { label: 'All tasks', test: () => true },
};

export function tasksListPage({ user, farmContext, query }) {
  const { farm } = farmContext;
  const role = farm.myRole;
  const canManage = canDo(role, 'tasks:manage');
  const today = ugandaToday();
  const messages = h('div', { 'aria-live': 'polite' });
  const body = h('div', {});
  const state = { view: 'today', scope: 'all', tasks: [], names: null, loadedAt: null, fromMemory: false, openForm: null };
  let loading = false;

  function announce(kind, text) {
    const box = alertBox(kind, text);
    messages.replaceChildren(box);
    box.focus();
  }

  async function fetchList() {
    if (loading) return;
    loading = true;
    messages.replaceChildren();
    setContent(body, loadingBlock('Loading the tasks…'));
    try {
      const [{ data }, names] = await Promise.all([listTasks(farm.id), loadNames(farm)]);
      if (!body.isConnected) return;
      setCachedTasks(farm.id, data.tasks);
      Object.assign(state, { tasks: data.tasks, names, loadedAt: new Date(), fromMemory: false });
      render();
    } catch (error) {
      if (error.status === 401 || !body.isConnected) return;
      setContent(body, errorBlock(error, { onRetry: fetchList }));
    } finally {
      loading = false;
    }
  }

  async function showCached(cached) {
    setContent(body, loadingBlock('Loading…'));
    try {
      const names = await loadNames(farm);
      if (!body.isConnected) return;
      Object.assign(state, { tasks: cached.tasks, names, loadedAt: cached.loadedAt, fromMemory: true });
      render();
    } catch (error) {
      if (error.status === 401 || !body.isConnected) return;
      setContent(body, errorBlock(error, { onRetry: () => showCached(cached) }));
    }
  }

  function onCompleted(task, message) {
    const index = state.tasks.findIndex((t) => t.id === task.id);
    if (index >= 0) state.tasks[index] = task;
    updateCachedTask(farm.id, task);
    state.openForm = null;
    render();
    announce('success', message);
  }

  function taskCard(task) {
    const assigned = personText(task.assignedTo, state.names, user);
    const card = h('li', { class: 'card task-card', dataset: { taskId: String(task.id) } },
      h('h3', { class: 'task-card__title' }, task.title),
      h('p', {}, taskStatusLabel(task), task.problemReported ? [' ', h('span', { class: 'badge badge--problem' }, '! Problem reported')] : null),
      h('div', { class: 'tag-row' },
        h('span', { class: 'tag' }, dueText(task)),
        h('span', { class: 'tag' }, TIME_SLOT_LABELS[task.timeSlot] || task.timeSlot),
        h('span', { class: 'tag' }, FREQUENCY_LABELS[task.frequency] || task.frequency)),
      h('p', { class: 'farm-card__meta' }, flockText(task, state.names)),
      h('p', { class: 'farm-card__meta' }, assigned ? `Assigned to ${assigned}` : 'Not assigned to anyone'),
      task.displayStatus === 'missed' ? h('p', { class: 'small-print' }, MISSED_EXPLANATION) : null);
    const actions = h('div', { class: 'button-row' },
      h('a', { class: 'button button--secondary button--small', href: `#/farms/${farm.id}/tasks/${task.id}`,
        'aria-label': `Open task: ${task.title}` }, 'Open task'));
    card.append(actions);
    if (isOpen(task) && canDo(role, 'tasks:complete')) {
      const form = completionForm({ farm, task, user, idPrefix: 'list', onDone: onCompleted });
      const restored = form.dataset.restored === 'true';
      form.hidden = !(restored || state.openForm === task.id);
      const toggle = h('button', { type: 'button', class: 'button button--small', hidden: !form.hidden,
        'aria-label': `Mark as done: ${task.title}` }, 'Mark as done');
      toggle.addEventListener('click', () => {
        state.openForm = task.id;
        form.hidden = false;
        toggle.hidden = true;
        form.querySelector('textarea, input').focus();
      });
      actions.prepend(toggle);
      card.append(form);
    }
    return card;
  }

  function render() {
    const scoped = state.tasks.filter((t) => state.scope === 'all'
      || (state.scope === 'farm' ? t.flockId == null : String(t.flockId) === state.scope));
    const count = (view) => scoped.filter((t) => VIEWS[view].test(t, today)).length;
    let shown = scoped.filter((t) => VIEWS[state.view].test(t, today));
    if (state.view === 'completed') shown = shown.slice().sort((a, b) => String(b.completedAt).localeCompare(String(a.completedAt)));

    const viewSelect = h('select', { class: 'select', id: 'task-view' },
      Object.entries(VIEWS).map(([key, v]) => h('option', { value: key, selected: key === state.view }, `${v.label} (${count(key)})`)));
    viewSelect.addEventListener('change', () => { state.view = viewSelect.value; render(); });
    const flockIds = [...new Set(state.tasks.map((t) => t.flockId).filter((id) => id != null))];
    const scopeSelect = h('select', { class: 'select', id: 'task-scope' },
      h('option', { value: 'all', selected: state.scope === 'all' }, 'All tasks'),
      h('option', { value: 'farm', selected: state.scope === 'farm' }, 'Farm tasks only'),
      flockIds.map((id) => h('option', { value: String(id), selected: state.scope === String(id) },
        flockText({ flockId: id }, state.names))));
    scopeSelect.addEventListener('change', () => { state.scope = scopeSelect.value; render(); });
    const refresh = h('button', { type: 'button', class: 'button button--secondary' }, 'Refresh the list');
    refresh.addEventListener('click', fetchList);

    const loadedText = state.loadedAt
      ? `${state.fromMemory ? 'Shown as last loaded' : 'Loaded'} at ${String(state.loadedAt.getHours()).padStart(2, '0')}:${String(state.loadedAt.getMinutes()).padStart(2, '0')}.`
      : '';

    setContent(body,
      h('div', { class: 'card task-toolbar' },
        h('div', { class: 'field' }, h('label', { class: 'field__label', for: 'task-view' }, 'Show'), viewSelect),
        h('div', { class: 'field' }, h('label', { class: 'field__label', for: 'task-scope' }, 'For'), scopeSelect),
        h('p', { class: 'small-print' }, loadedText, ' ', state.fromMemory ? 'Refresh to see the latest tasks.' : ''),
        h('div', { class: 'button-row' }, refresh,
          canManage ? h('a', { class: 'button', href: `#/farms/${farm.id}/tasks/new` }, 'New task') : null)),
      state.tasks.length === 0
        ? emptyState({
          title: 'No tasks',
          text: role === 'worker'
            ? 'There are no tasks for you now: none is assigned to you, and none is open to everyone.'
            : 'There are no tasks yet. Daily tasks appear for active flocks; you can also create your own task.',
        })
        : (shown.length === 0
          ? h('p', { class: 'card' }, `No tasks under "${VIEWS[state.view].label}". Choose another view above.`)
          : h('ul', { class: 'card-list' }, shown.map(taskCard))));
  }

  const cached = query.view === 'cached' ? getCachedTasks(farm.id) : null;
  if (cached) showCached(cached);
  else fetchList();

  return h('div', {},
    pageHeading('Daily tasks'),
    takeFlash(),
    h('p', { class: 'page-intro' }, `Today is ${formatDate(today)}. Opening this list also prepares today's tasks for your active flocks.`),
    messages,
    body);
}
