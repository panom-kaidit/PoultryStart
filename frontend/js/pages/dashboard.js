// The farm dashboard page for owners and managers.
import { h, pageHeading, setContent } from '../components/dom.js';
import { alertBox, statusLabel } from '../components/alerts.js';
import { loadingBlock, errorBlock, emptyState } from '../components/loading.js';
import { readinessStatusBlock, AREA_LABELS, ANSWER_LABELS } from '../components/readiness.js';
import { adviceCard, limitationBox } from '../components/advisor.js';
import { evidenceTags } from '../components/guidance.js';
import { HEALTH_DISCLAIMER } from '../components/health.js';
import { formatAmount } from '../components/expenses.js';
import { METHOD_LABELS } from '../components/production.js';
import { periodText, countOr, reportHref } from '../components/reports.js';
import { getDashboard } from '../api/reports.js';
import { canOpen } from '../farm/access.js';
import { formatNumber } from '../utils/format.js';
import { formatDate } from '../utils/dates.js';

const SLOT_LABELS = { morning: 'Morning', midday: 'Midday', evening: 'Evening', any: 'Any time' };
const TASK_STATE = {
  not_generated: { kind: 'info', label: 'Not generated yet today' },
  outstanding: { kind: 'warning', label: 'Tasks still open' },
  completed: { kind: 'success', label: 'All done' },
};

const card = (id, title, ...children) => h('section', { class: 'card dashboard-card', 'aria-labelledby': id }, h('h2', { id }, title), ...children);
const plural = (n, word) => `${formatNumber(n)} ${word}${n === 1 ? '' : 's'}`;

function taskLinks(farm, group) {
  if (!group.tasks.length) return null;
  return h('ul', { class: 'plain-list' }, group.tasks.map((t) => h('li', {},
    h('a', { href: `#/farms/${farm.id}/tasks/${t.id}` }, t.title), ` (due ${formatDate(t.dueDate)})`)),
    group.count > group.tasks.length ? h('li', { class: 'small-print' }, `and ${group.count - group.tasks.length} more`) : null);
}

function flocksCard(farm, flocks) {
  return card('dash-flocks', 'Flocks',
    flocks.activeCount === 0
      ? h('p', {}, flocks.emptyReason)
      : [
        h('p', { class: 'dashboard-figure' }, `${plural(flocks.activeCount, 'active flock')}, ${plural(flocks.liveBirds, 'bird')} alive now`),
        h('p', { class: 'small-print' }, flocks.liveBirdsBasis),
        h('ul', { class: 'item-list' }, flocks.flocks.map((f) => h('li', { class: 'item' },
          h('p', { class: 'item__title' }, h('a', { href: `#/farms/${farm.id}/flocks/${f.id}` }, f.name)),
          h('p', {}, `${formatNumber(f.liveBirds)} alive of ${formatNumber(f.birdsReceived)} received · week ${f.ageWeeks} (age day ${f.ageDays})`),
          h('p', {}, f.stageLabel, f.stageQualification
            ? [' ', evidenceTags([f.stageQualification.marker]), h('span', { class: 'small-print' }, ` ${f.stageQualification.qualification}`)] : null),
          f.poultryType === 'layer' ? h('p', { class: 'small-print' }, `First-egg date: ${f.firstEggDate ? formatDate(f.firstEggDate) : 'not recorded yet'}`) : null,
          f.poultryType === 'broiler' ? h('p', { class: 'small-print' }, `Expected sale date: ${f.expectedSaleDate ? formatDate(f.expectedSaleDate) : 'not entered yet'}`) : null))),
      ],
    h('p', { class: 'small-print' }, 'Closed flocks are not counted here; they stay on the flock list.'),
    h('div', { class: 'button-row' }, h('a', { class: 'button button--secondary button--small', href: `#/farms/${farm.id}/flocks` }, 'All flocks')));
}

