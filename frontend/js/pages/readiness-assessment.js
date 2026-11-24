// One readiness assessment: answers and checklist (owner only).
import { h, pageHeading, setContent } from '../components/dom.js';
import { alertBox, statusLabel, takeFlash } from '../components/alerts.js';
import { loadingBlock, errorBlock } from '../components/loading.js';
import { inputField, selectField, checkboxField, guardSubmit, showErrors, clearErrors, fillForm, saveDraft, takeDraft } from '../components/forms.js';
import { capacityPanel } from '../components/capacity.js';
import {
  readinessStatusBlock, AREA_LABELS, ANSWER_LABELS, READINESS_DISCLAIMER,
} from '../components/readiness.js';
import { getAssessment, listAssessments, saveResponses, addResource, updateResource } from '../api/readiness.js';
import { describeAssessment, startedOn } from './readiness-list.js';

const AREAS = Object.keys(AREA_LABELS);
const NOTES_MAX = 500;
const requiredNow = (q) => q.isRequired && q.immediate;

function groupByArea(list, key) {
  const groups = new Map(AREAS.map((area) => [area, []]));
  for (const entry of list) {
    if (!groups.has(entry[key])) groups.set(entry[key], []);
    groups.get(entry[key]).push(entry);
  }
  return [...groups].filter(([, entries]) => entries.length > 0);
}

function laterLabels(summary) {
  const labels = new Map();
  for (const r of summary.laterStageRequirements || []) labels.set(`${r.type}:${r.id}`, r);
  return labels;
}

function whenNeeded(entry, type, later) {
  if (entry.immediate) return 'Needed before the birds arrive';
  const found = later.get(`${type}:${entry.id}`);
  return found ? `Needed later: ${found.neededByLabel}` : 'Needed later';
}

const OPEN_UP_TO = 3;
function listBlock(title, entries) {
  if (!entries || entries.length === 0) return null;
  return h('details', { class: 'summary-list', open: entries.length <= OPEN_UP_TO },
    h('summary', {}, `${title} (${entries.length})`),
    h('ul', { class: 'plain-list' }, entries.map((text) => h('li', {}, text))));
}

function summaryView(detail) {
  const { assessment, summary } = detail;
  return h('section', { class: 'card', 'aria-labelledby': 'readiness-summary' },
    h('h2', { id: 'readiness-summary' }, 'Result'),
    readinessStatusBlock(assessment.status),
    h('dl', { class: 'details' },
      h('dt', {}, 'Questions answered'), h('dd', {}, `${summary.questionsAnswered} of ${summary.questionsTotal}`),
      h('dt', {}, 'Required items available'),
      h('dd', {}, `${summary.requiredResourcesAvailable} of ${summary.requiredResourcesTotal}`)),
    listBlock('Areas that need attention', (summary.areasNeedingAttention || []).map((area) => AREA_LABELS[area] || area)),
    listBlock('Required questions not answered yet', summary.unansweredRequired.map((q) => `${q.code}: ${q.questionText}`)),
    listBlock('Answered "No" or "Partly"', summary.needsAttention.map((q) => `${q.code}: ${q.questionText} (${ANSWER_LABELS[q.answer] || q.answer})`)),
    listBlock('Required items you do not have yet', summary.missingResources.map((i) => i.itemName)),
    summary.spaceCheck ? h('div', {}, h('h3', {}, 'Space check'), h('p', {}, summary.spaceCheck.message)) : null,
    listBlock('Needed later (not counted in the status yet)', (summary.laterStageRequirements || []).map((r) =>
      `${r.type === 'question' ? `${r.code}: ${r.questionText}` : r.itemName}: ${r.neededByLabel}`
      + (r.dueWeeksAfterArrival != null ? ` (about ${r.dueWeeksAfterArrival} weeks after the birds arrive)` : ''))),
    listBlock('Limitations', summary.researchLimitations || []),
    h('p', { class: 'small-print' }, READINESS_DISCLAIMER));
}

