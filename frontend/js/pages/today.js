// The Today page: the farm's landing screen.
import { h, pageHeading, setContent } from '../components/dom.js';
import { takeFlash } from '../components/alerts.js';
import { loadingBlock, errorBlock } from '../components/loading.js';
import { progressBar, readinessRing } from '../components/ui.js';
import { icon } from '../components/icons.js';
import { actionFor, PRIORITIES, ADVISOR_LIMITATION } from '../components/advisor.js';
import { TIME_SLOT_LABELS } from '../components/tasks.js';
import { articleHref } from '../components/guidance.js';
import { getDashboard } from '../api/reports.js';
import { listFlocks } from '../api/flocks.js';
import { getAdvice } from '../api/advisor.js';
import { getSummary } from '../api/production.js';
import { getAssessment } from '../api/readiness.js';
import { listArticles } from '../api/guidance.js';
import { canOpen, canDo } from '../farm/access.js';
import { readinessStatusText, ownerReadiness, READINESS_NOT_STARTED, READINESS_OUTDATED } from '../farm/readiness-view.js';
import {
  addDaysIso, longDate, shortDay, dayValue, series, eggsEligible, pickFlock, mergeFlocks, getStartedSteps, deathsText, pickArticles,
} from '../farm/today-data.js';

const fmt = (n, digits = 2) => (Math.round(n * 10 ** digits) / 10 ** digits).toLocaleString('en-GB');

async function loadFarmData(farm) {
  if (canOpen(farm.myRole, 'dashboard')) {
    const { data } = await getDashboard(farm.id);
    return {
      today: data.date,
      active: data.flocks.flocks,
      advice: { items: data.attention.items, totalCount: data.attention.totalCount, limitation: data.attention.limitation },
      tasks: data.tasks.today,
      mortality: new Map(data.mortality.flocks.map((m) => [m.flockId, m])),
      readiness: data.readiness,
    };
  }
  const [{ data: flockData }, { data: advice }] = await Promise.all([listFlocks(farm.id), getAdvice(farm.id)]);
  return {
    today: advice.date,
    active: mergeFlocks(flockData.flocks, advice.flocks),
    allFlocks: flockData.flocks,
    advice: { items: advice.advice, totalCount: advice.totalCount, limitation: advice.limitation },
    tasks: null,
    mortality: null,
    readiness: null,
  };
}

const card = (cls, ...children) => h('section', { class: `today-card ${cls || ''}`.trim() }, children);

function adviceCard(farm, advice, flocks) {
  const names = new Map(flocks.map((f) => [f.id, f.name]));
  const items = advice.items.slice(0, 2);
  return card('today-advice', h('div', { class: 'today-card__head' }, h('h2', {}, 'Advice'),
    advice.totalCount > items.length ? h('a', { href: `#/farms/${farm.id}/advisor` }, `See all ${advice.totalCount}`) : null),
  items.length === 0
    ? h('p', { class: 'today-muted' }, 'No advice from your records right now.')
    : h('ul', { class: 'today-advice__list' }, items.map((item) => {
      const priority = PRIORITIES[item.priority] || PRIORITIES.info;
      const action = (item.targets || []).map((t) => actionFor(farm, t, names)).find(Boolean);
      return h('li', { class: `today-advice__item today-advice__item--${item.priority}` },
        h('span', { class: 'today-advice__icon', 'aria-hidden': 'true' }, icon(item.priority === 'urgent' ? 'warning' : 'trend', { size: 18 })),
        h('div', {},
          h('p', { class: 'today-advice__priority' }, priority.label),
          h('h3', {}, item.title),
          h('p', {}, item.message),
          h('div', { class: 'today-links' },
            action ? h('a', { href: action.href }, action.label) : null,
            h('a', { href: `#/farms/${farm.id}/advisor` }, 'Why this advice'))));
    })),
  h('p', { class: 'today-note' }, advice.limitation || ADVISOR_LIMITATION));
}

