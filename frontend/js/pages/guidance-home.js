// The Learn page: the guidance library's front page.
import { h, pageHeading, setContent } from '../components/dom.js';
import { loadingBlock, errorBlock } from '../components/loading.js';
import { icon } from '../components/icons.js';
import { disclaimerBox, evidenceLegend, catalogueHref } from '../components/guidance.js';
import { PRIORITIES } from '../components/advisor.js';
import { getTopics } from '../api/guidance.js';
import { getAdvice } from '../api/advisor.js';
import { getCurrentFarm } from '../farm/farm.js';
import { canOpen } from '../farm/access.js';
import { navigate } from '../router.js';
import { formatDate } from '../utils/dates.js';
import { shortLabel } from '../farm/flocks-view.js';

const TOPIC_ICONS = {
  farm_preparation: 'checklist', housing: 'house', feeding: 'bag', water: 'droplet', flock_management: 'egg',
  health_monitoring: 'pulse', hygiene: 'shield', daily_activities: 'clock',
};
const TYPES = { broiler: 'Broilers', layer: 'Layers' };

function adviceSection(farm) {
  const box = h('section', { class: 'learn-section', 'aria-labelledby': 'learn-advice' },
    h('div', { class: 'learn-section__head' }, h('h2', { id: 'learn-advice' }, 'Advice for your farm'),
      h('a', { href: `#/farms/${farm.id}/advisor` }, 'See all advice')),
    loadingBlock('Loading the advice…'));
  const list = box.lastChild;
  getAdvice(farm.id).then(({ data }) => {
    const items = data.advice.slice(0, 2);
    const names = new Map((data.flocks || []).map((f) => [f.id, f.name]));
    list.replaceWith(items.length
      ? h('ul', { class: 'learn-advice' }, items.map((a) => h('li', {}, h('a', { class: `learn-advice__card learn-advice__card--${a.priority}`, href: `#/farms/${farm.id}/advisor` },
        h('span', { class: 'learn-dot' }, h('span', { class: 'visually-hidden' }, `${(PRIORITIES[a.priority] || PRIORITIES.info).label}: `)),
        h('span', {}, h('span', { class: 'learn-advice__title' }, a.title),
          h('span', { class: 'learn-advice__text' }, [a.flockId && names.get(a.flockId), a.nextStep || a.message].filter(Boolean).join(' · ')))))))
      : h('p', { class: 'learn-muted' }, 'No advice from your farm\'s records right now. This does not mean there is no problem.'));
  }).catch((error) => {
    if (error.status !== 401) list.replaceWith(h('p', { class: 'learn-muted' }, 'The advice could not be loaded. ', h('a', { href: `#/farms/${farm.id}/advisor` }, 'Open the Advisor')));
  });
  return box;
}

function stageSection(meta, type, farm) {
  const stages = (meta.stages[type] || []).filter((s) => s.stage !== 'after_flock');
  return h('section', { class: 'learn-section', 'aria-labelledby': 'learn-stages' },
    h('div', { class: 'learn-section__head' }, h('h2', { id: 'learn-stages' }, `By stage · ${TYPES[type]}`),
      farm ? null : h('div', { class: 'learn-types', role: 'group', 'aria-label': 'Kind of birds' },
        Object.entries(TYPES).map(([id, label]) => h('a', { class: 'learn-chip learn-chip--small', href: `#/learn?type=${id}`, 'aria-current': id === type ? 'true' : undefined }, label)))),
    h('ul', { class: 'learn-chips' }, stages.map((s) => h('li', {}, h('a', { class: 'learn-chip', href: catalogueHref({ poultryType: type, stage: s.stage }), title: s.label },
      s.stage === 'preparation' ? 'Before chicks' : shortLabel(s.label))))),
    h('p', { class: 'learn-muted' }, h('a', { href: `#/guidance/${type}` }, `All stages and topics for ${TYPES[type].toLowerCase()}`), ' · ',
      h('a', { href: catalogueHref({}) }, 'All articles')));
}

export function guidanceHomePage({ query = {} } = {}) {
  const farm = getCurrentFarm()?.farm || null;
  const type = farm?.poultryType && TYPES[farm.poultryType] ? farm.poultryType : (TYPES[query.type] ? query.type : 'broiler');
  const body = h('div', { class: 'learn-body' }, loadingBlock('Loading the guidance library…'));
  const search = h('input', { class: 'learn-search__input', id: 'guidance-search', name: 'q', type: 'search', maxlength: '100', autocomplete: 'off',
    placeholder: 'Search: brooder, water, eggs…', 'aria-describedby': 'guidance-search-hint' });
  const searchForm = h('form', { class: 'learn-search', role: 'search' },
    h('label', { class: 'visually-hidden', for: 'guidance-search' }, 'Search the guidance'),
    icon('search', { size: 20 }), search,
    h('p', { class: 'visually-hidden', id: 'guidance-search-hint' }, 'Two or more letters, for example "litter", "water" or "eggs".'),
    h('button', { type: 'submit', class: 'learn-search__button' }, 'Search'));
  searchForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const q = search.value.trim();
    navigate(`/guidance/articles${q ? `?q=${encodeURIComponent(q)}` : ''}`);
  });

  async function load() {
    setContent(body, loadingBlock('Loading the guidance library…'));
    try {
      const { data: meta } = await getTopics();
      if (!body.isConnected) return;
      const total = meta.topics.reduce((sum, t) => sum + t.articleCount, 0);
      const legend = evidenceLegend(meta, { headingId: 'learn-labels' });
      legend.setAttribute('tabindex', '-1');
      setContent(body,
        farm && canOpen(farm.myRole, 'advisor') ? adviceSection(farm) : null,
        stageSection(meta, type, farm),
        h('section', { class: 'learn-section', 'aria-labelledby': 'learn-topics' },
          h('h2', { id: 'learn-topics' }, 'Topics'),
          h('ul', { class: 'learn-topics' }, meta.topics.map((t) => h('li', {}, h('a', { class: 'learn-topic', href: catalogueHref({ topic: t.topic }) },
            h('span', { class: 'learn-topic__icon', 'aria-hidden': 'true' }, icon(TOPIC_ICONS[t.topic] || 'book', { size: 20 })),
            h('span', { class: 'learn-topic__name' }, t.label),
            h('span', { class: 'learn-topic__count' }, `${t.articleCount} article${t.articleCount === 1 ? '' : 's'}`)))))),
        h('p', { class: 'learn-foot' }, 'General guidance for learning and planning. It does not replace your vet. ',
          h('button', { type: 'button', class: 'learn-linkbtn', onclick: () => { legend.scrollIntoView({ block: 'start' }); legend.focus(); } }, 'What do the source labels mean?')),
        disclaimerBox(meta.disclaimer),
        legend,
        h('p', { class: 'small-print' }, `${meta.catalogue.name}, revision ${meta.catalogue.revision}, approved ${formatDate(meta.catalogue.approvedOn)}: ${total} articles. `
          + 'The content was reviewed within the PoultryStart project. It has not yet been reviewed by MAAIF or a District Veterinary Officer.'));
    } catch (error) {
      if (error.status === 401 || !body.isConnected) return;
      setContent(body, errorBlock(error, { onRetry: load }));
    }
  }
  load();

  return h('div', { class: 'learn' }, h('div', { class: 'learn-head' }, pageHeading('Learn'), searchForm), body);
}
