// Business logic for the Farm Readiness Assessment.
const { runInTransaction } = require('../config/database');
const readinessModel = require('../models/readinessModel');
const checklistModel = require('../models/checklistModel');
const AppError = require('../utils/AppError');
const { calculateCapacity, densityModeFor } = require('./capacityService');
const { AREAS, NEEDED_BY, defaultChecklistFor } = require('../data/readinessContent');
const { DEFAULT_STARTING_STAGE } = require('../data/startingStages');

// The birds' age (weeks) when they arrive: 0 for day-old chicks.
const arrivalAgeOf = (assessment) =>
  (assessment.startingStage === 'day_old' ? 0 : (assessment.startingAgeWeeks ?? 0));

// A requirement is IMMEDIATE
function isImmediate(entry, arrivalAgeWeeks) {
  const deadline = NEEDED_BY[entry.neededBy || 'chick_arrival'];
  return deadline.ageWeeks != null && arrivalAgeWeeks >= deadline.ageWeeks;
}

// The questions that apply to an assessment
function questionsFor(assessment) {
  const stage = assessment.startingStage || DEFAULT_STARTING_STAGE;
  return readinessModel.findQuestionsFor(assessment.poultryType)
    .filter((q) => q.startingStages.includes('all') || q.startingStages.includes(stage));
}

function calculateReadiness(questions, responses, items, capacity, arrivalAgeWeeks = 0) {
  const answers = new Map(responses.map((r) => [r.questionId, r]));
  const now = (x) => isImmediate(x, arrivalAgeWeeks);

  const brief = (q) => ({ id: q.id, code: q.code, area: q.area, questionText: q.questionText });
  const briefItem = (i) => ({ id: i.id, itemName: i.itemName, category: i.category });

  const requiredNow = questions.filter((q) => q.isRequired && now(q));
  const unansweredRequired = requiredNow.filter((q) => !answers.has(q.id)).map(brief);
  const needsAttention = requiredNow
    .filter((q) => answers.has(q.id) && answers.get(q.id).answer !== 'yes')
    .map((q) => ({ ...brief(q), answer: answers.get(q.id).answer }));

  const itemsNow = items.filter(now);
  const missingResources = itemsNow.filter((i) => i.isRequired && !i.isAvailable).map(briefItem);
  const optionalNotAvailable = itemsNow.filter((i) => !i.isRequired && !i.isAvailable).map(briefItem);

  // Later-stage requirements that are not in place yet, with their deadline.
  const laterStageRequirements = [
    ...questions.filter((q) => !now(q) && answers.get(q.id)?.answer !== 'yes')
      .map((q) => ({ type: 'question', ...brief(q), isRequired: q.isRequired, neededBy: q.neededBy })),
    ...items.filter((i) => !now(i) && !i.isAvailable)
      .map((i) => ({ type: 'resource', ...briefItem(i), isRequired: i.isRequired, neededBy: i.neededBy })),
  ].map((r) => {
    const deadline = NEEDED_BY[r.neededBy];
    return {
      ...r,
      neededByLabel: deadline.label,
      dueWeeksAfterArrival: deadline.ageWeeks != null ? deadline.ageWeeks - arrivalAgeWeeks : null,
    };
  });

  const spaceIncomplete = capacity?.status === 'incomplete';
  const spaceAboveCapacity = capacity?.status === 'above_capacity';
  const houseNotBuilt = capacity?.status === 'house_not_built';
  const answeredCount = questions.filter((q) => answers.has(q.id)).length;

  let status;
  if (answeredCount === 0) status = 'not_started';
  else if (unansweredRequired.length > 0 || spaceIncomplete) status = 'in_progress';
  else if (needsAttention.length > 0 || missingResources.length > 0 || spaceAboveCapacity || houseNotBuilt) status = 'not_ready';
  else status = 'ready';

  // Preparation areas that still need attention, in a fixed order.
  const flagged = new Set([
    ...unansweredRequired.map((q) => q.area),
    ...needsAttention.map((q) => q.area),
    ...missingResources.map((i) => i.category),
    ...(spaceIncomplete || spaceAboveCapacity || houseNotBuilt ? ['housing'] : []),
  ]);

  return {
    status,
    questionsTotal: questions.length,
    questionsAnswered: answeredCount,
    requiredQuestionsTotal: requiredNow.length,
    requiredResourcesTotal: itemsNow.filter((i) => i.isRequired).length,
    requiredResourcesAvailable: itemsNow.filter((i) => i.isRequired && i.isAvailable).length,
    unansweredRequired,
    needsAttention,
    missingResources,
    optionalNotAvailable,
    spaceCheck: capacity
      ? { status: capacity.status, message: capacity.message, missing: capacity.missing, guidance: capacity.guidance }
      : null,
    laterStageRequirements,
    areasNeedingAttention: AREAS.filter((area) => flagged.has(area)),
  };
}

