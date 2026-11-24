// Error pages: not found, farm not available, role not allowed, general error.
import { h, pageHeading } from '../components/dom.js';
import { alertBox } from '../components/alerts.js';

const backToFarms = () => h('div', { class: 'button-row' }, h('a', { class: 'button', href: '#/farms' }, 'Go to my farms'));

export function notFoundPage() {
  return h('div', {},
    pageHeading('Page not found'),
    alertBox('error', 'There is no page at this address.'),
    backToFarms());
}

export function farmErrorPage({ error, onRetry }) {
  let title = 'This farm could not be opened';
  let message = error?.message || 'Something went wrong. Please try again.';
  if (error?.status === 404) message = 'This farm was not found, or you do not have access to it.';
  if (error?.status === 403) message = 'Your role does not allow you to open this.';
  if (error?.status === 400) {
    title = 'Page not found';
    message = 'There is no farm at this address.';
  }
  const retry = error?.status === 0 || error?.status >= 500;
  return h('div', {},
    pageHeading(title),
    alertBox('error', message),
    h('div', { class: 'button-row' },
      retry && onRetry ? h('button', { type: 'button', class: 'button button--secondary', onclick: onRetry }, 'Try again') : null,
      h('a', { class: 'button', href: '#/farms' }, 'Go to my farms')));
}

export function notAvailableForRolePage({ farmContext }) {
  return h('div', {},
    pageHeading('Not available for your role'),
    alertBox('warning', 'This part of PoultryStart is not available for your role on this farm.'),
    h('div', { class: 'button-row' }, h('a', { class: 'button', href: `#/farms/${farmContext.farm.id}` }, 'Go to this farm\'s main page')));
}

export function generalErrorPage({ error, onRetry }) {
  return h('div', {},
    pageHeading('Something went wrong'),
    alertBox('error', error?.message || 'Something went wrong. Please try again.'),
    h('div', { class: 'button-row' },
      onRetry ? h('button', { type: 'button', class: 'button button--secondary', onclick: onRetry }, 'Try again') : null,
      h('a', { class: 'button', href: '#/farms' }, 'Go to my farms')));
}
