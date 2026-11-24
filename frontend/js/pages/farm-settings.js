// The Farm settings / Farm profile page, including deleting a farm.
import { h, pageHeading } from '../components/dom.js';
import { alertBox, setFlash, takeFlash } from '../components/alerts.js';
import { capacityPanel } from '../components/capacity.js';
import { confirmDialog } from '../components/confirm.js';
import { deleteFarm } from '../api/farms.js';
import { clearFarm } from '../farm/farm.js';
import { canDo, labelFor } from '../farm/access.js';
import { navigate } from '../router.js';
import {
  POULTRY_TYPE_LABELS, EXPERIENCE_LABELS, MANAGEMENT_MODE_LABELS, STARTING_STAGE_LABELS, HOUSE_STATUS_LABELS,
  labelFor as valueLabel, formatNumber, formatArea, formatLength,
} from '../utils/format.js';

const row = (label, value) => [h('dt', {}, label), h('dd', {}, value)];

function profileDetails(farm, isOwner) {
  return h('dl', { class: 'details' },
    row('Farm name', farm.name),
    row('Location', farm.location),
    row('Poultry type', valueLabel(POULTRY_TYPE_LABELS, farm.poultryType)),
    row('Birds you plan to keep', formatNumber(farm.numberOfBirds)),
    row('Experience with poultry', valueLabel(EXPERIENCE_LABELS, farm.experienceLevel)),
    row('Farm size', farm.farmSize || 'Not given'),
    row('Who manages the farm', valueLabel(MANAGEMENT_MODE_LABELS, farm.managementMode)),
    isOwner ? row('Currency', farm.currency || 'Not given') : null,
    row('Age of the birds when they arrive', valueLabel(STARTING_STAGE_LABELS, farm.startingStage)),
    farm.startingAgeWeeks != null ? row('Age on arrival', `${formatNumber(farm.startingAgeWeeks)} weeks`) : null,
    row('Poultry house', valueLabel(HOUSE_STATUS_LABELS, farm.houseStatus)),
    row('House length', formatLength(farm.houseLengthM)),
    row('House width', formatLength(farm.houseWidthM)),
    row('Area not used by the birds', farm.nonUsableAreaM2 != null ? formatArea(farm.nonUsableAreaM2) : 'Not given'));
}

export function deleteSection(farm) {
  const result = h('div', { 'aria-live': 'polite' });
  const button = h('button', { type: 'button', class: 'button button--danger-outline' }, 'Delete this farm');
  button.addEventListener('click', async () => {
    result.replaceChildren();
    const confirmed = await confirmDialog({
      title: `Delete "${farm.name}"?`,
      message: 'This permanently deletes the farm and everything recorded for it. It cannot be undone. This includes:',
      items: [
        'its flocks and their bird movements',
        'its tasks, production records and health observations',
        'its expenses and readiness assessments',
        'the member list: nobody will be able to open this farm any more',
      ],
      confirmLabel: 'Delete the farm permanently',
      danger: true,
      typeToConfirm: farm.name,
    });
    if (!confirmed) return;
    button.disabled = true;
    button.textContent = 'Deleting the farm…';
    try {
      const { message } = await deleteFarm(farm.id);
      clearFarm();
      setFlash('success', message || 'The farm was deleted.');
      navigate('/farms');
    } catch (error) {
      button.disabled = false;
      button.textContent = 'Delete this farm';
      if (error.status === 401) return;
      const box = alertBox('error', `The farm was NOT deleted. ${error.message}`);
      result.replaceChildren(box);
      box.focus();
    }
  });
  return h('section', { class: 'card danger-zone', 'aria-labelledby': 'delete-farm' },
    h('h2', { id: 'delete-farm' }, 'Delete this farm'),
    h('p', {}, 'Deleting the farm permanently removes all its information for everyone. Only do this if the farm was created by mistake or will never be used again.'),
    result,
    button);
}

export function farmSettingsPage({ farmContext }) {
  const { farm, capacity } = farmContext;
  const role = farm.myRole;
  const canEdit = canDo(role, 'farm:update');
  return h('div', {},
    pageHeading(labelFor('settings', role)),
    takeFlash(),
    h('section', { class: 'card', 'aria-labelledby': 'farm-profile' },
      h('h2', { id: 'farm-profile' }, 'Farm profile'),
      profileDetails(farm, role === 'owner'),
      canEdit
        ? h('div', { class: 'button-row' }, h('a', { class: 'button', href: `#/farms/${farm.id}/settings/edit` }, 'Edit farm details'))
        : h('p', { class: 'small-print' }, 'Only the farm owner can change the farm\'s details.')),
    capacityPanel(capacity),
    canDo(role, 'farm:delete') ? deleteSection(farm) : null);
}
