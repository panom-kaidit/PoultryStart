// The Farm and people page.
import { h, pageHeading, setContent } from '../components/dom.js';
import { alertBox, takeFlash } from '../components/alerts.js';
import { loadingBlock, errorBlock } from '../components/loading.js';
import { card, listRow } from '../components/ui.js';
import { icon } from '../components/icons.js';
import { inputField, radioField, guardSubmit, showErrors, clearErrors } from '../components/forms.js';
import { confirmDialog } from '../components/confirm.js';
import { deleteSection } from './farm-settings.js';
import { listMembers, addMember, changeMemberRole, removeMember } from '../api/members.js';
import { getDashboard } from '../api/reports.js';
import { getAssessment } from '../api/readiness.js';
import { readinessStatusText, ownerReadiness, READINESS_NOT_STARTED, READINESS_OUTDATED } from '../farm/readiness-view.js';
import { menuFor, canDo, canOpen } from '../farm/access.js';
import { ROLE_LABELS, EXPERIENCE_LABELS, labelFor as valueLabel, formatNumber, formatArea, formatLength } from '../utils/format.js';
import { formatUtcAsUgandaDate } from '../utils/dates.js';

const ICONS = {
  dashboard: 'chart', tasks: 'check', records: 'egg', health: 'warning', expenses: 'money', advisor: 'trend',
  reports: 'chart', readiness: 'check', settings: 'house', members: 'people',
};
const TYPES = { broiler: 'Broilers', layer: 'Layers' };
const OTHER_ROLE = { manager: 'worker', worker: 'manager' };
const ASSIGNABLE = [
  { value: 'manager', label: 'Farm manager: daily work, flocks, tasks, records, the dashboard and reports. No expenses, no member changes.' },
  { value: 'worker', label: 'Farm worker: their own tasks and tasks given to nobody, and the daily records.' },
];

const pair = (label, value, extra = '') => h('div', { class: `fp-pair ${extra}`.trim() }, h('dt', {}, label), h('dd', {}, value));
function fpCard({ id, title, action, children, extra = '' }) {
  return h('section', { class: `fp-card ${extra}`.trim(), 'aria-labelledby': id },
    h('div', { class: 'fp-card__head' }, h('h2', { id }, title), action || null),
    h('div', { class: 'fp-card__body' }, children));
}

function readinessBanner(farm) {
  const box = h('div', { class: 'fp-ready-slot', 'aria-live': 'polite' });
  const owner = canOpen(farm.myRole, 'readiness');
  getDashboard(farm.id).then(async ({ data }) => {
    const r = data.readiness;
    if (!box.isConnected) return;
    if (!owner) {
      const text = readinessStatusText(r?.status);
      box.replaceChildren(h('div', { class: `fp-ready${r?.status === 'ready' ? ' fp-ready--ok' : ''}` },
        h('span', { class: 'fp-ready__icon', 'aria-hidden': 'true' }, icon(r?.status === 'ready' ? 'check' : 'warning', { size: 18 })),
        h('div', { class: 'fp-ready__text' }, h('p', { class: 'fp-ready__title' }, `Readiness check: ${text.title.toLowerCase()}`),
          h('p', {}, 'The farm owner manages the readiness check.'))));
      return;
    }
    const detail = r?.assessmentId ? (await getAssessment(farm.id, r.assessmentId)).data : null;
    if (!box.isConnected) return;
    const state = ownerReadiness(detail, farm);
    if (state.none || state.outdated) {
      const words = state.outdated ? READINESS_OUTDATED : READINESS_NOT_STARTED;
      box.replaceChildren(h('div', { class: 'fp-ready' },
        h('span', { class: 'fp-ready__icon', 'aria-hidden': 'true' }, icon('warning', { size: 18 })),
        h('div', { class: 'fp-ready__text' }, h('p', { class: 'fp-ready__title' }, words.title), h('p', {}, words.text)),
        h('a', { class: 'fp-ready__open', href: `#/farms/${farm.id}/setup/ready` }, words.action)));
      return;
    }
    const { gaps } = state;
    const ready = state.status === 'ready';
    const text = readinessStatusText(state.status, gaps.length);
    box.replaceChildren(h('div', { class: `fp-ready${ready ? ' fp-ready--ok' : ''}` },
      h('span', { class: 'fp-ready__icon', 'aria-hidden': 'true' }, icon(ready ? 'check' : 'warning', { size: 18 })),
      h('div', { class: 'fp-ready__text' },
        h('p', { class: 'fp-ready__title' }, ready ? 'Readiness check: ready'
          : gaps.length ? `Readiness check: ${gaps.length} thing${gaps.length === 1 ? '' : 's'} to fix` : `Readiness check: ${text.title.toLowerCase()}`),
        h('p', {}, ready ? text.text : gaps.length ? gaps.slice(0, 3).map((g) => g.title).join(', ') + (gaps.length > 3 ? ', …' : '') : text.text)),
      h('a', { class: 'fp-ready__open', href: `#/farms/${farm.id}/readiness/${r.assessmentId}`, 'aria-label': 'Open the readiness check' }, 'Open')));
  }).catch((error) => {
    if (error.status === 401 || !box.isConnected) return;
    box.replaceChildren(h('p', { class: 'fp-muted' }, 'The readiness check could not be loaded. ',
      owner ? h('a', { href: `#/farms/${farm.id}/readiness` }, 'Open the readiness check') : null));
  });
  return box;
}

