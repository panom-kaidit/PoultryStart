// Shared pieces for the expense screens.
import { h } from './dom.js';
import { alertBox, statusLabel } from './alerts.js';
import { inputField, selectField, textareaField } from './forms.js';
import { formatNumber } from '../utils/format.js';
import { formatDate, formatUtcAsUgandaDateTime } from '../utils/dates.js';

export const EXPENSE_CATEGORIES = Object.freeze({
  feed: 'Feed', chicks: 'Chicks', medication: 'Medication', equipment: 'Equipment', labour: 'Labour', transport: 'Transport', other: 'Other',
});
export const AMOUNT_MAX = 10000000000;
export const DESCRIPTION_MAX = 500;

export const EXPENSE_FIELD_LABELS = {
  expenseDate: 'Date', category: 'Category', amount: 'Amount', description: 'Description', flockId: 'Flock',
  reason: 'Reason', expectedVersion: 'Version', voided: 'Voided',
};

// "UGX 150,000": the amount with the currency it was recorded in.
export const formatAmount = (amount, currency) => `${currency} ${formatNumber(amount)}`;

export const expenseHref = (farmId, expense) => `#/farms/${farmId}/expenses/${expense.id}`;

export function expenseStatus(expense) {
  return expense.voided ? statusLabel('warning', 'Voided: not counted in totals') : statusLabel('success', 'Counted');
}

export function expenseItem(farmId, expense) {
  return h('li', { class: `card expense-card${expense.voided ? ' expense-card--voided' : ''}` },
    h('h3', { class: 'user-text' }, expense.description),
    h('p', { class: 'expense-card__amount' }, formatAmount(expense.amount, expense.currency)),
    h('dl', { class: 'details' },
      h('dt', {}, 'Date'), h('dd', {}, formatDate(expense.expenseDate)),
      h('dt', {}, 'Category'), h('dd', {}, expense.categoryLabel || EXPENSE_CATEGORIES[expense.category] || expense.category),
      h('dt', {}, 'Flock'), h('dd', {}, expense.flockId
        ? h('a', { href: `#/farms/${farmId}/expenses/flocks/${expense.flockId}` }, expense.flockName || 'Open the flock\'s expenses')
        : 'Not linked to a flock')),
    h('div', { class: 'tag-row' }, expenseStatus(expense),
      expense.version > 1 ? statusLabel('info', `Corrected (version ${expense.version})`) : null),
    h('a', { class: 'button button--secondary button--small', href: expenseHref(farmId, expense),
      'aria-label': `Open the expense "${expense.description.slice(0, 60)}" of ${formatDate(expense.expenseDate)}` }, 'Open the expense'));
}

// The backend's summary, one block per currency (never added together).
export function summaryBlock(summary, { headingId = 'expense-summary', title = 'Summary', showFlocks = true, farmId } = {}) {
  const period = `${formatDate(summary.from)} to ${formatDate(summary.to)}`;
  const section = h('section', { class: 'card', 'aria-labelledby': headingId },
    h('h2', { id: headingId }, title),
    h('p', {}, `Period: ${period}.`),
    h('p', { class: 'small-print' }, summary.note));
  if (summary.voidedExcluded > 0) {
    section.append(h('p', {}, statusLabel('info', `${summary.voidedExcluded} voided expense${summary.voidedExcluded === 1 ? ' is' : 's are'} not counted`)));
  }
  if (summary.currencies.length === 0) {
    section.append(h('p', {}, 'No expenses counted in this period.'));
    return section;
  }
  if (summary.currencies.length > 1) {
    section.append(alertBox('info', 'Expenses were recorded in more than one currency. Each currency has its own totals; they are never added together or converted.',
      { title: 'More than one currency' }));
  }
  for (const c of summary.currencies) {
    const id = `${headingId}-${c.currency}`;
    section.append(h('div', { class: 'currency-summary', role: 'group', 'aria-labelledby': id },
      h('h3', { id }, `${c.currency}: ${formatAmount(c.total, c.currency)} in ${c.count} expense${c.count === 1 ? '' : 's'}`),
      h('div', { class: 'summary-grid' },
        h('div', {},
          h('h4', {}, 'By category'),
          h('dl', { class: 'details' }, c.byCategory.map((row) => [
            h('dt', {}, row.label), h('dd', {}, `${formatAmount(row.total, c.currency)} (${row.count})`)]))),
        h('div', {},
          h('h4', {}, 'By calendar month'),
          h('dl', { class: 'details' }, c.byMonth.map((row) => [
            h('dt', {}, `${formatDate(row.from)} to ${formatDate(row.to)}`), h('dd', {}, `${formatAmount(row.total, c.currency)} (${row.count})`)]))),
        showFlocks ? h('div', {},
          h('h4', {}, 'By flock'),
          h('dl', { class: 'details' }, c.byFlock.map((row) => [
            h('dt', {}, row.flockId && farmId ? h('a', { href: `#/farms/${farmId}/expenses/flocks/${row.flockId}` }, row.label) : row.label),
            h('dd', {}, `${formatAmount(row.total, c.currency)} (${row.count})`)]))) : null)));
  }
  return section;
}

