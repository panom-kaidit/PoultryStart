// Builds the read-only farm dashboard.
const { runInTransaction } = require('../config/database');
const flockModel = require('../models/flockModel');
const flockMovementModel = require('../models/flockMovementModel');
const recordModel = require('../models/productionRecordModel');
const healthModel = require('../models/healthObservationModel');
const taskModel = require('../models/taskModel');
const readinessService = require('./readinessService');
const expenseService = require('./expenseService');
const { adviseWithContext } = require('./advisorService');
const { displayStatusOf } = require('./taskService');
const { mortalityByDay } = require('./mortalityCalculations');
const { roleHasPermission } = require('../utils/permissions');
const { addDays, daysBetween } = require('../utils/dates');

const RECENT_DAYS = 7;
const POPULATION_WARNING_DAYS = 31;
const LIST_LIMIT = 5;
const WARNING_LIST_LIMIT = 10;

const round = (n, places) => Math.round(n * 10 ** places) / 10 ** places;
const later = (a, b) => (a > b ? a : b);

const MORTALITY_LABEL = 'Deaths recorded in PoultryStart';
const MORTALITY_NOTE = 'Deaths recorded in PoultryStart, after any corrections. "No deaths recorded" means no mortality was ' +
  'entered; it does not prove that no birds died.';
const PRODUCTION_NOTE = 'Totals of the records entered for each active flock. A total is shown only when there are records; ' +
  'days without a record are not counted as zero. No targets or per-bird figures are given.';
const HEALTH_NOTE = 'Counts of the health observations recorded. The observations themselves are on each flock\'s ' +
  'health observation list. These counts are not a diagnosis.';
const TASK_GENERATION_NOTE = 'Daily tasks are generated when the task list is opened (GET /api/farms/{farmId}/tasks). ' +
  'The dashboard never generates tasks.';

function flockSection(active, advisorFlocks) {
  const stageOf = new Map(advisorFlocks.map((f) => [f.id, f]));
  const cards = active.map((flock) => {
    const s = stageOf.get(flock.id);
    return {
      id: flock.id,
      name: flock.name,
      poultryType: flock.poultryType,
      startingStage: flock.startingStage,
      arrivalDate: flock.arrivalDate,
      ageDays: s.ageDays,
      ageWeeks: s.ageWeeks,
      stage: s.stage,
      stageLabel: s.stageLabel,
      stageQualification: s.stageQualification,
      birdsReceived: flock.birdsReceived,
      liveBirds: flock.liveBirds,
      firstEggDate: flock.firstEggDate,
      expectedSaleDate: flock.expectedSaleDate,
    };
  });
  return {
    activeCount: active.length,
    liveBirds: active.length ? active.reduce((sum, f) => sum + f.liveBirds, 0) : null,
    liveBirdsBasis: 'The sum of each active flock\'s bird movements (received, added, deaths, culls, sales, transfers and corrections).',
    emptyReason: active.length ? null : 'No active flocks. Record a flock when the birds arrive.',
    flocks: cards,
  };
}

const taskBrief = (t) => ({ id: t.id, title: t.title, dueDate: t.dueDate, flockId: t.flockId, templateCode: t.templateCode });
const taskGroup = (list) => ({ count: list.length, tasks: list.slice(0, LIST_LIMIT).map(taskBrief) });

