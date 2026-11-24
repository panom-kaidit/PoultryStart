// Guided setup steps 1 and 2: the birds and the poultry house.
import { h, setContent } from '../components/dom.js';
import { setFlash } from '../components/alerts.js';
import { guardSubmit, showErrors, clearErrors } from '../components/forms.js';
import { chipGroup, choiceCard, stepper, textField } from '../components/ui.js';
import { icon } from '../components/icons.js';
import { setupPage, setupFooter, setupButton, houseDiagram } from '../components/setup-layout.js';
import { createFarm, updateFarm } from '../api/farms.js';
import { listAssessments, startAssessment } from '../api/readiness.js';
import { setCurrentFarm } from '../farm/farm.js';
import { spaceCheck, lengthForBirds, PLANNING_DISCLAIMER } from '../farm/planning-rules.js';
import {
  setupState, setupStateForFarm, resetSetupState, valuesFromFarm, farmBody, birdsProblems, houseProblems, numberOrNull,
  changedFields, assessmentOutdated, ageRangeText, EXPERIENCE_CHOICES, LIMITS, STEP1_FIELDS, STEP2_FIELDS, keepAfterExpiry,
} from '../farm/setup-flow.js';
import { checklistStep } from './setup-checklist.js';
import { resultStep } from './setup-result.js';
import { navigate } from '../router.js';

const FIELD_LABELS = {
  name: 'Farm name', location: 'Location', poultryType: 'Type of birds', numberOfBirds: 'Number of birds',
  startingStage: 'Age on arrival', startingAgeWeeks: 'Age on arrival (weeks)', experienceLevel: 'Experience',
  houseStatus: 'Poultry house', houseLengthM: 'Length (inside)', houseWidthM: 'Width (inside)', nonUsableAreaM2: 'Space birds cannot use',
};
const fmt = (n) => (Math.round(n * 100) / 100).toLocaleString('en-GB');

function block(field, label, control, { hint, labelFor, legend = false } = {}) {
  const errorId = `setup-${field}-error`;
  const heading = legend
    ? h('p', { class: 'setup-question', id: `setup-${field}-label` }, label)
    : h('label', { class: 'setup-question', for: labelFor }, label);
  return h('div', { class: 'field setup-field', dataset: { field } },
    heading, control,
    hint ? h('p', { class: 'setup-hint' }, hint) : null,
    h('p', { class: 'field__error', id: errorId, hidden: true }));
}

function plainInput({ id, name, value, placeholder, maxlength }) {
  const input = h('input', { class: 'setup-input', id, name, type: 'text', placeholder, maxlength: String(maxlength),
    'aria-describedby': `setup-${name}-error`, autocomplete: 'off' });
  input.value = value;
  return input;
}

function showProblems(form, summary, problems, message = 'Some answers need a change before you continue.') {
  showErrors(form, { message, details: problems }, summary, FIELD_LABELS);
  const first = form.querySelector('[aria-invalid="true"], .field__error:not([hidden])');
  const target = first?.closest('[data-field]')?.querySelector('input, button');
  if (target) target.focus();
}

function markGroups(form) {
  for (const line of form.querySelectorAll('.field__error:not([hidden])')) {
    line.closest('[data-field]')?.classList.add('has-error');
  }
}

const expiredNotice = () => h('div', { class: 'alert alert--info', role: 'status' }, h('div', { class: 'alert__body' },
  h('p', {}, 'We kept what you had entered before your session expired. Check it, then try again. Nothing was saved yet.')));

async function saveChanges(farm, values, fields) {
  const changes = changedFields(farm, farmBody(values), fields);
  if (Object.keys(changes).length === 0) return farm;
  const { data } = await updateFarm(farm.id, changes);
  setCurrentFarm(data.farm, data.capacity);
  return data.farm;
}

async function ensureAssessment(farm, s) {
  const { data } = await listAssessments(farm.id);
  const current = data.current?.assessment || null;
  if (!assessmentOutdated(current, farm)) return;
  await startAssessment(farm.id);
  s.notice = current
    ? 'Your birds changed, so a new checklist was started for them. Your earlier assessment is kept in Readiness assessment.'
    : null;
}