function stepRow({ number, done, current, title, text, action }) {
  return h('li', { class: `today-step${done ? ' is-done' : ''}${current ? ' is-current' : ''}` },
    h('span', { class: 'today-step__marker', 'aria-hidden': 'true' }, done ? icon('check', { size: 16, strokeWidth: 3 }) : String(number)),
    h('div', { class: 'today-step__body' },
      h('p', { class: 'today-step__title' }, title, done ? h('span', { class: 'visually-hidden' }, ' (done)') : null),
      text ? h('p', { class: 'today-step__text' }, text) : null),
    action || null);
}

async function loadOwnerReadiness(farm, readiness) {
  if (!readiness?.assessmentId) return ownerReadiness(null, farm);
  const { data: detail } = await getAssessment(farm.id, readiness.assessmentId);
  return ownerReadiness(detail, farm);
}

function readinessCardFor(farm, r) {
  const setup = (step) => `#/farms/${farm.id}/setup/${step}`;
  if (farm.myRole === 'manager') {
    const text = readinessStatusText(r.status);
    return card('today-readiness', h('div', { class: 'today-readiness__text' },
      h('h2', {}, `Readiness: ${text.title.toLowerCase()}`),
      h('p', { class: 'today-muted' }, 'The farm owner manages the readiness check.')));
  }
  if (r.none || r.outdated) {
    const words = r.outdated ? READINESS_OUTDATED : READINESS_NOT_STARTED;
    return card('today-readiness', h('div', { class: 'today-readiness__text' },
      h('h2', {}, words.title),
      h('p', { class: 'today-muted' }, words.text),
      h('a', { href: setup('ready') }, words.action)));
  }
  const text = readinessStatusText(r.status, r.gaps.length);
  return card(`today-readiness today-readiness--${r.status}`, readinessRing({ ready: r.count.ready, total: r.count.total }),
    h('div', { class: 'today-readiness__text' },
      h('h2', {}, `Readiness: ${text.title.toLowerCase()}`),
      h('a', { href: setup(r.gaps.length ? 'result' : 'ready') }, r.gaps.length ? 'See what to fix' : 'See your checklist')));
}

async function articlesCard(farm) {
  const stages = farm.startingStage && farm.startingStage !== 'day_old' ? ['preparation'] : ['preparation', 'brooding'];
  const lists = await Promise.all(stages.map((stage) => listArticles({ poultryType: farm.poultryType, stage }).then((r) => r.data.articles)));
  const chosen = [];
  for (const list of lists) {
    for (const a of pickArticles(list.filter((x) => !chosen.some((c) => c.code === x.code)), farm.poultryType, stages.length === 1 ? 2 : 1)) chosen.push(a);
  }
  if (!chosen.length) return null;
  return card('today-articles', h('h2', {}, 'Read before your chicks arrive'),
    h('ul', {}, chosen.map((a) => h('li', {}, h('a', { href: articleHref(a.code) },
      h('span', { class: 'today-articles__icon', 'aria-hidden': 'true' }, icon('book', { size: 18 })),
      h('span', {}, h('span', { class: 'today-articles__title' }, a.title), h('span', { class: 'today-articles__meta' }, a.topicLabel)))))));
}

