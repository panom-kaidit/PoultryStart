// The production records overview page.
import { h, pageHeading, setContent } from '../components/dom.js';
import { takeFlash, statusLabel } from '../components/alerts.js';
import { loadingBlock, errorBlock, emptyState } from '../components/loading.js';
import { RECORD_TYPES, TYPE_ORDER, recordFacts, recordHref, recordDateText, METHOD_LABELS } from '../components/production.js';
import { listFarmRecords, getSummary } from '../api/production.js';
import { listFlocks } from '../api/flocks.js';
import { formatNumber } from '../utils/format.js';
import { formatDate } from '../utils/dates.js';

const RECENT = 8;

export const typesForFarm = (farm) => TYPE_ORDER.filter((path) => !RECORD_TYPES[path].layersOnly || farm.poultryType === 'layer');

export function typeNav(farm, active) {
  return h('nav', { class: 'type-nav', 'aria-label': 'Record types' },
    h('ul', { class: 'section-tabs' },
      h('li', {}, h('a', { class: 'section-tab', href: `#/farms/${farm.id}/records`, 'aria-current': active === 'overview' ? 'page' : undefined }, 'Overview')),
      typesForFarm(farm).map((path) => h('li', {},
        h('a', { class: 'section-tab', href: `#/farms/${farm.id}/records/${path}`, 'aria-current': active === path ? 'page' : undefined },
          RECORD_TYPES[path].label)))));
}

function quantityLine(label, summary, unit) {
  if (!summary || summary.daysWithRecords === 0) return [h('dt', {}, label), h('dd', {}, 'No records')];
  const methods = new Set(summary.days.map((d) => d.measurement));
  const method = methods.size === 1 ? METHOD_LABELS[[...methods][0]] : METHOD_LABELS.mixed;
  return [h('dt', {}, label), h('dd', {}, `${formatNumber(summary.total)} ${unit} on ${summary.daysWithRecords} day${summary.daysWithRecords === 1 ? '' : 's'} with a record (${method.toLowerCase()})`)];
}

async function flockSummaryCard(farm, flock) {
  const layer = flock.poultryType === 'layer';
  const [feed, water, weights, eggs] = await Promise.all([
    getSummary(farm.id, flock.id, 'feed').then((r) => r.data.summary),
    getSummary(farm.id, flock.id, 'water').then((r) => r.data.summary),
    getSummary(farm.id, flock.id, 'weights').then((r) => r.data.summary),
    layer && flock.firstEggDate ? getSummary(farm.id, flock.id, 'eggs').then((r) => r.data.summary) : Promise.resolve(null),
  ]);
  const latest = weights.latest;
  let eggLine = null;
  if (layer) {
    eggLine = !flock.firstEggDate
      ? [h('dt', {}, 'Eggs'), h('dd', {}, 'No first-egg date recorded yet, so egg records cannot start.')]
      : (eggs.daysWithRecords === 0
        ? [h('dt', {}, 'Eggs'), h('dd', {}, 'No records')]
        : [h('dt', {}, 'Eggs'), h('dd', {}, `${formatNumber(eggs.totals.totalEggs)} (good ${formatNumber(eggs.totals.goodEggs)}, second grade `
          + `${formatNumber(eggs.totals.secondGradeEggs)}, floor ${formatNumber(eggs.totals.floorEggs)}) on ${eggs.daysWithRecords} day${eggs.daysWithRecords === 1 ? '' : 's'}`)]);
  }
  const warnings = [...(weights.warnings || []), ...(eggs?.warnings || [])];
  return h('li', { class: 'card' },
    h('h3', {}, flock.name),
    h('p', { class: 'small-print' }, `From ${formatDate(feed.from)} to ${formatDate(feed.to)}`),
    h('dl', { class: 'details' },
      quantityLine('Feed', feed, 'kg'),
      quantityLine('Drinking water', water, 'L'),
      eggLine,
      [h('dt', {}, 'Latest weighing'), h('dd', {}, latest
        ? `${formatDate(latest.date)}: ${formatNumber(latest.averageWeightG)} g average, ${formatNumber(latest.sampleSize)} bird${latest.sampleSize === 1 ? '' : 's'}`
        : 'No weighing in this period')]),
    warnings.length ? h('p', {}, statusLabel('warning', `${warnings.length} record${warnings.length === 1 ? '' : 's'} to check (more birds than the flock had on that date)`)) : null,
    h('div', { class: 'button-row' },
      h('a', { class: 'button button--secondary button--small', href: `#/farms/${farm.id}/flocks/${flock.id}` }, 'Open the flock'),
      h('a', { class: 'button button--small', href: `#/farms/${farm.id}/records/feed/new?flockId=${flock.id}`,
        'aria-label': `Add a record for ${flock.name}` }, 'Add a record')));
}

