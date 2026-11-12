// Business logic for flocks
const { runInTransaction, runInImmediateTransaction } = require('../config/database');
const flockModel = require('../models/flockModel');
const flockMovementModel = require('../models/flockMovementModel');
const readinessModel = require('../models/readinessModel');
const { calculateCapacity } = require('./capacityService');
const { checkStartingStage } = require('./farmService');
const { DEFAULT_STARTING_STAGE } = require('../data/startingStages');
const { ugandaToday, daysBetween } = require('../utils/dates');
const AppError = require('../utils/AppError');

const invalid = (field, message) => {
  throw new AppError(400, 'Some of the information provided is invalid.', [{ field, message }]);
};

// Age in weeks on arrival
const arrivalAgeOf = (flock) => (flock.startingStage === 'day_old' ? 0 : flock.ageAtArrivalWeeks);

function ageOf(flock) {
  const ageAsOf = flock.status === 'closed' && flock.closedAt ? flock.closedAt.slice(0, 10) : ugandaToday();
  const arrivalAge = arrivalAgeOf(flock);
  const days = daysBetween(flock.arrivalDate, ageAsOf);
  if (arrivalAge == null || Number.isNaN(days) || days < 0) return { currentAgeWeeks: null, ageAsOf };
  return { currentAgeWeeks: arrivalAge + Math.floor(days / 7), ageAsOf };
}

function withDetails(flock) {
  return {
    ...flock,
    ...ageOf(flock),
    movementTotals: flockMovementModel.totalsByType(flock.id),
  };
}

// ---- Space check ------------------------------

function capacityCheckFor(farm, flock, otherActiveFlocks, { addedBirds = null } = {}) {
  const otherBirds = otherActiveFlocks.reduce((sum, f) => sum + f.liveBirds, 0);
  const total = flock.birdsReceived + otherBirds;
  const capacity = calculateCapacity({
    poultryType: flock.poultryType,
    plannedBirds: total,
    startingStage: flock.startingStage,
    startingAgeWeeks: flock.ageAtArrivalWeeks,
    houseStatus: farm.houseStatus,
    houseLengthM: farm.houseLengthM,
    houseWidthM: farm.houseWidthM,
    nonUsableAreaM2: farm.nonUsableAreaM2,
    experienceLevel: farm.experienceLevel,
  });
  const limit = (capacity.stages || []).find((s) => s.stage === capacity.limitingStage) || null;
  const stageText = limit ? `${limit.label.toLowerCase()} stage, ${limit.density} birds/m²` : null;
  let birdsText;
  let recorded;
  if (addedBirds) {
    const thisFlock = `${flock.birdsReceived} in this flock, including the ${addedBirds} just added`;
    birdsText = otherBirds > 0
      ? `The ${total} live birds in the house (${thisFlock}, and ${otherBirds} in other active flocks)`
      : `The ${total} live birds in this flock (including the ${addedBirds} just added)`;
    recorded = 'The additional birds have been recorded with the actual number received.';
  } else {
    birdsText = otherBirds > 0
      ? `The ${total} live birds in the house (${flock.birdsReceived} in this flock and ${otherBirds} in other active flocks)`
      : `The ${flock.birdsReceived} birds received`;
    recorded = 'The flock has been recorded with the actual number of birds received.';
  }

  let message;
  let guidance;
  switch (capacity.status) {
    case 'within_capacity':
      message = `${birdsText} are within the recommended capacity of ${capacity.recommendedCapacity} birds ` +
        `for ${capacity.space.usableAreaM2} m² of usable floor (${stageText}).`;
      guidance = ['The space requirement is met. Re-check the space if you add birds or change the house.'];
      break;
    case 'above_capacity':
      message = `${birdsText} are above the recommended capacity of ${capacity.recommendedCapacity} birds ` +
        `for ${capacity.space.usableAreaM2} m² of usable floor (${stageText}), by ${capacity.shortfallBirds} birds.`;
      guidance = [
        recorded,
        `To meet the recommended space, reduce the number of birds in this house by ${capacity.shortfallBirds} ` +
          `(to ${capacity.recommendedCapacity}), or add about ${capacity.additionalAreaNeededM2} m² of usable floor ` +
          `(${capacity.requiredAreaM2} m² needed in total).`,
      ];
      break;
    case 'house_not_built':
      message = 'The farm profile says the poultry house is not built yet, so the space could not be checked ' +
        `against a house. For ${total} birds, about ${capacity.requiredAreaM2} m² of usable floor is needed (${stageText}).`;
      guidance = [
        recorded,
        'If the birds are already in a house, update the farm profile (houseStatus "existing" and the ' +
          'measurements) so the space can be checked.',
      ];
      break;
    default: // incomplete: the house measurements are missing
      message = 'The space could not be checked because the house length and width are not in the farm profile.';
      guidance = [recorded, 'Add the house measurements to the farm profile so the space can be checked.'];
  }

  // Several active flocks
  let sharedHouse = null;
  if (otherActiveFlocks.length > 0) {
    const others = otherActiveFlocks.map((f) => {
      const { currentAgeWeeks } = ageOf(f);
      return { id: f.id, name: f.name, liveBirds: f.liveBirds, startingStage: f.startingStage, currentAgeWeeks };
    });
    const ages = others.map((o) => (o.currentAgeWeeks == null ? 'unknown age' : `${o.currentAgeWeeks} weeks`));
    sharedHouse = {
      otherActiveFlocks: others,
      note: `This is a simplified check. It compares all ${total} live birds in the house with the space ` +
        `needed by this flock${stageText ? ` at its most space-demanding stage (${stageText})` : ''}. ` +
        `The other active flock${others.length === 1 ? ' is' : 's are'} at ${ages.join(', ')} and may need a ` +
        'different amount of space per bird, so this is not a precise assessment of each flock.',
    };
  }

  return {
    status: capacity.status,
    densityMode: capacity.densityMode,
    densityModeReason: capacity.densityModeReason,
    birds: { thisFlock: flock.birdsReceived, otherActiveFlocks: otherBirds, total },
    usableAreaM2: capacity.space.usableAreaM2,
    recommendedCapacity: capacity.recommendedCapacity ?? null,
    requiredAreaM2: capacity.requiredAreaM2 ?? null,
    limitingStage: limit ? { stage: limit.stage, label: limit.label, density: limit.density } : null,
    shortfallBirds: capacity.shortfallBirds ?? 0,
    additionalAreaNeededM2: capacity.additionalAreaNeededM2 ?? 0,
    missing: capacity.missing,
    message,
    guidance,
    sharedHouse,
    comparison: capacity.comparison ?? null,
    disclaimer: capacity.disclaimer,
    researchLimitations: capacity.researchLimitations,
  };
}

