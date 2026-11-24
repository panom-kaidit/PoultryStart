// Shared pieces for the guidance screens. Everything shown is the backend's reviewed catalogue (articles,
import { h } from './dom.js';
import { alertBox } from './alerts.js';
import { queryString } from '../api/production.js';

export const POULTRY_TYPE_NAMES = { broiler: 'Broilers', layer: 'Layers', all: 'Broilers and layers' };

export const isArticleCode = (code) => typeof code === 'string' && /^G-[A-Z]{2,4}-[A-Z]{2,8}-\d{2}$/.test(code);

// The catalogue filters, checked against the backend's own lists (GET /guidance/topics) so no unknown value
// reaches a link.
export function cleanFilters(source, meta) {
  const get = (key) => (typeof source.get === 'function' ? source.get(key) : source[key]) || '';
  const filters = {};
  const type = get('poultryType');
  if (['broiler', 'layer', 'all'].includes(type)) filters.poultryType = type;
  const topic = get('topic');
  if (topic && (!meta || meta.topics.some((t) => t.topic === topic))) filters.topic = topic;
  const stage = get('stage');
  const knownStages = meta ? new Set([...Object.values(meta.stages).flat().map((s) => s.stage), 'any']) : null;
  if (stage && /^[a-z_]{2,20}$/.test(stage) && (!knownStages || knownStages.has(stage))) filters.stage = stage;
  const q = get('q').trim();
  if (q) filters.q = q.slice(0, 100);
  return filters;
}

export const catalogueHref = (filters) => `#/guidance/articles${queryString(filters)}`;

export function articleHref(code, back) {
  if (!isArticleCode(code)) return null;
  return `#/guidance/${code}${back ? queryString({ back }) : ''}`;
}

export function backTarget(back, meta) {
  if (!back) return { href: '#/guidance', label: 'Back to the guidance library' };
  if (back === 'page:broiler' || back === 'page:layer') {
    const type = back.slice(5);
    return { href: `#/guidance/${type}`, label: `Back to the ${type} guidance` };
  }
  if (back === 'page:home') return { href: '#/guidance', label: 'Back to the guidance library' };
  const filters = cleanFilters(new URLSearchParams(back), meta);
  return { href: catalogueHref(filters), label: Object.keys(filters).length ? 'Back to your results' : 'Back to all articles' };
}

export function stageLabel(meta, type, stage) {
  return meta?.stages?.[type]?.find((s) => s.stage === stage) || null;
}

export function stagesText(stages, meta) {
  if (stages === 'any') return 'All stages';
  return Object.entries(stages || {}).map(([type, list]) => `${POULTRY_TYPE_NAMES[type] || type}: ${list.map((s) => {
    const found = stageLabel(meta, type, s);
    return found ? `${found.label}${found.marker ? ` [${found.marker}: ${found.qualification}]` : ''}` : s;
  }).join('; ')}`);
}

// The evidence labels as short tags; the meaning is in the accessible name.
export function evidenceTags(codes, meta) {
  return h('ul', { class: 'tag-row evidence-tags', 'aria-label': 'Evidence labels' },
    codes.map((item) => {
      const code = typeof item === 'string' ? item : item.code;
      const info = typeof item === 'string' ? meta?.evidenceLabels?.find((e) => e.code === code) : item;
      return h('li', { class: 'evidence-tag', title: info ? info.label : undefined },
        h('span', { 'aria-hidden': 'true' }, code), h('span', { class: 'visually-hidden' }, info ? `${code}: ${info.label}` : code));
    }));
}

export function evidenceLegend(meta, { headingId = 'evidence-legend' } = {}) {
  return h('section', { class: 'card', 'aria-labelledby': headingId },
    h('h2', { id: headingId }, 'What the evidence labels mean'),
    h('p', {}, 'Every article and every figure says where it comes from. International and supplier figures are not Ugandan standards. '
      + 'Where sources disagree, both are shown; they are never averaged.'),
    h('dl', { class: 'details evidence-legend' }, meta.evidenceLabels.map((e) => [
      h('dt', {}, h('span', { class: 'evidence-tag' }, e.code), ' ', e.label), h('dd', {}, e.explanation)])),
    h('h3', {}, 'Markers beside figures'),
    h('dl', { class: 'details evidence-legend' }, meta.markers.map((m) => [
      h('dt', {}, h('span', { class: 'evidence-tag' }, m.label)),
      h('dd', {}, m.qualification ? m.qualification.replace('{supplier}', 'the named supplier') : 'Uganda official source; the source is named beside the figure.')])));
}

export function disclaimerBox(text) {
  return h('div', { class: 'disclaimer' }, alertBox('warning', text, { title: 'Important' }));
}

export function articleItem(article, { meta, back }) {
  const href = articleHref(article.code, back);
  return h('li', { class: 'card article-card' },
    h('h3', {}, href ? h('a', { href }, article.title) : article.title),
    h('p', { class: 'farm-card__meta' }, `${POULTRY_TYPE_NAMES[article.poultryType] || article.poultryType} · ${article.topicLabel || article.topic} · ${article.code}`),
    h('p', {}, article.summary),
    evidenceTags(article.evidenceLabels || [], meta));
}

export function guidanceNav(active) {
  const tab = (key, href, label) => h('li', {},
    h('a', { class: 'section-tab', href, 'aria-current': active === key ? 'page' : undefined }, label));
  return h('nav', { class: 'type-nav', 'aria-label': 'Guidance pages' },
    h('ul', { class: 'section-tabs' },
      tab('home', '#/guidance', 'Library'),
      tab('broiler', '#/guidance/broiler', 'Broilers'),
      tab('layer', '#/guidance/layer', 'Layers'),
      tab('articles', '#/guidance/articles', 'All articles and search')));
}

export function guidanceBreadcrumbs(...trail) {
  const items = [['Guidance', '#/guidance'], ...trail];
  return h('nav', { class: 'breadcrumbs', 'aria-label': 'Breadcrumb' },
    h('ol', {}, items.map(([label, href], i) => (i === items.length - 1
      ? h('li', { 'aria-current': 'page' }, label)
      : h('li', {}, h('a', { href }, label))))));
}

