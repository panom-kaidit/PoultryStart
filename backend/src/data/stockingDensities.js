// Stocking densities used for the space and bird-capacity calculation.

const SOURCES = {
  MAAIF_2019: 'MAAIF Poultry Training Manual for Extension Workers in Uganda (Aug 2019) - Uganda official',
  MAAIF_ILRI_2023: 'MAAIF/ILRI Training manual on antimicrobial use and resistance for poultry CAHWs in Uganda (2023), Annex 4 - Uganda official',
  HYLINE_ALT_2026: 'Hy-Line Brown Alternative Systems Performance Standards (May 2026) - international breeder',
};

// Each stage: its age range in weeks for the "standard" and "conservative" modes. If the sources give no separate conservative
// value for a stage, both modes use the same value (stated in "note").
const STAGES = {
  broiler: [
    {
      stage: 'brooding',
      fromWeek: 0, toWeek: 1,
      label: 'Brooding (brooder ring)',
      age: 'day 0 to 13/14',
      density: { standard: 30, conservative: 30 },
      source: `${SOURCES.MAAIF_2019}, section 4.1.1 (30-40 chicks/m²; the report says to calculate at 30)`,
      note: 'The sources give no separate conservative value for brooding.',
    },
    {
      stage: 'growing',
      fromWeek: 2, toWeek: 4,
      label: 'Growing',
      age: 'about week 2 to 4',
      density: { standard: 25, conservative: 25 },
      source: `${SOURCES.MAAIF_2019}, section 4.5`,
      note: 'The sources give no separate conservative value for growing.',
    },
    {
      stage: 'finishing',
      fromWeek: 5, toWeek: null,
      label: 'Finishing (until sale)',
      age: 'weeks 5 to 6 (up to week 8)',
      density: { standard: 10, conservative: 6 },
      source: `Standard: ${SOURCES.MAAIF_2019}, sections 3.3.2 and 4.5 (10 birds/m²). ` +
        `Conservative: ${SOURCES.MAAIF_ILRI_2023} (5-6 birds/m² at weeks 5-8; the report uses 6)`,
      note: 'Sources conflict (10 vs 5-6). See DENSITY_SETTINGS.',
    },
  ],
  layer: [
    {
      stage: 'chick',
      fromWeek: 0, toWeek: 6,
      label: 'Chick (brooding)',
      age: 'weeks 0 to 6',
      density: { standard: 20, conservative: 20 },
      source: `${SOURCES.MAAIF_ILRI_2023}`,
      note: 'The sources give no separate conservative value for this stage.',
    },
    {
      stage: 'pullet',
      fromWeek: 7, toWeek: 13,
      label: 'Pullet (rearing)',
      age: 'weeks 7 to 13',
      density: { standard: 10, conservative: 10 },
      source: `${SOURCES.MAAIF_ILRI_2023}`,
      note: 'The sources give no separate conservative value for this stage.',
    },
    {
      stage: 'pullet_transfer',
      fromWeek: 14, toWeek: 18,
      label: 'Pullet before laying (transfer age)',
      age: 'weeks 14 to 18',
      density: { standard: 12, conservative: 12 },
      source: `${SOURCES.HYLINE_ALT_2026} (15 birds/m² at week 15 down to 12 at week 18; the report uses 12)`,
      note: 'PROVISIONAL INTERNATIONAL GUIDANCE, not a Ugandan standard. No Ugandan source covers ' +
        'weeks 14-18. Older pullets cannot need less space than younger ones, so this value is never ' +
        'allowed to exceed the locally supported pullet density (MAAIF/ILRI 2023, 10 birds/m²).',
      classification: 'international',
      provisional: true,

      notMoreThanStage: 'pullet',
    },
    {
      stage: 'laying',
      fromWeek: 19, toWeek: null,
      label: 'Mature laying hen',
      age: 'week 19 onwards',
      density: { standard: 6, conservative: 5 },
      source: `Standard: ${SOURCES.MAAIF_2019}, section 3.3.2 (6 birds/m²). ` +
        `Conservative: ${SOURCES.MAAIF_ILRI_2023} (5-7 birds/m²; the report uses 5)`,
      note: 'Sources conflict (6 vs 5-7). See DENSITY_SETTINGS.',
    },
  ],
};

// Which density mode a farm uses by default (configurable).

const DENSITY_SETTINGS = {
  modes: ['standard', 'conservative'],
  modeByExperience: {
    beginner: 'conservative',
    some_experience: 'standard',
    experienced: 'standard',
  },
  fallbackMode: 'standard', // if the experience level is unknown
  reasons: {
    conservative:
      'Conservative planning default for beginner farms (Evidence-Based Farm Requirements Report, ' +
      'sections 6.1 and 17, based on MAAIF/ILRI 2023). Chosen by PoultryStart for planning; ' +
      'not a legally mandated or universally accepted standard.',
    standard:
      'Standard planning default: MAAIF 2019 as the primary Uganda reference (Evidence-Based Farm ' +
      'Requirements Report, section 6.1). Chosen by PoultryStart for planning; not a legally ' +
      'mandated or universally accepted standard.',
  },
};

const PLANNING_DISCLAIMER =
  'This capacity is a planning recommendation based on published stocking densities for ' +
  'open-sided, deep-litter houses. It is not a guarantee of bird performance or farm success. ' +
  'Hot weather, poor ventilation or heavier birds need more space.';

module.exports = { STAGES, DENSITY_SETTINGS, PLANNING_DISCLAIMER, SOURCES };
