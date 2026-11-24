// The account page: shows the logged-in user and logs out.
import { h, pageHeading } from '../components/dom.js';
import { alertBox } from '../components/alerts.js';
import { formatUtcAsUgandaDate } from '../utils/dates.js';

export function accountPage({ user, onLogout }) {
  return h('div', {},
    pageHeading('Your account'),
    h('section', { class: 'card', 'aria-labelledby': 'account-details' },
      h('h2', { id: 'account-details' }, 'Account details'),
      h('dl', { class: 'details' },
        h('dt', {}, 'Name'), h('dd', {}, user.name),
        h('dt', {}, 'Email address'), h('dd', {}, user.email),
        user.createdAt ? [h('dt', {}, 'Account created'), h('dd', {}, formatUtcAsUgandaDate(user.createdAt))] : null)),
    alertBox('info', 'Changing your password or your details is not available yet.'),
    h('section', { class: 'card', 'aria-labelledby': 'account-logout' },
      h('h2', { id: 'account-logout' }, 'Log out'),
      h('p', {}, 'Logging out removes your login from this browser tab. On a shared phone or computer, always log out when you finish.'),
      h('button', { type: 'button', class: 'button', onclick: onLogout }, 'Log out')));
}
