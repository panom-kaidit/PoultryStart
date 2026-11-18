// Poultry guidance articles:
const { SOURCE_TYPES, findTemplate } = require('./taskTemplates');

const SALE_STAGE_DAYS = findTemplate('TP-04').schedule.daysBeforeSale;

const CATALOGUE = Object.freeze({ name: 'G0 Poultry Guidance catalogue', revision: 4, approvedOn: '2026-11-16' });
const REVIEWED_ON = '2026-11-16';

// Shown with every guidance response.
const GUIDANCE_DISCLAIMER = 'This is general poultry-management information for learning and planning. It does not ' +
  'replace advice from a veterinarian or extension officer. If birds are sick or dying, or you suspect a serious ' +
  'disease, contact your veterinarian or extension officer straight away.';

const TOPICS = Object.freeze({
  farm_preparation: 'Farm preparation',
  housing: 'Housing',
  feeding: 'Feeding',
  water: 'Water',
  flock_management: 'Flock management',
  hygiene: 'Hygiene and biosecurity',
  health_monitoring: 'Health monitoring',
  daily_activities: 'Daily activities',
});

const POULTRY_TYPES = Object.freeze(['broiler', 'layer', 'all']);

// Production stages 
const STAGES = Object.freeze({
  broiler: Object.freeze({
    preparation: 'Before the chicks arrive',
    brooding: 'Brooding: age days 0–13',
    growing: 'Growing: age day 14 until the sale preparations',
    sale: `Sale: from ${SALE_STAGE_DAYS} days before the expected sale date (when the sale preparation tasks start) ` +
      'until the flock is closed',
    after_flock: 'After the flock: cleaning and resting the house',
  }),
  layer: Object.freeze({
    preparation: 'Before the chicks or pullets arrive',
    brooding: 'Brooding: weeks 0–6 (age days 0–48)',
    rearing: 'Rearing: weeks 7–14',
    pre_lay: 'Pre-lay: from week 15 until the recorded first-egg date',
    laying: 'Laying: from the recorded first-egg date',
    after_flock: 'After the flock: cleaning and resting the house',
  }),
});


const STAGE_MARKERS = Object.freeze({ broiler: Object.freeze({ sale: 'PD' }) });

const EVIDENCE_LABELS = Object.freeze(['UG', 'SUP', 'INT', 'PD', 'PG']);

// Qualification markers printed beside each figure.
const MARKERS = Object.freeze({
  UG: { label: 'UG', evidence: ['UG'], qualification: null }, // Uganda official: the source is named
  'UG-R': { label: 'UG-R', evidence: ['UG'], qualification: 'Local Ugandan research (one study), not an official MAAIF standard.' },
  SUP: { label: 'SUP', evidence: ['SUP'], qualification: 'Supplier guidance from {supplier}, not a Ugandan national standard.' },
  INT: { label: 'INT', evidence: ['INT'], qualification: 'International guidance, not a Ugandan standard; may apply only to the named strain or housing system.' },
  MIX: { label: 'MIX', evidence: ['UG', 'INT'], qualification: 'Combined Ugandan and international sources; not confirmed as a Ugandan standard.' },
  PD: { label: 'PD', evidence: ['PD'], qualification: 'PoultryStart planning definition, not a published standard.' },
  PG: { label: 'PG', evidence: ['PG'], qualification: 'PoultryStart practice suggestion.' },
});

// Sources named by the articles.
const SOURCES = Object.freeze({
  REPORT: { name: 'PoultryStart Evidence-Based Farm Requirements Report (11 Nov 2026)', type: 'report' },
  POULTRYSTART: { name: 'Approved PoultryStart project decisions', type: 'PD' },
  MAAIF_2019: { name: 'MAAIF Poultry Training Manual for Extension Workers in Uganda (Aug 2019)', type: 'UG' },
  MAAIF_ILRI_2023: { name: 'MAAIF/ILRI training manual on antimicrobial use and resistance for poultry (2023), Annex 4', type: 'UG' },
  MAAIF_TREATMENT: { name: 'MAAIF Veterinary Treatment Guidelines for Common Poultry Diseases (linked, not quoted)', type: 'UG' },
  AGRIS_2022: { name: 'Peri-urban Kampala study, "Trade-offs in adoption of Poultry Technologies" (2022)', type: 'UG-R' },
  UGACHICK_2021: { name: 'Ugachick broiler brochure (2021)', type: 'SUP' },
  UGACHICK_PAGES: { name: 'Ugachick website pages (stamped 7 Apr 2026)', type: 'SUP' },
  ROSS_2025: { name: 'Aviagen, Ross Pocket Guide (2025)', type: 'INT' },
  AVIAGEN_2016: { name: 'Aviagen, open-sided house guide (2016)', type: 'INT' },
  HYLINE_STD: { name: 'Hy-Line Brown performance standards (Dec 2025)', type: 'INT' },
  HYLINE_ALT: { name: 'Hy-Line Brown alternative-systems standards (May 2026)', type: 'INT' },
  HYLINE_GUIDE: { name: 'Hy-Line online management guide', type: 'INT' },
  HYLINE_VACC: { name: 'Hy-Line vaccination recommendations technical update (2019, revised 2021)', type: 'INT' },
  HENDRIX: { name: 'Hendrix Genetics, hot and tropical climates layer guide', type: 'INT' },
  FAO_2003: { name: 'FAO Animal Production and Health Paper 159 (2003)', type: 'INT' },
  FAO_2022: { name: 'FAO, biosecurity study of Mukono and Wakiso districts, Uganda (2022)', type: 'INT' },
  FAO_REVIEW: { name: 'FAO Uganda poultry sector country review (2007/2008)', type: 'INT' },
  WOAH: { name: 'WOAH Terrestrial Code, Chapter 6.5', type: 'INT' },
});

const v = (text, marker, sources, reference, supplier) => ({ text, marker, sources, reference, supplier: supplier || null });

const ALL_BIRD_STAGES = Object.freeze({
  broiler: ['brooding', 'growing', 'sale'],
  layer: ['brooding', 'rearing', 'pre_lay', 'laying'],
});

const FIRST_DAY_WATER = 'Have clean drinking water ready for newly arrived chicks. Ask your chick supplier or extension ' +
  'officer how to give water to newly arrived chicks.';
const EGG_STORAGE_GAP = 'No verified Ugandan egg-storage standard is included in PoultryStart guidance. Ask your district ' +
  'veterinary officer or the Uganda National Bureau of Standards (UNBS) about storage and grading requirements.';
const VET_REFERRAL = 'If birds are sick or dying, or you suspect a serious disease, contact your veterinarian or extension ' +
  'officer straight away.';

