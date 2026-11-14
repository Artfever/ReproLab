// Regression test for the task 1.4 review defect: the Next export writes out/sample-run.html
// next to an out/sample-run/ folder that has no index.html. The local server must serve the .html.
// Needs out/ (run "npm run build" first, as "npm run check" does).
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { WEB_ROOT } from './helpers/html.mjs';
import { createServer } from '../scripts/serve-static.mjs';

const out = path.join(WEB_ROOT, 'out');

async function withServer(fn) {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try { await fn(`http://127.0.0.1:${server.address().port}`); } finally { await new Promise((resolve) => server.close(resolve)); }
}

test('out/ has the folder-plus-html shape this test depends on', () => {
  assert.ok(existsSync(path.join(out, 'sample-run.html')), 'run npm run build first');
  assert.ok(statSync(path.join(out, 'sample-run')).isDirectory());
  assert.equal(existsSync(path.join(out, 'sample-run', 'index.html')), false);
});

test('/sample-run serves sample-run.html (status 200, not the 404 page)', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/sample-run`);
    const body = await res.text();
    assert.equal(res.status, 200);
    assert.match(body, /<h1>Recorded sample: OpenBUGS Seeds<\/h1>/);
    assert.doesNotMatch(body, /<h1>Page not found<\/h1>/);
  });
});

test('/sample-run/ with a trailing slash also serves the page', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/sample-run/`);
    assert.equal(res.status, 200);
    assert.match(await res.text(), /Recorded sample: OpenBUGS Seeds/);
  });
});

test('an unknown path still returns status 404 with the not-found page', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/does-not-exist`);
    assert.equal(res.status, 404);
    assert.match(await res.text(), /<h1>Page not found<\/h1>/);
  });
});