// Loads an assessment of this farm, or throws 404.
function getAssessmentOrFail(farmId, assessmentId) {
  const assessment = readinessModel.findAssessment(farmId, assessmentId);
  if (!assessment) {
    throw new AppError(404, 'Readiness assessment not found for this farm.');
  }
  return assessment;
}

// The space check for an assessment.
function capacityFor(farm, assessment) {
  return calculateCapacity({
    poultryType: assessment.poultryType,
    startingStage: assessment.startingStage,
    startingAgeWeeks: assessment.startingAgeWeeks,
    mode: assessment.densityMode || undefined,
    plannedBirds: farm.numberOfBirds,
    houseStatus: farm.houseStatus,
    experienceLevel: farm.experienceLevel,
    houseLengthM: farm.houseLengthM,
    houseWidthM: farm.houseWidthM,
    nonUsableAreaM2: farm.nonUsableAreaM2,
  });
}

// Works out the current status 
function evaluate(farm, assessment) {
  const questions = questionsFor(assessment);
  const responses = readinessModel.findResponses(assessment.id);
  const items = checklistModel.findItemsForAssessment(assessment.id);
  const capacity = capacityFor(farm, assessment);
  const summary = {
    ...calculateReadiness(questions, responses, items, capacity, arrivalAgeOf(assessment)),
    researchLimitations: capacity.researchLimitations,
  };

  const allRequiredAnswered = summary.unansweredRequired.length === 0 && summary.questionsAnswered > 0;
  let completedAt = assessment.completedAt;
  if (allRequiredAnswered && !completedAt) completedAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
  if (!allRequiredAnswered) completedAt = null;

  if (summary.status !== assessment.status || completedAt !== assessment.completedAt) {
    readinessModel.updateStatus(assessment.id, summary.status, completedAt);
  }

  return {
    assessment: {
      ...assessment,
      status: summary.status,
      farmPoultryTypeChanged: assessment.poultryType !== farm.poultryType,
      farmStartingStageChanged: assessment.startingStage !== (farm.startingStage || DEFAULT_STARTING_STAGE)
        || (assessment.startingAgeWeeks ?? null) !== (farm.startingAgeWeeks ?? null),
    },
    summary,
    capacity,
    questions,
    responses,
    items,
  };
}

// Full view of one assessment
function buildDetail(farm, assessment) {
  const { assessment: current, summary, capacity, questions, responses, items } = evaluate(farm, assessment);
  const answers = new Map(responses.map((r) => [r.questionId, r]));
  const age = arrivalAgeOf(current);
  return {
    assessment: current,
    summary,
    capacity,
    questions: questions.map((q) => {
      const r = answers.get(q.id);
      return {
        ...q,
        immediate: isImmediate(q, age),
        answer: r ? r.answer : null,
        notes: r ? r.notes : null,
        answeredAt: r ? r.answeredAt : null,
      };
    }),
    resources: items.map((i) => ({ ...i, immediate: isImmediate(i, age) })),
  };
}

// ---- Public functions used by the controller and farm service ----------

function listAssessments(farm) {
  const assessments = readinessModel.findAssessmentsForFarm(farm.id);
  const evaluated = assessments.map((a) => evaluate(farm, a));
  const current = evaluated.length > 0 ? evaluated[0] : null;
  return {
    status: current ? current.summary.status : 'not_started',
    current: current ? { assessment: current.assessment, summary: current.summary } : null,
    assessments: evaluated.map((e) => e.assessment),
  };
}

