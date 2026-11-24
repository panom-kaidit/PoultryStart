// The Money page: spending per currency and the period's expenses (owner only).
import { h, pageHeading, setContent } from '../components/dom.js';
import { takeFlash, alertBox } from '../components/alerts.js';
import { loadingBlock, errorBlock } from '../components/loading.js';
import { icon } from '../components/icons.js';
import { formatAmount, EXPENSE_CATEGORIES, expenseHref } from '../components/expenses.js';
import { listExpenses, getExpenseSummary } from '../api/expenses.js';
import { listFlocks } from '../api/flocks.js';
import { navigate } from '../router.js';
import { ugandaToday, formatDate } from '../utils/dates.js';
import { formatNumber } from '../utils/format.js';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SHORT_MONTHS = MONTHS.map((m) => m.slice(0, 3));
const pad = (n) => String(n).padStart(2, '0');
const lastDay = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

export function moneyPeriod(key, today = ugandaToday()) {
  const [y, m] = today.split('-').map(Number);
  if (key === 'last-month') {
    const py = m === 1 ? y - 1 : y; const pm = m === 1 ? 12 : m - 1;
    return { key, from: `${py}-${pad(pm)}-01`, to: `${py}-${pad(pm)}-${pad(lastDay(py, pm))}`, name: MONTHS[pm - 1], table: `Expenses in ${MONTHS[pm - 1]}` };
  }
  if (key === 'last-31') {
    const start = new Date(`${today}T00:00:00Z`); start.setUTCDate(start.getUTCDate() - 30);
    return { key, from: start.toISOString().slice(0, 10), to: today, name: 'the last 31 days', table: 'Expenses in the last 31 days' };
  }
  return { key: 'this-month', from: `${y}-${pad(m)}-01`, to: today, name: MONTHS[m - 1], table: 'Expenses this month' };
}
const PERIODS = [['this-month', 'This month'], ['last-month', 'Last month'], ['last-31', 'Last 31 days']];

const shortDate = (iso) => { const [, m, d] = iso.split('-').map(Number); return `${d} ${SHORT_MONTHS[m - 1]}`; };
const categoryName = (e) => e.categoryLabel || EXPENSE_CATEGORIES[e.category] || e.category;

