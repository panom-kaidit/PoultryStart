// The Flocks Management page.
import { h, pageHeading, setContent } from '../components/dom.js';
import { takeFlash } from '../components/alerts.js';
import { loadingBlock, errorBlock } from '../components/loading.js';
import { stageProgress } from '../components/ui.js';
import { icon } from '../components/icons.js';
import { listFlocks } from '../api/flocks.js';
import { getDashboard } from '../api/reports.js';
import { getAdvice } from '../api/advisor.js';
import { getTopics } from '../api/guidance.js';
import { getSummary } from '../api/production.js';
import { canDo, canOpen } from '../farm/access.js';
import { formatDate } from '../utils/dates.js';
import { formatNumber } from '../utils/format.js';
import { splitFlocks, stageBar, shortLabel, closedOn, closureReasonText, laying } from '../farm/flocks-view.js';

const TYPE = { broiler: 'Broilers', layer: 'Layers' };

async function loadData(farm) {
  const flocksRequest = listFlocks(farm.id);
  const topicsRequest = getTopics().then((r) => r.data.stages).catch(() => null);
  const usesDashboard = canOpen(farm.myRole, 'dashboard');
  const roleRequest = usesDashboard ? getDashboard(farm.id) : getAdvice(farm.id);
  const [{ data }, { data: { flocks } }] = await Promise.all([roleRequest, flocksRequest]);
  const today = data.date;
  let stages;
  let deaths = null;
  if (usesDashboard) {
    stages = new Map(data.flocks.flocks.map((f) => [f.id, f]));
    deaths = new Map(data.mortality.flocks.map((m) => [m.flockId, m.netDeaths]));
  } else {
    stages = new Map(data.flocks.filter((f) => f.status === 'active').map((f) => [f.id, f]));
  }
  const { active, closed } = splitFlocks(flocks);
  const eggs = new Map(await Promise.all(active.filter((f) => laying(f, today)).map((f) =>
    getSummary(farm.id, f.id, 'eggs', { from: today, to: today }).then((r) => [f.id, r.data.summary.days.find((d) => d.date === today) || null]))));
  return { today, active, closed, stages, deaths, eggs, topicStages: await topicsRequest };
}

function stat(label, value, extra) {
  return h('div', { class: 'flocks-stat' }, h('span', { class: 'flocks-stat__label' }, label),
    h('span', { class: 'flocks-stat__value' }, value, extra ? h('span', { class: 'flocks-stat__extra' }, extra) : null));
}

function activeCard(farm, flock, data) {
  const stage = data.stages.get(flock.id);
  const bar = stageBar(data.topicStages, flock.poultryType, stage?.stage);
  const meta = [TYPE[flock.poultryType], flock.currentAgeWeeks != null ? `week ${flock.currentAgeWeeks}` : null, `arrived ${formatDate(flock.arrivalDate)}`]
    .filter(Boolean).join(' · ');
  const stats = [stat('Birds alive', formatNumber(flock.liveBirds), ` / ${formatNumber(flock.birdsReceived)}`)];
  if (laying(flock, data.today)) {
    const day = data.eggs.get(flock.id);
    stats.push(stat('Eggs today', day ? formatNumber(day.totalEggs) : 'Not recorded'));
  }
  if (data.deaths) {
    const n = data.deaths.get(flock.id);
    stats.push(stat('Died (7 days)', n === null || n === undefined ? 'None recorded' : formatNumber(n)));
  }
  return h('li', {}, h('a', { class: 'flocks-card', href: `#/farms/${farm.id}/flocks/${flock.id}`, 'aria-label': `Open ${flock.name}` },
    h('div', { class: 'flocks-card__head' },
      h('div', {}, h('h3', { class: 'flocks-card__name' }, flock.name), h('p', { class: 'flocks-card__meta' }, meta)),
      stage?.stageLabel ? h('span', { class: 'flocks-badge' }, shortLabel(stage.stageLabel)) : null),
    h('div', { class: 'flocks-card__stats' }, stats),
    bar ? stageProgress({ stages: bar.stages, current: bar.current }) : null));
}

