// The broiler or layer guidance page.
import { h, pageHeading, setContent } from '../components/dom.js';
import { loadingBlock, errorBlock } from '../components/loading.js';
import {
  disclaimerBox, guidanceNav, guidanceBreadcrumbs, articleItem, catalogueHref, evidenceTags, POULTRY_TYPE_NAMES,
} from '../components/guidance.js';
import { getTopics, listArticles } from '../api/guidance.js';
import { notFoundPage } from './errors.js';

export function guidanceTypePage({ params }) {
  const type = params.poultryType;
  if (type !== 'broiler' && type !== 'layer') return notFoundPage();
  const name = POULTRY_TYPE_NAMES[type];
  const body = h('div', {}, loadingBlock(`Loading the ${type} guidance…`));

  async function load() {
    setContent(body, loadingBlock(`Loading the ${type} guidance…`));
    try {
      const [{ data: meta }, { data }] = await Promise.all([getTopics(), listArticles({ poultryType: type })]);
      if (!body.isConnected) return;
      const back = `page:${type}`;
      const byTopic = meta.topics.map((t) => ({ ...t, articles: data.articles.filter((a) => a.topic === t.topic) }))
        .filter((t) => t.articles.length > 0);
      setContent(body,
        h('section', { class: 'card', 'aria-labelledby': 'type-stages' },
          h('h2', { id: 'type-stages' }, `${name}: stages`),
          h('p', {}, 'Choose a stage to see the articles for it. Articles that apply at every stage are included.'),
          h('ul', { class: 'plain-list stage-list' }, meta.stages[type].map((s) => h('li', {},
            h('a', { href: catalogueHref({ poultryType: type, stage: s.stage }) }, s.label),
            s.marker ? [' ', evidenceTags([s.marker], meta), h('span', { class: 'small-print' }, ` ${s.qualification}`)] : null)))),
        h('section', { class: 'card', 'aria-labelledby': 'type-topics' },
          h('h2', { id: 'type-topics' }, `${name}: topics`),
          h('ul', { class: 'plain-list topic-list' }, byTopic.map((t) => h('li', {},
            h('a', { href: catalogueHref({ poultryType: type, topic: t.topic }) }, t.label), ` (${t.articles.length})`)))),
        h('section', { 'aria-labelledby': 'type-articles' },
          h('h2', { id: 'type-articles' }, `All ${data.count} articles for ${type}s (including those for both kinds)`),
          byTopic.map((t) => h('div', { class: 'topic-group' },
            h('h3', {}, t.label),
            h('ul', { class: 'card-list' }, t.articles.map((a) => articleItem(a, { meta, back })))))),
        disclaimerBox(data.disclaimer));
    } catch (error) {
      if (error.status === 401 || !body.isConnected) return;
      setContent(body, errorBlock(error, { onRetry: load }));
    }
  }
  load();

  return h('div', {},
    pageHeading(`${name}: guidance`),
    guidanceBreadcrumbs([name]),
    guidanceNav(type),
    body);
}
