// Coin accuracy check against the analytic posterior (spec 03-local-product task 4.3;
// Requirements 9.4, 9.5, 9.6, 17.6).
// Runs the coin demo through the real HTTP API and the real OpenBUGS image, then compares the
// pooled mean and sd of `p` with the analytic Beta posterior values.
// The tolerance below was fixed before the first run. Do not change it to make the test pass.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from '../src/server.mjs';
import { createRunManager } from '../src/runs.mjs';
import * as realDocker from '../src/docker.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..', '..');
const EVIDENCE = process.env.REPROLAB_COIN_EVIDENCE
  ?? path.join(REPO_ROOT, 'docs', 'evidence', 'local-product', 'coin-check.txt');

const EXPECTED_MEAN = 0.66667;
const EXPECTED_SD = 0.13074;
const TOLERANCE = 0.01; // absolute, applies to both mean and sd
const DEADLINE_MS = 6 * 60 * 1000;

const dockerState = await realDocker.checkDocker();
const imageTag = realDocker.resolveImage();
const image = dockerState.status === 'ok' ? await realDocker.checkImage(imageTag) : { present: false };
const skipReason =
  dockerState.status !== 'ok'
    ? `Docker is not available (${dockerState.status}).`
    : !image.present
      ? `The image ${imageTag} is not present locally.`
      : false;
if (skipReason) console.error(`SKIPPED LOUDLY: coin-check did not run. ${skipReason}`);

test('coin model matches the analytic posterior within 0.01', { skip: skipReason, timeout: DEADLINE_MS + 60_000 }, async () => {
  const runs = createRunManager({ docker: realDocker });
  const app = createServer({ runs });
  const addr = await app.listen(0);
  const base = `http://127.0.0.1:${addr.port}`;
  try {
    const demos = await (await fetch(`${base}/api/demos`)).json();
    const coin = demos.find((d) => d.id === 'coin');
    assert.ok(coin?.request, 'The coin demo is offered with a request.');
    assert.equal(coin.request.chains, 2);
    assert.equal(coin.request.burnIn, 1000);
    assert.equal(coin.request.samples, 10000);
    assert.equal(coin.request.seed, 1);

    const post = await fetch(`${base}/api/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(coin.request),
    });
    const submitted = await post.json();
    assert.equal(post.status, 202, JSON.stringify(submitted));

    const t0 = Date.now();
    let run;
    for (;;) {
      run = await (await fetch(`${base}/api/runs/${submitted.id}`)).json();
      if (!['queued', 'running'].includes(run.state)) break;
      assert.ok(Date.now() - t0 < DEADLINE_MS, 'The run did not finish in time.');
      await new Promise((r) => setTimeout(r, 1000));
    }

    const lines = [
      'Coin accuracy check against the analytic posterior (task 4.3)',
      `run id: ${submitted.id}`,
      `final state: ${run.state}`,
      `engine: ${run.engineVersion ?? 'unknown'}`,
      `settings: chains=2 burnIn=1000 samples=10000 thin=1 seed=1`,
      `expected mean ${EXPECTED_MEAN}, expected sd ${EXPECTED_SD}, tolerance ${TOLERANCE} absolute (fixed in test source before first run)`,
    ];
    const write = () => {
      fs.mkdirSync(path.dirname(EVIDENCE), { recursive: true });
      fs.writeFileSync(EVIDENCE, lines.join('\n') + '\n');
    };

    if (run.state !== 'succeeded' || !run.summary?.available || !run.summary.nodes?.p) {
      lines.push(`verdict: NO RESULT. The run did not produce a summary for p. ${run.reason ?? run.summary?.reason ?? ''}`.trim());
      write();
      assert.fail('The run did not produce a summary for p.');
    }

    const p = run.summary.nodes.p;
    const dMean = p.mean - EXPECTED_MEAN;
    const dSd = p.sd - EXPECTED_SD;
    const meanOk = Math.abs(dMean) <= TOLERANCE;
    const sdOk = Math.abs(dSd) <= TOLERANCE;
    lines.push(
      `pooled sample count n: ${p.n}`,
      `sampled mean: ${p.mean}`,
      `sampled sd: ${p.sd}`,
      `mean difference (sampled - expected): ${dMean}  inside tolerance: ${meanOk}`,
      `sd difference (sampled - expected): ${dSd}  inside tolerance: ${sdOk}`,
      `verdict: ${meanOk && sdOk ? 'PASS' : 'FAIL'}`,
      'This compares a Monte Carlo summary with a closed-form value for a toy model. It is not a validity claim for any other model.',
    );
    write();
    assert.ok(meanOk, `mean ${p.mean} differs from ${EXPECTED_MEAN} by ${dMean}`);
    assert.ok(sdOk, `sd ${p.sd} differs from ${EXPECTED_SD} by ${dSd}`);
  } finally {
    await app.close();
  }
});