function saveLaterControl({ farm, s, form, summary, validate, fields }) {
  const button = h('button', { type: 'button', class: 'setup-savelater' }, 'Save and finish later');
  button.addEventListener('click', async () => {
    if (button.disabled) return;
    clearErrors(form, summary);
    const problems = validate();
    if (problems.length) {
      showProblems(form, summary, problems, farm ? 'Fix these answers so they can be saved.'
        : 'Fill in these answers so your farm can be saved. Nothing has been saved yet.');
      markGroups(form);
      return;
    }
    button.disabled = true;
    button.textContent = 'Saving…';
    try {
      if (farm) {
        await saveChanges(farm, s.values, fields);
        setFlash('success', 'Your farm details are saved. You can finish the setup later from More, then Readiness assessment.');
        navigate(`/farms/${farm.id}/today`);
      } else {
        const body = farmBody(s.values);
        if (houseProblems(s.values).length) {
          for (const key of ['houseLengthM', 'houseWidthM', 'nonUsableAreaM2']) delete body[key];
        }
        const { data } = await createFarm({ ...body, startAssessment: false });
        s.farmId = data.farm.id;
        s.values = valuesFromFarm(data.farm);
        setFlash('success', 'Your farm is saved. You can finish the setup later from More, then Readiness assessment.');
        navigate(`/farms/${data.farm.id}/today`);
      }
    } catch (error) {
      button.disabled = false;
      button.textContent = 'Save and finish later';
      if (error.status === 401) { s.expired = true; keepAfterExpiry(s); return; }
      showErrors(form, error, summary, FIELD_LABELS);
      markGroups(form);
    }
  });
  return button;
}