export function expensesNav(farm, active) {
  const tab = (key, href, label) => h('li', {},
    h('a', { class: 'section-tab', href, 'aria-current': active === key ? 'page' : undefined }, label));
  return h('nav', { class: 'type-nav', 'aria-label': 'Money pages' },
    h('ul', { class: 'section-tabs' },
      tab('overview', `#/farms/${farm.id}/expenses`, 'Money'),
      tab('all', `#/farms/${farm.id}/expenses/all`, 'All expenses')));
}

export function expensesBreadcrumbs(farm, ...trail) {
  const items = [['Money', `#/farms/${farm.id}/expenses`], ...trail];
  return h('nav', { class: 'breadcrumbs', 'aria-label': 'Breadcrumb' },
    h('ol', {}, items.map(([label, href], i) => (i === items.length - 1
      ? h('li', { 'aria-current': 'page' }, label)
      : h('li', {}, h('a', { href }, label))))));
}

// The flock choices: none, then active flocks, then closed ones (closed flocks can be linked too).
export function flockOptions(flocks) {
  const sorted = [...flocks].sort((a, b) => (a.status === 'active' ? 0 : 1) - (b.status === 'active' ? 0 : 1));
  return [{ value: '', label: 'Not linked to a flock (a farm expense)' },
    ...sorted.map((f) => ({ value: String(f.id), label: `${f.name}${f.status === 'closed' ? ' (closed)' : ''}` }))];
}

// The expense's own fields (create, and a correction of an expense that is not voided).
export function expenseFields({ prefix, currency, flocks, today }) {
  const id = (name) => `${prefix}-${name}`;
  return [
    textareaField({ name: 'description', id: id('description'), label: 'Description', required: true, rows: 2, maxlength: DESCRIPTION_MAX,
      hint: 'What was bought or paid for, for example "2 bags of chick mash" (up to 500 characters).' }),
    selectField({ name: 'category', id: id('category'), label: 'Category', required: true, placeholder: 'Choose a category…',
      options: Object.entries(EXPENSE_CATEGORIES).map(([value, label]) => ({ value, label })) }),
    inputField({ name: 'amount', id: id('amount'), label: `Amount (${currency})`, required: true,
      hint: `Whole ${currency} only, digits without commas or decimals, from 1 to ${formatNumber(AMOUNT_MAX)}. The currency is the farm's and cannot be changed here.`,
      attrs: { inputmode: 'numeric', autocomplete: 'off' } }),
    inputField({ name: 'expenseDate', id: id('date'), label: 'Date paid', type: 'date', required: true,
      hint: 'Not in the future. It may be before the flock arrived (chicks and feed are often paid for in advance).', attrs: { max: today } }),
    selectField({ name: 'flockId', id: id('flock'), label: 'Flock', options: flockOptions(flocks),
      hint: 'Optional. Active and closed flocks of this farm can be chosen.' }),
  ];
}

// Add expense: the category and flock as chips (real radio buttons, for keyboard and screen readers), with the
// same field names as expenseFields, so the same checks, drafts and backend messages apply.
function chipField({ name, id, legend, required, hint, options }) {
  return h('fieldset', { class: 'field pick-field', id, dataset: { field: name }, 'aria-describedby': [hint ? `${id}-hint` : null, `${id}-error`].filter(Boolean).join(' ') },
    h('legend', { class: 'field__label' }, legend, ' ', h('span', { class: 'field__tag' }, required ? '(required)' : '(optional)')),
    hint ? h('p', { class: 'field__hint', id: `${id}-hint` }, hint) : null,
    h('div', { class: 'pick-grid' }, options.map((o) => h('label', { class: 'pick' },
      h('input', { type: 'radio', name, value: o.value, id: `${id}-${o.value || 'none'}`, required }),
      h('span', { class: 'pick__label' }, o.label)))),
    h('p', { class: 'field__error', id: `${id}-error`, hidden: true }));
}

