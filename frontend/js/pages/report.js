// One report page (R1 to R6).
import { h, pageHeading, setContent } from '../components/dom.js';
import { alertBox, statusLabel } from '../components/alerts.js';
import { loadingBlock, errorBlock, emptyState } from '../components/loading.js';
import {
  reportOf, reportsBreadcrumbs, filterForm, dataTable, noteBox, periodText, countOr, reportHref,
  reportMenu, quickPeriods, figureCards, printButton,
} from '../components/reports.js';
import { barChart } from '../components/ui.js';
import { MOVEMENT_LABELS } from '../components/flocks.js';
import { summaryBlock as productionSummary } from './records-list.js';
import { HEALTH_DISCLAIMER } from '../components/health.js';
import { summaryBlock as expenseSummary, EXPENSE_CATEGORIES } from '../components/expenses.js';
import { getFlockReport, getMortalityReport, getTaskReport } from '../api/reports.js';
import { getSummary, queryString } from '../api/production.js';
import { listFarmObservations } from '../api/health.js';
import { getExpenseSummary } from '../api/expenses.js';
import { listFlocks } from '../api/flocks.js';
import { canOpen } from '../farm/access.js';
import { navigate } from '../router.js';
import { notFoundPage, notAvailableForRolePage } from './errors.js';
import { formatNumber } from '../utils/format.js';
import { formatDate } from '../utils/dates.js';

const isId = (value) => /^[1-9]\d*$/.test(value || '');
const isDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || '');
const plural = (n, word) => `${formatNumber(n)} ${word}${n === 1 ? '' : 's'}`;

const MORTALITY_STATE = {
  no_mortality_recorded: 'No deaths recorded',
  deaths_recorded: 'Deaths recorded',
  corrected_to_zero: 'Deaths recorded, corrected to 0',
  outside_flock_dates: 'The flock had no birds in this period',
};
const TASK_STATUS_LABELS = { pending: 'To do', overdue: 'Overdue', missed: 'Missed', completed: 'Done', cancelled: 'Cancelled' };

function populationReport(farm, data) {
  const f = data.flock;
  const clipped = data.period && (data.period.from !== data.requested.from || data.period.to !== data.requested.to);
  const head = [
    h('p', {}, h('a', { href: `#/farms/${farm.id}/flocks/${f.id}` }, f.name), ` · arrived ${formatDate(f.arrivalDate)}`,
      f.closedDate ? ` · closed ${formatDate(f.closedDate)}` : ' · active', ` · ${plural(f.birdsReceived, 'bird')} received`),
    h('p', {}, `Period asked for: ${periodText(data.requested)}.`),
    clipped ? alertBox('info', `The report covers ${periodText(data.period)}: the flock's own dates (no birds before it arrived or after it closed).`) : null,
    noteBox(data.note),
  ];
  if (!data.period) return [head, emptyState({ title: 'No birds in this period', text: data.emptyReason })];
  const totals = data.totalsByType;
  return [head,
    figureCards([
      [`Birds at the end of ${formatDate(data.startingPopulation.endOfDate)}`, formatNumber(data.startingPopulation.birds)],
      ['Net change in the period', `${data.netChange > 0 ? '+' : ''}${formatNumber(data.netChange)}`],
      [`Birds at the end of ${formatDate(data.endingPopulation.endOfDate)}`, formatNumber(data.endingPopulation.birds)]]),
    data.reconciliation.balanced
      ? h('p', {}, statusLabel('success', 'Start + changes = end: the movement history adds up'))
      : alertBox('warning', 'The movement history does not add up for this period. Check the flock\'s movements.'),
    dataTable({ id: 'r1-types', caption: 'Movements in the period, by type (birds and number of entries)', headers: ['Type', 'Birds', 'Entries'],
      rows: [...Object.keys(MOVEMENT_LABELS).filter((t) => t !== 'correction').map((t) => [MOVEMENT_LABELS[t], formatNumber(totals[t].birds), formatNumber(totals[t].movements)]),
        ['Corrections (net birds)', `${totals.correction.netBirds > 0 ? '+' : ''}${formatNumber(totals.correction.netBirds)}`, formatNumber(totals.correction.movements)]] }),
    data.days.length === 0 ? h('p', { class: 'card' }, 'No movements in this period.')
      : dataTable({ id: 'r1-days', caption: 'Days with movements: the change and the birds at the end of the day', headers: ['Date', 'Movements', 'Net change', 'Birds at the end of the day'],
        rows: data.days.map((d) => [formatDate(d.date),
          d.movements.map((m) => `${MOVEMENT_LABELS[m.movementType] || m.movementType}${m.correctedMovementType ? ` of ${(MOVEMENT_LABELS[m.correctedMovementType] || m.correctedMovementType).toLowerCase()}` : ''} ${m.birdChange > 0 ? '+' : ''}${formatNumber(m.birdChange)}`).join('; '),
          `${d.netChange > 0 ? '+' : ''}${formatNumber(d.netChange)}`, formatNumber(d.endOfDayPopulation)]) })];
}

