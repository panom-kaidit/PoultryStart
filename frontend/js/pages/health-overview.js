// The health observations overview page.
import { h, pageHeading, setContent } from '../components/dom.js';
import { takeFlash } from '../components/alerts.js';
import { loadingBlock, errorBlock, emptyState } from '../components/loading.js';
import { disclaimerBox, healthNav, observationItem, HEALTH_DISCLAIMER } from '../components/health.js';
import { listFarmObservations } from '../api/health.js';
import { listFlocks } from '../api/flocks.js';
import { canDo } from '../farm/access.js';
import { formatDate } from '../utils/dates.js';

const RECENT = 6;

export function healthOverviewPage({ farmContext }) {
  const { farm } = farmContext;
  const disclaimer = h('div', {}, disclaimerBox(HEALTH_DISCLAIMER));
  const body = h('div', {}, loadingBlock('Loading the health observations…'));

  async function load() {
    setContent(body, loadingBlock('Loading the health observations…'));
    try {
      const [{ data: flockData }, { data }] = await Promise.all([listFlocks(farm.id), listFarmObservations(farm.id)]);
      if (!body.isConnected) return;
      if (data.disclaimer) setContent(disclaimer, disclaimerBox(data.disclaimer));
      const flocks = new Map(flockData.flocks.map((f) => [f.id, f]));
      const active = flockData.flocks.filter((f) => f.status === 'active');
      const counts = new Map();
      for (const o of data.observations) counts.set(o.flockId, (counts.get(o.flockId) || 0) + 1);
      const newest = data.observations.slice(0, RECENT);
      const period = `${formatDate(data.from)} to ${formatDate(data.to)}`;

      setContent(body,
        h('section', { 'aria-labelledby': 'health-flocks' },
          h('h2', { id: 'health-flocks' }, 'Active flocks'),
          active.length === 0
            ? emptyState({ title: 'No active flocks', text: 'Health observations are kept for each flock. Record a flock first; closed flocks keep their observations.',
              action: h('a', { class: 'button button--secondary', href: `#/farms/${farm.id}/flocks` }, 'Go to the flocks') })
            : h('ul', { class: 'card-list' }, active.map((flock) => {
              const count = counts.get(flock.id) || 0;
              return h('li', { class: 'card' },
                h('h3', {}, flock.name),
                h('p', {}, `${count} observation${count === 1 ? '' : 's'} recorded from ${period}.`),
                h('div', { class: 'button-row' },
                  h('a', { class: 'button button--secondary button--small', href: `#/farms/${farm.id}/health/flocks/${flock.id}`,
                    'aria-label': `Health observations of ${flock.name}` }, 'Its observations'),
                  canDo(farm.myRole, 'health:create')
                    ? h('a', { class: 'button button--small', href: `#/farms/${farm.id}/health/new?flockId=${flock.id}`,
                      'aria-label': `Record an observation for ${flock.name}` }, 'Record an observation') : null));
            }))),
        h('section', { class: 'card', 'aria-labelledby': 'health-recent' },
          h('h2', { id: 'health-recent' }, 'Recent observations'),
          h('p', { class: 'small-print' }, `From ${period}. No observation means nothing was written down, not that the birds were checked and found well.`),
          newest.length === 0
            ? h('p', {}, 'No health observations recorded in this period.')
            : h('ul', { class: 'card-list' }, newest.map((o) => observationItem(farm.id, o, flocks.get(o.flockId)?.name))),
          h('p', {}, h('a', { href: `#/farms/${farm.id}/health/all` }, 'All observations, with filters'))));
    } catch (error) {
      if (error.status === 401 || !body.isConnected) return;
      setContent(body, errorBlock(error, { onRetry: load }));
    }
  }
  load();

  return h('div', {},
    pageHeading('Health observations'),
    takeFlash(),
    h('p', { class: 'page-intro' }, 'Write down what you notice about the birds\' health: how they look or behave, how many are affected, '
      + 'what you did and whether you contacted a veterinarian or extension officer. These are your own notes; deaths are recorded on the flock.'),
    disclaimer,
    healthNav(farm, 'overview'),
    canDo(farm.myRole, 'health:create')
      ? h('div', { class: 'button-row' }, h('a', { class: 'button', href: `#/farms/${farm.id}/health/new` }, 'Record an observation')) : null,
    body);
}
