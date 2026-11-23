

const AREAS = ['housing', 'equipment', 'feed', 'water', 'other'];
const ANSWERS = ['yes', 'no', 'partly'];
const OLDER_LAYERS = ['pullet', 'point_of_lay'];

// Deadlines. ageWeeks = the bird age by which it must be in place; a flock
// that arrives at or after that age needs it before arrival.
const NEEDED_BY = {
  chick_arrival: { label: 'Before the birds arrive', ageWeeks: 0 },
  before_transfer: { label: 'Before moving the birds to the laying house (about weeks 15-17)', ageWeeks: 15 },
  before_first_egg: { label: 'Before the first egg (about week 18 for layers)', ageWeeks: 18 },
  before_sale: { label: 'Before the expected selling period (final week of the broiler cycle)', ageWeeks: null },
};

const VERIFY_OLDER_BIRDS =
  'Not covered by the PoultryStart research for Uganda: confirm with the supplier, a local ' +
  'extension officer or a veterinarian.';

// poultryType: which farms see the question
const READINESS_QUESTIONS = [
  // Housing
  { code: 'Q01', area: 'housing', poultryType: 'all', required: true,
    text: 'Is the poultry house cleaned and dried before the birds arrive?' },
  { code: 'Q02', area: 'housing', poultryType: 'all', required: true,
    text: 'Does the house keep out rain, strong wind and direct sun while allowing fresh air?' },
  { code: 'Q03', area: 'housing', poultryType: 'all', required: true,
    text: 'Is the house protected against predators and theft?' },
  { code: 'Q04', area: 'housing', poultryType: 'all', required: true,
    text: 'Is there enough floor space for the number of birds you plan to keep?' },

  // Equipment
  { code: 'Q05', area: 'equipment', poultryType: 'all', required: true,
    text: 'Are there enough feeders and drinkers for the number of birds?' },
  { code: 'Q06', area: 'equipment', poultryType: 'broiler', required: true, startingStages: ['day_old'],
    text: 'For broiler farmers: Have you tested the heat source in the brooding area before the chicks arrive?' },
  { code: 'Q07', area: 'equipment', poultryType: 'layer', required: false, startingStages: ['day_old'],
    text: 'For layer farmers starting with young chicks: Have you tested the heat source in the brooding area before the chicks arrive?' },

  // Feed
  { code: 'Q08', area: 'feed', poultryType: 'all', required: true,
    text: 'Have you found a reliable supplier of poultry feed near you?' },
  { code: 'Q09', area: 'feed', poultryType: 'broiler', required: true,
    text: 'For broiler farmers: Do you know which feed broilers need at each stage, such as starter and finisher?' },
  { code: 'Q10', area: 'feed', poultryType: 'layer', required: true,
    text: 'For layer farmers: Do you know which feed layers need at each stage, such as chick, grower and layer feed?' },
  { code: 'Q11', area: 'feed', poultryType: 'all', required: true,
    text: 'Have you budgeted for feed until the flock is sold or starts laying?' },

  // Water
  { code: 'Q12', area: 'water', poultryType: 'all', required: true,
    text: 'Do you have a reliable source of clean water every day?' },
  { code: 'Q13', area: 'water', poultryType: 'all', required: true,
    text: 'Can you store enough water for at least one day if the supply stops?' },
  { code: 'Q14', area: 'water', poultryType: 'all', required: false,
    text: 'Is the water source close enough to refill the drinkers easily?' },

  // Other preparation areas
  { code: 'Q15', area: 'other', poultryType: 'all', required: true, startingStages: ['day_old'],
    text: 'Have you found a reliable source of healthy chicks, such as a registered hatchery?' },
  { code: 'Q16', area: 'other', poultryType: 'all', required: true,
    text: 'Do you know a veterinarian or agricultural extension officer you can contact for advice?' },

  { code: 'Q17', area: 'equipment', poultryType: 'all', required: true, startingStages: ['day_old'],
    text: 'Is a thermometer available to monitor temperature at chick level?' },
  { code: 'Q18', area: 'other', poultryType: 'all', required: true,
    text: 'Who will be responsible for daily poultry management?',
    helpText: 'Answer "yes" once a person has been named, and write their name in the notes.' },
  { code: 'Q19', area: 'other', poultryType: 'all', required: true, startingStages: ['day_old'],
    text: 'Have you obtained or arranged to obtain the hatchery vaccination records?' },
  { code: 'Q20', area: 'other', poultryType: 'broiler', required: true, neededBy: 'before_sale',
    text: 'Have you identified potential buyers or a market for your birds before the expected selling period?' },
  { code: 'Q21', area: 'housing', poultryType: 'layer', required: true, neededBy: 'before_transfer',
    text: 'Is there a plan for the laying house or transfer to the laying facility?' },
  { code: 'Q22', area: 'housing', poultryType: 'layer', required: true, neededBy: 'before_first_egg',
    text: 'Will nests be ready before the birds begin laying?' },
  { code: 'Q23', area: 'other', poultryType: 'layer', required: true, startingStages: OLDER_LAYERS,
    text: 'Have you found a reliable source of healthy pullets of the age you plan to buy?',
    verificationNote: VERIFY_OLDER_BIRDS },
  { code: 'Q24', area: 'other', poultryType: 'layer', required: true, startingStages: OLDER_LAYERS,
    text: 'Have you obtained or arranged to obtain the vaccination records for the pullets from the supplier?',
    verificationNote: VERIFY_OLDER_BIRDS },
];

