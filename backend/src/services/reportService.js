// Builds the read-only flock, mortality and task reports.
const { runInTransaction } = require('../config/database');
const flockModel = require('../models/flockModel');
const flockMovementModel = require('../models/flockMovementModel');
const taskModel = require('../models/taskModel');
const { displayStatusOf, completedLateOf } = require('./taskService');
const { mortalityByDay } = require('./mortalityCalculations');
const { mondayOf } = require('./taskGenerator');
const AppError = require('../utils/AppError');
const { ugandaToday, addDays, daysBetween } = require('../utils/dates');
const { findTemplate } = require('../data/taskTemplates');
const { CUSTOM_TASK_TYPES, customTypeOfCode } = require('../data/customTaskTypes');

const DEFAULT_DAYS = 31;
const MAX_DAYS = 366;
const PROBLEM_LIST_LIMIT = 50;

const invalid = (field, message) => {
  throw new AppError(400, 'Some of the information provided is invalid.', [{ field, message }]);
};
const earlier = (a, b) => (a < b ? a : b);
const later = (a, b) => (a > b ? a : b);
const closedDateOf = (flock) => (flock.closedAt ? flock.closedAt.slice(0, 10) : null);
const lastDayOf = (flock, today) => (flock.status === 'closed' && closedDateOf(flock) ? earlier(closedDateOf(flock), today) : today);

function checkRange(from, to) {
  if (to < from) invalid('to', '"to" cannot be before "from".');
  if (daysBetween(from, to) + 1 > MAX_DAYS) invalid('to', `Choose a period of at most ${MAX_DAYS} days.`);
}
function checkNotFuture(query, today) {
  for (const field of ['from', 'to']) {
    if (query[field] && query[field] > today) invalid(field, `"${field}" cannot be after today (${today}).`);
  }
}

function periodOf(query, today) {
  checkNotFuture(query, today);
  let { from, to } = query;
  to = to || (from ? earlier(addDays(from, DEFAULT_DAYS - 1), today) : today);
  from = from || addDays(to, -(DEFAULT_DAYS - 1));
  checkRange(from, to);
  return { from, to };
}

function weeksOf(from, to) {
  const weeks = [];
  for (let monday = mondayOf(from); monday <= to; monday = addDays(monday, 7)) {
    weeks.push({ weekStart: monday, from: later(monday, from), to: earlier(addDays(monday, 6), to) });
  }
  return weeks;
}
const weekOfDate = (date) => mondayOf(date);

function getFlockOrFail(farm, flockId) {
  const flock = flockModel.findByIdForFarm(farm.id, flockId);
  if (!flock) throw new AppError(404, 'Flock not found.');
  return flock;
}

const flockBrief = (flock) => ({
  id: flock.id, name: flock.name, poultryType: flock.poultryType, status: flock.status,
  arrivalDate: flock.arrivalDate, closedDate: closedDateOf(flock), birdsReceived: flock.birdsReceived,
});

const IN_OUT_TYPES = ['received', 'additional_received', 'mortality', 'culled', 'sold', 'transferred_out'];
const POPULATION_NOTE = 'Bird numbers come only from the flock\'s movement history. A correction counts on the date of the ' +
  'movement it corrects, so a correction recorded later can change earlier populations. Movement notes and reasons are ' +
  'on the flock\'s movement list.';

function flockPeriodOf(flock, query, today) {
  checkNotFuture(query, today);
  const end = lastDayOf(flock, today);
  let { from, to } = query;
  if (!from && !to) {
    to = end;
    from = later(flock.arrivalDate, addDays(to, -(MAX_DAYS - 1)));
  } else if (!to) {
    to = earlier(addDays(from, MAX_DAYS - 1), end);
    if (to < from) to = from;
  } else if (!from) {
    from = later(flock.arrivalDate, addDays(to, -(MAX_DAYS - 1)));
    if (from > to) from = to;
  }
  checkRange(from, to);
  const requested = { from, to };
  if (to < flock.arrivalDate || from > end) return { requested, period: null };
  return { requested, period: { from: later(from, flock.arrivalDate), to: earlier(to, end) } };
}

const movementBrief = (m, byId) => ({
  id: m.id,
  movementType: m.movementType,
  birdChange: m.birdChange,
  ...(m.movementType === 'correction'
    ? { correctsMovementId: m.correctsMovementId, correctedMovementType: byId.get(m.correctsMovementId)?.movementType ?? null,
      replacesMovementId: m.replacesMovementId }
    : {}),
});