async function newFarmView({ farm, user, data, flash }) {
  const role = farm.myRole;
  let readiness = null;
  if (role === 'owner') readiness = await loadOwnerReadiness(farm, data.readiness);
  else if (role === 'manager') readiness = { status: data.readiness?.status || 'not_started' };
  let hasFlockEver = (data.allFlocks || []).length > 0;
  if (!data.allFlocks) hasFlockEver = (await listFlocks(farm.id)).data.flocks.length > 0;
  const canAddFlock = canDo(role, 'flocks:manage');
  const { steps, done, total } = getStartedSteps({ role, readiness, hasFlockEver, canAddFlock });
  const articles = await articlesCard(farm).catch(() => null);

  let n = 0;
  const rows = steps.map((step) => {
    n += 1;
    if (step.key === 'farm') return stepRow({ number: n, done: true, title: 'Set up your farm' });
    if (step.key === 'readiness') {
      if (role === 'manager') {
        return stepRow({ number: n, done: step.done, title: `Readiness: ${readinessStatusText(step.status).title.toLowerCase()}`, text: 'The farm owner manages the readiness check.' });
      }
      if (readiness.none || readiness.outdated) {
        return stepRow({ number: n, done: false, title: 'Check your readiness', text: readiness.outdated ? 'Your latest checklist was made for other birds.' : 'Not started yet.',
          action: h('a', { class: 'today-step__link', href: `#/farms/${farm.id}/setup/ready` }, 'Start') });
      }
      const gaps = readiness.gaps;
      return stepRow({ number: n, done: step.done, title: gaps.length ? `Fix ${gaps.length} readiness gap${gaps.length === 1 ? '' : 's'}` : 'Readiness check done',
        text: gaps.length ? gaps.slice(0, 3).map((g) => g.title).join(', ') + (gaps.length > 3 ? '…' : '') : null,
        action: gaps.length ? h('a', { class: 'today-step__link', href: `#/farms/${farm.id}/setup/result` }, 'View gaps') : null });
    }
    if (step.key === 'flock') {
      return stepRow({ number: n, current: true, title: step.hasFlockEver ? 'Add your next flock' : 'Add your first flock',
        text: step.canAddFlock ? 'When your chicks arrive, add them here. PoultryStart will then plan their daily tasks.'
          : 'Waiting for the farm owner or a manager to add a flock.',
        action: step.canAddFlock ? h('a', { class: 'today-btn', href: `#/farms/${farm.id}/flocks/new` }, step.hasFlockEver ? 'Add a flock' : 'Add my first flock') : null });
    }
    return stepRow({ number: n, title: 'Record your first day', text: 'Once a flock is added, record its feed, water and any deaths each day.' });
  });

  return h('div', { class: 'today today--new' },
    h('div', { class: 'today-head' }, pageHeading(`Welcome, ${user.name}`), h('p', { class: 'today-lead' }, 'Your farm is set up. Here is what to do next.')),
    flash,
    h('div', { class: 'today-grid' },
      card('today-start',
        h('div', { class: 'today-card__head' }, h('h2', {}, 'Get started'),
          h('div', { class: 'today-progress' }, progressBar({ value: done, max: total, label: `${done} of ${total} done` }), h('span', {}, `${done} of ${total} done`))),
        h('ol', { class: 'today-steps' }, rows)),
      h('div', { class: 'today-side' }, readiness ? readinessCardFor(farm, readiness) : null, articles)));
}

function tile({ label, value, sub, warning = false, action = null }) {
  return h('div', { class: `today-tile${warning ? ' today-tile--warning' : ''}` },
    h('p', { class: 'today-tile__label' }, label),
    h('p', { class: 'today-tile__value' }, value),
    sub ? h('p', { class: 'today-tile__sub' }, sub) : null,
    action);
}

const recordLink = (farm, flock, path, label = 'Record now') => (canDo(farm.myRole, 'production:create')
  ? h('a', { class: 'today-tile__action', href: `#/farms/${farm.id}/records/${path}/new?flockId=${flock.id}` }, label) : null);

function quantityTile(farm, flock, { label, path, summary, today, unit }) {
  const now = dayValue(summary, today);
  const before = dayValue(summary, addDaysIso(today, -1));
  const yesterday = before.recorded ? `Yesterday: ${fmt(before.value)} ${unit} (recorded)` : 'Nothing recorded yesterday';
  if (!now.recorded) return tile({ label, value: 'Not recorded', warning: true, sub: yesterday, action: recordLink(farm, flock, path) });
  return tile({ label, value: `${fmt(now.value)} ${unit}`, sub: [now.measurement === 'estimated' ? 'Estimated' : null, yesterday].filter(Boolean).join(' · ') });
}

