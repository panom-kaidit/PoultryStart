// The Poultry Advisor page: rule-based advice for the farm or one flock.
import { h, pageHeading, setContent } from '../components/dom.js';
import { statusLabel } from '../components/alerts.js';
import { loadingBlock, errorBlock, emptyState } from '../components/loading.js';
import { adviceCard, limitationBox, PRIORITIES, ADVISOR_LIMITATION } from '../components/advisor.js';
import { evidenceTags } from '../components/guidance.js';
import { getAdvice } from '../api/advisor.js';
import { listFlocks } from '../api/flocks.js';
import { navigate } from '../router.js';
import { formatDate } from '../utils/dates.js';

export function advisorPage({ farmContext, query }) {
  const { farm } = farmContext;
  const flockId = /^[1-9]\d*$/.test(query.flockId || '') ? Number(query.flockId) : null;
  const limitation = h('div', {}, limitationBox(ADVISOR_LIMITATION));
  const chooser = h('div', {});
  const body = h('div', { 'aria-live': 'polite' }, loadingBlock('Checking what is recorded…'));
  let busy = false;

  function flockChooser(flocks) {
    const select = h('select', { class: 'select', id: 'advisor-flock', name: 'flockId' },
      h('option', { value: '' }, 'The whole farm (all flocks)'),
      flocks.map((f) => h('option', { value: String(f.id), selected: f.id === flockId }, `${f.name}${f.status === 'closed' ? ' (closed)' : ''}`)));
    const form = h('form', { class: 'card filter-form' },
      h('div', { class: 'field' }, h('label', { class: 'field__label', for: 'advisor-flock' }, 'Advice for'), select),
      h('div', { class: 'button-row' }, h('button', { type: 'submit', class: 'button button--secondary' }, 'Show advice')));
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      navigate(`/farms/${farm.id}/advisor${select.value ? `?flockId=${encodeURIComponent(select.value)}` : ''}`);
    });
    return form;
  }

  function flockStages(flocks) {
    if (!flocks.length) return null;
    return h('section', { class: 'card', 'aria-labelledby': 'advisor-flocks' },
      h('h2', { id: 'advisor-flocks' }, flockId ? 'This flock' : 'Your flocks'),
      h('ul', { class: 'plain-list' }, flocks.map((f) => h('li', {},
        h('a', { href: `#/farms/${farm.id}/flocks/${f.id}` }, f.name), `: ${f.status === 'closed' ? 'closed' : 'active'}`,
        f.ageDays != null && f.status === 'active' ? `, week ${f.ageWeeks} (age day ${f.ageDays})` : '',
        f.stageLabel ? ` · ${f.stageLabel}` : '',
        f.stageQualification ? [' ', evidenceTags([f.stageQualification.marker]), h('span', { class: 'small-print' }, ` ${f.stageQualification.qualification}`)] : null))));
  }

  async function load() {
    if (busy) return;
    busy = true;
    setContent(body, loadingBlock('Checking what is recorded…'));
    try {
      const [{ data }, { data: flockData }] = await Promise.all([getAdvice(farm.id, { flockId: flockId || undefined }), listFlocks(farm.id)]);
      if (!body.isConnected) return;
      if (data.limitation) setContent(limitation, limitationBox(data.limitation));
      setContent(chooser, flockChooser(flockData.flocks));
      const flockNames = new Map(flockData.flocks.map((f) => [f.id, f.name]));
      const selected = flockId ? flockData.flocks.find((f) => f.id === flockId) : null;
      const counts = Object.keys(PRIORITIES).map((p) => [p, data.advice.filter((a) => a.priority === p).length]).filter(([, n]) => n > 0);
      const back = 'page:home';
      setContent(body,
        h('h2', { class: 'advisor-scope' }, selected ? `Advice for ${selected.name}${selected.status === 'closed' ? ' (closed)' : ''}` : 'Advice for the whole farm'),
        h('p', { class: 'small-print' }, `Checked on ${formatDate(data.date)} from what is recorded in PoultryStart.`),
        flockStages(data.flocks),
        data.advice.length === 0
          ? emptyState({ title: 'No advice from the recorded information',
            text: 'The Advisor found nothing to point out in what is recorded. That does not mean the birds are healthy or that there is no problem: keep checking the birds and keep records.' })
          : [
            h('p', { class: 'advisor-count' }, `${data.advice.length} item${data.advice.length === 1 ? '' : 's'}, most pressing first`
              + (counts.length ? ` (${counts.map(([p, n]) => `${n} ${PRIORITIES[p].label.toLowerCase()}`).join(', ')})` : '') + '.'),
            data.omittedCount > 0
              ? h('p', {}, statusLabel('info', `${data.omittedCount} more item${data.omittedCount === 1 ? ' was' : 's were'} found but not shown: the Advisor shows at most 10 at a time (${data.totalCount} in all). `
                + 'Deal with these first, or choose one flock to see its own advice.')) : null,
            h('ol', { class: 'card-list advice-list' }, data.advice.map((item, index) => adviceCard(farm, item, { index, flockNames, back }))),
          ],
        h('div', { class: 'button-row' },
          h('button', { type: 'button', class: 'button button--secondary', onclick: () => load() }, 'Check again'),
          flockId ? h('a', { class: 'button button--secondary', href: `#/farms/${farm.id}/advisor` }, 'Advice for the whole farm') : null));
    } catch (error) {
      if (error.status === 401 || !body.isConnected) return;
      setContent(body, errorBlock(error, {
        onRetry: error.status === 0 || error.status >= 500 ? load : undefined,
        actions: [h('a', { class: 'button', href: `#/farms/${farm.id}/advisor` }, 'Advice for the whole farm')],
      }));
    } finally {
      busy = false;
    }
  }
  load();

  return h('div', {},
    pageHeading('Poultry Advisor'),
    h('p', { class: 'page-intro' }, `The Advisor checks what is recorded for this farm: ${{ owner: 'readiness, ', manager: 'the readiness status, ' }[farm.myRole] || ''}`
      + 'flock stages and dates, daily tasks, production records, '
      + 'deaths and health observations. It uses fixed PoultryStart rules (not artificial intelligence) and changes nothing. '
      + 'It does not diagnose disease or recommend medicines.'),
    limitation,
    chooser,
    body,
    h('p', { class: 'small-print' }, 'The rules for when to contact a veterinarian and when records are missing are PoultryStart design rules, '
      + 'not veterinary standards. Read more in the ', h('a', { href: '#/guidance' }, 'guidance library'), '.'));
}
