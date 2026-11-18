// Tests for task 6.3: provider client, answer verification and the ask route.
// The provider is a local Fake_Provider (test double). No real language-model endpoint is used here.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/server.mjs';
import { loadFilePassages } from '../assistant/corpus.mjs';
import { retrieve, limitContext } from '../assistant/retrieve.mjs';
import { DECLINE_MESSAGE, extractCitations, verifyAnswer, isJudgementQuestion } from '../assistant/answer.mjs';
import { parseBaseUrl, readConfig } from '../assistant/provider.mjs';
import { startFakeProvider, replyWith, closedPort } from './helpers/fake-provider.mjs';

const KEY = 'sk-test-CANARY-0123456789abcdef';
const PORT_Q = 'What port does the server listen on?';

const logLines = [];
const bodies = []; // every response body text, scanned for the key at the end
const fakes = [];
const apps = [];

const fakeRuns = {
  ready: Promise.resolve(),
  getRun: (id) => (id === 'run-test-1'
    ? {
      id, state: 'engine_error', reason: 'The engine reported an error.', settings: { samples: 100 },
      engineVersion: '3.2.3 rev 1012', runtimeS: 1.5,
      log: { lines: ['model is syntactically correct', 'undefined variable theta in the model', 'run stopped'], truncated: false },
    }
    : null),
  getManifest: (id) => (id === 'run-test-1'
    ? Buffer.from(JSON.stringify({ state: 'engine_error', exit_code: 1 }), 'utf8')
    : null),
};

async function setup({ respond, env, timeoutMs } = {}) {
  const fake = await startFakeProvider(respond ?? replyWith('The server listens on port 8765. [setup-04]'));
  fakes.push(fake);
  const providerEnv = env ?? {
    REPROLAB_LLM_BASE_URL: fake.baseUrl, REPROLAB_LLM_MODEL: 'fake-model', REPROLAB_LLM_API_KEY: KEY,
  };
  const app = createServer({
    runs: fakeRuns, providerEnv, providerTimeoutMs: timeoutMs, log: (m) => logLines.push(String(m)),
  });
  const addr = await app.listen(0);
  apps.push(app);
  async function ask(payload) {
    const r = await fetch(`http://127.0.0.1:${addr.port}/api/assistant/ask`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    const text = await r.text();
    bodies.push(text);
    return { status: r.status, json: JSON.parse(text) };
  }
  return { fake, ask };
}

after(async () => {
  for (const a of apps) await a.close();
  for (const f of fakes) await f.close();
});

test('retrieval ranking reaches the prompt and a cited answer is shown with its source', async () => {
  const { fake, ask } = await setup();
  const r = await ask({ question: PORT_Q });
  assert.equal(r.status, 200);
  assert.equal(r.json.kind, 'answer');
  assert.equal(fake.count, 1);
  const call = fake.calls[0];
  assert.equal(call.headers.authorization, `Bearer ${KEY}`); // the key is used, only in the header
  assert.equal(call.body.model, 'fake-model');
  assert.equal(call.body.temperature, 0);
  const user = call.body.messages.find((m) => m.role === 'user').content;
  const expected = limitContext(retrieve(PORT_Q, loadFilePassages())).passages;
  assert.equal(expected[0].id, 'setup-04');
  const positions = expected.map((p) => user.indexOf(`[${p.id}]`));
  assert.ok(positions.every((p) => p >= 0), 'every retrieved id is in the prompt');
  assert.deepEqual([...positions].sort((a, b) => a - b), positions, 'prompt keeps ranking order');
  assert.ok(!user.includes(KEY));
  assert.equal(r.json.citations.length, 1);
  assert.equal(r.json.citations[0].id, 'setup-04');
  assert.equal(r.json.citations[0].source, 'docs/assistant/setup.md');
  assert.equal(r.json.citations[0].text, expected[0].text);
});

test('run passages are retrieved and cited for a specific run', async () => {
  const { fake, ask } = await setup({ respond: replyWith('The log reports an undefined variable. [run-log-L2]') });
  const r = await ask({ question: 'Which undefined variable theta did the model report?', runId: 'run-test-1' });
  assert.equal(r.json.kind, 'answer');
  assert.equal(fake.count, 1);
  assert.equal(r.json.citations[0].id, 'run-log-L2');
  assert.equal(r.json.citations[0].source, 'run log');
  assert.match(r.json.citations[0].text, /undefined variable theta/);
  const missing = await ask({ question: PORT_Q, runId: 'run-nope' });
  assert.equal(missing.status, 404);
});

test('an unsupported question is declined without any provider call', async () => {
  const { fake, ask } = await setup();
  const r = await ask({ question: 'What is the capital of France?' });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json, { kind: 'declined', message: DECLINE_MESSAGE });
  assert.equal(fake.count, 0);
});

