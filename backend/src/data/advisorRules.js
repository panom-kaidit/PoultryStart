// Rules of the rule-based Poultry Advisor :

const PRIORITIES = Object.freeze(['urgent', 'important', 'routine', 'info']);
const ALL_ROLES = Object.freeze(['owner', 'manager', 'worker']);

// The exact limitation in every Advisor response (approved).
const ADVISOR_LIMITATION = 'This Advisor only evaluates information recorded in PoultryStart. No alert does not mean ' +
  'your flock is healthy or that there is no problem.';

const PROFESSIONAL_HELP = 'PoultryStart cannot tell why. Contact your veterinarian or extension officer straight away. ' +
  'PoultryStart does not diagnose disease or recommend treatment.';
const DESIGN_RULE = 'PoultryStart design rule (planning definition), not a veterinary threshold or a diagnosis.';
const MONITORING_PROMPT = 'PoultryStart monitoring prompt, not a biological standard or proof of a problem.';

// Guidance articles for a flock's stage (approved stages; catalogue revision 4).
const STAGE_GUIDANCE = Object.freeze({
  broiler: {
    brooding: ['G-BR-BROOD-01', 'G-ALL-BROOD-02'],
    growing: ['G-BR-FEED-01', 'G-ALL-FLOCK-01'],
    sale: ['G-BR-FLOCK-01', 'G-ALL-HEALTH-04'],
  },
  layer: {
    brooding: ['G-LY-BROOD-01', 'G-ALL-BROOD-02'],
    rearing: ['G-LY-FEED-01', 'G-LY-HOUSE-01'],
    pre_lay: ['G-LY-HOUSE-01', 'G-LY-FLOCK-03'],
    laying: ['G-LY-FLOCK-03', 'G-LY-FEED-02'],
  },
});

// Guidance for readiness areas needing attention.
const AREA_GUIDANCE = Object.freeze({
  housing: () => ['G-ALL-PREP-03', 'G-ALL-HOUSE-01'],
  equipment: (type) => [type === 'layer' ? 'G-LY-PREP-01' : 'G-BR-PREP-01'],
  feed: (type) => [type === 'layer' ? 'G-LY-FEED-01' : 'G-BR-FEED-01', 'G-ALL-FEED-02'],
  water: () => ['G-ALL-WATER-02'],
  other: () => ['G-ALL-PREP-02'],
});

const STATUS_WORDS = Object.freeze({
  not_started: 'not started', in_progress: 'in progress', not_ready: 'not ready', ready: 'ready',
});

// ---- Target helpers (structured API information, never screen navigation) ----
const flockTarget = (ctx, flock) => ({ type: 'flock', id: flock.id, method: 'GET', path: `/api/farms/${ctx.farm.id}/flocks/${flock.id}` });
const mortalityForm = (ctx, flock) => ({
  type: 'mortality_form', flockId: flock.id, method: 'POST', path: `/api/farms/${ctx.farm.id}/flocks/${flock.id}/movements`,
  permission: 'flocks:record_mortality',
});
const recordForm = (ctx, flock, kind) => ({
  type: 'record_form', recordType: kind, flockId: flock.id, method: 'POST',
  path: `/api/farms/${ctx.farm.id}/flocks/${flock.id}/records/${kind}`, permission: 'production:create',
});
const observationTarget = (ctx, flock, o) => ({
  type: 'health_observation', id: o.id, flockId: flock.id, method: 'GET',
  path: `/api/farms/${ctx.farm.id}/flocks/${flock.id}/records/health/${o.id}`, permission: 'health:view',
});
const taskTarget = (ctx, t) => ({ type: 'task', id: t.id, method: 'GET', path: `/api/farms/${ctx.farm.id}/tasks/${t.id}`, permission: 'tasks:view' });
const flockUpdate = (ctx, flock) => ({
  type: 'flock_update', id: flock.id, method: 'PATCH', path: `/api/farms/${ctx.farm.id}/flocks/${flock.id}`, permission: 'flocks:manage',
});
const readinessTarget = (ctx) => ({ type: 'readiness', method: 'GET', path: `/api/farms/${ctx.farm.id}/readiness`, permission: 'readiness:manage' });
const PATHS = { weight: 'weights', eggs: 'eggs', health: 'health' };
const recordTarget = (ctx, flock, w) => ({
  type: w.recordType === 'health' ? 'health_observation' : 'production_record', recordType: w.recordType, id: w.id, flockId: flock.id,
  method: 'GET', path: `/api/farms/${ctx.farm.id}/flocks/${flock.id}/records/${PATHS[w.recordType]}/${w.id}`,
  permission: w.recordType === 'health' ? 'health:view' : 'production:view',
});

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const active = (ctx) => ctx.flocks.filter((f) => f.status === 'active');

