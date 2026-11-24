import { h } from './dom.js';
import { alertBox } from './alerts.js';

export function loadingBlock(text = 'Loading…') {
  return h('div', { class: 'loading', role: 'status', 'aria-live': 'polite' },
    h('span', { class: 'spinner', 'aria-hidden': 'true' }),
    h('span', {}, text));
}

// onRetry adds "Try again" (for reading information only; saving is never retried).
export function errorBlock(error, { onRetry, actions = [] } = {}) {
  const items = (error?.details || []).map((d) => d.message).filter(Boolean);
  return h('div', {},
    alertBox('error', error?.message || 'Something went wrong. Please try again.', { items }),
    h('div', { class: 'button-row' },
      onRetry ? h('button', { type: 'button', class: 'button button--secondary', onclick: onRetry }, 'Try again') : null,
      actions));
}

export function emptyState({ title, text, action }) {
  return h('div', { class: 'card empty-state' },
    h('h2', {}, title),
    text ? h('p', {}, text) : null,
    action || null);
}
