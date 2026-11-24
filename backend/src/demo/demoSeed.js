// Creates the fictional public demonstration account and its two demo farms through the app's own API, only when
// DEMO_SEED=true. Every run checks each expected demo record and creates only the missing ones, so a seed that
// failed partway is completed on the next start-up. Existing records are never overwritten, deleted or duplicated:
// the only changes to existing demo records are completing one generated demo task and setting the demo layer
// flock's first-egg date while it is still empty. Record dates are anchored to the demo flock's arrival date, so a
// retry on a later day looks for the same records. An existing demo email with another password is never used.
const { ugandaToday, addDays } = require('../utils/dates');

const DEMO_ACCOUNT = { name: 'Demo Farmer', email: 'demo@poultrystart.example' };
const DEFAULT_DEMO_PASSWORD = 'PoultryStart-Demo-2026';

const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const laterOf = (a, b) => (a > b ? a : b);

function apiClient(baseUrl) {
  let token = null;
  async function call(method, path, body) {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    return { status: res.status, data: json?.data, error: json?.error };
  }
  async function must(method, path, body) {
    const result = await call(method, path, body);
    if (result.status < 200 || result.status >= 300) {
      const details = (result.error?.details || []).map((d) => `${d.field}: ${d.message}`).join('; ');
      throw new Error(`${method} ${path} -> ${result.status} ${result.error?.message || ''}${details ? ` (${details})` : ''}`);
    }
    return result.data;
  }
  return { call, must, setToken: (value) => { token = value; } };
}

async function signIn(api, password, log) {
  const login = await api.call('POST', '/auth/login', { email: DEMO_ACCOUNT.email, password });
  if (login.status === 200) { api.setToken(login.data.token); return true; }
  const registered = await api.call('POST', '/auth/register', { ...DEMO_ACCOUNT, password });
  if (registered.status === 201) { api.setToken(registered.data.token); return true; }
  log(`Demo seed skipped: ${DEMO_ACCOUNT.email} exists with a different password (nothing was changed).`);
  return false;
}

async function ensureEach(api, { listPath, listKey, items, keyOf, createPath }) {
  const existing = new Set(((await api.must('GET', listPath))[listKey] || []).map(keyOf));
  let created = 0;
  for (const item of items) {
    if (existing.has(keyOf(item))) continue;
    await api.must('POST', createPath, item);
    existing.add(keyOf(item));
    created++;
  }
  return created;
}

async function ensureFlock(api, farmId, spec) {
  const { flocks } = await api.must('GET', `/farms/${farmId}/flocks`);
  const found = flocks.find((f) => f.name === spec.flock.name);
  if (found) return { flock: found, created: 0 };
  const { flock } = await api.must('POST', `/farms/${farmId}/flocks`, { ...spec.flock, arrivalDate: addDays(ugandaToday(), -spec.seedDayAfterArrival) });
  return { flock, created: 1 };
}

async function ensureFlockRecords(api, farmId, flock, spec) {
  const base = `/farms/${farmId}/flocks/${flock.id}`;
  const day = (offset) => addDays(flock.arrivalDate, spec.seedDayAfterArrival + offset);
  const window = `?from=${flock.arrivalDate}&to=${day(0)}`;
  let created = 0;

  if (spec.firstEggOffset !== undefined && !flock.firstEggDate) {
    await api.must('PATCH', base, { firstEggDate: day(spec.firstEggOffset) });
    created++;
  }
  created += await ensureEach(api, {
    listPath: `${base}/movements`, listKey: 'movements', createPath: `${base}/movements`,
    items: spec.deaths.map(([offset, birds]) => ({ movementType: 'mortality', birdChange: -birds, movementDate: day(offset) })),
    keyOf: (m) => `${m.movementType}|${m.movementDate}|${m.birdChange}`,
  });
  for (const [type, items, keyOf] of spec.records(day)) {
    created += await ensureEach(api, { listPath: `${base}/records/${type}${window}`, listKey: 'records', createPath: `${base}/records/${type}`, items, keyOf });
  }
  created += await ensureEach(api, {
    listPath: `${base}/records/health${window}`, listKey: 'observations', createPath: `${base}/records/health`,
    items: spec.health(day), keyOf: (o) => `${o.observationDate}|${o.observation}`,
  });
  created += await ensureEach(api, {
    listPath: `/farms/${farmId}/expenses${window}&includeVoided=true`, listKey: 'expenses', createPath: `/farms/${farmId}/expenses`,
    items: spec.expenses(day, flock.id), keyOf: (e) => `${e.expenseDate}|${e.description}|${e.amount}`,
  });
  return { created, day };
}

async function ensureTasks(api, farmId, flock, day, spec) {
  const { tasks } = await api.must('GET', `/farms/${farmId}/tasks`);
  let created = 0;
  for (const custom of spec.customTasks || []) {
    if (tasks.some((t) => t.source === 'custom' && t.title === custom.title)) continue;
    await api.must('POST', `/farms/${farmId}/tasks`, { title: custom.title, flockId: flock.id, dueDate: laterOf(day(custom.dueOffset), ugandaToday()) });
    created++;
  }
  if (!tasks.some((t) => t.status === 'completed' && t.completionNotes === spec.completionNote)) {
    const open = tasks.find((t) => t.source === 'generated' && t.status === 'pending' && t.dueDate === ugandaToday());
    if (open) {
      await api.must('POST', `/farms/${farmId}/tasks/${open.id}/complete`, { notes: spec.completionNote });
      created++;
    }
  }
  return created;
}