function tasksCard(farm, tasks) {
  const t = tasks.today;
  const state = TASK_STATE[t.state] || { kind: 'info', label: t.state };
  const slots = Object.entries(t.openByTimeSlot || {});
  return card('dash-tasks', `Today's tasks (${formatDate(t.date)})`,
    h('p', {}, statusLabel(state.kind, state.label)),
    h('p', {}, t.message),
    t.state === 'not_generated' ? null : h('p', {}, `${plural(t.total, 'task')} today: ${formatNumber(t.pending)} open, ${formatNumber(t.completed)} done, ${formatNumber(t.cancelled)} cancelled.`),
    slots.length ? h('p', { class: 'small-print' }, `Open by time of day: ${slots.map(([slot, n]) => `${SLOT_LABELS[slot] || slot} ${n}`).join(', ')}.`) : null,
    taskLinks(farm, { count: t.pending, tasks: t.openTasks }),
    h('div', { class: 'button-row' }, h('a', { class: 'button', href: `#/farms/${farm.id}/tasks` },
      t.state === 'not_generated' ? 'Open the task list (this generates today\'s tasks)' : 'Open the task list')),
    h('h3', {}, 'Needing attention'),
    h('dl', { class: 'details' },
      h('dt', {}, 'Overdue'), h('dd', {}, `${formatNumber(tasks.overdue.count)}: ${tasks.overdue.basis}`),
      h('dt', {}, 'Missed in the last 7 days'), h('dd', {}, `${formatNumber(tasks.missedRecently.count)}: ${tasks.missedRecently.basis}`),
      h('dt', {}, 'Problems reported'), h('dd', {}, `${formatNumber(tasks.problemsReported.count)}: ${tasks.problemsReported.basis}`)),
    taskLinks(farm, tasks.overdue), taskLinks(farm, tasks.missedRecently), taskLinks(farm, tasks.problemsReported),
    h('p', {}, h('a', { href: reportHref(farm.id, 'tasks') }, 'Daily tasks report (R4)')));
}

function readinessCard(farm, readiness, role) {
  const owner = role === 'owner' && readiness.statusBasis !== undefined;
  return card('dash-readiness', 'Readiness',
    readinessStatusBlock(readiness.status),
    readiness.message ? h('p', {}, readiness.message) : null,
    owner ? [
      h('p', { class: 'small-print' }, readiness.statusBasis),
      h('dl', { class: 'details' },
        h('dt', {}, 'Questions answered'), h('dd', {}, `${readiness.questionsAnswered} of ${readiness.questionsTotal}`),
        h('dt', {}, 'Required questions not answered'), h('dd', {}, String(readiness.requiredQuestionsUnanswered)),
        h('dt', {}, 'Required items available'), h('dd', {}, `${readiness.requiredResourcesAvailable} of ${readiness.requiredResourcesTotal}`),
        readiness.areasNeedingAttention?.length
          ? [h('dt', {}, 'Areas needing attention'), h('dd', {}, readiness.areasNeedingAttention.map((a) => AREA_LABELS[a] || a).join(', '))] : null),
      readiness.needsAttention?.length ? [h('h3', {}, 'Answers needing attention'),
        h('ul', { class: 'plain-list' }, readiness.needsAttention.map((q) => h('li', {}, `${q.questionText} (${ANSWER_LABELS[q.answer] || q.answer})`)))] : null,
      readiness.missingResources?.length ? [h('h3', {}, 'Required items not available'),
        h('ul', { class: 'plain-list' }, readiness.missingResources.map((r) => h('li', {}, r.itemName)))] : null,
      readiness.spaceCheck ? h('p', {}, h('strong', {}, 'Space check: '), readiness.spaceCheck.message) : null,
      canOpen(role, 'readiness') ? h('div', { class: 'button-row' }, h('a', { class: 'button button--secondary button--small',
        href: readiness.assessmentId ? `#/farms/${farm.id}/readiness/${readiness.assessmentId}` : `#/farms/${farm.id}/readiness` }, 'Open the readiness assessment')) : null,
    ] : (role === 'owner'
      ? (canOpen(role, 'readiness') ? h('div', { class: 'button-row' }, h('a', { class: 'button button--secondary button--small', href: `#/farms/${farm.id}/readiness` }, 'Start a readiness assessment')) : null)
      : h('p', { class: 'small-print' }, 'The farm owner can see the details of the readiness assessment.')));
}

const quantityText = (q) => (q.total === null
  ? `${q.emptyReason} (${q.daysWithRecords} of ${q.eligibleDays} days have a record)`
  : `${formatNumber(q.total)} ${q.unit} on ${q.daysWithRecords} of ${q.eligibleDays} days (${(METHOD_LABELS[q.measurement] || q.measurement || '').toLowerCase()})`);