function taskSection(farm, membership, today, from) {
  const visible = roleHasPermission(membership.role, 'tasks:manage') ? {} : { visibleToUserId: membership.userId };
  const weekStartedFrom = addDays(today, -6);
  const withStatus = (t) => ({ ...t, displayStatus: displayStatusOf(t, today) });

  const current = taskModel.findForFarm(farm.id, { from: weekStartedFrom, to: today, ...visible })
    .filter((t) => t.dueDate === today || t.frequency === 'weekly')
    .map(withStatus);
  const count = (status) => current.filter((t) => t.displayStatus === status).length;
  const open = current.filter((t) => t.displayStatus === 'pending');
  const generatedForToday = current.some((t) => t.source === 'generated' && t.frequency === 'daily' && t.dueDate === today);
  let state;
  let message;
  if (!generatedForToday) {
    state = 'not_generated';
    message = 'No daily tasks are currently generated for today. This does not mean that no work is needed: ' +
      'open the task list to generate today\'s tasks.';
  } else if (open.length > 0) {
    state = 'outstanding';
    message = `${open.length} of today's tasks ${open.length === 1 ? 'is' : 'are'} still open.`;
  } else {
    state = 'completed';
    message = 'All of today\'s tasks are completed (or cancelled).';
  }
  const byTimeSlot = {};
  for (const t of open) byTimeSlot[t.timeSlot] = (byTimeSlot[t.timeSlot] || 0) + 1;

  const overdue = taskModel.findForFarm(farm.id, { status: 'overdue', today, weekStartedFrom, ...visible });
  const missed = taskModel.findForFarm(farm.id, { status: 'missed', from, to: today, today, ...visible });
  const problems = taskModel.findForFarm(farm.id, { status: 'completed', from, to: today, ...visible })
    .filter((t) => t.problemReported);

  return {
    today: {
      date: today,
      state,
      message,
      generationNote: TASK_GENERATION_NOTE,
      total: current.length,
      pending: open.length,
      completed: count('completed'),
      cancelled: count('cancelled'),
      openByTimeSlot: byTimeSlot,
      openTasks: open.slice(0, LIST_LIMIT).map(taskBrief),
    },
    overdue: { ...taskGroup(overdue), basis: 'Open tasks past their last day (not daily tasks). They can still be done.' },
    missedRecently: { from, to: today, ...taskGroup(missed), basis: 'Daily tasks due in the last 7 days that were not done.' },
    problemsReported: { from, to: today, ...taskGroup(problems),
      basis: 'Tasks due in the last 7 days completed with a problem reported. Open a task to read its notes.' },
  };
}

function readinessSection(farm, role) {
  const view = readinessService.latestReadinessView(farm);
  if (!view) return { status: 'not_started', message: 'No readiness assessment has been started for this farm.' };
  if (role !== 'owner') return { status: view.savedStatus };
  const s = view.summary;
  return {
    status: view.savedStatus,
    statusBasis: 'The status as last saved by the readiness assessment.',
    assessmentId: view.assessmentId,
    questionsAnswered: s.questionsAnswered,
    questionsTotal: s.questionsTotal,
    requiredQuestionsUnanswered: s.unansweredRequired.length,
    requiredResourcesAvailable: s.requiredResourcesAvailable,
    requiredResourcesTotal: s.requiredResourcesTotal,
    areasNeedingAttention: s.areasNeedingAttention,
    needsAttention: s.needsAttention.map(({ code, area, questionText, answer }) => ({ code, area, questionText, answer })),
    missingResources: s.missingResources,
    spaceCheck: s.spaceCheck ? { status: s.spaceCheck.status, message: s.spaceCheck.message } : null,
    path: `/api/farms/${farm.id}/readiness/${view.assessmentId}`,
  };
}

const groupByFlock = (records) => {
  const map = new Map();
  for (const r of records) {
    if (!map.has(r.flockId)) map.set(r.flockId, []);
    map.get(r.flockId).push(r);
  }
  return map;
};
const daysWith = (records) => new Set(records.map((r) => r.recordDate)).size;
const daysIn = (from, to) => (to < from ? 0 : daysBetween(from, to) + 1);

function quantity(records, field, unit, eligibleDays, what) {
  const methods = new Set(records.map((r) => r.measurementMethod));
  return {
    unit,
    total: records.length ? round(records.reduce((sum, r) => sum + r[field], 0), 3) : null,
    daysWithRecords: daysWith(records),
    eligibleDays,
    measurement: records.length === 0 ? null : (methods.size === 1 ? [...methods][0] : 'mixed'),
    emptyReason: records.length ? null : `No ${what} records in this period.`,
  };
}