function flockReport(farm, flockId, query) {
  return runInTransaction(() => {
    const today = ugandaToday();
    const flock = getFlockOrFail(farm, flockId);
    const { requested, period } = flockPeriodOf(flock, query, today);
    const base = { flock: flockBrief(flock), requested, note: POPULATION_NOTE };
    if (!period) {
      return { ...base, period: null,
        emptyReason: `The flock had no birds in this period (it arrived on ${flock.arrivalDate}` +
          `${closedDateOf(flock) ? ` and was closed on ${closedDateOf(flock)}` : ''}).` };
    }
    const movements = flockMovementModel.findAllForFlock(flock.id);
    const byId = new Map(movements.map((m) => [m.id, m]));
    const startDate = addDays(period.from, -1);
    const starting = movements.filter((m) => m.movementDate <= startDate).reduce((sum, m) => sum + m.birdChange, 0);
    const inPeriod = movements.filter((m) => m.movementDate >= period.from && m.movementDate <= period.to);

    const totalsByType = Object.fromEntries(IN_OUT_TYPES.map((type) => [type, { birds: 0, movements: 0 }]));
    const corrections = { netBirds: 0, movements: 0, byCorrectedType: {} };
    for (const m of inPeriod) {
      if (m.movementType === 'correction') {
        const type = byId.get(m.correctsMovementId)?.movementType ?? 'unknown';
        corrections.netBirds += m.birdChange;
        corrections.movements += 1;
        corrections.byCorrectedType[type] = (corrections.byCorrectedType[type] || 0) + m.birdChange;
      } else {
        totalsByType[m.movementType].birds += Math.abs(m.birdChange);
        totalsByType[m.movementType].movements += 1;
      }
    }

    const days = [];
    let population = starting;
    for (const m of inPeriod) {
      let day = days[days.length - 1];
      if (!day || day.date !== m.movementDate) {
        day = { date: m.movementDate, netChange: 0, endOfDayPopulation: null, movements: [] };
        days.push(day);
      }
      day.netChange += m.birdChange;
      population += m.birdChange;
      day.endOfDayPopulation = population;
      day.movements.push(movementBrief(m, byId));
    }
    const netChange = inPeriod.reduce((sum, m) => sum + m.birdChange, 0);
    const ending = flockMovementModel.liveBirdCountOn(flock.id, period.to);
    return {
      ...base,
      period,
      startingPopulation: { endOfDate: startDate, birds: starting },
      endingPopulation: { endOfDate: period.to, birds: ending },
      netChange,
      reconciliation: {
        startingPopulation: starting, netChange, endingPopulation: ending, balanced: starting + netChange === ending,
      },
      totalsByType: { ...totalsByType, correction: corrections },
      days,
    };
  });
}

const MORTALITY_NOTE = 'Deaths recorded in PoultryStart, after any corrections (a correction counts on the date of the death ' +
  'it corrects). netDeaths is null when no mortality was recorded: that does not prove that no birds died. ' +
  'No percentages, targets or comparisons are given.';

function stateOf(records, deaths) {
  if (records === 0) return 'no_mortality_recorded';
  return deaths > 0 ? 'deaths_recorded' : 'corrected_to_zero';
}
const totalsOf = (days) => {
  const records = days.reduce((sum, d) => sum + d.mortalityRecords, 0);
  const deaths = days.reduce((sum, d) => sum + d.deaths, 0);
  return { mortalityRecords: records, netDeaths: records > 0 ? deaths : null, state: stateOf(records, deaths) };
};
const byWeek = (weeks, days) => weeks.map((w) => ({ ...w, ...totalsOf(days.filter((d) => d.date >= w.from && d.date <= w.to)) }));