function questionTag(q, later) {
  if (!q.immediate) return h('span', { class: 'field__tag' }, `(${whenNeeded(q, 'question', later)})`);
  return h('span', { class: 'field__tag' }, q.isRequired ? '(required)' : '(optional)');
}

function savedAnswerText(q) {
  return q.answer ? `Saved answer: ${ANSWER_LABELS[q.answer] || q.answer}` : 'Not answered yet';
}

function questionReadOnly(q, later) {
  return h('div', { class: 'item' },
    h('p', { class: 'item__title' }, `${q.code}. ${q.questionText} `, questionTag(q, later)),
    h('p', {}, statusLabel(q.answer ? 'success' : 'info', savedAnswerText(q))),
    q.notes ? h('p', { class: 'user-text' }, `Note: ${q.notes}`) : null);
}

function questionEditable(q, later) {
  const notesId = `field-notes-${q.id}`;
  const notes = h('textarea', { class: 'input', id: notesId, name: `notes-${q.id}`, maxlength: String(NOTES_MAX), rows: '2' });
  notes.value = q.notes || '';
  return h('fieldset', { class: 'fieldset question field', dataset: { field: `q-${q.id}` } },
    h('legend', {}, `${q.code}. ${q.questionText} `, questionTag(q, later)),
    q.helpText ? h('p', { class: 'field__hint' }, q.helpText) : null,
    q.verificationNote ? h('p', { class: 'field__hint' }, `Please note: ${q.verificationNote}`) : null,
    h('div', { class: 'answer-options' },
      Object.entries(ANSWER_LABELS).map(([value, label]) => h('label', { class: 'choice' },
        h('input', { type: 'radio', name: `q-${q.id}`, value, checked: q.answer === value }),
        h('span', {}, label)))),
    h('p', { class: 'small-print' }, savedAnswerText(q)),
    h('div', { class: 'field' },
      h('label', { class: 'field__label', for: notesId }, 'Note ', h('span', { class: 'field__tag' }, '(optional)')),
      notes),
    h('p', { class: 'field__error', hidden: true }));
}

export function changedResponses(questions, form) {
  const responses = [];
  const problems = [];
  for (const q of questions) {
    const answer = form.querySelector(`input[name="q-${q.id}"]:checked`)?.value || null;
    const notes = (form.elements[`notes-${q.id}`]?.value || '').trim();
    const savedNotes = q.notes || '';
    if (!answer) {
      if (notes !== savedNotes) problems.push({ field: `q-${q.id}`, message: 'Choose Yes, Partly or No to save the note.' });
      continue;
    }
    if (answer === q.answer && notes === savedNotes) continue;
    const response = { questionId: q.id, answer };
    if (notes !== savedNotes) response.notes = notes === '' ? null : notes;
    responses.push(response);
  }
  return { responses, problems };
}

