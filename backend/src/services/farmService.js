// Business logic for farms.
const { runInTransaction } = require('../config/database');
const farmModel = require('../models/farmModel');
const membershipModel = require('../models/membershipModel');
const flockModel = require('../models/flockModel');
const readinessService = require('./readinessService');
const { calculateCapacity } = require('./capacityService');
const AppError = require('../utils/AppError');
const { ROLES } = require('../utils/permissions');
const { STARTING_STAGES, DEFAULT_STARTING_STAGE } = require('../data/startingStages');

// The non-usable area (stores, passages) must be smaller than the house.
function checkHouseMeasurements({ houseLengthM, houseWidthM, nonUsableAreaM2 }) {
  if (houseLengthM > 0 && houseWidthM > 0 && nonUsableAreaM2 > 0
      && nonUsableAreaM2 >= houseLengthM * houseWidthM) {
    throw new AppError(400, 'Some of the information provided is invalid.', [{
      field: 'nonUsableAreaM2',
      message: `The non-usable area (${nonUsableAreaM2} m²) must be smaller than the house area ` +
        `(${houseLengthM} m × ${houseWidthM} m = ${houseLengthM * houseWidthM} m²).`,
    }]);
  }
}

// The starting stage must fit the poultry type, and older layers need their
// actual age (weeks) within the stage's range (src/data/startingStages.js).
function checkStartingStage(merged, data, ageField = 'startingAgeWeeks') {
  const stage = merged.startingStage || DEFAULT_STARTING_STAGE;
  const stages = STARTING_STAGES[merged.poultryType];
  const definition = stages[stage];
  const invalid = (field, message) => {
    throw new AppError(400, 'Some of the information provided is invalid.', [{ field, message }]);
  };

  if (!definition) {
    invalid('startingStage', `"${stage}" is not available for ${merged.poultryType} farms. ` +
      `Allowed: ${Object.keys(stages).join(', ')}.`);
  }
  if (stage === 'day_old') {
    if (data[ageField] > 0) {
      invalid(ageField, 'Do not give an age for day-old chicks.');
    }
    if (merged[ageField] != null) data[ageField] = null; // clear an old age
    return;
  }
  const age = merged[ageField];
  if (age == null || age < definition.minWeeks || age > definition.maxWeeks) {
    invalid(ageField, `Enter the actual age of the birds on arrival: ${definition.label.toLowerCase()} ` +
      `must be ${definition.minWeeks} to ${definition.maxWeeks} weeks old.`);
  }
}

// Approved decisionds
function checkPoultryTypeChange(farm, sent) {
  if (!sent.poultryType || sent.poultryType === farm.poultryType) return;
  const active = flockModel.findAllForFarm(farm.id, { status: 'active' })
    .filter((flock) => flock.poultryType === farm.poultryType);
  if (active.length > 0) {
    throw new AppError(409,
      `The poultry type cannot be changed to ${sent.poultryType} while the farm has ` +
      `${active.length} active ${farm.poultryType} flock${active.length === 1 ? '' : 's'}. ` +
      'Close those flocks first.', [{
        field: 'poultryType',
        message: `Active ${farm.poultryType} flocks: ${active.map((f) => f.name).join(', ')}.`,
      }]);
  }
}

// Space and capacity check for the farm's current poultry type, using the
// information entered in the farm profile (never asked for twice).
function capacityForFarm(farm) {
  return calculateCapacity({
    poultryType: farm.poultryType,
    plannedBirds: farm.numberOfBirds,
    houseStatus: farm.houseStatus,
    experienceLevel: farm.experienceLevel,
    startingStage: farm.startingStage,
    startingAgeWeeks: farm.startingAgeWeeks,
    houseLengthM: farm.houseLengthM,
    houseWidthM: farm.houseWidthM,
    nonUsableAreaM2: farm.nonUsableAreaM2,
  });
}

function createFarm(userId, data) {
  checkHouseMeasurements(data);
  checkStartingStage(data, data);
  return runInTransaction(() => {
    const created = farmModel.create(userId, data);
    membershipModel.create({ farmId: created.id, userId, role: ROLES.OWNER, addedBy: userId });
    const farm = { ...created, myRole: ROLES.OWNER };

    const readinessAssessment = data.startAssessment === true
      ? readinessService.createAssessment(farm)
      : null;

    return { farm, capacity: capacityForFarm(farm), readinessAssessment };
  });
}

// Only farms the user owns or has been added to
function listFarmsForUser(userId) {
  return farmModel.findAllForUser(userId);
}

function getFarm(farm, membership) {
  return { farm: { ...farm, myRole: membership.role }, capacity: capacityForFarm(farm) };
}

function updateFarm(farm, data, membership) {
  const sent = Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
  checkPoultryTypeChange(farm, sent);
  checkHouseMeasurements({ ...farm, ...sent });
  checkStartingStage({ ...farm, ...sent }, data);
  const updated = farmModel.update(farm.id, data);
  return { farm: { ...updated, myRole: membership.role }, capacity: capacityForFarm(updated) };
}

function deleteFarm(farmId) {
  farmModel.remove(farmId);
}

module.exports = {
  createFarm, listFarmsForUser, getFarm, updateFarm, deleteFarm, capacityForFarm, checkStartingStage,
};
