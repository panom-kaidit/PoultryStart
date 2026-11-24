// The Create an account page.
import { h, pageHeading } from '../components/dom.js';
import { guardSubmit, showErrors, clearErrors } from '../components/forms.js';
import { setFlash } from '../components/alerts.js';
import { brandPanel, authField, passwordToggle } from '../components/auth-layout.js';
import { register } from '../api/auth.js';
import { startSession, takeReturnTo } from '../auth/auth.js';

const NAME_MAX = 100;
const EMAIL_MAX = 254;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 72;

const STEPS = [
  ['Create your account', 'One minute, just your name and email.'],
  ['Tell us your plan', 'Birds, numbers and your poultry house.'],
  ['Get your readiness checklist', 'See exactly what to prepare before chicks arrive.'],
];

function brandSteps() {
  return h('ol', { class: 'login-steps' }, STEPS.map(([title, text], index) => h('li', {},
    h('span', { class: 'login-steps__number', 'aria-hidden': 'true' }, String(index + 1)),
    h('span', { class: 'login-steps__text' }, h('span', { class: 'login-steps__title' }, title), h('span', {}, text)))));
}

function formProblems(form) {
  const problems = [];
  if (!form.elements.name.value.trim()) problems.push({ field: 'name', message: 'Enter your name.' });
  const email = form.elements.email.value.trim();
  if (!email) problems.push({ field: 'email', message: 'Enter your email address.' });
  else if (form.elements.email.validity.typeMismatch) problems.push({ field: 'email', message: 'Enter an email address like you@example.com.' });
  const password = form.elements.password.value;
  if (!password) problems.push({ field: 'password', message: 'Choose a password.' });
  else if (password.length < PASSWORD_MIN) problems.push({ field: 'password', message: `Use at least ${PASSWORD_MIN} characters.` });
  return problems;
}

const LABELS = { name: 'Your name', email: 'Email address', password: 'Password' };

export function registerPage() {
  const summary = h('div', { class: 'login-summary', 'aria-live': 'polite' });
  const name = h('input', {
    class: 'login-input', id: 'field-name', name: 'name', type: 'text', required: true, autocomplete: 'name',
    maxlength: String(NAME_MAX), placeholder: 'e.g. Sarah Nakato', 'aria-describedby': 'field-name-error',
  });
  const email = h('input', {
    class: 'login-input', id: 'field-email', name: 'email', type: 'email', required: true, autocomplete: 'email',
    maxlength: String(EMAIL_MAX), placeholder: 'you@example.com', 'aria-describedby': 'field-email-error',
    spellcheck: 'false', autocapitalize: 'none',
  });
  const password = h('input', {
    class: 'login-input login-input--password', id: 'field-password', name: 'password', type: 'password', required: true,
    autocomplete: 'new-password', minlength: String(PASSWORD_MIN), maxlength: String(PASSWORD_MAX), placeholder: 'Choose a password',
    'aria-describedby': 'field-password-hint field-password-error',
  });
  const form = h('form', { class: 'login-form', novalidate: true },
    authField({ name: 'name', label: 'Your name', input: name }),
    authField({ name: 'email', label: 'Email address', input: email }),
    authField({ name: 'password', label: 'Password', input: password, extra: passwordToggle(password),
      hint: `At least ${PASSWORD_MIN} characters. Your password, your secret.` }),
    h('button', { type: 'submit', class: 'login-submit' }, 'Create account'));

  guardSubmit(form, async () => {
    clearErrors(form, summary);
    const problems = formProblems(form);
    if (problems.length) {
      showErrors(form, { message: 'Some details are missing or need a change.', details: problems }, summary, LABELS);
      form.querySelector('[aria-invalid="true"]')?.focus();
      return;
    }
    try {
      const { data, message } = await register({ name: name.value, email: email.value, password: password.value });
      startSession(data.token, data.user);
      form.reset();
      setFlash('success', message || 'Account created successfully.');
      window.location.hash = takeReturnTo() || '#/farms';
    } catch (error) {
      password.value = '';
      showErrors(form, error, summary, LABELS);
      if (error.status === 409) {
        const line = form.querySelector('#field-email-error');
        line.textContent = 'This email already has an account.';
        line.hidden = false;
        email.setAttribute('aria-invalid', 'true');
        summary.append(h('p', { class: 'login-summary__next' }, h('a', { href: '#/login' }, 'Log in with this email instead')));
      }
    }
  }, { busyText: 'Creating your account…' });

  return h('div', { class: 'login-page login-page--register' },
    brandPanel({ headline: 'Start your farm the right way.', middle: brandSteps() }),
    h('div', { class: 'login-main' },
      h('div', { class: 'login-panel' },
        pageHeading('Create your account'),
        h('p', { class: 'login-lead' }, "Sign up in a minute. Let's get your farm journey started."),
        h('p', { class: 'login-required' }, 'All fields are required.'),
        summary,
        form,
        h('p', { class: 'login-register' }, 'Already have an account? ', h('a', { href: '#/login' }, 'Log in')))));
}
