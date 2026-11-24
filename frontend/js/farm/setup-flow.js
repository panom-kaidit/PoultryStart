// Guided farm setup state, checks and farm request bodies.
import { STARTING_STAGES } from './planning-rules.js';

export const EXPERIENCE_CHOICES = [
  { id: 'beginner', label: 'No, first time' },
  { id: 'some_experience', label: 'A little' },
  { id: 'experienced', label: 'Yes, experienced' },
];

export const LIMITS = { name: 100, location: 150, birds: 1000000, houseM: 500 };

const blank = () => ({
  name: '', location: '', poultryType: '', numberOfBirds: 0, startingStage: 'day_old', startingAgeWeeks: '',
  experienceLevel: '', houseStatus: 'existing', houseLengthM: '', houseWidthM: '', nonUsableAreaM2: '',
});

let state = null;

export function setupState(userId) {
  if (!state || state.userId !== userId) state = { userId, farmId: null, values: blank(), errors: null };
  return state;
}

export function resetSetupState(userId) {
  state = { userId, farmId: null, values: blank(), errors: null };
  return state;
}

export function clearSetupState() {
  state = null;
}

export function keepAfterExpiry(saved) {
  state = saved;
}

const text = (v) => (v === null || v === undefined ? '' : String(v));

export function valuesFromFarm(farm) {
  return {
    name: farm.name || '',
    location: farm.location || '',
    poultryType: farm.poultryType || '',
    numberOfBirds: farm.numberOfBirds ?? 0,
    startingStage: farm.startingStage || 'day_old',
    startingAgeWeeks: farm.startingStage && farm.startingStage !== 'day_old' ? text(farm.startingAgeWeeks) : '',
    experienceLevel: farm.experienceLevel || '',
    houseStatus: farm.houseStatus || 'existing',
    houseLengthM: text(farm.houseLengthM),
    houseWidthM: text(farm.houseWidthM),
    nonUsableAreaM2: text(farm.nonUsableAreaM2),
  };
}

export function setupStateForFarm(userId, farm) {
  const current = setupState(userId);
  if (current.farmId !== farm.id) {
    state = { userId, farmId: farm.id, values: valuesFromFarm(farm), errors: null };
  }
  return state;
}

export const numberOrNull = (v) => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : Number.NaN;
};

export function farmBody(values) {
  const olderBirds = values.poultryType === 'layer' && values.startingStage !== 'day_old';
  const body = {
    name: values.name.trim(),
    location: values.location.trim(),
    poultryType: values.poultryType,
    numberOfBirds: Number(values.numberOfBirds),
    experienceLevel: values.experienceLevel,
    startingStage: values.poultryType === 'broiler' ? 'day_old' : values.startingStage,
    startingAgeWeeks: olderBirds ? numberOrNull(values.startingAgeWeeks) : null,
    houseStatus: values.houseStatus,
  };
  if (values.houseStatus === 'existing') {
    body.houseLengthM = numberOrNull(values.houseLengthM);
    body.houseWidthM = numberOrNull(values.houseWidthM);
    body.nonUsableAreaM2 = numberOrNull(values.nonUsableAreaM2) ?? 0;
  }
  return body;
}

export function birdsProblems(values) {
  const problems = [];
  if (!values.name.trim()) problems.push({ field: 'name', message: 'Enter a name for your farm.' });
  if (!values.location.trim()) problems.push({ field: 'location', message: 'Enter where the farm is, e.g. a town or district.' });
  if (!['broiler', 'layer'].includes(values.poultryType)) problems.push({ field: 'poultryType', message: 'Choose broilers or layers.' });
  const birds = Number(values.numberOfBirds);
  if (!Number.isInteger(birds) || birds < 0 || birds > LIMITS.birds) {
    problems.push({ field: 'numberOfBirds', message: 'Enter a whole number of birds from 0 to 1,000,000.' });
  }
  if (values.poultryType === 'layer' && values.startingStage !== 'day_old') {
    const age = numberOrNull(values.startingAgeWeeks);
    if (age === null || !Number.isInteger(age)) {
      problems.push({ field: 'startingAgeWeeks', message: 'Enter how many weeks old the birds will be when they arrive.' });
    }
  }
  if (!EXPERIENCE_CHOICES.some((c) => c.id === values.experienceLevel)) {
    problems.push({ field: 'experienceLevel', message: 'Choose how much experience you have with poultry.' });
  }
  return problems;
}

export function houseProblems(values) {
  if (values.houseStatus !== 'existing') return [];
  const problems = [];
  const length = numberOrNull(values.houseLengthM);
  const width = numberOrNull(values.houseWidthM);
  const unusable = numberOrNull(values.nonUsableAreaM2) ?? 0;
  const okM = (n) => n !== null && n > 0 && n <= LIMITS.houseM;
  if (!okM(length)) problems.push({ field: 'houseLengthM', message: 'Enter the inside length in metres (more than 0, at most 500).' });
  if (!okM(width)) problems.push({ field: 'houseWidthM', message: 'Enter the inside width in metres (more than 0, at most 500).' });
  if (Number.isNaN(unusable) || unusable < 0) {
    problems.push({ field: 'nonUsableAreaM2', message: 'Enter the space birds cannot use in m² (0 if none).' });
  } else if (okM(length) && okM(width) && unusable >= length * width) {
    problems.push({ field: 'nonUsableAreaM2', message: `This must be smaller than the whole house (${Math.round(length * width * 100) / 100} m²).` });
  }
  return problems;
}

export const STEP1_FIELDS = ['name', 'location', 'poultryType', 'numberOfBirds', 'startingStage', 'startingAgeWeeks', 'experienceLevel'];
export const STEP2_FIELDS = ['houseStatus', 'houseLengthM', 'houseWidthM', 'nonUsableAreaM2'];

export function changedFields(farm, body, fields) {
  const changes = {};
  for (const field of fields) {
    if (!(field in body)) continue;
    const saved = farm[field] ?? null;
    const next = body[field] ?? null;
    if (saved !== next) changes[field] = next;
  }
  return changes;
}

export function assessmentOutdated(assessment, farm) {
  if (!assessment) return true;
  const stage = farm.startingStage || 'day_old';
  return assessment.poultryType !== farm.poultryType || (assessment.startingStage || 'day_old') !== stage
    || (stage !== 'day_old' && (assessment.startingAgeWeeks ?? null) !== (farm.startingAgeWeeks ?? null));
}

export function ageRangeText(poultryType, startingStage) {
  const range = STARTING_STAGES[poultryType]?.[startingStage];
  return range && startingStage !== 'day_old' ? `${range.label}: ${range.minWeeks} to ${range.maxWeeks} weeks old on arrival.` : '';
}