function productionCard(farm, production) {
  return card('dash-production', `Production: ${periodText(production)}`,
    h('p', { class: 'small-print' }, production.note),
    production.flocks.length === 0 ? h('p', {}, 'No active flocks.') : h('ul', { class: 'item-list' }, production.flocks.map((f) => h('li', { class: 'item' },
      h('p', { class: 'item__title' }, f.name),
      h('dl', { class: 'details' },
        h('dt', {}, 'Feed'), h('dd', {}, quantityText(f.feed)),
        h('dt', {}, 'Drinking water'), h('dd', {}, quantityText(f.water)),
        f.eggs ? [h('dt', {}, 'Eggs'), h('dd', {}, f.eggs.total === null ? f.eggs.emptyReason
          : `${formatNumber(f.eggs.total)} (good ${formatNumber(f.eggs.goodEggs)}, second grade ${formatNumber(f.eggs.secondGradeEggs)}, floor ${formatNumber(f.eggs.floorEggs)}) on ${f.eggs.daysWithRecords} of ${f.eggs.eligibleDays} days`)] : null,
        h('dt', {}, 'Latest weighing'), h('dd', {}, f.latestWeight
          ? [h('a', { href: `#/farms/${farm.id}/records/weights/${f.flockId}/${f.latestWeight.recordId}` }, formatDate(f.latestWeight.recordDate)),
            `: ${formatNumber(f.latestWeight.averageWeightG)} g average of ${plural(f.latestWeight.sampleSize, 'bird')}`]
          : f.latestWeightEmptyReason)),
      h('a', { href: reportHref(farm.id, 'production', { flockId: f.flockId }) }, `Production report for ${f.name} (R3)`)))));
}

function mortalityCard(farm, mortality) {
  return card('dash-mortality', `${mortality.label}: ${periodText(mortality)}`,
    h('p', { class: 'dashboard-figure' }, mortality.totalNetDeaths === null ? 'No deaths recorded' : plural(mortality.totalNetDeaths, 'death')),
    h('p', { class: 'small-print' }, mortality.note),
    mortality.flocks.length ? h('ul', { class: 'plain-list' }, mortality.flocks.map((f) => h('li', {},
      h('a', { href: `#/farms/${farm.id}/flocks/${f.flockId}` }, f.name), `: ${f.message}`))) : null,
    h('p', {}, h('a', { href: reportHref(farm.id, 'mortality') }, 'Mortality report (R2)')));
}

function healthCard(farm, health) {
  return card('dash-health', `Health observations: ${periodText(health)}`,
    h('p', { class: 'dashboard-figure' }, `${plural(health.observationsRecorded, 'observation')} recorded`),
    health.withoutVetOrExtensionContact ? h('p', {}, statusLabel('warning', `${health.withoutVetOrExtensionContact} without a veterinarian or extension officer contact recorded`)) : null,
    h('p', { class: 'small-print' }, health.note),
    health.flocks.length ? h('ul', { class: 'plain-list' }, health.flocks.map((f) => h('li', {},
      h('a', { href: `#/farms/${farm.id}/health/flocks/${f.flockId}` }, f.name), `: ${f.observationsRecorded}`
      + (f.withoutVetOrExtensionContact ? ` (${f.withoutVetOrExtensionContact} without contact recorded)` : '')))) : null,
    h('p', { class: 'small-print' }, HEALTH_DISCLAIMER),
    h('p', {}, h('a', { href: reportHref(farm.id, 'health') }, 'Health observations report (R5)')));
}

const WARNING_LINKS = {
  weight: (farm, r) => `#/farms/${farm.id}/records/weights/${r.flockId}/${r.recordId}`,
  eggs: (farm, r) => `#/farms/${farm.id}/records/eggs/${r.flockId}/${r.recordId}`,
  health: (farm, r) => `#/farms/${farm.id}/health/flocks/${r.flockId}/${r.recordId}`,
};
const WARNING_WORDS = { weight: 'Weight record', eggs: 'Egg record', health: 'Health observation' };

function warningsCard(farm, warnings) {
  return card('dash-warnings', `Records to check: ${periodText(warnings)}`,
    warnings.count === 0 ? h('p', {}, 'No record counts more birds than the flock\'s movements show.') : [
      h('p', {}, statusLabel('warning', `${plural(warnings.count, 'record')} to check`)),
      h('p', {}, warnings.explanation),
      h('ul', { class: 'plain-list' }, warnings.records.map((r) => h('li', {},
        WARNING_LINKS[r.recordType] ? h('a', { href: WARNING_LINKS[r.recordType](farm, r) }, `${WARNING_WORDS[r.recordType]} of ${formatDate(r.date)}`)
          : `${r.recordType} of ${formatDate(r.date)}`))),
    ]);
}