function birdsStep({ s, farm, hrefFor }) {
  const v = s.values;
  const summary = h('div', { class: 'setup-summary', 'aria-live': 'polite' });
  const form = h('form', { class: 'setup-form', novalidate: true });

  const name = plainInput({ id: 'setup-name', name: 'name', value: v.name, placeholder: 'e.g. Ajith Farm', maxlength: LIMITS.name });
  const location = plainInput({ id: 'setup-location', name: 'location', value: v.location, placeholder: 'e.g. Mukono', maxlength: LIMITS.location });
  name.addEventListener('input', () => { v.name = name.value; });
  location.addEventListener('input', () => { v.location = location.value; });

  const ageArea = h('div', {});
  const typeCards = h('div', { class: 'setup-typecards', role: 'group', 'aria-labelledby': 'setup-poultryType-label' });
  const drawTypes = () => {
    typeCards.replaceChildren(
      choiceCard({ iconName: 'broiler', title: 'Broilers', subtitle: 'Raised for meat', pressed: v.poultryType === 'broiler', onClick: () => pickType('broiler') }),
      choiceCard({ iconName: 'egg', title: 'Layers', subtitle: 'Raised for eggs', pressed: v.poultryType === 'layer', onClick: () => pickType('layer') }));
  };
  const pickType = (type) => {
    v.poultryType = type;
    if (type === 'broiler') { v.startingStage = 'day_old'; v.startingAgeWeeks = ''; }
    drawTypes();
    drawAge();
    typeCards.querySelector('.ui-choice.is-on')?.focus();
  };

  const birds = stepper({ id: 'setup-numberOfBirds', label: 'Number of birds you plan to keep', value: Number(v.numberOfBirds) || 0, step: 10,
    size: 'lg', inputmode: 'numeric', decLabel: '10 fewer birds', incLabel: '10 more birds',
    onChange: (n) => { v.numberOfBirds = n; } });
  birds.input.setAttribute('max', String(LIMITS.birds));
  birds.input.setAttribute('name', 'numberOfBirds');
  birds.input.addEventListener('input', () => { v.numberOfBirds = birds.input.value === '' ? '' : Number(birds.input.value); });

  function drawAge() {
    if (v.poultryType !== 'layer') {
      setContent(ageArea, block('startingStage', 'How old will they be when they arrive?',
        h('p', { class: 'setup-note' }, v.poultryType === 'broiler'
          ? 'Broilers start as day-old chicks.' : 'Choose broilers or layers first.'), { legend: true }));
      return;
    }
    const weeksInput = h('input', { class: 'setup-input setup-input--short', id: 'setup-startingAgeWeeks', name: 'startingAgeWeeks',
      type: 'number', inputmode: 'numeric', min: '0', max: '100', step: '1', 'aria-describedby': 'setup-startingAgeWeeks-error setup-age-hint' });
    weeksInput.value = v.startingAgeWeeks;
    weeksInput.addEventListener('input', () => { v.startingAgeWeeks = weeksInput.value; });
    const weeks = h('div', { class: 'field setup-field setup-weeks', dataset: { field: 'startingAgeWeeks' }, hidden: v.startingStage === 'day_old' },
      h('label', { class: 'setup-sublabel', for: 'setup-startingAgeWeeks' }, 'Age on arrival (weeks)'),
      weeksInput,
      h('p', { class: 'setup-hint', id: 'setup-age-hint' }, ageRangeText('layer', v.startingStage)),
      h('p', { class: 'field__error', id: 'setup-startingAgeWeeks-error', hidden: true }));
    const chips = chipGroup({ label: 'How old will they be when they arrive?', value: v.startingStage,
      options: [{ id: 'day_old', label: 'Day-old chicks' }, { id: 'pullet', label: 'Pullets' }, { id: 'point_of_lay', label: 'Point of lay' }],
      onChange: (stage) => {
        v.startingStage = stage;
        if (stage === 'day_old') v.startingAgeWeeks = '';
        weeks.hidden = stage === 'day_old';
        weeks.querySelector('#setup-age-hint').textContent = ageRangeText('layer', stage);
      } });
    setContent(ageArea, block('startingStage', 'How old will they be when they arrive?', chips.element, { legend: true }), weeks);
  }

  const experience = chipGroup({ label: 'Have you kept poultry before?', value: v.experienceLevel, options: EXPERIENCE_CHOICES,
    onChange: (id) => { v.experienceLevel = id; } });

  drawTypes();
  drawAge();
  form.append(
    h('div', { class: 'setup-grid2' },
      block('name', 'Farm name', name, { labelFor: 'setup-name' }),
      block('location', 'Location', location, { labelFor: 'setup-location' })),
    block('poultryType', 'Type of Birds?', typeCards, { legend: true }),
    h('div', { class: 'setup-grid2' },
      block('numberOfBirds', 'How many birds do you plan to keep?', birds.element,
        { labelFor: 'setup-numberOfBirds', hint: 'Not sure yet? Pick your best guess. You can change it later.' }),
      ageArea),
    block('experienceLevel', 'Have you kept poultry before?', experience.element, { legend: true }));

  if (s.expired) {
    s.expired = false;
    summary.append(expiredNotice());
  }

  if (s.errors) {
    const pending = s.errors;
    s.errors = null;
    queueMicrotask(() => { showErrors(form, pending, summary, FIELD_LABELS); markGroups(form); });
  }

  const continueButton = setupButton({ label: 'Continue', type: 'submit' });
  form.append(setupFooter({
    back: setupButton({ label: 'Back', variant: 'secondary', href: farm ? `#/farms/${farm.id}/today` : '#/farms' }),
    actions: [continueButton],
  }));
  guardSubmit(form, async () => {
    clearErrors(form, summary);
    form.querySelectorAll('.has-error').forEach((el) => el.classList.remove('has-error'));
    const problems = birdsProblems(v);
    if (problems.length) { showProblems(form, summary, problems); markGroups(form); return; }
    if (!farm) { navigate('/setup/house'); return; }
    try {
      await saveChanges(farm, v, STEP1_FIELDS);
      navigate(`/farms/${farm.id}/setup/house`);
    } catch (error) {
      if (error.status === 401) { s.expired = true; keepAfterExpiry(s); return; }
      showErrors(form, error, summary, FIELD_LABELS);
      markGroups(form);
    }
  }, { busyText: farm ? 'Saving…' : 'Continue' });

  return setupPage({
    step: 'birds', hrefFor,
    saveLater: saveLaterControl({ farm, s, form, summary, validate: () => birdsProblems(v), fields: STEP1_FIELDS }),
    stepLabel: 'Step 1 of 3', title: 'Your birds',
    content: [summary, form],
  });
}

