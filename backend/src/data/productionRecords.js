// Defines production record types, units and input limits.
const RECORD_TYPES = Object.freeze({
  weight: { path: 'weights', label: 'Bird weight record', table: 'weight_records' },
  eggs: { path: 'eggs', label: 'Egg collection record', table: 'egg_collection_records' },
  feed: { path: 'feed', label: 'Feed consumption record', table: 'feed_consumption_records' },
  water: { path: 'water', label: 'Drinking-water consumption record', table: 'water_consumption_records' },
});
const TYPE_OF_PATH = Object.freeze(Object.fromEntries(Object.entries(RECORD_TYPES).map(([type, t]) => [t.path, type])));

const FEED_STAGES = Object.freeze({
  broiler: ['starter', 'grower', 'finisher', 'other', 'unknown'],
  layer: ['starter', 'grower', 'pre_lay', 'layer', 'other', 'unknown'],
});

const COLLECTION_PERIODS = Object.freeze(['morning', 'midday', 'evening', 'extra']);

const EGG_CATEGORIES = Object.freeze({
  goodEggs: 'Clean, whole eggs collected from the nests.',
  secondGradeEggs: 'Cracked, dirty or misshapen eggs collected from the nests (second grade).',
  floorEggs: 'Eggs laid outside the nests (on the floor), whatever their condition. They are handled separately.',
});

const MEASUREMENT_METHODS = Object.freeze(['measured', 'estimated']);
const WEIGHT_UNITS = Object.freeze(['g', 'kg']);
const FEED_UNITS = Object.freeze(['kg', 'g']);
const WATER_UNITS = Object.freeze(['L', 'ml']);

const LIMITS = Object.freeze({
  birdWeightG: { min: 10, max: 10000 },
  individualWeights: 500,
  eggsPerRecord: 100000,
  feedKg: 100000,
  waterLitres: 1000000,
});

const MAX_RANGE_DAYS = 366;
const DEFAULT_RANGE_DAYS = 31;

const ACTUAL_RECORDS_NOTE = 'These are the quantities recorded on this farm. PoultryStart does not fill them in from ' +
  'research estimates and does not compare them with targets.';

module.exports = {
  RECORD_TYPES, TYPE_OF_PATH, FEED_STAGES, COLLECTION_PERIODS, EGG_CATEGORIES, MEASUREMENT_METHODS,
  WEIGHT_UNITS, FEED_UNITS, WATER_UNITS, LIMITS, MAX_RANGE_DAYS, DEFAULT_RANGE_DAYS, ACTUAL_RECORDS_NOTE,
};
