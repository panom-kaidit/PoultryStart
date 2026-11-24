// The app frame: on phones a top bar and the bottom nav; from 900px a sidebar with the farm selector, "Record
// today", the role's destinations and the user. Hiding an item is NOT security: the backend refuses anything a
// role may not do.
import { h } from './dom.js';
import { icon } from './icons.js';
import { navFor, navKeyFor, sidebarFor, sidebarKeyFor, canDo } from '../farm/access.js';
import { listFarms } from '../api/farms.js';
import { ROLE_LABELS } from '../utils/format.js';

export const NAV_ID = 'site-nav';
export const SIDE_NAV_ID = 'side-nav';
const TYPE_NAMES = { broiler: 'Broilers', layer: 'Layers' };

// "Sarah Nakato" -> "SN"; one name -> its first letter.
export function initialsOf(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts.length === 1 ? parts[0][0] : parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Destinations when no farm is open (farm list, account, Learn without a farm).
const NO_FARM_NAV = [
  { key: 'farms', label: 'My farms', icon: 'home', href: '#/farms' },
  { key: 'learn', label: 'Learn', icon: 'book', href: '#/learn' },
  { key: 'more', label: 'Account', icon: 'more', href: '#/account' },
];

function navItem(item, current) {
  if (item.raised) {
    return h('a', { class: 'nav-rec', href: item.href, 'aria-label': item.label, 'aria-current': current ? 'page' : undefined },
      icon('plus', { size: 28 }));
  }
  return h('a', { class: 'nav-item', href: item.href, 'aria-current': current ? 'page' : undefined },
    icon(item.icon, { size: 24 }), h('span', {}, item.label));
}

function bottomNav({ farm, active }) {
  const current = navKeyFor(active) || active;
  const items = farm ? navFor(farm.myRole, farm.id) : NO_FARM_NAV;
  return h('nav', { id: NAV_ID, class: 'site-nav', 'aria-label': 'Main' },
    h('div', { class: 'nav-items' }, items.map((item) => navItem(item, item.key === current))));
}

// The top bar: farm switcher on the left, the avatar (to More) on the right.
function topBar({ farm, user }) {
  const switcher = farm
    ? h('a', { class: 'farm-switcher', href: '#/farms', 'aria-label': `Open farm: ${farm.name}. Switch farm` },
      h('span', { class: 'farm-switcher__mark' }, icon('eggFilled', { size: 16, color: 'var(--green-700)' })),
      h('span', { class: 'farm-switcher__name' }, farm.name),
      icon('chevronDown', { size: 16 }))
    : h('a', { class: 'farm-switcher', href: '#/farms' },
      h('span', { class: 'farm-switcher__mark' }, icon('eggFilled', { size: 16, color: 'var(--green-700)' })),
      h('span', { class: 'farm-switcher__name' }, 'PoultryStart'));
  const avatarHref = farm ? `#/farms/${farm.id}/more` : '#/account';
  return h('header', { class: 'top-bar' }, switcher,
    user ? h('a', { class: 'avatar', href: avatarHref, 'aria-label': 'Your account' }, initialsOf(user.name)) : null);
}

// The farm selector: on request it lists the user's other farms (GET /farms, which never generates tasks).
function farmSelector(farm) {
  const panelId = 'farm-selector-panel';
  const list = h('div', { class: 'farm-select__panel', id: panelId, hidden: true });
  const toggle = h('button', { type: 'button', class: 'farm-select', 'aria-expanded': 'false', 'aria-controls': panelId },
    h('span', { class: 'farm-select__text' },
      h('span', { class: 'farm-select__name' }, farm.name),
      h('span', { class: 'farm-select__meta' }, [TYPE_NAMES[farm.poultryType], farm.location].filter(Boolean).join(' · '))),
    h('span', { class: 'visually-hidden' }, ' (switch farm)'),
    icon('chevronUpDown', { size: 18 }));
  let loaded = false;
  const close = () => { list.hidden = true; toggle.setAttribute('aria-expanded', 'false'); };
  async function fill() {
    list.replaceChildren(h('p', { class: 'farm-select__note' }, 'Loading your farms…'));
    try {
      const { data } = await listFarms();
      loaded = true;
      list.replaceChildren(
        h('ul', {}, data.farms.map((f) => h('li', {}, h('a', {
          href: `#/farms/${f.id}/today`, 'aria-current': f.id === farm.id ? 'true' : undefined,
        }, h('span', { class: 'farm-select__name' }, f.name), h('span', { class: 'farm-select__meta' },
          [TYPE_NAMES[f.poultryType], ROLE_LABELS[f.myRole]].filter(Boolean).join(' · ')))))),
        h('div', { class: 'farm-select__more' }, h('a', { href: '#/farms' }, 'All my farms'), h('a', { href: '#/farms/new' }, '+ New farm')));
    } catch (error) {
      if (error.status === 401) return;
      list.replaceChildren(h('p', { class: 'farm-select__note' }, 'Your farms could not be loaded. ', h('a', { href: '#/farms' }, 'Open the farm list')));
    }
  }
  toggle.addEventListener('click', () => {
    const open = list.hidden;
    list.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    if (open && !loaded) fill();
  });
  const wrap = h('div', { class: 'farm-select__wrap' }, toggle, list);
  wrap.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !list.hidden) { close(); toggle.focus(); } });
  wrap.addEventListener('focusout', (event) => { if (event.relatedTarget && !wrap.contains(event.relatedTarget)) close(); });
  return wrap;
}