function eggSection(flock, records, firstCounted, today) {
  if (!flock.firstEggDate) {
    return { total: null, daysWithRecords: 0, eligibleDays: 0,
      emptyReason: 'No first-egg date is recorded for this flock, so egg records cannot be made yet.' };
  }
  const eggFrom = later(firstCounted, flock.firstEggDate);
  const counted = records.filter((r) => r.recordDate >= eggFrom);
  const sum = (field) => counted.reduce((total, r) => total + r[field], 0);
  return {
    countedFrom: eggFrom,
    total: counted.length ? sum('totalEggs') : null,
    goodEggs: counted.length ? sum('goodEggs') : null,
    secondGradeEggs: counted.length ? sum('secondGradeEggs') : null,
    floorEggs: counted.length ? sum('floorEggs') : null,
    daysWithRecords: daysWith(counted),
    eligibleDays: daysIn(eggFrom, today),
    emptyReason: counted.length ? null
      : (eggFrom > today ? `The recorded first-egg date (${flock.firstEggDate}) is after today.` : 'No egg collection records in this period.'),
  };
}

function productionSection(farm, active, from, today) {
  const range = { farmId: farm.id, from, to: today };
  const feed = groupByFlock(recordModel.list('feed', range));
  const water = groupByFlock(recordModel.list('water', range));
  const eggs = groupByFlock(recordModel.list('eggs', range));
  return {
    from,
    to: today,
    note: PRODUCTION_NOTE,
    flocks: active.map((flock) => {
      const firstCounted = later(from, flock.arrivalDate);
      const eligibleDays = daysIn(firstCounted, today);
      const latest = recordModel.latestForFlock('weight', flock.id);
      const item = {
        flockId: flock.id,
        name: flock.name,
        countedFrom: firstCounted,
        feed: quantity(feed.get(flock.id) || [], 'quantityKg', 'kg', eligibleDays, 'feed'),
        water: quantity(water.get(flock.id) || [], 'quantityLitres', 'L', eligibleDays, 'drinking-water'),
      };
      if (flock.poultryType === 'layer') item.eggs = eggSection(flock, eggs.get(flock.id) || [], firstCounted, today);
      item.latestWeight = latest
        ? { recordId: latest.id, recordDate: latest.recordDate, method: latest.method, sampleSize: latest.sampleSize,
          averageWeightG: latest.averageWeightG, unit: 'g' }
        : null;
      if (!latest) item.latestWeightEmptyReason = 'No weighing recorded for this flock.';
      return item;
    }),
  };
}

function mortalitySection(active, from, today) {
  const flocks = active.map((flock) => {
    const days = mortalityByDay(flockMovementModel.findAllForFlock(flock.id), from, today);
    const records = days.reduce((sum, d) => sum + d.mortalityRecords, 0);
    const deaths = days.reduce((sum, d) => sum + d.deaths, 0);
    let state = 'no_mortality_recorded';
    if (records > 0) state = deaths > 0 ? 'deaths_recorded' : 'corrected_to_zero';
    return {
      flockId: flock.id,
      name: flock.name,
      mortalityRecords: records,
      correctedRecords: days.reduce((sum, d) => sum + d.correctedRecords, 0),
      netDeaths: records > 0 ? deaths : null,
      daysWithDeaths: days.filter((d) => d.deaths > 0).length,
      state,
      message: {
        no_mortality_recorded: 'No deaths recorded in PoultryStart in the last 7 days.',
        deaths_recorded: `${deaths} death${deaths === 1 ? '' : 's'} recorded in PoultryStart in the last 7 days (after corrections).`,
        corrected_to_zero: 'Deaths were recorded, but corrections brought them to 0.',
      }[state],
    };
  });
  const withRecords = flocks.filter((f) => f.mortalityRecords > 0);
  return {
    label: MORTALITY_LABEL,
    from,
    to: today,
    note: MORTALITY_NOTE,
    totalNetDeaths: withRecords.length ? withRecords.reduce((sum, f) => sum + f.netDeaths, 0) : null,
    flocks,
  };
}

