// Tests for src/runs.mjs and the run/health routes (spec 03-local-product, task 3.3).
// Requirements 5.8 to 5.11, 6.1 to 6.10, 7.1 to 7.7, 8.2. A fake docker layer is injected; no real engine runs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRunManager, LOG_MAX_LINES, LOG_MAX_BYTES, SUMMARY_LABEL } from '../src/runs.mjs';
import { createServer } from '../src/server.mjs';
import { createFakeDocker, runnerManifest } from './helpers/fake-docker.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..');
const HOME = os.homedir();
// Canary strings: the repository path and the user profile, in the spellings a log could contain.
const CANARIES = [REPO, REPO.replace(/\\/g, '/'), HOME, HOME.replace(/\\/g, '/')];
const hasCanary = (text) => {
  const t = String(text).toLowerCase();
  return CANARIES.some((c) => t.includes(c.toLowerCase()));
};

const request = (over = {}) => ({
  model: 'model { r ~ dbin(p, n)\n p ~ dbeta(1, 1) }',
  data: 'list(r=7, n=10)',
  inits: ['list(p=0.3)', 'list(p=0.8)'],
  monitors: ['p'],
  burnIn: 10, samples: 10, thin: 1, seed: 1, timeoutS: 5,
  ...over,
});

function setup(cfg) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rl-runs-'));
  const docker = createFakeDocker(cfg);
  const runs = createRunManager({ docker, dataDir, image: 'reprolab-openbugs:test' });
  return { dataDir, docker, runs, cleanup: () => fs.rmSync(dataDir, { recursive: true, force: true }) };
}

const goodFiles = (extraLog = '') => ({
  'log.txt': `OpenBUGS version 3.2.3 rev 1012\nwork dir ${REPO}\\x ${HOME}/y\n${extraLog}`,
  'coda_CODAchain1.txt': '1 0.5\n', 'coda_CODAchain2.txt': '1 0.6\n', 'coda_CODAindex.txt': 'p 1 1\n',
  'model.txt': 'model {}', 'script.txt': 'modelQuit()',
});

const succeededBehaviour = () => {
  const files = goodFiles();
  return { files, manifest: runnerManifest('succeeded', `engine finished and all expected files exist ${REPO}`, files), stdout: 'ok' };
};

async function runAndWait(ctx, value = request()) {
  const sub = await ctx.runs.submit(value);
  assert.ok(sub.id, 'run accepted');
  await ctx.runs.whenIdle();
  return { id: sub.id, run: ctx.runs.getRun(sub.id) };
}

test('succeeded: state, files, summary, manifest, cleanup of both containers', async () => {
  const ctx = setup({ behaviour: succeededBehaviour() });
  try {
    const { id, run } = await runAndWait(ctx, request({ names: { model: 'C:\\Users\\<user>\\model.txt', data: 'data.txt', inits: ['i1.txt', 'i2.txt'] } }));
    assert.equal(run.state, 'succeeded');
    assert.equal(run.engineVersion, '3.2.3 rev 1012');
    assert.equal(run.runtimeS, 1.5);
    assert.equal(run.summary.available, true);
    assert.equal(run.summary.label, SUMMARY_LABEL);
    assert.ok(run.files.some((f) => f.name === 'coda_CODAchain1.txt' && /^[0-9a-f]{64}$/.test(f.sha256)));
    assert.ok(!run.files.some((f) => ['manifest.json', 'state.json', 'summary.json'].includes(f.name)));
    // Inputs staged under fixed names; engine cap is timeout + 30 s.
    assert.deepEqual(ctx.docker.ops('cpIn')[0].files, ['data.txt', 'inits1.txt', 'inits2.txt', 'model.txt']);
    assert.equal(ctx.docker.ops('start')[0].timeoutMs, 35000);
    const create = ctx.docker.ops('create')[0].spec;
    assert.equal(create.image, 'reprolab-openbugs:test');
    assert.equal(create.imageId, ctx.docker.state.image.id, 'the real image id is passed, not the run id');
    assert.notEqual(create.imageId, id);
    assert.ok(create.command.includes('/work/in/model.txt'));
    // Both containers removed; nothing live.
    assert.deepEqual(ctx.docker.ops('remove').map((c) => c.name).sort(), [`rl-${id}`, `rl-${id}-sum`]);
    assert.equal(ctx.docker.live.size, 0);
    assert.equal(fs.existsSync(path.join(ctx.dataDir, 'tmp', id)), false, 'staging removed');
    // Manifest: required fields, base-name-only upload names, no canary.
    const m = JSON.parse(ctx.runs.getManifest(id).toString('utf8'));
    assert.equal(m.run_id, id);
    assert.equal(m.state, 'succeeded');
    assert.deepEqual(m.image, { tag: 'reprolab-openbugs:test', id: ctx.docker.state.image.id });
    assert.equal(m.inputs.model.upload_name, 'model.txt');
    assert.equal(m.inputs.inits.length, 2);
    assert.match(m.inputs.data.sha256, /^[0-9a-f]{64}$/);
    assert.ok(m.argv && m.script && m.settings && m.created_at && Array.isArray(m.output_files));
    assert.ok(!hasCanary(JSON.stringify(m)), 'manifest has no host path');
    assert.ok(!hasCanary(fs.readFileSync(path.join(ctx.dataDir, 'runs', id, 'manifest.json'), 'utf8')), 'stored manifest has no host path');
    assert.ok(!hasCanary(JSON.stringify(run)), 'run view has no host path');
    assert.ok(run.log.lines.some((l) => l.includes('<local-path>')));
  } finally { ctx.cleanup(); }
});