function weekChart({ title, values, unit, link }) {
  const recorded = values.filter((v) => v.value !== null);
  const max = Math.max(0, ...recorded.map((v) => v.value));
  const describe = values.map((v) => `${shortDay(v.date)} ${v.value === null ? 'not recorded' : `${fmt(v.value)}${unit ? ` ${unit}` : ''}`}`).join(', ');
  return card('today-chart',
    h('div', { class: 'today-card__head' }, h('h2', {}, title), link),
    recorded.length === 0
      ? h('p', { class: 'today-muted' }, 'Nothing recorded in the last 7 days.')
      : [h('div', { class: 'today-bars', role: 'img', 'aria-label': `${title}: ${describe}` }, values.map((v, i) => {
        const bar = h('span', { class: `today-bars__bar${i === values.length - 1 ? ' is-latest' : ''}` });
        if (v.value !== null) bar.style.height = `${max > 0 ? Math.max(4, Math.round((v.value / max) * 100)) : 4}%`;
        return h('div', { class: `today-bars__col${v.value === null ? ' is-missing' : ''}` },
          h('span', { class: 'today-bars__value' }, v.value === null ? '–' : fmt(v.value, 1)),
          v.value === null ? null : bar);
      })),
      h('div', { class: 'today-bars__days', 'aria-hidden': 'true' }, values.map((v) => h('span', {}, shortDay(v.date).slice(0, 1)))),
      values.some((v) => v.value === null) ? h('p', { class: 'today-note' }, '– means nothing was recorded that day.') : null]);
}

function tasksCard(farm, tasks, flocks, reload) {
  const listHref = `#/farms/${farm.id}/tasks`;
  const openList = h('a', { class: 'today-btn today-btn--soft', href: listHref }, 'Open the task list');
  if (!tasks) {
    return card('today-tasks', h('div', { class: 'today-card__head' }, h('h2', {}, 'Tasks')),
      h('p', {}, 'See your work for today on the task list. Opening it prepares today\'s tasks.'), openList);
  }
  if (tasks.state === 'not_generated') {
    return card('today-tasks', h('div', { class: 'today-card__head' }, h('h2', {}, 'Tasks')),
      h('p', {}, tasks.message), openList);
  }
  const counted = tasks.total - tasks.cancelled;
  const names = new Map(flocks.map((f) => [f.id, f.name]));
  const slots = Object.entries(tasks.openByTimeSlot || {}).map(([slot, count]) => `${TIME_SLOT_LABELS[slot] || slot}: ${count} open`);
  return card('today-tasks',
    h('div', { class: 'today-card__head' }, h('h2', {}, 'Tasks'),
      h('div', { class: 'today-links' }, h('span', { class: 'today-strong' }, `${tasks.completed} of ${counted} done`),
        h('button', { type: 'button', class: 'today-linkbtn', onclick: reload }, 'Refresh'), h('a', { href: listHref }, 'Open the task list'))),
    progressBar({ value: tasks.completed, max: Math.max(counted, 1), label: `${tasks.completed} of ${counted} tasks done` }),
    tasks.state === 'completed'
      ? h('p', { class: 'today-done' }, icon('check', { size: 18, strokeWidth: 2.6 }), 'All of today\'s tasks are done.')
      : [slots.length ? h('p', { class: 'today-slots' }, slots.join(' · ')) : null,
        h('ul', { class: 'today-tasklist' }, tasks.openTasks.map((t) => h('li', {}, h('a', { href: `#/farms/${farm.id}/tasks/${t.id}` },
          h('span', { class: 'today-task__circle', 'aria-hidden': 'true' }),
          h('span', { class: 'today-task__text' }, h('span', { class: 'today-task__title' }, t.title),
            h('span', { class: 'today-task__meta' }, t.flockId ? names.get(t.flockId) || 'A flock' : 'Whole farm')),
          icon('chevronRight', { size: 18 }))))),
        tasks.pending > tasks.openTasks.length ? h('p', { class: 'today-note' }, `${tasks.pending - tasks.openTasks.length} more open on the task list.`) : null]);
}

