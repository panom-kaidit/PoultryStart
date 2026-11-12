// Business logic for bird movements
const { runInImmediateTransaction } = require('../config/database');
const flockModel = require('../models/flockModel');
const flockMovementModel = require('../models/flockMovementModel');
const { withDetails, arrivalAgeOf, capacityCheckFor } = require('./flockService');
const { ugandaToday, daysBetween } = require('../utils/dates');
const AppError = require('../utils/AppError');

// Shown with every movement history so the two dates are never confused.
const FIELD_NOTES = {
  movementDate: 'Effective date: the day the change happened on the farm (Uganda date).',
  recordedAt: 'Recorded at: when the entry was made in PoultryStart (UTC date and time).',
  birdChange: 'What this entry changes in the live bird count (+ in, - out).',
  correctionAmount: 'Corrections only: the intended correction to the original movement. A replacement ' +
    'correction replaces the earlier one, so its birdChange is only the difference.',
  liveCountCheck: 'Only the current live count is checked when an entry is recorded. Backdated entries ' +
    'are not checked against the bird count on earlier dates.',
};

const invalid = (field, message) => {
  throw new AppError(400, 'Some of the information provided is invalid.', [{ field, message }]);
};

function getFlockOrFail(farmId, flockId) {
  const flock = flockModel.findByIdForFarm(farmId, flockId);
  if (!flock) throw new AppError(404, 'Flock not found.');
  return flock;
}

// The flock's age in whole weeks on a date.
function flockAgeOn(flock, date) {
  const arrivalAge = arrivalAgeOf(flock);
  if (arrivalAge == null) return null;
  return arrivalAge + Math.floor(daysBetween(flock.arrivalDate, date) / 7);
}

// A correction's intended amount.
const amountOf = (correction) => correction.correctionAmount ?? correction.birdChange;

// Corrections and replacement corrections.
function prepareCorrection(flock, data) {
  const original = flockMovementModel.findByIdForFlock(flock.id, data.correctsMovementId);
  if (!original) {
    invalid('correctsMovementId', `Movement ${data.correctsMovementId} was not found in this flock.`);
  }
  if (original.movementType === 'correction') {
    invalid('correctsMovementId', 'Give the ORIGINAL movement in correctsMovementId. To fix a wrong correction, ' +
      `send correctsMovementId ${original.correctsMovementId} and replacesMovementId ${original.id}.`);
  }

  const current = flockMovementModel.findEffectiveCorrectionOf(original.id);
  const replacesMovementId = data.replacesMovementId ?? null;
  if (replacesMovementId === null && current) {
    throw new AppError(409, `Movement ${original.id} is already corrected (by movement ${current.id}). ` +
      `To change that correction, record a replacement: send replacesMovementId ${current.id}.`,
    [{ field: 'replacesMovementId', message: `The current correction is movement ${current.id}.` }]);
  }
  if (replacesMovementId !== null) {
    if (!current) {
      invalid('replacesMovementId', `Movement ${original.id} has no correction to replace.`);
    }
    if (replacesMovementId !== current.id) {
      const named = flockMovementModel.findByIdForFlock(flock.id, replacesMovementId);
      if (named && named.correctsMovementId === original.id) {
        throw new AppError(409, `Correction ${replacesMovementId} has already been replaced. ` +
          `The current correction of movement ${original.id} is movement ${current.id}.`,
        [{ field: 'replacesMovementId', message: `Replace movement ${current.id} instead.` }]);
      }
      invalid('replacesMovementId', `Movement ${replacesMovementId} is not a correction of movement ${original.id}.`);
    }
  }

  const correctionAmount = data.birdChange;
  if (replacesMovementId === null && correctionAmount === 0) {
    invalid('birdChange', 'A correction cannot be 0.');
  }
  const corrected = original.birdChange + correctionAmount;
  if (original.movementType === 'received' && corrected <= 0) {
    invalid('birdChange', `The birds received on arrival (${original.birdChange}) must stay above 0 after the ` +
      `correction; this would make them ${corrected}.`);
  }
  if ((original.birdChange > 0 && corrected < 0) || (original.birdChange < 0 && corrected > 0)) {
    invalid('birdChange', `This correction would turn the original ${original.movementType} of ` +
      `${original.birdChange} into ${corrected}. A correction can reduce an entry to 0 but not reverse it.`);
  }

  const birdChange = correctionAmount - (current && replacesMovementId !== null ? amountOf(current) : 0);
  if (birdChange === 0) {
    invalid('birdChange', `The replacement is the same as the current correction (${amountOf(current)}).`);
  }
  if (data.movementDate !== undefined && data.movementDate !== original.movementDate) {
    invalid('movementDate', `A correction takes the date of the movement it corrects (${original.movementDate}). ` +
      'Leave out movementDate, or record a new movement for a different date.');
  }
  return { movementDate: original.movementDate, birdChange, correctionAmount, replacesMovementId };
}

