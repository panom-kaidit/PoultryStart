// One kind of production record across the farm with filters.
import { h, pageHeading, setContent } from '../components/dom.js';
import { takeFlash, alertBox } from '../components/alerts.js';
import { loadingBlock, errorBlock } from '../components/loading.js';
import {
  RECORD_TYPES, recordFacts, recordHref, recordDateText, populationWarning, versionNote, METHOD_LABELS, FEED_STAGE_LABELS,
} from '../components/production.js';
import { listFarmRecords, getSummary, queryString } from '../api/production.js';
import { listFlocks } from '../api/flocks.js';
import { navigate } from '../router.js';
import { notFoundPage } from './errors.js';
import { typeNav, typesForFarm } from './records-overview.js';
import { formatNumber } from '../utils/format.js';
import { formatDate, ugandaToday } from '../utils/dates.js';

export function summaryBlock(path, summary, { headingId = 'records-summary', title = 'Summary for this flock' } = {}) {
  if (!summary) return null;
  const section = h('section', { class: 'card', 'aria-labelledby': headingId },
    h('h2', { id: headingId }, title),
    h('p', { class: 'small-print' }, summary.note));
  if (summary.daysWithRecords === 0) {
    section.append(h('p', {}, 'No records for these dates. Days without a record are not counted as zero.'));
    return section;
  }
  if (path === 'weights') {
    section.append(h('p', {}, summary.comparison),
      h('ul', { class: 'plain-list' }, summary.sessions.map((s) => h('li', {},
        `${formatDate(s.date)}: ${formatNumber(s.averageWeightG)} g average of ${formatNumber(s.sampleSize)} bird${s.sampleSize === 1 ? '' : 's'}`
        + (s.ageWeeks != null ? ` (week ${s.ageWeeks})` : '')
        + (s.changeFromPreviousG != null ? `, ${s.changeFromPreviousG >= 0 ? '+' : ''}${formatNumber(s.changeFromPreviousG)} g since ${s.daysSincePrevious} day${s.daysSincePrevious === 1 ? '' : 's'} earlier` : '')))));
  } else if (path === 'eggs') {
    const t = summary.totals;
    section.append(h('p', {}, `${formatNumber(t.totalEggs)} eggs on ${summary.daysWithRecords} day${summary.daysWithRecords === 1 ? '' : 's'} with a record: `
      + `good ${formatNumber(t.goodEggs)}, second grade ${formatNumber(t.secondGradeEggs)}, floor ${formatNumber(t.floorEggs)}.`),
    h('ul', { class: 'plain-list' }, summary.days.map((d) => h('li', {},
      `${formatDate(d.date)}: ${formatNumber(d.totalEggs)} eggs (${d.periodsRecorded.join(', ')})`))));
  } else {
    section.append(h('p', {}, `${formatNumber(summary.total)} ${summary.unit} on ${summary.daysWithRecords} day${summary.daysWithRecords === 1 ? '' : 's'} with a record`
      + (summary.averagePerRecordedDay != null ? ` (on average ${formatNumber(summary.averagePerRecordedDay)} ${summary.unit} per recorded day)` : '') + '.'),
    h('ul', { class: 'plain-list' }, summary.days.map((d) => h('li', {},
      `${formatDate(d.date)}: ${formatNumber(d.total)} ${d.unit} (${(METHOD_LABELS[d.measurement] || d.measurement).toLowerCase()})`
      + (d.byStage ? `; ${Object.entries(d.byStage).map(([stage, kg]) => `${FEED_STAGE_LABELS[stage] || stage} ${formatNumber(kg)} kg`).join(', ')}` : '')))));
  }
  if (summary.warnings?.length) {
    section.append(alertBox('warning', summary.warnings.map((w) => w.message).join(' '), { title: 'Check these records' }));
  }
  return section;
}