test('a run reads as running, with no manifest, until summary, files and manifest are final', async () => {
  const ctx = setup({ behaviour: succeededBehaviour() });
  try {
    let release;
    const gate = new Promise((r) => { release = r; });
    const realStart = ctx.docker.startAttached;
    ctx.docker.startAttached = async (name, opts) => {
      if (name.endsWith('-sum')) await gate; // hold the run in its finishing phase
      return realStart(name, opts);
    };
    const sub = await ctx.runs.submit(request());
    for (let i = 0; i < 200 && !ctx.docker.ops('cpIn').some((c) => c.name.endsWith('-sum')); i += 1) {
      await new Promise((r) => setTimeout(r, 10));
    }
    const mid = ctx.runs.getRun(sub.id);
    assert.equal(mid.state, 'running');
    assert.equal(ctx.runs.getManifest(sub.id), null);
    release();
    await ctx.runs.whenIdle();
    const done = ctx.runs.getRun(sub.id);
    assert.equal(done.state, 'succeeded');
    assert.equal(done.summary.available, true);
    assert.ok(done.files.length > 0);
    assert.ok(ctx.runs.getManifest(sub.id));
  } finally { ctx.cleanup(); }
});

test('state mapping: failed to engine_error, timed_out to timed_out, with the engine line kept', async () => {
  const files = { 'log.txt': 'expected right parenthesis\n' };
  const failed = setup({ behaviour: { files, manifest: runnerManifest('failed', 'engine reported a problem: expected right parenthesis', files), stdout: '' } });
  try {
    const { run } = await runAndWait(failed);
    assert.equal(run.state, 'engine_error');
    assert.match(run.reason, /expected right parenthesis/);
    assert.equal(run.summary, null);
    assert.equal(failed.docker.ops('create').length, 1, 'no summary container for a failed run');
    assert.equal(failed.docker.ops('remove').length, 1);
    assert.deepEqual(run.log.lines, ['expected right parenthesis'], 'log kept for a failed run');
  } finally { failed.cleanup(); }
  const timed = setup({ behaviour: { files, manifest: runnerManifest('timed_out', 'engine exceeded the time limit and was killed', files) } });
  try {
    const { run } = await runAndWait(timed);
    assert.equal(run.state, 'timed_out');
  } finally { timed.cleanup(); }
});

test('success is never derived from an exit code: missing or unreadable manifest is runner_error', async () => {
  for (const behaviour of [
    { files: { 'log.txt': 'x\n' }, manifest: null, stdout: 'exit 0', stderr: `trace at ${REPO}\\a` },
    { files: {}, manifest: null, cpOutCode: 1 },
    { files: { 'manifest.json': '{not json' }, manifest: null },
    { files: {}, manifest: { status: 'weird', reason: 'r' } },
  ]) {
    const ctx = setup({ behaviour });
    try {
      const { run } = await runAndWait(ctx);
      assert.equal(run.state, 'runner_error', JSON.stringify(behaviour));
      assert.ok(!hasCanary(JSON.stringify(run)));
      assert.equal(ctx.docker.live.size, 0);
      assert.equal(ctx.docker.ops('remove').length, 1);
    } finally { ctx.cleanup(); }
  }
});

test('server cap: docker kill, runner_error, container removed even if a succeeded manifest exists', async () => {
  const b = succeededBehaviour();
  const ctx = setup({ behaviour: { ...b, timedOut: true } });
  try {
    const { id, run } = await runAndWait(ctx);
    assert.equal(run.state, 'runner_error');
    assert.match(run.reason, /server time limit/);
    assert.deepEqual(ctx.docker.ops('kill').map((c) => c.name), [`rl-${id}`]);
    assert.deepEqual(ctx.docker.ops('remove').map((c) => c.name), [`rl-${id}`]);
  } finally { ctx.cleanup(); }
});

