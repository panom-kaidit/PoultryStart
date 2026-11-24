// Shared redesign UI components built as safe DOM nodes.
import { h } from './dom.js';
import { icon } from './icons.js';

let idCounter = 0;
const nextId = (prefix) => `${prefix}-${++idCounter}`;

const press = (element, on) => {
  element.setAttribute('aria-pressed', String(Boolean(on)));
  element.classList.toggle('is-on', Boolean(on));
};

export function backLink({ href, label }) {
  return h('a', { class: 'ui-back', href }, icon('chevronLeft', { size: 20 }), label);
}

export function button({ label, variant = 'primary', href, onClick, type = 'button', iconName, disabled = false, attrs = {} }) {
  const className = `ui-btn ui-btn--${variant}`;
  const content = [iconName ? icon(iconName, { size: 18 }) : null, label];
  if (href) return h('a', { class: className, href, ...attrs }, content);
  return h('button', { class: className, type, onclick: onClick, disabled, ...attrs }, content);
}

export function textField({ id = nextId('field'), name, label, hint, type = 'text', inputmode, unit, prefix, value, placeholder,
  required = false, size = '', autocomplete, min, max, step, onInput }) {
  const hintId = hint ? `${id}-hint` : undefined;
  const input = h('input', {
    class: ['ui-input', size ? `ui-input--${size}` : '', unit ? 'has-unit' : '', prefix ? 'has-prefix' : ''].filter(Boolean).join(' '),
    id, name: name || id, type, inputmode, placeholder, required, autocomplete, min, max, step,
    'aria-describedby': hintId, oninput: onInput,
  });
  if (value !== undefined && value !== null) input.value = String(value);
  const wrap = h('div', { class: 'ui-input-wrap' },
    prefix ? h('span', { class: 'ui-input-prefix', 'aria-hidden': 'true' }, prefix) : null,
    input,
    unit ? h('span', { class: 'ui-input-unit', 'aria-hidden': 'true' }, unit) : null);
  return {
    element: h('div', { class: 'ui-field' },
      h('label', { class: 'ui-label', for: id }, label, unit ? h('span', { class: 'visually-hidden' }, ` (${unit})`) : null),
      wrap,
      hint ? h('p', { class: 'ui-hint', id: hintId }, hint) : null),
    input,
  };
}

export function textArea({ id = nextId('area'), name, label, placeholder, value, rows = 3 }) {
  const area = h('textarea', { class: 'ui-input ui-textarea', id, name: name || id, placeholder, rows });
  if (value) area.value = value;
  return { element: h('div', { class: 'ui-field' }, h('label', { class: 'ui-label', for: id }, label), area), input: area };
}

export function chip({ label, pressed = false, onClick, variant = '' }) {
  const element = h('button', { type: 'button', class: `ui-chip${variant ? ` ui-chip--${variant}` : ''}`, onclick: onClick }, label);
  press(element, pressed);
  return element;
}

export function chipGroup({ label, options, value, multi = false, onChange, variant = '', columns }) {
  let selected = multi ? new Set(value || []) : value;
  const buttons = options.map((option) => {
    const element = chip({ label: option.label, variant,
      pressed: multi ? selected.has(option.id) : selected === option.id,
      onClick: () => {
        if (multi) {
          if (selected.has(option.id)) selected.delete(option.id); else selected.add(option.id);
        } else {
          selected = option.id;
        }
        sync();
        if (onChange) onChange(multi ? new Set(selected) : selected);
      } });
    element.dataset.value = option.id;
    return element;
  });
  const sync = () => buttons.forEach((b) => press(b, multi ? selected.has(b.dataset.value) : selected === b.dataset.value));
  const element = h('div', { class: `ui-chips${columns ? ' ui-chips--grid' : ''}`, role: 'group', 'aria-label': label }, buttons);
  if (columns) element.style.setProperty('--columns', String(columns));
  return {
    element,
    get value() { return multi ? new Set(selected) : selected; },
    set value(next) { selected = multi ? new Set(next) : next; sync(); },
  };
}

export function choiceCard({ iconName, title, subtitle, pressed = false, onClick }) {
  const element = h('button', { type: 'button', class: 'ui-choice', onclick: onClick },
    iconName ? icon(iconName, { size: 30, color: 'var(--green-700)', strokeWidth: 1.8 }) : null,
    h('span', { class: 'ui-choice__title' }, title),
    subtitle ? h('span', { class: 'ui-choice__sub' }, subtitle) : null);
  press(element, pressed);
  return element;
}

