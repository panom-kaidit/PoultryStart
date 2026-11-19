// Calculates deaths after corrections from flock movements.
const flockMovementModel = require('../models/flockMovementModel');

function mortalityByDay(movements, from, to) {
  const corrections = new Map();
  for (const m of movements) {
    if (m.movementType === 'correction' && m.correctsMovementId) {
      corrections.set(m.correctsMovementId, (corrections.get(m.correctsMovementId) || 0) + m.birdChange);
    }
  }
  const days = new Map();
  for (const m of movements) {
    if (m.movementType !== 'mortality' || m.movementDate < from || m.movementDate > to) continue;
    if (!days.has(m.movementDate)) days.set(m.movementDate, { date: m.movementDate, deaths: 0, mortalityRecords: 0, correctedRecords: 0 });
    const day = days.get(m.movementDate);
    const correction = corrections.get(m.id);
    const net = m.birdChange + (correction || 0);
    day.mortalityRecords += 1;
    if (correction !== undefined) day.correctedRecords += 1;
    if (net < 0) day.deaths -= net;
  }
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function deathsBetween(flockId, from, to) {
  const days = mortalityByDay(flockMovementModel.findAllForFlock(flockId), from, to).filter((d) => d.deaths > 0);
  return { days: days.map((d) => d.date), birds: days.reduce((sum, d) => sum + d.deaths, 0) };
}

module.exports = { mortalityByDay, deathsBetween };