test('Docker missing, not running, image missing and create failure give plain runner_error reasons', async () => {
  const cases = [
    [{ docker: { status: 'missing' } }, /Docker is not installed/],
    [{ docker: { status: 'not_running' } }, /Docker is not running/],
    [{ image: { present: false } }, /image reprolab-openbugs:test does not exist/],
    [{ createCode: 1 }, /could not create the container/],
  ];
  for (const [cfg, re] of cases) {
    const ctx = setup(cfg);
    try {
      const { run } = await runAndWait(ctx);
      assert.equal(run.state, 'runner_error');
      assert.match(run.reason, re);
      assert.equal(ctx.docker.live.size, 0);
      assert.equal(ctx.runs.isBusy(), false, 'slot released');
    } finally { ctx.cleanup(); }
  }
});

test('summary failure keeps the run state and shows a reason with no numbers', async () => {
  const ctx = setup({ behaviour: succeededBehaviour(), summaryCode: 3 });
  try {
    const { id, run } = await runAndWait(ctx);
    assert.equal(run.state, 'succeeded');
    assert.equal(run.summary.available, false);
    assert.ok(run.summary.reason.length > 10);
    assert.equal(run.summary.nodes, undefined);
    assert.ok(ctx.docker.ops('remove').some((c) => c.name === `rl-${id}-sum`));
  } finally { ctx.cleanup(); }
});

test('one run at a time: second submit is busy until the first finishes', async () => {
  let release;
  const gate = new Promise((r) => { release = r; });
  const ctx = setup({ behaviour: { ...succeededBehaviour(), gate } });
  try {
    const first = await ctx.runs.submit(request());
    assert.equal(first.state, 'queued');
    assert.deepEqual(await ctx.runs.submit(request()), { busy: true });
    assert.deepEqual(await ctx.runs.submit(request()), { busy: true });
    release();
    await ctx.runs.whenIdle();
    assert.equal(ctx.runs.getRun(first.id).state, 'succeeded');
    const again = await ctx.runs.submit(request());
    assert.ok(again.id && again.id !== first.id);
    await ctx.runs.whenIdle();
  } finally { release(); ctx.cleanup(); }
});

test('log is bounded by lines and by bytes with a truncated flag', async () => {
  const many = Array.from({ length: LOG_MAX_LINES + 50 }, (_, i) => `line ${i}`).join('\n') + '\n';
  const wide = ('x'.repeat(99) + '\n').repeat(Math.ceil(LOG_MAX_BYTES / 100) + 20);
  const small = 'a\nb\n';
  const results = [];
  for (const text of [many, wide, small]) {
    const files = { 'log.txt': text };
    const ctx = setup({ behaviour: { files, manifest: runnerManifest('failed', 'x', files) } });
    try {
      const { run } = await runAndWait(ctx);
      results.push(run.log);
    } finally { ctx.cleanup(); }
  }
  assert.equal(results[0].lines.length, LOG_MAX_LINES);
  assert.equal(results[0].truncated, true);
  assert.equal(results[1].truncated, true);
  assert.ok(results[1].lines.join('\n').length <= LOG_MAX_BYTES);
  assert.deepEqual(results[2], { lines: ['a', 'b'], truncated: false });
});

test('startup: stale containers are cleaned and unfinished state.json becomes runner_error', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rl-recover-'));
  try {
    const mk = (id, state) => {
      const d = path.join(dataDir, 'runs', id);
      fs.mkdirSync(d, { recursive: true });
      fs.writeFileSync(path.join(d, 'state.json'), JSON.stringify({
        id, state, reason: 'r', createdAt: 'now', request: {}, files: [{ name: 'log.txt', bytes: 1, sha256: 'a'.repeat(64) }, { name: '../evil', bytes: 1, sha256: 'b' }],
      }));
    };
    const a = 'a'.repeat(32); const b = 'b'.repeat(32);
    mk(a, 'running'); mk(b, 'succeeded');
    fs.mkdirSync(path.join(dataDir, 'runs', 'not-an-id'), { recursive: true });
    const docker = createFakeDocker();
    const runs = createRunManager({ docker, dataDir, image: 'x:y' });
    await runs.ready;
    assert.equal(docker.ops('removeStale').length, 1);
    assert.equal(runs.getRun(a).state, 'runner_error');
    assert.match(runs.getRun(a).reason, /restarted/);
    assert.equal(runs.getRun(b).state, 'succeeded');
    assert.deepEqual(runs.getRun(b).files.map((f) => f.name), ['log.txt'], 'unsafe stored file name dropped');
    assert.equal(runs.getRun('not-an-id'), null);
  } finally { fs.rmSync(dataDir, { recursive: true, force: true }); }
});

