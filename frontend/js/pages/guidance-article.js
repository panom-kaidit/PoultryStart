// One guidance article page.
import { h, pageHeading, setContent } from '../components/dom.js';
import { alertBox } from '../components/alerts.js';
import { loadingBlock, errorBlock } from '../components/loading.js';
import { accordionRow } from '../components/ui.js';
import { disclaimerBox, evidenceTags, stagesText, backTarget, articleHref, isArticleCode, catalogueHref, stageLabel, POULTRY_TYPE_NAMES } from '../components/guidance.js';
import { getTopics, getArticle } from '../api/guidance.js';
import { getCurrentFarm } from '../farm/farm.js';
import { canDo } from '../farm/access.js';
import { notFoundPage } from './errors.js';
import { formatDate } from '../utils/dates.js';
import { shortLabel } from '../farm/flocks-view.js';

const SOURCE_TYPE_NAMES = {
  UG: 'Uganda official', 'UG-R': 'Ugandan research', SUP: 'Ugandan supplier', INT: 'International', PD: 'PoultryStart', report: 'PoultryStart research report',
};

function stageTags(a, meta) {
  if (a.stages === 'any') return ['All stages'];
  return Object.entries(a.stages || {}).flatMap(([type, list]) => list.map((s) => {
    const found = stageLabel(meta, type, s);
    return s === 'preparation' ? 'Before chicks' : shortLabel(found?.label || s);
  })).filter((v, i, all) => all.indexOf(v) === i);
}