export function recordsOverviewPage({ farmContext }) {
  const { farm } = farmContext;
  const summaries = h('div', {}, loadingBlock('Loading the summaries…'));
  const recent = h('div', {}, loadingBlock('Loading the recent records…'));

  async function load() {
    setContent(summaries, loadingBlock('Loading the summaries…'));
    setContent(recent, loadingBlock('Loading the recent records…'));
    try {
      const { data } = await listFlocks(farm.id);
      if (!summaries.isConnected) return;
      const flocks = new Map(data.flocks.map((f) => [f.id, f]));
      const active = data.flocks.filter((f) => f.status === 'active');
      const [cards, lists] = await Promise.all([
        Promise.all(active.map((f) => flockSummaryCard(farm, f))),
        Promise.all(typesForFarm(farm).map((path) => listFarmRecords(farm.id, { type: RECORD_TYPES[path].type })
          .then((r) => r.data.records.map((record) => ({ path, record }))))),
      ]);
      if (!summaries.isConnected) return;
      setContent(summaries, active.length === 0
        ? emptyState({ title: 'No active flocks', text: 'Production records are kept for each flock. Record a flock first; closed flocks keep their records.',
          action: h('a', { class: 'button button--secondary', href: `#/farms/${farm.id}/flocks` }, 'Go to the flocks') })
        : h('ul', { class: 'card-list' }, cards));
      const newest = lists.flat().sort((a, b) => b.record.recordDate.localeCompare(a.record.recordDate) || b.record.id - a.record.id).slice(0, RECENT);
      setContent(recent, newest.length === 0
        ? h('p', {}, 'No production records in the last 31 days.')
        : h('ul', { class: 'item-list' }, newest.map(({ path, record }) => h('li', { class: 'item' },
          h('p', { class: 'item__title' }, `${RECORD_TYPES[path].label}: ${recordDateText(record)}`),
          h('p', { class: 'farm-card__meta' }, flocks.get(record.flockId)?.name || 'Flock'),
          h('dl', { class: 'details' }, recordFacts(path, record)),
          h('a', { href: recordHref(farm.id, path, record), 'aria-label': `Open the ${RECORD_TYPES[path].one} of ${recordDateText(record)}` }, 'Open the record')))));
    } catch (error) {
      if (error.status === 401 || !summaries.isConnected) return;
      setContent(summaries, errorBlock(error, { onRetry: load }));
      setContent(recent, h('p', {}, ''));
    }
  }
  load();

  return h('div', {},
    pageHeading('Production records'),
    takeFlash(),
    h('p', { class: 'page-intro' }, 'Bird weights, egg collections, feed and drinking water for each flock. '
      + 'These are the amounts recorded on this farm: PoultryStart does not fill them in or compare them with targets.'),
    typeNav(farm, 'overview'),
    h('div', { class: 'button-row' }, h('a', { class: 'button', href: `#/farms/${farm.id}/records/feed/new` }, 'Add a record')),
    h('section', { 'aria-labelledby': 'records-flocks' },
      h('h2', { id: 'records-flocks' }, 'Active flocks: the last 31 days'),
      h('p', { class: 'small-print' }, 'Totals are only of the days that have a record. A day without a record is not counted as zero.'),
      summaries),
    h('section', { class: 'card', 'aria-labelledby': 'records-recent' },
      h('h2', { id: 'records-recent' }, 'Recent records'),
      recent));
}