export function csvCell(value) {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
export function expensesCsv(expenses, flockNames) {
  const rows = [['Date', 'Description', 'Category', 'Flock', 'Amount', 'Currency', 'Status']];
  for (const e of expenses) {
    rows.push([e.expenseDate, e.description, categoryName(e), e.flockId ? (e.flockName || flockNames.get(e.flockId) || `Flock ${e.flockId}`) : 'Whole farm',
      String(e.amount), e.currency, e.voided ? 'Voided (not counted)' : 'Counted']);
  }
  return `${rows.map((r) => r.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

function download(name, text) {
  const url = URL.createObjectURL(new Blob(['﻿', text], { type: 'text/csv;charset=utf-8' }));
  const link = h('a', { href: url, download: name, hidden: true });
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function currencyBlock(c, period, many) {
  const id = `money-total-${c.currency}`;
  const rows = c.byCategory.filter((row) => row.count > 0).sort((a, b) => b.total - a.total);
  return h('div', { class: 'money-currency', role: 'group', 'aria-labelledby': id },
    h('p', { class: 'money-label', id }, many ? `Spent in ${period.name} · ${c.currency}` : `Spent in ${period.name}`),
    h('p', { class: 'money-total' }, formatAmount(c.total, c.currency)),
    h('p', { class: 'money-sub' }, `${c.count} expense${c.count === 1 ? '' : 's'} counted`),
    h('ul', { class: 'money-bars', 'aria-label': `By category, ${c.currency}` }, rows.map((row) => {
      const pct = c.total > 0 ? Math.round((row.total / c.total) * 100) : 0;
      const fill = h('span', { class: 'money-bar__fill' });
      fill.style.width = `${Math.max(pct, row.total > 0 ? 2 : 0)}%`;
      return h('li', { class: 'money-bar' },
        h('span', { class: 'money-bar__name' }, row.label),
        h('span', { class: 'money-bar__value' }, `${formatNumber(row.total)} · ${pct}%`),
        h('span', { class: 'money-bar__track', 'aria-hidden': 'true' }, fill));
    })));
}

export function expensesOverviewPage({ farmContext, query = {} }) {
  const { farm } = farmContext;
  const period = moneyPeriod(PERIODS.some(([k]) => k === query.period) ? query.period : 'this-month');
  const flockFilter = query.flock === 'none' || /^[1-9]\d*$/.test(query.flock || '') ? query.flock : '';
  const go = (changes) => {
    const q = new URLSearchParams();
    const next = { period: period.key === 'this-month' ? '' : period.key, flock: flockFilter, ...changes };
    if (next.period && next.period !== 'this-month') q.set('period', next.period);
    if (next.flock) q.set('flock', next.flock);
    const s = q.toString();
    navigate(`/farms/${farm.id}/money${s ? `?${s}` : ''}`);
  };
  const addHref = `#/farms/${farm.id}/expenses/new${/^[1-9]\d*$/.test(flockFilter) ? `?flockId=${flockFilter}` : ''}`;

  const flockSelect = h('select', { class: 'money-select', id: 'money-flock', disabled: true },
    h('option', { value: '' }, 'All flocks and farm'));
  flockSelect.addEventListener('change', () => go({ flock: flockSelect.value }));

  const body = h('div', { class: 'money-body' }, loadingBlock('Loading the money…'));

  async function load() {
    setContent(body, loadingBlock('Loading the money…'));
    try {
      const filter = { from: period.from, to: period.to, flockId: flockFilter || undefined };
      const [{ data: s }, { data: list }, { data: flocksData }] = await Promise.all([
        getExpenseSummary(farm.id, filter), listExpenses(farm.id, filter), listFlocks(farm.id)]);
      if (!body.isConnected) return;
      const summary = s.summary;
      const flocks = flocksData.flocks || [];
      const names = new Map(flocks.map((f) => [f.id, f.name]));
      flockSelect.replaceChildren(h('option', { value: '' }, 'All flocks and farm'), h('option', { value: 'none' }, 'Whole farm only (no flock)'),
        ...flocks.map((f) => h('option', { value: String(f.id) }, `${f.name}${f.status === 'closed' ? ' (closed)' : ''}`)));
      flockSelect.value = flockFilter && (flockFilter === 'none' || names.has(Number(flockFilter))) ? flockFilter : '';
      flockSelect.disabled = false;
      const flockName = flockFilter === 'none' ? 'the whole farm (no flock)' : names.get(Number(flockFilter));

      const many = summary.currencies.length > 1;
      const totals = h('section', { class: 'money-card money-summary', 'aria-label': 'Spending summary' },
        summary.currencies.length === 0
          ? [h('p', { class: 'money-label' }, `Spent in ${period.name}`), h('p', { class: 'money-total' }, formatAmount(0, summary.farmCurrency)),
            h('p', { class: 'money-sub' }, 'No expenses counted in this period.')]
          : summary.currencies.map((c) => currencyBlock(c, period, many)),
        many ? alertBox('info', 'Expenses were recorded in more than one currency. Each currency has its own total; they are never added together or converted.',
          { title: 'More than one currency' }) : null,
        h('p', { class: 'money-small' }, `${formatDate(summary.from)} to ${formatDate(summary.to)}${flockName ? ` · ${flockName}` : ''}. `,
          summary.voidedExcluded > 0 ? `${summary.voidedExcluded} voided expense${summary.voidedExcluded === 1 ? ' is' : 's are'} not counted. ` : '',
          `Farm currency: ${summary.farmCurrency}.`));

      const plannedIncome = h('section', { class: 'money-card money-planned', 'aria-labelledby': 'money-income' },
        h('h2', { id: 'money-income' }, 'Income · planned'),
        h('p', {}, 'Recording egg and bird sales is not part of PoultryStart yet. When it is, you will see here whether each flock is making money.'),
        h('p', { class: 'money-small' }, 'Until then PoultryStart shows spending only: no income, profit or cost per bird.'));

      const expenses = list.expenses;
      const csvButton = h('button', { type: 'button', class: 'money-link', disabled: expenses.length === 0 },
        icon('download', { size: 18 }), 'Download CSV');
      csvButton.addEventListener('click', () => download(`expenses-${farm.id}-${period.from}-to-${period.to}.csv`, expensesCsv(expenses, names)));
      const currencyHeader = many ? 'Amount' : `Amount (${expenses[0]?.currency || summary.farmCurrency})`;
      const table = h('section', { class: 'money-card money-card--flush', 'aria-labelledby': 'expenses-recent' },
        h('div', { class: 'money-table-head' }, h('h2', { id: 'expenses-recent' }, period.table), csvButton),
        expenses.length === 0
          ? h('div', { class: 'money-empty' }, h('p', { class: 'money-empty__title' }, 'No expenses in this period'),
            h('p', {}, 'Expenses with a date in this period appear here.'),
            h('a', { class: 'money-btn', href: addHref }, icon('plus', { size: 18 }), 'Add expense'))
          : h('div', { class: 'money-table-wrap' }, h('table', { class: 'money-table' },
            h('caption', { class: 'visually-hidden' }, `${period.table}. Voided expenses are listed but not counted.`),
            h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Date'), h('th', { scope: 'col' }, 'What'), h('th', { scope: 'col' }, 'Category'),
              h('th', { scope: 'col' }, 'For'), h('th', { scope: 'col', class: 'num' }, currencyHeader), h('th', { scope: 'col' }, h('span', { class: 'visually-hidden' }, 'Open')))),
            h('tbody', {}, expenses.map((e) => h('tr', { class: e.voided ? 'is-voided' : '' },
              h('td', { 'data-label': 'Date' }, shortDate(e.expenseDate)),
              h('td', { class: 'money-what', 'data-label': 'What' }, h('span', { class: 'user-text' }, e.description),
                e.voided ? h('span', { class: 'money-tag' }, 'Voided: not counted in totals') : null),
              h('td', { 'data-label': 'Category' }, categoryName(e)),
              h('td', { 'data-label': 'For' }, e.flockId ? (e.flockName || names.get(e.flockId) || 'A flock') : 'Whole farm'),
              h('td', { class: 'num', 'data-label': 'Amount' }, many ? formatAmount(e.amount, e.currency) : formatNumber(e.amount)),
              h('td', {}, h('a', { href: expenseHref(farm.id, e), 'aria-label': `Open the expense "${e.description.slice(0, 60)}" of ${formatDate(e.expenseDate)}` }, 'Open'))))))),
        h('p', { class: 'money-table-foot' }, h('a', { href: `#/farms/${farm.id}/expenses/all` }, 'All expenses, with filters')));

      setContent(body, h('div', { class: 'money-grid' }, totals, plannedIncome), table);
    } catch (error) {
      if (error.status === 401 || !body.isConnected) return;
      setContent(body, errorBlock(error, { onRetry: load }));
    }
  }
  load();

  return h('div', { class: 'money' },
    h('div', { class: 'money-head' },
      pageHeading('Money'),
      h('div', { class: 'money-tools' },
        h('div', { class: 'money-periods', role: 'group', 'aria-label': 'Period' },
          PERIODS.map(([key, label]) => h('button', { type: 'button', class: 'money-chip', 'aria-pressed': key === period.key ? 'true' : 'false',
            onclick: () => { if (key !== period.key) go({ period: key }); } }, label))),
        h('label', { class: 'visually-hidden', for: 'money-flock' }, 'Flock'),
        flockSelect,
        h('a', { class: 'money-btn', href: addHref }, icon('plus', { size: 18 }), 'Add expense'))),
    takeFlash(),
    h('p', { class: 'money-intro' }, `Money spent on ${farm.name}. Only the farm owner sees this page.`),
    body);
}
