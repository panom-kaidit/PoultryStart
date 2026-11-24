// The Add expense page (owner only).
import { h, pageHeading, setContent } from '../components/dom.js';
import { alertBox, setFlash } from '../components/alerts.js';
import { loadingBlock, errorBlock } from '../components/loading.js';
import { guardSubmit, showErrors, clearErrors, formValues, fillForm, saveDraft, takeDraft } from '../components/forms.js';
import {
  newExpenseFields, checkExpenseValues, createExpenseBody, EXPENSE_CATEGORIES, EXPENSE_FIELD_LABELS,
} from '../components/expenses.js';
import { createExpense } from '../api/expenses.js';
import { queryString } from '../api/production.js';
import { listFlocks } from '../api/flocks.js';
import { navigate } from '../router.js';
import { ugandaToday } from '../utils/dates.js';

export function expenseFormPage({ user, farmContext, query }) {
  const { farm } = farmContext;
  const body = h('div', {}, loadingBlock('Loading the flocks…'));
  const draftId = `new-expense-${farm.id}`;
  const fromTask = query.taskId && /^[1-9]\d*$/.test(query.taskId) ? query.taskId : null;

  async function load() {
    try {
      const { data } = await listFlocks(farm.id);
      if (!body.isConnected) return;
      const today = ugandaToday();
      const requested = query.flockId ? data.flocks.find((f) => String(f.id) === String(query.flockId)) : null;
      const summary = h('div', { 'aria-live': 'polite' });
      const form = h('form', { class: 'form add-expense', novalidate: true },
        newExpenseFields({ prefix: 'new-expense', currency: farm.currency, flocks: data.flocks, today }),
        h('div', { class: 'add-expense__actions' },
          h('a', { class: 'money-btn money-btn--plain', href: fromTask ? `#/farms/${farm.id}/tasks/${fromTask}` : `#/farms/${farm.id}/money` }, 'Cancel'),
          h('button', { type: 'submit', class: 'money-btn' }, 'Save the expense')));
      fillForm(form, {
        expenseDate: today,
        flockId: requested ? String(requested.id) : '',
        category: EXPENSE_CATEGORIES[query.category] ? query.category : '',
      });

      let restored = null;
      const draft = takeDraft(draftId, user.id);
      if (draft) {
        fillForm(form, draft);
        restored = alertBox('info', 'We kept what you had entered before your session expired. Check it, then select "Save the expense" again. Nothing was saved yet.');
      }

      guardSubmit(form, async () => {
        clearErrors(form, summary);
        const values = formValues(form);
        const errors = checkExpenseValues(values, { today: ugandaToday() });
        if (errors.length) {
          showErrors(form, { message: 'Please check the form. Nothing was saved.', details: errors }, summary, EXPENSE_FIELD_LABELS);
          return;
        }
        try {
          const { data: saved, message } = await createExpense(farm.id, createExpenseBody(values));
          setFlash('success', message || 'Expense saved.');
          navigate(`/farms/${farm.id}/expenses/${saved.expense.id}${queryString({ taskId: fromTask })}`);
        } catch (error) {
          if (error.status === 401) { saveDraft(draftId, user.id, values); return; }
          if (error.status === 404 && values.flockId) {
            showErrors(form, { message: error.message, details: [{ field: 'flockId', message: `${error.message} Choose a flock of this farm.` }] }, summary, EXPENSE_FIELD_LABELS);
            return;
          }
          showErrors(form, error, summary, EXPENSE_FIELD_LABELS);
        }
      }, { busyText: 'Saving…' });

      setContent(body,
        fromTask ? alertBox('info', 'You came here from a task. Saving this expense does not mark the task as done: go back to the task to do that.',
          { title: 'From a task' }) : null,
        fromTask ? h('p', {}, h('a', { href: `#/farms/${farm.id}/tasks/${fromTask}` }, 'Back to the task')) : null,
        query.flockId && !requested ? alertBox('info', 'That flock was not found on this farm. Choose a flock of this farm, or none.') : null,
        restored, summary, h('div', { class: 'money-card add-expense__card' }, form));
    } catch (error) {
      if (error.status === 401 || !body.isConnected) return;
      setContent(body, errorBlock(error, { onRetry: load }));
    }
  }
  load();

  return h('div', { class: 'money money--form' },
    h('nav', { class: 'money-crumbs', 'aria-label': 'Breadcrumb' }, h('a', { href: `#/farms/${farm.id}/money` }, 'Money'), ' / ', h('span', { 'aria-current': 'page' }, 'Add expense')),
    pageHeading('Add expense'),
    h('p', { class: 'money-intro' }, 'Money spent on this farm. PoultryStart records expenses only, not sales or income.'),
    body);
}
