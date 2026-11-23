// Shared pieces of the Log in and Create account pages 
import { h } from './dom.js';
import { icon } from './icons.js';

export function brandPanel({ headline, middle }) {
  return h('section', { class: 'login-brand', 'aria-label': 'About PoultryStart' },
    h('div', { class: 'login-brand__logo' },
      h('span', { class: 'login-brand__mark' }, icon('eggFilled', { size: 24, color: 'currentColor' })),
      h('span', { class: 'login-brand__name' }, 'PoultryStart')),
    h('div', { class: 'login-brand__middle' },
      h('p', { class: 'login-brand__headline' }, headline),
      middle),
    h('p', { class: 'login-brand__footer' }, 'Made for beginner and small-scale farmers in Uganda.'));
}

export function authField({ name, label, input, extra = null, hint = null }) {
  return h('div', { class: 'field login-field', dataset: { field: name } },
    h('label', { class: 'login-label', for: input.id }, label),
    h('div', { class: 'login-input-wrap' }, input, extra),
    hint ? h('p', { class: 'login-hint', id: `${input.id}-hint` }, hint) : null,
    h('p', { class: 'field__error', id: `${input.id}-error`, hidden: true }));
}

export function passwordToggle(input) {
  const word = h('span', {}, 'Show');
  const toggle = h('button', { type: 'button', class: 'login-toggle', 'aria-controls': input.id, 'aria-pressed': 'false' },
    word, h('span', { class: 'visually-hidden' }, ' password'));
  toggle.addEventListener('click', () => {
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    word.textContent = show ? 'Hide' : 'Show';
    toggle.setAttribute('aria-pressed', String(show));
  });
  return toggle;
}
