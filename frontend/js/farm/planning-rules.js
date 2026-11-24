// Mirrors the backend's space and bird-capacity rule for the live setup check.
const STAGES = {
  broiler: [
    { stage: 'brooding', toWeek: 1, label: 'Brooding (brooder ring)', density: { standard: 30, conservative: 30 } },
    { stage: 'growing', toWeek: 4, label: 'Growing', density: { standard: 25, conservative: 25 } },
    { stage: 'finishing', toWeek: null, label: 'Finishing (until sale)', density: { standard: 10, conservative: 6 } },
  ],
  layer: [
    { stage: 'chick', toWeek: 6, label: 'Chick (brooding)', density: { standard: 20, conservative: 20 } },
    { stage: 'pullet', toWeek: 13, label: 'Pullet (rearing)', density: { standard: 10, conservative: 10 } },
    { stage: 'pullet_transfer', toWeek: 18, label: 'Pullet before laying (transfer age)', density: { standard: 12, conservative: 12 }, notMoreThanStage: 'pullet' },
    { stage: 'laying', toWeek: null, label: 'Mature laying hen', density: { standard: 6, conservative: 5 } },
  ],
};

export const MODE_BY_EXPERIENCE = { beginner: 'conservative', some_experience: 'standard', experienced: 'standard' };
const FALLBACK_MODE = 'standard';

export const MODE_REASONS = {
  conservative: 'Conservative planning default for beginner farms (based on MAAIF/ILRI 2023). Chosen by PoultryStart for planning; not a legal standard.',
  standard: 'Standard planning default (MAAIF 2019, the main Uganda reference). Chosen by PoultryStart for planning; not a legal standard.',
};

export const PLANNING_DISCLAIMER = 'This capacity is a planning recommendation based on published stocking densities for '
  + 'open-sided, deep-litter houses. It is not a guarantee of bird performance or farm success. '
  + 'Hot weather, poor ventilation or heavier birds need more space.';

export const STARTING_STAGES = {
  broiler: { day_old: { label: 'Day-old chicks', minWeeks: 0, maxWeeks: 0 } },
  layer: {
    day_old: { label: 'Day-old chicks', minWeeks: 0, maxWeeks: 0 },
    pullet: { label: 'Pullets', minWeeks: 7, maxWeeks: 14 },
    point_of_lay: { label: 'Point of lay', minWeeks: 15, maxWeeks: 20 },
  },
};

const round2 = (n) => Math.round(n * 100) / 100;
export const roundUpTo1Decimal = (n) => Math.ceil(n * 10 - 1e-9) / 10;
export const capacityOf = (usableAreaM2, density) => Math.floor(usableAreaM2 * density + 1e-9);
export const areaFor = (birds, density) => (birds > 0 ? roundUpTo1Decimal(birds / density) : 0);

export function densityModeFor(experienceLevel) {
  return MODE_BY_EXPERIENCE[experienceLevel] || FALLBACK_MODE;
}

const startAgeOf = (startingStage, startingAgeWeeks) => ((startingStage || 'day_old') === 'day_old' ? 0 : (startingAgeWeeks ?? 0));

export function limitingStage(poultryType, mode, startAgeWeeks = 0) {
  const stages = STAGES[poultryType];
  if (!stages) return null;
  const withDensity = stages.map((s) => {
    let density = s.density[mode];
    if (s.notMoreThanStage) density = Math.min(density, stages.find((x) => x.stage === s.notMoreThanStage).density[mode]);
    return { stage: s.stage, label: s.label, density, applicable: s.toWeek == null || s.toWeek >= startAgeWeeks };
  });
  return withDensity.filter((s) => s.applicable).reduce((a, b) => (b.density < a.density ? b : a));
}

const positive = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0;

export function spaceCheck(input) {
  const mode = densityModeFor(input.experienceLevel);
  const limit = limitingStage(input.poultryType, mode, startAgeOf(input.startingStage, input.startingAgeWeeks));
  const plannedBirds = input.plannedBirds > 0 ? input.plannedBirds : 0;
  const base = { mode, modeReason: MODE_REASONS[mode], plannedBirds, density: limit?.density ?? null, stageLabel: limit?.label ?? null };
  if (!limit) return { ...base, status: 'incomplete', missing: ['poultryType'] };

  if (input.houseStatus === 'not_built') {
    if (plannedBirds === 0) return { ...base, status: 'incomplete', missing: ['numberOfBirds'] };
    return { ...base, status: 'house_not_built', missing: [], requiredAreaM2: areaFor(plannedBirds, limit.density) };
  }

  const missing = [];
  if (!positive(input.houseLengthM)) missing.push('houseLengthM');
  if (!positive(input.houseWidthM)) missing.push('houseWidthM');
  const nonUsable = input.nonUsableAreaM2 ?? 0;
  if (missing.length === 0) {
    const gross = input.houseLengthM * input.houseWidthM;
    if (!(nonUsable >= 0) || nonUsable >= gross) {
      return { ...base, status: 'invalid', missing: [], grossAreaM2: round2(gross), nonUsableAreaM2: nonUsable };
    }
  }
  if (plannedBirds === 0) missing.push('numberOfBirds');
  if (missing.length > 0) return { ...base, status: 'incomplete', missing };

  const grossAreaM2 = round2(input.houseLengthM * input.houseWidthM);
  const usableAreaM2 = round2(input.houseLengthM * input.houseWidthM - nonUsable);
  const recommendedCapacity = capacityOf(usableAreaM2, limit.density);
  const requiredAreaM2 = areaFor(plannedBirds, limit.density);
  const within = plannedBirds <= recommendedCapacity;
  return {
    ...base,
    status: within ? 'within_capacity' : 'above_capacity',
    missing: [],
    grossAreaM2,
    nonUsableAreaM2: round2(nonUsable),
    usableAreaM2,
    recommendedCapacity,
    requiredAreaM2,
    additionalAreaNeededM2: within ? 0 : roundUpTo1Decimal(requiredAreaM2 - usableAreaM2),
  };
}

export function lengthForBirds({ houseWidthM, nonUsableAreaM2 = 0, requiredAreaM2, density, plannedBirds }) {
  if (!positive(houseWidthM) || !(requiredAreaM2 > 0)) return null;
  let length = roundUpTo1Decimal((requiredAreaM2 + nonUsableAreaM2) / houseWidthM);
  for (let i = 0; i < 1000 && capacityOf(round2(length * houseWidthM - nonUsableAreaM2), density) < plannedBirds; i += 1) {
    length = Math.round((length + 0.1) * 10) / 10;
  }
  return length;
}