export function recordsListPage({ farmContext, params, query }) {
  const { farm } = farmContext;
  const path = params.recordType;
  if (!RECORD_TYPES[path] || !typesForFarm(farm).includes(path)) return notFoundPage();
  const info = RECORD_TYPES[path];
  const body = h('div', {}, loadingBlock(`Loading the ${info.label.toLowerCase()}…`));
  const filters = { flockId: query.flockId || '', from: query.from || '', to: query.to || '' };

  async function load() {
    setContent(body, loadingBlock(`Loading the ${info.label.toLowerCase()}…`));
    try {
      const flockId = filters.flockId || undefined;
      const [{ data: flockData }, { data: listData }, summary] = await Promise.all([
        listFlocks(farm.id),
        listFarmRecords(farm.id, { type: info.type, flockId, from: filters.from || undefined, to: filters.to || undefined }),
        flockId ? getSummary(farm.id, flockId, path, { from: filters.from || undefined, to: filters.to || undefined }).then((r) => r.data.summary) : Promise.resolve(null),
      ]);
      if (!body.isConnected) return;
      const flocks = new Map(flockData.flocks.map((f) => [f.id, f]));
      const today = ugandaToday();

      const form = h('form', { class: 'card filter-form' },
        h('div', { class: 'field' }, h('label', { class: 'field__label', for: 'filter-flock' }, 'Flock'),
          h('select', { class: 'select', id: 'filter-flock', name: 'flockId' },
            h('option', { value: '' }, 'All flocks'),
            flockData.flocks.map((f) => h('option', { value: String(f.id), selected: String(f.id) === filters.flockId },
              `${f.name}${f.status === 'closed' ? ' (closed)' : ''}`)))),
        h('div', { class: 'field' }, h('label', { class: 'field__label', for: 'filter-from' }, 'From'),
          h('input', { class: 'input', id: 'filter-from', name: 'from', type: 'date', value: listData.from, max: today })),
        h('div', { class: 'field' }, h('label', { class: 'field__label', for: 'filter-to' }, 'To'),
          h('input', { class: 'input', id: 'filter-to', name: 'to', type: 'date', value: listData.to, max: today })),
        h('div', { class: 'button-row' }, h('button', { type: 'submit', class: 'button button--secondary' }, 'Show records')));
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        navigate(`/farms/${farm.id}/records/${path}${queryString({
          flockId: form.elements.flockId.value, from: form.elements.from.value, to: form.elements.to.value,
        })}`);
      });

      const records = listData.records;
      setContent(body,
        form,
        h('p', {}, `${records.length} record${records.length === 1 ? '' : 's'} from ${formatDate(listData.from)} to ${formatDate(listData.to)}`
          + (filters.flockId ? ` for ${flocks.get(Number(filters.flockId))?.name || 'this flock'}` : '') + '.'),
        summaryBlock(path, summary),
        records.length === 0
          ? h('p', { class: 'card' }, `No ${info.label.toLowerCase()} recorded for these dates. That means nothing was recorded, not that the amount was zero.`)
          : h('ul', { class: 'card-list' }, records.map((record) => {
            const flock = flocks.get(record.flockId);
            return h('li', { class: 'card record-card' },
              h('h3', {}, recordDateText(record)),
              h('p', { class: 'farm-card__meta' }, 'Flock: ',
                h('a', { href: `#/farms/${farm.id}/flocks/${record.flockId}` }, flock ? flock.name : 'Open the flock')),
              h('dl', { class: 'details' }, recordFacts(path, record)),
              h('p', {}, versionNote(record)),
              populationWarning(record),
              h('a', { class: 'button button--secondary button--small', href: recordHref(farm.id, path, record),
                'aria-label': `Open the ${info.one} of ${recordDateText(record)}${flock ? `, ${flock.name}` : ''}` }, 'Open the record'));
          })));
    } catch (error) {
      if (error.status === 401 || !body.isConnected) return;
      setContent(body, errorBlock(error, {
        onRetry: load,
        actions: [h('a', { class: 'button', href: `#/farms/${farm.id}/records/${path}` }, 'Show the last 31 days')],
      }));
    }
  }
  load();

  return h('div', {},
    pageHeading(info.label),
    takeFlash(),
    h('p', { class: 'page-intro' }, info.intro),
    typeNav(farm, path),
    h('div', { class: 'button-row' }, h('a', { class: 'button', href: `#/farms/${farm.id}/records/${path}/new${queryString({ flockId: filters.flockId })}` },
      info.add)),
    body);
}
