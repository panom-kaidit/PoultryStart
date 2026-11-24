// The farm's readiness assessments (owner only).
import { h, pageHeading, setContent } from '../components/dom.js';
import { alertBox, takeFlash, setFlash } from '../components/alerts.js';
import { loadingBlock, errorBlock, emptyState } from '../components/loading.js';
import { confirmDialog } from '../components/confirm.js';
import { readinessStatusBlock, readinessStatusLabel, READINESS_DISCLAIMER } from '../components/readiness.js';
import { listAssessments, startAssessment } from '../api/readiness.js';
import { navigate } from '../router.js';
import { POULTRY_TYPE_LABELS, STARTING_STAGE_LABELS, labelFor } from '../utils/format.js';
import { formatDate, formatUtcAsUgandaDate } from '../utils/dates.js';

export function describeAssessment(assessment) {
  const stage = labelFor(STARTING_STAGE_LABELS, assessment.startingStage);
  const age = assessment.startingAgeWeeks != null && assessment.startingStage !== 'day_old'
    ? `, ${assessment.startingAgeWeeks} weeks old on arrival` : '';
  return `${labelFor(POULTRY_TYPE_LABELS, assessment.poultryType)}, starting as ${stage.toLowerCase()}${age}`;
}

export const startedOn = (assessment) => (assessment.assessmentDate
  ? formatDate(String(assessment.assessmentDate).slice(0, 10))
  : formatUtcAsUgandaDate(assessment.createdAt));

export function readinessListPage({ farmContext }) {
  const { farm } = farmContext;
  const messages = h('div', { 'aria-live': 'polite' });
  const body = h('div', {}, loadingBlock('Loading the readiness assessments…'));

  const startButton = h('button', { type: 'button', class: 'button' }, 'Start a new assessment');
  startButton.addEventListener('click', async () => {
    const confirmed = await confirmDialog({
      title: 'Start a new readiness assessment?',
      message: 'A new assessment starts with no answers, using the farm\'s current details (poultry type and the birds\' age on arrival). '
        + 'It becomes the latest assessment. Your earlier assessments are kept and can still be viewed.',
      confirmLabel: 'Start the new assessment',
    });
    if (!confirmed) return;
    startButton.disabled = true;
    startButton.textContent = 'Starting…';
    try {
      const { data, message } = await startAssessment(farm.id);
      setFlash('success', message || 'Readiness assessment started.');
      navigate(`/farms/${farm.id}/readiness/${data.assessment.id}`);
    } catch (error) {
      startButton.disabled = false;
      startButton.textContent = 'Start a new assessment';
      if (error.status !== 401) {
        const box = alertBox('error', `No assessment was started. ${error.message}`);
        messages.replaceChildren(box);
        box.focus();
      }
    }
  });

  async function load() {
    setContent(body, loadingBlock('Loading the readiness assessments…'));
    try {
      const { data } = await listAssessments(farm.id);
      if (!body.isConnected) return;
      if (data.assessments.length === 0) {
        setContent(body, emptyState({
          title: 'No readiness assessment yet',
          text: 'The assessment asks about your house, equipment, feed and water, and gives you a checklist of what to have before the birds arrive. You can stop and continue at any time.',
          action: h('div', { class: 'button-row' }, startButton,
            h('a', { class: 'button button--secondary', href: `#/farms/${farm.id}/setup/ready` }, 'Continue the guided setup')),
        }));
        return;
      }
      const [latest, ...earlier] = data.assessments;
      setContent(body,
        h('section', { class: 'card', 'aria-labelledby': 'readiness-latest' },
          h('h2', { id: 'readiness-latest' }, 'Latest assessment'),
          readinessStatusBlock(latest.status),
          h('p', { class: 'farm-card__meta' }, `Started ${startedOn(latest)}. ${describeAssessment(latest)}.`),
          h('div', { class: 'button-row' },
            h('a', { class: 'button', href: `#/farms/${farm.id}/readiness/${latest.id}` }, 'Open the latest assessment'),
            h('a', { class: 'button button--secondary', href: `#/farms/${farm.id}/setup/ready` }, 'Continue the guided setup'),
            startButton)),
        earlier.length
          ? h('section', { class: 'card', 'aria-labelledby': 'readiness-earlier' },
            h('h2', { id: 'readiness-earlier' }, 'Earlier assessments'),
            h('p', {}, 'Earlier assessments are kept as they were. You can view them.'),
            h('ul', { class: 'item-list' }, earlier.map((assessment) => h('li', { class: 'item' },
              h('p', { class: 'item__title' }, `Assessment started ${startedOn(assessment)}`),
              h('p', {}, readinessStatusLabel(assessment.status)),
              h('p', { class: 'farm-card__meta' }, describeAssessment(assessment)),
              h('a', { href: `#/farms/${farm.id}/readiness/${assessment.id}`,
                'aria-label': `View the assessment started ${startedOn(assessment)}` }, 'View this assessment')))))
          : null);
    } catch (error) {
      if (error.status === 401 || !body.isConnected) return;
      setContent(body, errorBlock(error, { onRetry: load }));
    }
  }
  load();

  return h('div', {},
    pageHeading('Readiness assessment'),
    takeFlash(),
    h('p', { class: 'page-intro' }, 'Check that your farm is ready before the birds arrive.'),
    messages,
    body,
    h('p', { class: 'small-print' }, READINESS_DISCLAIMER));
}