// ---------------------------------------------------------------------------
const RULES = [
  // ===== Professional help (PoultryStart design rules, approved GD6) =====
  {
    code: 'AR-01', priority: 'urgent', kind: 'professional_help', roles: ALL_ROLES, labels: ['PD'],
    basis: `Deaths recorded on at least 2 of the last 3 days (today and the 2 days before, Uganda dates). ${DESIGN_RULE}`,
    evaluate: (ctx) => active(ctx).filter((f) => f.deathDays.length >= 2).map((f) => ({
      flockId: f.id,
      title: `Deaths on ${f.deathDays.length} of the last 3 days: ${f.name}`,
      message: `Deaths were recorded for ${f.name} on ${f.deathDays.length} of the last 3 days (${f.deathDays.join(', ')}). ` +
        PROFESSIONAL_HELP,
      nextStep: 'Contact your veterinarian or extension officer straight away, and keep recording deaths in the mortality form.',
      facts: { deathDays: f.deathDays, birdsDiedInLast3Days: f.deathsLast3Days },
      guidance: ['G-ALL-HEALTH-02'],
      targets: [flockTarget(ctx, f), mortalityForm(ctx, f)],
    })),
  },
  {
    code: 'AR-02', priority: 'urgent', kind: 'professional_help', roles: ALL_ROLES, labels: ['PD'],
    basis: 'Deaths recorded in the last 3 days together with a health observation dated in the last 3 days (shown only ' +
      `when AR-01 does not already apply to the flock). ${DESIGN_RULE}`,
    evaluate: (ctx) => active(ctx)
      .filter((f) => f.deathDays.length >= 1 && f.deathDays.length < 2 && f.observationsLast3Days.length > 0)
      .map((f) => ({
        flockId: f.id,
        title: `Deaths and a health observation recorded: ${f.name}`,
        message: `Deaths were recorded for ${f.name} in the last 3 days, and ${plural(f.observationsLast3Days.length, 'health observation')} ` +
          `${f.observationsLast3Days.length === 1 ? 'was' : 'were'} recorded in the same period. ${PROFESSIONAL_HELP}`,
        nextStep: 'Contact your veterinarian or extension officer straight away.',
        facts: { deathDays: f.deathDays, observationDates: f.observationsLast3Days.map((o) => o.observationDate) },
        guidance: ['G-ALL-HEALTH-02'],
        targets: [flockTarget(ctx, f), ...f.observationsLast3Days.map((o) => observationTarget(ctx, f, o))],
      })),
  },
  {
    code: 'AR-03', priority: 'important', kind: 'review', roles: ALL_ROLES, labels: ['PD'],
    basis: 'A health observation dated in the last 7 days with no vet or extension officer contact recorded. A review ' +
      `reminder, not an emergency warning. The observation text is never read. ${DESIGN_RULE}`,
    evaluate: (ctx) => active(ctx).filter((f) => f.observationsWithoutContact.length > 0).map((f) => ({
      flockId: f.id,
      title: `Review recent health observations: ${f.name}`,
      message: `${plural(f.observationsWithoutContact.length, 'health observation')} for ${f.name} in the last 7 days ` +
        `${f.observationsWithoutContact.length === 1 ? 'has' : 'have'} no vet or extension officer contact recorded. Review ` +
        `${f.observationsWithoutContact.length === 1 ? 'it' : 'them'}. If birds are sick or dying, or you are worried, contact ` +
        'your veterinarian or extension officer.',
      nextStep: 'Review the observations and record any vet or extension officer contact with a correction (owner or manager).',
      facts: { observationDates: f.observationsWithoutContact.map((o) => o.observationDate) },
      guidance: ['G-ALL-HEALTH-02', 'G-ALL-HEALTH-01'],
      targets: f.observationsWithoutContact.map((o) => observationTarget(ctx, f, o)),
    })),
  },

  // ===== Records and tasks =====
  {
    code: 'AR-30', priority: 'important', kind: 'tasks', roles: ALL_ROLES, labels: ['PG'],
    basis: 'Daily tasks due in the last 7 days that were missed (as shown in your task list). PoultryStart practice suggestion.',
    evaluate: (ctx) => (ctx.tasks.missed.length === 0 ? [] : [{
      flockId: null,
      title: `${plural(ctx.tasks.missed.length, 'daily task')} missed in the last 7 days`,
      message: `${plural(ctx.tasks.missed.length, 'daily task')} due in the last 7 days ${ctx.tasks.missed.length === 1 ? 'was' : 'were'} not ` +
        'completed. Check that the daily routine is being followed.',
      nextStep: 'Review the daily routine; an owner or manager can add review notes to missed tasks.',
      facts: { missedTasks: ctx.tasks.missed.length },
      guidance: [ctx.farm.poultryType === 'layer' ? 'G-LY-DAILY-01' : 'G-BR-DAILY-01'],
      targets: ctx.tasks.missed.slice(0, 5).map((t) => taskTarget(ctx, t)),
    }]),
  },
  {
    code: 'AR-31', priority: 'important', kind: 'tasks', roles: ALL_ROLES, labels: ['PG'],
    basis: 'Tasks that are overdue (as shown in your task list). PoultryStart practice suggestion.',
    evaluate: (ctx) => (ctx.tasks.overdue.length === 0 ? [] : [{
      flockId: null,
      title: `${plural(ctx.tasks.overdue.length, 'task')} overdue`,
      message: `${plural(ctx.tasks.overdue.length, 'task')} ${ctx.tasks.overdue.length === 1 ? 'is' : 'are'} overdue. They can still be completed.`,
      nextStep: 'Open the overdue tasks and complete them.',
      facts: { overdueTasks: ctx.tasks.overdue.length },
      guidance: [],
      targets: ctx.tasks.overdue.slice(0, 5).map((t) => taskTarget(ctx, t)),
    }]),
  },
  {
    code: 'AR-32', priority: 'important', kind: 'review', roles: ['owner', 'manager'], labels: ['PG'],
    basis: 'Tasks due in the last 7 days completed with a reported problem. The notes are never read by the Advisor. ' +
      'PoultryStart practice suggestion.',
    evaluate: (ctx) => (ctx.tasks.problems.length === 0 ? [] : [{
      flockId: null,
      title: `${plural(ctx.tasks.problems.length, 'reported problem')} on completed tasks`,
      message: `${plural(ctx.tasks.problems.length, 'task')} completed in the last 7 days ${ctx.tasks.problems.length === 1 ? 'has' : 'have'} ` +
        'a problem reported. Read the notes and decide what to do.',
      nextStep: 'Open each task, read the problem notes, and add a review note.',
      facts: { tasksWithProblems: ctx.tasks.problems.length },
      guidance: [],
      targets: ctx.tasks.problems.slice(0, 5).map((t) => taskTarget(ctx, t)),
    }]),
  },
  {
    code: 'AR-43', priority: 'important', kind: 'review', roles: ALL_ROLES, labels: ['PD'],
    basis: 'Weight or egg records, or health observations, from the last 31 days that are above the birds the flock\'s ' +
      'movements now show on their date (usually after a backdated movement). The records are never changed.',
    evaluate: (ctx) => active(ctx).filter((f) => f.populationWarnings.length > 0).map((f) => ({
      flockId: f.id,
      title: `Records above the flock's bird count: ${f.name}`,
      message: `${plural(f.populationWarnings.length, 'record')} for ${f.name} count more birds than the flock's movements now ` +
        'show on that date. A later backdated movement may explain it. Check the records and the movements.',
      nextStep: 'Check each record and the bird movements; an owner or manager can correct either.',
      facts: { records: f.populationWarnings.map((w) => ({ recordType: w.recordType, id: w.id, date: w.date })) },
      guidance: [],
      targets: f.populationWarnings.slice(0, 5).map((w) => recordTarget(ctx, f, w)),
    })),
  },
  ...['feed', 'water', 'eggs'].map((kind, i) => ({
    code: `AR-4${i}`, priority: 'routine', kind: 'monitoring', roles: ALL_ROLES, labels: ['PD'],
    basis: `No ${kind === 'eggs' ? 'egg' : kind} record on either of the last 2 full days (yesterday and the day before, Uganda ` +
      `dates), counted only from the flock's arrival${kind === 'eggs' ? ' and only from its recorded first-egg date (layers)' : ''}. ` +
      MONITORING_PROMPT,
    evaluate: (ctx) => active(ctx).filter((f) => f.recordGaps[kind]).map((f) => ({
      flockId: f.id,
      title: `No ${kind === 'eggs' ? 'egg' : kind} records for 2 days: ${f.name}`,
      message: `No ${kind === 'eggs' ? 'egg collection' : kind === 'feed' ? 'feed' : 'drinking-water'} records were entered for ` +
        `${f.name} on ${ctx.d2} or ${ctx.d1}. This is a reminder to keep records, not a sign of a problem.`,
      nextStep: `Enter the ${kind === 'eggs' ? 'egg collection' : kind === 'feed' ? 'feed' : 'drinking-water'} records for those days if you have them.`,
      facts: { daysWithoutRecords: [ctx.d2, ctx.d1] },
      guidance: kind === 'feed'
        ? [f.poultryType === 'layer' ? 'G-LY-FEED-02' : 'G-BR-FEED-01']
        : kind === 'water' ? [f.poultryType === 'layer' ? 'G-LY-WATER-01' : 'G-BR-WATER-01'] : ['G-LY-FLOCK-03'],
      targets: [recordForm(ctx, f, kind)],
    })),
  })),

  // ===== Readiness (owner: details; manager: status only; worker: none) =====
  {
    code: 'AR-10', priority: (m) => (m.facts.status === 'not_ready' ? 'important' : 'routine'), kind: 'readiness', roles: ['owner'],
    labels: ['UG', 'PD'],
    basis: 'The farm has no active flock and its latest readiness assessment is not "ready" (its saved status).',
    evaluate: (ctx) => {
      const r = ctx.readiness;
      if (!ctx.farmScope || ctx.hasActiveFlocks || !r || r.savedStatus === 'ready') return [];
      const areas = r.summary.areasNeedingAttention;
      return [{
        flockId: null,
        title: `Farm readiness: ${STATUS_WORDS[r.savedStatus]}`,
        message: `Your latest readiness assessment is ${STATUS_WORDS[r.savedStatus]}.` +
          (areas.length > 0 ? ` Areas needing attention: ${areas.join(', ')}.` : ''),
        nextStep: 'Open the readiness assessment and work through the questions and checklist.',
        facts: {
          status: r.savedStatus,
          areasNeedingAttention: areas,
          unansweredRequiredQuestions: r.summary.unansweredRequired.length,
          answersNeedingAttention: r.summary.needsAttention.length,
          missingResources: r.summary.missingResources.map((i) => i.itemName),
        },
        guidance: [...new Set(areas.flatMap((a) => (AREA_GUIDANCE[a] ? AREA_GUIDANCE[a](ctx.farm.poultryType) : [])))],
        targets: [readinessTarget(ctx)],
      }];
    },
  },
  {
    code: 'AR-11', priority: 'routine', kind: 'readiness', roles: ['owner'], labels: ['PD'],
    basis: 'The farm has no flock and no readiness assessment yet.',
    evaluate: (ctx) => (!ctx.farmScope || ctx.flocks.length > 0 || ctx.readiness ? [] : [{
      flockId: null,
      title: 'Start the readiness assessment',
      message: 'Before your first birds arrive, the readiness assessment checks your house, equipment, feed and water.',
      nextStep: 'Start a readiness assessment.',
      facts: {},
      guidance: [ctx.farm.poultryType === 'layer' ? 'G-LY-PREP-01' : 'G-BR-PREP-01', 'G-ALL-PREP-03'],
      targets: [{ ...readinessTarget(ctx), type: 'readiness_start', method: 'POST' }],
    }]),
  },
  {
    code: 'AR-12', priority: 'important', kind: 'readiness', roles: ['owner'], labels: ['UG', 'PD'],
    basis: 'The latest readiness assessment\'s space check shows too many planned birds for the house, or the house is not built.',
    evaluate: (ctx) => {
      const space = ctx.readiness?.summary.spaceCheck;
      if (!ctx.farmScope || ctx.hasActiveFlocks || !space || !['above_capacity', 'house_not_built'].includes(space.status)) return [];
      return [{
        flockId: null,
        title: space.status === 'house_not_built' ? 'The house is not built yet' : 'Too many planned birds for the house',
        message: space.message,
        nextStep: 'Keep fewer birds, make the house bigger, or split batches, then update the farm details.',
        facts: { spaceCheck: space.status },
        guidance: ['G-ALL-PREP-03', 'G-ALL-HOUSE-01'],
        targets: [readinessTarget(ctx)],
      }];
    },
  },
  {
    code: 'AR-13', priority: 'info', kind: 'readiness', roles: ['manager'], labels: ['PD'],
    basis: 'Readiness status only: the details are for the farm owner.',
    evaluate: (ctx) => {
      if (!ctx.farmScope || ctx.hasActiveFlocks) return [];
      const status = ctx.readiness ? ctx.readiness.savedStatus : 'not_started';
      return [{
        flockId: null,
        title: `Farm readiness: ${STATUS_WORDS[status]}`,
        message: `The farm's readiness assessment is ${STATUS_WORDS[status]}. The owner can see the details.`,
        nextStep: 'Ask the owner about anything still to prepare.',
        facts: { status },
        guidance: [],
        targets: [],
      }];
    },
  },

  // ===== Stage guidance and missing information =====
  {
    code: 'AR-20', priority: 'routine', kind: 'stage_guidance', roles: ALL_ROLES, labels: ['PD'],
    basis: 'The flock\'s production stage, from its age (PoultryStart\'s approved stage definitions).',
    evaluate: (ctx) => active(ctx).filter((f) => STAGE_GUIDANCE[f.poultryType][f.stage]).map((f) => ({
      flockId: f.id,
      title: `${f.name}: ${f.stageLabel}`,
      // A stage defined by PoultryStart (the broiler sale stage) is explained with its PD qualification.
      message: `${f.name} is ${f.ageWeeks === 0 ? `${f.ageDays} days` : `in week ${f.ageWeeks} (age day ${f.ageDays})`}: ` +
        `${f.stageLabel}${f.stageQualification ? ` (${f.stageQualification.qualification})` : ''}. ` +
        'These guidance articles cover this stage.',
      nextStep: 'Read the guidance for this stage.',
      facts: {
        stage: f.stage, ageDays: f.ageDays, ageWeeks: f.ageWeeks,
        ...(f.stageQualification ? { stageMarker: f.stageQualification.marker, stageQualification: f.stageQualification.qualification } : {}),
      },
      guidance: STAGE_GUIDANCE[f.poultryType][f.stage],
      targets: [flockTarget(ctx, f)],
    })),
  },
  {
    code: 'AR-21', priority: 'info', kind: 'missing_information', roles: ALL_ROLES, labels: ['PD'],
    basis: 'A layer flock from week 18 (the approved first-egg check age) with no first-egg date recorded.',
    evaluate: (ctx) => active(ctx)
      .filter((f) => f.poultryType === 'layer' && !f.firstEggDate && f.ageWeeks >= ctx.constants.firstEggCheckWeek)
      .map((f) => ({
        flockId: f.id,
        title: `First-egg date not recorded: ${f.name}`,
        message: `${f.name} is in week ${f.ageWeeks}. When the first eggs are found, the owner or a manager records the ` +
          'first-egg date, so egg collection tasks and records can start.',
        nextStep: 'Check the nests and floor for eggs; tell the owner or a manager when you find the first one.',
        facts: { ageWeeks: f.ageWeeks },
        guidance: ['G-LY-FLOCK-03'],
        targets: [flockUpdate(ctx, f)],
      })),
  },
  {
    code: 'AR-22', priority: 'info', kind: 'missing_information', roles: ALL_ROLES, labels: ['PD'],
    basis: 'A broiler flock from the finisher feed check (approved task TP-03 age) with no expected sale date recorded.',
    evaluate: (ctx) => active(ctx)
      .filter((f) => f.poultryType === 'broiler' && !f.expectedSaleDate && f.ageDays >= ctx.constants.finisherCheckDay)
      .map((f) => ({
        flockId: f.id,
        title: `Expected sale date not recorded: ${f.name}`,
        message: `${f.name} is ${f.ageDays} days old and has no expected sale date. Recording one lets PoultryStart show ` +
          'the sale preparation tasks in time.',
        nextStep: 'The owner or a manager records an expected sale date on the flock.',
        facts: { ageDays: f.ageDays },
        guidance: ['G-BR-FLOCK-01'],
        targets: [flockUpdate(ctx, f)],
      })),
  },
  {
    code: 'AR-23', priority: 'routine', kind: 'stage_guidance', roles: ALL_ROLES, labels: ['UG', 'INT'],
    basis: 'A flock closed in the last 7 days (the approved one-off task window).',
    evaluate: (ctx) => ctx.flocks.filter((f) => f.status === 'closed' && f.closedDate && f.closedDate >= ctx.closedSince).map((f) => ({
      flockId: f.id,
      title: `Clean and rest the house: ${f.name}`,
      message: `${f.name} was closed on ${f.closedDate}. Clean the house in 7 steps and rest it before new birds arrive.`,
      nextStep: 'Follow the cleaning steps; the clean-out task is in the task list.',
      facts: { closedOn: f.closedDate },
      guidance: ['G-ALL-HYG-02'],
      targets: [flockTarget(ctx, f)],
    })),
  },
];

module.exports = {
  RULES, PRIORITIES, ADVISOR_LIMITATION, STAGE_GUIDANCE, AREA_GUIDANCE, PROFESSIONAL_HELP, DESIGN_RULE, MONITORING_PROMPT,
};
