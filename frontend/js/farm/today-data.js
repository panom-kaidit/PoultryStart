// Data helpers for the Today screen.
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const asDate = (iso) => new Date(`${iso}T00:00:00Z`);

export function addDaysIso(iso, days) {
  const d = asDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function longDate(iso) {
  const d = asDate(iso);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

export const shortDay = (iso) => SHORT_DAYS[asDate(iso).getUTCDay()];

export function lastDays(today, count = 7) {
  return Array.from({ length: count }, (_, i) => addDaysIso(today, i - (count - 1)));
}

export function dayValue(summary, date, field = 'total') {
  const day = (summary?.days || []).find((d) => d.date === date);
  return day ? { recorded: true, value: day[field], measurement: day.measurement } : { recorded: false };
}

export function series(summary, today, field = 'total', count = 7) {
  return lastDays(today, count).map((date) => {
    const v = dayValue(summary, date, field);
    return { date, value: v.recorded ? v.value : null };
  });
}

export const eggsEligible = (flock, today) => flock.poultryType === 'layer' && Boolean(flock.firstEggDate) && flock.firstEggDate <= today;

export function pickFlock(active, flockId) {
  if (!active.length) return null;
  return active.find((f) => String(f.id) === String(flockId)) || active[0];
}

export function mergeFlocks(flocks, adviceFlocks = []) {
  const ages = new Map(adviceFlocks.map((f) => [f.id, f]));
  return flocks.filter((f) => f.status === 'active').map((f) => {
    const a = ages.get(f.id) || {};
    return { ...f, ageWeeks: a.ageWeeks ?? null, ageDays: a.ageDays ?? null, stageLabel: a.stageLabel ?? null };
  });
}

export function getStartedSteps({ role, readiness, hasFlockEver, canAddFlock }) {
  const steps = [{ key: 'farm', done: true }];
  if (role !== 'worker') {
    const done = readiness?.status === 'ready';
    steps.push({ key: 'readiness', done, gaps: readiness?.gaps ?? null, status: readiness?.status || 'not_started' });
  }
  steps.push({ key: 'flock', done: false, canAddFlock, hasFlockEver });
  steps.push({ key: 'record', done: false });
  return { steps, done: steps.filter((s) => s.done).length, total: steps.length };
}

export function deathsText(mortalityFlock) {
  if (!mortalityFlock) return null;
  if (mortalityFlock.netDeaths === null) return 'No deaths recorded in the last 7 days';
  return `${mortalityFlock.netDeaths} died in the last 7 days`;
}

export function pickArticles(articles, poultryType, count = 1) {
  const fits = articles.filter((a) => a.poultryType === poultryType || a.poultryType === 'all');
  return [...fits.filter((a) => a.poultryType === poultryType), ...fits.filter((a) => a.poultryType === 'all')].slice(0, count);
}