function attentionCard(farm, attention, flockNames) {
  return card('dash-attention', 'Advisor: what needs attention',
    limitationBox(attention.limitation),
    attention.items.length === 0
      ? h('p', {}, 'The Advisor found nothing to point out in what is recorded.')
      : h('ol', { class: 'card-list advice-list' }, attention.items.map((item, index) => adviceCard(farm, item, { index: `dash-${index}`, flockNames, back: 'page:home' }))),
    attention.omittedCount > 0 ? h('p', {}, `${attention.omittedCount} more item${attention.omittedCount === 1 ? '' : 's'} not shown (${attention.totalCount} in all).`) : null,
    h('p', {}, h('a', { href: `#/farms/${farm.id}/advisor` }, 'Open the Advisor')));
}

function expensesCard(farm, expenses) {
  const block = (title, p) => h('div', {},
    h('h3', {}, `${title}: ${periodText(p)}`),
    p.currencies.length === 0 ? h('p', {}, p.emptyReason) : h('ul', { class: 'plain-list' }, p.currencies.map((c) => h('li', {},
      `${formatAmount(c.total, c.currency)} in ${plural(c.count, 'expense')}`,
      c.byCategory.length ? ` (${c.byCategory.map((x) => `${x.label} ${formatAmount(x.total, c.currency)}`).join(', ')})` : ''))),
    p.voidedExcluded ? h('p', { class: 'small-print' }, `${plural(p.voidedExcluded, 'voided expense')} not counted.`) : null);
  return card('dash-expenses', 'Expenses (only you, the owner, see this)',
    h('p', { class: 'small-print' }, expenses.note),
    block('This month', expenses.monthToDate),
    block('The last 31 days', expenses.last31Days),
    h('div', { class: 'button-row' },
      h('a', { class: 'button button--secondary button--small', href: `#/farms/${farm.id}/expenses` }, 'Open expenses'),
      h('a', { class: 'button button--secondary button--small', href: reportHref(farm.id, 'expenses') }, 'Expenses report (R6)')));
}

export function dashboardPage({ farmContext }) {
  const { farm } = farmContext;
  const body = h('div', {}, loadingBlock('Loading the dashboard…'));
  let busy = false;

  async function load() {
    if (busy) return;
    busy = true;
    setContent(body, loadingBlock('Loading the dashboard…'));
    try {
      const { data } = await getDashboard(farm.id);
      if (!body.isConnected) return;
      const flockNames = new Map(data.flocks.flocks.map((f) => [f.id, f.name]));
      setContent(body,
        h('p', { class: 'small-print' }, `${formatDate(data.date)}. "Recent" means the last ${data.recentPeriod.days} days: ${periodText(data.recentPeriod)}.`),
        data.flocks.activeCount === 0 ? emptyState({ title: 'No active flocks', text: data.flocks.emptyReason,
          action: canOpen(farm.myRole, 'flocks') ? h('a', { class: 'button button--secondary', href: `#/farms/${farm.id}/flocks` }, 'Go to the flocks') : null }) : null,
        h('div', { class: 'dashboard-grid' },
          tasksCard(farm, data.tasks),
          flocksCard(farm, data.flocks),
          readinessCard(farm, data.readiness, farm.myRole),
          mortalityCard(farm, data.mortality),
          healthCard(farm, data.health),
          warningsCard(farm, data.populationWarnings),
          productionCard(farm, data.production),
          data.expenses && canOpen(farm.myRole, 'expenses') ? expensesCard(farm, data.expenses) : null),
        attentionCard(farm, data.attention, flockNames),
        h('div', { class: 'button-row' },
          h('button', { type: 'button', class: 'button button--secondary', onclick: () => load() }, 'Refresh the dashboard'),
          h('a', { class: 'button button--secondary', href: `#/farms/${farm.id}/reports` }, 'All reports')));
    } catch (error) {
      if (error.status === 401 || !body.isConnected) return;
      setContent(body, error.status === 403
        ? alertBox('info', 'The dashboard is for the farm owner and managers.', { title: 'Not available' })
        : errorBlock(error, { onRetry: load }));
    } finally {
      busy = false;
    }
  }
  load();

  return h('div', {},
    pageHeading('Dashboard'),
    h('p', { class: 'page-intro' }, `${farm.name}: what is recorded now. Opening the dashboard changes nothing and does not generate tasks.`),
    body);
}