function questionsView({ detail, editable, state, onSaved, user, farm }) {
  const { questions, summary } = detail;
  const later = laterLabels(summary);
  const groups = groupByArea(questions, 'area');
  const section = h('section', { class: 'card', 'aria-labelledby': 'readiness-questions' },
    h('h2', { id: 'readiness-questions' }, 'Questions'));
  if (groups.length === 0) {
    section.append(h('p', {}, 'There are no questions for this assessment.'));
    return section;
  }
  if (state.section >= groups.length) state.section = 0;

  const tabs = h('ul', { class: 'section-tabs', 'aria-label': 'Question sections' });
  const panels = [];
  const tabButtons = [];
  const form = editable ? h('form', { class: 'form' }) : h('div', {});

  const answeredInForm = (q) => (editable ? Boolean(form.querySelector(`input[name="q-${q.id}"]:checked`)) : Boolean(q.answer));
  function sectionState(entries) {
    const answered = entries.filter(answeredInForm).length;
    const required = entries.filter(requiredNow);
    const requiredLeft = required.filter((q) => !answeredInForm(q)).length;
    return {
      text: `${answered} of ${entries.length} answered`
        + (required.length ? (requiredLeft ? `, ${requiredLeft} required still to answer` : ', required questions done') : ''),
      complete: requiredLeft === 0,
    };
  }
  function refreshTabs() {
    groups.forEach(([, entries], index) => {
      const { text, complete } = sectionState(entries);
      tabButtons[index].querySelector('.section-tab__state').textContent = `${complete ? 'Complete' : 'Incomplete'}: ${text}`;
    });
  }
  function show(index, { focus = false } = {}) {
    state.section = index;
    panels.forEach((panel, i) => { panel.hidden = i !== index; });
    tabButtons.forEach((button, i) => button.setAttribute('aria-current', String(i === index)));
    if (focus) panels[index].querySelector('h3').focus();
  }

  groups.forEach(([area, entries], index) => {
    const panelId = `readiness-section-${area}`;
    const button = h('button', { type: 'button', class: 'section-tab', 'aria-controls': panelId },
      h('span', {}, AREA_LABELS[area] || area),
      h('span', { class: 'section-tab__state' }));
    button.addEventListener('click', () => show(index, { focus: true }));
    tabButtons.push(button);
    tabs.append(h('li', {}, button));
    const navigation = editable ? h('div', { class: 'button-row' },
      index > 0 ? h('button', { type: 'button', class: 'button button--secondary', onclick: () => show(index - 1, { focus: true }) },
        `Previous: ${AREA_LABELS[groups[index - 1][0]]}`) : null,
      index < groups.length - 1 ? h('button', { type: 'button', class: 'button button--secondary', onclick: () => show(index + 1, { focus: true }) },
        `Next: ${AREA_LABELS[groups[index + 1][0]]}`) : null) : null;
    const panel = h('div', { id: panelId, class: 'question-section' },
      h('h3', { tabindex: '-1' }, `${AREA_LABELS[area] || area} (section ${index + 1} of ${groups.length})`),
      entries.map((q) => (editable ? questionEditable(q, later) : questionReadOnly(q, later))),
      navigation);
    panels.push(panel);
    form.append(panel);
  });

  if (!editable) {
    section.append(tabs, form);
    refreshTabs();
    show(state.section);
    return section;
  }

  const summaryBox = h('div', { 'aria-live': 'polite' });
  const unsaved = h('p', { class: 'unsaved-note', hidden: true }, 'You have answers that are not saved yet.');
  form.append(h('div', { class: 'button-row' },
    h('button', { type: 'submit', class: 'button' }, 'Save answers')), unsaved);
  form.addEventListener('change', () => {
    refreshTabs();
    unsaved.hidden = changedResponses(questions, form).responses.length === 0;
  });
  form.addEventListener('input', () => {
    unsaved.hidden = changedResponses(questions, form).responses.length === 0
      && changedResponses(questions, form).problems.length === 0;
  });

  const draftId = `readiness-${detail.assessment.id}`;
  const draft = takeDraft(draftId, user.id);
  if (draft) {
    fillForm(form, draft);
    summaryBox.append(alertBox('info', 'We kept the answers you had given before your session expired. Check them, then select "Save answers". Nothing was saved yet.'));
  }

  guardSubmit(form, async () => {
    clearErrors(form, summaryBox);
    const { responses, problems } = changedResponses(questions, form);
    if (problems.length) {
      showErrors(form, { message: 'Some answers could not be saved.', details: problems }, summaryBox,
        Object.fromEntries(questions.map((q) => [`q-${q.id}`, q.code])));
      return;
    }
    if (responses.length === 0) {
      summaryBox.replaceChildren(alertBox('info', 'There are no changed answers to save.'));
      return;
    }
    try {
      const { data, message } = await saveResponses(farm.id, detail.assessment.id, responses);
      onSaved(data, message || 'Answers saved.');
    } catch (error) {
      if (error.status === 401) {
        const values = {};
        for (const q of questions) {
          values[`q-${q.id}`] = form.querySelector(`input[name="q-${q.id}"]:checked`)?.value || '';
          values[`notes-${q.id}`] = form.elements[`notes-${q.id}`].value;
        }
        saveDraft(draftId, user.id, values);
        return;
      }
      const details = (error.details || []).map((d) => {
        const match = /^responses\[(\d+)\]/.exec(d.field || '');
        return match && responses[Number(match[1])] ? { field: `q-${responses[Number(match[1])].questionId}`, message: d.message } : d;
      });
      showErrors(form, { message: error.message, details }, summaryBox, Object.fromEntries(questions.map((q) => [`q-${q.id}`, q.code])));
    }
  }, { busyText: 'Saving answers…' });

  section.append(
    h('p', {}, 'Answer each question with Yes, Partly or No. You can save at any time and continue later. '
      + 'Moving between sections keeps your answers; select "Save answers" to keep them.'),
    tabs, summaryBox, form);
  refreshTabs();
  unsaved.hidden = changedResponses(questions, form).responses.length === 0;
  show(state.section);
  return section;
}

