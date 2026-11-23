// A confirmation step before an important change, using the browser's <dialog> (focus stays inside; Escape
// closes). Resolves to true only for the confirm button. "Cancel" is focused first, so an accidental Enter is
// safe. typeToConfirm: text the user must type first (e.g. the farm name).
import { h } from './dom.js';

let dialogCounter = 0;

export function confirmDialog({
  title, message, items = [], confirmLabel, cancelLabel = 'Cancel', danger = false, typeToConfirm = null,
}) {
  dialogCounter += 1;
  const titleId = `dialog-title-${dialogCounter}`;
  const textId = `dialog-text-${dialogCounter}`;
  const inputId = `dialog-input-${dialogCounter}`;

  const confirmButton = h('button', {
    type: 'submit', value: 'confirm', class: `button${danger ? ' button--danger' : ''}`,
    disabled: Boolean(typeToConfirm),
  }, confirmLabel);
  const cancelButton = h('button', { type: 'submit', value: 'cancel', class: 'button button--secondary', autofocus: true }, cancelLabel);

  let typed = null;
  if (typeToConfirm) {
    typed = h('input', { class: 'input', id: inputId, type: 'text', autocomplete: 'off', spellcheck: 'false' });
    typed.addEventListener('input', () => {
      confirmButton.disabled = typed.value.trim() !== typeToConfirm.trim();
    });
  }

  const dialog = h('dialog', { class: 'dialog', 'aria-labelledby': titleId, 'aria-describedby': textId },
    h('form', { method: 'dialog', class: 'form' },
      h('h2', { id: titleId }, title),
      h('div', { id: textId },
        h('p', {}, message),
        items.length ? h('ul', { class: 'plain-list' }, items.map((item) => h('li', {}, item))) : null),
      typed ? h('div', { class: 'field' },
        h('label', { class: 'field__label', for: inputId }, 'To confirm, type ', h('strong', {}, typeToConfirm)),
        typed) : null,
      h('div', { class: 'button-row' }, cancelButton, confirmButton)));

  return new Promise((resolve) => {
    dialog.addEventListener('close', () => {
      const confirmed = dialog.returnValue === 'confirm';
      dialog.remove();
      resolve(confirmed);
    });
    document.body.append(dialog);
    dialog.showModal();
    cancelButton.focus();
  });
}