export function guidanceArticlePage({ params, query }) {
  const code = params.code;
  if (!isArticleCode(code)) return notFoundPage();
  const heading = pageHeading('Guidance article');
  const top = h('div', { class: 'article-top' });
  const body = h('div', {}, loadingBlock('Loading the article…'));

  async function load() {
    setContent(body, loadingBlock('Loading the article…'));
    try {
      const [{ data: meta }, { data }] = await Promise.all([getTopics(), getArticle(code)]);
      if (!body.isConnected) return;
      const a = data.article;
      const back = backTarget(query.back, meta);
      heading.textContent = a.title;
      const typeName = POULTRY_TYPE_NAMES[a.poultryType] || a.poultryType;
      const farm = getCurrentFarm()?.farm || null;
      setContent(top,
        h('nav', { class: 'article-crumbs', 'aria-label': 'Breadcrumb' },
          h('a', { href: '#/learn' }, 'Learn'), ' / ',
          h('a', { href: catalogueHref({ topic: a.topic }) }, a.topicLabel || a.topic), ' / ',
          h('span', { 'aria-current': 'page' }, a.title)),
        h('ul', { class: 'article-tags', 'aria-label': 'For' }, [typeName, ...stageTags(a, meta)].map((t) => h('li', {}, t))),
        heading,
        h('p', { class: 'article-meta' }, `${a.topicLabel || a.topic} · Reviewed ${formatDate(a.reviewedOn)} · content version ${a.contentVersion}`));

      const figures = a.keyValues.length ? h('section', { class: 'article-card', 'aria-labelledby': 'article-values' },
        h('h2', { id: 'article-values' }, 'Key figures'),
        h('p', { class: 'article-small' }, 'Each figure keeps its label. International and supplier figures are not Ugandan standards and may apply only to the named strain or housing.'),
        h('ul', { class: 'article-figures' }, a.keyValues.map((value) => h('li', {},
          h('p', { class: 'key-value__text' }, h('span', { class: 'evidence-tag' }, value.label), ' ', value.text),
          value.qualification ? h('p', { class: 'key-value__qualification' }, value.qualification) : null,
          h('p', { class: 'article-small' }, `Source: ${(value.sources || []).join('; ')}${value.reference ? ` (${value.reference})` : ''}`))))) : null;

      const sources = h('div', {},
        h('ul', { class: 'plain-list' }, (a.sources || []).map((s) => h('li', {}, `${s.name} (${SOURCE_TYPE_NAMES[s.type] || s.type})`))));
      const more = h('section', { class: 'article-card article-card--flush', 'aria-label': 'More about this guidance' },
        a.sourceDifferences ? accordionRow({ title: 'Where sources differ', body: h('p', {}, a.sourceDifferences), open: true }) : null,
        a.limits ? accordionRow({ title: 'Limits of this guidance', body: h('p', {}, a.limits) }) : null,
        accordionRow({ title: `Sources (${(a.sources || []).length})`, body: sources }));

      const notSure = h('section', { class: 'article-card', 'aria-labelledby': 'article-notsure' },
        h('h2', { id: 'article-notsure' }, 'Not sure?'),
        h('p', {}, a.referral || 'Ask your vet or district extension officer before making changes.'),
        a.topic === 'health_monitoring' ? null
          : h('a', { class: 'article-btn', href: catalogueHref({ topic: 'health_monitoring' }) }, 'Health guidance: when to call for help'),
        farm && canDo(farm.myRole, 'health:create')
          ? h('a', { class: 'article-btn article-btn--plain', href: `#/farms/${farm.id}/health/new` }, 'Write down what you noticed') : null);

      const related = a.relatedArticles?.length ? h('section', { class: 'article-card article-card--flush', 'aria-labelledby': 'article-related' },
        h('h2', { id: 'article-related' }, 'Related'),
        h('ul', { class: 'article-related' }, a.relatedArticles.filter((r) => isArticleCode(r.code)).map((r) =>
          h('li', {}, h('a', { href: articleHref(r.code, query.back) }, r.title))))) : null;

      setContent(body, h('div', { class: 'article-layout' },
        h('div', { class: 'article-main' },
          h('p', { class: 'article-summary' }, a.summary),
          a.notice ? alertBox('warning', a.notice, { title: 'Please note' }) : null,
          a.steps.length ? h('section', { class: 'article-card article-card--flush', 'aria-labelledby': 'article-steps' },
            h('h2', { id: 'article-steps' }, 'What to do'),
            h('ol', { class: 'article-steps' }, a.steps.map((step, i) => h('li', {}, h('span', { class: 'article-steps__n', 'aria-hidden': 'true' }, String(i + 1)), h('span', {}, step))))) : null,
          more,
          h('section', { class: 'article-card', 'aria-labelledby': 'article-about' },
            h('h2', { id: 'article-about' }, 'About this article'),
            h('dl', { class: 'details' },
              h('dt', {}, 'For'), h('dd', {}, typeName),
              h('dt', {}, 'Topic'), h('dd', {}, h('a', { href: catalogueHref({ topic: a.topic }) }, a.topicLabel || a.topic)),
              h('dt', {}, 'Stages'), h('dd', {}, h('ul', { class: 'plain-list' }, [].concat(stagesText(a.stages, meta)).map((line) => h('li', {}, line)))),
              h('dt', {}, 'Article code'), h('dd', {}, a.code)),
            h('h3', {}, 'Evidence'),
            evidenceTags(a.evidenceLabels, meta),
            h('dl', { class: 'details evidence-legend' }, a.evidenceLabels.map((e) => [h('dt', {}, `${e.code}: ${e.label}`), h('dd', {}, e.explanation)]))),
          disclaimerBox(data.disclaimer),
          h('p', {}, h('a', { href: back.href }, back.label))),
        h('aside', { class: 'article-side', 'aria-label': 'Figures and help' }, figures, notSure, related)));
    } catch (error) {
      if (error.status === 401 || !body.isConnected) return;
      setContent(top, h('nav', { class: 'article-crumbs', 'aria-label': 'Breadcrumb' }, h('a', { href: '#/learn' }, 'Learn')), heading);
      setContent(body, errorBlock(error, {
        onRetry: error.status === 0 || error.status >= 500 ? load : undefined,
        actions: [h('a', { class: 'button', href: '#/guidance' }, 'Go to the guidance library')],
      }));
    }
  }
  load();

  return h('div', { class: 'article' }, top, body);
}
