// The Reports list page.
import { h, pageHeading } from '../components/dom.js';
import { reportsFor, reportHref, REPORT_SUBTITLES } from '../components/reports.js';

export function reportsPage({ farmContext }) {
  const { farm } = farmContext;
  const reports = reportsFor(farm.myRole);
  return h('div', { class: 'reports' },
    pageHeading('Reports'),
    h('p', { class: 'report-panel__intro' }, `Reports of what is recorded for ${farm.name}. PoultryStart works them out each time you open them, `
      + 'from the records only: no targets, scores or comparisons. Opening a report changes nothing and does not create tasks. '
      + 'Each report can be printed or saved as a PDF from your browser.'),
    h('ul', { class: 'report-list' }, reports.map((r) => h('li', { class: 'report-card' },
      h('span', { class: 'report-card__code', 'aria-hidden': 'true' }, r.code),
      h('h2', {}, h('a', { href: reportHref(farm.id, r.key) }, `${r.code}: ${r.title}`)),
      h('p', { class: 'report-card__sub' }, REPORT_SUBTITLES[r.key]),
      h('p', {}, r.description),
      h('p', { class: 'small-print' }, `Default period: ${r.defaults}`)))),
    h('p', {}, h('a', { href: `#/farms/${farm.id}/dashboard` }, 'Back to the dashboard')));
}
