// assistant.js: assistant panel (spec 03-local-product, task 6.4). Requirements 13.5, 14.4 to 14.6.
// Mounts into #assistant-slot. DOM glue only; text rules live in assistant-logic.js.
// Everything from the server is inserted with textContent only. No innerHTML.
import {
  QUESTION_MAX, STATUS_URL, ASK_URL, SERVER_UNREACHABLE, STATUS_UNREADABLE,
  statusView, checkQuestion, askBody, answerView,
} from '/assistant-logic.js';
import { runIdFromSearch } from '/results-logic.js';

const slot = document.getElementById('assistant-slot');

function el(tag, attrs = {}, text) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text !== undefined) e.textContent = text;
  return e;
}

async function readJson(res) {
  try { return await res.json(); } catch { return null; }
}

function mount() {
  const onResultsPage = window.location.pathname.endsWith('/results.html');
  const runId = onResultsPage ? runIdFromSearch(window.location.search) : null;

  const section = el('section', { 'aria-labelledby': 'assistant-heading', class: 'assistant' });
  section.append(el('h2', { id: 'assistant-heading' }, 'Ask the assistant'));
  section.append(el('p', {}, runId
    ? 'Ask about ReproLab or about this run. Answers about this run use only its log lines and manifest fields.'
    : 'Ask about how to use ReproLab. Answers use only the ReproLab documentation notes.'));
  section.append(el('p', { class: 'hint' },
    'The assistant explains documentation and logs. It does not judge whether results are valid or converged.'));

  const disabledBox = el('div', { id: 'assistant-disabled', class: 'notice warn', hidden: '' });
  disabledBox.append(el('p', {}, 'The assistant is switched off.'));
  const reasonP = el('p', { id: 'assistant-reason' });
  disabledBox.append(reasonP);
  section.append(disabledBox);

  const form = el('form', { id: 'assistant-form', novalidate: '' });
  const field = el('div', { class: 'field' });
  field.append(el('label', { for: 'assistant-question' }, 'Your question'));
  const textarea = el('textarea', {
    id: 'assistant-question', rows: '3', maxlength: String(QUESTION_MAX), autocomplete: 'off',
    'aria-describedby': 'assistant-hint assistant-reason',
  });
  textarea.disabled = true;
  field.append(textarea);
  field.append(el('p', { id: 'assistant-hint', class: 'hint' },
    `Up to ${QUESTION_MAX} characters. Press Ctrl+Enter or the button to ask.`));
  form.append(field);
  const button = el('button', { type: 'submit', id: 'assistant-ask', class: 'button' }, 'Ask');
  button.disabled = true;
  const p = el('p');
  p.append(button);
  form.append(p);
  section.append(form);

  const live = el('div', { id: 'assistant-live', 'aria-live': 'polite', 'aria-atomic': 'false', class: 'assistant-live' });
  section.append(live);
  slot.replaceChildren(section);

  function showDisabled(reason) {
    reasonP.textContent = reason;
    disabledBox.hidden = false;
    textarea.disabled = true;
    button.disabled = true;
  }

  function showEnabled() {
    reasonP.textContent = '';
    disabledBox.hidden = true;
    textarea.disabled = false;
    button.disabled = false;
  }

  function renderResult(v) {
    live.replaceChildren();
    const box = el('div', { class: `assistant-result ${v.kind === 'answer' ? '' : 'notice'}`.trim(), 'data-kind': v.kind });
    if (v.kind === 'error') box.append(el('p', {}, 'The assistant could not answer.'));
    if (v.kind === 'declined') box.append(el('p', {}, 'No answer.'));
    box.append(el('p', { class: 'assistant-text' }, v.text));
    if (v.kind === 'answer') {
      box.append(el('p', { class: 'file-info assistant-label' }, v.label));
      box.append(el('h3', {}, 'Cited source passages'));
      const ol = el('ol', { class: 'assistant-citations' });
      for (const c of v.citations) {
        const li = el('li');
        li.append(el('p', {}, `[${c.id}] from ${c.source || 'unknown source'}`));
        li.append(el('p', { class: 'mono assistant-passage' }, c.text));
        ol.append(li);
      }
      box.append(ol);
    }
    live.append(box);
  }

  function say(text) {
    live.replaceChildren(el('p', {}, text));
  }

  async function ask() {
    const checked = checkQuestion(textarea.value);
    if (!checked.ok) {
      say(checked.message);
      textarea.focus();
      return;
    }
    button.disabled = true;
    textarea.disabled = true;
    say('Waiting for the assistant. This can take up to a minute.');
    try {
      const res = await fetch(ASK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(askBody(checked.question, runId)),
      });
      renderResult(answerView(res.status, await readJson(res)));
    } catch {
      renderResult({ kind: 'error', text: SERVER_UNREACHABLE, citations: [] });
    } finally {
      button.disabled = false;
      textarea.disabled = false;
    }
  }

  form.addEventListener('submit', (e) => { e.preventDefault(); ask(); });
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !button.disabled) { e.preventDefault(); ask(); }
  });

  showDisabled('Checking whether a language-model endpoint is available.');
  (async () => {
    try {
      const res = await fetch(STATUS_URL, { headers: { Accept: 'application/json' } });
      const v = statusView(res.status, await readJson(res));
      if (v.enabled) showEnabled(); else showDisabled(v.reason);
    } catch {
      showDisabled(STATUS_UNREADABLE);
    }
  })();
}

if (slot) mount();