function mortalityReport(farm, data) {
  const t = data.totals;
  const weekRow = (w) => [periodText(w), countOr(w.netDeaths, 'None recorded'), formatNumber(w.mortalityRecords), MORTALITY_STATE[w.state] || w.state];
  return [
    h('p', {}, `Period: ${periodText(data.period)}.`), noteBox(data.note),
    data.emptyReason ? emptyState({ title: 'No flock had birds', text: data.emptyReason }) : [
      figureCards([
        [data.label, t.netDeaths === null ? 'No deaths recorded' : formatNumber(t.netDeaths)],
        ['Days with deaths', formatNumber(t.daysWithDeaths)],
        ['Mortality entries', formatNumber(t.mortalityRecords)],
        ['Flocks included', formatNumber(t.flocksIncluded)]]),
      dataTable({ id: 'r2-weeks', caption: 'By week (Monday to Sunday, cut to the period)', headers: ['Week', 'Deaths', 'Entries', 'State'], rows: data.byWeek.map(weekRow) }),
      h('h2', {}, 'By flock'),
      h('ul', { class: 'card-list' }, data.flocks.map((item) => h('li', { class: 'card' },
        h('h3', {}, h('a', { href: `#/farms/${farm.id}/flocks/${item.flock.id}` }, item.flock.name), item.flock.status === 'closed' ? ' (closed)' : ''),
        item.period ? [
          h('p', {}, `${periodText(item.period)}: ${item.netDeaths === null ? 'no deaths recorded' : plural(item.netDeaths, 'death')}`
            + ` on ${plural(item.daysWithDeaths, 'day')}${item.correctedRecords ? `, ${plural(item.correctedRecords, 'entry')} corrected` : ''}.`),
          item.byDay.length ? dataTable({ id: `r2-days-${item.flock.id}`, caption: `Days with mortality entries: ${item.flock.name}`, headers: ['Date', 'Deaths', 'Entries', 'Corrected'],
            rows: item.byDay.map((d) => [formatDate(d.date), formatNumber(d.deaths), formatNumber(d.mortalityRecords), formatNumber(d.correctedRecords)]) }) : null,
        ] : h('p', {}, item.message)))),
    ]];
}

