// Evaluates the rule-based Poultry Advisor for a farm.
const flockModel = require('../models/flockModel');
const healthModel = require('../models/healthObservationModel');
const productionRecordModel = require('../models/productionRecordModel');
const taskModel = require('../models/taskModel');
const productionRecordService = require('./productionRecordService');
const healthObservationService = require('./healthObservationService');
const readinessService = require('./readinessService');
const { displayStatusOf } = require('./taskService');
const { linksFor } = require('./guidanceService');
const { deathsBetween } = require('./mortalityCalculations');
const { flockAgeDaysOn } = require('./taskGenerator');
const AppError = require('../utils/AppError');
const { roleHasPermission } = require('../utils/permissions');
const { ugandaToday, addDays } = require('../utils/dates');
const { BROODING_DAYS, FIRST_EGG_CHECK_FROM_WEEK, ONCE_WINDOW_DAYS, findTemplate } = require('../data/taskTemplates');
const { STAGES, GUIDANCE_DISCLAIMER, SALE_STAGE_DAYS, stageQualification } = require('../data/guidanceContent');
const { RULES, PRIORITIES, ADVISOR_LIMITATION } = require('../data/advisorRules');

const MAX_ITEMS = 10;
const FINISHER_CHECK_DAY = findTemplate('TP-03').schedule.atAgeDays;
const POPULATION_WINDOW_DAYS = 31;

function stageOf(flock, ageDays, today) {
  if (flock.status === 'closed') return 'after_flock';
  if (flock.poultryType === 'broiler') {
    if (flock.startingStage === 'day_old' && ageDays <= BROODING_DAYS.broiler.to) return 'brooding';
    if (flock.expectedSaleDate && today >= addDays(flock.expectedSaleDate, -SALE_STAGE_DAYS)) return 'sale';
    return 'growing';
  }
  if (flock.firstEggDate && today >= flock.firstEggDate) return 'laying';
  if (ageDays <= BROODING_DAYS.layer.to) return 'brooding';
  if (Math.floor(ageDays / 7) <= 14) return 'rearing';
  return 'pre_lay';
}

function populationWarnings(farm, flock, today) {
  const range = { from: addDays(today, -(POPULATION_WINDOW_DAYS - 1)), to: today };
  const warnings = [];
  for (const type of ['weight', 'eggs']) {
    for (const r of productionRecordService.listRecords(type, farm, flock.id, range).records) {
      if (r.exceedsPopulation) warnings.push({ recordType: type, id: r.id, date: r.recordDate });
    }
  }
  for (const o of healthObservationService.listObservations(farm, flock.id, range).observations) {
    if (o.exceedsPopulation) warnings.push({ recordType: 'health', id: o.id, date: o.observationDate });
  }
  return warnings;
}

function recordGap(kind, flock, d1, d2) {
  if (flock.status !== 'active' || d2 < flock.arrivalDate) return false;
  if (kind === 'eggs' && (flock.poultryType !== 'layer' || !flock.firstEggDate || d2 < flock.firstEggDate)) return false;
  const type = kind === 'eggs' ? 'eggs' : kind;
  return productionRecordModel.countForFlockBetween(type, flock.id, d2, d1) === 0;
}

function flockContext(farm, flock, today, d1, d2) {
  const ageDays = flockAgeDaysOn(flock, today);
  const stage = stageOf(flock, ageDays, today);
  const base = {
    id: flock.id, name: flock.name, poultryType: flock.poultryType, status: flock.status, arrivalDate: flock.arrivalDate,
    closedDate: flock.closedAt ? flock.closedAt.slice(0, 10) : null, firstEggDate: flock.firstEggDate,
    expectedSaleDate: flock.expectedSaleDate, ageDays, ageWeeks: Math.floor(ageDays / 7), stage,
    stageLabel: STAGES[flock.poultryType][stage],
    stageQualification: stageQualification(flock.poultryType, stage),
  };
  if (flock.status !== 'active') return { ...base, deathDays: [], deathsLast3Days: 0, observationsLast3Days: [], observationsWithoutContact: [], populationWarnings: [], recordGaps: {} };
  const deaths = deathsBetween(flock.id, d2, today);
  const observations = healthModel.list({ farmId: farm.id, flockId: flock.id, from: addDays(today, -6), to: today })
    .map((o) => ({ id: o.id, observationDate: o.observationDate, contacted: o.vetContacted || o.extensionOfficerContacted }));
  return {
    ...base,
    deathDays: deaths.days,
    deathsLast3Days: deaths.birds,
    observationsLast3Days: observations.filter((o) => o.observationDate >= d2),
    observationsWithoutContact: observations.filter((o) => !o.contacted),
    populationWarnings: populationWarnings(farm, flock, today),
    recordGaps: Object.fromEntries(['feed', 'water', 'eggs'].map((kind) => [kind, recordGap(kind, flock, d1, d2)])),
  };
}