// ---------- HTTP routes ----------

async function withServer(cfg, fn) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rl-http-'));
  const docker = createFakeDocker(cfg);
  const runs = createRunManager({ docker, dataDir, image: 'reprolab-openbugs:test' });
  const app = createServer({ runs, docker, log: () => {}, publicDir: dataDir });
  const { port } = await app.listen(0);
  const seen = [];
  const call = async (method, p, body) => {
    const r = await fetch(`http://127.0.0.1:${port}${p}`, {
      method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined,
    });
    const text = await r.text();
    seen.push(`${r.status} ${[...r.headers].join(';')} ${text}`);
    return { status: r.status, headers: r.headers, text, json: () => JSON.parse(text) };
  };
  try { await fn({ call, runs, docker, seen }); } finally { await app.close(); fs.rmSync(dataDir, { recursive: true, force: true }); }
}

test('routes: validate, submit, poll, files, manifest; every response is free of host paths', async () => {
  await withServer({ behaviour: succeededBehaviour() }, async ({ call, runs, seen }) => {
    const v = await call('POST', '/api/validate', request({ burnIn: 99999 }));
    assert.equal(v.status, 200);
    assert.equal(v.json().ok, false);
    assert.equal(v.json().problems[0].field, 'burnIn');
    assert.equal((await call('POST', '/api/validate', request())).json().ok, true);

    const bad = await call('POST', '/api/runs', request({ samples: 0 }));
    assert.equal(bad.status, 400);
    assert.equal(runs.isBusy(), false, 'invalid request starts nothing');

    const sub = await call('POST', '/api/runs', request());
    assert.equal(sub.status, 202);
    const { id } = sub.json();
    await runs.whenIdle();

    const run = await call('GET', `/api/runs/${id}`);
    assert.equal(run.status, 200);
    assert.equal(run.json().state, 'succeeded');

    const m = await call('GET', `/api/runs/${id}/manifest`);
    assert.equal(m.status, 200);
    assert.match(m.headers.get('content-disposition'), /^attachment;/);
    assert.equal(m.json().run_id, id);

    const f = await call('GET', `/api/runs/${id}/files/log.txt`);
    assert.equal(f.status, 200);
    assert.match(f.headers.get('content-disposition'), /attachment/);
    assert.ok(f.text.includes('<local-path>'));

    const health = await call('GET', '/api/health');
    assert.equal(health.status, 200);
    assert.deepEqual(Object.keys(health.json()).sort(), ['docker', 'image', 'imageId', 'ok']);

    assert.equal(seen.filter(hasCanary).length, 0, 'canary found in a response');
  });
});

test('routes: 404 for unknown, malformed ids and file names outside the list; 429 when busy', async () => {
  let release;
  const gate = new Promise((r) => { release = r; });
  await withServer({ behaviour: { ...succeededBehaviour(), gate } }, async ({ call, runs }) => {
    const unknown = '0'.repeat(32);
    for (const p of [`/api/runs/${unknown}`, `/api/runs/${unknown}/manifest`, `/api/runs/${unknown}/files/log.txt`,
      '/api/runs/not-an-id', '/api/runs/..', `/api/runs/${unknown.toUpperCase()}`, '/api/runs/%00']) {
      const r = await call('GET', p);
      assert.equal(r.status, 404, p);
    }
    const first = await call('POST', '/api/runs', request());
    assert.equal(first.status, 202);
    const id = first.json().id;
    const second = await call('POST', '/api/runs', request());
    assert.equal(second.status, 429);
    assert.match(second.json().error, /One run at a time/);
    assert.equal((await call('GET', `/api/runs/${id}/manifest`)).status, 404, 'no manifest before the run finishes');
    release();
    await runs.whenIdle();
    for (const name of ['nope.txt', '..', '%2e%2e', '..%2Flog.txt', '%2e%2e%2f%2e%2e%2fstate.json', 'a%5Cb', 'log.txt%00', 'state.json', 'manifest.json', 'summary.json']) {
      const r = await call('GET', `/api/runs/${id}/files/${name}`);
      assert.equal(r.status, 404, name);
    }
    assert.equal((await call('GET', `/api/runs/${id}/files/log.txt`)).status, 200);
  });
});
