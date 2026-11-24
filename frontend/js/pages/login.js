// The Log in page.
import { h, pageHeading } from '../components/dom.js';
import { alertBox, takeFlash } from '../components/alerts.js';
import { guardSubmit, showErrors, clearErrors } from '../components/forms.js';
import { icon } from '../components/icons.js';
import { brandPanel, authField as field, passwordToggle } from '../components/auth-layout.js';
import { login } from '../api/auth.js';
import { startSession, takeReturnTo } from '../auth/auth.js';

const BENEFITS = [
  'Plan your house, equipment and money before the chicks arrive.',
  'Record feed, water, eggs and deaths in under a minute.',
  'Get advice drawn from Ugandan and international guidance.',
];

function brandBenefits() {
  return h('ul', { class: 'login-brand__benefits' }, BENEFITS.map((text) => h('li', {},
    h('span', { class: 'login-brand__check' }, icon('check', { size: 14, strokeWidth: 3 })), h('span', {}, text))));
}

function missingFields(form) {
  const problems = [];
  const email = form.elements.email.value.trim();
  if (!email) problems.push({ field: 'email', message: 'Enter your email address.' });
  else if (form.elements.email.validity.typeMismatch) problems.push({ field: 'email', message: 'Enter an email address like you@example.com.' });
  if (!form.elements.password.value) problems.push({ field: 'password', message: 'Enter your password.' });
  return problems;
}

export function loginPage({ query }) {
  const summary = h('div', { class: 'login-summary', 'aria-live': 'polite' });
  const email = h('input', {
    class: 'login-input', id: 'field-email', name: 'email', type: 'email', required: true, autocomplete: 'email', maxlength: '254',
    placeholder: 'you@example.com', 'aria-describedby': 'field-email-error', spellcheck: 'false', autocapitalize: 'none',
  });
  const password = h('input', {
    class: 'login-input login-input--password', id: 'field-password', name: 'password', type: 'password', required: true,
    autocomplete: 'current-password', placeholder: 'Your password', 'aria-describedby': 'field-password-error',
  });
  const form = h('form', { class: 'login-form', novalidate: true },
    field({ name: 'email', label: 'Email address', input: email }),
    field({ name: 'password', label: 'Password', input: password, extra: passwordToggle(password) }),
    h('button', { type: 'submit', class: 'login-submit' }, 'Log in'));

  guardSubmit(form, async () => {
    clearErrors(form, summary);
    const problems = missingFields(form);
    if (problems.length) {
      showErrors(form, { message: 'Please fill in your email address and password.', details: problems }, summary,
        { email: 'Email address', password: 'Password' });
      form.querySelector('[aria-invalid="true"]')?.focus();
      return;
    }
    try {
      const { data } = await login({ email: email.value, password: password.value });
      startSession(data.token, data.user);
      form.reset();
      window.location.hash = takeReturnTo() || '#/farms';
    } catch (error) {
      password.value = '';
      showErrors(form, error, summary, { email: 'Email address', password: 'Password' });
    }
  }, { busyText: 'Logging in…' });

  const notice = query.reason === 'expired'
    ? alertBox('warning', 'Your session has expired. Please log in again. You will go back to the page you were on.')
    : takeFlash();

  return h('div', { class: 'login-page' },
    brandPanel({ headline: 'Run your poultry farm with confidence.', middle: brandBenefits() }),
    h('div', { class: 'login-main' },
      h('div', { class: 'login-panel' },
        pageHeading('Log in'),
        h('p', { class: 'login-lead' }, 'Welcome back. Your farm is waiting.'),
        notice,
        summary,
        form,
        h('p', { class: 'login-register' }, 'New to PoultryStart? ', h('a', { href: '#/register' }, 'Create an account')))));
}