function tasksReport(farm, data) {
  const statuses = Object.keys(TASK_STATUS_LABELS);
  const countRow = (label, c) => [label, formatNumber(c.total), ...statuses.map((s) => formatNumber(c[s])), formatNumber(c.completedLate)];
  const headers = ['', 'All', ...statuses.map((s) => TASK_STATUS_LABELS[s]), 'Done late'];
  return [
    h('p', {}, `Tasks due ${periodText(data.period)} (statuses as of ${formatDate(data.today)}).`), noteBox(data.note),
    data.emptyReason ? emptyState({ title: 'No tasks', text: data.emptyReason }) : [
      dataTable({ id: 'r4-totals', caption: 'All tasks due in the period, by status', headers: headers.map((x, i) => (i === 0 ? 'Tasks' : x)), rows: [countRow('All tasks', data.totals)] }),
      h('dl', { class: 'details' }, statuses.map((s) => [h('dt', {}, TASK_STATUS_LABELS[s]), h('dd', {}, data.statusDefinitions[s])])),
      dataTable({ id: 'r4-codes', caption: 'By task', headers: headers.map((x, i) => (i === 0 ? 'Task' : x)), rows: data.byCode.map((c) => countRow(`${c.label} (${c.code})`, c)) }),
      dataTable({ id: 'r4-weeks', caption: 'By week (Monday to Sunday, cut to the period)', headers: headers.map((x, i) => (i === 0 ? 'Week' : x)), rows: data.byWeek.map((w) => countRow(periodText(w), w)) }),
      h('h2', {}, `Problems reported (${data.problemsReported.count})`),
      data.problemsReported.count === 0 ? h('p', {}, 'No completed task in this period has a problem reported.')
        : h('ul', { class: 'plain-list' }, data.problemsReported.tasks.map((t) => h('li', {},
          h('a', { href: `#/farms/${farm.id}/tasks/${t.id}` }, t.title), ` (due ${formatDate(t.dueDate)})`))),
      h('p', { class: 'small-print' }, 'Open a task to read its notes. Task notes are not part of reports.'),
    ]];
}

function healthReport(farm, data, flocks) {
  const list = data.observations;
  const names = new Map(flocks.map((f) => [f.id, f.name]));
  const byFlock = new Map();
  for (const o of list) byFlock.set(o.flockId, (byFlock.get(o.flockId) || 0) + 1);
  const yesNo = (v) => (v ? 'Yes' : 'No');
  return [
    h('p', {}, `Period: ${periodText(data)}.`),
    h('p', { class: 'small-print' }, 'These counts are of the observations recorded (counted from the list for the same filters). They are not a diagnosis and do not say whether a flock is healthy. The observation notes are on each observation\'s own page.'),
    list.length === 0 ? h('p', { class: 'card' }, 'No health observations recorded in this period. That means nothing was written down, not that the birds were checked and found well.') : [
      figureCards([
        ['Observations recorded', formatNumber(list.length)],
        ['Veterinarian contacted', formatNumber(list.filter((o) => o.vetContacted).length)],
        ['Extension officer contacted', formatNumber(list.filter((o) => o.extensionOfficerContacted).length)],
        ['Neither contact recorded', formatNumber(list.filter((o) => !o.vetContacted && !o.extensionOfficerContacted).length)]]),
      dataTable({ id: 'r5-flocks', caption: 'By flock', headers: ['Flock', 'Observations'],
        rows: [...byFlock.entries()].map(([id, n]) => [h('a', { href: `#/farms/${farm.id}/health/flocks/${id}` }, names.get(id) || 'Flock'), formatNumber(n)]) }),
      dataTable({ id: 'r5-list', caption: 'Observations (newest first; open one to read it)', headers: ['Date', 'Flock', 'Birds affected', 'Veterinarian', 'Extension officer', ''],
        rows: list.map((o) => [formatDate(o.observationDate), names.get(o.flockId) || 'Flock', o.birdsAffected == null ? 'Not counted' : formatNumber(o.birdsAffected),
          yesNo(o.vetContacted), yesNo(o.extensionOfficerContacted),
          h('a', { href: `#/farms/${farm.id}/health/flocks/${o.flockId}/${o.id}`, 'aria-label': `Open the observation of ${formatDate(o.observationDate)}, ${names.get(o.flockId) || 'flock'}` }, 'Open')]) }),
    ],
    h('div', { class: 'disclaimer' }, alertBox('warning', data.disclaimer || HEALTH_DISCLAIMER, { title: 'Important' }))];
}