function farmCard(farm) {
  const owner = farm.myRole === 'owner';
  return fpCard({ id: 'fp-farm', title: 'Farm details',
    action: canDo(farm.myRole, 'farm:update') ? h('a', { class: 'fp-btn fp-btn--plain', href: `#/farms/${farm.id}/settings/edit`, 'aria-label': 'Edit the farm details' }, 'Edit') : null,
    children: h('dl', { class: 'fp-pairs' },
      pair('Farm name', h('span', { class: 'user-text' }, farm.name)),
      pair('Location', h('span', { class: 'user-text' }, farm.location || 'Not given')),
      pair('Poultry type', TYPES[farm.poultryType] || farm.poultryType),
      pair('Planned birds', formatNumber(farm.numberOfBirds)),
      owner ? pair('Currency', farm.currency || 'Not given') : null,
      pair('Experience', valueLabel(EXPERIENCE_LABELS, farm.experienceLevel))) });
}

function spaceCheck(capacity, planned) {
  if (!capacity) return 'Not worked out';
  switch (capacity.status) {
    case 'within_capacity': return h('span', { class: 'fp-ok' }, icon('check', { size: 16 }), ` Enough for ${formatNumber(planned)}`);
    case 'above_capacity': return h('span', { class: 'fp-warn' }, icon('warning', { size: 16 }), ` Too small for ${formatNumber(planned)}`);
    case 'house_not_built': return 'No house yet';
    default: return 'Measurements needed';
  }
}

function houseCard(farm, capacity) {
  const hasSize = farm.houseLengthM != null && farm.houseWidthM != null;
  return fpCard({ id: 'fp-house', title: 'Poultry house',
    action: canDo(farm.myRole, 'farm:update') ? h('a', { class: 'fp-btn fp-btn--plain', href: `#/farms/${farm.id}/settings/edit`, 'aria-label': 'Edit the poultry house' }, 'Edit') : null,
    children: [h('dl', { class: 'fp-pairs' },
      pair('Inside size', hasSize ? `${formatLength(farm.houseLengthM)} × ${formatLength(farm.houseWidthM)}` : 'Not given'),
      pair('Space birds cannot use', farm.nonUsableAreaM2 != null ? formatArea(farm.nonUsableAreaM2) : 'Not given'),
      pair('Usable for birds', capacity?.space?.usableAreaM2 != null ? formatArea(capacity.space.usableAreaM2) : 'Not worked out'),
      pair('Space check', spaceCheck(capacity, farm.numberOfBirds)),
      capacity?.recommendedCapacity != null ? pair('Recommended at most', `${formatNumber(capacity.recommendedCapacity)} birds`) : null),
    capacity?.message ? h('p', { class: 'fp-muted' }, capacity.message) : null,
    h('p', { class: 'fp-muted' }, h('a', { href: `#/farms/${farm.id}/settings` }, 'The full space check'))] });
}