// ---------------------------------------------------------------------------
// The 33 articles (catalogue revision 4), in catalogue order.
// ---------------------------------------------------------------------------
const ARTICLES = [
  // ===== Farm preparation =====
  {
    code: 'G-ALL-PREP-01', title: 'Broilers or layers: what to weigh up', topic: 'farm_preparation', poultryType: 'all',
    stages: { broiler: ['preparation'], layer: ['preparation'] },
    summary: 'The main differences that affect a first choice. There is no single right answer for every farmer.',
    steps: [
      'Compare how long each type takes before it earns income.',
      'Check you can pay for feed and care for that whole time.',
      'Consider your house, your time and local buyers.',
      'Talk to your extension officer before deciding.',
    ],
    values: [
      v('Local research context: a 2022 study of peri-urban Kampala producers recommended broilers as a starter enterprise and layers after gaining experience. It is one local study, not a rule for every farmer.',
        'UG-R', ['AGRIS_2022'], 'Report §3'),
      v('Broiler cycle: about 5 weeks on pelleted feed, or 6–7 weeks on mash.', 'SUP', ['UGACHICK_2021'], 'Report §4', 'Ugachick'),
      v('Layers lay no eggs, and so earn no egg income, for about 20 weeks.', 'UG', ['REPORT'], 'Report §13.4'),
      v('Layer feed starts at about week 20.', 'UG', ['MAAIF_2019'], 'MAAIF 2019 Table 25'),
      v('Feed before laying: about 6–6.5 kg per bird (from Hy-Line rearing totals of 5.99 kg and 6.51 kg to week 17).',
        'INT', ['HYLINE_STD', 'HYLINE_ALT'], 'Report §13.4, §9.2'),
    ],
    sourceDifferences: null,
    limits: 'No profit figures are shown (report §13.3).',
    referral: 'Talk to your extension officer before choosing.',
    evidenceLabels: ['UG', 'SUP', 'INT'],
    keywords: ['choose', 'beginner', 'broilers', 'layers', 'start', 'income'],
    related: ['G-ALL-PREP-03'],
  },
  {
    code: 'G-BR-PREP-01', title: 'Getting ready for broiler chicks', topic: 'farm_preparation', poultryType: 'broiler',
    stages: { broiler: ['preparation'] },
    summary: 'The checklist for the days before broiler chicks arrive.',
    steps: [
      'Clean, disinfect and rest the house.',
      'Spread dry litter.',
      'Set up the brooder ring and test the heater.',
      'Put a thermometer at chick height.',
      'Fill the feed trays and fonts.',
      FIRST_DAY_WATER,
      'Have starter feed on the farm.',
      'Book chicks and get the vaccination certificate.',
      'Arrange transport.',
      'Name the person who will look after the birds.',
      'Order grower and finisher feed.',
      'Save buyers\' and the vet\'s contacts.',
    ],
    values: [
      v('House rested at least 10 days before new chicks.', 'SUP', ['UGACHICK_2021'], 'Report §14.1', 'Ugachick'),
      v('House rested about 2 weeks.', 'UG', ['MAAIF_ILRI_2023'], 'Report §14.1, §11.2'),
      v('Litter 5–8 cm deep.', 'UG', ['MAAIF_ILRI_2023'], 'Report §7.1'),
      v('Heater tested at least 24 hours before arrival (derived from Aviagen 2016 and Hy-Line, international).',
        'PD', ['REPORT', 'AVIAGEN_2016', 'HYLINE_GUIDE'], 'Report §7.1'),
      v('Feed trays: 1 per 100 chicks.', 'INT', ['ROSS_2025'], 'Report §8 Table T3'),
      v('Drinker fonts: 1 per 50 chicks.', 'UG', ['MAAIF_2019'], 'MAAIF 2019 §4.4.7; report §8 Table T3'),
      v('About 40 g of feed per chick on paper.', 'INT', ['ROSS_2025'], 'Report §7.1'),
      v('Grower and finisher feed ordered to arrive before day 10.', 'PD', ['REPORT'], 'Report §14.1'),
    ],
    sourceDifferences: 'The rest period differs: at least 10 days (Ugachick) or about 2 weeks (MAAIF/ILRI). Both are shown.',
    limits: 'No first-day water figures are given: they could not be verified.',
    referral: 'Save your vet\'s contact. Ask your chick supplier or extension officer about first-day water.',
    evidenceLabels: ['UG', 'SUP', 'INT', 'PD'],
    keywords: ['checklist', 'preparation', 'chicks', 'arrival', 'brooder', 'litter'],
    related: ['G-BR-BROOD-01', 'G-ALL-PREP-02', 'G-ALL-HYG-02'],
  },
  {
    code: 'G-LY-PREP-01', title: 'Getting ready for layer chicks, and what comes later', topic: 'farm_preparation', poultryType: 'layer',
    stages: { layer: ['preparation'] },
    summary: 'The layer checklist, and the preparations needed months ahead.',
    steps: [
      `Do the same preparations as for broilers, with layer-chick equipment. ${FIRST_DAY_WATER}`,
      'Check that the vaccination certificate lists the hatchery Marek\'s vaccination.',
      'Plan grower feed, nests before the first eggs, a possible move to a laying house, and money for the time without eggs.',
    ],
    values: [
      v('Layer chick feed trays: 1 per 80 chicks.', 'INT', ['HYLINE_GUIDE'], 'Report §8 Table T3'),
      v('Marek\'s vaccination at the hatchery.', 'INT', ['HYLINE_VACC'], 'Report §14.2'),
      v('Grower feed from about week 10.', 'UG', ['MAAIF_2019'], 'MAAIF 2019 Table 25'),
      v('Nests ready before about week 18.', 'PD', ['POULTRYSTART'], 'Report §14.2'),
      v('About 20 weeks without eggs.', 'UG', ['REPORT'], 'Report §13.4'),
    ],
    sourceDifferences: null,
    limits: null,
    referral: 'Ask your hatchery or vet about the vaccination certificate.',
    evidenceLabels: ['UG', 'INT', 'PD'],
    keywords: ['checklist', 'preparation', 'layer', 'pullets', 'plan'],
    related: ['G-LY-BROOD-01', 'G-ALL-PREP-02'],
  },
  {
    code: 'G-ALL-PREP-02', title: 'Buying chicks and receiving them', topic: 'farm_preparation', poultryType: 'all',
    stages: { broiler: ['preparation', 'brooding'], layer: ['preparation', 'brooding'] },
    summary: 'Booking chicks, checking them on arrival and keeping the vaccination certificate.',
    steps: [
      'Book early: deposits and lead times vary, so check the supplier\'s current terms.',
      'Collect the chicks promptly.',
      'On arrival, check the count, liveliness, navels, legs and evenness.',
      'Get the vaccination certificate and the hatch date.',
      'If the count differs from the delivery, record a correction on the flock.',
    ],
    values: [
      v('Chick boxes stacked at most 5 high; chicks handled at about 23 °C room temperature. The report found no national chick-transport standard.',
        'SUP', ['UGACHICK_2021'], 'Report §11.1, §19', 'Ugachick'),
      v('Some producers reported that chicks were supplied unvaccinated and died, which is why the certificate matters.',
        'INT', ['FAO_2022'], 'Report §3'),
      v('Strains confirmed on sale in Uganda: Cobb 500 and Ross 308 broilers; Bovans Brown and Brown Nick layers.',
        'SUP', ['UGACHICK_PAGES', 'REPORT'], 'Report §4, §5, §19', 'Ugachick and Biyinzika'),
    ],
    sourceDifferences: null,
    limits: 'PoultryStart never says that any supplier is reliable or has stock.',
    referral: 'If chicks arrive weak or are dying, contact the supplier and your vet.',
    evidenceLabels: ['SUP', 'INT'],
    keywords: ['buy', 'chicks', 'supplier', 'hatchery', 'certificate', 'delivery', 'arrival'],
    related: ['G-ALL-HEALTH-03'],
  },
  {
    code: 'G-ALL-PREP-03', title: 'How many birds fit in your house', topic: 'farm_preparation', poultryType: 'all',
    stages: { broiler: ['preparation', 'brooding', 'growing'], layer: ['preparation', 'brooding', 'rearing', 'pre_lay', 'laying'] },
    summary: 'Why space must be checked for the largest size the birds reach, and how PoultryStart\'s space check works.',
    steps: [
      'Measure the usable floor: length × width, minus stores and passages.',
      'Check the space needed at every stage, and check again as the birds grow.',
      'If space is short: keep fewer birds, make the house bigger, or split batches.',
    ],
    values: [
      v('Broilers: 30 per m² in the brooder ring (range 30–40).', 'UG', ['MAAIF_2019'], 'MAAIF 2019 §4.1.1; report §6 Table T1'),
      v('Broilers: 25 per m² at about week 2.', 'UG', ['MAAIF_2019'], 'MAAIF 2019 §4.5; report §6 Table T1'),
      v('Broilers at finishing: 10 per m² (MAAIF 2019) or 6 per m² (MAAIF/ILRI 2023, range 5–6).', 'UG',
        ['MAAIF_2019', 'MAAIF_ILRI_2023'], 'Report §6 Table T1'),
      v('Layers: 20 per m² at weeks 0–6 and 10 per m² at weeks 7–13.', 'UG', ['MAAIF_ILRI_2023'], 'Report §6 Table T1'),
      v('Mature layers: 6 per m² (MAAIF 2019) or 5 per m² (MAAIF/ILRI 2023, range 5–7).', 'UG',
        ['MAAIF_2019', 'MAAIF_ILRI_2023'], 'Report §6 Table T1'),
      v('PoultryStart\'s space check uses MAAIF 2019 as standard and the lower figures for beginner farms.', 'PD',
        ['POULTRYSTART'], 'Report §6.1'),
    ],
    sourceDifferences: 'The two Ugandan official sources disagree (MAAIF 2019 and MAAIF/ILRI 2023). PoultryStart uses MAAIF ' +
      '2019 as standard and the lower figures for beginner farms. International (Hy-Line) densities are not used.',
    limits: 'There is no single national Ugandan density standard (report §19).',
    referral: 'Ask your extension officer or District Veterinary Officer about local conditions.',
    evidenceLabels: ['UG', 'PD'],
    keywords: ['space', 'density', 'capacity', 'square metres', 'house size', 'crowding'],
    related: ['G-ALL-HOUSE-01'],
  },

  // ===== Housing =====
  {
    code: 'G-ALL-HOUSE-01', title: 'Open-sided house basics', topic: 'housing', poultryType: 'all',
    stages: { broiler: ['preparation'], layer: ['preparation'] },
    summary: 'What the sources say about siting and shaping a naturally ventilated house. These are source guidelines, not PoultryStart standards.',
    steps: [
      'Talk to an extension officer before building or changing a house.',
      'Compare your plans with the guidance below.',
    ],
    values: [
      v('Long side running east–west.', 'UG', ['MAAIF_ILRI_2023'], 'Report §6.1'),
      v('Long side running east–west.', 'INT', ['AVIAGEN_2016', 'HENDRIX'], 'Report §6.1'),
      v('House width at most 9 m.', 'UG', ['MAAIF_ILRI_2023'], 'Report §6.1'),
      v('House width at most 10 m.', 'INT', ['AVIAGEN_2016'], 'Report §6.1'),
      v('House width 4.8–7.2 m.', 'INT', ['FAO_2003'], 'Report §6.1'),
      v('At least 10 m between houses.', 'UG', ['MAAIF_ILRI_2023'], 'Report §6.1'),
      v('At least 12 m between houses.', 'INT', ['AVIAGEN_2016'], 'Report §6.1'),
      v('At least 9 m between houses.', 'INT', ['FAO_2003'], 'Report §6.1'),
      v('Half wall 0.6–1 m with bird-proof mesh above it.', 'MIX', ['AVIAGEN_2016', 'MAAIF_ILRI_2023'], 'Report §6.1'),
      v('Eaves 1.0–1.5 m.', 'MIX', ['AVIAGEN_2016', 'MAAIF_ILRI_2023'], 'Report §6.1'),
      v('Roof pitch about 45°.', 'MIX', ['AVIAGEN_2016', 'MAAIF_ILRI_2023'], 'Report §6.1'),
      v('Build on higher, well-drained ground.', 'INT', ['AVIAGEN_2016'], 'Report §6.1'),
      v('Security fence, gate and tyre bath at the entrance.', 'UG', ['MAAIF_ILRI_2023'], 'Report §6.1'),
    ],
    sourceDifferences: 'Sources differ on house width and the distance between houses. All figures are shown with their ' +
      'sources; PoultryStart sets no default.',
    limits: null,
    referral: 'Talk to an extension officer before construction.',
    evidenceLabels: ['UG', 'INT'],
    keywords: ['house', 'building', 'construction', 'ventilation', 'orientation', 'roof', 'walls'],
    related: ['G-ALL-PREP-03'],
  },
  {
    code: 'G-ALL-HOUSE-02', title: 'Litter: depth, condition and turning', topic: 'housing', poultryType: 'all',
    stages: { broiler: ['preparation', 'brooding', 'growing', 'sale'], layer: ['preparation', 'brooding', 'rearing', 'pre_lay', 'laying'] },
    summary: 'Keeping litter dry, finding wet patches, and topping it up.',
    steps: [
      'Spread dry litter before the birds arrive.',
      'Look at the litter every day.',
      'When you find wet or caked patches (often near drinkers), turn those patches. Dry, loose litter does not need turning.',
      'Top up the litter over time.',
    ],
    values: [
      v('Start at 5–8 cm and build to about 15 cm, topping up every 2–3 weeks.', 'UG', ['MAAIF_ILRI_2023'], 'Report §6.1, §7.1'),
      v('The sources advise turning wet litter every 2–3 days.', 'UG', ['MAAIF_ILRI_2023'], 'Report §7.1'),
      v('Turning wet litter every 2–3 days.', 'INT', ['AVIAGEN_2016'], 'Report §7.1'),
      v('PoultryStart routine: a daily litter inspection.', 'PG', ['POULTRYSTART'], 'Approved task TD-05'),
      v('PoultryStart routine: a reminder every 3 days to turn any wet or caked patches found; completed as "not needed" if there are none.',
        'PG', ['POULTRYSTART'], 'Approved task TI-01 (decision R1)'),
      v('PoultryStart routine: a top-up reminder every 14 days.', 'PG', ['POULTRYSTART'], 'Approved task TW-07'),
      v('Coffee husks, wood shavings or rice husks are acceptable litter materials.', 'MIX', ['MAAIF_ILRI_2023', 'AVIAGEN_2016'], 'Report §8 Table T3'),
      v('Litter 10–15 cm (4–6 inches).', 'SUP', ['UGACHICK_2021'], 'Report §6.1', 'Ugachick'),
    ],
    sourceDifferences: 'Ugachick gives 10–15 cm, compared with 5–8 cm building to about 15 cm (MAAIF/ILRI). Both are shown.',
    limits: null,
    referral: null,
    evidenceLabels: ['UG', 'SUP', 'INT', 'PG'],
    keywords: ['litter', 'wet', 'caked', 'bedding', 'shavings', 'husks'],
    related: [],
  },
  {
    code: 'G-ALL-HOUSE-03', title: 'Hot weather and fresh air', topic: 'housing', poultryType: 'all',
    stages: { broiler: ['growing', 'sale'], layer: ['rearing', 'pre_lay', 'laying'] },
    summary: 'The signs of heat stress and practical steps. PoultryStart does not know the weather or the season.',
    steps: [
      'Watch for panting and spread wings.',
      'Give shade.',
      'Keep water flowing and drinkers clean, and flush the water lines.',
      'Add drinkers if birds crowd them.',
      'Feed in the cooler hours.',
      'Open the curtains for fresh air without draughts.',
      'Avoid crowding: PoultryStart\'s space check already uses the lower densities for beginner farms.',
    ],
    values: [
      v('Heat-stress management: shade, flushing water lines, feeding in cool hours and extra drinkers (qualitative).', 'UG',
        ['REPORT'], 'Report §18 rule R14'),
      v('Feed before 11:00 and after 16:00 in hot weather.', 'INT', ['AVIAGEN_2016'], 'Report §12.1; approved task TD-02'),
    ],
    sourceDifferences: null,
    limits: 'PoultryStart does not know the weather. No hot-weather density, water or space figures are given.',
    referral: 'If birds are dying in the heat, call your vet or extension officer.',
    evidenceLabels: ['UG', 'INT', 'PG'],
    keywords: ['heat', 'hot', 'panting', 'ventilation', 'shade', 'curtains', 'fresh air'],
    related: ['G-ALL-HEALTH-02'],
  },
  {
    code: 'G-LY-HOUSE-01', title: 'Nests, perches and adult feeders before laying', topic: 'housing', poultryType: 'layer',
    stages: { layer: ['rearing', 'pre_lay'] },
    summary: 'What must be in place before the first egg.',
    steps: [
      'Install nests with clean nesting material.',
      'Fit perches.',
      'Change feeders to adult spacing before laying starts.',
    ],
    values: [
      v('About 1 nest for every 5–6 hens: 6 hens per nest (MAAIF).', 'UG', ['MAAIF_2019'], 'Report §5, §8 Table T3'),
      v('5 hens per nest.', 'INT', ['HYLINE_ALT'], 'Report §5, §8 Table T3'),
      v('Colony nests: 120 birds per m².', 'MIX', ['MAAIF_ILRI_2023', 'HYLINE_ALT'], 'Report §8 Table T3'),
      v('Nest box about 30 × 30 × 30 cm.', 'MIX', ['MAAIF_ILRI_2023', 'HYLINE_ALT'], 'Report §8 Table T3'),
      v('Enough nests for the peak weeks 25–44.', 'UG', ['MAAIF_ILRI_2023'], 'Report §5'),
      v('Perches: 10–15 cm per bird.', 'INT', ['HYLINE_GUIDE'], 'Report §8 Table T3'),
      v('Perches at most 1 m high.', 'INT', ['HYLINE_GUIDE'], 'Report §8 Table T3'),
      v('Perch rails at least 30 cm apart.', 'INT', ['HYLINE_GUIDE'], 'Report §8 Table T3'),
      v('Feeder space: 12 cm per bird after week 20.', 'MIX', ['MAAIF_2019', 'MAAIF_ILRI_2023', 'HYLINE_ALT'], 'Report §8 Table T3'),
      v('Ready before about week 18.', 'PD', ['POULTRYSTART'], 'Report §14.2'),
    ],
    sourceDifferences: 'MAAIF gives 6 hens per nest and Hy-Line 5. PoultryStart says "about 1 for every 5–6 hens" (approved task TL-02).',
    limits: null,
    referral: null,
    evidenceLabels: ['UG', 'INT', 'PD'],
    keywords: ['nests', 'perches', 'nest boxes', 'feeders', 'laying'],
    related: ['G-LY-FLOCK-03'],
  },

  // ===== Flock management =====
  {
    code: 'G-BR-BROOD-01', title: 'Brooding broiler chicks', topic: 'flock_management', poultryType: 'broiler',
    stages: { broiler: ['preparation', 'brooding'] },
    summary: 'Setting up the brooder and looking after broiler chicks in their first two weeks.',
    steps: [
      'Preheat the brooder.',
      'Keep the chicks in a ring near heat, feed and water.',
      'Read the thermometer at chick height and follow your supplier\'s broiler brooding temperature guide.',
      'Keep fresh air without draughts.',
      'Enlarge the ring as the chicks grow.',
      'Open the house after about 2 weeks.',
      'Change to grower feeders and drinkers.',
    ],
    values: [
      v('Preheat 24 hours, or 48 hours on a concrete floor or in a cool or rainy season (derived from Aviagen 2016 and Hy-Line, international).',
        'PD', ['REPORT', 'AVIAGEN_2016', 'HYLINE_GUIDE'], 'Report §7.1'),
      v('A charcoal brooder serves about 250 chicks.', 'INT', ['AVIAGEN_2016'], 'Aviagen 2016 Table 1; report §7.1'),
      v('A gas brooder serves 750–1,000 chicks.', 'INT', ['AVIAGEN_2016'], 'Aviagen 2016 Table 1; report §7.1'),
      v('Brooder ring: 30–40 chicks per m².', 'UG', ['MAAIF_2019'], 'MAAIF 2019 §4.1.1'),
      v('Chicks within 1 m of feed and water.', 'INT', ['AVIAGEN_2016'], 'Report §7.1'),
      v('Supplementary drinkers for the first 3 days.', 'INT', ['ROSS_2025'], 'Report §8'),
      v('Floor-level air speed for chicks at most 0.15 m/s.', 'INT', ['ROSS_2025'], 'Report §7.3'),
      v('Brooder about 2 weeks, then 25 chicks per m².', 'UG', ['MAAIF_2019'], 'MAAIF 2019 §4.5; report §7.3'),
      v('Faster alternative: enlarge the ring from day 3.', 'INT', ['AVIAGEN_2016'], 'Aviagen 2016 Table 4; report §7.3'),
      v('Faster alternative: full-house access by days 10–12.', 'INT', ['AVIAGEN_2016'], 'Aviagen 2016 Table 4; report §7.3'),
      v('Chick trays and fonts replaced by grower equipment around days 7–14.', 'PD', ['REPORT'], 'Report §8'),
      v('Optional lighting: 23 hours light and 1 hour dark on day 0, at 30–40 lux.', 'INT', ['ROSS_2025'], 'Report §7.3'),
      v('Optional lighting: 4–6 hours of darkness by day 7.', 'INT', ['ROSS_2025'], 'Report §7.3'),
      v('Optional lighting: then at least 4 hours of continuous darkness, at 5–10 lux.', 'INT', ['ROSS_2025'], 'Report §7.3'),
    ],
    sourceDifferences: 'Brooder duration: MAAIF\'s about 2 weeks is the default; the faster Aviagen schedule is for experienced ' +
      'farmers with good temperature control. Brooding temperature schedules differ between sources, so PoultryStart prints ' +
      'no temperature table: follow your supplier\'s guide.',
    limits: 'No brooding temperature table is given (approved C-1).',
    referral: 'If many chicks are sick or dying, call your vet.',
    evidenceLabels: ['UG', 'INT', 'PD'],
    keywords: ['brooding', 'brooder', 'chicks', 'heater', 'ring', 'thermometer'],
    related: ['G-ALL-BROOD-02', 'G-BR-PREP-01'],
  },
  {
    code: 'G-LY-BROOD-01', title: 'Brooding layer chicks', topic: 'flock_management', poultryType: 'layer',
    stages: { layer: ['preparation', 'brooding'] },
    summary: 'Layer brooding lasts longer than broiler brooding and follows its own plan.',
    steps: [
      'Preheat the brooder, as for broilers.',
      'Keep 20 chicks per m² up to week 6.',
      'Use layer-chick feeders and drinkers.',
      'Follow your supplier\'s layer temperature and lighting plan, never a broiler schedule.',
    ],
    values: [
      v('20 chicks per m² at weeks 0–6.', 'UG', ['MAAIF_ILRI_2023'], 'Report §6 Table T1'),
      v('80 chicks per tray feeder.', 'INT', ['HYLINE_GUIDE'], 'Report §5'),
      v('80 chicks per 25 cm round drinker.', 'INT', ['HYLINE_GUIDE'], 'Report §5'),
      v('1 nipple or cup per 12 birds for the first 3 weeks.', 'INT', ['HYLINE_GUIDE'], 'Report §5'),
      v('Chicks within 1 m of feed and water.', 'INT', ['HYLINE_GUIDE'], 'Report §5'),
      v('Preheat 24 hours, or 48 hours on a concrete floor or in a cool or rainy season.', 'PD',
        ['REPORT', 'AVIAGEN_2016', 'HYLINE_GUIDE'], 'Report §7.1'),
    ],
    sourceDifferences: 'Layer and broiler brooding schedules are different (stated without numbers, report §7.2).',
    limits: 'No brooding temperature table is given (approved C-1).',
    referral: 'If chicks are sick or dying, call your vet.',
    evidenceLabels: ['UG', 'INT', 'PD'],
    keywords: ['brooding', 'brooder', 'layer chicks', 'heater'],
    related: ['G-ALL-BROOD-02', 'G-LY-PREP-01'],
  },
  {
    code: 'G-ALL-BROOD-02', title: 'Reading chick comfort in the first days', topic: 'flock_management', poultryType: 'all',
    stages: { broiler: ['brooding'], layer: ['brooding'] },
    summary: 'How chicks show whether they are comfortable, and the first-day checks.',
    steps: [
      'Watch how the chicks spread out: evenly spread means comfortable; panting or spread wings means too hot; huddling means too cold; crowding on one side means a draught.',
      'Broilers: gently feel the crops of some chicks to check they have eaten.',
      FIRST_DAY_WATER,
    ],
    values: [
      v('Behaviour signs of comfort (qualitative).', 'INT', ['ROSS_2025', 'HYLINE_GUIDE'], 'Report §7.3'),
      v('Broilers: crop fill 75% at 2 hours.', 'INT', ['ROSS_2025'], 'Report §7.3'),
      v('Broilers: crop fill 80% at 4 hours.', 'INT', ['ROSS_2025'], 'Report §7.3'),
      v('Broilers: crop fill over 85% at 12 hours.', 'INT', ['ROSS_2025'], 'Report §7.3'),
      v('Broilers: crop fill over 95% at 24 hours.', 'INT', ['ROSS_2025'], 'Report §7.3'),
    ],
    sourceDifferences: null,
    limits: 'The crop-fill figures apply to broilers only. No first-day water figures are given: they could not be verified.',
    referral: 'Ask your chick supplier or extension officer about first-day water.',
    evidenceLabels: ['INT'],
    keywords: ['chicks', 'comfort', 'huddling', 'panting', 'crop', 'first day', 'water'],
    related: ['G-BR-BROOD-01', 'G-LY-BROOD-01'],
  },
  {
    code: 'G-ALL-FLOCK-01', title: 'Weighing birds and following growth', topic: 'flock_management', poultryType: 'all',
    stages: { broiler: ['growing'], layer: ['brooding', 'rearing', 'pre_lay'] },
    summary: 'Weighing a sample of birds each week and comparing with your own earlier weighings and your supplier\'s guide.',
    steps: [
      'Weigh birds from different parts of the house every week.',
      'Record the results.',
      'Compare them with your earlier weighings and with your supplier\'s guide for your strain.',
    ],
    values: [
      v('A 1–5 kg scale for weekly weighing.', 'INT', ['ROSS_2025', 'HYLINE_GUIDE'], 'Report §8 Table T3'),
      v('Weekly weighing for broilers from week 2 (from age day 14).', 'INT', ['ROSS_2025'], 'Approved task TW-01; report §8 Table T3'),
      v('Weekly weighing for layers from week 4 (from age day 28).', 'INT', ['HYLINE_GUIDE'], 'Approved task TW-01; report §8 Table T3'),
    ],
    sourceDifferences: 'International growth objectives describe ideal conditions and are much higher than Ugandan mash-fed ' +
      'planning weights. PoultryStart never uses them as targets (report §9.3, §19).',
    limits: 'PoultryStart sets no sample size (the report gives none). PoultryStart counts weeks from 0.',
    referral: 'If growth worries you, ask your supplier or extension officer.',
    evidenceLabels: ['INT'],
    keywords: ['weigh', 'weight', 'scale', 'growth', 'body weight'],
    related: [],
  },
  {
    code: 'G-ALL-FLOCK-02', title: 'Dead birds and flock records', topic: 'flock_management', poultryType: 'all',
    stages: ALL_BIRD_STAGES,
    summary: 'Removing dead birds safely and keeping the flock records.',
    steps: [
      'Walk the house every day and remove any dead birds.',
      'Put them in the disposal pit or compost.',
      'Wash your hands.',
      'Record the number in the flock\'s mortality form.',
      'Keep the flock records: health, production, medicines, vaccinations and deaths.',
    ],
    values: [
      v('Dispose of dead birds in a pit or compost.', 'UG', ['MAAIF_ILRI_2023'], 'Report §8 Table T3; approved task TD-04'),
      v('Keep flock records (health, production, medicines, vaccinations, deaths).', 'INT', ['WOAH'], 'Report §13.4'),
      v('Remove dead birds daily.', 'PG', ['POULTRYSTART'], 'Approved task TD-04'),
    ],
    sourceDifferences: null,
    limits: 'There is no reliable Ugandan figure for a "normal" death rate (report §19), so none is given.',
    referral: 'If deaths are rising, call your vet or extension officer.',
    evidenceLabels: ['UG', 'INT', 'PG'],
    keywords: ['dead birds', 'deaths', 'mortality', 'disposal', 'records'],
    related: ['G-ALL-HEALTH-02'],
  },
  {
    code: 'G-BR-FLOCK-01', title: 'Getting broilers ready for sale', topic: 'flock_management', poultryType: 'broiler',
    stages: { broiler: ['growing', 'sale'] },
    summary: 'Planning the sale week.',
    steps: [
      'Record an expected sale date for the flock.',
      'Confirm buyers before the final week.',
      'Arrange crates and transport.',
      'Check medicine waiting periods with your vet.',
      'Catch the birds in the cool early morning.',
      'Record the sale in the flock\'s "sold" form.',
      'Clean out the house after the sale.',
    ],
    values: [
      v('Cycles of about 5 weeks (pelleted feed) to 6–7 weeks (mash).', 'SUP', ['UGACHICK_2021'], 'Report §4', 'Ugachick'),
      v('Confirm buyers before the final week.', 'PG', ['POULTRYSTART'], 'Report §13.4; approved task TP-05'),
      v('Catch in the cool hours.', 'MIX', ['MAAIF_2019', 'AVIAGEN_2016'], 'Report §12.1'),
      v('Medicine waiting periods: MAAIF/ILRI Annex 10 is linked, without figures.', 'UG', ['MAAIF_ILRI_2023'], 'Report §13.4, §19'),
      v('Optional: 23 hours of light for the 3 days before catching.', 'INT', ['ROSS_2025'], 'Report §12.1; approved task TP-07'),
    ],
    sourceDifferences: null,
    limits: null,
    referral: 'Ask your vet about medicine waiting periods.',
    evidenceLabels: ['SUP', 'UG', 'INT', 'PG'],
    keywords: ['sale', 'sell', 'buyers', 'catching', 'transport', 'crates'],
    related: ['G-ALL-HEALTH-04', 'G-ALL-HYG-02'],
  },
  {
    code: 'G-LY-FLOCK-01', title: 'Moving pullets to the laying house', topic: 'flock_management', poultryType: 'layer',
    stages: { layer: ['pre_lay'] },
    summary: 'When and how to move pullets, if you use a separate laying house.',
    steps: [
      'Move the birds only if you use a separate laying house.',
      'Match the light hours of the new house.',
      'Move early in the morning.',
      'Count the birds.',
      'Ask your supplier or vet before giving anything in the water.',
    ],
    values: [
      v('Move between weeks 15 and 17.', 'INT', ['HYLINE_GUIDE'], 'Report §5, §12.2; approved task TP-11'),
      v('Move at least 14 days before the first egg.', 'INT', ['HYLINE_GUIDE'], 'Report §5, §14.2'),
      v('Transfer densities 15, 14, 13 and 12 birds per m² at weeks 15–18 (for information only).', 'INT', ['HYLINE_ALT'], 'Report §6 Table T1'),
      v('PoultryStart\'s space check caps these weeks at 10 birds per m².', 'PD', ['POULTRYSTART'], 'Approved capacity decision'),
    ],
    sourceDifferences: 'PoultryStart\'s space check caps weeks 14–18 at the local pullet density of 10 per m² (approved), ' +
      'instead of the international transfer densities.',
    limits: null,
    referral: 'Ask your supplier or vet.',
    evidenceLabels: ['INT', 'PD'],
    keywords: ['transfer', 'move', 'laying house', 'pullets'],
    related: ['G-LY-FLOCK-02'],
  },
  {
    code: 'G-LY-FLOCK-02', title: 'Lighting for layers', topic: 'flock_management', poultryType: 'layer',
    stages: { layer: ['rearing', 'pre_lay', 'laying'] },
    summary: 'Light affects laying. Follow your supplier\'s lighting plan for your strain.',
    steps: [
      'Ask your supplier for your strain\'s lighting plan.',
      'Increase the light only as that plan says.',
      'Once the birds are laying, never shorten the day length.',
    ],
    values: [
      v('Light increase from about 1,350 g body weight (for egg numbers).', 'INT', ['HYLINE_STD'], 'Report §5 (Hy-Line Brown only)'),
      v('Light increase from about 1,380 g body weight (for egg size).', 'INT', ['HYLINE_STD'], 'Report §5 (Hy-Line Brown only)'),
      v('Light increased in 30-minute steps.', 'INT', ['HYLINE_STD'], 'Report §5 (Hy-Line Brown only)'),
      v('Up to 16 hours of light, never reduced once laying.', 'INT', ['HYLINE_STD'], 'Report §5 (Hy-Line Brown only)'),
    ],
    sourceDifferences: 'The report has no Ugandan lighting source.',
    limits: 'PoultryStart gives no universal lighting programme (approved tasks TD-09 and TL-03).',
    referral: 'Ask your supplier.',
    evidenceLabels: ['INT'],
    keywords: ['light', 'lighting', 'day length', 'laying'],
    related: [],
  },
  {
    code: 'G-LY-FLOCK-03', title: 'First eggs, egg collection and handling', topic: 'flock_management', poultryType: 'layer',
    stages: { layer: ['pre_lay', 'laying'] },
    summary: 'Spotting the first eggs, recording the first-egg date, and collecting eggs.',
    steps: [
      'Check the nests and the floor for eggs from about week 18.',
      'Have the owner or a manager record the first-egg date.',
      'Collect eggs several times a day.',
      'Keep floor eggs and cracked or dirty eggs separate.',
      'Record good, second-grade and floor eggs.',
      'Have egg trays ready before laying starts.',
    ],
    values: [
      v('First-egg checks from week 18.', 'PD', ['POULTRYSTART'], 'Approved task TL-04'),
      v('Collect eggs at least 2–3 times a day.', 'INT', ['HYLINE_GUIDE'], 'Report §12.2'),
      v('PoultryStart suggests three collections a day.', 'PD', ['POULTRYSTART'], 'Approved decision D-T8'),
    ],
    notice: EGG_STORAGE_GAP,
    sourceDifferences: null,
    limits: 'No storage temperature, storage time or grading rule is given (report §19).',
    referral: 'Ask your district veterinary officer or the Uganda National Bureau of Standards (UNBS) about storage and grading.',
    evidenceLabels: ['INT', 'PD'],
    keywords: ['eggs', 'first egg', 'collection', 'floor eggs', 'storage', 'grading'],
    related: ['G-LY-HOUSE-01'],
  },

  // ===== Feeding =====
  {
    code: 'G-BR-FEED-01', title: 'Broiler feed stages and amounts', topic: 'feeding', poultryType: 'broiler',
    stages: { broiler: ['preparation', 'brooding', 'growing'] },
    summary: 'Starter, grower and finisher feed, when to change, and roughly how much feed a flock needs.',
    steps: [
      'Follow your feed supplier\'s schedule, or MAAIF\'s if you have none.',
      'Order the next feed so it arrives in time.',
      'Buy from reputable millers.',
    ],
    values: [
      v('MAAIF: starter feed for the first 4 weeks; finisher from about weeks 4–5.', 'UG', ['MAAIF_2019'], 'MAAIF 2019 §4.5.1; report §9.1'),
      v('Ugachick mash: starter weeks 0–3, grower weeks 3–5, finisher after.', 'SUP', ['UGACHICK_2021'], 'Report §9.1', 'Ugachick'),
      v('Ross: starter days 0–10 (to day 14 if underweight), grower days 11–24, finisher from day 25.', 'INT', ['ROSS_2025'], 'Report §9.1'),
      v('Planning amounts, mash, per 100 birds: 14, 30, 57, 88, 112 and 122 kg in weeks 1–6 (about 3.01 kg per bird to week 5 and 4.23 kg to week 6). These are planning amounts; follow actual use in your feed records.',
        'UG', ['MAAIF_2019'], 'MAAIF 2019 Table 33; report §9.2'),
      v('Pellets: 2.93 kg per bird to week 5.', 'UG', ['MAAIF_2019'], 'MAAIF 2019 Table 32; report §9.2'),
      v('Pellets: about 3 kg per bird to week 5.', 'SUP', ['UGACHICK_2021'], 'Report §9.2', 'Ugachick'),
      v('Order grower and finisher feed to arrive before day 10.', 'PD', ['REPORT'], 'Report §14.1'),
      v('Feed quality varies between and within Ugandan feed makers.', 'INT', ['FAO_REVIEW'], 'Report §9.2'),
    ],
    sourceDifferences: 'The three feed schedules differ. Follow your supplier\'s schedule; otherwise PoultryStart follows MAAIF ' +
      '(approved tasks TP-02 and TP-03).',
    limits: null,
    referral: null,
    evidenceLabels: ['UG', 'SUP', 'INT', 'PD'],
    keywords: ['feed', 'starter', 'grower', 'finisher', 'mash', 'pellets', 'broiler feed'],
    related: ['G-ALL-FEED-02'],
  },
  {
    code: 'G-LY-FEED-01', title: 'Layer feed stages', topic: 'feeding', poultryType: 'layer',
    stages: { layer: ['brooding', 'rearing', 'pre_lay', 'laying'] },
    summary: 'Chick, grower, pre-lay and layer feed, and when to change.',
    steps: [
      'Follow your supplier\'s feeding programme.',
      'A first-egg date alone does not mean you must change the feed now.',
    ],
    values: [
      v('Chick mash weeks 0–10; grower weeks 10–20; pre-lay weeks 17–19; layer mash from about week 20 or 2% production.',
        'UG', ['MAAIF_2019'], 'MAAIF 2019 Table 25; report §9.1'),
      v('Brown strains change feed by body weight: at 186–197 g.', 'INT', ['HYLINE_STD'], 'Report §9.1'),
      v('Brown strains: at 456–482 g.', 'INT', ['HYLINE_STD'], 'Report §9.1'),
      v('Brown strains: at 1,046–1,105 g.', 'INT', ['HYLINE_STD'], 'Report §9.1'),
      v('Brown strains: at 1,246–1,317 g.', 'INT', ['HYLINE_STD'], 'Report §9.1'),
      v('Pre-lay feed never before week 15, stopping at the first egg.', 'INT', ['HYLINE_STD'], 'Report §9.1'),
    ],
    sourceDifferences: 'MAAIF changes feed by age and Hy-Line by body weight. Follow your supplier first, then MAAIF (approved task TP-12).',
    limits: null,
    referral: null,
    evidenceLabels: ['UG', 'INT'],
    keywords: ['feed', 'chick mash', 'grower', 'pre-lay', 'layer mash', 'layer feed'],
    related: ['G-LY-FEED-02'],
  },
  {
    code: 'G-LY-FEED-02', title: 'How much feed layers eat (planning estimates)', topic: 'feeding', poultryType: 'layer',
    stages: { layer: ['preparation', 'brooding', 'rearing', 'pre_lay', 'laying'] },
    summary: 'Daily feed per bird by age, for planning and buying feed.',
    steps: [
      'Use these figures to plan and buy feed.',
      'Record the feed you actually use in PoultryStart\'s feed records and compare week to week.',
    ],
    notice: 'These figures are for planning and buying feed. They are not the amount your birds are expected or guaranteed ' +
      'to eat. Intake depends on strain, feed, climate and management. Record the feed you actually use in PoultryStart\'s ' +
      'feed records and compare week to week (weekly feed and water review).',
    values: [
      v('Grams per bird per day by week: week 1: 11; 2: 17; 3: 25; 4: 32; 6: 42; 8: 50; 10: 58; 12: 64; 16: 76; 18: 87; 19: 90; 20–80: 95.',
        'UG', ['MAAIF_2019'], 'MAAIF 2019 Table 26; report §9.2'),
      v('Mature layers: 95 g per bird per day (weeks 20–80), from MAAIF 2019 Table 26.', 'UG', ['MAAIF_2019'], 'MAAIF 2019 Table 26; report §9.2'),
      v('Mature layers: 125–135 g per bird per day, from the MAAIF 2019 body text.', 'UG', ['MAAIF_2019'], 'Report §5, §9.2'),
      v('109.1–116.9 g per day on average over weeks 19–100.', 'INT', ['HYLINE_STD'], 'Report §9.2'),
      v('The report\'s planning recommendation: budget across 95–135 g and lean towards the higher end, because the two MAAIF figures disagree and running out of feed is the bigger risk. Neither MAAIF figure is a universal standard.',
        'PD', ['REPORT'], 'Report §9.2, §9.3'),
      v('Rearing total: 5.99 kg per bird to week 17.', 'INT', ['HYLINE_STD'], 'Report §9.2'),
      v('Rearing total: 6.51 kg per bird to week 17.', 'INT', ['HYLINE_ALT'], 'Report §9.2'),
    ],
    sourceDifferences: 'MAAIF 2019 gives 95 g per bird per day in Table 26 and 125–135 g in its text for mature layers. ' +
      'Both are shown with their sources; the report plans with the higher end.',
    limits: 'These are planning figures only.',
    referral: null,
    evidenceLabels: ['UG', 'INT', 'PD'],
    keywords: ['feed amount', 'how much feed', 'grams', 'intake', 'planning', 'layer feed'],
    related: ['G-LY-FEED-01'],
  },
  {
    code: 'G-ALL-FEED-02', title: 'Feeders, feed storage and feed quality', topic: 'feeding', poultryType: 'all',
    stages: { broiler: ['preparation', 'brooding', 'growing'], layer: ['preparation', 'brooding', 'rearing', 'pre_lay', 'laying'] },
    summary: 'Enough feeder space for the birds\' age, and keeping feed dry and safe.',
    steps: [
      'Give enough feeder space for the birds\' age.',
      'Store feed off the floor on pallets, in a dry room safe from rats.',
      'Buy from reputable millers.',
      'Do not use mouldy feed.',
    ],
    values: [
      v('Broiler feeder space: 5 cm per bird (days 0–14), 7.5 cm (days 15–35), 10 cm (day 36 on).', 'MIX',
        ['MAAIF_2019', 'MAAIF_ILRI_2023', 'HYLINE_ALT'], 'Report §8 Table T3'),
      v('Layer feeder space: 5 cm per bird (weeks 0–4), 7.5 cm (weeks 5–8), 10 cm (weeks 9–20), 12 cm (after week 20).', 'MIX',
        ['MAAIF_2019', 'MAAIF_ILRI_2023', 'HYLINE_ALT'], 'Report §8 Table T3'),
      v('One 38 cm tube feeder per 70 birds.', 'INT', ['ROSS_2025'], 'Report §8 Table T3'),
      v('45–80 birds per pan feeder.', 'INT', ['ROSS_2025'], 'Report §8 Table T3'),
      v('Store feed off the floor on pallets in a dry, rodent-proof room; buy from reputable millers.', 'INT',
        ['FAO_REVIEW'], 'Report §9.2'),
    ],
    sourceDifferences: null,
    limits: 'There is no Ugandan feed-storage volume standard (report §19).',
    referral: null,
    evidenceLabels: ['UG', 'INT'],
    keywords: ['feeders', 'feeder space', 'feed storage', 'mould', 'rats'],
    related: [],
  },

  // ===== Water =====
  {
    code: 'G-BR-WATER-01', title: 'Broiler drinking water and drinkers', topic: 'water', poultryType: 'broiler',
    stages: { broiler: ['preparation', 'brooding', 'growing'] },
    summary: 'How much broilers drink, for planning, and how many drinkers they need.',
    steps: [
      'Use these figures to plan water supply.',
      'Record actual water use in PoultryStart\'s water records.',
    ],
    values: [
      v('Millilitres per bird per day by week: 1: 40–50; 2: 60–80; 3: 100–120; 4: 140–160; 5: 180–200; 6: 210–230. These are planning figures; follow actual use in your water records.',
        'UG', ['MAAIF_2019'], 'MAAIF 2019 Table 31; report §10.1'),
      v('Fonts: 1 per 50 chicks in week 1.', 'UG', ['MAAIF_2019'], 'MAAIF 2019 §4.4.7'),
      v('Bell drinkers: 10–13 per 100 birds.', 'UG', ['MAAIF_2019'], 'MAAIF 2019 Table 28'),
      v('Nipple drinkers: 8–10 birds per nipple.', 'UG', ['MAAIF_2019'], 'MAAIF 2019 Table 28'),
      v('Nipple drinkers: 12 birds per nipple under 3 kg.', 'INT', ['ROSS_2025'], 'Report §8 Table T3'),
      v('Nipple drinkers: 9 birds per nipple over 3 kg.', 'INT', ['ROSS_2025'], 'Report §8 Table T3'),
      v('Water-to-feed ratio 1.6–1.8 : 1 at about 21 °C.', 'INT', ['ROSS_2025'], 'Report §10.1'),
      v('That ratio gives about 288–324 ml per bird per day at week 5.', 'INT', ['ROSS_2025'], 'Report §10.1'),
    ],
    sourceDifferences: 'The Ross ratio gives about 288–324 ml at week 5, compared with MAAIF\'s 180–200 ml. Do not average them; ' +
      'MAAIF is the Ugandan baseline (report §10.1).',
    limits: null,
    referral: null,
    evidenceLabels: ['UG', 'INT'],
    keywords: ['water', 'drinkers', 'drinking', 'nipples', 'fonts', 'bell drinkers'],
    related: ['G-ALL-WATER-02'],
  },
  {
    code: 'G-LY-WATER-01', title: 'Layer drinking water and drinkers (planning estimates)', topic: 'water', poultryType: 'layer',
    stages: { layer: ['preparation', 'brooding', 'rearing', 'pre_lay', 'laying'] },
    summary: 'How much layers drink, for planning water supply and storage, and how many drinkers they need.',
    steps: [
      'Use these figures to plan water supply and storage.',
      'Record actual water use in PoultryStart\'s water records and compare week to week.',
    ],
    notice: 'These figures are for planning water supply and storage. They are not the amount your birds are expected or ' +
      'guaranteed to drink. Use depends on strain, age, heat and management. Record actual water use in PoultryStart\'s ' +
      'water records and compare week to week.',
    values: [
      v('Millilitres per bird per day by week: 1: 20–30; 2: 40–50; 3: 50–60; 4: 60–70; 6: 80–100; 8: 120–130; 10: 150–160; 12: 165–170; 16: 190–195; 18: 205–210.',
        'UG', ['MAAIF_2019'], 'MAAIF 2019 Table 26; report §10.1'),
      v('Mature layers: 220–230 ml per bird per day (weeks 20–80), from MAAIF 2019 Table 26.', 'UG', ['MAAIF_2019'], 'MAAIF 2019 Table 26; report §10.1'),
      v('Mature layers: up to 300–350 ml per bird per day, from the MAAIF 2019 body text.', 'UG', ['MAAIF_2019'], 'Report §10.1'),
      v('165–236 ml per bird per day at week 30.', 'INT', ['HYLINE_STD'], 'Report §10.1'),
      v('The report\'s planning recommendation: in hot districts, plan with the higher figure, because the MAAIF text allows more and running short of water is the bigger risk (the report\'s storage example uses 350 ml for this reason).',
        'PD', ['REPORT'], 'Report §10.1, §10.3'),
      v('80 chicks per 25 cm drinker.', 'INT', ['HYLINE_GUIDE'], 'Report §5'),
      v('1 nipple per 12 birds for the first 3 weeks.', 'INT', ['HYLINE_GUIDE'], 'Report §5'),
      v('12.5 birds per nipple in rearing.', 'INT', ['HYLINE_ALT'], 'Report §8 Table T3'),
      v('10 birds per nipple in lay.', 'INT', ['HYLINE_ALT'], 'Report §8 Table T3'),
      v('Bell drinkers: 10–13 per 100 birds.', 'UG', ['MAAIF_2019'], 'MAAIF 2019 Table 28'),
    ],
    sourceDifferences: 'MAAIF 2019 gives 220–230 ml per bird per day in Table 26 and up to 300–350 ml in its text for mature ' +
      'layers. Both are shown with their sources; the report plans with the higher figure in hot districts.',
    limits: 'These are planning figures only.',
    referral: null,
    evidenceLabels: ['UG', 'INT', 'PD'],
    keywords: ['water', 'drinkers', 'drinking', 'how much water', 'planning'],
    related: ['G-ALL-WATER-02'],
  },
  {
    code: 'G-ALL-WATER-02', title: 'Water storage, outages and clean drinkers', topic: 'water', poultryType: 'all',
    stages: { broiler: ['preparation', 'brooding', 'growing'], layer: ['preparation', 'brooding', 'rearing', 'pre_lay', 'laying'] },
    summary: 'Storing enough water for supply cuts, and keeping water and drinkers clean.',
    steps: [
      'Work out the storage you need: highest daily use × outage days + a cleaning reserve.',
      'Keep stored water covered and shaded.',
      'Clean drinkers every day.',
      'Have your water tested.',
    ],
    values: [
      v('Storage = highest daily use × outage days + a cleaning reserve. Example: 100 broilers in week 5 use about 20 L a day, so a 2-day outage needs at least 40 L (using the MAAIF figures).',
        'UG', ['REPORT', 'MAAIF_2019'], 'Report §10.3'),
      v('Keep stored water covered and shaded.', 'INT', ['AVIAGEN_2016'], 'Report §10.3; approved task TD-03'),
      v('Clean drinkers daily.', 'PG', ['POULTRYSTART'], 'Approved task TD-03'),
      v('Test water at least once a year.', 'INT', ['HYLINE_GUIDE'], 'Report §10.3'),
    ],
    sourceDifferences: null,
    limits: 'There is no Ugandan figure for cleaning-water volume or hand-pump flow (report §19): measure your own. No water ' +
      'treatment instructions are given.',
    referral: 'Ask your extension officer before treating water.',
    evidenceLabels: ['UG', 'INT', 'PG'],
    keywords: ['water storage', 'tank', 'outage', 'clean water', 'drinkers'],
    related: [],
  },

  // ===== Hygiene =====
  {
    code: 'G-ALL-HYG-01', title: 'Biosecurity: keeping disease out', topic: 'hygiene', poultryType: 'all',
    stages: 'any',
    summary: 'Simple measures that stop disease from coming into the farm.',
    steps: [
      'Write a short biosecurity plan.',
      'Fence the farm, with a gate.',
      'Keep a visitor register.',
      'Use a tyre bath at the gate and a footbath at the house door.',
      'Keep boots and clothes for the house only.',
      'Do not mix species or ages.',
      'Use all-in-all-out.',
      'Inspect the fence, mesh and signs of rats or predators every week.',
    ],
    values: [
      v('Biosecurity plan, fence and gate, visitor register, tyre bath and footbath, house-only boots and clothes, no mixing of species or ages, all-in-all-out.',
        'UG', ['MAAIF_ILRI_2023'], 'Report §11.2'),
      v('The same measures, adapted for small farms.', 'INT', ['WOAH'], 'Report §11.2'),
      v('One set of boots and overalls and one footbath per house; one tyre bath at the gate.', 'UG', ['MAAIF_ILRI_2023'], 'Report §8 Table T3'),
      v('Weekly inspection.', 'PG', ['POULTRYSTART'], 'Approved task TW-03'),
    ],
    sourceDifferences: 'WOAH\'s chapter is written for intensive production and is adapted here for small farms (report §11.2).',
    limits: null,
    referral: null,
    evidenceLabels: ['UG', 'INT', 'PG'],
    keywords: ['biosecurity', 'visitors', 'footbath', 'fence', 'disease prevention'],
    related: ['G-ALL-HYG-02'],
  },
  {
    code: 'G-ALL-HYG-02', title: 'Cleaning and resting the house between flocks', topic: 'hygiene', poultryType: 'all',
    stages: { broiler: ['after_flock', 'preparation'], layer: ['after_flock', 'preparation'] },
    summary: 'The 7 cleaning steps and how long to rest the house.',
    steps: [
      'Remove the equipment.',
      'Remove the litter to compost or a pit.',
      'Wash with detergent.',
      'Drain to a soak pit.',
      'Rinse and dry.',
      'Disinfect.',
      'Rest the house, then apply lime or ash.',
    ],
    values: [
      v('The 7 cleaning steps.', 'UG', ['MAAIF_ILRI_2023'], 'Report §11.2'),
      v('Rest the house about 2 weeks.', 'UG', ['MAAIF_ILRI_2023'], 'Report §11.2'),
      v('Rest 4 weeks is best.', 'INT', ['HYLINE_GUIDE'], 'Report §11.2'),
      v('Rest 2 weeks at minimum.', 'INT', ['HYLINE_GUIDE'], 'Report §11.2'),
      v('Clean and disinfect at least 10 days before new chicks.', 'SUP', ['UGACHICK_2021'], 'Report §14.1', 'Ugachick'),
    ],
    sourceDifferences: 'Rest periods differ: about 2 weeks (MAAIF/ILRI), 2–4 weeks (Hy-Line), at least 10 days (Ugachick). All ' +
      'three are shown; PoultryStart\'s task TP-13 uses about 2 weeks (approved).',
    limits: 'There is no standard for cleaning-water volume or pit size (report §19).',
    referral: null,
    evidenceLabels: ['UG', 'SUP', 'INT'],
    keywords: ['cleaning', 'clean out', 'disinfect', 'rest', 'between flocks'],
    related: ['G-ALL-HYG-01'],
  },

  // ===== Health monitoring =====
  {
    code: 'G-ALL-HEALTH-01', title: 'Daily health checks: what to look at', topic: 'health_monitoring', poultryType: 'all',
    stages: ALL_BIRD_STAGES,
    summary: 'Watching your birds every day and writing down what you notice. This is not working out what disease they have.',
    steps: [
      'Before feeding, quietly watch: are the birds active, eating, drinking, breathing normally and spread out?',
      'Note anything unusual as a health observation.',
      'If you are unsure, ask your vet or extension officer.',
    ],
    values: [
      v('Daily observation by the attendant.', 'PG', ['POULTRYSTART', 'REPORT'], 'Report §13.4; approved task TD-01'),
    ],
    sourceDifferences: null,
    limits: 'PoultryStart never reads your notes or names a disease.',
    referral: VET_REFERRAL,
    evidenceLabels: ['PG'],
    keywords: ['health check', 'observe', 'sick', 'watch', 'behaviour'],
    related: ['G-ALL-HEALTH-02'],
  },
  {
    code: 'G-ALL-HEALTH-02', title: 'When to call your vet or extension officer', topic: 'health_monitoring', poultryType: 'all',
    stages: ALL_BIRD_STAGES,
    summary: 'Situations where you need professional help straight away.',
    steps: [
      'Call your vet or extension officer straight away if birds are sick or dying, deaths are rising, or you suspect a serious disease.',
      'Keep sick birds apart as they advise.',
      'Record the contact in your health observation.',
      'Keep their numbers saved.',
    ],
    values: [
      v('Immediate veterinary consultation and isolation for a suspected notifiable disease.', 'UG', ['MAAIF_ILRI_2023'], 'Report §11.2'),
      v('Immediate veterinary consultation and isolation for a suspected notifiable disease.', 'INT', ['WOAH'], 'Report §11.2'),
      v('Save your vet\'s contact before the birds arrive.', 'UG', ['REPORT'], 'Report §14.1'),
    ],
    sourceDifferences: null,
    limits: 'The Advisor\'s prompts are PoultryStart design rules, not veterinary thresholds. No alert does not mean your ' +
      'birds are healthy.',
    referral: VET_REFERRAL,
    evidenceLabels: ['UG', 'INT', 'PG'],
    keywords: ['vet', 'veterinarian', 'extension officer', 'sick birds', 'deaths', 'help'],
    related: ['G-ALL-HEALTH-01'],
  },
  {
    code: 'G-ALL-HEALTH-03', title: 'Vaccination: working with your hatchery and vet', topic: 'health_monitoring', poultryType: 'all',
    stages: { broiler: ['preparation', 'brooding', 'growing'], layer: ['preparation', 'brooding', 'rearing', 'pre_lay', 'laying'] },
    summary: 'How vaccination works on your farm. PoultryStart gives no vaccination schedule.',
    steps: [
      'Get the hatchery\'s vaccination certificate.',
      'Get your vaccination programme from your vet or chick supplier.',
      'Ask them how each vaccine must be given; PoultryStart gives no handling instructions.',
      'Change the programme only with your vet.',
      'Record what was actually given.',
      'Layers: check that Marek\'s was given at the hatchery.',
    ],
    values: [
      v('Chicks are usually vaccinated at the hatchery on day 1 (the fact only; no vaccine list is given).', 'SUP',
        ['UGACHICK_PAGES'], 'Report §11.2', 'Ugachick'),
      v('"A single program cannot be recommended for all regions."', 'INT', ['HYLINE_VACC'], 'Report §11.2'),
      v('Commercial layers should receive Marek\'s vaccination at the hatchery.', 'INT', ['HYLINE_VACC'], 'Report §11.2, §14.2'),
      v('Vaccination "does not guarantee absolute protection".', 'SUP', ['UGACHICK_PAGES'], 'Report §11.2', 'Ugachick'),
      v('Some chicks were reported supplied unvaccinated.', 'INT', ['FAO_2022'], 'Report §3'),
    ],
    sourceDifferences: 'Vaccination programmes differ between sources, which is why PoultryStart shows none.',
    limits: 'No vaccination schedule and no vaccine-handling instructions (approved C-3).',
    referral: 'Ask your vet or hatchery about every vaccination programme and handling question.',
    evidenceLabels: ['SUP', 'INT'],
    keywords: ['vaccination', 'vaccine', 'certificate', 'hatchery', 'programme'],
    related: ['G-ALL-PREP-02'],
  },
  {
    code: 'G-ALL-HEALTH-04', title: 'Medicines and waiting periods', topic: 'health_monitoring', poultryType: 'all',
    stages: ALL_BIRD_STAGES,
    summary: 'Medicines are a vet\'s decision, and some need a waiting period before birds are sold.',
    steps: [
      'Use only medicines a vet has advised, as instructed.',
      'If your birds were given any medicine, ask your vet about waiting periods before selling birds, and whether this affects eggs.',
    ],
    values: [
      v('Waiting periods before sale: MAAIF/ILRI Annex 10 is linked, without figures.', 'UG', ['MAAIF_ILRI_2023'], 'Report §13.4'),
      v('MAAIF Veterinary Treatment Guidelines: linked, not quoted.', 'UG', ['MAAIF_TREATMENT'], 'Report §19'),
    ],
    sourceDifferences: null,
    limits: 'No medicine names, doses or waiting times are given. Eggs are mentioned only as a question for your vet.',
    referral: 'Ask your vet.',
    evidenceLabels: ['UG', 'PG'],
    keywords: ['medicine', 'waiting period', 'withdrawal', 'vet', 'sale'],
    related: ['G-BR-FLOCK-01'],
  },

  // ===== Daily activities =====
  {
    code: 'G-BR-DAILY-01', title: 'A day and week on a broiler farm', topic: 'daily_activities', poultryType: 'broiler',
    stages: { broiler: ['brooding', 'growing', 'sale'] },
    summary: 'The routine behind PoultryStart\'s daily and weekly broiler tasks.',
    steps: [
      'Each day: morning flock check; feed and water checks; dead birds; litter inspection; midday house check; footbath; evening farm check; records review.',
      'Each week: weighing from week 2 (from age day 14); feed and water review; health review; house inspection.',
      'Litter: a reminder every 3 days to turn wet or caked patches if found; a top-up every 14 days.',
      'In the sale week, the routine continues alongside the sale tasks.',
    ],
    values: [
      v('Weekly weighing from week 2 (from age day 14).', 'INT', ['ROSS_2025'], 'Approved task TW-01'),
      v('Litter reminders every 3 days and a top-up every 14 days.', 'PG', ['POULTRYSTART'], 'Approved tasks TI-01 and TW-07'),
      v('Daily and weekly routine (frequencies).', 'PG', ['POULTRYSTART'], 'Approved task catalogue TD-01..TD-10, TW-01..TW-04'),
    ],
    sourceDifferences: null,
    limits: 'The routine frequencies are PoultryStart practice guidance.',
    referral: 'Weekly health review (task TW-04).',
    evidenceLabels: ['UG', 'INT', 'PG'],
    keywords: ['routine', 'daily', 'weekly', 'tasks', 'broiler'],
    related: [],
  },
  {
    code: 'G-LY-DAILY-01', title: 'A day and week on a layer farm', topic: 'daily_activities', poultryType: 'layer',
    stages: { layer: ['brooding', 'rearing', 'pre_lay', 'laying'] },
    summary: 'The routine behind PoultryStart\'s daily and weekly layer tasks.',
    steps: [
      'The same daily routine as on a broiler farm, with weighing from week 4 (from age day 28).',
      'First-egg checks from week 18.',
      'Three egg collections a day once laying starts.',
      'Evening nest care.',
      'A weekly egg production review.',
    ],
    values: [
      v('Weekly weighing from week 4 (from age day 28).', 'INT', ['HYLINE_GUIDE'], 'Approved task TW-01'),
      v('First-egg checks from week 18.', 'PD', ['POULTRYSTART'], 'Approved task TL-04'),
      v('Three egg collections a day.', 'PD', ['POULTRYSTART'], 'Approved tasks TE-01..TE-03 (decision D-T8)'),
      v('Daily and weekly routine (frequencies).', 'PG', ['POULTRYSTART'], 'Approved tasks TE-03, TW-06'),
    ],
    sourceDifferences: null,
    limits: null,
    referral: 'Weekly health review (task TW-04).',
    evidenceLabels: ['UG', 'INT', 'PD', 'PG'],
    keywords: ['routine', 'daily', 'weekly', 'tasks', 'layer', 'eggs'],
    related: [],
  },
].map((article, index) => Object.freeze({
  notice: null,
  ...article,
  sortOrder: index + 1,
  contentVersion: 1,
  reviewedOn: REVIEWED_ON,
}));