const SHORT_DAY = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
function eggsPanel(summary) {
  if (!summary || summary.daysWithRecords === 0) return null;
  const days = [...summary.days].sort((a, b) => (a.date < b.date ? -1 : 1));
  const best = days.reduce((m, d) => (d.totalEggs > m.totalEggs ? d : m), days[0]);
  const t = summary.totals;
  return h('section', { class: 'report-eggs', 'aria-labelledby': 'r3-eggs-day' },
    h('h2', { id: 'r3-eggs-day' }, 'Eggs per day'),
    figureCards([
      ['Average per recorded day', formatNumber(Math.round(t.totalEggs / summary.daysWithRecords))],
      [`Best day (${formatDate(best.date)})`, formatNumber(best.totalEggs)],
      ['Total eggs', formatNumber(t.totalEggs)]]),
    barChart({ values: days.map((d) => ({ label: SHORT_DAY(d.date).split(' ')[1], value: d.totalEggs, display: formatNumber(d.totalEggs) })),
      ariaLabel: `Eggs collected on each of the ${days.length} days with a record`, height: 160, showValues: days.length <= 14, showLabels: days.length <= 14, dense: days.length > 14 }),
    h('p', { class: 'small-print' }, `${days.length} day${days.length === 1 ? '' : 's'} with a record. Days without a record are not shown and are not counted as zero.`),
    dataTable({ id: 'r3-eggs-days', caption: 'Eggs on each day with a record (newest first)', headers: ['Date', 'Good', 'Second grade', 'Floor', 'Total'],
      rows: [...days].reverse().map((d) => [SHORT_DAY(d.date), formatNumber(d.goodEggs), formatNumber(d.secondGradeEggs), formatNumber(d.floorEggs), h('strong', {}, formatNumber(d.totalEggs))]) }));
}