// For each poultry type: 'required', 'optional', or null (item not shown).
const DEFAULT_CHECKLIST = [
  // Housing
  { category: 'housing', itemName: 'Poultry house or shelter', broiler: 'required', layer: 'required' },
  { category: 'housing', itemName: 'Litter or bedding material, such as wood shavings', broiler: 'required', layer: 'required' },
  { category: 'housing', itemName: 'Wire mesh or fencing against predators', broiler: 'required', layer: 'required' },
  { category: 'housing', itemName: 'Chick guard (brooding surround)', broiler: 'required', layer: 'optional', startingStages: ['day_old'] },
  { category: 'housing', itemName: 'Laying nests', broiler: null, layer: 'optional', neededBy: 'before_first_egg',
    requiredIfNeededBeforeArrival: true },

  // Equipment
  { category: 'equipment', itemName: 'Feeders', broiler: 'required', layer: 'required' },
  { category: 'equipment', itemName: 'Drinkers', broiler: 'required', layer: 'required' },
  { category: 'equipment', itemName: 'Heat source for brooding, such as charcoal stove, gas or electric brooder', broiler: 'required', layer: 'optional', startingStages: ['day_old'] },
  { category: 'equipment', itemName: 'Cleaning tools, such as broom, buckets and spade', broiler: 'required', layer: 'required' },
  { category: 'equipment', itemName: 'Lighting for the poultry house', broiler: 'optional', layer: 'optional' },
  { category: 'equipment', itemName: 'Footbath or disinfectant at the house entrance', broiler: 'optional', layer: 'optional' },
  { category: 'equipment', itemName: 'Weighing scale', broiler: 'optional', layer: 'optional' },
  { category: 'equipment', itemName: 'Egg trays', broiler: null, layer: 'optional', neededBy: 'before_first_egg',
    requiredIfNeededBeforeArrival: true },

  // Feed
  { category: 'feed', itemName: 'Starter or chick feed for the first weeks', broiler: 'required', layer: 'required', startingStages: ['day_old'] },
  { category: 'feed', itemName: "Feed suited to the birds' age on arrival (chick, grower, pre-lay or layer feed)", broiler: null, layer: 'required', startingStages: OLDER_LAYERS },
  { category: 'feed', itemName: 'Raised or sealed feed storage, safe from rain and rodents', broiler: 'required', layer: 'required' },

  // Water
  { category: 'water', itemName: 'Water source, such as tap, borehole, tank or rainwater', broiler: 'required', layer: 'required' },
  { category: 'water', itemName: 'Water storage container or tank', broiler: 'required', layer: 'required' },

  // Other
  { category: 'other', itemName: 'Protective boots or clothing kept for farm use', broiler: 'optional', layer: 'optional' },
];

const appliesToStage = (entry, startingStage) =>
  !entry.startingStages || entry.startingStages.includes(startingStage);

// True if the birds arrive at or after the item's deadline age.
function neededBeforeArrival(neededBy, arrivalAgeWeeks) {
  const deadline = NEEDED_BY[neededBy || 'chick_arrival'];
  return deadline.ageWeeks != null && arrivalAgeWeeks >= deadline.ageWeeks;
}


function defaultChecklistFor(poultryType, startingStage = 'day_old', arrivalAgeWeeks = 0) {
  return DEFAULT_CHECKLIST
    .filter((item) => item[poultryType] != null && appliesToStage(item, startingStage))
    .map((item) => ({
      category: item.category,
      itemName: item.itemName,
      isRequired: item[poultryType] === 'required'
        || (item.requiredIfNeededBeforeArrival === true && neededBeforeArrival(item.neededBy, arrivalAgeWeeks)),
      neededBy: item.neededBy || 'chick_arrival',
    }));
}

module.exports = {
  AREAS,
  ANSWERS,
  NEEDED_BY,
  READINESS_QUESTIONS,
  DEFAULT_CHECKLIST,
  defaultChecklistFor,
  appliesToStage,
};
