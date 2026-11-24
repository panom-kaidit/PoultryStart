// Labels and number formats for the backend's values.
export const POULTRY_TYPE_LABELS = { broiler: 'Broilers (meat birds)', layer: 'Layers (egg birds)' };
export const ROLE_LABELS = { owner: 'Farm owner', manager: 'Farm manager', worker: 'Farm worker' };
export const EXPERIENCE_LABELS = {
  beginner: 'New to poultry',
  some_experience: 'Some experience',
  experienced: 'Experienced',
};
export const MANAGEMENT_MODE_LABELS = { independent: 'I manage it alone', with_team: 'With a team' };
export const STARTING_STAGE_LABELS = {
  day_old: 'Day-old chicks',
  pullet: 'Pullets (growing birds)',
  point_of_lay: 'Point-of-lay pullets',
};
export const HOUSE_STATUS_LABELS = { existing: 'I already have a poultry house', not_built: 'I do not have a house yet' };

export function labelFor(labels, value) {
  if (value === null || value === undefined || value === '') return 'Not given';
  return labels[value] || String(value);
}

export function formatNumber(value) {
  if (value === null || value === undefined || value === '') return 'Not given';
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString('en-GB', { maximumFractionDigits: 2 }) : String(value);
}

export function formatArea(value) {
  return value === null || value === undefined ? 'Not given' : `${formatNumber(value)} m²`;
}

export function formatLength(value) {
  return value === null || value === undefined ? 'Not given' : `${formatNumber(value)} m`;
}