function itemTags(item, later) {
  return h('div', { class: 'tag-row' },
    h('span', { class: 'tag' }, item.isRequired ? 'Required' : 'Optional'),
    h('span', { class: 'tag' }, item.isCustom ? 'Your own item' : 'PoultryStart item'),
    h('span', { class: 'tag' }, whenNeeded(item, 'resource', later)));
}

function checklistView({ detail, editable, farm, onChanged, announce }) {
  const later = laterLabels(detail.summary);
  const section = h('section', { class: 'card', 'aria-labelledby': 'readiness-checklist' },
    h('h2', { id: 'readiness-checklist' }, 'Resource checklist'),
    h('p', {}, editable
      ? 'Tick what you already have. PoultryStart items come with the assessment; you can add your own items too.'
      : 'The checklist as it was in this assessment.'));

  const write = async (request, failureText) => {
    try {
      const { message } = await request();
      await onChanged(message);
      return true;
    } catch (error) {
      if (error.status !== 401) announce('error', `${failureText} ${error.message}`);
      return false;
    }
  };

  function itemView(item) {
    const li = h('li', { class: 'item', dataset: { itemId: String(item.id) } },
      h('p', { class: 'item__title' }, item.itemName),
      itemTags(item, later),
      h('p', {}, statusLabel(item.isAvailable ? 'success' : (item.isRequired ? 'warning' : 'info'),
        item.isAvailable ? 'You have this' : 'Not available yet')),
      item.notes ? h('p', { class: 'user-text' }, `Note: ${item.notes}`) : null);
    if (!editable) return li;

    const boxId = `have-${item.id}`;
    const box = h('input', { type: 'checkbox', id: boxId, checked: item.isAvailable });
    box.addEventListener('change', async () => {
      box.disabled = true;
      const ok = await write(() => updateResource(farm.id, detail.assessment.id, item.id, { isAvailable: box.checked }),
        `"${item.itemName}" was not updated.`);
      if (!ok) { box.checked = item.isAvailable; box.disabled = false; }
    });

    const editForm = h('form', { class: 'form', hidden: true },
      item.isCustom ? [
        inputField({ name: 'itemName', id: `item-name-${item.id}`, label: 'Item name', required: true, value: item.itemName, attrs: { maxlength: '100' } }),
        selectField({ name: 'category', id: `item-category-${item.id}`, label: 'Area', required: true, value: item.category,
          options: AREAS.map((area) => ({ value: area, label: AREA_LABELS[area] })) }),
        checkboxField({ name: 'isRequired', id: `item-required-${item.id}`, label: 'Required before the birds arrive', checked: item.isRequired }),
      ] : null,
      h('div', { class: 'field', dataset: { field: 'notes' } },
        h('label', { class: 'field__label', for: `item-notes-${item.id}` }, 'Note ', h('span', { class: 'field__tag' }, '(optional)')),
        h('textarea', { class: 'input', id: `item-notes-${item.id}`, name: 'notes', maxlength: String(NOTES_MAX), rows: '2' }),
        h('p', { class: 'field__error', hidden: true })),
      h('div', { class: 'button-row' },
        h('button', { type: 'submit', class: 'button button--small' }, 'Save item'),
        h('button', { type: 'button', class: 'button button--secondary button--small', onclick: () => { editForm.hidden = true; editButton.hidden = false; } }, 'Cancel')));
    editForm.elements.notes.value = item.notes || '';
    const editSummary = h('div', { 'aria-live': 'polite' });
    editForm.prepend(editSummary);
    const editButton = h('button', { type: 'button', class: 'button button--secondary button--small',
      'aria-label': `Edit "${item.itemName}"` }, item.isCustom ? 'Edit item' : 'Edit note');
    editButton.addEventListener('click', () => {
      editForm.hidden = false;
      editButton.hidden = true;
      editForm.querySelector('input, textarea').focus();
    });
    guardSubmit(editForm, async () => {
      clearErrors(editForm, editSummary);
      const changes = {};
      const notes = editForm.elements.notes.value.trim();
      if (notes !== (item.notes || '')) changes.notes = notes === '' ? null : notes;
      if (item.isCustom) {
        const name = editForm.elements.itemName.value.trim();
        if (name !== item.itemName) changes.itemName = name;
        if (editForm.elements.category.value !== item.category) changes.category = editForm.elements.category.value;
        if (editForm.elements.isRequired.checked !== item.isRequired) changes.isRequired = editForm.elements.isRequired.checked;
      }
      if (Object.keys(changes).length === 0) {
        editSummary.replaceChildren(alertBox('info', 'Nothing has changed.'));
        return;
      }
      try {
        const { message } = await updateResource(farm.id, detail.assessment.id, item.id, changes);
        await onChanged(message);
      } catch (error) {
        if (error.status !== 401) showErrors(editForm, error, editSummary, { itemName: 'Item name', category: 'Area', notes: 'Note' });
      }
    }, { busyText: 'Saving…' });

    li.append(
      h('label', { class: 'choice', for: boxId }, box, h('span', {}, 'I have this', h('span', { class: 'visually-hidden' }, `: ${item.itemName}`))),
      h('div', {}, editButton),
      editForm);
    return li;
  }

  for (const [area, items] of groupByArea(detail.resources, 'category')) {
    section.append(h('h3', {}, AREA_LABELS[area] || area), h('ul', { class: 'item-list' }, items.map(itemView)));
  }
  if (detail.resources.length === 0) section.append(h('p', {}, 'There are no checklist items in this assessment.'));
  if (editable) section.append(addItemForm({ detail, farm, onChanged }));
  return section;
}