function resultCard(check, v, { onPlanBirds, onLength }) {
  const birds = Number(v.numberOfBirds) || 0;
  if (check.status === 'incomplete') {
    const needs = [];
    if (check.missing.includes('numberOfBirds')) needs.push('the number of birds you plan to keep (step 1)');
    if (check.missing.includes('houseLengthM')) needs.push('the inside length');
    if (check.missing.includes('houseWidthM')) needs.push('the inside width');
    return h('div', { class: 'setup-result setup-result--neutral' },
      h('p', { class: 'setup-result__title' }, 'Space check'),
      h('p', {}, `To check the space, enter ${needs.join(' and ')}.`));
  }
  if (check.status === 'invalid') {
    return h('div', { class: 'setup-result setup-result--neutral' },
      h('p', { class: 'setup-result__title' }, 'Space check'),
      h('p', {}, `The space birds cannot use must be smaller than the whole floor (${fmt(check.grossAreaM2)} m²).`));
  }
  if (check.status === 'house_not_built') {
    return h('div', { class: 'setup-result setup-result--plan' },
      h('p', { class: 'setup-result__title' }, `Build at least ${fmt(check.requiredAreaM2)} m² for birds`),
      h('p', {}, `For ${fmt(birds)} birds when they are fully grown. Feed stores and passages need extra floor on top of this. `
        + 'This is a planning estimate, not a measurement of a house.'));
  }
  if (check.status === 'within_capacity') {
    return h('div', { class: 'setup-result setup-result--ok', role: 'status' },
      h('p', { class: 'setup-result__title' }, icon('check', { size: 22, strokeWidth: 2.6 }), 'Enough space'),
      h('p', {}, `${fmt(check.usableAreaM2)} m² for birds. Room for about `, h('b', {}, fmt(check.recommendedCapacity)),
        ` full-grown birds. You plan ${fmt(birds)}.`));
  }
  const width = numberOrNull(v.houseWidthM);
  const length = lengthForBirds({ ...check, houseWidthM: width, nonUsableAreaM2: numberOrNull(v.nonUsableAreaM2) ?? 0 });
  const options = [];
  if (check.recommendedCapacity > 0) {
    options.push(setupButton({ label: `Plan ${fmt(check.recommendedCapacity)} birds instead`, variant: 'outline', onClick: () => onPlanBirds(check.recommendedCapacity) }));
  }
  if (length && length <= LIMITS.houseM) {
    options.push(setupButton({ label: `Make it ${fmt(length)} m × ${fmt(width)} m`, variant: 'outline', onClick: () => onLength(length) }));
  }
  return h('div', { class: 'setup-result setup-result--warn', role: 'status' },
    h('p', { class: 'setup-result__title' }, icon('warning', { size: 22 }), `Too small for ${fmt(birds)} birds`),
    h('div', { class: 'setup-result__pair' },
      h('div', {}, h('span', {}, 'You have'), h('strong', {}, `${fmt(check.usableAreaM2)} m²`)),
      h('div', {}, h('span', {}, 'You need'), h('strong', {}, `${fmt(check.requiredAreaM2)} m²`))),
    options.length ? [h('p', { class: 'setup-result__choose' }, 'Choose one:'), h('div', { class: 'setup-result__options' }, options)] : null);
}

