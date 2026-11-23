// The Poultry Advisor is RULE-BASED and READ-ONLY
import { h } from './dom.js';
import { alertBox, statusLabel } from './alerts.js';
import { canDo, canOpen } from '../farm/access.js';
import { isArticleCode, articleHref } from './guidance.js';

export const ADVISOR_LIMITATION = 'This Advisor only evaluates information recorded in PoultryStart. No alert does not mean your flock is healthy or that there is no problem.';


export const PRIORITIES = Object.freeze({
  urgent: { label: 'Urgent', kind: 'error' },
  important: { label: 'Important', kind: 'warning' },
  routine: { label: 'Routine', kind: 'info' },
  info: { label: 'For information', kind: 'info' },
});

const id = (value) => (Number.isInteger(value) && value > 0 ? value : null);
const RECORD_PATHS = { feed: 'feed', water: 'water', eggs: 'eggs', weight: 'weights', weights: 'weights' };


export function actionFor(farm, target, flockNames = new Map()) {
  if (!target || typeof target !== 'object' || typeof target.path !== 'string') return null;
  if (!target.path.startsWith(`/api/farms/${farm.id}/`)) return null;
  const role = farm.myRole;
  const base = `#/farms/${farm.id}`;
  const flockName = (fid) => flockNames.get(fid);
  switch (target.type) {
    case 'flock': {
      const fid = id(target.id);
      return fid && canOpen(role, 'flocks') ? { href: `${base}/flocks/${fid}`, label: flockName(fid) ? `Open ${flockName(fid)}` : 'Open the flock' } : null;
    }
    case 'mortality_form': {
      const fid = id(target.flockId);
      return fid && canDo(role, 'flocks:record_mortality') ? { href: `${base}/flocks/${fid}`, label: 'Record deaths (on the flock page)' } : null;
    }
    case 'flock_update': {
      const fid = id(target.id);
      return fid && canDo(role, 'flocks:manage') ? { href: `${base}/flocks/${fid}/edit`, label: 'Update the flock\'s details' } : null;
    }
    case 'record_form': {
      const fid = id(target.flockId);
      const path = RECORD_PATHS[target.recordType];
      if (!fid || !path || !canDo(role, 'production:create')) return null;
      if (path === 'eggs' && farm.poultryType !== 'layer') return null;
      return { href: `${base}/records/${path}/new?flockId=${fid}`, label: `Add a ${path === 'weights' ? 'weight' : path === 'eggs' ? 'egg' : path} record` };
    }
    case 'production_record': {
      const fid = id(target.flockId);
      const rid = id(target.id);
      const path = RECORD_PATHS[target.recordType];
      return fid && rid && path && canOpen(role, 'records') ? { href: `${base}/records/${path}/${fid}/${rid}`, label: 'Open the record' } : null;
    }
    case 'health_observation': {
      const fid = id(target.flockId);
      const oid = id(target.id);
      return fid && oid && canOpen(role, 'health') ? { href: `${base}/health/flocks/${fid}/${oid}`, label: 'Open the health observation' } : null;
    }
    case 'task': {
      // The task's own page (GET /tasks/:id): it never generates tasks.
      const tid = id(target.id);
      return tid && canOpen(role, 'tasks') ? { href: `${base}/tasks/${tid}`, label: 'Open the task' } : null;
    }
    case 'readiness':
    case 'readiness_start':
      return canOpen(role, 'readiness')
        ? { href: `${base}/readiness`, label: target.type === 'readiness_start' ? 'Go to the readiness assessment' : 'Open the readiness assessment' } : null;
    default:
      return null;
  }
}

export function adviceCard(farm, item, { index, flockNames, back }) {
  const priority = PRIORITIES[item.priority] || PRIORITIES.info;
  const actions = (item.targets || []).map((t) => actionFor(farm, t, flockNames)).filter(Boolean)
    .filter((a, i, all) => all.findIndex((b) => b.href === a.href) === i);
  const guidance = (item.guidance || []).filter((g) => isArticleCode(g.code));
  const titleId = `advice-${index}-title`;
  return h('li', { class: `card advice-card advice-card--${item.priority in PRIORITIES ? item.priority : 'info'}`, 'aria-labelledby': titleId },
    h('p', {}, statusLabel(priority.kind, priority.label)),
    h('h3', { id: titleId }, item.title),
    item.flockId && flockNames.get(item.flockId) ? h('p', { class: 'farm-card__meta' }, `Flock: ${flockNames.get(item.flockId)}`) : null,
    h('p', {}, item.message),
    item.nextStep ? h('p', {}, h('strong', {}, 'Next step: '), item.nextStep) : null,
    actions.length ? h('div', { class: 'button-row' }, actions.map((a) => h('a', { class: 'button button--secondary button--small', href: a.href }, a.label))) : null,
    h('details', { class: 'advice-details' },
      h('summary', {}, 'Why this advice, and what to read'),
      h('p', {}, h('strong', {}, 'Basis: '), item.basis?.explanation || 'A PoultryStart rule.'),
      item.basis?.labels?.length ? h('p', { class: 'small-print' }, `Evidence label${item.basis.labels.length === 1 ? '' : 's'}: ${item.basis.labels.join(', ')}. Rule ${item.rule}.`) : null,
      guidance.length
        ? [h('p', {}, h('strong', {}, 'Guidance to read:')),
          h('ul', { class: 'plain-list' }, guidance.map((g) => h('li', {}, h('a', { href: articleHref(g.code, back) }, g.title))))]
        : h('p', { class: 'small-print' }, 'No guidance article is linked to this advice.')));
}

export function limitationBox(text) {
  return h('div', { class: 'disclaimer' }, alertBox('warning', text || ADVISOR_LIMITATION, { title: 'What the Advisor can and cannot tell you' }));
}
