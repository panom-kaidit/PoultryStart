// Messages shown to the user
import { h } from './dom.js';

const KINDS = {
  success: { icon: '✓', label: 'Success' },
  error: { icon: '✕', label: 'Error' },
  warning: { icon: '!', label: 'Warning' },
  info: { icon: 'i', label: 'Note' },
};


export function alertBox(kind, message, { title, items = [] } = {}) {
  const { icon, label } = KINDS[kind] || KINDS.info;
  return h('div', { class: `alert alert--${kind}`, role: kind === 'error' ? 'alert' : 'status', tabindex: '-1' },
    h('span', { class: 'alert__icon', 'aria-hidden': 'true' }, icon),
    h('div', { class: 'alert__body' },
      h('p', {}, h('strong', {}, `${title || label}:`), ' ', message),
      items.length > 0 ? h('ul', {}, items.map((item) => h('li', {}, item))) : null));
}

export function statusLabel(kind, text) {
  const { icon } = KINDS[kind] || KINDS.info;
  return h('span', { class: `status status--${kind}` },
    h('span', { class: 'status__icon', 'aria-hidden': 'true' }, icon),
    h('span', {}, text));
}

let flash = null;

export function setFlash(kind, message) {
  flash = { kind, message };
}

export function takeFlash() {
  const message = flash;
  flash = null;
  return message ? alertBox(message.kind, message.message) : null;
}
