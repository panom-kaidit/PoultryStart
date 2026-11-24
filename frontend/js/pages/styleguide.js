// Hidden component gallery (#/__styleguide).
import { h, pageHeading } from '../components/dom.js';
import { icon, ICON_NAMES } from '../components/icons.js';
import { loadingBlock, errorBlock } from '../components/loading.js';
import {
  backLink, button, textField, textArea, chip, chipGroup, choiceCard, segmented, stepper, progressBar, stepHeader, card, listRow,
  badge, sectionLabel, statTile, taskRow, adviceCard, successCard, warningCard, urgentCard, gapCard, readinessRing, checklistGroup,
  tabs, barChart, stageProgress, timelineRow, accordionRow, sourceBadge, emptyBlock,
} from '../components/ui.js';

const section = (title, ...children) => h('section', { class: 'sg-section', 'aria-label': title }, h('h2', { class: 'sg-title' }, title), children);

function tabsDemo() {
  const items = [{ id: 'overview', label: 'Overview' }, { id: 'history', label: 'History' }, { id: 'health', label: 'Health' },
    { id: 'money', label: 'Money' }, { id: 'details', label: 'Details' }];
  const panel = h('div', { id: 'sg-tabpanel', role: 'tabpanel', class: 'sg-panel' });
  const holder = h('div', {});
  const draw = (selected) => {
    holder.replaceChildren(tabs({ label: 'Flock sections', items, selected, panelId: 'sg-tabpanel', onSelect: (id) => { draw(id); holder.querySelector(`#tab-${id}`).focus(); } }));
    panel.setAttribute('aria-labelledby', `tab-${selected}`);
    panel.textContent = `${items.find((i) => i.id === selected).label} panel`;
  };
  draw('overview');
  return h('div', {}, holder, panel);
}

