// Fallback page for an unknown farm screen.
import { h, pageHeading } from '../components/dom.js';
import { alertBox } from '../components/alerts.js';
import { FEATURES } from '../farm/access.js';

export function comingSoonPage({ feature, farmContext }) {
  const definition = FEATURES[feature];
  const farmId = farmContext.farm.id;
  return h('div', {},
    pageHeading(definition.label),
    alertBox('info', `Coming in a later development phase (phase ${definition.phase}). This screen is not available yet.`,
      { title: 'Not available yet' }),
    h('p', {}, `When it is ready: ${definition.description}`),
    h('div', { class: 'button-row' },
      h('a', { class: 'button button--secondary', href: `#/farms/${farmId}/home` }, 'Go to farm home'),
      h('a', { class: 'button button--secondary', href: '#/farms' }, 'My farms')));
}
