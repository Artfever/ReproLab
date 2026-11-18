// Tests for task 6.4: GET /api/assistant/status and the assistant panel helpers.
// Requirements 13.5, 14.1 to 14.6. The provider is the Fake_Provider test double only.
// No real language-model endpoint is used here.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from '../src/server.mjs';
import { startFakeProvider, closedPort } from './helpers/fake-provider.mjs';
import {
  QUESTION_MAX, ANSWER_LABEL, STATUS_UNREADABLE, statusView, checkQuestion, askBody, answerView,
} from '../public/assistant-logic.js';
import { DECLINE_MESSAGE } from '../assistant/answer.mjs';

const KEY = 'sk-test-CANARY-0123456789abcdef';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.resolve(HERE, '..', 'public');
const cleanups = [];
after(async () => { for (const fn of cleanups) await fn(); });

async function boot(providerEnv, extra = {}) {
  const app = createServer({ providerEnv, log: () => {}, ...extra });
  const addr = await app.listen(0);
  cleanups.push(() => app.close());
  const get = async () => {
    const r = await fetch(`http://127.0.0.1:${addr.port}/api/assistant/status`);
    const text = await r.text();
    return { status: r.status, text, json: JSON.parse(text) };
  };
  return { get, port: addr.port };
}

test('no provider configured: disabled with the required reason', async () => {
  const { get } = await boot({});
  const r = await get();
  assert.equal(r.status, 200);
  assert.equal(r.json.status, 'disabled');
  assert.match(r.json.reason, /^No language-model endpoint is configured\.?$/);
});

test('a base URL without a model name is disabled with a plain reason', async () => {
  const { get } = await boot({ REPROLAB_LLM_BASE_URL: 'http://127.0.0.1:9/v1' });
  const r = await get();
  assert.equal(r.json.status, 'disabled');
  assert.match(r.json.reason, /model name/);
});

test('a base URL with a password is disabled and the password is never echoed', async () => {
  const { get } = await boot({ REPROLAB_LLM_BASE_URL: 'http://user:hunter2secret@127.0.0.1:9/v1', REPROLAB_LLM_MODEL: 'm' });
  const r = await get();
  assert.equal(r.json.status, 'disabled');
  assert.doesNotMatch(r.text, /hunter2secret|user:|@127/);
});

test('Fake_Provider up: enabled, probe sent once, no chat call made', async () => {
  const fake = await startFakeProvider();
  cleanups.push(() => fake.close());
  const { get } = await boot({ REPROLAB_LLM_BASE_URL: fake.baseUrl, REPROLAB_LLM_MODEL: 'fake-model', REPROLAB_LLM_API_KEY: KEY });
  const r = await get();
  assert.equal(r.json.status, 'enabled');
  assert.equal(typeof r.json.reason, 'string');
  assert.equal(fake.probes.length, 1);
  assert.equal(fake.count, 0, 'a status check must not send a question');
  assert.equal(fake.probes[0].headers.authorization, `Bearer ${KEY}`);
});

test('Fake_Provider down (connection refused): disabled, unreachable', async () => {
  const port = await closedPort();
  const { get } = await boot({ REPROLAB_LLM_BASE_URL: `http://127.0.0.1:${port}/v1`, REPROLAB_LLM_MODEL: 'm' });
  const r = await get();
  assert.equal(r.json.status, 'disabled');
  assert.match(r.json.reason, /unreachable/);
});

test('endpoint that accepts but never answers: disabled after the probe timeout', async () => {
  const hang = http.createServer(() => { /* never respond */ });
  const sockets = new Set();
  hang.on('connection', (s) => { sockets.add(s); s.on('close', () => sockets.delete(s)); });
  await new Promise((resolve) => hang.listen(0, '127.0.0.1', resolve));
  cleanups.push(() => new Promise((resolve) => { for (const s of sockets) s.destroy(); hang.close(() => resolve()); }));
  const { port } = hang.address();
  const { get } = await boot(
    { REPROLAB_LLM_BASE_URL: `http://127.0.0.1:${port}/v1`, REPROLAB_LLM_MODEL: 'm' },
    { probeTimeoutMs: 250 },
  );
  const t0 = Date.now();
  const r = await get();
  assert.equal(r.json.status, 'disabled');
  assert.match(r.json.reason, /unreachable/);
  assert.ok(Date.now() - t0 < 3000);
});

