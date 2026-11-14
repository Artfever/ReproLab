// User-journey test (spec 03-local-product task 7.1; Requirements 5.8, 5.9, 6.2 to 6.9, 7.4, 17.5, 17.6).
// Drives the real HTTP API against the real Docker image. No fake docker layer and no fake engine.
// When Docker or the image is missing, the test prints "SKIPPED: ..." to stderr and is skipped.
// It never passes silently without running.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from '../src/server.mjs';
import { createRunManager } from '../src/runs.mjs';
import * as realDocker from '../src/docker.mjs';
import { listDemos } from '../src/demos.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..', '..');
const HOME = os.homedir();
const CANARIES = [...new Set([REPO_ROOT, HOME, process.cwd()])].flatMap((c) => [c, c.replace(/\\/g, '/'), c.replace(/\//g, '\\')]);
const hasCanary = (text) => {
  const t = String(text).toLowerCase();
  return CANARIES.some((c) => t.includes(c.toLowerCase()));
};

const dockerState = await realDocker.checkDocker();
const imageTag = realDocker.resolveImage();
const image = dockerState.status === 'ok' ? await realDocker.checkImage(imageTag) : { present: false };
const skipReason =
  dockerState.status !== 'ok'
    ? `Docker is not available (${dockerState.status}).`
    : !image.present
      ? `The image ${imageTag} is not present locally.`
      : false;
if (skipReason) console.error(`SKIPPED: the journey test did not run. ${skipReason}`);

const DEADLINE_MS = 6 * 60 * 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test('journey: real API, real image', { skip: skipReason, timeout: 25 * 60 * 1000 }, async (t) => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rl-journey-'));
  const runs = createRunManager({ docker: realDocker, dataDir });
  const app = createServer({ runs });
  const addr = await app.listen(0);
  const base = `http://127.0.0.1:${addr.port}`;
  const collected = [];

  const call = async (method, url, body) => {
    const res = await fetch(base + url, {
      method,
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    collected.push(`${method} ${url} -> ${res.status}\n${text}`);
    let json = null;
    try { json = JSON.parse(text); } catch { /* not JSON */ }
    return { status: res.status, headers: res.headers, text, json };
  };
  const waitDone = async (id) => {
    const t0 = Date.now();
    for (;;) {
      const r = await call('GET', `/api/runs/${id}`);
      assert.equal(r.status, 200);
      if (!['queued', 'running'].includes(r.json.state)) return r.json;
      assert.ok(Date.now() - t0 < DEADLINE_MS, 'The run did not finish in time.');
      await sleep(500);
    }
  };
  const submit = async (body) => {
    const r = await call('POST', '/api/runs', body);
    assert.equal(r.status, 202, r.text);
    return r.json.id;
  };
  const labelled = async () => {
    const r = await realDocker.runDocker(['ps', '-a', '-q', '--filter', `label=${realDocker.RUN_LABEL}`], { timeoutMs: 15000 });
    assert.equal(r.code, 0, 'docker ps failed');
    return r.stdout.split(/\s+/).filter(Boolean);
  };

  try {
    const demos = (await call('GET', '/api/demos')).json;
    const coin = demos.find((d) => d.id === 'coin').request;
    const invalid = demos.find((d) => d.id === 'coin-invalid').request;

    await t.test('health reports Docker and the image', async () => {
      const h = await call('GET', '/api/health');
      assert.equal(h.status, 200);
      assert.equal(h.json.ok, true);
      assert.equal(h.json.image, 'present');
    });

    await t.test('validation errors come back before any container exists', async () => {
      const before = fs.readdirSync(path.join(dataDir, 'runs')).length;
      const bad = await call('POST', '/api/validate', { ...coin, samples: 0, monitors: ['9bad'] });
      assert.equal(bad.status, 200);
      assert.equal(bad.json.ok, false);
      assert.ok(bad.json.problems.some((p) => p.field === 'samples'));
      assert.ok(bad.json.problems.some((p) => p.field.startsWith('monitors')));
      const good = await call('POST', '/api/validate', coin);
      assert.equal(good.json.ok, true);
      const post = await call('POST', '/api/runs', { ...coin, burnIn: -1, inits: [coin.inits[0]], extra: 1 });
      assert.equal(post.status, 400);
      assert.equal(post.json.ok, false);
      assert.ok(post.json.problems.length >= 1);
      assert.equal(fs.readdirSync(path.join(dataDir, 'runs')).length, before, 'A rejected request must not create a run.');
    });

    await t.test('coin run succeeds with summary, files and manifest', async () => {
      const id = await submit(coin);
      const run = await waitDone(id);
      assert.equal(run.state, 'succeeded', run.reason);
      assert.match(run.engineVersion, /^3\.2\.3/);
      assert.ok(run.files.some((f) => /^coda_/.test(f.name) && /^[0-9a-f]{64}$/.test(f.sha256)));
      assert.ok(run.log.lines.length > 0);
      assert.equal(run.summary?.available, true, JSON.stringify(run.summary));
      assert.ok(Number.isFinite(run.summary.nodes.p.mean));
      assert.ok(Math.abs(run.summary.nodes.p.mean - 0.66667) < 0.05, 'Mean of p is far from the analytic 0.6667 (sanity bound only).');
      assert.match(run.summary.label, /Not a convergence or validity claim/);

      const m = await call('GET', `/api/runs/${id}/manifest`);
      assert.equal(m.status, 200);
      assert.match(m.headers.get('content-disposition') ?? '', /attachment/);
      const manifest = JSON.parse(m.text);
      assert.equal(manifest.run_id, id);
      assert.equal(manifest.state, 'succeeded');
      assert.equal(manifest.image.tag, imageTag);
      assert.ok(manifest.image.id);
      assert.ok(manifest.inputs.model.sha256 && manifest.inputs.data.sha256);
      assert.equal(manifest.inputs.inits.length, 2);
      assert.ok(manifest.output_files.length > 0);

      const f = run.files.find((x) => /^coda_/.test(x.name));
      const file = await call('GET', `/api/runs/${id}/files/${encodeURIComponent(f.name)}`);
      assert.equal(file.status, 200);
      const unknown = await call('GET', `/api/runs/${id}/files/nope.txt`);
      assert.equal(unknown.status, 404);
      const trav = await call('GET', `/api/runs/${id}/files/${encodeURIComponent('..\\..\\x')}`);
      assert.equal(trav.status, 404);
      assert.equal((await call('GET', '/api/runs/0000')).status, 404);
    });

    await t.test('invalid model syntax gives engine_error with the engine message', async () => {
      const id = await submit(invalid);
      const run = await waitDone(id);
      assert.equal(run.state, 'engine_error', run.reason);
      assert.ok(run.reason.length > 0);
      assert.ok(run.log.lines.length > 0, 'The log shows what the engine said.');
    });

    await t.test('undefined variable gives engine_error', async () => {
      const id = await submit({ ...coin, model: 'model {\n  r ~ dbin(p, n)\n  p ~ dbeta(a_missing, 1)\n}\n' });
      const run = await waitDone(id);
      assert.equal(run.state, 'engine_error', run.reason);
      assert.match(`${run.reason}\n${run.log.lines.join('\n')}`, /a_missing|not defined/i);
    });

    await t.test('a second run is refused while one is running, and a too-long run is timed_out', async () => {
      const N = 2000;
      const slow = {
        model: 'model {\n  for (i in 1:N) {\n    r[i] ~ dbin(p[i], n)\n    p[i] ~ dbeta(1, 1)\n  }\n}\n',
        data: `list(N = ${N}, n = 10, r = c(${Array(N).fill(7).join(', ')}))`,
        inits: [`list(p = c(${Array(N).fill(0.3).join(', ')}))`, `list(p = c(${Array(N).fill(0.8).join(', ')}))`],
        monitors: ['p'], burnIn: 50000, samples: 50000, thin: 1, seed: 1, timeoutS: 3, chains: 2,
      };
      const id = await submit(slow);
      const busy = await call('POST', '/api/runs', coin);
      assert.equal(busy.status, 429, busy.text);
      const run = await waitDone(id);
      assert.equal(run.state, 'timed_out', `${run.state}: ${run.reason}`);
    });

    await t.test('Seeds from local-data/upstream when present and verified', async (st) => {
      const seeds = listDemos().find((d) => d.id === 'seeds-upstream');
      if (!seeds.request) {
        console.error(`SKIPPED: Seeds sub-test. ${seeds.missingReason}`);
        st.skip(seeds.missingReason);
        return;
      }
      const id = await submit(seeds.request);
      const run = await waitDone(id);
      assert.equal(run.state, 'succeeded', run.reason);
      assert.equal(run.summary?.available, true);
      for (const n of seeds.request.monitors) assert.ok(run.summary.nodes[n], `summary has ${n}`);
      assert.equal((await call('GET', `/api/runs/${id}/manifest`)).status, 200);
    });

    await t.test('no machine path appears in any response and no run container is left', async () => {
      const leaked = collected.filter(hasCanary);
      assert.equal(leaked.length, 0, `A machine path appeared in ${leaked.length} response(s).`);
      await runs.whenIdle();
      const left = await labelled();
      assert.deepEqual(left, [], 'Containers labelled reprolab.run remain.');
    });
  } finally {
    await app.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