// Fixed guidance links on the generated Daily Tasks (approved GD10): task
// template code -> article codes. { broiler, layer } picks by the flock's
// (or farm's) poultry type. No advice is generated: these are links only.
const TASK_GUIDANCE = Object.freeze({
  'TD-01': ['G-ALL-HEALTH-01'],
  'TD-02': [{ broiler: 'G-BR-FEED-01', layer: 'G-LY-FEED-01' }, 'G-ALL-FEED-02'],
  'TD-03': [{ broiler: 'G-BR-WATER-01', layer: 'G-LY-WATER-01' }, 'G-ALL-WATER-02'],
  'TD-04': ['G-ALL-FLOCK-02'],
  'TD-05': ['G-ALL-HOUSE-02'],
  'TD-06': ['G-ALL-HOUSE-03'],
  'TD-08': ['G-ALL-HYG-01'],
  'TD-09': ['G-ALL-HYG-01', { layer: 'G-LY-FLOCK-02' }],
  'TD-10': ['G-ALL-FLOCK-02'],
  'TB-01': ['G-ALL-PREP-02'],
  'TB-02': ['G-ALL-BROOD-02'],
  'TB-03': ['G-ALL-BROOD-02'],
  'TB-04': [{ broiler: 'G-BR-BROOD-01', layer: 'G-LY-BROOD-01' }, 'G-ALL-BROOD-02'],
  'TB-05': [{ broiler: 'G-BR-BROOD-01', layer: 'G-LY-BROOD-01' }],
  'TB-07': [{ broiler: 'G-BR-BROOD-01', layer: 'G-LY-BROOD-01' }],
  'TI-01': ['G-ALL-HOUSE-02'],
  'TW-07': ['G-ALL-HOUSE-02'],
  'TW-01': ['G-ALL-FLOCK-01'],
  'TW-02': [{ broiler: 'G-BR-FEED-01', layer: 'G-LY-FEED-02' }, { broiler: 'G-BR-WATER-01', layer: 'G-LY-WATER-01' }],
  'TW-03': ['G-ALL-HYG-01'],
  'TW-04': ['G-ALL-HEALTH-02'],
  'TW-05': ['G-ALL-FEED-02'],
  'TW-06': ['G-LY-FLOCK-03'],
  'TL-01': ['G-LY-HOUSE-01'],
  'TL-02': ['G-LY-HOUSE-01'],
  'TL-03': ['G-LY-FLOCK-02'],
  'TL-04': ['G-LY-FLOCK-03'],
  'TE-01': ['G-LY-FLOCK-03'],
  'TE-02': ['G-LY-FLOCK-03'],
  'TE-03': ['G-LY-FLOCK-03'],
  'TP-01': ['G-BR-FEED-01'],
  'TP-02': ['G-BR-FEED-01'],
  'TP-03': ['G-BR-FEED-01'],
  'TP-04': ['G-ALL-HEALTH-04'],
  'TP-05': ['G-BR-FLOCK-01'],
  'TP-06': ['G-BR-FLOCK-01'],
  'TP-07': ['G-BR-FLOCK-01'],
  'TP-08': ['G-BR-FLOCK-01'],
  'TP-09': ['G-LY-FEED-01'],
  'TP-10': ['G-LY-FEED-01'],
  'TP-11': ['G-LY-FLOCK-01'],
  'TP-12': ['G-LY-FEED-01'],
  'TP-13': ['G-ALL-HYG-02'],
});

