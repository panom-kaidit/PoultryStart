// Shared pieces for the dashboard and reports. Every figure is the backend's: no totals, rates, targets or
// scores are worked out here, and missing values ("no records", null) are never shown as zero.
import { h } from './dom.js';
import { alertBox } from './alerts.js';
import { canOpen } from '../farm/access.js';
import { queryString } from '../api/production.js';
import { formatDate, ugandaToday } from '../utils/dates.js';
import { formatNumber } from '../utils/format.js';

export const MAX_DAYS = 366;

// The approved report set. R6 is the owner's only (expenses).
export const REPORTS = Object.freeze([
  { key: 'population', code: 'R1', title: 'Flock population and movements',
    description: 'For one flock: the birds at the start and end of a period, every movement, and the population after each day with movements.',
    defaults: 'From the flock\'s arrival to today (or its closure), at most 366 days.' },
  { key: 'mortality', code: 'R2', title: 'Mortality',
    description: 'Deaths recorded in PoultryStart, after corrections, for the farm or one flock, by week and by day.',
    defaults: 'The last 31 days, at most 366 days.' },
  { key: 'production', code: 'R3', title: 'Production records',
    description: 'For one flock: bird weights, egg collections (layers, from the first-egg date), feed and drinking water.',
    defaults: 'The last 31 days, at most 366 days.' },
  { key: 'tasks', code: 'R4', title: 'Daily tasks',
    description: 'Tasks due in a period by status, by task and by week, with the problems reported.',
    defaults: 'The last 31 days, at most 366 days.' },
  { key: 'health', code: 'R5', title: 'Health observations',
    description: 'How many observations were recorded, for which flocks and dates, and whether a veterinarian or extension officer was contacted.',
    defaults: 'The last 31 days, at most 366 days.' },
  { key: 'expenses', code: 'R6', title: 'Expenses', ownerOnly: true,
    description: 'Money spent, per currency: by category, calendar month and flock. Voided expenses are not counted.',
    defaults: 'The last 31 days, at most 366 days.' },
]);

// The reports this role may open (R6 only with the expense screens).
export const reportsFor = (role) => REPORTS.filter((r) => !r.ownerOnly || canOpen(role, 'expenses'));
export const reportOf = (key) => REPORTS.find((r) => r.key === key) || null;
export const reportHref = (farmId, key, filters = {}) => `#/farms/${farmId}/reports/${key}${queryString(filters)}`;

export function reportsBreadcrumbs(farm, ...trail) {
  const items = [['Reports', `#/farms/${farm.id}/reports`], ...trail];
  return h('nav', { class: 'breadcrumbs', 'aria-label': 'Breadcrumb' },
    h('ol', {}, items.map(([label, href], i) => (i === items.length - 1
      ? h('li', { 'aria-current': 'page' }, label)
      : h('li', {}, h('a', { href }, label))))));
}

export const periodText = (period) => (period ? `${formatDate(period.from)} to ${formatDate(period.to)}` : 'No period');

// A count, or the words for "nothing recorded" when the backend gives null.
export const countOr = (value, missing = 'None recorded') => (value === null || value === undefined ? missing : formatNumber(value));

const DAY_MS = 86400000;
const daysInclusive = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS) + 1;

// The checks the backend also makes, so an impossible period is never sent. An empty date is left to the
// backend's default.
export function checkPeriod({ from, to }, today = ugandaToday()) {
  const errors = [];
  if (from && from > today) errors.push({ field: 'from', message: `"From" cannot be after today (${formatDate(today)}).` });
  if (to && to > today) errors.push({ field: 'to', message: `"To" cannot be after today (${formatDate(today)}).` });
  if (from && to && to < from) errors.push({ field: 'to', message: '"To" cannot be before "From".' });
  if (from && to && to >= from && daysInclusive(from, to) > MAX_DAYS) errors.push({ field: 'to', message: `Choose a period of at most ${MAX_DAYS} days.` });
  return errors;
}