function peopleCard(farm, user) {
  const manages = canDo(farm.myRole, 'members:manage');
  const messages = h('div', { 'aria-live': 'polite' });
  const list = h('div', {}, loadingBlock('Loading the people…'));
  const announce = (kind, text) => { const box = alertBox(kind, text); messages.replaceChildren(box); box.focus(); };

  async function load() {
    setContent(list, loadingBlock('Loading the people…'));
    try {
      const { data } = await listMembers(farm.id);
      if (!list.isConnected) return;
      setContent(list, h('div', { class: 'fp-table-wrap' }, h('table', { class: 'fp-table' },
        h('caption', { class: 'visually-hidden' }, `People on this farm: ${data.members.length}`),
        h('thead', {}, h('tr', {}, ['Name', 'Email', 'Role', 'Member since'].map((t) => h('th', { scope: 'col' }, t)),
          manages ? h('th', { scope: 'col' }, h('span', { class: 'visually-hidden' }, 'Actions')) : null)),
        h('tbody', {}, data.members.map((m) => row(m))))));
    } catch (error) {
      if (error.status === 401 || !list.isConnected) return;
      setContent(list, errorBlock(error, { onRetry: load }));
    }
  }

  function row(member) {
    const isOwner = member.role === 'owner';
    const actions = manages && !isOwner ? memberActions(member) : null;
    return h('tr', { dataset: { memberId: String(member.id) } },
      h('th', { scope: 'row', 'data-label': 'Name' }, h('span', { class: 'user-text' }, member.name), member.userId === user.id ? ' (you)' : ''),
      h('td', { 'data-label': 'Email', class: 'fp-email' }, member.email),
      h('td', { 'data-label': 'Role' }, h('span', { class: `fp-role fp-role--${member.role}` }, ROLE_LABELS[member.role] || member.role)),
      h('td', { 'data-label': 'Member since' }, member.joinedAt ? formatUtcAsUgandaDate(member.joinedAt) : 'Not given'),
      manages ? h('td', { class: 'fp-actions' }, actions || h('span', { class: 'fp-muted' }, 'Cannot be changed')) : null);
  }

  function memberActions(member) {
    const next = OTHER_ROLE[member.role];
    const change = h('button', { type: 'button', class: 'fp-link', 'aria-label': `Change the role of ${member.name}` }, 'Change role');
    const remove = h('button', { type: 'button', class: 'fp-link fp-link--danger', 'aria-label': `Remove ${member.name} from this farm` }, 'Remove');
    const busy = (b) => { change.disabled = b; remove.disabled = b; };
    change.addEventListener('click', async () => {
      if (!next) return;
      const ok = await confirmDialog({
        title: `Change ${member.name}'s role?`,
        message: `${member.name} will become a ${ROLE_LABELS[next].toLowerCase()} on this farm instead of a ${ROLE_LABELS[member.role].toLowerCase()}. They will see what that role allows the next time they open the farm.`,
        confirmLabel: `Make ${next}`,
      });
      if (!ok) return;
      busy(true);
      try {
        const { message } = await changeMemberRole(farm.id, member.id, next);
        await load();
        announce('success', message || 'The role was changed.');
      } catch (error) {
        busy(false);
        if (error.status !== 401) announce('error', `The role was not changed. ${error.message}`);
      }
    });
    remove.addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: `Remove ${member.name} from this farm?`,
        message: `${member.name} will no longer be able to open this farm or its records. Their PoultryStart account is not deleted, and what they recorded stays on the farm. Tasks given to them that are still open will be given to nobody.`,
        confirmLabel: 'Remove from farm',
        danger: true,
      });
      if (!ok) return;
      busy(true);
      try {
        const { message } = await removeMember(farm.id, member.id);
        await load();
        announce('success', message || 'The member was removed.');
      } catch (error) {
        busy(false);
        if (error.status !== 401) announce('error', `${member.name} was not removed. ${error.message}`);
      }
    });
    return h('span', { class: 'fp-action-row' }, change, h('span', { 'aria-hidden': 'true' }, ' · '), remove);
  }

  function addForm() {
    const summary = h('div', { 'aria-live': 'polite' });
    const form = h('form', { class: 'form fp-add', hidden: true, 'aria-labelledby': 'fp-add-title' },
      h('h3', { id: 'fp-add-title' }, 'Add a person'),
      h('p', { class: 'fp-muted' }, 'The person must already have a PoultryStart account. There are no invitations: ask them to create an account first.'),
      summary,
      inputField({ name: 'email', id: 'fp-add-email', label: 'Their email address', type: 'email', required: true, attrs: { autocomplete: 'off', maxlength: '254' } }),
      radioField({ name: 'role', label: 'Their role on this farm', required: true, options: ASSIGNABLE }),
      h('div', { class: 'fp-add__actions' },
        h('button', { type: 'button', class: 'fp-btn fp-btn--plain', onclick: () => { form.hidden = true; toggle.setAttribute('aria-expanded', 'false'); toggle.focus(); } }, 'Cancel'),
        h('button', { type: 'submit', class: 'fp-btn' }, 'Add to farm')));
    guardSubmit(form, async () => {
      clearErrors(form, summary);
      const email = form.elements.email.value.trim();
      const role = form.querySelector('input[name="role"]:checked')?.value;
      try {
        const { message } = await addMember(farm.id, { email, role });
        form.reset();
        form.hidden = true;
        toggle.setAttribute('aria-expanded', 'false');
        await load();
        announce('success', message || 'The person was added.');
      } catch (error) {
        if (error.status === 401) return;
        const details = error.details?.length ? error.details
          : (error.status === 404 || error.status === 409 ? [{ field: 'email', message: error.message }] : []);
        showErrors(form, { message: error.message, details }, summary, { email: 'Their email address', role: 'Their role on this farm' });
      }
    }, { busyText: 'Adding…' });
    const toggle = h('button', { type: 'button', class: 'fp-btn', 'aria-expanded': 'false', 'aria-controls': 'fp-add-form' }, icon('plus', { size: 18 }), 'Add a person');
    form.id = 'fp-add-form';
    toggle.addEventListener('click', () => {
      form.hidden = !form.hidden;
      toggle.setAttribute('aria-expanded', String(!form.hidden));
      if (!form.hidden) form.elements.email.focus();
    });
    return { toggle, form };
  }

  const add = manages ? addForm() : null;
  load();
  return fpCard({ id: 'fp-people', title: 'People on this farm', extra: 'fp-card--wide fp-card--flush', action: add?.toggle,
    children: [messages, manages ? null : h('p', { class: 'fp-muted fp-pad' }, 'Only the farm owner can add, change or remove people.'), add?.form, list] });
}

