// Generates daily tasks from the task templates.
const { runInImmediateTransaction } = require('../config/database');
const taskModel = require('../models/taskModel');
const flockModel = require('../models/flockModel');
const { TASK_TEMPLATES, BROODING_DAYS, ONCE_WINDOW_DAYS } = require('../data/taskTemplates');
const { daysBetween, addDays } = require('../utils/dates');

const arrivalAgeDays = (flock) => (flock.startingStage === 'day_old' ? 0 : (flock.ageAtArrivalWeeks ?? 0)) * 7;

function flockAgeDaysOn(flock, date) {
  return arrivalAgeDays(flock) + daysBetween(flock.arrivalDate, date);
}

const dateAtAge = (flock, ageDays) => addDays(flock.arrivalDate, ageDays - arrivalAgeDays(flock));

function mondayOf(date) {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return addDays(date, -((weekday + 6) % 7));
}

function applies(template, flock, dueDate) {
  const rule = template.applies;
  if (rule.poultryTypes && !rule.poultryTypes.includes(flock.poultryType)) return false;
  const ageDays = flockAgeDaysOn(flock, dueDate);
  if (rule.brooding) {
    const window = BROODING_DAYS[flock.poultryType];
    if (flock.startingStage !== 'day_old' || ageDays < window.from || ageDays > window.to) return false;
  }
  if (rule.fromWeek != null && Math.floor(ageDays / 7) < rule.fromWeek) return false;
  if (rule.untilFirstEgg && flock.firstEggDate && dueDate >= flock.firstEggDate) return false;
  if (rule.requiresFirstEgg && !(flock.firstEggDate && dueDate >= flock.firstEggDate)) return false;
  return true;
}

function onceAtAge(flock, dueAgeDays) {
  if (dueAgeDays <= arrivalAgeDays(flock)) return null;
  return dateAtAge(flock, dueAgeDays);
}

function flockDueDate(template, flock, date) {
  const s = template.schedule;
  const ageDays = flockAgeDaysOn(flock, date);
  switch (template.frequency) {
    case 'daily':
      return date;
    case 'weekly': {
      const fromWeek = typeof s.fromWeek === 'object' ? s.fromWeek[flock.poultryType] : (s.fromWeek ?? 1);
      const dueAge = Math.floor(ageDays / 7) * 7;
      if (fromWeek == null || dueAge < fromWeek * 7) return null;
      const due = addDays(date, dueAge - ageDays);
      return due >= flock.arrivalDate ? due : null;
    }
    case 'interval': {
      const since = daysBetween(flock.arrivalDate, date);
      if (since < s.startDay) return null;
      return addDays(flock.arrivalDate, s.startDay + Math.floor((since - s.startDay) / s.everyDays) * s.everyDays);
    }
    case 'once': {
      let due = null;
      let lastShown = null;
      if (s.atArrival) due = flock.arrivalDate;
      else if (s.atAgeDays != null) due = onceAtAge(flock, s.atAgeDays);
      else if (s.atWeek != null) due = onceAtAge(flock, s.atWeek * 7);
      else if (s.daysBeforeSale != null) {
        if (!flock.expectedSaleDate) return null;
        due = addDays(flock.expectedSaleDate, -s.daysBeforeSale);
        if (due < flock.arrivalDate) due = flock.arrivalDate;
        lastShown = flock.expectedSaleDate;
      } else if (s.layerFeedAtWeek != null) {
        const candidates = [onceAtAge(flock, s.layerFeedAtWeek * 7), flock.firstEggDate].filter(Boolean);
        due = candidates.length > 0 ? candidates.sort()[0] : null;
      } else {
        return null;
      }
      if (!due) return null;
      lastShown = lastShown || addDays(due, (s.windowDays ?? ONCE_WINDOW_DAYS) - 1);
      return date >= due && date <= lastShown ? due : null;
    }
    default:
      return null;
  }
}

const descriptionFor = (template, poultryType) =>
  (typeof template.description === 'string' ? template.description : template.description[poultryType]);

function generateTasks(farm, date) {
  return runInImmediateTransaction(() => {
    const flocks = flockModel.findAllForFarm(farm.id, { status: 'active' }).filter((f) => f.arrivalDate <= date);
    let created = 0;
    const add = (template, flock, dueDate) => {
      const scope = flock ? `flock:${flock.id}` : 'farm';
      const slot = `${template.code}|${scope}|${dueDate}|${template.occurrence}`;
      const version = template.milestone && flock ? flockModel.milestoneVersion(flock.id, template.milestone) : 0;
      if (version > 0 && taskModel.existsActiveForSlot(farm.id, slot)) return;
      const result = taskModel.createGenerated({
        farmId: farm.id,
        flockId: flock ? flock.id : null,
        title: template.title,
        description: descriptionFor(template, flock ? flock.poultryType : farm.poultryType),
        dueDate,
        templateCode: template.code,
        frequency: template.frequency,
        timeSlot: template.timeSlot,
        occurrence: template.occurrence,
        generationKey: `${slot}|v${version}`,
      });
      if (result.created) created += 1;
    };

    for (const flock of flocks) {
      for (const template of TASK_TEMPLATES) {
        if (template.scope !== 'flock') continue;
        const dueDate = flockDueDate(template, flock, date);
        if (dueDate && applies(template, flock, dueDate)) add(template, flock, dueDate);
      }
    }
    if (flocks.length > 0) {
      for (const template of TASK_TEMPLATES) {
        if (template.scope !== 'farm') continue;
        if (template.frequency === 'daily') add(template, null, date);
        else if (template.frequency === 'weekly' && template.schedule.weekday === 'monday') add(template, null, mondayOf(date));
      }
    }
    return created;
  });
}

function createCleanOutTask(farm, flock, closureDate) {
  const template = TASK_TEMPLATES.find((t) => t.code === 'TP-13');
  return taskModel.createGenerated({
    farmId: farm.id,
    flockId: null,
    title: `${template.title} (after flock "${flock.name}")`,
    description: template.description,
    dueDate: closureDate,
    templateCode: template.code,
    frequency: template.frequency,
    timeSlot: template.timeSlot,
    occurrence: 1,
    generationKey: `TP-13|farm|after-flock:${flock.id}|1|v0`,
  }).task;
}

const generateDailyTasks = generateTasks;

module.exports = { generateTasks, generateDailyTasks, createCleanOutTask, applies, flockAgeDaysOn, flockDueDate, mondayOf };
