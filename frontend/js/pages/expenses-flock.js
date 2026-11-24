// One flock's expenses (owner only).
import { h, pageHeading, setContent } from '../components/dom.js';
import { takeFlash } from '../components/alerts.js';
import { loadingBlock, errorBlock } from '../components/loading.js';
import { summaryBlock, expenseItem, expensesNav, expensesBreadcrumbs } from '../components/expenses.js';
import { listExpenses, getExpenseSummary } from '../api/expenses.js';
import { queryString } from '../api/production.js';
import { getFlock } from '../api/flocks.js';
import { navigate } from '../router.js';
import { formatDate, ugandaToday } from '../utils/dates.js';

export function expensesFlockPage({ farmContext, params, query }) {
  const { farm } = farmContext;
  const flockId = Number(params.flockId);
  const filters = { from: query.from || '', to: query.to || '' };
  const heading = pageHeading('Expenses of the flock');
  const top = h('div', {});
  const body = h('div', {}, loadingBlock('Loading the expenses…'));

  async function load() {
    setContent(body, loadingBlock('Loading the expenses…'));
    try {
      const range = { from: filters.from || undefined, to: filters.to || undefined };
      const [{ data: flockData }, { data }, { data: summaryData }] = await Promise.all([
        getFlock(farm.id, flockId), listExpenses(farm.id, { ...range, flockId }), getExpenseSummary(farm.id, { ...range, flockId })]);
      if (!body.isConnected) return;
      const { flock } = flockData;
      heading.textContent = `Expenses: ${flock.name}`;
      setContent(top, expensesBreadcrumbs(farm, ['All expenses', `#/farms/${farm.id}/expenses/all`], [flock.name]),
        h('div', { class: 'button-row' },
          h('a', { class: 'button', href: `#/farms/${farm.id}/expenses/new?flockId=${flock.id}` }, 'Record an expense for this flock'),
          h('a', { class: 'button button--secondary', href: `#/farms/${farm.id}/flocks/${flock.id}` }, 'Open the flock')));
      const today = ugandaToday();
      const form = h('form', { class: 'card filter-form' },
        h('div', { class: 'field' }, h('label', { class: 'field__label', for: 'filter-from' }, 'From'),
          h('input', { class: 'input', id: 'filter-from', name: 'from', type: 'date', value: data.from, max: today })),
        h('div', { class: 'field' }, h('label', { class: 'field__label', for: 'filter-to' }, 'To'),
          h('input', { class: 'input', id: 'filter-to', name: 'to', type: 'date', value: data.to, max: today })),
        h('div', { class: 'button-row' }, h('button', { type: 'submit', class: 'button button--secondary' }, 'Show expenses')));
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        navigate(`/farms/${farm.id}/expenses/flocks/${flock.id}${queryString({ from: form.elements.from.value, to: form.elements.to.value })}`);
      });
      const list = data.expenses;
      setContent(body,
        flock.status === 'closed' ? h('p', { class: 'small-print' }, 'This flock is closed. Expenses can still be linked to it.') : null,
        h('p', { class: 'small-print' }, 'A flock with linked expenses (voided ones included) cannot be deleted. To delete a flock recorded by mistake, '
          + 'first correct each expense to remove its flock link.'),
        form,
        h('p', {}, `${list.length} expense${list.length === 1 ? '' : 's'} from ${formatDate(data.from)} to ${formatDate(data.to)}, voided ones included.`),
        summaryBlock(summaryData.summary, { headingId: 'flock-summary', title: 'Totals for this flock', showFlocks: false }),
        list.length === 0
          ? h('p', { class: 'card' }, 'No expenses linked to this flock for these dates.')
          : h('ul', { class: 'card-list' }, list.map((e) => expenseItem(farm.id, e))));
    } catch (error) {
      if (error.status === 401 || !body.isConnected) return;
      setContent(body, errorBlock(error, {
        onRetry: error.status === 0 || error.status >= 500 || error.status === 400 ? load : undefined,
        actions: [h('a', { class: 'button', href: `#/farms/${farm.id}/expenses` }, 'Back to Money')],
      }));
    }
  }
  load();

  return h('div', {}, heading, takeFlash(), top, expensesNav(farm, null), body);
}