// Starts a new assessment for the farm's current poultry type and copies in
// the default checklist for that type.
function createAssessment(farm) {
  const assessment = runInTransaction(() => {
    const startingStage = farm.startingStage || DEFAULT_STARTING_STAGE;
    const created = readinessModel.createAssessment(farm.id, {
      poultryType: farm.poultryType,
      startingStage,
      startingAgeWeeks: startingStage === 'day_old' ? null : farm.startingAgeWeeks,
      densityMode: densityModeFor({ experienceLevel: farm.experienceLevel }),
    });
    const arrivalAgeWeeks = startingStage === 'day_old' ? 0 : (farm.startingAgeWeeks ?? 0);
    for (const item of defaultChecklistFor(farm.poultryType, startingStage, arrivalAgeWeeks)) {
      checklistModel.createItem({
        farmId: farm.id,
        assessmentId: created.id,
        itemName: item.itemName,
        category: item.category,
        isRequired: item.isRequired,
        isAvailable: false,
        isCustom: false,
        neededBy: item.neededBy,
      });
    }
    return created;
  });
  return buildDetail(farm, assessment);
}

function getAssessment(farm, assessmentId) {
  return buildDetail(farm, getAssessmentOrFail(farm.id, assessmentId));
}

// Saves or updates several answers at once
function saveResponses(farm, assessmentId, responses, userId) {
  const assessment = getAssessmentOrFail(farm.id, assessmentId);
  const applicable = new Map(questionsFor(assessment).map((q) => [q.id, q]));
  const existing = new Map(readinessModel.findResponses(assessment.id).map((r) => [r.questionId, r]));

  const problems = [];
  const seen = new Set();
  responses.forEach((r, index) => {
    if (seen.has(r.questionId)) {
      problems.push({ field: `responses[${index}].questionId`, message: `Question ${r.questionId} is listed more than once.` });
    } else if (!applicable.has(r.questionId)) {
      problems.push({
        field: `responses[${index}].questionId`,
        message: `Question ${r.questionId} does not exist or does not apply to this ${assessment.poultryType} assessment ` +
          `(starting stage: ${assessment.startingStage}).`,
      });
    }
    seen.add(r.questionId);
  });
  if (problems.length > 0) {
    throw new AppError(400, 'Some of the answers could not be saved.', problems);
  }

  runInTransaction(() => {
    for (const r of responses) {
      const previous = existing.get(r.questionId);
      const notes = r.notes !== undefined ? r.notes : (previous ? previous.notes : null);
      readinessModel.saveResponse({
        assessmentId: assessment.id,
        questionId: r.questionId,
        answer: r.answer,
        notes,
        userId,
      });
    }
  });

  return buildDetail(farm, assessment);
}

function listResources(farm, assessmentId) {
  const assessment = getAssessmentOrFail(farm.id, assessmentId);
  const { assessment: current, summary, items } = evaluate(farm, assessment);
  return {
    assessmentId: current.id,
    status: current.status,
    resources: items,
    missingResources: summary.missingResources,
    optionalNotAvailable: summary.optionalNotAvailable,
    laterStageRequirements: summary.laterStageRequirements.filter((r) => r.type === 'resource'),
  };
}

// The owner adds their own checklist item
function addCustomResource(farm, assessmentId, data) {
  const assessment = getAssessmentOrFail(farm.id, assessmentId);
  const item = checklistModel.createItem({
    farmId: farm.id,
    assessmentId: assessment.id,
    itemName: data.itemName,
    category: data.category,
    isRequired: data.isRequired ?? false,
    isAvailable: data.isAvailable ?? false,
    isCustom: true,
    neededBy: data.neededBy,
    notes: data.notes,
  });
  const { assessment: current } = evaluate(farm, assessment);
  return { resource: item, status: current.status };
}

// Default items
function updateResource(farm, assessmentId, itemId, data) {
  const assessment = getAssessmentOrFail(farm.id, assessmentId);
  const item = checklistModel.findItem(farm.id, assessment.id, itemId);
  if (!item) {
    throw new AppError(404, 'Checklist item not found in this assessment.');
  }

  if (!item.isCustom) {
    const protectedFields = ['itemName', 'category', 'isRequired', 'neededBy'].filter((f) => data[f] !== undefined);
    if (protectedFields.length > 0) {
      throw new AppError(
        400,
        `Default checklist items only allow changes to isAvailable and notes (not ${protectedFields.join(', ')}).`
      );
    }
  }

  const updated = checklistModel.updateItem(item.id, data);
  const { assessment: current } = evaluate(farm, assessment);
  return { resource: updated, status: current.status };
}

module.exports = {
  calculateReadiness,
  listAssessments,
  createAssessment,
  getAssessment,
  saveResponses,
  listResources,
  addCustomResource,
  updateResource,
};
