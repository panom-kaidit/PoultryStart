// Health observations:

// Shown with every health observation response (approved HD7).
const DISCLAIMER = 'PoultryStart only keeps your notes. It does not diagnose disease, recommend medicines or replace a ' +
  'veterinarian. If birds are sick or dying, or you suspect a serious disease, contact your veterinarian or extension ' +
  'officer straight away.';

const TEXT_MAX = 1000;

const FIELDS = Object.freeze(['observationDate', 'observation', 'birdsAffected', 'actionTaken', 'vetContacted',
  'extensionOfficerContacted']);

const MORTALITY_FIELDS = Object.freeze(['birdsLost', 'birdsDied', 'birdChange', 'mortality', 'deaths', 'deadBirds',
  'dead', 'died']);
const MORTALITY_MESSAGE = "Deaths are recorded in the flock's mortality form (POST /api/farms/:farmId/flocks/:flockId/movements " +
  'with movementType "mortality"). A health observation never changes the number of birds.';

module.exports = { DISCLAIMER, TEXT_MAX, FIELDS, MORTALITY_FIELDS, MORTALITY_MESSAGE };
