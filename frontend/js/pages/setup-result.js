// Guided setup step 4: the readiness results.
import { h, pageHeading, setContent } from '../components/dom.js';
import { loadingBlock, errorBlock } from '../components/loading.js';
import { readinessRing } from '../components/ui.js';
import { icon } from '../components/icons.js';
import { setupPage, setupButton } from '../components/setup-layout.js';
import { listAssessments, getAssessment } from '../api/readiness.js';
import { updateFarm } from '../api/farms.js';
import { setCurrentFarm } from '../farm/farm.js';
import { assessmentOutdated } from '../farm/setup-flow.js';
import { leaveForNow } from './setup-checklist.js';
import { readinessCount, readinessGaps, readinessStatusText } from '../farm/readiness-view.js';

const fmt = (n) => (Math.round(n * 100) / 100).toLocaleString('en-GB');
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const ANSWER_TEXT = { no: 'No', partly: 'Partly' };

const QUESTION_REASONS = {
  Q16: 'Keep the number of a vet or extension officer so you can ask for advice quickly if birds get sick.',
};

export const statusText = (summary, todo) => readinessStatusText(summary.status, todo);

function todoCard({ iconName = 'warning', title, text, actions = [] }) {
  return h('section', { class: 'setup-todo' },
    h('span', { class: 'setup-todo__icon', 'aria-hidden': 'true' }, icon(iconName, { size: 18 })),
    h('div', { class: 'setup-todo__body' },
      h('h3', {}, title),
      text ? h('p', {}, text) : null,
      actions.length ? h('div', { class: 'setup-todo__actions' }, actions) : null));
}

const softLink = (label, href) => h('a', { class: 'setup-soft', href }, label);

