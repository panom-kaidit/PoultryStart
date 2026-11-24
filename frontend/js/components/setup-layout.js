// Guided farm setup frame (css/setup.css): header, step rail, the step's content, Back / Continue row.
import { h, pageHeading } from './dom.js';
import { icon } from './icons.js';

export const SETUP_STEPS = [
  { key: 'birds', label: 'Your birds' },
  { key: 'house', label: 'Your house' },
  { key: 'ready', label: 'Before chicks arrive' },
  { key: 'result', label: 'Your results' },
];

// hrefFor(key) -> the address of a step the user may go back to, or null (not reachable yet).
function stepRail(current, hrefFor) {
  const currentIndex = SETUP_STEPS.findIndex((s) => s.key === current);
  return h('nav', { class: 'setup-rail', 'aria-label': 'Setup steps' },
    h('ol', {}, SETUP_STEPS.map((step, index) => {
      const state = index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'todo';
      const marker = h('span', { class: 'setup-rail__marker', 'aria-hidden': 'true' },
        state === 'done' ? icon('check', { size: 14, strokeWidth: 3 }) : String(index + 1));
      const status = h('span', { class: 'visually-hidden' }, state === 'done' ? ' (done)' : state === 'current' ? ' (current step)' : '');
      const href = state === 'current' ? null : hrefFor(step.key);
      const content = [marker, h('span', { class: 'setup-rail__label' }, step.label), status];
      return h('li', { class: `setup-rail__item is-${state}` },
        href ? h('a', { href }, content) : h('span', { 'aria-current': state === 'current' ? 'step' : undefined }, content));
    })),
    h('p', { class: 'setup-rail__compact' },
      `Step ${currentIndex + 1} of ${SETUP_STEPS.length} · ${SETUP_STEPS[currentIndex].label}`));
}

// The whole page. saveLater: an element for the header (a button or link) or null.
export function setupPage({ step, hrefFor, saveLater = null, stepLabel, title, lead, aside = null, content, footer, wide = false }) {
  return h('div', { class: 'setup-page' },
    h('header', { class: 'setup-header' },
      h('div', { class: 'setup-header__brand' },
        h('span', { class: 'setup-header__mark' }, icon('eggFilled', { size: 18, color: 'currentColor' })),
        h('span', { class: 'setup-header__name' }, 'PoultryStart'),
        h('span', { class: 'setup-header__context' }, '· Set up your farm')),
      saveLater),
    h('div', { class: `setup-body${wide ? ' setup-body--wide' : ''}` },
      stepRail(step, hrefFor),
      h('div', { class: 'setup-main' },
        stepLabel ? h('p', { class: 'setup-steplabel' }, stepLabel) : null,
        h('div', { class: 'setup-titlerow' },
          h('div', {}, title ? pageHeading(title) : null, lead ? h('p', { class: 'setup-lead' }, lead) : null),
          aside),
        content,
        footer || null)));
}

// Back on the left, the main action(s) on the right.
export function setupFooter({ back = null, actions = [] }) {
  return h('div', { class: 'setup-footer' }, h('div', {}, back), h('div', { class: 'setup-footer__actions' }, actions));
}

export const setupButton = ({ label, onClick, variant = 'primary', type = 'button', href }) => (href
  ? h('a', { class: `setup-btn setup-btn--${variant}`, href }, label)
  : h('button', { type, class: `setup-btn setup-btn--${variant}`, onclick: onClick }, label));

// ---- House diagram -------------------------------------------------------

const SVG_NS = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs, text) => {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  if (text !== undefined) el.textContent = text;
  return el;
};
const fmt = (n) => (Math.round(n * 100) / 100).toLocaleString('en-GB');

// A top-down plan, to scale: the birds' floor in green, the space birds cannot use as a grey strip at one end.
export function houseDiagram({ length, width, unusable }) {
  const ok = length > 0 && width > 0;
  if (!ok) {
    return h('div', { class: 'setup-plan__empty' }, 'Enter the inside length and width to see your house from above.');
  }
  const W = 400;
  const H = 230;
  const scale = Math.min((W - 40) / length, (H - 40) / width);
  const rw = length * scale;
  const rh = width * scale;
  const x = (W - rw) / 2;
  const y = (H - rh) / 2;
  const gross = length * width;
  const safeUnusable = Math.min(Math.max(unusable || 0, 0), gross);
  const stripW = safeUnusable > 0 ? Math.max(3, (safeUnusable / width) * scale) : 0;
  const usable = gross - safeUnusable;
  const plan = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'setup-plan__svg', 'aria-hidden': 'true', focusable: 'false' });
  plan.append(svg('rect', { x, y, width: rw, height: rh, class: 'setup-plan__birds', rx: 3 }));
  if (stripW > 0) {
    const sx = x + rw - Math.min(stripW, rw);
    plan.append(
      svg('rect', { x: sx, y, width: Math.min(stripW, rw), height: rh, class: 'setup-plan__store' }),
      svg('line', { x1: sx, y1: y, x2: sx, y2: y + rh, class: 'setup-plan__divider' }));
    if (stripW >= 46) {
      plan.append(svg('text', { x: sx + Math.min(stripW, rw) / 2, y: y + rh / 2, class: 'setup-plan__storetext' }, 'Store'));
    }
  }
  plan.append(svg('rect', { x, y, width: rw, height: rh, class: 'setup-plan__walls', rx: 3 }));
  if (usable > 0 && rw - stripW > 90 && rh > 34) {
    plan.append(svg('text', { x: x + (rw - stripW) / 2, y: y + rh / 2, class: 'setup-plan__birdstext' }, `${fmt(usable)} m² for birds`));
  }
  const label = `House plan: ${fmt(length)} m by ${fmt(width)} m, ${fmt(gross)} m² in total; `
    + `${fmt(safeUnusable)} m² birds cannot use; ${fmt(Math.max(usable, 0))} m² for birds.`;
  return h('figure', { class: 'setup-plan__figure', role: 'img', 'aria-label': label },
    plan,
    h('figcaption', { class: 'setup-plan__legend' },
      h('span', {}, h('i', { class: 'setup-swatch setup-swatch--birds' }), `For birds: ${fmt(Math.max(usable, 0))} m²`),
      h('span', {}, h('i', { class: 'setup-swatch setup-swatch--store' }), `Cannot use: ${fmt(safeUnusable)} m²`),
      h('span', {}, `Whole floor: ${fmt(gross)} m²`)));
}