function healthSection(farm, active, from, today) {
  const counts = new Map(healthModel.countsByFlockBetween(farm.id, from, today).map((c) => [c.flockId, c]));
  const flocks = active.map((flock) => {
    const c = counts.get(flock.id) || { observations: 0, withoutContact: 0 };
    return {
      flockId: flock.id,
      name: flock.name,
      observationsRecorded: c.observations,
      withoutVetOrExtensionContact: c.withoutContact,
      path: `/api/farms/${farm.id}/flocks/${flock.id}/records/health`,
    };
  });
  return {
    from,
    to: today,
    note: HEALTH_NOTE,
    observationsRecorded: flocks.reduce((sum, f) => sum + f.observationsRecorded, 0),
    withoutVetOrExtensionContact: flocks.reduce((sum, f) => sum + f.withoutVetOrExtensionContact, 0),
    flocks,
  };
}

function warningSection(advisorFlocks, today) {
  const seen = new Map();
  for (const flock of advisorFlocks) {
    for (const w of flock.populationWarnings) {
      const key = `${w.recordType}:${w.id}`;
      if (!seen.has(key)) seen.set(key, { recordType: w.recordType, recordId: w.id, flockId: flock.id, date: w.date });
    }
  }
  const records = [...seen.values()].sort((a, b) => b.date.localeCompare(a.date) || a.flockId - b.flockId);
  const byType = { weight: 0, eggs: 0, health: 0 };
  for (const r of records) byType[r.recordType] += 1;
  return {
    from: addDays(today, -(POPULATION_WARNING_DAYS - 1)),
    to: today,
    count: records.length,
    byType,
    records: records.slice(0, WARNING_LIST_LIMIT),
    explanation: 'Records that count more birds than the flock\'s movements now show on their date (often after a backdated ' +
      'movement). They are never changed automatically: check and correct the record or the movement.',
  };
}

function expensePeriod(summary) {
  return {
    from: summary.from,
    to: summary.to,
    voidedExcluded: summary.voidedExcluded,
    currencies: summary.currencies.map((c) => ({
      currency: c.currency,
      total: c.total,
      count: c.count,
      byCategory: c.byCategory.filter((x) => x.count > 0).sort((a, b) => b.total - a.total),
    })),
    emptyReason: summary.currencies.length ? null : 'No expenses recorded in this period.',
  };
}

function expenseSection(farm, today) {
  const monthToDate = expenseService.summary(farm, { from: `${today.slice(0, 7)}-01`, to: today });
  const last31Days = expenseService.summary(farm, { to: today });
  return {
    note: monthToDate.note,
    farmCurrency: monthToDate.farmCurrency,
    monthToDate: expensePeriod(monthToDate),
    last31Days: expensePeriod(last31Days),
    path: `/api/farms/${farm.id}/expenses/summary`,
  };
}

function dashboard(farm, membership) {
  return runInTransaction(() => {
    const { result: advice, ctx } = adviseWithContext(farm, membership, {});
    const today = ctx.today;
    const from = addDays(today, -(RECENT_DAYS - 1));
    const role = membership.role;
    const active = flockModel.findAllForFarm(farm.id, { status: 'active' });
    const activeAdvisorFlocks = ctx.flocks.filter((f) => f.status === 'active');

    const result = {
      date: today,
      role,
      farm: { id: farm.id, name: farm.name, location: farm.location, poultryType: farm.poultryType },
      recentPeriod: { from, to: today, days: RECENT_DAYS },
      flocks: flockSection(active, activeAdvisorFlocks),
      tasks: taskSection(farm, membership, today, from),
      readiness: readinessSection(farm, role),
      production: productionSection(farm, active, from, today),
      mortality: mortalitySection(active, from, today),
      health: healthSection(farm, active, from, today),
      populationWarnings: warningSection(activeAdvisorFlocks, today),
      attention: {
        limitation: advice.limitation,
        disclaimer: advice.disclaimer,
        totalCount: advice.totalCount,
        omittedCount: advice.omittedCount,
        items: advice.advice,
        path: `/api/farms/${farm.id}/advisor`,
      },
    };
    if (roleHasPermission(role, 'expenses:view')) result.expenses = expenseSection(farm, today);
    return result;
  });
}

module.exports = { dashboard, RECENT_DAYS };