export function resultStep({ farmContext, s, hrefFor }) {
  const { farm } = farmContext;
  const body = h('div', {}, loadingBlock('Working out your results…'));

  function spaceCard(capacity, reload) {
    if (!capacity || capacity.status === 'within_capacity') return null;
    if (capacity.status === 'above_capacity') {
      const plan = h('button', { type: 'button', class: 'setup-soft' }, `Plan ${fmt(capacity.recommendedCapacity)} birds`);
      const error = h('p', { class: 'setup-row__error', role: 'alert', hidden: true });
      plan.addEventListener('click', async () => {
        if (plan.disabled) return;
        plan.disabled = true;
        plan.textContent = 'Saving…';
        try {
          const { data } = await updateFarm(farm.id, { numberOfBirds: capacity.recommendedCapacity });
          setCurrentFarm(data.farm, data.capacity);
          s.values.numberOfBirds = data.farm.numberOfBirds;
          reload();
        } catch (e) {
          plan.disabled = false;
          plan.textContent = `Plan ${fmt(capacity.recommendedCapacity)} birds`;
          if (e.status !== 401) { error.textContent = `Not saved. ${e.message}`; error.hidden = false; }
        }
      });
      return h('div', {}, todoCard({ iconName: 'house', title: `House too small for ${fmt(capacity.plannedBirds)} birds`,
        text: `You have ${fmt(capacity.space.usableAreaM2)} m². Full-grown birds will need ${fmt(capacity.requiredAreaM2)} m².`,
        actions: [plan, softLink('Extend the house', hrefFor('house'))] }), error);
    }
    if (capacity.status === 'house_not_built') {
      return todoCard({ iconName: 'house', title: 'No poultry house yet', text: capacity.message, actions: [softLink('Update your house', hrefFor('house'))] });
    }
    return todoCard({ iconName: 'house', title: 'House measurements needed', text: capacity.message, actions: [softLink('Add the measurements', hrefFor('house'))] });
  }

  function render(detail, reload) {
    const { summary, capacity } = detail;
    const checklist = hrefFor('ready');
    const iconFor = (text) => (/thermometer/i.test(text) ? 'thermometer' : 'warning');
    const cards = [
      spaceCard(capacity, reload),
      ...summary.missingResources.map((item) => todoCard({ iconName: iconFor(item.itemName), title: `Not ready: ${item.itemName}`,
        text: 'Needed before your birds arrive.', actions: [softLink('Change on the checklist', checklist)] })),
      ...summary.needsAttention.map((q) => todoCard({ iconName: q.code === 'Q16' ? 'phone' : iconFor(q.questionText), title: q.questionText,
        text: [`You answered "${ANSWER_TEXT[q.answer] || q.answer}".`, QUESTION_REASONS[q.code]].filter(Boolean).join(' '),
        actions: [softLink('Change on the checklist', checklist)] })),
      summary.unansweredRequired.length ? todoCard({ title: `${plural(summary.unansweredRequired.length, 'question')} not answered`,
        text: summary.unansweredRequired.map((q) => q.questionText).join(' '), actions: [softLink('Answer them', checklist)] }) : null,
    ].filter(Boolean);

    const readyItems = [
      ...(capacity?.status === 'within_capacity' ? ['Enough space for your birds'] : []),
      ...detail.resources.filter((r) => r.immediate && r.isAvailable).map((r) => r.itemName),
      ...detail.questions.filter((q) => q.immediate && q.answer === 'yes').map((q) => q.questionText),
    ];
    const { ready, total } = readinessCount(detail);
    const status = statusText(summary, readinessGaps(detail).length);

    const share = shareButton(() => [
      `${farm.name}: readiness ${status.title.toLowerCase()} (${ready} of ${total} ready)`,
      cards.length ? '\nTo do first:' : '',
      ...cards.map((c) => `- ${c.querySelector('h3').textContent}`),
      readyItems.length ? '\nReady:' : '',
      ...readyItems.map((t) => `- ${t}`),
    ].filter(Boolean).join('\n'));

    setContent(body, h('div', { class: 'setup-results' },
      h('div', { class: 'setup-results__summary' },
        h('section', { class: `setup-scorecard setup-scorecard--${summary.status}`, 'aria-labelledby': 'setup-status' },
          readinessRing({ ready, total }),
          h('p', { class: 'setup-scorecard__status', id: 'setup-status' }, status.title),
          h('p', { class: 'setup-scorecard__text' }, status.text),
          capacity?.status === 'within_capacity' ? h('p', { class: 'setup-scorecard__space' }, icon('check', { size: 16, strokeWidth: 2.6 }), capacity.message) : null),
        setupButton({ label: 'Go to my farm', href: `#/farms/${farm.id}/today` }),
        setupButton({ label: 'Change my checklist', variant: 'outline', href: checklist }),
        share),
      h('div', { class: 'setup-results__todo' },
        pageHeading(cards.length ? 'To do first' : 'Nothing left to do'),
        cards,
        readyItems.length ? h('details', { class: 'setup-readylist' },
          h('summary', {}, icon('check', { size: 20, strokeWidth: 2.6 }), `${plural(readyItems.length, 'thing')} ${readyItems.length === 1 ? 'is' : 'are'} ready`),
          h('ul', {}, readyItems.map((t) => h('li', {}, t)))) : null,
        summary.laterStageRequirements.length ? h('p', { class: 'setup-note' },
          `${plural(summary.laterStageRequirements.length, 'more thing')} will be needed later (for example before the first egg or before selling). `,
          h('a', { href: checklist }, 'See them on the checklist'), '.') : null)));
  }

  async function load() {
    setContent(body, loadingBlock('Working out your results…'));
    try {
      const { data } = await listAssessments(farm.id);
      const current = data.current?.assessment || null;
      if (assessmentOutdated(current, farm)) {
        setContent(body, h('div', { class: 'ui-empty' }, h('h2', {}, 'No checklist for your birds yet'),
          h('p', {}, 'Start the checklist first; your results come from it.'), setupButton({ label: 'Go to the checklist', href: hrefFor('ready') })));
        return;
      }
      const { data: detail } = await getAssessment(farm.id, current.id);
      if (body.isConnected) render(detail, load);
    } catch (e) {
      if (e.status !== 401 && body.isConnected) setContent(body, errorBlock(e, { onRetry: load }));
    }
  }
  load();

  return setupPage({
    step: 'result', hrefFor, wide: true,
    saveLater: h('button', { type: 'button', class: 'setup-savelater', onclick: () => leaveForNow(farm) }, 'Save and finish later'),
    content: body,
  });
}

function shareButton(textFor) {
  const canShare = typeof navigator !== 'undefined' && (navigator.share || navigator.clipboard?.writeText);
  if (!canShare) return null;
  const note = h('p', { class: 'setup-note', 'aria-live': 'polite' });
  const button = setupButton({ label: 'Share my checklist', variant: 'outline', onClick: async () => {
    const text = textFor();
    try {
      if (navigator.share) {
        await navigator.share({ title: 'My PoultryStart checklist', text });
      } else {
        await navigator.clipboard.writeText(text);
        note.textContent = 'Your checklist is copied. You can paste it into a message.';
      }
    } catch (e) {
      if (e?.name !== 'AbortError') note.textContent = 'Your checklist could not be shared from this browser.';
    }
  } });
  return h('div', { class: 'setup-share' }, button, note);
}