// Additional birds must be the same batch
function checkAdditionalBirds(flock, data, movementDate) {
  const flockAge = flockAgeOn(flock, movementDate);
  if (flockAge == null) {
    invalid('birdsAgeWeeks', "This flock's age is not known, so additional birds cannot be checked. Record them as a new flock.");
  }
  if (data.birdsAgeWeeks !== flockAge) {
    invalid('birdsAgeWeeks', `The birds in this flock are ${flockAge} weeks old on ${movementDate}; the additional ` +
      `birds are ${data.birdsAgeWeeks} weeks old. Birds of a different age or stage must be recorded as a separate flock.`);
  }
}

// Turns a database protection firing (the last line of defence, normally
// caught earlier by the checks above) into a clear response.
function fromDatabaseError(err) {
  if (err instanceof AppError) return err;
  const message = String(err && err.message);
  if (message.includes('cannot go below zero')) {
    return new AppError(409, 'This movement would make the live bird count negative. It was not recorded.');
  }
  if (message.includes('correction') && err.code && String(err.code).startsWith('SQLITE_CONSTRAINT')) {
    return new AppError(409, 'This correction conflicts with another correction of the same movement. ' +
      'Reload the history and try again.');
  }
  return err;
}

// ---- Public functions used by the controller --------------------------

function listMovements(farm, flockId) {
  const flock = getFlockOrFail(farm.id, flockId);
  const movements = flockMovementModel.findAllForFlock(flock.id);
  const replacedBy = new Map(movements.filter((m) => m.replacesMovementId).map((m) => [m.replacesMovementId, m.id]));
  const effectiveCorrectionOf = new Map(
    movements.filter((m) => m.movementType === 'correction' && !replacedBy.has(m.id)).map((m) => [m.correctsMovementId, m])
  );
  return {
    flock: withDetails(flock),
    fieldNotes: FIELD_NOTES,
    movements: movements.map((m) => {
      if (m.movementType === 'correction') {
        return {
          ...m,
          correctionAmount: amountOf(m),
          replacedByMovementId: replacedBy.get(m.id) ?? null,
          isEffective: !replacedBy.has(m.id),
        };
      }
      const correction = effectiveCorrectionOf.get(m.id);
      return {
        ...m,
        correctedByMovementId: correction ? correction.id : null,
        birdChangeAfterCorrection: correction ? m.birdChange + amountOf(correction) : m.birdChange,
      };
    }),
  };
}

// Records one movement. 
function recordMovement(farm, flockId, data, userId) {
  try {
    return runInImmediateTransaction(() => {
      const flock = getFlockOrFail(farm.id, flockId);
      if (flock.status !== 'active') {
        throw new AppError(409, 'This flock is closed. Its records are kept but no new movements can be recorded.');
      }

      let row = { movementDate: data.movementDate ?? ugandaToday(), birdChange: data.birdChange };
      if (data.movementType === 'correction') {
        row = prepareCorrection(flock, data);
      } else {
        if (row.movementDate < flock.arrivalDate) {
          invalid('movementDate', `The movement date cannot be before the flock arrived (${flock.arrivalDate}).`);
        }
        if (data.movementType === 'additional_received') checkAdditionalBirds(flock, data, row.movementDate);
      }

      const live = flockMovementModel.liveBirdCount(flock.id);
      if (live + row.birdChange < 0) {
        throw new AppError(409, `Only ${live} live bird${live === 1 ? ' is' : 's are'} recorded in this flock. ` +
          `This change (${row.birdChange}) would leave ${live + row.birdChange}, so it was not recorded.`,
        [{ field: 'birdChange', message: `At most ${live} birds can be removed.` }]);
      }

      const movement = flockMovementModel.create({
        farmId: farm.id,
        flockId: flock.id,
        movementType: data.movementType,
        birdChange: row.birdChange,
        movementDate: row.movementDate,
        reason: data.reason || null,
        notes: data.notes || null,
        correctsMovementId: data.movementType === 'correction' ? data.correctsMovementId : null,
        replacesMovementId: row.replacesMovementId ?? null,
        correctionAmount: data.movementType === 'correction' ? row.correctionAmount : null,
        birdsAgeWeeks: data.movementType === 'additional_received' ? data.birdsAgeWeeks : null,
        recordedBy: userId,
      });
      const updated = withDetails(flockModel.findById(flock.id));
      const result = { movement, flock: updated };

      // More birds in the house
      
      if (data.movementType === 'additional_received') {
        const others = flockModel.findAllForFarm(farm.id, { status: 'active' }).filter((f) => f.id !== flock.id);
        result.capacityCheck = capacityCheckFor(farm, { ...updated, birdsReceived: updated.liveBirds }, others,
          { addedBirds: data.birdChange });
      }
      return result;
    });
  } catch (err) {
    throw fromDatabaseError(err);
  }
}

module.exports = { listMovements, recordMovement, FIELD_NOTES };
