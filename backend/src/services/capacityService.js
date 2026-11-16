// Space and bird-capacity calculation (planning tool).

const { STAGES, DENSITY_SETTINGS, PLANNING_DISCLAIMER } = require('../data/stockingDensities');
const { DEFAULT_STARTING_STAGE, LIMITATIONS } = require('../data/startingStages');

const round2 = (n) => Math.round(n * 100) / 100;
const roundUpTo1Decimal = (n) => Math.ceil(n * 10 - 1e-9) / 10;

function calculateUsableArea({ houseLengthM, houseWidthM, nonUsableAreaM2 }) {
  const missing = [];
  if (!(houseLengthM > 0)) missing.push('houseLengthM');
  if (!(houseWidthM > 0)) missing.push('houseWidthM');
  if (missing.length > 0) {
    return { usableAreaM2: null, grossAreaM2: null, nonUsableAreaM2: nonUsableAreaM2 ?? 0, missing };
  }

  const gross = houseLengthM * houseWidthM;
  const nonUsable = nonUsableAreaM2 ?? 0;
  if (nonUsable < 0 || nonUsable >= gross) {
    throw new RangeError('The non-usable area must be at least 0 and smaller than the house area.');
  }
  return {
    usableAreaM2: round2(gross - nonUsable),
    grossAreaM2: round2(gross),
    nonUsableAreaM2: round2(nonUsable),
    missing,
  };
}

// The density mode for a farm.t.
function densityModeFor({ mode, experienceLevel }) {
  const chosen = mode || DENSITY_SETTINGS.modeByExperience[experienceLevel] || DENSITY_SETTINGS.fallbackMode;
  if (!DENSITY_SETTINGS.modes.includes(chosen)) {
    throw new RangeError(`Unknown density mode "${chosen}".`);
  }
  return chosen;
}

// The stages for one poultry type with the density to use in this mode.
function stagesFor(poultryType, mode, startAgeWeeks = 0) {
  const stages = STAGES[poultryType];
  if (!stages) {
    // Never fall back to the other bird type's values.
    throw new RangeError(`No stocking densities are defined for poultry type "${poultryType}".`);
  }
  return stages.map((s) => {
    const reference = s.density[mode];
    let density = reference;
    if (s.notMoreThanStage) {
      const local = stages.find((x) => x.stage === s.notMoreThanStage).density[mode];
      density = Math.min(reference, local);
    }
    return {
      stage: s.stage,
      label: s.label,
      age: s.age,
      applicable: s.toWeek == null || s.toWeek >= startAgeWeeks,
      density,
      referenceDensity: reference,
      limitedByLocalStage: density < reference ? s.notMoreThanStage : null,
      classification: s.classification || 'uganda_official',
      provisional: Boolean(s.provisional),
      source: s.source,
      note: s.note,
    };
  });
}

const capacityOf = (usableAreaM2, density) => Math.floor(usableAreaM2 * density + 1e-9);
const areaFor = (birds, density) => (birds > 0 ? roundUpTo1Decimal(birds / density) : 0);

