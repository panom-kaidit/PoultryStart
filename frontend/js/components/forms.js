import { h } from './dom.js';
import { alertBox } from './alerts.js';

const idFor = (name) => `field-${name}`;

function describedBy(key, hint) {
  return [hint ? `${key}-hint` : null, `${key}-error`].filter(Boolean).join(' ');
}

function labelText(label, required) {
  return [label, ' ', h('span', { class: 'field__tag' }, required ? '(required)' : '(optional)')];
}

function fieldWrapper(name, key, label, required, control, hint) {
  return h('div', { class: 'field', dataset: { field: name } },
    h('label', { class: 'field__label', for: key }, labelText(label, required)),
    hint ? h('p', { class: 'field__hint', id: `${key}-hint` }, hint) : null,
    control,
    h('p', { class: 'field__error', id: `${key}-error`, hidden: true }));
}

export function inputField({ name, label, type = 'text', required = false, hint, value, attrs = {}, id }) {
  const key = id || idFor(name);
  const input = h('input', {
    class: 'input', id: key, name, type, required, value,
    'aria-describedby': describedBy(key, hint), ...attrs,
  });
  return fieldWrapper(name, key, label, required, input, hint);
}

export function textareaField({ name, label, required = false, hint, value, maxlength, rows = 3, id }) {
  const key = id || idFor(name);
  const area = h('textarea', {
    class: 'input', id: key, name, required, rows: String(rows),
    maxlength: maxlength ? String(maxlength) : undefined, 'aria-describedby': describedBy(key, hint),
  });
  if (value !== undefined && value !== null) area.value = value;
  return fieldWrapper(name, key, label, required, area, hint);
}

export function selectField({ name, label, options, required = false, hint, value, placeholder, id }) {
  const key = id || idFor(name);
  const select = h('select', { class: 'select', id: key, name, required, 'aria-describedby': describedBy(key, hint) },
    placeholder !== undefined ? h('option', { value: '' }, placeholder) : null,
    options.map((option) => h('option', { value: option.value, selected: option.value === value }, option.label)));
  return fieldWrapper(name, key, label, required, select, hint);
}

export function radioField({ name, label, options, required = false, hint, value }) {
  return h('fieldset', { class: 'fieldset field', dataset: { field: name }, 'aria-describedby': describedBy(idFor(name), hint) },
    h('legend', { class: 'fieldset__legend' }, labelText(label, required)),
    hint ? h('p', { class: 'field__hint', id: `${idFor(name)}-hint` }, hint) : null,
    options.map((option, index) => h('label', { class: 'choice' },
      h('input', { type: 'radio', name, value: option.value, required, checked: option.value === value,
        id: index === 0 ? idFor(name) : undefined }),
      h('span', {}, option.label))),
    h('p', { class: 'field__error', id: `${idFor(name)}-error`, hidden: true }));
}

export function checkboxField({ name, label, hint, checked = false, id }) {
  const key = id || idFor(name);
  return h('div', { class: 'field', dataset: { field: name } },
    h('label', { class: 'choice', for: key },
      h('input', { type: 'checkbox', id: key, name, checked, 'aria-describedby': describedBy(key, hint) }),
      h('span', {}, label)),
    hint ? h('p', { class: 'field__hint', id: `${key}-hint` }, hint) : null,
    h('p', { class: 'field__error', id: `${key}-error`, hidden: true }));
}

export function setFieldVisible(form, name, visible) {
  const wrapper = form.querySelector(`[data-field="${name}"]`);
  if (!wrapper) return;
  wrapper.hidden = !visible;
  for (const control of wrapper.querySelectorAll('input, select, textarea')) control.disabled = !visible;
}

// ---- Errors -------------------------------------------------------------

export function clearErrors(form, summary) {
  for (const error of form.querySelectorAll('.field__error')) {
    error.textContent = '';
    error.hidden = true;
  }
  for (const control of form.querySelectorAll('[aria-invalid]')) control.removeAttribute('aria-invalid');
  if (summary) summary.replaceChildren();
}

// Shows an API error: the backend's message at the top (with every detail listed) and each field's message
// next to that field. fieldLabels turns backend field names into the labels the user sees.
export function showErrors(form, error, summary, fieldLabels = {}) {
  clearErrors(form, summary);
  const items = [];
  for (const detail of error.details || []) {
    const wrapper = detail.field ? form.querySelector(`[data-field="${detail.field}"]`) : null;
    if (wrapper && !wrapper.hidden) {
      const line = wrapper.querySelector('.field__error');
      line.textContent = line.textContent ? `${line.textContent} ${detail.message}` : detail.message;
      line.hidden = false;
      for (const control of wrapper.querySelectorAll('input, select, textarea')) control.setAttribute('aria-invalid', 'true');
    }
    items.push(detail.field && fieldLabels[detail.field] ? `${fieldLabels[detail.field]}: ${detail.message}` : detail.message);
  }
  if (summary) {
    const box = alertBox('error', error.message, { items });
    summary.replaceChildren(box);
    box.focus();
  }
}

// ---- Submitting -----------------------------------------------------------

// Runs handler() at most once at a time: while the request is pending, further submits are ignored.
// Nothing is ever resent automatically.
export function guardSubmit(form, handler, { busyText = 'Please wait…' } = {}) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (form.dataset.busy === 'true') return;
    form.dataset.busy = 'true';
    form.setAttribute('aria-busy', 'true');
    const buttons = [...form.querySelectorAll('button[type="submit"]')];
    const labels = buttons.map((button) => button.textContent);
    for (const button of buttons) {
      button.disabled = true;
      button.textContent = busyText;
    }
    try {
      await handler(event);
    } finally {
      form.dataset.busy = 'false';
      form.removeAttribute('aria-busy');
      buttons.forEach((button, index) => {
        button.disabled = false;
        button.textContent = labels[index];
      });
    }
  });
}

// ---- Reading and filling forms ---------------------------------------

// The form's values as { name: value }. Password fields are never included.
export function formValues(form) {
  const values = {};
  for (const control of form.elements) {
    if (!control.name || control.disabled || control.type === 'password') continue;
    if (control.type === 'checkbox') values[control.name] = control.checked;
    else if (control.type === 'radio') {
      if (control.checked) values[control.name] = control.value;
    } else values[control.name] = control.value;
  }
  return values;
}

// Puts saved values back into a form (then lets the form update itself).
export function fillForm(form, values) {
  for (const [name, value] of Object.entries(values)) {
    const controls = [...form.querySelectorAll(`[name="${name}"]`)];
    for (const control of controls) {
      if (control.type === 'password') continue;
      if (control.type === 'checkbox') control.checked = Boolean(value);
      else if (control.type === 'radio') control.checked = control.value === value;
      else control.value = value;
    }
    controls[0]?.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

// ---- Drafts (memory only) ------------------------------------------------

const drafts = new Map();

// Keeps a form's unsaved values for one user (memory only, never stored).
export function saveDraft(formId, userId, values) {
  drafts.set(formId, { userId, values });
}

// The draft for this form, only for the same user; it is removed once taken.
export function takeDraft(formId, userId) {
  const draft = drafts.get(formId);
  drafts.delete(formId);
  return draft && draft.userId === userId ? draft.values : null;
}

export function clearDrafts() {
  drafts.clear();
}