// ---- Plan comparison and readiness (information only) ----------------

function planComparisonFor(farm, birdsReceived) {
  const plannedBirds = farm.numberOfBirds;
  const difference = birdsReceived - plannedBirds;
  let message;
  if (!(plannedBirds > 0)) message = 'The farm profile has no planned number of birds to compare with.';
  else if (difference === 0) message = 'The same number of birds as planned.';
  else if (difference < 0) message = `${-difference} fewer birds than planned.`;
  else message = `${difference} more birds than planned.`;
  return { plannedBirds, birdsReceived, difference, message };
}

// The latest readiness assessment's stored status.
function readinessFor(farm) {
  const [latest] = readinessModel.findAssessmentsForFarm(farm.id);
  if (!latest) return { status: 'not_started', assessmentId: null, assessmentDate: null };
  return { status: latest.status, assessmentId: latest.id, assessmentDate: latest.assessmentDate };
}

function warningsFor(capacityCheck, readiness) {
  const warnings = [];
  if (capacityCheck.status === 'above_capacity') warnings.push({ code: 'above_capacity', message: capacityCheck.message });
  if (capacityCheck.status === 'house_not_built') warnings.push({ code: 'house_not_built', message: capacityCheck.message });
  if (capacityCheck.status === 'incomplete') warnings.push({ code: 'capacity_not_checked', message: capacityCheck.message });
  if (readiness.assessmentId === null) {
    warnings.push({
      code: 'readiness_not_started',
      message: 'No readiness assessment has been done for this farm. The flock has been recorded; ' +
        'the farm owner can still complete the readiness assessment.',
    });
  } else if (readiness.status !== 'ready') {
    warnings.push({
      code: 'readiness_not_ready',
      message: `The latest readiness assessment (${readiness.assessmentDate}) is "${readiness.status}", not ` +
        '"ready". The flock has been recorded; the farm owner can review the readiness checklist.',
    });
  }
  return warnings;
}

// ---- Public functions used by the controller --------------------------