export function segmented({ label, options, value, onChange }) {
  let selected = value;
  const buttons = options.map((option) => h('button', {
    type: 'button', class: 'ui-seg__opt', dataset: { value: option.id },
    onclick: () => { selected = option.id; sync(); if (onChange) onChange(selected); },
  }, option.label));
  const sync = () => buttons.forEach((b) => press(b, b.dataset.value === selected));
  sync();
  return {
    element: h('div', { class: 'ui-seg', role: 'group', 'aria-label': label }, buttons),
    get value() { return selected; },
  };
}

export function stepper({ id = nextId('step'), label, value = 0, step = 1, min = 0, editable = true, size = 'sm', inputmode = 'decimal',
  decLabel = `Less ${label}`, incLabel = `More ${label}`, onChange }) {
  let current = Number(value) || 0;
  const valueEl = editable
    ? h('input', { class: 'ui-stepper__value', id, type: 'number', inputmode, min, step: 'any', 'aria-label': label })
    : h('output', { class: 'ui-stepper__value', id, 'aria-live': 'polite', 'aria-label': label });
  const show = () => { if (editable) valueEl.value = String(current); else valueEl.textContent = String(current); };
  const set = (next) => {
    current = Math.max(min, Math.round(next * 1000) / 1000);
    show();
    if (onChange) onChange(current);
  };
  if (editable) {
    valueEl.addEventListener('input', () => {
      const parsed = Number(valueEl.value);
      if (valueEl.value !== '' && Number.isFinite(parsed)) { current = parsed; if (onChange) onChange(current); }
    });
  }
  show();
  return {
    element: h('div', { class: `ui-stepper ui-stepper--${size}` },
      h('button', { type: 'button', class: 'ui-stepper__btn', 'aria-label': decLabel, onclick: () => set(current - step) }, '−'),
      valueEl,
      h('button', { type: 'button', class: 'ui-stepper__btn', 'aria-label': incLabel, onclick: () => set(current + step) }, '+')),
    input: valueEl,
    get value() { return current; },
    set value(next) { current = Number(next) || 0; show(); },
  };
}

export function progressBar({ value, max, label, size = 'sm' }) {
  const pct = max > 0 ? Math.round(Math.min(1, Math.max(0, value / max)) * 100) : 0;
  const fill = h('div', { class: 'ui-progress__fill' });
  fill.style.width = `${pct}%`;
  return h('div', {
    class: `ui-progress ui-progress--${size}`, role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(max),
    'aria-valuenow': String(value), 'aria-label': label,
  }, fill);
}

export function stepHeader({ step, total, backHref, backLabel = 'Back' }) {
  return h('div', { class: 'ui-stephead' },
    h('div', { class: 'ui-stephead__row' },
      backLink({ href: backHref, label: backLabel }),
      h('span', { class: 'ui-stephead__count' }, `Step ${step} of ${total}`)),
    progressBar({ value: step, max: total, label: `Step ${step} of ${total}` }));
}

export function card({ title, headingLevel = 'h2', trailing, children = [], flush = false, variant = '' }) {
  return h('section', { class: ['ui-card', flush ? 'ui-card--flush' : '', variant ? `ui-card--${variant}` : ''].filter(Boolean).join(' ') },
    title ? h('div', { class: 'ui-card__head' }, h(headingLevel, { class: 'ui-card__title' }, title), trailing || null) : null,
    children);
}

export function listRow({ label, sub, href, onClick, iconName, trailing, chevron = Boolean(href || onClick), tone = '' }) {
  const content = [
    iconName ? h('span', { class: 'ui-row__icon' }, icon(iconName, { size: 18 })) : null,
    h('span', { class: 'ui-row__text' }, h('span', { class: 'ui-row__label' }, label), sub ? h('span', { class: 'ui-row__sub' }, sub) : null),
    trailing || null,
    chevron ? icon('chevronRight', { size: 18 }) : null,
  ];
  const className = `ui-row${tone ? ` ui-row--${tone}` : ''}`;
  if (href) return h('a', { class: className, href }, content);
  if (onClick) return h('button', { type: 'button', class: className, onclick: onClick }, content);
  return h('div', { class: className }, content);
}

export function badge(text, tone = 'neutral') {
  return h('span', { class: `ui-badge ui-badge--${tone}` }, text);
}

export function sectionLabel(text) {
  return h('h2', { class: 'ui-section-label' }, text);
}

export function statTile({ label, value, sub, href, warning = false, action, size = '' }) {
  const content = [
    h('span', { class: 'ui-stat__label' }, label),
    h('span', { class: `ui-stat__value${warning ? ' ui-stat__value--warning' : ''}` }, value),
    sub ? h('span', { class: 'ui-stat__sub' }, sub) : null,
    action ? h('span', { class: 'ui-stat__action' }, action) : null,
  ];
  const className = ['ui-stat', warning ? 'ui-stat--warning' : '', size ? `ui-stat--${size}` : ''].filter(Boolean).join(' ');
  return href ? h('a', { class: className, href }, content) : h('div', { class: className }, content);
}

