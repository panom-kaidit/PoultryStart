// Guided setup step 3: the readiness checklist.
import { h, setContent } from '../components/dom.js';
import { setFlash } from '../components/alerts.js';
import { loadingBlock, errorBlock } from '../components/loading.js';
import { chipGroup, progressBar } from '../components/ui.js';
import { setupPage, setupFooter, setupButton } from '../components/setup-layout.js';
import { listAssessments, startAssessment, getAssessment, saveResponses, updateResource } from '../api/readiness.js';
import { assessmentOutdated } from '../farm/setup-flow.js';
import { readinessCount } from '../farm/readiness-view.js';
import { navigate } from '../router.js';

export const CHECKLIST_GROUPS = [
  { title: 'House', areas: ['housing'] },
  { title: 'Equipment', areas: ['equipment'] },
  { title: 'Feed and water', areas: ['feed', 'water'] },
  { title: 'Other preparation', areas: ['other'] },
];

const ANSWERS = [{ id: 'yes', label: 'Yes' }, { id: 'partly', label: 'Partly' }, { id: 'no', label: 'No' }];

export function leaveForNow(farm) {
  setFlash('success', 'Your setup is saved. You can finish it later from More, then Readiness assessment.');
  navigate(`/farms/${farm.id}/today`);
}

export function checklistStep({ farmContext, s, hrefFor }) {
  const { farm } = farmContext;
  const body = h('div', {}, loadingBlock('Loading your checklist…'));
  const countText = h('span', { class: 'setup-count__text' });
  const countBar = h('div', { class: 'setup-count__bar' });
  const count = h('div', { class: 'setup-count', hidden: true }, countBar, countText);
  let detail = null;

  const refreshCount = () => {
    const { ready, total } = readinessCount(detail);
    countText.textContent = `${ready} of ${total} ready`;
    setContent(countBar, progressBar({ value: ready, max: total, label: `${ready} of ${total} ready`, size: 'lg' }));
    count.hidden = false;
  };

  function itemRow(item) {
    const id = `setup-item-${item.id}`;
    const box = h('input', { type: 'checkbox', id, class: 'setup-check__input' });
    box.checked = Boolean(item.isAvailable);
    const error = h('p', { class: 'setup-row__error', role: 'alert', hidden: true });
    box.addEventListener('change', async () => {
      const wanted = box.checked;
      box.disabled = true;
      error.hidden = true;
      try {
        const { data } = await updateResource(farm.id, detail.assessment.id, item.id, { isAvailable: wanted });
        item.isAvailable = data.resource.isAvailable;
        refreshCount();
      } catch (e) {
        box.checked = !wanted;
        if (e.status !== 401) { error.textContent = `Not saved. ${e.message}`; error.hidden = false; }
      } finally {
        box.disabled = false;
      }
    });
    return h('div', { class: 'setup-row' },
      h('div', { class: 'setup-check' }, box,
        h('label', { for: id, class: 'setup-check__label' }, item.itemName, item.isRequired ? null : h('span', { class: 'setup-tag' }, ' (optional)'))),
      item.immediate ? null : h('p', { class: 'setup-row__later' }, item.neededByLabel || 'Needed later'),
      error);
  }

  function questionRow(question) {
    const labelId = `setup-q-${question.id}`;
    const error = h('p', { class: 'setup-row__error', role: 'alert', hidden: true });
    let saving = false;
    const chips = chipGroup({ label: question.questionText, value: question.answer, options: ANSWERS, onChange: async (answer) => {
      if (saving) { chips.value = question.answer; return; }
      const previous = question.answer;
      saving = true;
      chips.element.setAttribute('aria-busy', 'true');
      error.hidden = true;
      try {
        await saveResponses(farm.id, detail.assessment.id, [{ questionId: question.id, answer }]);
        question.answer = answer;
        refreshCount();
      } catch (e) {
        chips.value = previous;
        if (e.status !== 401) { error.textContent = `Not saved. ${e.message}`; error.hidden = false; }
      } finally {
        saving = false;
        chips.element.removeAttribute('aria-busy');
      }
    } });
    chips.element.removeAttribute('aria-label');
    chips.element.setAttribute('aria-labelledby', labelId);
    chips.element.classList.add('setup-answers');
    return h('div', { class: 'setup-row setup-row--question' },
      h('p', { class: 'setup-row__question', id: labelId }, question.questionText, question.isRequired ? null : h('span', { class: 'setup-tag' }, ' (optional)')),
      question.helpText ? h('p', { class: 'setup-row__hint' }, question.helpText) : null,
      question.verificationNote ? h('p', { class: 'setup-row__hint' }, question.verificationNote) : null,
      question.immediate ? null : h('p', { class: 'setup-row__later' }, question.neededByLabel || 'Needed later'),
      chips.element, error);
  }

  function render() {
    const groups = CHECKLIST_GROUPS.map((group) => {
      const items = detail.resources.filter((r) => r.immediate && group.areas.includes(r.category));
      const questions = detail.questions.filter((q) => q.immediate && group.areas.includes(q.area));
      if (!items.length && !questions.length) return null;
      return h('section', { class: 'setup-group', 'aria-label': group.title },
        h('h2', { class: 'setup-group__title' }, group.title),
        items.map(itemRow),
        questions.length ? h('div', { class: 'setup-group__questions' }, questions.map(questionRow)) : null);
    });
    const labels = new Map((detail.summary.laterStageRequirements || []).map((r) => [`${r.type}-${r.id}`, r.neededByLabel]));
    for (const r of detail.resources) if (!r.immediate) r.neededByLabel = labels.get(`resource-${r.id}`);
    for (const q of detail.questions) if (!q.immediate) q.neededByLabel = labels.get(`question-${q.id}`);
    const later = [...detail.resources.filter((r) => !r.immediate), ...detail.questions.filter((q) => !q.immediate)];
    setContent(body,
      s.notice ? h('div', { class: 'alert alert--info', role: 'status' }, h('div', { class: 'alert__body' }, h('p', {}, s.notice))) : null,
      h('div', { class: 'setup-groups' }, groups),
      later.length ? h('details', { class: 'setup-later' },
        h('summary', {}, `Needed later (${later.length})`),
        h('p', { class: 'setup-note' }, 'Not needed before the birds arrive, but plan for them. They do not count towards the number ready.'),
        later.map((x) => (x.itemName ? itemRow(x) : questionRow(x)))) : null);
    refreshCount();
  }

  async function startNew(button, wasOutdated) {
    button.disabled = true;
    button.textContent = 'Starting…';
    try {
      await startAssessment(farm.id);
      s.notice = wasOutdated ? 'A new checklist was started for your birds. Your earlier assessment is kept in Readiness assessment.' : null;
      load();
    } catch (e) {
      button.disabled = false;
      button.textContent = 'Start my checklist';
      if (e.status !== 401) setContent(body, errorBlock(e, { onRetry: load }));
    }
  }

  async function load() {
    setContent(body, loadingBlock('Loading your checklist…'));
    try {
      const { data } = await listAssessments(farm.id);
      const current = data.current?.assessment || null;
      if (assessmentOutdated(current, farm)) {
        const button = setupButton({ label: 'Start my checklist', onClick: () => startNew(button, Boolean(current)) });
        setContent(body, h('div', { class: 'ui-empty' },
          h('h2', {}, current ? 'Your birds have changed' : 'Your checklist is not started yet'),
          h('p', {}, current
            ? 'The latest checklist was made for other birds or another age on arrival. Start a new one for your birds; the earlier one is kept.'
            : 'It lists what to have ready before your birds arrive, for your type of birds.'),
          button));
        return;
      }
      ({ data: detail } = await getAssessment(farm.id, current.id));
      if (!body.isConnected) return;
      render();
    } catch (e) {
      if (e.status !== 401 && body.isConnected) setContent(body, errorBlock(e, { onRetry: load }));
    }
  }
  load();

  const saveLater = h('button', { type: 'button', class: 'setup-savelater', onclick: () => leaveForNow(farm) }, 'Save and finish later');
  return setupPage({
    step: 'ready', hrefFor, saveLater, wide: true,
    stepLabel: 'Step 3 of 3', title: 'Before your chicks arrive',
    lead: 'Tick what you already have. Leave the rest. We will turn it into a to-do list.',
    aside: count,
    content: body,
    footer: setupFooter({
      back: setupButton({ label: 'Back', variant: 'secondary', href: hrefFor('house') }),
      actions: [
        setupButton({ label: 'Finish this later', variant: 'ghost', onClick: () => leaveForNow(farm) }),
        setupButton({ label: 'See my results', href: hrefFor('result') }),
      ],
    }),
  });
}