function sidebar({ farm, user, active, onLogout }) {
  const current = farm ? sidebarKeyFor(active) || active : active;
  const items = farm ? sidebarFor(farm.myRole, farm.id) : [
    { key: 'farms', label: 'My farms', icon: 'home', href: '#/farms' },
    { key: 'learn', label: 'Learn', icon: 'book', href: '#/learn' },
    { key: 'account', label: 'Account', icon: 'people', href: '#/account' },
  ];
  const record = farm && canDo(farm.myRole, 'production:create');
  return h('aside', { class: 'sidebar' },
    h('a', { class: 'sidebar__brand', href: farm ? `#/farms/${farm.id}/today` : '#/farms' },
      h('span', { class: 'sidebar__mark' }, icon('eggFilled', { size: 18, color: 'currentColor' })), 'PoultryStart'),
    farm ? farmSelector(farm) : null,
    record ? h('a', { class: 'sidebar__record', href: `#/farms/${farm.id}/record`, 'aria-current': current === 'record' ? 'page' : undefined },
      icon('plus', { size: 20 }), 'Record today') : null,
    h('nav', { id: SIDE_NAV_ID, class: 'sidebar__nav', 'aria-label': 'Main' },
      h('ul', {}, items.map((item) => h('li', {}, h('a', {
        class: 'sidebar__item', href: item.href, 'aria-current': item.key === current ? 'page' : undefined,
      }, icon(item.icon, { size: 22 }), h('span', {}, item.label)))))),
    user ? h('div', { class: 'sidebar__user' },
      h('span', { class: 'sidebar__avatar', 'aria-hidden': 'true' }, initialsOf(user.name)),
      h('span', { class: 'sidebar__who' }, h('span', { class: 'sidebar__name' }, user.name),
        farm ? h('span', { class: 'sidebar__role' }, ROLE_LABELS[farm.myRole] || farm.myRole) : null),
      onLogout ? h('button', { type: 'button', class: 'sidebar__logout', onclick: onLogout }, 'Log out') : null) : null);
}

function skipLink(main) {
  const skip = h('a', { class: 'skip-link', href: '#main' }, 'Skip to main content');
  // A hash link would change the page address, so the skip link moves the focus itself.
  skip.addEventListener('click', (event) => {
    event.preventDefault();
    main.focus();
  });
  return skip;
}

// options:
//   farm     the open farm ({ id, name, myRole }) or null
//   user     the logged-in user ({ name }) or null while loading
//   active   the current screen key (a feature, 'learn', 'farms', 'account', ...)
//   topBar   false hides the top bar (screens with their own back link)
//   bare     true: no top bar and no nav (setup, Record, Report a problem, Add expense, Article)
//   wide     true: content up to 1040px from 900px (Today, Flock, Money, Reports)
export function appShell({ farm, user = null, active, bare = false, topBar: showTop = true, wide = false, onLogout = null }) {
  const main = h('main', { id: 'main', class: `content${wide ? ' content--wide' : ''}${bare ? ' content--bare' : ''}`, tabindex: '-1' });
  const root = h('div', { class: `app-root${bare ? ' app-root--bare' : ''}` },
    skipLink(main),
    bare ? null : sidebar({ farm, user, active, onLogout }),
    bare ? null : bottomNav({ farm, active }),
    h('div', { class: 'app-body' }, bare || !showTop ? null : topBar({ farm, user }), main));
  return { root, main };
}

// The frame for pages without login. full: the page draws its own full-width layout.
export function publicShell({ full = false } = {}) {
  const main = h('main', { id: 'main', class: full ? 'content-full' : 'content content--bare content--public', tabindex: '-1' });
  return { root: h('div', { class: 'app-root app-root--bare' }, skipLink(main), h('div', { class: 'app-body' }, main)), main };
}
