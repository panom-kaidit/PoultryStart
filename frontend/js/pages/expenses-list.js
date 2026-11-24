// All expenses of the farm with filters (owner only).
import { h, pageHeading, setContent } from '../components/dom.js';
import { takeFlash } from '../components/alerts.js';
import { loadingBlock, errorBlock } from '../components/loading.js';
import { summaryBlock, expenseItem, expensesNav, expensesBreadcrumbs, EXPENSE_CATEGORIES } from '../components/expenses.js';
import { listExpenses, getExpenseSummary } from '../api/expenses.js';
import { queryString } from '../api/production.js';
import { listFlocks } from '../api/flocks.js';
import { navigate } from '../router.js';
import { formatDate, ugandaToday } from '../utils/dates.js';

export function expensesListPage({ farmContext, query }) {
  const { farm } = farmContext;
  const filters = {
    category: EXPENSE_CATEGORIES[query.category] ? query.category : '',
    flockId: query.flockId === 'none' || /^[1-9]\d*$/.test(query.flockId || '') ? query.flockId : '',
    from: query.from || '',
    to: query.to || '',
    status: query.status === 'active' ? 'active' : 'all',
  };
  const body = h('div', {}, loadingBlock('Loading the expenses…'));

  async function load() {
    setContent(body, loadingBlock('Loading the expenses…'));
    try {
      const shared = { category: filters.category || undefined, flockId: filters.flockId || undefined, from: filters.from || undefined, to: filters.to || undefined };
      const [{ data: flockData }, { data }, { data: summaryData }] = await Promise.all([
        listFlocks(farm.id),
        listExpenses(farm.id, { ...shared, includeVoided: filters.status === 'active' ? 'false' : undefined }),
        getExpenseSummary(farm.id, shared),
      ]);
      if (!body.isConnected) return;
      const flocks = new Map(flockData.flocks.map((f) => [f.id, f]));
      const today = ugandaToday();
      const select = (id, name, label, options, value) => h('div', { class: 'field' },
        h('label', { class: 'field__label', for: id }, label),
        h('select', { class: 'select', id, name }, options.map(([v, text]) => h('option', { value: v, selected: v === value }, text))));
      const form = h('form', { class: 'card filter-form' },
        select('filter-category', 'category', 'Category', [['', 'All categories'], ...Object.entries(EXPENSE_CATEGORIES)], filters.category),
        select('filter-flock', 'flockId', 'Flock', [['', 'All expenses'], ['none', 'Not linked to a flock'],
          ...flockData.flocks.map((f) => [String(f.id), `${f.name}${f.status === 'closed' ? ' (closed)' : ''}`])], filters.flockId),
        h('div', { class: 'field' }, h('label', { class: 'field__label', for: 'filter-from' }, 'From'),
          h('input', { class: 'input', id: 'filter-from', name: 'from', type: 'date', value: data.from, max: today })),
        h('div', { class: 'field' }, h('label', { class: 'field__label', for: 'filter-to' }, 'To'),
          h('input', { class: 'input', id: 'filter-to', name: 'to', type: 'date', value: data.to, max: today })),
        select('filter-status', 'status', 'Show', [['all', 'All, including voided'], ['active', 'Not voided only']], filters.status),
        h('div', { class: 'button-row' }, h('button', { type: 'submit', class: 'button button--secondary' }, 'Show expenses')));
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        navigate(`/farms/${farm.id}/expenses/all${queryString({
          category: form.elements.category.value, flockId: form.elements.flockId.value, from: form.elements.from.value,
          to: form.elements.to.value, status: form.elements.status.value === 'active' ? 'active' : '',
        })}`);
      });

      const list = data.expenses;
      const about = [
        filters.category ? EXPENSE_CATEGORIES[filters.category].toLowerCase() : null,
        filters.flockId === 'none' ? 'not linked to a flock' : (filters.flockId ? `for ${flocks.get(Number(filters.flockId))?.name || 'this flock'}` : null),
        filters.status === 'active' ? 'not voided' : null,
      ].filter(Boolean);
      setContent(body,
        form,
        h('p', {}, `${list.length} expense${list.length === 1 ? '' : 's'} from ${formatDate(data.from)} to ${formatDate(data.to)}`
          + (about.length ? ` (${about.join(', ')})` : '') + '.'),
        summaryBlock(summaryData.summary, { headingId: 'list-summary', title: 'Totals for these filters', showFlocks: !filters.flockId, farmId: farm.id }),
        list.length === 0
          ? h('p', { class: 'card' }, 'No expenses recorded for these filters.')
          : h('ul', { class: 'card-list' }, list.map((e) => expenseItem(farm.id, e))));
    } catch (error) {
      if (error.status === 401 || !body.isConnected) return;
      setContent(body, errorBlock(error, {
        onRetry: load,
        actions: [h('a', { class: 'button', href: `#/farms/${farm.id}/expenses/all` }, 'Show the last 31 days')],
      }));
    }
  }
  load();

  return h('div', {},
    pageHeading('All expenses'),
    takeFlash(),
    expensesBreadcrumbs(farm, ['All expenses']),
    expensesNav(farm, 'all'),
    h('div', { class: 'button-row' }, h('a', { class: 'button', href: `#/farms/${farm.id}/expenses/new${queryString({
      flockId: /^[1-9]\d*$/.test(filters.flockId) ? filters.flockId : undefined, category: filters.category || undefined })}` }, 'Record an expense')),
    body);
}