test('validity, convergence and medical questions are declined without a provider call', async () => {
  const { fake, ask } = await setup();
  for (const q of [
    'Did my model converge?',
    'Is the Seeds result scientifically valid?',
    'What treatment dose does this patient need?',
    'Does the assistant tell me if my model converged?',
  ]) {
    const r = await ask({ question: q });
    assert.deepEqual(r.json, { kind: 'declined', message: DECLINE_MESSAGE }, q);
  }
  assert.equal(fake.count, 0);
  assert.equal(isJudgementQuestion(PORT_Q), false);
});

test('an uncited answer is rejected and its text is discarded', async () => {
  const text = 'UNCITED-CLAIM the server listens on port 9999.';
  const { fake, ask } = await setup({ respond: replyWith(text) });
  const r = await ask({ question: PORT_Q });
  assert.equal(fake.count, 1);
  assert.deepEqual(r.json, { kind: 'declined', message: DECLINE_MESSAGE });
  assert.ok(!JSON.stringify(r.json).includes('UNCITED-CLAIM'));
});

test('an answer that cites a passage that was not retrieved is rejected', async () => {
  const retrieved = new Set(limitContext(retrieve(PORT_Q, loadFilePassages())).passages.map((p) => p.id));
  const outside = loadFilePassages().find((p) => !retrieved.has(p.id)).id;
  for (const reply of [
    'Port 8765 [setup-04] and also [nonexistent-99].',
    `Real passage but not retrieved [${outside}].`,
  ]) {
    const { fake, ask } = await setup({ respond: replyWith(reply) });
    const r = await ask({ question: PORT_Q });
    assert.equal(fake.count, 1);
    assert.deepEqual(r.json, { kind: 'declined', message: DECLINE_MESSAGE }, reply);
  }
});

test('provider failures return a class and no answer text', async () => {
  const cases = [
    ['bad_status', replyStatus(500)],
    ['malformed', (_c, res) => res.writeHead(200).end('{not json')],
    ['malformed', (_c, res) => res.writeHead(200).end(JSON.stringify({ choices: [] }))],
    ['malformed', (_c, res) => res.writeHead(200).end(JSON.stringify({ choices: [{ message: { content: 'x'.repeat(70 * 1024) } }] }))],
  ];
  for (const [cls, respond] of cases) {
    const { ask } = await setup({ respond });
    const r = await ask({ question: PORT_Q });
    assert.equal(r.status, 502);
    assert.equal(r.json.kind, 'error');
    assert.equal(r.json.class, cls);
    assert.equal(r.json.text, undefined);
    assert.equal(r.json.citations, undefined);
    assert.ok(r.json.message.length > 0);
  }
  // timeout: the fake never answers
  const t = await setup({ respond: () => {}, timeoutMs: 300 });
  const tr = await t.ask({ question: PORT_Q });
  assert.equal(tr.status, 502);
  assert.equal(tr.json.class, 'timeout');
  // connection refused
  const port = await closedPort();
  const u = await setup({
    env: { REPROLAB_LLM_BASE_URL: `http://127.0.0.1:${port}/v1`, REPROLAB_LLM_MODEL: 'm', REPROLAB_LLM_API_KEY: KEY },
  });
  const ur = await u.ask({ question: PORT_Q });
  assert.equal(ur.json.class, 'unreachable');
  assert.equal(u.fake.count, 0);
});

function replyStatus(code) {
  return (_c, res) => res.writeHead(code, { 'Content-Type': 'text/plain' }).end(`server said ${KEY}`);
}