async function runningFarmView({ farm, data, query, flash, reload }) {
  const { today, active } = data;
  const flock = pickFlock(active, query.flockId);
  const from = addDaysIso(today, -6);
  const eggs = eggsEligible(flock, today);
  const [feed, water, eggSummary] = await Promise.all([
    getSummary(farm.id, flock.id, 'feed', { from, to: today }).then((r) => r.data.summary),
    getSummary(farm.id, flock.id, 'water', { from, to: today }).then((r) => r.data.summary),
    eggs ? getSummary(farm.id, flock.id, 'eggs', { from, to: today }).then((r) => r.data.summary) : null,
  ]);

  const birdsSub = data.mortality ? deathsText(data.mortality.get(flock.id)) : `${fmt(flock.birdsReceived)} received`;
  let second;
  if (eggs) {
    const v = dayValue(eggSummary, today, 'totalEggs');
    second = v.recorded ? tile({ label: 'Eggs today', value: fmt(v.value) })
      : tile({ label: 'Eggs today', value: 'Not recorded', warning: true, action: recordLink(farm, flock, 'eggs') });
  } else {
    second = tile({ label: 'Age', value: flock.ageWeeks != null ? `Week ${flock.ageWeeks}` : 'Not known', sub: flock.stageLabel || null });
  }

  const chart = eggs
    ? weekChart({ title: 'Eggs, last 7 days', values: series(eggSummary, today, 'totalEggs'),
      link: h('a', { href: `#/farms/${farm.id}/records/eggs?flockId=${flock.id}` }, 'Records') })
    : weekChart({ title: 'Feed, last 7 days (kg)', unit: 'kg', values: series(feed, today),
      link: h('a', { href: `#/farms/${farm.id}/records/feed?flockId=${flock.id}` }, 'Records') });

  const quick = h('div', { class: 'today-quick' },
    canDo(farm.myRole, 'production:create') ? h('a', { class: 'today-quick__btn', href: `#/farms/${farm.id}/record` }, icon('plus', { size: 18 }), 'Record today') : null,
    canDo(farm.myRole, 'health:create') ? h('a', { class: 'today-quick__btn', href: `#/farms/${farm.id}/health/new?flockId=${flock.id}` }, icon('warning', { size: 18 }), 'Report a problem') : null);

  const context = [longDate(today), `${flock.name}${flock.ageWeeks != null ? `, week ${flock.ageWeeks}` : ''}`].join(' · ');
  return h('div', { class: 'today today--running' },
    h('div', { class: 'today-head' }, pageHeading('Today'), h('p', { class: 'today-lead' }, context)),
    flash,
    active.length > 1 ? h('nav', { class: 'today-flocks', 'aria-label': 'Choose the flock to show' },
      h('span', {}, 'Showing:'),
      active.map((f) => h('a', { href: `#/farms/${farm.id}/today?flockId=${f.id}`, 'aria-current': f.id === flock.id ? 'true' : undefined, class: 'today-flocks__chip' }, f.name))) : null,
    h('div', { class: 'today-tiles' },
      tile({ label: 'Birds alive', value: fmt(flock.liveBirds), sub: birdsSub }),
      second,
      quantityTile(farm, flock, { label: 'Feed today', path: 'feed', summary: feed, today, unit: 'kg' }),
      quantityTile(farm, flock, { label: 'Water today', path: 'water', summary: water, today, unit: 'L' })),
    h('div', { class: 'today-grid' },
      tasksCard(farm, data.tasks, active, reload),
      h('div', { class: 'today-side' }, adviceCard(farm, data.advice, active), chart, quick)));
}

export function todayPage({ user, farmContext, query }) {
  const { farm } = farmContext;
  const flash = takeFlash();
  const root = h('div', {}, loadingBlock('Loading today…'));

  async function load() {
    setContent(root, loadingBlock('Loading today…'));
    try {
      const data = await loadFarmData(farm);
      const view = data.active.length
        ? await runningFarmView({ farm, data, query, flash, reload: load })
        : await newFarmView({ farm, user, data, flash });
      setContent(root, view);
    } catch (error) {
      if (error.status === 401) return;
      setContent(root, pageHeading('Today'), errorBlock(error, { onRetry: load }));
    }
  }
  load();
  return root;
}
