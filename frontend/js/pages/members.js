// The farm Members page.
import { h, pageHeading, setContent } from '../components/dom.js';
import { alertBox, takeFlash } from '../components/alerts.js';
import { loadingBlock, errorBlock } from '../components/loading.js';
import { inputField, radioField, guardSubmit, showErrors, clearErrors } from '../components/forms.js';
import { confirmDialog } from '../components/confirm.js';
import { listMembers, addMember, changeMemberRole, removeMember } from '../api/members.js';
import { canDo } from '../farm/access.js';
import { ROLE_LABELS } from '../utils/format.js';
import { formatUtcAsUgandaDate } from '../utils/dates.js';

const ASSIGNABLE = [
  { value: 'manager', label: 'Farm manager: looks after the daily work, flocks, tasks and records, and sees the dashboard and reports. Cannot see expenses or change members.' },
  { value: 'worker', label: 'Farm worker: sees their own tasks and tasks given to nobody, and records the daily work.' },
];
const SHORT_ROLE = { manager: 'manager', worker: 'worker' };

export function membersPage({ user, farmContext }) {
  const { farm } = farmContext;
  const manages = canDo(farm.myRole, 'members:manage');
  const messages = h('div', { 'aria-live': 'polite' });
  const listArea = h('div', {}, loadingBlock('Loading the members…'));

  function announce(kind, text) {
    const box = alertBox(kind, text);
    messages.replaceChildren(box);
    box.focus();
  }

  async function load() {
    setContent(listArea, loadingBlock('Loading the members…'));
    try {
      const { data } = await listMembers(farm.id);
      if (!listArea.isConnected) return;
      setContent(listArea,
        h('p', {}, data.members.length === 1 ? 'This farm has 1 member.' : `This farm has ${data.members.length} members.`),
        h('ul', { class: 'item-list' }, data.members.map((member) => memberItem(member))));
    } catch (error) {
      if (error.status === 401 || !listArea.isConnected) return;
      setContent(listArea, errorBlock(error, { onRetry: load }));
    }
  }

  function memberItem(member) {
    const isOwner = member.role === 'owner';
    const isMe = member.userId === user.id;
    const item = h('li', { class: 'item', dataset: { memberId: String(member.id) } },
      h('p', { class: 'item__title' }, member.name, isMe ? ' (you)' : ''),
      h('p', { class: 'farm-card__meta' }, member.email),
      h('div', { class: 'tag-row' },
        h('span', { class: 'badge' }, ROLE_LABELS[member.role] || member.role),
        member.joinedAt ? h('span', { class: 'tag' }, `Member since ${formatUtcAsUgandaDate(member.joinedAt)}`) : null));
    if (!manages) return item;
    if (isOwner) {
      item.append(h('p', { class: 'small-print' }, 'The farm owner\'s role cannot be changed, and the owner cannot be removed.'));
      return item;
    }
    item.append(memberActions(member));
    return item;
  }

  function memberActions(member) {
    const selectId = `role-${member.id}`;
    const select = h('select', { class: 'select', id: selectId },
      Object.keys(SHORT_ROLE).map((role) => h('option', { value: role, selected: role === member.role }, ROLE_LABELS[role])));
    const changeButton = h('button', { type: 'button', class: 'button button--secondary button--small' }, 'Change role');
    const removeButton = h('button', { type: 'button', class: 'button button--danger-outline button--small' }, 'Remove from farm');
    const setBusy = (busy) => { changeButton.disabled = busy; removeButton.disabled = busy; select.disabled = busy; };

    changeButton.addEventListener('click', async () => {
      const role = select.value;
      if (role === member.role) {
        announce('info', `${member.name} is already a ${ROLE_LABELS[role].toLowerCase()}. Choose another role first.`);
        return;
      }
      const confirmed = await confirmDialog({
        title: `Change ${member.name}'s role?`,
        message: `${member.name} will become a ${ROLE_LABELS[role].toLowerCase()} on this farm instead of a ${ROLE_LABELS[member.role].toLowerCase()}. They will see what that role allows the next time they open the farm.`,
        confirmLabel: `Make ${SHORT_ROLE[role]}`,
      });
      if (!confirmed) {
        select.value = member.role;
        return;
      }
      setBusy(true);
      try {
        const { message } = await changeMemberRole(farm.id, member.id, role);
        await load();
        announce('success', message || 'The role was changed.');
      } catch (error) {
        setBusy(false);
        select.value = member.role;
        if (error.status !== 401) announce('error', `The role was not changed. ${error.message}`);
      }
    });

    removeButton.addEventListener('click', async () => {
      const confirmed = await confirmDialog({
        title: `Remove ${member.name} from this farm?`,
        message: `${member.name} will no longer be able to open this farm or its records. Their PoultryStart account is not deleted, and what they recorded stays on the farm. Tasks given to them that are still open will be given to nobody.`,
        confirmLabel: 'Remove from farm',
        danger: true,
      });
      if (!confirmed) return;
      setBusy(true);
      try {
        const { message } = await removeMember(farm.id, member.id);
        await load();
        announce('success', message || 'The member was removed.');
      } catch (error) {
        setBusy(false);
        if (error.status !== 401) announce('error', `${member.name} was not removed. ${error.message}`);
      }
    });

    return h('div', { class: 'field' },
      h('label', { class: 'field__label', for: selectId }, `Role of ${member.name}`),
      select,
      h('div', { class: 'button-row' }, changeButton, removeButton));
  }

  function addForm() {
    const summary = h('div', { 'aria-live': 'polite' });
    const form = h('form', { class: 'form' },
      inputField({
        name: 'email', label: 'Their email address', type: 'email', required: true,
        hint: 'The person must already have a PoultryStart account. Ask them to create one first if they have not.',
        attrs: { autocomplete: 'off', maxlength: '254' },
      }),
      radioField({ name: 'role', label: 'Their role on this farm', required: true, options: ASSIGNABLE }),
      h('div', { class: 'button-row' }, h('button', { type: 'submit', class: 'button' }, 'Add member')));

    guardSubmit(form, async () => {
      clearErrors(form, summary);
      const email = form.elements.email.value.trim();
      const role = form.querySelector('input[name="role"]:checked')?.value;
      try {
        const { message } = await addMember(farm.id, { email, role });
        form.reset();
        await load();
        announce('success', message || 'The member was added.');
      } catch (error) {
        if (error.status === 401) return;
        const details = error.details?.length ? error.details
          : (error.status === 404 || error.status === 409 ? [{ field: 'email', message: error.message }] : []);
        showErrors(form, { message: error.message, details }, summary, { email: 'Their email address', role: 'Their role on this farm' });
      }
    }, { busyText: 'Adding…' });

    return h('section', { class: 'card', 'aria-labelledby': 'add-member' },
      h('h2', { id: 'add-member' }, 'Add a member'),
      h('p', {}, 'You do not need anyone else to use PoultryStart. Add people only if they help on this farm.'),
      summary,
      form);
  }

  load();

  return h('div', {},
    pageHeading('Members'),
    takeFlash(),
    manages ? null : alertBox('info', 'Only the farm owner can add, change or remove members.'),
    messages,
    h('section', { class: 'card', 'aria-labelledby': 'member-list' },
      h('h2', { id: 'member-list' }, 'People on this farm'),
      listArea),
    manages ? addForm() : null);
}
