// The stage at which a farmer starts a flock 

const STARTING_STAGES = {
  broiler: {
    day_old: { label: 'Day-old chicks', minWeeks: 0, maxWeeks: 0 },
  },
  layer: {
    day_old: { label: 'Day-old chicks', minWeeks: 0, maxWeeks: 0 },
    pullet: { label: 'Pullets (growing birds)', minWeeks: 7, maxWeeks: 14 },
    point_of_lay: { label: 'Point-of-lay pullets', minWeeks: 15, maxWeeks: 20 },
  },
};

// Used for farms and assessments created before starting stages existed.
const DEFAULT_STARTING_STAGE = 'day_old';

const LIMITATIONS = {
  olderBirds:
    'The PoultryStart research report does not establish Uganda-specific requirements for buying ' +
    'pullets or point-of-lay birds (sourcing, prices, health checks or vaccination history). ' +
    'Confirm these with the supplier, a local extension officer or a veterinarian.',
  ageRanges:
    'The age ranges for pullets (weeks 7-14) and point-of-lay pullets (weeks 15-20) are PoultryStart ' +
    'planning definitions based on the report, not official trade standards or Ugandan legal requirements.',
};

module.exports = { STARTING_STAGES, DEFAULT_STARTING_STAGE, LIMITATIONS };