export function morePage({ user, farmContext, onLogout }) {
  const { farm, capacity } = farmContext;
  const role = farm.myRole;
  const rows = menuFor(role).map((item) => listRow({
    label: item.label, href: `#/farms/${farm.id}/${item.feature === 'expenses' ? 'money' : item.feature}`, iconName: ICONS[item.feature] || 'chevronRight',
  }));
  const showReadiness = canOpen(role, 'readiness') || canOpen(role, 'dashboard');

  return h('div', { class: 'fp ui-screen more-screen' },
    pageHeading('Farm and people'),
    takeFlash(),
    showReadiness ? readinessBanner(farm) : null,
    h('div', { class: 'fp-grid' },
      farmCard(farm),
      houseCard(farm, capacity),
      canOpen(role, 'members') ? peopleCard(farm, user) : null,
      fpCard({ id: 'fp-contacts', title: 'Vet and supplier contacts', extra: 'fp-card--wide', action: h('span', { class: 'fp-soon' }, 'Coming soon'),
        children: h('p', { class: 'fp-muted' }, 'Saving your vet, extension officer and chick supplier here is planned. It is not part of PoultryStart yet, so nothing can be saved.') })),
    h('section', { class: 'fp-section', 'aria-labelledby': 'fp-screens' },
      h('h2', { id: 'fp-screens' }, 'Other farm screens'),
      card({ flush: true, children: rows })),
    fpCard({ id: 'fp-account', title: 'Your account', extra: 'fp-card--account', action: h('a', { href: '#/farms' }, 'Switch farm'),
        children: [
          h('dl', { class: 'fp-pairs' }, pair('Name', h('span', { class: 'user-text' }, user.name)), pair('Email', h('span', { class: 'user-text fp-email' }, user.email || 'Not given'))),
          h('p', { class: 'profile-card__meta' }, `${ROLE_LABELS[role] || role} · ${farm.name}${farm.location ? `, ${farm.location}` : ''}`),
          h('div', { class: 'fp-rows' },
            listRow({ label: 'Account and password', href: '#/account' }),
            listRow({ label: 'Log out', onClick: onLogout, chevron: false, tone: 'danger' }))] }),
    canDo(role, 'farm:delete') ? deleteSection(farm) : null);
}
