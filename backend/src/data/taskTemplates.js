// Defines the daily task templates and their record links.
const { NEEDED_BY } = require('./readinessContent');

const PRACTICE = 'PoultryStart practice guidance';
const INTERNATIONAL = 'International guidance';

const SOURCE_TYPES = Object.freeze({
  UG: { label: 'Uganda official source',
    explanation: 'From the Ministry of Agriculture (MAAIF 2019 or MAAIF/ILRI 2023) training manuals for Uganda.' },
  SUP: { label: 'Ugandan supplier guidance',
    explanation: 'From a Ugandan chick supplier (for example Ugachick). Follow your own supplier where it differs.' },
  INT: { label: INTERNATIONAL,
    explanation: 'From an international breeder guide or standard (for example Ross, Aviagen, Hy-Line, Hendrix or WOAH). ' +
      'It is not a Ugandan standard; follow your supplier or local advice where it differs.' },
  PD: { label: 'PoultryStart planning definition',
    explanation: 'A planning rule chosen for PoultryStart (for example the week a task appears). It is not a standard.' },
  PG: { label: PRACTICE,
    explanation: 'A sensible routine suggested by PoultryStart. No source for it was found in the research report.' },
});

const RECORD_LINKS = Object.freeze({
  flock_mortality: { available: true, label: "The flock's mortality form", path: 'movements' },
  flock_sale: { available: true, label: "The flock's 'sold' form", path: 'movements' },
  flock_correction: { available: true, label: "A correction of the flock's bird numbers", path: 'movements' },
  weight_records: { available: true, label: 'Bird weight records', path: 'records/weights', recordType: 'weight' },
  egg_records: { available: true, label: 'Egg collection records', path: 'records/eggs', recordType: 'eggs' },
  feed_records: { available: true, label: 'Feed consumption records', path: 'records/feed', recordType: 'feed' },
  water_records: { available: true, label: 'Drinking-water consumption records', path: 'records/water', recordType: 'water' },
  health_records: { available: true, label: 'Health observations', path: 'records/health', recordType: 'health',
    message: 'Record an observation only if you noticed something unusual. None is needed when the birds look normal.' },
  expenses: { available: true, label: 'Expenses', farmPath: 'expenses', recordType: 'expenses', permission: 'expenses:view',
    message: 'Record an expense only if something was bought or paid. None is needed to complete this task.' },
});

const BROODING_DAYS = Object.freeze({ broiler: { from: 0, to: 13 }, layer: { from: 0, to: 48 } });

const FIRST_EGG_CHECK_FROM_WEEK = NEEDED_BY.before_first_egg.ageWeeks;

const ONCE_WINDOW_DAYS = 7;

const EGG_STORAGE_GAP = 'No verified Ugandan egg-storage standard is included in PoultryStart guidance. Ask your district ' +
  'veterinary officer or the Uganda National Bureau of Standards (UNBS) about storage and grading requirements.';
const EGG_COLLECTION = 'Collect eggs from the nests and the floor. Keep floor eggs and cracked or dirty eggs separate. ' +
  `${EGG_STORAGE_GAP} Research advises collecting at least 2–3 times a day.`;
const EGG_STORAGE_BASIS = 'Storage: no verified Ugandan standard (§19).';
const FEED_SCHEDULES_DIFFER = 'Feed schedules differ between sources; follow your feed supplier\'s schedule. If you have none, ' +
  'PoultryStart follows MAAIF.';

