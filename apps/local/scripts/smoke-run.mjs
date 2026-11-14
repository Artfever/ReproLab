// smoke-run.mjs: drive the coin demo through the real HTTP API of a running apps/local server.
// Usage: node scripts/smoke-run.mjs [baseUrl] [outDir]
// Spec 03-local-product task 3.4. Uses only Node built-ins. Writes m2-coin-run.json,
// m2-coin-manifest.json and m2-coin-log.txt into outDir (default docs/evidence/local-product).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..', '..');
const base = (process.argv[2] ?? 'http://127.0.0.1:8765').replace(/\/$/, '');
const outDir = path.resolve(process.argv[3] ?? path.join(REPO_ROOT, 'docs', 'evidence', 'local-product'));
const POLL_MS = 1000;
const DEADLINE_MS = 6 * 60 * 1000;

async function getJson(p) {
  const r = await fetch(base + p);
  return { status: r.status, body: await r.json() };
}

const demos = await getJson('/api/demos');
const coin = demos.body.find((d) => d.id === 'coin');
if (!coin?.request) throw new Error('The coin demo is not offered by /api/demos.');

const post = await fetch(`${base}/api/runs`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(coin.request),
});
const submitted = await post.json();
if (post.status !== 202) throw new Error(`Submit failed: ${post.status} ${JSON.stringify(submitted)}`);
console.log(`submitted ${submitted.id}`);

const t0 = Date.now();
let run;
for (;;) {
  run = (await getJson(`/api/runs/${submitted.id}`)).body;
  if (!['queued', 'running'].includes(run.state)) break;
  if (Date.now() - t0 > DEADLINE_MS) throw new Error('Run did not finish in time.');
  await new Promise((r) => setTimeout(r, POLL_MS));
}
console.log(`final state ${run.state}`);

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'm2-coin-run.json'), JSON.stringify(run, null, 2) + '\n');
const man = await fetch(`${base}/api/runs/${submitted.id}/manifest`);
fs.writeFileSync(path.join(outDir, 'm2-coin-manifest.json'), await man.text());
fs.writeFileSync(path.join(outDir, 'm2-coin-log.txt'), run.log.lines.join('\n') + '\n');
console.log(`manifest HTTP ${man.status}; files: ${run.files.map((f) => f.name).join(', ')}`);
process.exitCode = run.state === 'succeeded' ? 0 : 1;
