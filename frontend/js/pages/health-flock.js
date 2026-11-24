// One flock's health observations.
import { h, pageHeading, setContent } from '../components/dom.js';
import { takeFlash } from '../components/alerts.js';
import { loadingBlock, errorBlock } from '../components/loading.js';
import { disclaimerBox, healthNav, healthBreadcrumbs, observationItem } from '../components/health.js';
import { listFlockObservations } from '../api/health.js';
import { queryString } from '../api/production.js';
import { getFlock } from '../api/flocks.js';
import { canDo } from '../farm/access.js';
import { navigate } from '../router.js';
import { formatDate, ugandaToday } from '../utils/dates.js';

export function healthFlockPage({ farmContext, params, query }) {
  const { farm } = farmContext;
  const flockId = Number(params.flockId);
  const filters = { from: query.from || '', to: query.to || '' };
  const heading = pageHeading('Health observations of the flock');
  const crumbs = h('div', {});
  const actions = h('div', {});
  const body = h('div', {}, loadingBlock('Loading the observations…'));

  async function load() {
    setContent(body, loadingBlock('Loading the observations…'));
    try {
      const [{ data: flockData }, { data }] = await Promise.all([
        getFlock(farm.id, flockId),
        listFlockObservations(farm.id, flockId, { from: filters.from || undefined, to: filters.to || undefined }),
      ]);
      if (!body.isConnected) return;
      const flock = flockData.flock;
      heading.textContent = `Health observations: ${flock.name}`;
      setContent(crumbs, healthBreadcrumbs(farm, [flock.name]));
      setContent(actions, h('div', { class: 'button-row' },
        canDo(farm.myRole, 'health:create')
          ? h('a', { class: 'button', href: `#/farms/${farm.id}/health/new?flockId=${flock.id}` }, 'Record an observation') : null,
        h('a', { class: 'button button--secondary', href: `#/farms/${farm.id}/flocks/${flock.id}` }, 'Open the flock')));
      const today = ugandaToday();
      const form = h('form', { class: 'card filter-form' },
        h('div', { class: 'field' }, h('label', { class: 'field__label', for: 'filter-from' }, 'From'),
          h('input', { class: 'input', id: 'filter-from', name: 'from', type: 'date', value: data.from, max: today })),
        h('div', { class: 'field' }, h('label', { class: 'field__label', for: 'filter-to' }, 'To'),
          h('input', { class: 'input', id: 'filter-to', name: 'to', type: 'date', value: data.to, max: today })),
        h('div', { class: 'button-row' }, h('button', { type: 'submit', class: 'button button--secondary' }, 'Show observations')));
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        navigate(`/farms/${farm.id}/health/flocks/${flock.id}${queryString({ from: form.elements.from.value, to: form.elements.to.value })}`);
      });
      const list = data.observations;
      setContent(body,
        flock.status === 'closed' ? h('p', { class: 'small-print' }, 'This flock is closed. Observations can still be recorded for dates up to its closure.') : null,
        form,
        h('p', {}, `${list.length} observation${list.length === 1 ? '' : 's'} from ${formatDate(data.from)} to ${formatDate(data.to)}.`),
        list.length === 0
          ? h('p', { class: 'card' }, 'No health observations recorded for these dates.')
          : h('ul', { class: 'card-list' }, list.map((o) => observationItem(farm.id, o, flock.name))),
        data.disclaimer ? disclaimerBox(data.disclaimer) : null);
    } catch (error) {
      if (error.status === 401 || !body.isConnected) return;
      setContent(body, errorBlock(error, {
        onRetry: error.status === 0 || error.status >= 500 || error.status === 400 ? load : undefined,
        actions: [h('a', { class: 'button', href: `#/farms/${farm.id}/health` }, 'Health observations')],
      }));
    }
  }
  load();

  return h('div', {}, heading, takeFlash(), crumbs, healthNav(farm, null), actions, body);
}
