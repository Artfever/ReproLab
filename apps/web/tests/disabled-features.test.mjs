import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { WEB_ROOT } from './helpers/html.mjs';
import { FORBIDDEN, scan } from './helpers/guard.mjs';

function walk(dir) {
  return readdirSync(dir).flatMap((n) => { const p = path.join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
}
const src = walk(path.join(WEB_ROOT, 'src')).filter((f) => /\.(tsx?|mjs|css)$/.test(f));

test('site source has no forbidden pattern (no forms, fetch, subprocess, docker, secrets, inline styles)', () => {
  assert.ok(src.length > 0);
  for (const f of src) assert.deepEqual(scan(readFileSync(f, 'utf8')), [], path.relative(WEB_ROOT, f));
});
test('no API route, route handler, middleware or server action exists', () => {
  assert.equal(existsSync(path.join(WEB_ROOT, 'src/app/api')), false);
  assert.equal(existsSync(path.join(WEB_ROOT, 'src/middleware.ts')), false);
  assert.equal(existsSync(path.join(WEB_ROOT, 'middleware.ts')), false);
  assert.equal(src.some((f) => /[\\/]route\.(ts|js)$/.test(f)), false);
});
test('only error.tsx is a client component', () => {
  const clients = src.filter((f) => /^\s*['"]use client['"]/.test(readFileSync(f, 'utf8'))).map((f) => path.basename(f));
  assert.deepEqual(clients, ['error.tsx']);
});
test('package.json has only the allowed dependencies and no publish-style script', () => {
  const pkg = JSON.parse(readFileSync(path.join(WEB_ROOT, 'package.json'), 'utf8'));
  const allowed = ['next', 'react', 'react-dom', 'typescript', '@types/node', '@types/react', '@types/react-dom', 'eslint', 'eslint-config-next'];
  const all = [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})];
  assert.deepEqual(all.filter((d) => !allowed.includes(d)), []);
  for (const v of Object.values({ ...pkg.dependencies, ...pkg.devDependencies })) assert.match(v, /^\d/, 'versions are pinned exactly');
  for (const s of Object.values(pkg.scripts)) assert.doesNotMatch(s, /docker\s+push|vercel\s+(deploy|--prod)|git\s+push|npm\s+publish/);
});

// Negative tests: the guard must catch each pattern, so a pass above means something.
const SAMPLES = {
  child_process: "import { exec } from 'child_process'",
  'fetch-call': "await fetch('/api')",
  'form-control': '<form action="/run"><input type="file"/></form>',
  'server-action': "'use server'",
  'docker-or-engine': 'docker run openbugs',
  'secret-like': "const api_key = 'abcdef123456'",
  'inline-style-attr': '<p style={{color:"red"}}>x</p>',
  'dangerous-html': 'dangerouslySetInnerHTML={{__html:x}}',
};
for (const g of FORBIDDEN) {
  test(`guard catches ${g.id}`, () => assert.ok(scan(SAMPLES[g.id]).includes(g.id)));
}
test('guard ignores harmless text', () => assert.deepEqual(scan('<p>Nothing runs on this site.</p>'), []));