test('missing configuration gives a plain error and no provider call', async () => {
  const { fake, ask } = await setup({ env: {} });
  const r = await ask({ question: PORT_Q });
  assert.equal(r.status, 503);
  assert.equal(r.json.class, 'not_configured');
  assert.equal(fake.count, 0);
});

test('bad requests are rejected', async () => {
  const { ask } = await setup();
  assert.equal((await ask({})).status, 400);
  assert.equal((await ask({ question: 'x', extra: 1 })).status, 400);
  assert.equal((await ask({ question: 'a'.repeat(501) })).status, 400);
  assert.equal((await ask({ question: PORT_Q, runId: 5 })).status, 400);
});

test('URL validation and config reading', () => {
  assert.equal(parseBaseUrl('http://127.0.0.1:11434/v1/').url, 'http://127.0.0.1:11434/v1');
  assert.equal(parseBaseUrl('https://example.test/v1').ok, true);
  for (const bad of ['ftp://x/v1', 'file:///etc/passwd', 'http://user:pw@host/v1', 'http://user@host/v1',
    'http://h/v1?key=1', 'http://h/v1#x', 'not a url', '', undefined]) {
    assert.equal(parseBaseUrl(bad).ok, false, String(bad));
  }
  assert.equal(readConfig({ REPROLAB_LLM_BASE_URL: 'http://h/v1', REPROLAB_LLM_MODEL: '' }).ok, false);
  const bad = readConfig({ REPROLAB_LLM_BASE_URL: 'http://h/v1', REPROLAB_LLM_MODEL: 'm', REPROLAB_LLM_API_KEY: `${KEY}\nX: y` });
  assert.equal(bad.ok, false);
  assert.ok(!bad.reason.includes(KEY));
  assert.equal(readConfig({ REPROLAB_LLM_BASE_URL: 'http://h/v1', REPROLAB_LLM_MODEL: 'm' }).apiKey, null);
  const gemini = readConfig({ CHAT_MODEL: 'gemini-3.5-flash-lite', GEMINI_API_KEY: KEY });
  assert.deepEqual({ ok: gemini.ok, baseUrl: gemini.baseUrl, model: gemini.model, apiKey: gemini.apiKey }, {
    ok: true, baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-3.5-flash-lite', apiKey: KEY,
  });
  assert.match(readConfig({ CHAT_MODEL: 'gemini-3.5-flash-lite' }).reason, /Gemini API key/);
  const custom = readConfig({ CHAT_BASE_URL: 'http://127.0.0.1:11434/v1', CHAT_MODEL: 'llama3.2:3b', REPROLAB_LLM_API_KEY: KEY });
  assert.equal(custom.ok, true);
  assert.equal(custom.baseUrl, 'http://127.0.0.1:11434/v1');
  assert.equal(custom.model, 'llama3.2:3b');
});

test('citation extraction and verification', () => {
  assert.deepEqual(extractCitations('a [x-1] b [x-1] [run-log-L12] [not an id]'), ['x-1', 'run-log-L12']);
  assert.equal(verifyAnswer('none', ['x-1']).ok, false);
  assert.equal(verifyAnswer('ok [x-1]', ['x-1', 'y-1']).ok, true);
  assert.equal(verifyAnswer('ok [x-2]', ['x-1']).ok, false);
});

test('the API key never appears in any response, log capture or manifest', async () => {
  // A provider that echoes the key in its answer and in an error body.
  const echo = await setup({ respond: replyWith(`Key is ${KEY} and port is 8765 [setup-04]`) });
  const r = await echo.ask({ question: PORT_Q });
  assert.equal(r.json.kind, 'answer');
  assert.ok(r.json.text.includes('[redacted]'));
  await setup({ respond: replyStatus(500) }).then((s) => s.ask({ question: PORT_Q }));
  await setup({ env: {} }).then((s) => s.ask({ question: PORT_Q }));
  assert.ok(bodies.length >= 3);
  for (const b of bodies) assert.ok(!b.includes(KEY), 'response contains the key');
  assert.ok(logLines.length > 0, 'failures were logged');
  for (const l of logLines) assert.ok(!l.includes(KEY), 'log contains the key');
  assert.ok(!fakeRuns.getManifest('run-test-1').toString('utf8').includes(KEY));
});