// The full capacity check for a farm .
function calculateCapacity(input) {
  const mode = densityModeFor(input);
  const otherMode = mode === 'standard' ? 'conservative' : 'standard';
  const startingStage = input.startingStage || DEFAULT_STARTING_STAGE;
  const startAgeWeeks = startingStage === 'day_old' ? 0 : (input.startingAgeWeeks ?? 0);
  const stages = stagesFor(input.poultryType, mode, startAgeWeeks);
  const otherStages = stagesFor(input.poultryType, otherMode, startAgeWeeks).filter((s) => s.applicable);
  const applicableStages = stages.filter((s) => s.applicable);
  const plannedBirds = input.plannedBirds > 0 ? input.plannedBirds : 0;
  const notBuilt = input.houseStatus === 'not_built';
  const area = calculateUsableArea(input);

  const base = {
    poultryType: input.poultryType,
    densityMode: mode,
    densityModeReason: DENSITY_SETTINGS.reasons[mode],
    plannedBirds,
    startingStage,
    startingAgeWeeks: startAgeWeeks,
    houseStatus: input.houseStatus ?? null,
    space: {
      houseLengthM: input.houseLengthM ?? null,
      houseWidthM: input.houseWidthM ?? null,
      grossAreaM2: area.grossAreaM2,
      nonUsableAreaM2: area.nonUsableAreaM2,
      usableAreaM2: area.usableAreaM2,
    },
    disclaimer: PLANNING_DISCLAIMER,
    researchLimitations: [
      ...(startingStage !== 'day_old' ? [LIMITATIONS.olderBirds, LIMITATIONS.ageRanges] : []),
      ...applicableStages.filter((st) => st.provisional).map((st) => `${st.label}: ${st.note}`),
    ],
  };

  // Situation 1: information missing. Ask for it; never guess.
  const missing = notBuilt ? [] : [...area.missing];
  if (plannedBirds === 0) missing.push('numberOfBirds');
  if (missing.length > 0) {
    return {
      ...base,
      status: 'incomplete',
      missing,
      message: 'The space check needs more information before it can be calculated.',
      guidance: [
        ...(area.missing.length > 0 && !notBuilt
          ? ['Measure the inside of the poultry house and enter its length and width in metres. ' +
             'If part of the house is a store, feed room or passage, enter that area too, so only ' +
             'the floor the birds can use is counted. If you do not have a house yet, say so ' +
             '(houseStatus "not_built") to see how much floor space to build.']
          : []),
        ...(plannedBirds === 0 ? ['Enter the number of birds you plan to keep.'] : []),
      ],
    };
  }

  // Required floor area at every stage of the full production plan.
  const stageAreas = stages.map((s) => ({ ...s, requiredAreaM2: areaFor(plannedBirds, s.density) }));
  const limiting = stageAreas.filter((s) => s.applicable).reduce((a, b) => (b.density < a.density ? b : a));
  const otherLimit = otherStages.reduce((a, b) => (b.density < a.density ? b : a));
  const comparison = {
    densityMode: otherMode,
    density: otherLimit.density,
    requiredAreaM2: areaFor(plannedBirds, otherLimit.density),
    recommendedCapacity: area.usableAreaM2 != null ? capacityOf(area.usableAreaM2, otherLimit.density) : null,
  };

  // Situation 2: no house yet. Show how much usable floor to build.
  if (notBuilt) {
    const plannedDesign = area.usableAreaM2 != null
      ? {
        usableAreaM2: area.usableAreaM2,
        recommendedCapacity: capacityOf(area.usableAreaM2, limiting.density),
        fits: plannedBirds <= capacityOf(area.usableAreaM2, limiting.density),
      }
      : null;
    return {
      ...base,
      status: 'house_not_built',
      missing: [],
      requiredAreaM2: limiting.requiredAreaM2,
      limitingStage: limiting.stage,
      plannedDesign,
      message: `You do not have a poultry house yet. For ${plannedBirds} birds, plan at least ` +
        `${limiting.requiredAreaM2} m² of usable floor (${limiting.label.toLowerCase()} stage, ` +
        `${limiting.density} birds/m²).`,
      guidance: [
        `Build at least ${limiting.requiredAreaM2} m² of floor that the birds can use. Stores, feed ` +
          'rooms and passages need extra space on top of this.',
        ...(plannedDesign
          ? [plannedDesign.fits
            ? `The planned house (${plannedDesign.usableAreaM2} m² usable) is big enough for ${plannedBirds} birds.`
            : `The planned house (${plannedDesign.usableAreaM2} m² usable) is too small: it fits about ` +
              `${plannedDesign.recommendedCapacity} birds.`]
          : []),
        'The farm cannot be ready to receive chicks until the house is built. Update the farm ' +
          'profile (houseStatus "existing" and the measurements) when it is.',
      ],
      stages: stageAreas.map((s) => ({ ...s, recommendedCapacity: null, fits: null })),
      comparison,
    };
  }

  // Situations 3 and 4: an existing house with measurements.
  const stageResults = stageAreas.map((s) => {
    if (!s.applicable) return { ...s, recommendedCapacity: null, fits: null }; // before arrival
    const recommendedCapacity = capacityOf(area.usableAreaM2, s.density);
    return { ...s, recommendedCapacity, fits: plannedBirds <= recommendedCapacity };
  });
  const limit = stageResults.find((s) => s.stage === limiting.stage);
  const within = plannedBirds <= limit.recommendedCapacity;
  const shortfallBirds = within ? 0 : plannedBirds - limit.recommendedCapacity;
  const additionalAreaNeededM2 = within ? 0 : roundUpTo1Decimal(limit.requiredAreaM2 - area.usableAreaM2);
  const where = `${area.usableAreaM2} m² of usable floor (${limit.label.toLowerCase()} stage, ${limit.density} birds/m²)`;

  return {
    ...base,
    status: within ? 'within_capacity' : 'above_capacity',
    missing: [],
    recommendedCapacity: limit.recommendedCapacity,
    requiredAreaM2: limit.requiredAreaM2,
    limitingStage: limit.stage,
    shortfallBirds,
    additionalAreaNeededM2,
    message: within
      ? `The planned ${plannedBirds} birds are within the recommended capacity of ${limit.recommendedCapacity} birds for ${where}.`
      : `The planned ${plannedBirds} birds are above the recommended capacity of ${limit.recommendedCapacity} birds for ${where}.`,
    guidance: within
      ? ['The space requirement is met. Re-check the space if you add birds or change the house.']
      : [
        `Option 1: reduce the flock by ${shortfallBirds} birds, to ${limit.recommendedCapacity}.`,
        `Option 2: add about ${additionalAreaNeededM2} m² of usable floor (${limit.requiredAreaM2} m² needed in total).`,
        'Option 3: split the birds into two batches at different times.',
      ],
    stages: stageResults,
    comparison,
  };
}

module.exports = { calculateUsableArea, calculateCapacity, densityModeFor };