test('status is cached for 10 seconds, then probed again', async () => {
  const fake = await startFakeProvider();
  cleanups.push(() => fake.close());
  let t = 1_000_000;
  const { get } = await boot(
    { REPROLAB_LLM_BASE_URL: fake.baseUrl, REPROLAB_LLM_MODEL: 'fake-model' },
    { now: () => t },
  );
  await get();
  t += 9_999;
  await get();
  assert.equal(fake.probes.length, 1, 'within 10 s the cached answer is used');
  t += 2;
  await get();
  assert.equal(fake.probes.length, 2, 'after 10 s the endpoint is probed again');
});

test('the response never contains the key, the address, the port or a URL path', async () => {
  const fake = await startFakeProvider();
  cleanups.push(() => fake.close());
  const up = await boot({ REPROLAB_LLM_BASE_URL: fake.baseUrl, REPROLAB_LLM_MODEL: 'fake-model', REPROLAB_LLM_API_KEY: KEY });
  const closed = await closedPort();
  const down = await boot({ REPROLAB_LLM_BASE_URL: `http://127.0.0.1:${closed}/v1`, REPROLAB_LLM_MODEL: 'm', REPROLAB_LLM_API_KEY: KEY });
  for (const b of [up, down]) {
    const r = await b.get();
    assert.doesNotMatch(r.text, /sk-test|CANARY|http|127\.0\.0\.1|\/v1|:\d{4,5}/);
    assert.deepEqual(Object.keys(r.json).sort(), ['reason', 'status']);
  }
});

test('UI helper: disabled status gives a reason; enabled gives none needed', () => {
  assert.deepEqual(statusView(200, { status: 'disabled', reason: 'No language-model endpoint is configured.' }),
    { enabled: false, reason: 'No language-model endpoint is configured.' });
  assert.equal(statusView(200, { status: 'enabled', reason: 'ok' }).enabled, true);
  for (const bad of [[500, {}], [200, null], [200, { status: 'maybe' }], [200, []]]) {
    assert.deepEqual(statusView(...bad), { enabled: false, reason: STATUS_UNREADABLE });
  }
});

test('UI helper: question checks and request body', () => {
  assert.equal(checkQuestion('   ').ok, false);
  assert.equal(checkQuestion('x'.repeat(QUESTION_MAX)).ok, true);
  assert.equal(checkQuestion('x'.repeat(QUESTION_MAX + 1)).ok, false);
  assert.deepEqual(askBody('q'), { question: 'q' });
  assert.deepEqual(askBody('q', 'abc'), { question: 'q', runId: 'abc' });
});

test('UI helper: answers carry the label and citations; declines and errors are plain', () => {
  const a = answerView(200, {
    kind: 'answer', text: 'Port 8765. [setup-04]',
    citations: [{ id: 'setup-04', source: 'setup.md', text: 'The server listens on 8765.' }],
  });
  assert.equal(a.kind, 'answer');
  assert.equal(a.label, 'Generated by a language model from the cited passages. Check the citations.');
  assert.equal(a.label, ANSWER_LABEL);
  assert.deepEqual(a.citations, [{ id: 'setup-04', source: 'setup.md', text: 'The server listens on 8765.' }]);
  const d = answerView(200, { kind: 'declined', message: DECLINE_MESSAGE });
  assert.equal(d.kind, 'declined');
  assert.equal(d.text, DECLINE_MESSAGE);
  const e = answerView(502, { kind: 'error', class: 'timeout', message: 'The language-model endpoint did not answer within 60 seconds.' });
  assert.equal(e.kind, 'error');
  assert.match(e.text, /did not answer within 60 seconds/);
  assert.equal(answerView(200, { kind: 'answer', text: 'no citations array' }).kind, 'error');
  assert.match(answerView(500, null).text, /status 500/);
});

test('panel markup: shared slot on run and results pages, script is same-origin, textContent only', () => {
  for (const f of ['run.html', 'results.html']) {
    const html = fs.readFileSync(path.join(PUBLIC, f), 'utf8');
    assert.match(html, /<div id="assistant-slot"><\/div>/, f);
    assert.match(html, /<script type="module" src="\/assistant\.js"><\/script>/, f);
  }
  const js = fs.readFileSync(path.join(PUBLIC, 'assistant.js'), 'utf8')
    .split('\n').filter((l) => !l.trimStart().startsWith('//')).join('\n'); // code only, not comments
  assert.doesNotMatch(js, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(|new Function/);
  assert.match(js, /'aria-live': 'polite'/);
  assert.match(js, /textarea\.disabled = waiting \|\| !chatEnabled/);
  assert.match(js, /assistant\/transcribe/);
  assert.match(js, /Stop and transcribe/);
  assert.match(js, /only if you choose Ask/);
  assert.doesNotMatch(js, /REPROLAB_LLM|sk-|Bearer/);
});