const DEMO_FARMS = [
  {
    farm: {
      name: 'Demo Broiler Farm', location: 'Mukono, Uganda', poultryType: 'broiler', numberOfBirds: 500, experienceLevel: 'beginner',
      houseStatus: 'existing', houseLengthM: 20, houseWidthM: 10, nonUsableAreaM2: 5, currency: 'UGX', startAssessment: true,
    },
    flock: { poultryType: 'broiler', name: 'Broiler Batch 1', birdsReceived: 500, supplier: 'Demo Hatchery (fictional)' },
    seedDayAfterArrival: 20,
    deaths: [[-16, 3], [-5, 2]],
    records: (day) => [
      ['weights', [[-13, 340], [-6, 710]].map(([o, g]) => ({ recordDate: day(o), sampleSize: 20, averageWeight: g, unit: 'g' })), (r) => r.recordDate],
      ['feed', range(-5, -1).map((o) => ({ recordDate: day(o), feedStage: 'starter', quantity: 42 + o, unit: 'kg', measurementMethod: 'measured' })), (r) => `${r.recordDate}|${r.feedStage}`],
      ['water', range(-5, -1).map((o) => ({ recordDate: day(o), quantity: 88 + o, unit: 'L', measurementMethod: 'measured' })), (r) => r.recordDate],
    ],
    health: (day) => [{
      observationDate: day(-3),
      observation: 'Four chicks near the drinker were sleepy and fluffed up in the morning.',
      birdsAffected: 4,
      actionTaken: 'Moved them closer to the brooder and checked the drinkers.',
      extensionOfficerContacted: true,
    }],
    expenses: (day, flockId) => [
      { expenseDate: day(-20), category: 'chicks', amount: 1400000, description: '500 day-old broiler chicks', flockId },
      { expenseDate: day(-15), category: 'feed', amount: 900000, description: '6 bags of broiler starter', flockId },
      { expenseDate: day(-7), category: 'labour', amount: 150000, description: 'Farm helper, one week' },
    ],
    customTasks: [{ title: 'Order broiler finisher feed', dueOffset: 2 }],
    completionNote: 'Done before 8 am; the chicks were active and eating.',
  },
  {
    farm: {
      name: 'Demo Layer Farm', location: 'Wakiso, Uganda', poultryType: 'layer', numberOfBirds: 300, experienceLevel: 'some_experience',
      startingStage: 'point_of_lay', startingAgeWeeks: 18, houseStatus: 'existing', houseLengthM: 15, houseWidthM: 8, nonUsableAreaM2: 4,
      currency: 'UGX', startAssessment: true,
    },
    flock: { poultryType: 'layer', name: 'Layer Flock 1', birdsReceived: 300, startingStage: 'point_of_lay', ageAtArrivalWeeks: 18 },
    seedDayAfterArrival: 70,
    firstEggOffset: -42,
    deaths: [[-20, 1]],
    records: (day) => [
      ['eggs', range(-6, 0).map((o) => ({ recordDate: day(o), collectionPeriod: 'morning', goodEggs: 245 + o, secondGradeEggs: 4, floorEggs: 2 })), (r) => `${r.recordDate}|${r.collectionPeriod}`],
      ['feed', range(-5, -1).map((o) => ({ recordDate: day(o), feedStage: 'layer', quantity: 34, unit: 'kg', measurementMethod: 'estimated' })), (r) => `${r.recordDate}|${r.feedStage}`],
      ['water', range(-5, -1).map((o) => ({ recordDate: day(o), quantity: 62, unit: 'L', measurementMethod: 'measured' })), (r) => r.recordDate],
    ],
    health: (day) => [{
      observationDate: day(-6),
      observation: 'A few hens were pecking at feathers near the feeder.',
      birdsAffected: 3,
      actionTaken: 'Added a second feeder to reduce crowding.',
    }],
    expenses: (day, flockId) => [
      { expenseDate: day(-12), category: 'feed', amount: 1700000, description: '10 bags of layers mash', flockId },
      { expenseDate: day(-4), category: 'equipment', amount: 85000, description: 'Egg trays', flockId },
    ],
    customTasks: [],
    completionNote: 'All hens looked active; feeders and drinkers were fine.',
  },
];

async function ensureFarm(api, farms, spec) {
  let created = 0;
  let farm = farms.find((f) => f.name === spec.farm.name);
  if (!farm) {
    ({ farm } = await api.must('POST', '/farms', spec.farm));
    created++;
  }
  const { flock, created: flockCreated } = await ensureFlock(api, farm.id, spec);
  const { created: recordsCreated, day } = await ensureFlockRecords(api, farm.id, flock, spec);
  const tasksCreated = await ensureTasks(api, farm.id, flock, day, spec);
  return created + flockCreated + recordsCreated + tasksCreated;
}

async function seedDemoData(baseUrl, { password = DEFAULT_DEMO_PASSWORD, log = console.log } = {}) {
  const api = apiClient(baseUrl);
  if (!(await signIn(api, password, log))) return { skipped: true, created: {}, failed: [] };
  const { farms } = await api.must('GET', '/farms');
  const created = {};
  const failed = [];
  for (const spec of DEMO_FARMS) {
    try {
      created[spec.farm.name] = await ensureFarm(api, farms, spec);
    } catch (err) {
      failed.push(spec.farm.name);
      log(`Demo seed incomplete for ${spec.farm.name}: ${err.message} (missing records will be added on the next start-up).`);
    }
  }
  const total = Object.values(created).reduce((a, b) => a + b, 0);
  const summary = Object.entries(created).map(([name, n]) => `${name}: ${n}`).join(', ');
  if (total) log(`Demo data created or completed (${summary}) for ${DEMO_ACCOUNT.email}.`);
  else if (!failed.length) log('Demo data already present: nothing created.');
  return { skipped: false, created, failed };
}

module.exports = { seedDemoData, DEMO_ACCOUNT, DEFAULT_DEMO_PASSWORD };