export function taskRow({ title, meta, done = false, onToggle, recordHref, recordLabel = 'Record', toggleDisabled = false }) {
  const check = h('button', {
    type: 'button', class: 'ui-task__check', 'aria-label': `Mark done: ${title}`, disabled: toggleDisabled,
    onclick: () => { if (onToggle) onToggle(!done); },
  }, done ? icon('check', { size: 16, color: '#fff' }) : null);
  press(check, done);
  return h('div', { class: `ui-task${done ? ' is-done' : ''}` },
    check,
    h('div', { class: 'ui-task__text' }, h('span', { class: 'ui-task__title' }, title), meta ? h('span', { class: 'ui-task__meta' }, meta) : null),
    recordHref && !done ? h('a', { class: 'ui-btn ui-btn--soft ui-btn--inline', href: recordHref }, recordLabel) : null);
}

export function adviceCard({ title, body, links = [], iconName = 'trend' }) {
  return h('div', { class: 'ui-advice' },
    h('span', { class: 'ui-advice__icon' }, icon(iconName, { size: 18 })),
    h('div', { class: 'ui-advice__body' },
      h('div', { class: 'ui-advice__title' }, title),
      body ? h('p', {}, body) : null,
      links.length ? h('div', { class: 'ui-advice__links' }, links.map((l) => h('a', { href: l.href }, l.label))) : null));
}

export function successCard({ title, children = [] }) {
  return h('div', { class: 'ui-alert ui-alert--success', role: 'status' },
    h('div', { class: 'ui-alert__title' }, icon('check', { size: 22, strokeWidth: 2.4 }), title), children);
}

export function warningCard({ title, have, need, children = [] }) {
  return h('div', { class: 'ui-alert ui-alert--warning', role: 'status' },
    h('div', { class: 'ui-alert__title' }, icon('warning', { size: 22 }), title),
    have || need ? h('div', { class: 'ui-alert__pair' },
      have ? h('div', { class: 'ui-mini' }, h('div', { class: 'ui-mini__label' }, have.label), h('div', { class: 'ui-mini__value' }, have.value)) : null,
      need ? h('div', { class: 'ui-mini' }, h('div', { class: 'ui-mini__label' }, need.label), h('div', { class: 'ui-mini__value' }, need.value)) : null) : null,
    children);
}

export function urgentCard({ title, body, action }) {
  return h('div', { class: 'ui-alert ui-alert--urgent' },
    h('div', { class: 'ui-alert__title' }, title),
    body ? h('p', {}, body) : null,
    action || null);
}

export function gapCard({ iconName = 'warning', title, reason, actions = [] }) {
  return h('div', { class: 'ui-gap' },
    h('div', { class: 'ui-gap__title' }, h('span', { class: 'ui-gap__dot' }, icon(iconName, { size: 16 })), title),
    reason ? h('p', {}, reason) : null,
    actions.length ? h('div', { class: 'ui-gap__actions' }, actions) : null);
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attributes) => {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  return element;
};

export function readinessRing({ ready, total }) {
  const circumference = 2 * Math.PI * 36;
  const filled = total > 0 ? (ready / total) * circumference : 0;
  const svg = svgEl('svg', { width: 84, height: 84, viewBox: '0 0 84 84', 'aria-hidden': 'true', focusable: 'false' });
  svg.append(
    svgEl('circle', { cx: 42, cy: 42, r: 36, fill: 'none', stroke: 'var(--divider)', 'stroke-width': 10 }),
    svgEl('circle', { cx: 42, cy: 42, r: 36, fill: 'none', stroke: 'var(--amber-ring)', 'stroke-width': 10, 'stroke-linecap': 'round',
      'stroke-dasharray': `${filled.toFixed(1)} ${circumference.toFixed(1)}`, transform: 'rotate(-90 42 42)' }));
  return h('div', { class: 'ui-ring', role: 'img', 'aria-label': `${ready} of ${total} ready` },
    svg, h('span', { class: 'ui-ring__text', 'aria-hidden': 'true' }, `${ready}/${total}`));
}