// onApply(filters) is called only with a valid period.
export function filterForm({ flocks = null, flockRequired = false, flockId = '', from = '', to = '', extra = [], defaultsText, onApply }) {
  const today = ugandaToday();
  const errorBox = h('div', { 'aria-live': 'polite' });
  const dateField = (id, name, label, value) => h('div', { class: 'field', dataset: { field: name } },
    h('label', { class: 'field__label', for: id }, label),
    h('input', { class: 'input', id, name, type: 'date', value, max: today, 'aria-describedby': 'report-dates-hint' }));
  const form = h('form', { class: 'card filter-form', novalidate: true },
    flocks ? h('div', { class: 'field' },
      h('label', { class: 'field__label', for: 'report-flock' }, flockRequired ? 'Flock (required)' : 'Flock'),
      h('select', { class: 'select', id: 'report-flock', name: 'flockId' },
        h('option', { value: '' }, flockRequired ? 'Choose a flock…' : 'All flocks'),
        flocks.map((f) => h('option', { value: String(f.id), selected: String(f.id) === String(flockId) },
          `${f.name}${f.status === 'closed' ? ' (closed)' : ''}`)))) : null,
    extra.map((e) => h('div', { class: 'field' },
      h('label', { class: 'field__label', for: e.id }, e.label),
      h('select', { class: 'select', id: e.id, name: e.name },
        e.options.map(([value, text]) => h('option', { value, selected: value === (e.value || '') }, text))))),
    dateField('report-from', 'from', 'From', from),
    dateField('report-to', 'to', 'To', to),
    h('p', { class: 'field__hint', id: 'report-dates-hint' }, `Leave the dates empty for the default period: ${defaultsText} Dates cannot be after today.`),
    errorBox,
    h('div', { class: 'button-row' }, h('button', { type: 'submit', class: 'button button--secondary' }, 'Show the report')));
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form).entries());
    const errors = checkPeriod(values, ugandaToday());
    if (flockRequired && !values.flockId) errors.unshift({ field: 'flockId', message: 'Choose a flock.' });
    errorBox.replaceChildren(errors.length
      ? alertBox('error', 'Please check the filters. The report was not changed.', { items: errors.map((e) => e.message) }) : '');
    if (errors.length) return;
    onApply(values);
  });
  return form;
}

// A table that scrolls inside its own box on narrow screens (never the whole page).
export function dataTable({ caption, headers, rows, id }) {
  return h('div', { class: 'table-wrap', role: 'region', 'aria-labelledby': `${id}-caption`, tabindex: '0' },
    h('table', { class: 'data-table' },
      h('caption', { id: `${id}-caption` }, caption),
      h('thead', {}, h('tr', {}, headers.map((text) => h('th', { scope: 'col' }, text)))),
      h('tbody', {}, rows.map((cells) => h('tr', {}, cells.map((cell, i) => (i === 0 ? h('th', { scope: 'row' }, cell) : h('td', {}, cell))))))));
}

export function noteBox(text) {
  return text ? h('p', { class: 'small-print report-note' }, text) : null;
}

// What each report is about, for the report menu (fixed words: the menu asks for nothing).
export const REPORT_SUBTITLES = Object.freeze({
  population: 'Bird numbers: arrivals, deaths and sales',
  mortality: 'Deaths, after corrections',
  production: 'Eggs, feed, water and weights',
  tasks: 'Done, missed and overdue',
  health: 'Observations and who was called',
  expenses: 'Money spent · owner only',
});

// The open report is marked with aria-current, a bar and bold text, not by colour alone.
export function reportMenu(farm, active) {
  return h('nav', { class: 'report-menu', 'aria-label': 'Reports' },
    h('ul', {}, reportsFor(farm.myRole).map((r) => h('li', {},
      h('a', { href: reportHref(farm.id, r.key), 'aria-current': r.key === active ? 'page' : undefined },
        h('span', { class: 'report-menu__title' }, `${r.code} · ${r.title}`),
        h('span', { class: 'report-menu__sub' }, REPORT_SUBTITLES[r.key]))))));
}

// Days before today, as YYYY-MM-DD (Uganda calendar).
export function daysBefore(n, today = ugandaToday()) {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

// Quick periods: 7 days, 30 days, and since the chosen flock's arrival (at most 366 days).
export function quickPeriods({ from, to, arrivalDate, onPick }) {
  const today = ugandaToday();
  const options = [['7 days', daysBefore(6, today)], ['30 days', daysBefore(29, today)]];
  if (arrivalDate && arrivalDate <= today) {
    const limit = daysBefore(MAX_DAYS - 1, today);
    options.push(['Since arrival', arrivalDate < limit ? limit : arrivalDate]);
  }
  return h('div', { class: 'report-periods', role: 'group', 'aria-label': 'Quick periods' },
    options.map(([label, start]) => {
      const pressed = from === start && to === today;
      return h('button', { type: 'button', class: 'report-chip', 'aria-pressed': pressed ? 'true' : 'false',
        onclick: () => onPick({ from: start, to: today }) }, label);
    }));
}

// Figures as a row of cards: [[label, value], ...]. A dl, so each value keeps its label.
export function figureCards(pairs) {
  return h('dl', { class: 'report-figures' }, pairs.filter(Boolean).map(([label, value]) =>
    h('div', { class: 'report-figure' }, h('dt', {}, label), h('dd', {}, value))));
}

// The browser's own print dialog; most browsers can save the page as a PDF from there.
export function printButton() {
  return h('button', { type: 'button', class: 'report-print', onclick: () => window.print() }, 'Print or save as PDF');
}