export function newExpenseFields({ prefix, currency, flocks, today }) {
  const id = (name) => `${prefix}-${name}`;
  const amount = h('input', { class: 'input money-amount__input', id: id('amount'), name: 'amount', required: true, inputmode: 'numeric', autocomplete: 'off',
    placeholder: '0', 'aria-describedby': `${id('amount')}-currency ${id('amount')}-hint ${id('amount')}-error` });
  const sorted = [...flocks].sort((a, b) => (a.status === 'active' ? 0 : 1) - (b.status === 'active' ? 0 : 1));
  return [
    h('div', { class: 'field', dataset: { field: 'amount' } },
      h('label', { class: 'field__label', for: id('amount') }, 'Amount ', h('span', { class: 'field__tag' }, '(required)')),
      h('div', { class: 'money-amount' }, h('span', { class: 'money-amount__currency', id: `${id('amount')}-currency` }, currency), amount),
      h('p', { class: 'field__hint', id: `${id('amount')}-hint` },
        `Whole ${currency}, digits only (no commas or decimals), from 1 to ${formatNumber(AMOUNT_MAX)}. ${currency} is the farm's currency; it is kept with the expense.`),
      h('p', { class: 'field__error', id: `${id('amount')}-error`, hidden: true })),
    chipField({ name: 'category', id: id('category'), legend: 'What for?', required: true,
      options: Object.entries(EXPENSE_CATEGORIES).map(([value, label]) => ({ value, label })) }),
    h('div', { class: 'add-expense__row' },
      chipField({ name: 'flockId', id: id('flock'), legend: 'For which flock?', required: false,
        hint: flocks.some((f) => f.status === 'closed') ? 'Closed flocks can be chosen too.' : undefined,
        options: [{ value: '', label: 'Whole farm' }, ...sorted.map((f) => ({ value: String(f.id), label: `${f.name}${f.status === 'closed' ? ' (closed)' : ''}` }))] }),
      inputField({ name: 'expenseDate', id: id('date'), label: 'Date paid', type: 'date', required: true,
        hint: 'Not in the future. It may be before the flock arrived.', attrs: { max: today } })),
    inputField({ name: 'description', id: id('description'), label: 'What was it?', required: true,
      hint: 'For example "10 bags layers mash" (up to 500 characters).', attrs: { maxlength: String(DESCRIPTION_MAX), placeholder: 'e.g. 10 bags layers mash', autocomplete: 'off' } }),
  ];
}

const trimmed = (values, name) => (typeof values[name] === 'string' ? values[name].trim() : '');

// The checks the backend also makes, so an obvious mistake shows at once. A wrong value is refused, never fixed.
export function checkExpenseValues(values, { today, fields = ['description', 'category', 'amount', 'expenseDate'] } = {}) {
  const errors = [];
  const amount = trimmed(values, 'amount');
  if (fields.includes('description')) {
    const description = trimmed(values, 'description');
    if (!description) errors.push({ field: 'description', message: 'Describe the expense.' });
    else if (description.length > DESCRIPTION_MAX) errors.push({ field: 'description', message: `The description must be at most ${DESCRIPTION_MAX} characters.` });
  }
  if (fields.includes('category') && !EXPENSE_CATEGORIES[values.category]) errors.push({ field: 'category', message: 'Choose a category.' });
  if (fields.includes('amount')) {
    if (!/^\d+$/.test(amount) || Number(amount) < 1 || Number(amount) > AMOUNT_MAX) {
      errors.push({ field: 'amount', message: `Type a whole number from 1 to ${formatNumber(AMOUNT_MAX)}, digits only (no decimals, commas or spaces).` });
    }
  }
  if (fields.includes('expenseDate')) {
    const date = trimmed(values, 'expenseDate');
    if (!date) errors.push({ field: 'expenseDate', message: 'Choose the date.' });
    else if (today && date > today) errors.push({ field: 'expenseDate', message: 'The expense date cannot be in the future.' });
  }
  return errors;
}