export function styleguidePage() {
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const eggs = [244, 247, 249, 246, 243, 239, 236];
  return h('div', { class: 'ui-screen sg' },
    pageHeading('Components'),
    h('p', { class: 'ui-lead' }, 'Every redesign component and state, with sample values. Not linked from the app.'),

    section('Icons', h('div', { class: 'sg-icons' }, ICON_NAMES.map((name) => h('span', { class: 'sg-icon', title: name }, icon(name), h('small', {}, name))))),

    section('Back link and step header',
      backLink({ href: '#/__styleguide', label: 'Flocks' }),
      stepHeader({ step: 2, total: 3, backHref: '#/__styleguide' })),

    section('Buttons',
      button({ label: 'Continue' }),
      button({ label: 'Save today\'s records', attrs: { class: 'ui-btn ui-btn--primary ui-btn--form' } }),
      button({ label: 'Continue', disabled: true }),
      button({ label: 'Share my checklist', variant: 'secondary' }),
      h('div', { class: 'sg-row' }, button({ label: 'Plan 150 birds', variant: 'soft' }), button({ label: 'Extend the house', variant: 'soft' })),
      h('div', { class: 'sg-row' }, button({ label: 'New flock', variant: 'small', iconName: 'plus' }), button({ label: 'Expense', variant: 'small', iconName: 'plus' })),
      button({ label: 'Add a weighing or a note', variant: 'text', iconName: 'plus' })),

    section('Text inputs',
      textField({ label: 'Email address', type: 'email', placeholder: 'you@example.com' }).element,
      textField({ label: 'Password', type: 'password', hint: 'Your Password, Your Secret' }).element,
      textField({ label: 'Length (inside)', type: 'number', inputmode: 'decimal', unit: 'm', value: 8, size: 'lg' }).element,
      textField({ label: 'Space birds cannot use', type: 'number', inputmode: 'decimal', unit: 'm²', value: 2, size: 'lg',
        hint: 'Feed store, passage, anything inside that birds cannot stand on. Use 0 if none.' }).element,
      textField({ label: 'Amount', type: 'number', inputmode: 'numeric', prefix: 'UGX', placeholder: '0', size: 'xl' }).element,
      h('form', { role: 'search', class: 'ui-search' }, h('label', { for: 'sg-q', class: 'visually-hidden' }, 'Search guidance'), icon('search', { size: 20 }),
        h('input', { id: 'sg-q', class: 'ui-input', type: 'search', placeholder: 'Search: brooder, water, eggs…' })),
      textArea({ label: 'Anything else? (optional)', placeholder: 'When it started, what you saw…' }).element),

    section('Chips',
      chipGroup({ label: 'Have you kept poultry before?', value: 'none',
        options: [{ id: 'none', label: 'No, first time' }, { id: 'some', label: 'A little' }, { id: 'yes', label: 'Yes, experienced' }] }).element,
      chipGroup({ label: 'What did you notice?', multi: true, value: ['eat'], options: [{ id: 'eat', label: 'Not eating' },
        { id: 'cough', label: 'Coughing or sneezing' }, { id: 'drop', label: 'Watery droppings' }, { id: 'dead', label: 'Sudden deaths' }] }).element,
      chipGroup({ label: 'Do you have a house', variant: 'box', value: 'has', options: [{ id: 'has', label: 'I have a house' }, { id: 'no', label: 'Not built yet' }] }).element,
      chipGroup({ label: 'What for?', variant: 'box', columns: 2, value: 'feed', options: [{ id: 'feed', label: 'Feed' }, { id: 'chicks', label: 'Chicks' },
        { id: 'vet', label: 'Vaccines and vet' }, { id: 'labour', label: 'Labour' }] }).element,
      h('div', { class: 'sg-row' }, chip({ label: 'Pressed', pressed: true }), chip({ label: 'Not pressed' }))),

    section('Choice cards', (() => {
      const row = h('div', { class: 'ui-choices', role: 'group', 'aria-label': 'Type of Birds?' });
      const pick = (on) => row.querySelectorAll('.ui-choice').forEach((b, i) => { b.setAttribute('aria-pressed', String(i === on)); b.classList.toggle('is-on', i === on); });
      row.append(choiceCard({ iconName: 'broiler', title: 'Broilers', subtitle: 'Raised for meat', onClick: () => pick(0) }),
        choiceCard({ iconName: 'egg', title: 'Layers', subtitle: 'Raised for eggs', pressed: true, onClick: () => pick(1) }));
      return row;
    })()),

    section('Segmented control', segmented({ label: 'How feed was measured', value: 'w', options: [{ id: 'w', label: 'Weighed' }, { id: 'e', label: 'Estimated' }] }).element),

    section('Steppers',
      card({ flush: true, children: [
        h('div', { class: 'sg-step-row' }, h('label', { for: 'sg-deaths', class: 'sg-step-label' }, 'Deaths', h('span', {}, 'birds')),
          stepper({ id: 'sg-deaths', label: 'Deaths' }).element),
        h('div', { class: 'sg-step-row' }, h('label', { for: 'sg-feed', class: 'sg-step-label' }, 'Feed given', h('span', {}, 'kg')),
          stepper({ id: 'sg-feed', label: 'Feed given', value: 33 }).element)] }),
      stepper({ label: 'Planned birds', value: 300, step: 10, editable: false, size: 'lg', decLabel: '10 fewer birds', incLabel: '10 more birds' }).element),

    section('Progress', progressBar({ value: 3, max: 5, label: '3 of 5 tasks done' }), progressBar({ value: 9, max: 12, size: 'lg', label: '9 of 12 ready' })),

    section('Cards, rows and badges',
      sectionLabel('This farm'),
      card({ flush: true, children: [
        listRow({ label: 'Money', href: '#/__styleguide', iconName: 'money', trailing: badge('Owner') }),
        listRow({ label: 'Readiness check', href: '#/__styleguide', iconName: 'check', trailing: badge('3 to fix', 'amber') }),
        listRow({ label: 'People on this farm', href: '#/__styleguide', iconName: 'people', trailing: h('span', { class: 'ui-row__value' }, '2') }),
        listRow({ label: 'Worker pay, November', sub: 'Labour · whole farm · 15 Nov', trailing: h('span', { class: 'ui-row__amount' }, '600,000') }),
        listRow({ label: 'Log out', onClick: () => {}, chevron: false, tone: 'danger' })] }),
      h('div', { class: 'sg-row' }, badge('Owner'), badge('3 to fix', 'amber'), badge('Laying · week 24', 'green')),
      card({ variant: 'dashed', children: [h('div', { class: 'ui-card__title' }, 'Income · planned'), h('p', { class: 'ui-note' }, 'Record egg and bird sales here to see whether each flock is making money.')] })),

    section('Stat tiles',
      h('div', { class: 'ui-stats' },
        statTile({ label: 'Birds alive', value: '296', sub: '2 died this week', href: '#/__styleguide' }),
        statTile({ label: 'Eggs today', value: '236', sub: '80% of hens laid' }),
        statTile({ label: 'Feed today', value: 'Not recorded', warning: true, action: 'Record now', href: '#/__styleguide' }),
        statTile({ label: 'Water today', value: '64 L', sub: 'Same as yesterday' })),
      h('div', { class: 'ui-stats--row' }, statTile({ label: 'Birds alive', value: '296', size: 'compact' }),
        statTile({ label: 'Died (7 days)', value: '2', size: 'compact' }), statTile({ label: 'Eggs today', value: '236', size: 'compact' }))),

    section('Task rows', card({ flush: true, title: 'Tasks', trailing: h('span', { class: 'sg-strong' }, '2 of 3 done'), children: [
      h('div', { class: 'sg-pad' }, progressBar({ value: 2, max: 3, label: '2 of 3 done' })),
      taskRow({ title: 'Give feed and record it', meta: 'Morning · Flock 1', recordHref: '#/__styleguide' }),
      taskRow({ title: 'Check and clean drinkers', meta: 'Morning · Flock 1', done: true }),
      taskRow({ title: 'Refresh the footbath', meta: 'Morning · whole farm', done: true })] })),

    section('Advice card', adviceCard({ title: 'Eggs have dropped 3 days in a row', body: 'Check feed and water records, and look at the birds for anything unusual.',
      links: [{ href: '#/__styleguide', label: 'See the flock' }, { href: '#/__styleguide', label: 'Why this advice' }] })),

    section('Alert cards',
      successCard({ title: 'Enough space', children: [h('p', {}, '30 m² for birds. Room for about ', h('b', {}, '150'), ' full-grown birds. You plan 100.')] }),
      warningCard({ title: 'Too small for 300 birds', have: { label: 'You have', value: '30 m²' }, need: { label: 'You need', value: '60 m²' }, children: [
        h('div', { class: 'ui-alert__choose' }, 'Choose one:'), button({ label: 'Plan 150 birds instead', variant: 'secondary' }),
        button({ label: 'Make the house 16 m × 4 m', variant: 'secondary' })] }),
      urgentCard({ title: 'Many birds sick or dying suddenly?', body: 'Call your vet first. Record the details after.',
        action: h('a', { class: 'ui-call', href: '#/__styleguide' }, icon('phone', { size: 18 }), 'Add a vet contact') })),

    section('Gap card and readiness ring',
      h('div', { class: 'ui-card ui-card--hero sg-ring' }, readinessRing({ ready: 9, total: 12 }),
        h('div', {}, h('div', { class: 'sg-ring__title' }, 'Almost ready'), h('p', { class: 'ui-note' }, '3 things to sort out before your chicks arrive.'))),
      gapCard({ iconName: 'thermometer', title: 'No thermometer', reason: 'Chicks cannot tell you they are cold. You need to measure heat at chick height.',
        actions: [button({ label: 'Add to shopping list', variant: 'soft' }), button({ label: 'Why it matters', variant: 'soft', href: '#/__styleguide' })] })),

    section('Checklist group', checklistGroup({ title: 'Brooding', items: [{ id: 'heat', label: 'Heat source set up and tested', done: true },
      { id: 'thermo', label: 'Thermometer at chick height' }, { id: 'guard', label: 'Chick guard (brooder ring)', done: true }] })),

    section('Tabs', tabsDemo()),

    section('Bar charts',
      card({ title: 'Eggs, last 7 days', children: [barChart({ values: eggs.map((v, i) => ({ label: days[i], value: v })),
        ariaLabel: `Eggs per day for the last 7 days: ${eggs.join(', ')}` })] }),
      card({ title: 'Eggs per day', children: [barChart({ values: Array.from({ length: 30 }, (_, i) => ({ label: '', value: 200 + ((i * 37) % 45) })),
        ariaLabel: 'Eggs per day for 30 days', height: 120, showValues: false, showLabels: false, dense: true })] })),

    section('Stage progress', stageProgress({ stages: [{ label: 'Brooding' }, { label: 'Growing' }, { label: 'Pre-lay' }, { label: 'Laying' }], current: 3 }),
      stageProgress({ stages: [{ label: 'Brooding' }, { label: 'Growing' }, { label: 'Pre-lay' }, { label: 'Laying' }], current: 1 })),

    section('Timeline', card({ flush: true, children: [
      timelineRow({ kind: 'eggs', title: '236 eggs collected', meta: 'Today, 15:10 · Joseph', href: '#/__styleguide' }),
      timelineRow({ kind: 'water', title: '64 L water', meta: 'Today, 08:05 · Joseph' }),
      timelineRow({ kind: 'death', title: '1 bird died', meta: 'Yesterday · cause not known' }),
      timelineRow({ kind: 'feed', title: '33 kg layers mash', meta: 'Fri 20 Nov · measured' }),
      timelineRow({ kind: 'expense', title: 'Expense: 10 bags feed', meta: 'Thu 19 Nov · owner only' })] })),

    section('Accordion and source labels', card({ flush: true, children: [
      accordionRow({ title: 'Where sources differ', body: 'Shows where Ugandan and international guides give different figures.' }),
      accordionRow({ title: 'Sources (3)', body: 'Each source with its publisher, date and label.', open: true })] }),
    h('div', { class: 'sg-row' }, ['UG', 'SUP', 'INT', 'PD', 'PG'].map(sourceBadge))),

    section('Empty, loading and error states',
      emptyBlock({ title: 'No flocks yet', text: 'When your chicks arrive, add them here.', action: button({ label: 'Add my first flock', href: '#/__styleguide' }) }),
      loadingBlock(),
      errorBlock({ message: 'The server could not be reached.' }, { onRetry: () => {} })));
}
