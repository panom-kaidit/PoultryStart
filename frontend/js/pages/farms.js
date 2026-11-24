// The My farms page.
import { h, pageHeading, setContent } from '../components/dom.js';
import { takeFlash } from '../components/alerts.js';
import { loadingBlock, errorBlock, emptyState } from '../components/loading.js';
import { listFarms } from '../api/farms.js';
import { getCurrentFarm } from '../farm/farm.js';
import { POULTRY_TYPE_LABELS, ROLE_LABELS, labelFor } from '../utils/format.js';

function farmCard(farm, isOpen) {
  return h('li', { class: 'card farm-card' },
    h('h2', {}, farm.name),
    h('p', { class: 'farm-card__meta' }, farm.location),
    h('p', { class: 'farm-card__meta' }, labelFor(POULTRY_TYPE_LABELS, farm.poultryType)),
    h('p', {}, h('span', { class: 'badge' }, `Your role: ${ROLE_LABELS[farm.myRole] || farm.myRole}`),
      isOpen ? [' ', h('span', { class: 'badge badge--current' }, 'Open now')] : null),
    h('div', {},
      h('a', { class: 'button', href: `#/farms/${farm.id}`,
        'aria-label': `${isOpen ? 'Continue with this farm' : 'Open this farm'}: ${farm.name}` },
      isOpen ? 'Continue with this farm' : 'Open this farm')));
}

export function farmsPage() {
  const body = h('div', {}, loadingBlock('Loading your farms…'));
  const createButton = h('a', { class: 'button', href: '#/farms/new' }, 'Create a farm');

  async function load() {
    setContent(body, loadingBlock('Loading your farms…'));
    try {
      const { data } = await listFarms();
      if (!body.isConnected) return;
      const openId = getCurrentFarm()?.farm.id;
      if (data.farms.length === 0) {
        setContent(body, emptyState({
          title: 'You do not have a farm yet',
          text: 'Create your farm to start. If another farm owner added you to their farm, it will appear here.',
          action: h('a', { class: 'button', href: '#/farms/new' }, 'Create your first farm'),
        }));
        return;
      }
      setContent(body,
        h('p', {}, data.farms.length === 1 ? 'You have 1 farm.' : `You have ${data.farms.length} farms.`),
        h('ul', { class: 'card-list' }, data.farms.map((farm) => farmCard(farm, farm.id === openId))));
    } catch (error) {
      if (error.status === 401 || !body.isConnected) return;
      setContent(body, errorBlock(error, { onRetry: load }));
    }
  }
  load();

  return h('div', {},
    pageHeading('My farms'),
    takeFlash(),
    h('p', { class: 'page-intro' }, 'Choose a farm to work on, or create a new one.'),
    h('div', { class: 'button-row' }, createButton),
    h('div', { class: 'farm-list' }, body));
}