// The guidance article codes linked to a task template for a poultry type.
function guidanceCodesForTask(templateCode, poultryType) {
  return (TASK_GUIDANCE[templateCode] || [])
    .map((entry) => (typeof entry === 'string' ? entry : entry[poultryType]))
    .filter(Boolean);
}

// The marker and qualification of a stage (null when the stage has none).
function stageQualification(poultryType, stage) {
  const marker = STAGE_MARKERS[poultryType]?.[stage];
  return marker ? { marker, qualification: MARKERS[marker].qualification } : null;
}

// A figure as stored and returned: its marker's qualification is printed
// beside it ({supplier} filled in), with the names of its sources.
function presentValue(value) {
  const marker = MARKERS[value.marker];
  return {
    text: value.text,
    label: marker.label,
    qualification: marker.qualification ? marker.qualification.replace('{supplier}', value.supplier || 'the supplier') : null,
    sources: value.sources.map((key) => SOURCES[key].name),
    reference: value.reference,
  };
}

// Plain text of an article (the searchable "content" column).
function plainText(article) {
  return [
    article.summary, article.notice, ...article.steps, ...article.values.map((x) => x.text),
    article.sourceDifferences, article.limits, article.referral,
  ].filter(Boolean).join('\n');
}

// The table rows for all articles (used by the start-up sync).
function guidanceRows() {
  return ARTICLES.map((a) => {
    const sourceKeys = [...new Set(a.values.flatMap((x) => x.sources))];
    return {
      code: a.code,
      title: a.title,
      topic: a.topic,
      poultryType: a.poultryType,
      content: plainText(a),
      source: sourceKeys.map((key) => SOURCES[key].name).join('; '),
      summary: a.summary,
      stages: JSON.stringify(a.stages),
      steps: JSON.stringify(a.steps),
      keyValues: JSON.stringify(a.values.map(presentValue)),
      notice: a.notice,
      evidenceLabels: JSON.stringify(a.evidenceLabels),
      sources: JSON.stringify(sourceKeys.map((key) => ({ key, name: SOURCES[key].name, type: SOURCES[key].type }))),
      sourceDifferences: a.sourceDifferences,
      strainNote: a.limits,
      referral: a.referral,
      relatedCodes: JSON.stringify(a.related || []),
      keywords: JSON.stringify(a.keywords),
      contentVersion: a.contentVersion,
      reviewedOn: a.reviewedOn,
      sortOrder: a.sortOrder,
    };
  });
}

module.exports = {
  CATALOGUE, GUIDANCE_DISCLAIMER, TOPICS, POULTRY_TYPES, STAGES, EVIDENCE_LABELS, MARKERS, SOURCES, SOURCE_TYPES,
  ARTICLES, TASK_GUIDANCE, guidanceCodesForTask, guidanceRows, presentValue, FIRST_DAY_WATER, EGG_STORAGE_GAP,
  SALE_STAGE_DAYS, STAGE_MARKERS, stageQualification,
};
