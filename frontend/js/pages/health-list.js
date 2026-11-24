// Health observations across the farm with filters.
import { h, pageHeading, setContent } from '../components/dom.js';
import { takeFlash } from '../components/alerts.js';
import { loadingBlock, errorBlock } from '../components/loading.js';
import { disclaimerBox, healthNav, healthBreadcrumbs, observationItem } from '../components/health.js';
import { listFarmObservations } from '../api/health.js';
import { queryString } from '../api/production.js';
import { listFlocks } from '../api/flocks.js';
import { canDo } from '../farm/access.js';
import { navigate } from '../router.js';
import { formatDate, ugandaToday } from '../utils/dates.js';

export function healthListPage({ farmContext, query }) {
  const { farm } = farmContext;
  const filters = { flockId: /^[1-9]\d*$/.test(query.flockId || '') ? query.flockId : '', from: query.from || '', to: query.to || '' };
  const body = h('div', {}, loadingBlock('Loading the observations…'));

  async function load() {
    setContent(body, loadingBlock('Loading the observations…'));
    try {
      const [{ data: flockData }, { data }] = await Promise.all([
        listFlocks(farm.id),
        listFarmObservations(farm.id, { flockId: filters.flockId || undefined, from: filters.from || undefined, to: filters.to || undefined }),
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
          h('input', { class: 'input', id: 'filter-from', name: 'from', type: 'date', value: data.from, max: today })),
        h('div', { class: 'field' }, h('label', { class: 'field__label', for: 'filter-to' }, 'To'),
          h('input', { class: 'input', id: 'filter-to', name: 'to', type: 'date', value: data.to, max: today })),
        h('div', { class: 'button-row' }, h('button', { type: 'submit', class: 'button button--secondary' }, 'Show observations')));
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        navigate(`/farms/${farm.id}/health/all${queryString({
          flockId: form.elements.flockId.value, from: form.elements.from.value, to: form.elements.to.value,
        })}`);
      });

      const list = data.observations;
      setContent(body,
        form,
        h('p', {}, `${list.length} observation${list.length === 1 ? '' : 's'} from ${formatDate(data.from)} to ${formatDate(data.to)}`
          + (filters.flockId ? ` for ${flocks.get(Number(filters.flockId))?.name || 'this flock'}` : '') + '.'),
        list.length === 0
          ? h('p', { class: 'card' }, 'No health observations recorded for these dates.')
          : h('ul', { class: 'card-list' }, list.map((o) => observationItem(farm.id, o, flocks.get(o.flockId)?.name))),
        data.disclaimer ? disclaimerBox(data.disclaimer) : null);
    } catch (error) {
      if (error.status === 401 || !body.isConnected) return;
      setContent(body, errorBlock(error, {
        onRetry: load,
        actions: [h('a', { class: 'button', href: `#/farms/${farm.id}/health/all` }, 'Show the last 31 days')],
      }));
    }
  }
  load();

  return h('div', {},
    pageHeading('All health observations'),
    takeFlash(),
    healthBreadcrumbs(farm, ['All observations']),
    healthNav(farm, 'all'),
    canDo(farm.myRole, 'health:create')
      ? h('div', { class: 'button-row' }, h('a', { class: 'button', href: `#/farms/${farm.id}/health/new${queryString({ flockId: filters.flockId })}` },
        'Record an observation')) : null,
    body);
}