function createFlock(farm, data, userId) {
  if (data.poultryType !== farm.poultryType) {
    invalid('poultryType', `This is a ${farm.poultryType} farm, so its flocks must be ${farm.poultryType}s. ` +
      'To keep a different type, change the farm profile first (only possible when it has no active flocks).');
  }
  const startingStage = data.startingStage || DEFAULT_STARTING_STAGE;
  const stageData = { poultryType: data.poultryType, startingStage, ageAtArrivalWeeks: data.ageAtArrivalWeeks };
  checkStartingStage(stageData, stageData, 'ageAtArrivalWeeks');
  if ((data.malesReceived ?? 0) + (data.femalesReceived ?? 0) > data.birdsReceived) {
    invalid('malesReceived', `Males (${data.malesReceived ?? 0}) and females (${data.femalesReceived ?? 0}) ` +
      `add up to more than the ${data.birdsReceived} birds received.`);
  }

  return runInTransaction(() => {
    const otherActiveFlocks = flockModel.findAllForFarm(farm.id, { status: 'active' });
    const flockForCheck = {
      poultryType: data.poultryType,
      birdsReceived: data.birdsReceived,
      startingStage,
      ageAtArrivalWeeks: stageData.ageAtArrivalWeeks,
    };
    const capacityCheck = capacityCheckFor(farm, flockForCheck, otherActiveFlocks);
    const name = data.name || `Flock ${flockModel.findAllForFarm(farm.id).length + 1}`;

    const created = flockModel.create(farm.id, {
      name,
      poultryType: data.poultryType,
      startDate: data.arrivalDate,
      initialBirdCount: data.birdsReceived,
      startingStage,
      ageAtArrivalWeeks: stageData.ageAtArrivalWeeks ?? null,
      breedStrain: data.breedStrain ?? null,
      supplier: data.supplier ?? null,
      malesReceived: data.malesReceived ?? null,
      femalesReceived: data.femalesReceived ?? null,
      vaccinationNotes: data.vaccinationNotes ?? null,
      notes: data.notes ?? null,
      // The space check on arrival, kept with the flock.
      capacityStatus: capacityCheck.status,
      recommendedCapacity: capacityCheck.recommendedCapacity,
      densityMode: capacityCheck.densityMode,
    }, userId);

    const readiness = readinessFor(farm);
    return {
      flock: withDetails(created),
      capacityCheck,
      planComparison: planComparisonFor(farm, data.birdsReceived),
      readiness,
      warnings: warningsFor(capacityCheck, readiness),
    };
  });
}

function listFlocks(farm, status) {
  return flockModel.findAllForFarm(farm.id, status ? { status } : {}).map(withDetails);
}

// Only a flock of THIS farm: another farm's flock is "not found".
function getFlockOrFail(farmId, flockId) {
  const flock = flockModel.findByIdForFarm(farmId, flockId);
  if (!flock) throw new AppError(404, 'Flock not found.');
  return flock;
}

// One flock, with the audit trail of any corrections to its arrival details.
function getFlock(farm, flockId) {
  const flock = getFlockOrFail(farm.id, flockId);
  return { ...withDetails(flock), arrivalCorrections: flockModel.findArrivalCorrections(flock.id) };
}

const closedFlockError = () => new AppError(409,
  'This flock is closed. Closed flocks are kept for viewing but cannot be changed or reopened.');


// Descriptive details: can be edited at any time while the flock is active.
const DESCRIPTIVE_FIELDS = ['name', 'breedStrain', 'supplier', 'vaccinationNotes', 'notes'];
const ARRIVAL_FIELDS = ['arrivalDate', 'startingStage', 'ageAtArrivalWeeks', 'malesReceived', 'femalesReceived'];
const ARRIVAL_COLUMNS = { arrivalDate: 'startDate' }; // API name -> model name, where they differ