export function checklistGroup({ title, items, onToggle }) {
  const rows = items.map((item) => {
    let done = Boolean(item.done);
    const box = h('span', { class: 'ui-check__box', 'aria-hidden': 'true' });
    const row = h('button', { type: 'button', class: 'ui-check' }, box, h('span', { class: 'ui-check__label' }, item.label));
    const sync = () => {
      press(row, done);
      box.replaceChildren(...(done ? [icon('check', { size: 16, color: '#fff' })] : []));
    };
    row.addEventListener('click', async () => {
      done = !done;
      sync();
      if (!onToggle) return;
      try {
        await onToggle(item.id, done);
      } catch {
        done = !done;
        sync();
      }
    });
    sync();
    return row;
  });
  return h('section', { class: 'ui-card ui-card--flush ui-checklist' }, h('h2', { class: 'ui-checklist__title' }, title), rows);
}

export function tabs({ label, items, selected, onSelect, panelId }) {
  const buttons = items.map((item) => h('button', {
    type: 'button', role: 'tab', class: 'ui-tab', id: `tab-${item.id}`, 'aria-controls': panelId,
    'aria-selected': String(item.id === selected), tabindex: item.id === selected ? '0' : '-1',
    onclick: () => onSelect(item.id),
  }, item.label));
  const list = h('div', { class: 'ui-tabs', role: 'tablist', 'aria-label': label }, buttons);
  list.addEventListener('keydown', (event) => {
    const index = buttons.indexOf(document.activeElement);
    if (index < 0) return;
    const moves = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: buttons.length - 1 };
    if (!(event.key in moves)) return;
    event.preventDefault();
    const next = (moves[event.key] + buttons.length) % buttons.length;
    buttons[next].focus();
    onSelect(items[next].id);
  });
  return list;
}

export function barChart({ values, ariaLabel, height = 110, showValues = true, showLabels = true, dense = false }) {
  const max = Math.max(0, ...values.map((v) => Number(v.value) || 0));
  const columns = values.map((v, i) => {
    const bar = h('div', { class: `ui-bars__bar${i === values.length - 1 ? ' is-latest' : ''}` });
    const usable = showValues ? height - 18 : height;
    bar.style.height = `${max > 0 ? Math.max(2, Math.round(((Number(v.value) || 0) / max) * usable)) : 2}px`;
    return h('div', { class: 'ui-bars__col' }, showValues ? h('span', { class: 'ui-bars__value' }, v.display ?? String(v.value)) : null, bar);
  });
  const chart = h('div', { class: `ui-bars${dense ? ' ui-bars--dense' : ''}`, role: 'img', 'aria-label': ariaLabel }, columns);
  chart.style.height = `${height}px`;
  return h('div', { class: 'ui-chart' }, chart,
    showLabels ? h('div', { class: 'ui-bars__labels', 'aria-hidden': 'true' }, values.map((v) => h('span', {}, v.label))) : null);
}

export function stageProgress({ stages, current }) {
  return h('div', { class: 'ui-stages', role: 'img', 'aria-label': `Stage ${current + 1} of ${stages.length}: ${stages[current]?.label || ''}` },
    h('div', { class: 'ui-stages__bar' }, stages.map((s, i) => h('span', { class: `ui-stages__seg${i < current ? ' is-past' : i === current ? ' is-current' : ''}` }))),
    h('div', { class: 'ui-stages__labels', 'aria-hidden': 'true' }, stages.map((s, i) => h('span', { class: i === current ? 'is-current' : '' }, s.label))));
}

export function timelineRow({ kind = 'other', title, meta, href }) {
  const content = [h('span', { class: `ui-dot ui-dot--${kind}`, 'aria-hidden': 'true' }),
    h('div', { class: 'ui-event__text' }, h('div', { class: 'ui-event__title' }, title), meta ? h('div', { class: 'ui-event__meta' }, meta) : null)];
  return href ? h('a', { class: 'ui-event', href }, content) : h('div', { class: 'ui-event' }, content);
}

export function accordionRow({ title, body, open = false }) {
  const panelId = nextId('acc');
  const sign = h('span', { class: 'ui-acc__sign', 'aria-hidden': 'true' }, open ? '−' : '+');
  const panel = h('div', { class: 'ui-acc__panel', id: panelId, hidden: !open }, body);
  const toggle = h('button', { type: 'button', class: 'ui-acc', 'aria-expanded': String(open), 'aria-controls': panelId },
    h('span', {}, title), sign);
  toggle.addEventListener('click', () => {
    const next = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(next));
    panel.hidden = !next;
    sign.textContent = next ? '−' : '+';
  });
  return h('div', { class: 'ui-acc-item' }, toggle, panel);
}

export function sourceBadge(code) {
  return h('span', { class: 'ui-src' }, code);
}

export function emptyBlock({ title, text, action }) {
  return h('div', { class: 'ui-empty' }, h('h2', {}, title), text ? h('p', {}, text) : null, action || null);
}
