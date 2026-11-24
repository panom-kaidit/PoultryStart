// One expense with its history, correction and voiding (owner only).
import { h, pageHeading, setContent } from '../components/dom.js';
import { alertBox, statusLabel, takeFlash } from '../components/alerts.js';
import { loadingBlock, errorBlock } from '../components/loading.js';
import { confirmDialog } from '../components/confirm.js';
import {
  textareaField, selectField, guardSubmit, showErrors, clearErrors, formValues, fillForm, saveDraft, takeDraft,
} from '../components/forms.js';
import {
  expenseFields, flockOptions, checkExpenseValues, formValuesOfExpense, expenseCorrectionBody, voidBody, expenseHistory,
  expensesBreadcrumbs, formatAmount, EXPENSE_CATEGORIES, EXPENSE_FIELD_LABELS,
} from '../components/expenses.js';
import { getExpense, correctExpense } from '../api/expenses.js';
import { listFlocks } from '../api/flocks.js';
import { formatDate, ugandaToday, formatUtcAsUgandaDateTime } from '../utils/dates.js';

export function expenseDetailPage({ user, farmContext, params, query }) {
  const { farm } = farmContext;
  const expenseId = Number(params.expenseId);
  const fromTask = query.taskId && /^[1-9]\d*$/.test(query.taskId) ? query.taskId : null;
  let openCorrection = query.correct === '1';
  const heading = pageHeading('Expense');
  const messages = h('div', { 'aria-live': 'polite' });
  const body = h('div', {}, loadingBlock('Loading the expense…'));
  const draftId = `fix-expense-${expenseId}`;
  let flocks = [];

  function announce(kind, text, options) {
    const box = alertBox(kind, text, options);
    messages.replaceChildren(box);
    box.focus();
  }

  async function conflict(error, what) {
    openCorrection = false;
    await load();
    announce('warning', `${error.message} The expense and its history have been loaded again. Your ${what} was not saved.`,
      { title: 'Changed meanwhile' });
  }

  function correctionSection(expense) {
    const summary = h('div', { 'aria-live': 'polite' });
    const fields = expense.voided
      ? [selectField({ name: 'flockId', id: 'fix-expense-flock', label: 'Flock', options: flockOptions(flocks),
        hint: 'A voided expense can only have its flock link corrected (for example, to remove it before deleting a flock recorded by mistake).' })]
      : expenseFields({ prefix: 'fix-expense', currency: expense.currency, flocks, today: ugandaToday() });
    const form = h('form', { class: 'form', novalidate: true, hidden: true },
      h('p', {}, `You are correcting version ${expense.version}. Change only what was wrong. The earlier values stay in the history. `
        + `The currency (${expense.currency}) cannot be changed.`),
      fields,
      textareaField({ name: 'reason', id: 'fix-expense-reason', label: 'Reason for the correction', required: true, maxlength: 500, rows: 2,
        hint: 'For example "Typed 15000 instead of 150000".' }),
      h('div', { class: 'button-row' },
        h('button', { type: 'submit', class: 'button' }, 'Save the correction'),
        h('button', { type: 'button', class: 'button button--secondary', onclick: () => { form.hidden = true; toggle.hidden = false; toggle.focus(); } }, 'Cancel')));
    fillForm(form, formValuesOfExpense(expense));
    const toggle = h('button', { type: 'button', class: 'button button--secondary' },
      expense.voided ? 'Correct the flock link' : 'Correct this expense');
    const open = () => { form.hidden = false; toggle.hidden = true; };
    toggle.addEventListener('click', () => { open(); form.querySelector('textarea, select, input').focus(); });
    const draft = takeDraft(draftId, user.id);
    if (draft) {
      fillForm(form, draft);
      open();
      summary.append(alertBox('info', 'We kept your correction from before your session expired. Check it and save again. Nothing was saved yet.'));
    } else if (openCorrection) {
      open();
    }

    guardSubmit(form, async () => {
      clearErrors(form, summary);
      const values = formValues(form);
      const errors = expense.voided ? [] : checkExpenseValues(values, { today: ugandaToday() });
      if (!String(values.reason || '').trim()) errors.push({ field: 'reason', message: 'Give a reason for the correction.' });
      const built = expenseCorrectionBody(expense, values);
      if (!built.body) {
        summary.replaceChildren(alertBox('info', 'Nothing has changed, so there is nothing to correct.'));
        return;
      }
      if (errors.length) {
        showErrors(form, { message: 'Please check the correction. Nothing was saved.', details: errors }, summary, EXPENSE_FIELD_LABELS);
        return;
      }
      try {
        const { data, message } = await correctExpense(farm.id, expenseId, built.body);
        openCorrection = false;
        render(data.expense);
        announce('success', message || 'Expense corrected.');
      } catch (error) {
        if (error.status === 401) { saveDraft(draftId, user.id, values); return; }
        if (error.status === 409 && (error.details || []).some((d) => d.field === 'expectedVersion')) { await conflict(error, 'correction'); return; }
        if (error.status === 404 && values.flockId) {
          showErrors(form, { message: error.message, details: [{ field: 'flockId', message: `${error.message} Choose a flock of this farm.` }] }, summary, EXPENSE_FIELD_LABELS);
          return;
        }
        showErrors(form, error, summary, EXPENSE_FIELD_LABELS);
      }
    }, { busyText: 'Saving…' });

    return h('section', { class: 'card', 'aria-labelledby': 'expense-correct' },
      h('h2', { id: 'expense-correct' }, expense.voided ? 'Correct the flock link' : 'Correct this expense'),
      h('p', {}, expense.voided
        ? 'This expense is voided. Only its flock link can still be corrected; nothing else can change and it cannot be un-voided.'
        : 'A correction keeps the earlier values and your reason in the history. Expenses are never deleted.'),
      summary, h('div', {}, toggle), form);
  }

  function voidSection(expense) {
    const summary = h('div', { 'aria-live': 'polite' });
    const form = h('form', { class: 'form', novalidate: true },
      textareaField({ name: 'reason', id: 'void-expense-reason', label: 'Reason for voiding', required: true, maxlength: 500, rows: 2,
        hint: 'For example "Recorded twice" or "Not paid by this farm".' }),
      h('div', { class: 'button-row' }, h('button', { type: 'submit', class: 'button button--danger' }, 'Void this expense')));
    guardSubmit(form, async () => {
      clearErrors(form, summary);
      const reason = String(form.elements.reason.value || '').trim();
      if (!reason) {
        showErrors(form, { message: 'Give a reason for voiding. Nothing was changed.', details: [{ field: 'reason', message: 'Give a reason for voiding.' }] }, summary, EXPENSE_FIELD_LABELS);
        return;
      }
      const confirmed = await confirmDialog({
        title: 'Void this expense?',
        message: `"${expense.description}", ${formatAmount(expense.amount, expense.currency)} of ${formatDate(expense.expenseDate)}.`,
        items: [
          'Voiding is permanent: it cannot be undone.',
          'The expense and its history are kept, marked as voided.',
          'It will no longer be counted in any total.',
          'Afterwards only its flock link can be corrected.',
        ],
        confirmLabel: 'Yes, void it permanently',
        cancelLabel: 'No, keep it',
        danger: true,
      });
      if (!confirmed) return;
      try {
        const { data, message } = await correctExpense(farm.id, expenseId, voidBody(expense, reason));
        render(data.expense);
        announce('success', message || 'Expense voided.');
      } catch (error) {
        if (error.status === 401) return;
        if (error.status === 409) { await conflict(error, 'void'); return; }
        showErrors(form, error, summary, EXPENSE_FIELD_LABELS);
      }
    }, { busyText: 'Voiding…' });
    return h('section', { class: 'card', 'aria-labelledby': 'expense-void' },
      h('h2', { id: 'expense-void' }, 'Void this expense'),
      h('p', {}, 'If this expense should not have been recorded (for example, it was recorded twice), void it. Voiding is permanent and cannot be undone. '
        + 'The expense is not deleted: it stays here with its history, marked as voided, and is no longer counted in totals.'),
      summary, form);
  }

  function render(expense) {
    const dateText = formatDate(expense.expenseDate);
    heading.textContent = `Expense: ${dateText}`;
    setContent(body,
      expensesBreadcrumbs(farm, ['All expenses', `#/farms/${farm.id}/expenses/all`], [`${dateText}`]),
      fromTask ? h('p', {}, h('a', { href: `#/farms/${farm.id}/tasks/${fromTask}` }, 'Back to the task'),
        h('span', { class: 'small-print' }, ' (saving an expense does not mark the task as done)')) : null,
      expense.voided ? alertBox('warning', `Voided on ${formatUtcAsUgandaDateTime(expense.voidedAt)}. Reason: ${expense.voidReason}. `
        + 'It is kept with its history and is not counted in any total. Voiding cannot be undone.', { title: 'Voided expense' }) : null,
      h('section', { class: 'card', 'aria-labelledby': 'expense-values' },
        h('h2', { id: 'expense-values' }, 'The expense'),
        h('p', {}, expense.voided ? statusLabel('warning', 'Voided: not counted in totals') : statusLabel('success', 'Counted in totals'),
          ' ', expense.version > 1 ? `Corrected: version ${expense.version}. The earlier values are in the history below.` : 'As first recorded (version 1).'),
        h('dl', { class: 'details' },
          h('dt', {}, 'Description'), h('dd', { class: 'user-text' }, expense.description),
          h('dt', {}, 'Amount'), h('dd', {}, formatAmount(expense.amount, expense.currency)),
          h('dt', {}, 'Currency'), h('dd', {}, `${expense.currency} (kept from when it was recorded; it never changes)`),
          h('dt', {}, 'Category'), h('dd', {}, expense.categoryLabel || EXPENSE_CATEGORIES[expense.category]),
          h('dt', {}, 'Date paid'), h('dd', {}, dateText),
          h('dt', {}, 'Flock'), h('dd', {}, expense.flockId
            ? [h('a', { href: `#/farms/${farm.id}/flocks/${expense.flockId}` }, expense.flockName || 'Open the flock'),
              ' (', h('a', { href: `#/farms/${farm.id}/expenses/flocks/${expense.flockId}` }, 'its expenses'), ')']
            : 'Not linked to a flock'),
          h('dt', {}, 'Recorded by'), h('dd', {}, `${expense.createdByName || 'unknown'}, ${formatUtcAsUgandaDateTime(expense.createdAt)}`))),
      correctionSection(expense),
      expense.voided ? null : voidSection(expense),
      expenseHistory(expense, new Map(flocks.map((f) => [f.id, f.name]))));
  }

  async function load() {
    try {
      const [{ data: flockData }, { data }] = await Promise.all([listFlocks(farm.id), getExpense(farm.id, expenseId)]);
      if (!body.isConnected) return;
      flocks = flockData.flocks;
      render(data.expense);
    } catch (error) {
      if (error.status === 401 || !body.isConnected) return;
      setContent(body, errorBlock(error, {
        onRetry: error.status === 0 || error.status >= 500 ? load : undefined,
        actions: [h('a', { class: 'button', href: `#/farms/${farm.id}/expenses` }, 'Back to Money')],
      }));
    }
  }
  load();

  return h('div', {}, heading, takeFlash(), messages, body);
}