// A new expense: the values as typed; the flock only when chosen; never a currency.
export function createExpenseBody(values) {
  const body = {
    expenseDate: trimmed(values, 'expenseDate'),
    category: values.category,
    amount: Number(trimmed(values, 'amount')),
    description: trimmed(values, 'description'),
  };
  if (values.flockId) body.flockId = Number(values.flockId);
  return body;
}

export function formValuesOfExpense(expense) {
  return {
    description: expense.description,
    category: expense.category,
    amount: String(expense.amount),
    expenseDate: expense.expenseDate,
    flockId: expense.flockId == null ? '' : String(expense.flockId),
  };
}

// A correction: only the changed fields (an emptied flock is null: the link is removed), plus expectedVersion and
// the reason. A voided expense can only have its flock link corrected. { body: null } = nothing changed.
export function expenseCorrectionBody(expense, values) {
  const start = formValuesOfExpense(expense);
  const body = {};
  if (!expense.voided) {
    if (trimmed(values, 'description') !== start.description) body.description = trimmed(values, 'description');
    if (values.category !== start.category) body.category = values.category;
    if (trimmed(values, 'amount') !== start.amount) body.amount = Number(trimmed(values, 'amount'));
    if (trimmed(values, 'expenseDate') !== start.expenseDate) body.expenseDate = trimmed(values, 'expenseDate');
  }
  if ((values.flockId || '') !== start.flockId) body.flockId = values.flockId ? Number(values.flockId) : null;
  if (Object.keys(body).length === 0) return { body: null };
  return { body: { ...body, expectedVersion: expense.version, reason: trimmed(values, 'reason') } };
}

export const voidBody = (expense, reason) => ({ voided: true, expectedVersion: expense.version, reason: String(reason || '').trim() });

function describe(field, value, { currency, flockNames }) {
  if (value === null || value === undefined || value === '') return field === 'flockId' ? 'not linked to a flock' : 'not given';
  if (field === 'amount') return formatAmount(value, currency);
  if (field === 'expenseDate') return formatDate(value);
  if (field === 'category') return EXPENSE_CATEGORIES[value] || String(value);
  if (field === 'flockId') return flockNames.get(Number(value)) || 'a flock of this farm';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

// The backend's history: the original entry first, then each correction; a void is its own kind of event.
export function expenseHistory(expense, flockNames = new Map()) {
  const corrections = expense.corrections || [];
  const options = { currency: expense.currency, flockNames };
  return h('section', { class: 'card', 'aria-labelledby': 'expense-history' },
    h('h2', { id: 'expense-history' }, `History (${corrections.length} correction${corrections.length === 1 ? '' : 's'})`),
    h('ol', { class: 'item-list' },
      h('li', { class: 'item' },
        h('p', { class: 'item__title' }, 'Version 1: recorded'),
        h('p', { class: 'small-print' }, `By ${expense.createdByName || 'unknown'}, ${formatUtcAsUgandaDateTime(expense.createdAt)}`),
        corrections.length ? h('p', { class: 'small-print' }, 'The values it was first recorded with are the "from" values of the corrections below.') : null),
      corrections.map((c) => {
        const isVoid = Boolean(c.changes?.voided);
        return h('li', { class: `item${isVoid ? ' item--void' : ''}` },
          h('p', { class: 'item__title' }, isVoid ? `Version ${c.versionFrom} → ${c.versionTo}: voided` : `Version ${c.versionFrom} → ${c.versionTo}: corrected`),
          isVoid ? h('p', {}, statusLabel('warning', 'Voided: from then on not counted in totals (this cannot be undone)')) : null,
          h('ul', { class: 'plain-list' }, Object.entries(c.changes || {}).filter(([field]) => field !== 'voided').map(([field, change]) =>
            h('li', { class: 'user-text' }, `${EXPENSE_FIELD_LABELS[field] || field}: ${describe(field, change.from, options)} → ${describe(field, change.to, options)}`))),
          h('p', { class: 'user-text' }, h('strong', {}, isVoid ? 'Reason for voiding: ' : 'Reason: '), c.reason),
          h('p', { class: 'small-print' }, `By ${c.correctedByName || 'unknown'}, ${formatUtcAsUgandaDateTime(c.correctedAt)}`));
      })));
}