function addItemForm({ detail, farm, onChanged }) {
  const summary = h('div', { 'aria-live': 'polite' });
  const form = h('form', { class: 'form' },
    inputField({ name: 'itemName', id: 'new-item-name', label: 'Item name', required: true, attrs: { maxlength: '100' } }),
    selectField({ name: 'category', id: 'new-item-category', label: 'Area', required: true, placeholder: 'Choose…',
      options: AREAS.map((area) => ({ value: area, label: AREA_LABELS[area] })) }),
    checkboxField({ name: 'isRequired', id: 'new-item-required', label: 'Required before the birds arrive',
      hint: 'A required item that you do not have yet keeps the farm "Not ready yet".' }),
    checkboxField({ name: 'isAvailable', id: 'new-item-available', label: 'I already have this' }),
    h('div', { class: 'field', dataset: { field: 'notes' } },
      h('label', { class: 'field__label', for: 'field-new-item-notes' }, 'Note ', h('span', { class: 'field__tag' }, '(optional)')),
      h('textarea', { class: 'input', id: 'field-new-item-notes', name: 'notes', maxlength: String(NOTES_MAX), rows: '2' }),
      h('p', { class: 'field__error', hidden: true })),
    h('div', { class: 'button-row' }, h('button', { type: 'submit', class: 'button' }, 'Add item')));
  guardSubmit(form, async () => {
    clearErrors(form, summary);
    const item = {
      itemName: form.elements.itemName.value.trim(),
      category: form.elements.category.value,
      isRequired: form.elements.isRequired.checked,
      isAvailable: form.elements.isAvailable.checked,
    };
    const notes = form.elements.notes.value.trim();
    if (notes) item.notes = notes;
    try {
      const { message } = await addResource(farm.id, detail.assessment.id, item);
      await onChanged(message || 'Checklist item added.');
    } catch (error) {
      if (error.status !== 401) showErrors(form, error, summary, { itemName: 'Item name', category: 'Area', notes: 'Note' });
    }
  }, { busyText: 'Adding…' });
  return h('div', {},
    h('h3', {}, 'Add your own item'),
    h('p', { class: 'small-print' }, 'Your own items are needed before the birds arrive.'),
    summary,
    form);
}