function updateFlock(farm, flockId, data, userId) {
  const sent = (fields) => fields.filter((f) => data[f] !== undefined);
  return runInImmediateTransaction(() => {
    const flock = getFlockOrFail(farm.id, flockId);
    if (flock.status !== 'active') throw closedFlockError();

    const update = Object.fromEntries(sent(DESCRIPTIVE_FIELDS).map((f) => [f, data[f]]));
    let arrivalCorrection = null;

    // Only fields whose value really changes count as a correction.
    const arrivalChanged = sent(ARRIVAL_FIELDS).filter((f) => (data[f] ?? null) !== (flock[f] ?? null));
    if (arrivalChanged.length > 0) {
      if (!data.correctionReason) {
        invalid('correctionReason', 'Give a reason when correcting arrival details (date, stage, age, males or females).');
      }
      const movements = flockMovementModel.countForFlock(flock.id);
      if (movements > 1) {
        throw new AppError(409, 'Arrival details can only be corrected while the flock has no records other than ' +
          `the birds received. This flock has ${movements - 1} later movement${movements === 2 ? '' : 's'}. ` +
          'Use a correction movement for bird-number errors.');
      }

      // Same stage and age rules as when the flock was recorded.
      const merged = { ...flock, ...Object.fromEntries(arrivalChanged.map((f) => [f, data[f]])) };
      const stageInput = { poultryType: flock.poultryType, startingStage: merged.startingStage, ageAtArrivalWeeks: merged.ageAtArrivalWeeks };
      const stageSent = data.ageAtArrivalWeeks !== undefined ? { ageAtArrivalWeeks: data.ageAtArrivalWeeks } : {};
      checkStartingStage(stageInput, stageSent, 'ageAtArrivalWeeks');
      if (stageSent.ageAtArrivalWeeks !== undefined) merged.ageAtArrivalWeeks = stageSent.ageAtArrivalWeeks;
      if ((merged.malesReceived ?? 0) + (merged.femalesReceived ?? 0) > flock.birdsReceived) {
        invalid('malesReceived', `Males (${merged.malesReceived ?? 0}) and females (${merged.femalesReceived ?? 0}) ` +
          `add up to more than the ${flock.birdsReceived} birds received.`);
      }

      const others = flockModel.findAllForFarm(farm.id, { status: 'active' }).filter((f) => f.id !== flock.id);
      const capacityCheck = capacityCheckFor(farm, { ...merged, birdsReceived: flock.birdsReceived }, others);
      const snapshot = { status: capacityCheck.status, recommendedCapacity: capacityCheck.recommendedCapacity, densityMode: capacityCheck.densityMode };

      const changes = {};
      for (const f of ARRIVAL_FIELDS) {
        if ((merged[f] ?? null) !== (flock[f] ?? null)) changes[f] = { from: flock[f] ?? null, to: merged[f] ?? null };
        if ((merged[f] ?? null) !== (flock[f] ?? null)) update[ARRIVAL_COLUMNS[f] || f] = merged[f] ?? null;
      }
      if (JSON.stringify(snapshot) !== JSON.stringify(flock.capacityAtArrival)) {
        changes.capacityAtArrival = { from: flock.capacityAtArrival, to: snapshot };
        Object.assign(update, { capacityStatus: snapshot.status, recommendedCapacity: snapshot.recommendedCapacity, densityMode: snapshot.densityMode });
      }
      if (changes.arrivalDate) flockMovementModel.updateReceivedDate(flock.id, merged.arrivalDate);
      if (Object.keys(changes).length > 0) {
        flockModel.logArrivalCorrection(flock.id, changes, data.correctionReason, userId);
        arrivalCorrection = { changes, reason: data.correctionReason, capacityCheck };
      }
    }

    flockModel.update(flock.id, update);
    return { flock: getFlock(farm, flock.id), arrivalCorrection };
  });
}

function closeFlock(farm, flockId, data) {
  return runInImmediateTransaction(() => {
    const flock = getFlockOrFail(farm.id, flockId);
    if (flock.status !== 'active') throw closedFlockError();

    const live = flockMovementModel.liveBirdCount(flock.id);
    if (live > 0) {
      throw new AppError(409, `This flock still has ${live} live bird${live === 1 ? '' : 's'}. Record what happened ` +
        `to ${live === 1 ? 'it' : 'them'} (mortality, culling, sale or transfer) before closing the flock.`,
      [{ field: 'liveBirds', message: `${live} bird${live === 1 ? '' : 's'} still to be accounted for.` }]);
    }
    if (data.closureDate < flock.arrivalDate) {
      invalid('closureDate', `The closure date cannot be before the flock arrived (${flock.arrivalDate}).`);
    }
    const lastMovementDate = flockMovementModel.findAllForFlock(flock.id)
      .reduce((latest, m) => (m.movementDate > latest ? m.movementDate : latest), flock.arrivalDate);
    if (data.closureDate < lastMovementDate) {
      invalid('closureDate', `The closure date cannot be before the last recorded movement (${lastMovementDate}).`);
    }

    flockModel.update(flock.id, {
      status: 'closed',
      closedAt: data.closureDate,
      closureReason: data.closureReason,
      closureNotes: data.closureNotes ?? null,
    });
    return getFlock(farm, flock.id);
  });
}

// Deletes a flock recorded by mistake
function deleteFlock(farm, flockId) {
  runInImmediateTransaction(() => {
    const flock = getFlockOrFail(farm.id, flockId);
    const movements = flockMovementModel.countForFlock(flock.id);
    if (movements > 1) {
      throw new AppError(409, `This flock has ${movements - 1} recorded movement${movements === 2 ? '' : 's'} besides ` +
        'the birds received, so it cannot be deleted. Its records must be kept.');
    }
    flockModel.remove(flock.id);
  });
}

module.exports = {
  createFlock, listFlocks, getFlock, updateFlock, closeFlock, deleteFlock, withDetails, arrivalAgeOf, capacityCheckFor,
};