function taskContext(farm, membership, flockId, today) {
  const canManage = roleHasPermission(membership.role, 'tasks:manage');
  const tasks = taskModel.findForFarm(farm.id, { from: addDays(today, -14), to: today, flockId })
    .filter((t) => canManage || t.assignedTo === null || t.assignedTo === membership.userId)
    .map((t) => ({ ...t, displayStatus: displayStatusOf(t, today) }));
  const weekAgo = addDays(today, -7);
  return {
    missed: tasks.filter((t) => t.displayStatus === 'missed' && t.dueDate >= weekAgo),
    overdue: tasks.filter((t) => t.displayStatus === 'overdue'),
    problems: tasks.filter((t) => t.displayStatus === 'completed' && t.problemReported && t.dueDate >= weekAgo),
  };
}

function buildContext(farm, membership, flockId) {
  const today = ugandaToday();
  const d1 = addDays(today, -1);
  const d2 = addDays(today, -2);
  let flocks = flockModel.findAllForFarm(farm.id);
  if (flockId) {
    flocks = flocks.filter((f) => f.id === flockId);
    if (flocks.length === 0) throw new AppError(404, 'Flock not found.');
  }
  const role = membership.role;
  return {
    today, d1, d2,
    farm: { id: farm.id, poultryType: farm.poultryType },
    role,
    farmScope: !flockId,
    flocks: flocks.map((f) => flockContext(farm, f, today, d1, d2)),
    hasActiveFlocks: flockModel.findAllForFarm(farm.id, { status: 'active' }).length > 0,
    closedSince: addDays(today, -(ONCE_WINDOW_DAYS - 1)),
    readiness: role === 'owner' || role === 'manager' ? readinessService.latestReadinessView(farm) : null,
    tasks: taskContext(farm, membership, flockId, today),
    constants: { firstEggCheckWeek: FIRST_EGG_CHECK_FROM_WEEK, finisherCheckDay: FINISHER_CHECK_DAY },
  };
}

function advise(farm, membership, query) {
  return adviseWithContext(farm, membership, query).result;
}

function adviseWithContext(farm, membership, query) {
  const flockId = query.flockId ? Number(query.flockId) : undefined;
  const ctx = buildContext(farm, membership, flockId);
  const order = new Map(RULES.map((r, i) => [r.code, i]));

  const items = RULES
    .filter((rule) => rule.roles.includes(ctx.role))
    .flatMap((rule) => rule.evaluate(ctx).map((match) => ({
      rule: rule.code,
      priority: typeof rule.priority === 'function' ? rule.priority(match) : rule.priority,
      kind: rule.kind,
      title: match.title,
      message: match.message,
      nextStep: match.nextStep,
      flockId: match.flockId,
      facts: match.facts,
      basis: { labels: rule.labels, explanation: rule.basis },
      guidance: linksFor(match.guidance),
      targets: match.targets
        .filter((t) => !t.permission || roleHasPermission(ctx.role, t.permission))
        .map(({ permission, ...t }) => t),
    })))
    .sort((a, b) => PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority)
      || order.get(a.rule) - order.get(b.rule)
      || (a.flockId ?? 0) - (b.flockId ?? 0));

  const result = {
    date: ctx.today,
    role: ctx.role,
    flockId: flockId || null,
    limitation: ADVISOR_LIMITATION,
    disclaimer: GUIDANCE_DISCLAIMER,
    flocks: ctx.flocks.map(({ id, name, poultryType, status, ageDays, ageWeeks, stage, stageLabel, stageQualification: q }) =>
      ({ id, name, poultryType, status, ageDays, ageWeeks, stage, stageLabel, stageQualification: q })),
    totalCount: items.length,
    omittedCount: Math.max(0, items.length - MAX_ITEMS),
    advice: items.slice(0, MAX_ITEMS),
  };
  return { result, ctx };
}

module.exports = { advise, adviseWithContext, stageOf, MAX_ITEMS };