const TEMPLATES = [
  {
    code: 'TD-01', scope: 'flock', frequency: 'daily', timeSlot: 'morning', title: 'Morning flock check',
    description: 'Before feeding or cleaning, quietly watch the birds. Are they active, eating, drinking and breathing ' +
      'normally, and spread out? Brooding chicks: huddling under the heat means too cold; panting means too hot; ' +
      'crowding on one side means a draught. Report anything unusual.',
    basis: 'Observation: Evidence-Based Report §13.4. Chick signs: §7.3 (Ross, Hy-Line; qualitative). "Before disturbing them": practice guidance.',
    sources: ['INT', 'PG'], applies: {},
  },
  {
    code: 'TD-02', recordLinks: ['feed_records'], scope: 'flock', frequency: 'daily', timeSlot: 'morning', title: 'Feed check',
    description: 'Check the feeders, give feed, and make sure the feed is dry and not mouldy. In hot weather, feed in ' +
      'the cooler hours (before 11:00 and after 16:00).',
    basis: 'Report §13.4. Hot-weather hours: Aviagen 2016, Hendrix (international). "Not mouldy": practice guidance.',
    sources: ['INT', 'PG'], applies: {},
  },
  {
    code: 'TD-03', recordLinks: ['water_records'], scope: 'flock', frequency: 'daily', timeSlot: 'morning', title: 'Water and drinkers check',
    description: 'Check every drinker has clean water and works. Clean dirty drinkers. Keep stored water covered and shaded.',
    basis: 'Report §13.4. Stored water: Aviagen (international), §10.3. Daily cleaning: practice guidance.',
    sources: ['INT', 'PG'], applies: {},
  },
  {
    code: 'TD-04', recordLinks: ['flock_mortality'], scope: 'flock', frequency: 'daily', timeSlot: 'morning', title: 'Dead birds',
    description: 'Walk the whole house, remove any dead birds, put them in the disposal pit or compost, and wash your ' +
      "hands. Then record the number in the flock's mortality form; this task does not record it.",
    basis: 'Disposal pit: MAAIF/ILRI 2023. Mortality records: WOAH (international), report §12. Daily removal: practice guidance.',
    sources: ['UG', 'INT', 'PG'], applies: {},
  },
  {
    code: 'TD-05', scope: 'flock', frequency: 'daily', timeSlot: 'midday', title: 'Litter inspection',
    description: 'Look at the litter. Is it dry and loose, or are there wet or caked patches (often near drinkers)? ' +
      'Report patches that need attention; turning them is a separate task.',
    basis: 'Litter condition: MAAIF/ILRI 2023, Aviagen (international). Daily inspection: practice guidance.',
    sources: ['UG', 'INT', 'PG'], applies: {},
  },
  {
    code: 'TD-06', scope: 'flock', frequency: 'daily', timeSlot: 'midday', title: 'Midday house check',
    description: 'Check that feed and water are still easy to reach, no drinkers leak, and the equipment works. ' +
      'After brooding: panting or spread wings means too hot, huddling means too cold; open or close curtains for ' +
      'fresh air without draughts.',
    basis: 'Heat stress: report T6. Adult comfort: Hendrix (international). The re-check: practice guidance.',
    sources: ['INT', 'PG'], applies: {},
  },
  {
    code: 'TD-10', recordLinks: ['feed_records', 'water_records', 'flock_mortality', 'egg_records', 'health_records'], scope: 'flock', frequency: 'daily', timeSlot: 'evening', title: 'Evening records review',
    description: "Check that today's records have been entered: feed and water (and health notes), deaths in the " +
      "flock's mortality form, and for laying flocks today's egg record. This task records nothing itself; if " +
      'something is missing, open that form.',
    basis: 'Daily records: report §12 (T6), WOAH (international). Review step: practice guidance.',
    sources: ['INT', 'PG'], applies: {},
  },

  {
    code: 'TD-08', scope: 'farm', frequency: 'daily', timeSlot: 'morning', title: 'Footbath and house boots',
    description: 'Check the footbath at the house door has disinfectant. Use house-only boots and clothing.',
    basis: 'Footbath and boots: MAAIF/ILRI 2023, WOAH (international). Daily refresh: practice guidance.',
    sources: ['UG', 'INT', 'PG'], applies: {},
  },
  {
    code: 'TD-09', scope: 'farm', frequency: 'daily', timeSlot: 'evening', title: 'Evening farm check',
    description: 'Enough water for the night; doors, gate and fence closed; no predators; lights set as planned. ' +
      "Laying flocks: never shorten the day length (international guidance). Follow your supplier's lighting plan " +
      'for your strain; PoultryStart does not provide a universal lighting programme.',
    basis: 'Practice guidance. Laying-flock lighting: Hy-Line (international), strain-specific.',
    sources: ['INT', 'PG'], applies: {},
  },

  {
    code: 'TB-01', recordLinks: ['flock_correction'], scope: 'flock', frequency: 'once', timeSlot: 'morning', title: 'Receive and inspect chicks',
    description: 'Count the chicks and check they are lively, with healed navels and straight legs. Keep the hatchery ' +
      'vaccination certificate. If the count differs from the delivery note, record a correction on the flock.',
    basis: 'Ugachick 2021 (supplier), Ross (international), report §11.1. Certificate: §11.2.',
    sources: ['SUP', 'INT'],
    schedule: { atArrival: true, windowDays: 1 }, applies: { brooding: true },
  },
  {
    code: 'TB-02', scope: 'flock', frequency: 'once', timeSlot: 'morning', title: 'First 24 hours: water and feed',
    description: 'Have clean drinking water ready for newly arrived chicks. Ask your chick supplier or extension officer ' +
      'how to give water to newly arrived chicks. Spread feed on paper or trays so the chicks find it at once.',
    basis: 'Water: PoultryStart gives no temperature or quantity for newly arrived chicks; ask the chick supplier or ' +
      'extension officer. Feed on paper or trays: Ross 2025 (international), report §7.1. First 24 hours only.',
    sources: ['PG', 'INT'], schedule: { atArrival: true, windowDays: 1 }, applies: { brooding: true },
  },
  {
    code: 'TB-03', scope: 'flock', frequency: 'once', timeSlot: 'midday', title: 'Crop-fill check',
    description: 'Gently feel the crops of some chicks; most should be full of feed (international guide: 75% at 2 hours, ' +
      'over 95% at 24 hours).',
    basis: 'Ross 2025 (international).',
    sources: ['INT'], schedule: { atAgeDays: 1, windowDays: 1 }, applies: { poultryTypes: ['broiler'], brooding: true },
  },
  {
    code: 'TB-05', scope: 'flock', frequency: 'daily', timeSlot: 'morning', title: 'Morning brooder temperature',
    description: "Read the thermometer at chick height and compare it with the brooding temperature for your chicks' " +
      'age in your supplier\'s brooding temperature guide (broiler and layer schedules are separate; PoultryStart does ' +
      'not yet provide its own temperature schedule). Keep some fresh air even when warm.',
    basis: 'Report §7.2: MAAIF 2019 Table 30, Ross, Hy-Line (international). Ventilation: Ross (international).',
    sources: ['UG', 'INT'], applies: { brooding: true },
  },
  {
    code: 'TB-04', scope: 'flock', frequency: 'daily', timeSlot: 'evening', title: 'Evening brooder check',
    description: {
      broiler: "Check the chicks' comfort signs again. Check the heater has fuel or charcoal for the night, is away " +
        "from litter, and there's no smoke. Days 0–7: follow your supplier's lighting plan (international guidance " +
        '(Ross): almost continuous light at first, then a few hours of darkness each night by day 7).',
      layer: "Check the chicks' comfort signs again. Check the heater has fuel or charcoal for the night, is away " +
        "from litter, and there's no smoke.",
    },
    basis: 'Comfort: report §7.3. Heater safety: practice guidance. Broiler lighting: Ross (international).',
    sources: ['INT', 'PG'], applies: { brooding: true },
  },
  {
    code: 'TB-07', scope: 'flock', frequency: 'interval', timeSlot: 'any', title: 'Brooder space',
    description: 'Make the brooder area bigger as the chicks grow. Default: keep chicks in the brooder about 2 weeks, ' +
      'then open the house.',
    basis: 'MAAIF §4.5 (about 2 weeks); Aviagen (international, faster option). Every 3 days: practice guidance.',
    sources: ['UG', 'INT', 'PG'], schedule: { everyDays: 3, startDay: 3 }, applies: { brooding: true },
  },

  {
    code: 'TI-01', scope: 'flock', frequency: 'interval', timeSlot: 'any', title: 'Turn wet or caked litter',
    description: "Turn any wet or caked patches found during the litter inspections. If there are none, complete it " +
      "with the note 'not needed'.",
    basis: 'MAAIF/ILRI 2023, Aviagen (international): every 2–3 days. Every 3 days: practice guidance (approved R1).',
    sources: ['UG', 'INT', 'PG'], schedule: { everyDays: 3, startDay: 3 }, applies: {},
  },
  {
    code: 'TW-07', scope: 'flock', frequency: 'interval', timeSlot: 'any', title: 'Litter top-up',
    description: 'Add fresh litter to build it up towards about 15 cm.',
    basis: 'MAAIF/ILRI 2023: top up every 2–3 weeks, build to about 15 cm. Every 2 weeks: practice guidance.',
    sources: ['UG', 'PG'], schedule: { everyDays: 14, startDay: 14 }, applies: {},
  },

  {
    code: 'TL-03', scope: 'flock', frequency: 'once', timeSlot: 'any', title: 'Lighting before laying',
    description: "Ask your supplier for your strain's lighting plan. Light is usually increased when the birds reach a " +
      'target weight (international guidance, Hy-Line Brown: about 1,350 g). Once laying, never shorten the day length.',
    basis: 'Hy-Line (international); strain-specific.',
    sources: ['INT'], milestone: 'first_egg_date',
    schedule: { atWeek: 15 }, applies: { poultryTypes: ['layer'], untilFirstEgg: true },
  },
  {
    code: 'TL-01', scope: 'flock', frequency: 'once', timeSlot: 'any', title: 'Perches and adult feeder space',
    description: 'Fit perches and change feeders to adult spacing before laying.',
    basis: 'Hy-Line (international), report §14.2.',
    sources: ['INT'], milestone: 'first_egg_date',
    schedule: { atWeek: 16 }, applies: { poultryTypes: ['layer'], untilFirstEgg: true },
  },
  {
    code: 'TL-02', scope: 'flock', frequency: 'once', timeSlot: 'any', title: 'Prepare nests',
    description: 'Install nest boxes (about 1 for every 5–6 hens) with clean nesting material before the first eggs.',
    basis: 'MAAIF/ILRI 2023, Hy-Line (international), report §14.2.',
    sources: ['UG', 'INT'], milestone: 'first_egg_date',
    schedule: { atWeek: 17 }, applies: { poultryTypes: ['layer'], untilFirstEgg: true },
  },
  {
    code: 'TL-04', scope: 'flock', frequency: 'daily', timeSlot: 'midday', title: 'Check nests for first eggs',
    description: 'Look in the nests and on the floor for the first eggs. When you find one, tell the owner or manager ' +
      'so they can record the first-egg date.',
    basis: 'Week 18: approved PoultryStart planning definition; report §14.2.',
    sources: ['PD'], milestone: 'first_egg_date',
    applies: { poultryTypes: ['layer'], fromWeek: FIRST_EGG_CHECK_FROM_WEEK, untilFirstEgg: true },
  },

  {
    code: 'TE-01', recordLinks: ['egg_records'], scope: 'flock', frequency: 'daily', timeSlot: 'morning', occurrence: 1, title: 'Collect eggs (morning)',
    description: EGG_COLLECTION,
    basis: `Hy-Line (international), report §12.2, §14.2. ${EGG_STORAGE_BASIS}`,
    sources: ['INT'], milestone: 'first_egg_date',
    applies: { poultryTypes: ['layer'], requiresFirstEgg: true },
  },
  {
    code: 'TE-02', recordLinks: ['egg_records'], scope: 'flock', frequency: 'daily', timeSlot: 'midday', occurrence: 2, title: 'Collect eggs (midday)',
    description: EGG_COLLECTION,
    basis: `Hy-Line (international), report §12.2, §14.2. Third collection: approved PoultryStart decision (D-T8). ${EGG_STORAGE_BASIS}`,
    sources: ['INT', 'PD'], milestone: 'first_egg_date',
    applies: { poultryTypes: ['layer'], requiresFirstEgg: true },
  },
  {
    code: 'TE-03', recordLinks: ['egg_records'], scope: 'flock', frequency: 'daily', timeSlot: 'evening', occurrence: 3, title: 'Collect eggs (afternoon/evening) and nest care',
    description: `${EGG_COLLECTION} After the last collection, tidy the nests (dry nesting material, repair damage) ` +
      'and move birds that are sleeping in nests.',
    basis: `Collection: Hy-Line (international). Nest care: practice guidance. ${EGG_STORAGE_BASIS}`,
    sources: ['INT', 'PG'], milestone: 'first_egg_date',
    applies: { poultryTypes: ['layer'], requiresFirstEgg: true },
  },

  {
    code: 'TW-01', recordLinks: ['weight_records'], scope: 'flock', frequency: 'weekly', timeSlot: 'any', title: 'Weigh birds',
    description: 'Weigh some birds from different parts of the house and compare with last week.',
    basis: 'Ross 2025, Hy-Line (international); report equipment table: broilers from week 2, layers from week 4.',
    sources: ['INT'],
    schedule: { fromWeek: { broiler: 2, layer: 4 } }, applies: {},
  },
  {
    code: 'TW-02', recordLinks: ['feed_records', 'water_records'], scope: 'flock', frequency: 'weekly', timeSlot: 'any', title: 'Review feed and water use',
    description: "Compare this week's feed and water records with last week's.",
    basis: 'Practice guidance.',
    sources: ['PG'], schedule: { fromWeek: 1 }, applies: {},
  },
  {
    code: 'TW-04', recordLinks: ['flock_mortality', 'health_records'], scope: 'flock', frequency: 'weekly', timeSlot: 'any', title: 'Health review',
    description: "Look back at this week's deaths and notes. If deaths are rising or birds look sick, call your vet or " +
      'extension officer. PoultryStart does not diagnose disease.',
    basis: 'Practice guidance; disclaimer as in report §11.2.',
    sources: ['PG'], schedule: { fromWeek: 1 }, applies: {},
  },
  {
    code: 'TW-06', recordLinks: ['egg_records'], scope: 'flock', frequency: 'weekly', timeSlot: 'any', title: 'Egg production review',
    description: "Compare this week's egg numbers, size and quality with last week's.",
    basis: 'Practice guidance, based on Hy-Line egg records (international).',
    sources: ['PG', 'INT'], milestone: 'first_egg_date',
    schedule: { fromWeek: 1 }, applies: { poultryTypes: ['layer'], requiresFirstEgg: true },
  },
  {
    code: 'TW-03', scope: 'farm', frequency: 'weekly', timeSlot: 'any', title: 'House and biosecurity inspection',
    description: 'Fence, gate, footbath, roof, curtains, wire mesh; look for signs of rats or predators.',
    basis: 'Items: MAAIF/ILRI 2023, WOAH (international). Weekly: practice guidance.',
    sources: ['UG', 'INT', 'PG'], schedule: { weekday: 'monday' }, applies: {},
  },
  {
    code: 'TW-05', recordLinks: ['expenses'], scope: 'farm', frequency: 'weekly', timeSlot: 'any', title: 'Stock and purchases',
    description: 'Check feed, litter and disinfectant stock; order next-stage feed in time.',
    basis: 'Practice guidance; ordering ahead: report §14.1.',
    sources: ['PG'], schedule: { weekday: 'monday' }, applies: {},
  },

  {
    code: 'TP-01', recordLinks: ['expenses'], recordLinkFilters: { expenses: { category: 'feed' } }, scope: 'flock', frequency: 'once', timeSlot: 'any', title: 'Order next-stage feed',
    description: 'Make sure grower and finisher feed are ordered to arrive before they are needed.',
    basis: 'Report §14.1 pre-arrival checklist (order before day 10); no external source named: practice guidance.',
    sources: ['PG'], schedule: { atAgeDays: 3 }, applies: { poultryTypes: ['broiler'] },
  },
  {
    code: 'TP-02', scope: 'flock', frequency: 'once', timeSlot: 'any', title: 'Feed check: starter to grower',
    description: `${FEED_SCHEDULES_DIFFER} Ross (international) starts grower feed from day 11, Ugachick from week 3, ` +
      'and MAAIF keeps starter feed for the first 4 weeks.',
    basis: 'MAAIF 2019 §4.5.1, Ugachick 2021 (supplier), Ross 2025 (international); report §9.1.',
    sources: ['UG', 'SUP', 'INT'], schedule: { atAgeDays: 10 }, applies: { poultryTypes: ['broiler'] },
  },
  {
    code: 'TP-03', scope: 'flock', frequency: 'once', timeSlot: 'any', title: 'Feed check: finisher',
    description: `${FEED_SCHEDULES_DIFFER} MAAIF gives finisher feed from about week 4–5; Ross (international) from day 25.`,
    basis: 'MAAIF 2019, Ross 2025 (international); report §9.1.',
    sources: ['UG', 'INT'], schedule: { atAgeDays: 25 }, applies: { poultryTypes: ['broiler'] },
  },
  {
    code: 'TP-04', scope: 'flock', frequency: 'once', timeSlot: 'any', title: 'Medicine withdrawal check',
    description: 'If the birds were given any medicine, confirm with your vet that its withdrawal period ends before ' +
      'the sale date. PoultryStart does not give withdrawal times.',
    basis: 'Report §13.4 and §19 (MAAIF treatment guidelines, linked without values). Timing: practice guidance.',
    sources: ['UG', 'PG'], milestone: 'expected_sale_date',
    schedule: { daysBeforeSale: 14 }, applies: { poultryTypes: ['broiler'] },
  },
  {
    code: 'TP-05', scope: 'flock', frequency: 'once', timeSlot: 'any', title: 'Book buyers',
    description: 'Confirm buyers before the final week before the sale.',
    basis: 'Report §13.4 recommendation; no external source named: practice guidance.',
    sources: ['PG'], milestone: 'expected_sale_date',
    schedule: { daysBeforeSale: 7 }, applies: { poultryTypes: ['broiler'] },
  },
  {
    code: 'TP-06', scope: 'flock', frequency: 'once', timeSlot: 'any', title: 'Crates and transport',
    description: 'Arrange crates and transport for the sale day.',
    basis: 'Report T6 §12.1 (MAAIF, Ross, Aviagen).',
    sources: ['UG', 'INT'], milestone: 'expected_sale_date',
    schedule: { daysBeforeSale: 3 }, applies: { poultryTypes: ['broiler'] },
  },
  {
    code: 'TP-07', scope: 'flock', frequency: 'once', timeSlot: 'any', title: 'Lighting before catching (optional)',
    description: 'Optional, international guidance: some international guides (Ross) give 23 hours of light for the ' +
      '3 days before catching. Follow your supplier if they advise otherwise.',
    basis: 'Ross (international).',
    sources: ['INT'], milestone: 'expected_sale_date',
    schedule: { daysBeforeSale: 3 }, applies: { poultryTypes: ['broiler'] },
  },
  {
    code: 'TP-08', recordLinks: ['flock_sale'], scope: 'flock', frequency: 'once', timeSlot: 'morning', title: 'Catch and sell',
    description: "Catch the birds in the cool early morning, count them, then record the sale in the flock's 'sold' form.",
    basis: 'Report T6 §12.1 (MAAIF, Aviagen).',
    sources: ['UG', 'INT'], milestone: 'expected_sale_date',
    schedule: { daysBeforeSale: 0 }, applies: { poultryTypes: ['broiler'] },
  },

  {
    code: 'TP-09', scope: 'flock', frequency: 'once', timeSlot: 'any', title: 'Grower feed',
    description: 'Change from chick mash to grower mash around week 10 (MAAIF), or follow your supplier\'s schedule.',
    basis: 'MAAIF 2019 Table 25.',
    sources: ['UG'], schedule: { atWeek: 10 }, applies: { poultryTypes: ['layer'] },
  },
  {
    code: 'TP-11', recordLinks: ['flock_correction'], scope: 'flock', frequency: 'once', timeSlot: 'morning', title: 'Move to the laying house (if you use one)',
    description: 'Only if you move the birds to a separate laying house (otherwise cancel this task): move them between ' +
      'weeks 15 and 17, at least 2 weeks before the first eggs, early in the morning. Count the birds as they move. ' +
      'Ask your supplier or vet about vitamins before the move.',
    basis: 'Hy-Line (international), report §12.2 and §14.2.',
    sources: ['INT'], milestone: 'first_egg_date',
    schedule: { atWeek: 15 }, applies: { poultryTypes: ['layer'], untilFirstEgg: true },
  },
  {
    code: 'TP-10', scope: 'flock', frequency: 'once', timeSlot: 'any', title: 'Pre-lay feed',
    description: 'Pre-lay feed (more calcium) is given in weeks 17–19 (MAAIF). Hy-Line (international) switches by body ' +
      "weight, never before week 15. Follow your supplier's feeding programme.",
    basis: 'MAAIF 2019; Hy-Line (international); report §9.1.',
    sources: ['UG', 'INT'], milestone: 'first_egg_date',
    schedule: { atWeek: 17 }, applies: { poultryTypes: ['layer'], untilFirstEgg: true },
  },
  {
    code: 'TP-12', scope: 'flock', frequency: 'once', timeSlot: 'any', title: 'Layer feed: check your feeding programme',
    description: "Reminder: check your supplier's feeding programme and the MAAIF guidance (layer mash from about week 20 " +
      'or when laying starts) to decide when to change to layer feed. The first-egg date alone does not mean the feed ' +
      'must change now.',
    basis: 'MAAIF 2019 Table 25 (layer feed from about week 20 or 2% production); supplier programme.',
    sources: ['UG', 'SUP'], milestone: 'first_egg_date',
    schedule: { layerFeedAtWeek: 20 }, applies: { poultryTypes: ['layer'] },
  },

  {
    code: 'TP-13', scope: 'farm', frequency: 'once', timeSlot: 'any', title: 'Clean out and rest the house',
    description: 'Remove equipment and litter (to compost or a pit), wash with detergent, drain, rinse and dry, ' +
      'disinfect, then rest the house about 2 weeks before new birds (MAAIF/ILRI); Hy-Line (international) recommends ' +
      '2–4 weeks.',
    basis: 'MAAIF/ILRI 2023 7-step cleaning; Hy-Line (international); report §11.2.',
    sources: ['UG', 'INT'], schedule: { onFlockClosure: true }, applies: {},
  },
].map((t) => Object.freeze({ occurrence: 1, schedule: {}, ...t }));

const TASK_TEMPLATES = Object.freeze(TEMPLATES);
const DAILY_TEMPLATES = Object.freeze(TEMPLATES.filter((t) => t.frequency === 'daily'));

const findTemplate = (code) => TASK_TEMPLATES.find((t) => t.code === code) || null;

const templateCodesFor = (milestone) => TASK_TEMPLATES.filter((t) => t.milestone === milestone).map((t) => t.code);

const labelsOf = (template) => [
  ...(template.sources.includes('PG') ? [PRACTICE] : []),
  ...(template.sources.includes('INT') ? [INTERNATIONAL] : []),
];

module.exports = {
  TASK_TEMPLATES, DAILY_TEMPLATES, SOURCE_TYPES, RECORD_LINKS, BROODING_DAYS, FIRST_EGG_CHECK_FROM_WEEK, ONCE_WINDOW_DAYS,
  PRACTICE, INTERNATIONAL, findTemplate, templateCodesFor, labelsOf,
};