export function readinessAssessmentPage({ user, farmContext, params }) {
  const { farm } = farmContext;
  const assessmentId = Number(params.assessmentId);
  const messages = h('div', { 'aria-live': 'polite' });
  const body = h('div', {}, loadingBlock('Loading the assessment…'));
  const state = { section: 0 };
  let editable = false;
  let latestId = null;

  const summaryArea = h('div', {});
  const questionsArea = h('div', {});
  const checklistArea = h('div', {});
  const capacityArea = h('div', {});

  function announce(kind, text) {
    const box = alertBox(kind, text);
    messages.replaceChildren(box);
    box.focus();
  }

  async function refreshAfterChecklist(message) {
    const { data } = await getAssessment(farm.id, assessmentId);
    if (!body.isConnected) return;
    setContent(summaryArea, summaryView(data));
    setContent(checklistArea, checklistView({ detail: data, editable, farm, onChanged: refreshAfterChecklist, announce }));
    setContent(capacityArea, capacityPanel(data.capacity));
    if (message) announce('success', message);
  }

  function renderAll(detail) {
    setContent(summaryArea, summaryView(detail));
    setContent(questionsArea, questionsView({
      detail, editable, state, user, farm,
      onSaved: (data, message) => { renderAll(data); announce('success', message); },
    }));
    setContent(checklistArea, checklistView({ detail, editable, farm, onChanged: refreshAfterChecklist, announce }));
    setContent(capacityArea, capacityPanel(detail.capacity));
  }

  async function load() {
    setContent(body, loadingBlock('Loading the assessment…'));
    try {
      const [{ data: detail }, { data: list }] = await Promise.all([getAssessment(farm.id, assessmentId), listAssessments(farm.id)]);
      if (!body.isConnected) return;
      latestId = list.assessments[0]?.id ?? null;
      editable = detail.assessment.id === latestId;
      const changed = detail.assessment.farmPoultryTypeChanged || detail.assessment.farmStartingStageChanged;
      setContent(body,
        h('section', { class: 'card', 'aria-labelledby': 'readiness-about' },
          h('h2', { id: 'readiness-about' }, editable ? 'Latest assessment' : 'Earlier assessment (view only)'),
          h('p', {}, `Started ${startedOn(detail.assessment)}. ${describeAssessment(detail.assessment)}.`),
          editable ? null : h('p', {}, 'This is an earlier assessment, kept as a record. ',
            latestId ? h('a', { href: `#/farms/${farm.id}/readiness/${latestId}` }, 'Open the latest assessment') : null),
          changed ? alertBox('warning', 'The farm\'s poultry type or the birds\' age on arrival has changed since this assessment was started. '
            + 'Start a new assessment to check the farm as it is now.') : null,
          h('p', {}, h('a', { href: `#/farms/${farm.id}/readiness` }, 'All readiness assessments'))),
        summaryArea, questionsArea, checklistArea, capacityArea);
      renderAll(detail);
    } catch (error) {
      if (error.status === 401 || !body.isConnected) return;
      setContent(body, errorBlock(error, {
        onRetry: error.status === 0 || error.status >= 500 ? load : undefined,
        actions: [h('a', { class: 'button', href: `#/farms/${farm.id}/readiness` }, 'All readiness assessments')],
      }));
    }
  }
  load();

  return h('div', {}, pageHeading('Readiness assessment'), takeFlash(), messages, body);
}