function houseStep({ s, farm, hrefFor }) {
  const v = s.values;
  const summary = h('div', { class: 'setup-summary', 'aria-live': 'polite' });
  const announce = h('p', { class: 'setup-announce', 'aria-live': 'polite' });
  const form = h('form', { class: 'setup-form', novalidate: true });
  const lead = h('p', { class: 'setup-lead' });
  const planBox = h('div', { class: 'setup-plan__box' });
  const planSize = h('span', { class: 'setup-plan__size' });
  const result = h('div', {});
  const rule = h('div', { class: 'setup-rule' });

  const length = textField({ id: 'setup-houseLengthM', name: 'houseLengthM', label: 'Length (inside)', type: 'number', inputmode: 'decimal', unit: 'm', size: 'lg', value: v.houseLengthM, min: '0', step: 'any' });
  const width = textField({ id: 'setup-houseWidthM', name: 'houseWidthM', label: 'Width (inside)', type: 'number', inputmode: 'decimal', unit: 'm', size: 'lg', value: v.houseWidthM, min: '0', step: 'any' });
  const unusable = textField({ id: 'setup-nonUsableAreaM2', name: 'nonUsableAreaM2', label: 'Space birds cannot use', type: 'number', inputmode: 'decimal', unit: 'm²', size: 'lg', value: v.nonUsableAreaM2, min: '0', step: 'any',
    hint: 'Feed store, passage, anything inside that birds cannot stand on. Use 0 if none.' });
  const wrap = (field, f) => {
    f.input.setAttribute('aria-describedby', `${f.input.getAttribute('aria-describedby') || ''} setup-${field}-error`.trim());
    return h('div', { class: 'field setup-field', dataset: { field } }, f.element, h('p', { class: 'field__error', id: `setup-${field}-error`, hidden: true }));
  };
  const measurements = h('div', { class: 'setup-measure' },
    h('div', { class: 'setup-measure__lw' }, wrap('houseLengthM', length), h('span', { class: 'setup-times', 'aria-hidden': 'true' }, '×'), wrap('houseWidthM', width)),
    wrap('nonUsableAreaM2', unusable));

  const status = chipGroup({ label: 'Do you have a poultry house?', variant: 'box', value: v.houseStatus,
    options: [{ id: 'existing', label: 'I have a house' }, { id: 'not_built', label: 'Not built yet' }],
    onChange: (id) => { v.houseStatus = id; update(); } });

  function update() {
    const birds = Number(v.numberOfBirds) || 0;
    lead.textContent = birds > 0
      ? `We will check that your ${fmt(birds)} birds have enough room when they are fully grown.`
      : 'Enter how many birds you plan to keep on step 1, and we will check the room they need when fully grown.';
    const has = v.houseStatus === 'existing';
    measurements.hidden = !has;
    const L = numberOrNull(v.houseLengthM);
    const W = numberOrNull(v.houseWidthM);
    const U = numberOrNull(v.nonUsableAreaM2) ?? 0;
    const check = spaceCheck({ poultryType: v.poultryType, experienceLevel: v.experienceLevel, startingStage: v.startingStage,
      startingAgeWeeks: numberOrNull(v.startingAgeWeeks), plannedBirds: birds, houseStatus: v.houseStatus,
      houseLengthM: L, houseWidthM: W, nonUsableAreaM2: Number.isNaN(U) ? 0 : U });
    planBox.parentElement.hidden = !has;
    planSize.textContent = L > 0 && W > 0 ? `${fmt(L)} m × ${fmt(W)} m` : '';
    setContent(planBox, houseDiagram({ length: L, width: W, unusable: Number.isNaN(U) ? 0 : U }));
    setContent(result, resultCard(check, v, {
      onPlanBirds: (n) => {
        v.numberOfBirds = n;
        announce.textContent = `Planned birds changed to ${fmt(n)}. ${farm ? 'It is saved when you continue.' : 'Nothing is saved until you continue.'}`;
        update();
      },
      onLength: (n) => {
        v.houseLengthM = String(n);
        length.input.value = String(n);
        announce.textContent = `Length changed to ${fmt(n)} m. ${farm ? 'It is saved when you continue.' : 'Nothing is saved until you continue.'}`;
        update();
      },
    }));
    setContent(rule, check.density
      ? [h('p', { class: 'setup-note' }, `Worked out for full-grown birds at ${check.density} birds per m² (from your guidance rules). `
        + 'Chicks start in a smaller brooding area.'),
      h('details', { class: 'setup-details' },
        h('summary', {}, 'How is this worked out?'),
        h('p', {}, 'Usable floor = length × width − the space birds cannot use.'),
        h('p', {}, `Your birds need the most room at the "${check.stageLabel}" stage: ${check.density} birds per m². `
          + `Room for birds = usable floor × ${check.density}, rounded down. Floor needed = planned birds ÷ ${check.density}, rounded up.`),
        h('p', {}, check.modeReason),
        h('p', {}, PLANNING_DISCLAIMER))]
      : h('p', { class: 'setup-note' }, 'Choose broilers or layers on step 1 to check the space.'));
  }

  for (const [f, key] of [[length, 'houseLengthM'], [width, 'houseWidthM'], [unusable, 'nonUsableAreaM2']]) {
    f.input.addEventListener('input', () => { v[key] = f.input.value; update(); });
  }

  form.append(
    h('div', { class: 'setup-house' },
      h('div', { class: 'setup-house__inputs' },
        h('div', { class: 'field setup-field', dataset: { field: 'houseStatus' } }, h('p', { class: 'visually-hidden' }, 'Do you have a poultry house?'), status.element,
          h('p', { class: 'field__error', id: 'setup-houseStatus-error', hidden: true })),
        measurements, rule, announce),
      h('div', { class: 'setup-house__aside' },
        h('section', { class: 'setup-plan', 'aria-labelledby': 'setup-plan-title' },
          h('div', { class: 'setup-plan__head' }, h('h2', { id: 'setup-plan-title' }, 'Your house from above'), planSize),
          planBox),
        result)));

  const continueButton = setupButton({ label: 'Continue', type: 'submit' });
  form.append(setupFooter({ back: setupButton({ label: 'Back', variant: 'secondary', href: hrefFor('birds') }), actions: [continueButton] }));
  update();

  if (s.expired) {
    s.expired = false;
    summary.append(expiredNotice());
  }

  guardSubmit(form, async () => {
    clearErrors(form, summary);
    const problems = houseProblems(v);
    if (problems.length) { showProblems(form, summary, problems); return; }
    try {
      if (farm) {
        const saved = await saveChanges(farm, v, STEP2_FIELDS);
        await ensureAssessment(saved, s);
        navigate(`/farms/${farm.id}/setup/ready`);
        return;
      }
      const stepOne = birdsProblems(v);
      if (stepOne.length) { s.errors = { message: 'Some answers on step 1 need a change.', details: stepOne }; navigate('/setup/birds'); return; }
      const { data } = await createFarm({ ...farmBody(v), startAssessment: true });
      s.farmId = data.farm.id;
      s.values = valuesFromFarm(data.farm);
      s.notice = null;
      navigate(`/farms/${data.farm.id}/setup/ready`);
    } catch (error) {
      if (error.status === 401) { s.expired = true; keepAfterExpiry(s); return; }
      const details = error.details || [];
      if (!farm && details.some((d) => !STEP2_FIELDS.includes(d.field) && d.field)) {
        s.errors = { message: error.message, details };
        navigate('/setup/birds');
        return;
      }
      showErrors(form, error, summary, FIELD_LABELS);
    }
  }, { busyText: farm ? 'Saving…' : 'Creating your farm…' });

  return setupPage({
    step: 'house', hrefFor, wide: true,
    saveLater: saveLaterControl({ farm, s, form, summary, validate: () => [...birdsProblems(v), ...(farm ? houseProblems(v) : [])], fields: STEP2_FIELDS }),
    stepLabel: 'Step 2 of 3', title: 'Your poultry house', lead: null,
    content: [lead, summary, form],
  });
}