function addCard(farm) {
  return h('li', {}, h('a', { class: 'flocks-add', href: `#/farms/${farm.id}/flocks/new` },
    h('span', { class: 'flocks-add__icon', 'aria-hidden': 'true' }, icon('plus', { size: 24 })),
    h('span', { class: 'flocks-add__title' }, 'Add another flock'),
    h('span', { class: 'flocks-add__text' }, 'When a new batch of chicks arrives')));
}

function closedTable(farm, closed) {
  return h('div', { class: 'flocks-table-wrap', role: 'region', 'aria-labelledby': 'flocks-closed', tabindex: '0' },
    h('table', { class: 'flocks-table' },
      h('caption', { class: 'visually-hidden' }, 'Closed flocks'),
      h('thead', {}, h('tr', {}, ['Flock', 'Type', 'Arrived', 'Closed', 'Birds received', 'Reason'].map((c) => h('th', { scope: 'col' }, c)),
        h('th', { scope: 'col' }, h('span', { class: 'visually-hidden' }, 'Open')))),
      h('tbody', {}, closed.map((f) => h('tr', {},
        h('th', { scope: 'row' }, f.name),
        h('td', {}, TYPE[f.poultryType] || f.poultryType),
        h('td', {}, formatDate(f.arrivalDate)),
        h('td', {}, closedOn(f) ? formatDate(closedOn(f)) : 'Not known'),
        h('td', {}, formatNumber(f.birdsReceived)),
        h('td', {}, closureReasonText(f)),
        h('td', {}, h('a', { href: `#/farms/${farm.id}/flocks/${f.id}`, 'aria-label': `Open ${f.name}` }, 'Open')))))));
}

export function flocksListPage({ farmContext }) {
  const { farm } = farmContext;
  const canCreate = canDo(farm.myRole, 'flocks:manage');
  const body = h('div', { class: 'flocks-body' }, loadingBlock('Loading the flocks…'));
  let loading = false;

  async function load() {
    if (loading) return;
    loading = true;
    setContent(body, loadingBlock('Loading the flocks…'));
    try {
      const data = await loadData(farm);
      const activeList = h('ul', { class: 'flocks-grid' }, data.active.map((f) => activeCard(farm, f, data)), canCreate ? addCard(farm) : null);
      setContent(body,
        h('section', { 'aria-labelledby': 'flocks-active' },
          h('h2', { class: 'flocks-section', id: 'flocks-active' }, `Active · ${data.active.length}`),
          data.active.length || canCreate ? activeList : null,
          data.active.length ? null : h('p', { class: 'flocks-empty' }, canCreate
            ? 'No active flocks. Add a flock on the day the birds arrive; its bird numbers are then kept from what you record.'
            : 'No active flocks. The farm owner or a farm manager adds a flock when the birds arrive.')),
        h('section', { 'aria-labelledby': 'flocks-closed' },
          h('h2', { class: 'flocks-section', id: 'flocks-closed' }, `Closed · ${data.closed.length}`),
          data.closed.length ? [h('p', { class: 'flocks-note' }, 'Closed flocks are kept as records. They cannot be changed or reopened.'), closedTable(farm, data.closed)]
            : h('p', { class: 'flocks-empty' }, 'No closed flocks yet. A flock is closed when its birds are all sold or gone; it is then kept here as a record.')));
    } catch (error) {
      if (error.status !== 401) setContent(body, errorBlock(error, { onRetry: load }));
    } finally {
      loading = false;
    }
  }
  load();

  return h('div', { class: 'flocks' },
    h('div', { class: 'flocks-head' }, pageHeading('Flocks Management'),
      canCreate ? h('a', { class: 'flocks-new', href: `#/farms/${farm.id}/flocks/new` }, icon('plus', { size: 20 }), 'New flock') : null),
    takeFlash(),
    body);
}
