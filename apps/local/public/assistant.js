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
  const voice = el('div', { class: 'assistant-voice' });
  const recordButton = el('button', { type: 'button', id: 'assistant-record', class: 'button button-secondary', disabled: '' }, 'Record a question');
  const voiceHint = el('p', { id: 'assistant-voice-hint', class: 'hint', role: 'status', 'aria-live': 'polite' }, 'Checking voice transcription setup.');
  voice.append(recordButton, voiceHint);
  form.append(voice);
  const button = el('button', { type: 'submit', id: 'assistant-ask', class: 'button' }, 'Ask');
  button.disabled = true;
  const p = el('p');
  p.append(button);
  form.append(p);
  section.append(form);

  const live = el('div', { id: 'assistant-live', 'aria-live': 'polite', 'aria-atomic': 'false', class: 'assistant-live' });
  section.append(live);
  slot.replaceChildren(section);
  let chatEnabled = false;
  let voiceEnabled = false;
  let waiting = false;
  let recorder = null;
  let recordingStream = null;
  let audioParts = [];

  function syncControls() {
    textarea.disabled = waiting || !chatEnabled;
    button.disabled = waiting || !chatEnabled;
    recordButton.disabled = waiting || !voiceEnabled || (typeof MediaRecorder === 'undefined');
  }

  function showDisabled(reason) {
    reasonP.textContent = reason;
    disabledBox.hidden = false;
    chatEnabled = false;
    syncControls();
  }

  function showEnabled() {
    reasonP.textContent = '';
    disabledBox.hidden = true;
    chatEnabled = true;
    syncControls();
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
    waiting = true;
    syncControls();
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
      waiting = false;
      syncControls();
    }
  }

  function stopTracks() {
    for (const track of recordingStream?.getTracks?.() ?? []) track.stop();
    recordingStream = null;
  }

  function appendTranscript(text) {
    const clean = text.trim();
    const next = textarea.value.trim() ? `${textarea.value.trim()} ${clean}` : clean;
    if (next.length > QUESTION_MAX) {
      voiceHint.textContent = `The transcript is longer than ${QUESTION_MAX} characters. Shorten it before asking.`;
      return;
    }
    textarea.value = next;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    voiceHint.textContent = 'Transcript added to your question. Review it, then choose Ask.';
    if (chatEnabled) textarea.focus();
  }

  async function submitRecording(blob) {
    if (blob.size === 0) { voiceHint.textContent = 'No audio was recorded. Try again.'; return; }
    if (blob.size > 25 * 1024 * 1024) { voiceHint.textContent = 'The recording is larger than 25 MiB. Record a shorter question.'; return; }
    const mime = (blob.type || 'audio/webm').split(';')[0].toLowerCase();
    const ext = ({ 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'mp4', 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/flac': 'flac' })[mime] ?? 'webm';
    const data = new FormData();
    data.append('file', blob, `voice.${ext}`);
    recordButton.disabled = true;
    voiceHint.textContent = 'Sending this recording to Groq for transcription…';
    try {
      const response = await fetch('/api/assistant/transcribe', { method: 'POST', headers: { Accept: 'application/json' }, body: data });
      const result = await readJson(response);
      if (!response.ok || typeof result?.text !== 'string') {
        voiceHint.textContent = typeof result?.error === 'string' ? result.error : 'Transcription failed. Check the Groq setup and try again.';
        return;
      }
      appendTranscript(result.text);
    } catch {
      voiceHint.textContent = 'The local server could not reach Groq. Check your connection and try again.';
    } finally {
      syncControls();
    }
  }

  async function toggleRecording() {
    if (recorder?.state === 'recording') {
      recordButton.disabled = true;
      recordButton.textContent = 'Transcribing…';
      recorder.stop();
      stopTracks();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      voiceHint.textContent = 'This browser does not support microphone recording. You can type your question instead.';
      return;
    }
    try {
      recordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4']
        .find((type) => MediaRecorder.isTypeSupported(type));
      recorder = new MediaRecorder(recordingStream, mimeType ? { mimeType } : undefined);
      audioParts = [];
      recorder.addEventListener('dataavailable', (event) => { if (event.data?.size) audioParts.push(event.data); });
      recorder.addEventListener('error', () => {
        stopTracks();
        recordButton.textContent = 'Record a question';
        syncControls();
        voiceHint.textContent = 'The recording could not be read. Check microphone permission and try again.';
      }, { once: true });
      recorder.addEventListener('stop', () => {
        const audio = new Blob(audioParts, { type: recorder.mimeType || 'audio/webm' });
        audioParts = [];
        recorder = null;
        recordButton.textContent = 'Record a question';
        syncControls();
        void submitRecording(audio);
      }, { once: true });
      recorder.start();
      recordButton.textContent = 'Stop and transcribe';
      voiceHint.textContent = 'Recording. Choose Stop and transcribe when you finish your question.';
    } catch {
      stopTracks();
      voiceHint.textContent = 'Microphone access was not available. Check browser permission, or type your question.';
      syncControls();
    }
  }

  recordButton.addEventListener('click', toggleRecording);

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

  (async () => {
    try {
      const response = await fetch('/api/assistant/voice-status', { headers: { Accept: 'application/json' } });
      const status = await readJson(response);
      voiceEnabled = response.ok && status?.status === 'enabled';
      if (voiceEnabled) {
        voiceHint.textContent = `Optional voice input is ready (${status.model}). Audio is sent to Groq; the transcript is added here and sent to the chat model only if you choose Ask.`;
      } else {
        voiceHint.textContent = `${status?.reason || 'Voice input is not configured.'} You can still type your question.`;
      }
      syncControls();
    } catch {
      voiceHint.textContent = 'Voice transcription setup could not be checked. You can still type your question.';
    }
  })();
}

if (slot) mount();