export function newFarmSetupPage({ user, params, query }) {
  let s = setupState(user.id);
  if (query.new === '1') s = resetSetupState(user.id);
  if (s.farmId) {
    navigate(`/farms/${s.farmId}/setup/${params.step === 'house' ? 'house' : 'birds'}`, { replace: true });
    return h('div', {});
  }
  const hrefFor = (key) => ({ birds: '#/setup/birds', house: birdsProblems(s.values).length ? null : '#/setup/house' }[key] || null);
  if (params.step === 'house') {
    if (birdsProblems(s.values).length) {
      navigate('/setup/birds', { replace: true });
      return h('div', {});
    }
    return houseStep({ s, farm: null, hrefFor });
  }
  return birdsStep({ s, farm: null, hrefFor });
}

export function farmSetupPage(context) {
  const { user, params, farmContext } = context;
  const farm = farmContext.farm;
  const s = setupStateForFarm(user.id, farm);
  const hrefFor = (key) => `#/farms/${farm.id}/setup/${key}`;
  switch (params.step) {
    case 'birds': return birdsStep({ s, farm, hrefFor });
    case 'house': return houseStep({ s, farm, hrefFor });
    case 'ready': return checklistStep({ ...context, s, hrefFor });
    case 'result': return resultStep({ ...context, s, hrefFor });
    default: return null;
  }
}
