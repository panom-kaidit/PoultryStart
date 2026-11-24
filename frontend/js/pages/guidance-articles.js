// The guidance article list with filters and search.
import { h, pageHeading, setContent } from '../components/dom.js';
import { loadingBlock, errorBlock } from '../components/loading.js';
import {
  disclaimerBox, guidanceNav, guidanceBreadcrumbs, articleItem, catalogueHref, cleanFilters, POULTRY_TYPE_NAMES,
} from '../components/guidance.js';
import { getTopics, listArticles } from '../api/guidance.js';
import { queryString } from '../api/production.js';
import { navigate } from '../router.js';

export function guidanceArticlesPage({ query }) {
  const controls = h('div', {}, loadingBlock('Loading the filters…'));
  const results = h('div', { 'aria-live': 'polite' });
  let meta = null;

  async function loadResults(filters) {
    setContent(results, loadingBlock(filters.q ? `Searching for "${filters.q}"…` : 'Loading the articles…'));
    try {
      const { data } = await listArticles(filters);
      if (!results.isConnected) return;
      const back = queryString(filters).slice(1);
      setContent(results,
        h('p', { class: 'results-count' }, data.count === 0 ? 'No articles match.' : `${data.count} article${data.count === 1 ? '' : 's'}.`),
        data.count === 0
          ? h('div', { class: 'card' },
            h('p', {}, filters.q ? `Nothing in the guidance matches "${filters.q}" with these filters.` : 'No article matches these filters.'),
            h('p', {}, 'Try fewer or other words, remove a filter, or browse by topic.'),
            h('a', { class: 'button button--secondary', href: catalogueHref({}) }, 'Show all articles'))
          : h('ul', { class: 'card-list' }, data.articles.map((a) => articleItem(a, { meta, back }))),
        disclaimerBox(data.disclaimer));
    } catch (error) {
      if (error.status === 401 || !results.isConnected) return;
      setContent(results, errorBlock(error, {
        onRetry: error.status === 0 || error.status >= 500 ? () => loadResults(filters) : undefined,
        actions: [h('a', { class: 'button', href: catalogueHref({}) }, 'Show all articles')],
      }));
    }
  }

  function chips(filters) {
    const label = {
      poultryType: (v) => `Birds: ${POULTRY_TYPE_NAMES[v]}${v === 'all' ? ' (articles for both only)' : ''}`,
      topic: (v) => `Topic: ${meta.topics.find((t) => t.topic === v)?.label || v}`,
      stage: (v) => `Stage: ${v === 'any' ? 'articles for every stage' : (meta.stages[filters.poultryType]?.find((s) => s.stage === v)?.label || v.replace('_', ' '))}`,
      q: (v) => `Search: "${v}"`,
    };
    const keys = Object.keys(filters);
    if (keys.length === 0) return h('p', { class: 'small-print' }, 'No filters: all articles are shown.');
    return h('div', { class: 'active-filters' },
      h('p', { class: 'small-print', id: 'active-filters-label' }, 'Active filters (select one to remove it):'),
      h('ul', { class: 'tag-row', 'aria-labelledby': 'active-filters-label' }, keys.map((key) => {
        const rest = { ...filters };
        delete rest[key];
        if (key === 'poultryType') delete rest.stage;
        return h('li', {}, h('a', { class: 'filter-chip', href: catalogueHref(rest), 'aria-label': `Remove the filter ${label[key](filters[key])}` },
          label[key](filters[key]), h('span', { 'aria-hidden': 'true' }, ' ×')));
      })),
      h('a', { href: catalogueHref({}) }, 'Clear all filters'));
  }

  function filterForm(filters) {
    const select = (id, name, text, options, value, hint) => h('div', { class: 'field' },
      h('label', { class: 'field__label', for: id }, text),
      hint ? h('p', { class: 'field__hint', id: `${id}-hint` }, hint) : null,
      h('select', { class: 'select', id, name, 'aria-describedby': hint ? `${id}-hint` : undefined },
        options.map(([v, t]) => h('option', { value: v, selected: v === (value || '') }, t))));
    const type = filters.poultryType;
    const stageOptions = type === 'broiler' || type === 'layer'
      ? [['', 'All stages'], ...meta.stages[type].map((s) => [s.stage, `${s.label}${s.marker ? ` (${s.marker}: PoultryStart planning definition)` : ''}`]), ['any', 'Only articles for every stage']]
      : null;
    const form = h('form', { class: 'card filter-form' },
      h('div', { class: 'field' },
        h('label', { class: 'field__label', for: 'filter-q' }, 'Search'),
        h('input', { class: 'input', id: 'filter-q', name: 'q', type: 'search', value: filters.q || '', maxlength: '100', autocomplete: 'off' })),
      select('filter-type', 'poultryType', 'Birds', [['', 'Broilers and layers'], ['broiler', 'Broilers'], ['layer', 'Layers'], ['all', 'Articles for both kinds only']], type),
      select('filter-topic', 'topic', 'Topic', [['', 'All topics'], ...meta.topics.map((t) => [t.topic, t.label])], filters.topic),
      stageOptions
        ? select('filter-stage', 'stage', 'Stage', stageOptions, filters.stage)
        : h('p', { class: 'small-print' }, 'Choose broilers or layers to filter by stage.'),
      h('div', { class: 'button-row' }, h('button', { type: 'submit', class: 'button' }, 'Show articles')));
    form.elements.poultryType.addEventListener('change', () => {
      const next = cleanFilters({ q: form.elements.q.value, topic: form.elements.topic.value, poultryType: form.elements.poultryType.value }, meta);
      navigate(`/guidance/articles${queryString(next)}`, { replace: true });
    });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const next = cleanFilters({
        q: form.elements.q.value, poultryType: form.elements.poultryType.value, topic: form.elements.topic.value,
        stage: form.elements.stage ? form.elements.stage.value : '',
      }, meta);
      navigate(`/guidance/articles${queryString(next)}`);
    });
    return form;
  }

  async function load() {
    setContent(controls, loadingBlock('Loading the filters…'));
    try {
      ({ data: meta } = await getTopics());
      if (!controls.isConnected) return;
      const filters = cleanFilters(new URLSearchParams(queryString(query)), meta);
      setContent(controls, filterForm(filters), chips(filters));
      loadResults(filters);
    } catch (error) {
      if (error.status === 401 || !controls.isConnected) return;
      setContent(controls, errorBlock(error, { onRetry: load }));
    }
  }
  load();

  const searching = Boolean(query.q);
  return h('div', {},
    pageHeading(searching ? 'Search results' : 'Guidance articles'),
    guidanceBreadcrumbs([searching ? 'Search results' : 'All articles']),
    guidanceNav('articles'),
    controls,
    results);
}