export function reportPage({ farmContext, params, query }) {
  const { farm } = farmContext;
  const report = reportOf(params.reportKey);
  if (!report) return notFoundPage();
  if (report.ownerOnly && !canOpen(farm.myRole, 'expenses')) return notAvailableForRolePage({ farmContext });

  const key = report.key;
  const needsFlock = key === 'population' || key === 'production';
  const filters = {
    flockId: key === 'expenses' && query.flockId === 'none' ? 'none' : (isId(query.flockId) ? query.flockId : ''),
    from: isDate(query.from) ? query.from : '',
    to: isDate(query.to) ? query.to : '',
    category: key === 'expenses' && EXPENSE_CATEGORIES[query.category] ? query.category : '',
  };
  const controls = h('div', {}, loadingBlock('Loading the flocks…'));
  const body = h('div', { 'aria-live': 'polite' });

  const apply = (values) => navigate(`/farms/${farm.id}/reports/${key}${queryString({
    flockId: values.flockId, from: values.from, to: values.to, category: values.category,
  })}`);

  async function loadReport(flocks) {
    const range = { from: filters.from || undefined, to: filters.to || undefined };
    const flockId = filters.flockId || undefined;
    if (needsFlock && !flockId) {
      setContent(body, flocks.length ? h('p', { class: 'card' }, 'Choose a flock to see this report.')
        : emptyState({ title: 'No flocks yet', text: 'This report is about one flock. Record a flock first.' }));
      return;
    }
    setContent(body, loadingBlock('Working out the report…'));
    try {
      let content;
      if (key === 'population') content = populationReport(farm, (await getFlockReport(farm.id, flockId, range)).data);
      else if (key === 'mortality') content = mortalityReport(farm, (await getMortalityReport(farm.id, { ...range, flockId })).data);
      else if (key === 'tasks') content = tasksReport(farm, (await getTaskReport(farm.id, { ...range, flockId })).data);
      else if (key === 'health') content = healthReport(farm, (await listFarmObservations(farm.id, { ...range, flockId })).data, flocks);
      else if (key === 'expenses') {
        const { data } = await getExpenseSummary(farm.id, { ...range, flockId, category: filters.category || undefined });
        content = [expenseSummary(data.summary, { headingId: 'r6-summary', title: `Expenses: ${periodText(data.summary)}`, showFlocks: !flockId, farmId: farm.id }),
          h('p', {}, h('a', { href: `#/farms/${farm.id}/expenses/all${queryString({ ...range, flockId, category: filters.category || undefined })}` }, 'The expenses themselves, with the same filters'))];
      } else if (key === 'production') {
        const flock = flocks.find((f) => String(f.id) === String(flockId));
        if (!flock) throw Object.assign(new Error('Flock not found.'), { status: 404 });
        const types = ['weights', 'feed', 'water', ...(flock.poultryType === 'layer' && flock.firstEggDate ? ['eggs'] : [])];
        const summaries = await Promise.all(types.map((t) => getSummary(farm.id, flock.id, t, range).then((r) => [t, r.data.summary])));
        const titles = { weights: 'Bird weights', feed: 'Feed', water: 'Drinking water', eggs: 'Egg collections' };
        content = [
          h('p', {}, `${flock.name}${flock.status === 'closed' ? ' (closed)' : ''}: ${periodText(summaries[0][1])}.`),
          flock.poultryType === 'layer' && !flock.firstEggDate
            ? alertBox('info', 'No first-egg date is recorded for this flock, so it has no egg records yet. Egg records start from that date.') : null,
          eggsPanel(summaries.find(([t]) => t === 'eggs')?.[1]),
          summaries.map(([t, s]) => [productionSummary(t, s, { headingId: `r3-${t}`, title: titles[t] }),
            h('p', {}, h('a', { href: `#/farms/${farm.id}/records/${t}${queryString({ flockId: flock.id, ...range })}` }, `The ${titles[t].toLowerCase()} records`))]),
        ];
      }
      if (!body.isConnected) return;
      setContent(body, content);
    } catch (error) {
      if (error.status === 401 || !body.isConnected) return;
      setContent(body, errorBlock(error, {
        onRetry: error.status === 0 || error.status >= 500 ? () => loadReport(flocks) : undefined,
        actions: [h('a', { class: 'button', href: reportHref(farm.id, key) }, 'Show the default period')],
      }));
    }
  }

  async function load() {
    setContent(controls, loadingBlock('Loading the flocks…'));
    try {
      const { data } = await listFlocks(farm.id);
      if (!controls.isConnected) return;
      const flocks = data.flocks;
      const extra = key === 'expenses' ? [{ id: 'report-category', name: 'category', label: 'Category', value: filters.category,
        options: [['', 'All categories'], ...Object.entries(EXPENSE_CATEGORIES)] }] : [];
      const flockChoices = key === 'expenses' ? [...flocks, { id: 'none', name: 'Not linked to a flock', status: 'active' }] : flocks;
      const chosen = flocks.find((f) => String(f.id) === String(filters.flockId));
      setContent(controls, quickPeriods({ from: filters.from, to: filters.to, arrivalDate: key === 'expenses' ? null : chosen?.arrivalDate,
        onPick: (range) => apply({ ...filters, ...range }) }), filterForm({ flocks: flockChoices, flockRequired: needsFlock, flockId: filters.flockId, from: filters.from, to: filters.to,
        extra, defaultsText: report.defaults, onApply: apply }));
      loadReport(flocks);
    } catch (error) {
      if (error.status === 401 || !controls.isConnected) return;
      setContent(controls, errorBlock(error, { onRetry: load }));
    }
  }
  load();

  return h('div', { class: 'reports' },
    reportsBreadcrumbs(farm, [`${report.code}: ${report.title}`]),
    h('div', { class: 'reports-layout' },
      reportMenu(farm, key),
      h('div', { class: 'report-panel' },
        h('div', { class: 'report-panel__head' },
          h('div', {}, pageHeading(`${report.code}: ${report.title}`), h('p', { class: 'report-panel__intro' }, report.description)),
          printButton()),
        h('div', { class: 'report-controls' }, controls),
        body)));
}