function mortalityReport(farm, query) {
  return runInTransaction(() => {
    const today = ugandaToday();
    const period = periodOf(query, today);
    const flockId = query.flockId ? Number(query.flockId) : null;
    let flocks;
    if (flockId) flocks = [getFlockOrFail(farm, flockId)];
    else flocks = flockModel.findAllForFarm(farm.id).sort((a, b) => a.arrivalDate.localeCompare(b.arrivalDate) || a.id - b.id);

    const allDays = [];
    const items = [];
    for (const flock of flocks) {
      const from = later(period.from, flock.arrivalDate);
      const to = earlier(period.to, lastDayOf(flock, today));
      if (to < from) {
        if (flockId) items.push({ flock: flockBrief(flock), period: null, mortalityRecords: 0, netDeaths: null,
          state: 'outside_flock_dates', message: 'The flock had no birds in this period.' });
        continue;
      }
      const days = mortalityByDay(flockMovementModel.findAllForFlock(flock.id), from, to);
      allDays.push(...days);
      const totals = totalsOf(days);
      items.push({
        flock: flockBrief(flock),
        period: { from, to },
        ...totals,
        correctedRecords: days.reduce((sum, d) => sum + d.correctedRecords, 0),
        daysWithDeaths: days.filter((d) => d.deaths > 0).length,
        byWeek: byWeek(weeksOf(from, to), days),
        byDay: days,
      });
    }
    const farmDays = new Map();
    for (const d of allDays) {
      const day = farmDays.get(d.date) || { date: d.date, deaths: 0, mortalityRecords: 0, correctedRecords: 0 };
      day.deaths += d.deaths;
      day.mortalityRecords += d.mortalityRecords;
      day.correctedRecords += d.correctedRecords;
      farmDays.set(d.date, day);
    }
    const days = [...farmDays.values()].sort((a, b) => a.date.localeCompare(b.date));
    return {
      period,
      flockId,
      label: 'Deaths recorded in PoultryStart',
      note: MORTALITY_NOTE,
      totals: { ...totalsOf(days), daysWithDeaths: days.filter((d) => d.deaths > 0).length, flocksIncluded: items.length },
      byWeek: byWeek(weeksOf(period.from, period.to), days),
      flocks: items,
      emptyReason: items.length ? null : 'No flock had birds in this period.',
    };
  });
}

const STATUSES = ['pending', 'overdue', 'missed', 'completed', 'cancelled'];
const TASK_NOTE = 'Tasks due in the period, with the task list\'s own statuses worked out against today\'s date. ' +
  'Daily tasks exist only for days on which the task list was opened (that is when they are generated), so days ' +
  'without generated tasks are not counted as missed. Task notes are not included: open a task to read them.';

const emptyCounts = () => ({ total: 0, ...Object.fromEntries(STATUSES.map((s) => [s, 0])), completedOnTime: 0, completedLate: 0 });
function addTo(counts, task) {
  counts.total += 1;
  counts[task.displayStatus] += 1;
  if (task.displayStatus === 'completed') counts[task.completedLate ? 'completedLate' : 'completedOnTime'] += 1;
}
function labelOfCode(code) {
  const template = findTemplate(code);
  if (template) return template.title;
  const custom = customTypeOfCode(code);
  return custom ? CUSTOM_TASK_TYPES[custom].label : code;
}

function taskReport(farm, query) {
  return runInTransaction(() => {
    const today = ugandaToday();
    const period = periodOf(query, today);
    const flockId = query.flockId ? Number(query.flockId) : null;
    if (flockId) getFlockOrFail(farm, flockId);

    const tasks = taskModel.findForFarm(farm.id, { ...period, ...(flockId ? { flockId } : {}) })
      .map((t) => ({ id: t.id, title: t.title, dueDate: t.dueDate, flockId: t.flockId, templateCode: t.templateCode,
        source: t.source, problemReported: t.problemReported,
        displayStatus: displayStatusOf(t, today), completedLate: completedLateOf(t) === true }));

    const totals = emptyCounts();
    const codes = new Map();
    const weeks = weeksOf(period.from, period.to).map((w) => ({ ...w, ...emptyCounts() }));
    const weekIndex = new Map(weeks.map((w, i) => [w.weekStart, i]));
    for (const t of tasks) {
      addTo(totals, t);
      if (!codes.has(t.templateCode)) {
        codes.set(t.templateCode, { code: t.templateCode, label: labelOfCode(t.templateCode), source: t.source, ...emptyCounts() });
      }
      addTo(codes.get(t.templateCode), t);
      addTo(weeks[weekIndex.get(weekOfDate(t.dueDate))], t);
    }
    const problems = tasks.filter((t) => t.displayStatus === 'completed' && t.problemReported);
    return {
      period,
      flockId,
      today,
      note: TASK_NOTE,
      statusDefinitions: {
        pending: 'Open and not yet past its last day (a weekly task stays pending for its whole week).',
        overdue: 'Open and past its last day (not a daily task). It can still be done.',
        missed: 'A daily task not done on its day. It stays missed.',
        completed: 'Done. completedLate: done after its last day.',
        cancelled: 'Cancelled, with a reason.',
      },
      totals,
      byCode: [...codes.values()].sort((a, b) => a.code.localeCompare(b.code)),
      byWeek: weeks,
      problemsReported: {
        count: problems.length,
        tasks: problems.slice(0, PROBLEM_LIST_LIMIT).map(({ id, title, dueDate, flockId: f, templateCode }) =>
          ({ id, title, dueDate, flockId: f, templateCode })),
      },
      emptyReason: tasks.length ? null : 'No tasks were due in this period.',
    };
  });
}

module.exports = { flockReport, mortalityReport, taskReport, DEFAULT_DAYS, MAX_DAYS };
