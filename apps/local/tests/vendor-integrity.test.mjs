// Spec 05-ui-redesign, Requirement 2: self-hosted libraries and fonts are exactly the recorded bytes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PUBLIC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const manifest = JSON.parse(readFileSync(path.join(PUBLIC, 'vendor', 'manifest.json'), 'utf8'));
const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const rel = (f) => path.relative(PUBLIC, f).split(path.sep).join('/');

test('every vendored file and font matches its recorded size and SHA-256', () => {
  assert.equal(manifest.schema_version, 1);
  assert.ok(manifest.files.length >= 10);
  for (const f of manifest.files) {
    const full = path.join(PUBLIC, f.path);
    assert.ok(existsSync(full), f.path);
    const bytes = readFileSync(full);
    assert.equal(bytes.length, f.bytes, `${f.path} size`);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), f.sha256, `${f.path} hash`);
    assert.ok(typeof f.licence === 'string' && f.licence.length > 2, `${f.path} licence`);
  }
});

test('nothing in vendor/ or fonts/ is missing from the manifest', () => {
  const listed = new Set(manifest.files.map((f) => f.path).concat('vendor/manifest.json'));
  for (const dir of ['vendor', 'fonts']) {
    for (const f of walk(path.join(PUBLIC, dir))) assert.ok(listed.has(rel(f)), `${rel(f)} not in manifest`);
  }
});

test('each library ships its licence text next to it', () => {
  for (const p of ['vendor/gsap-3.15.1/LICENSE-NOTICE.txt', 'vendor/animejs-4.5.0/LICENSE.md', 'vendor/three-0.187.0/LICENSE', 'fonts/OFL.txt']) {
    assert.ok(statSync(path.join(PUBLIC, p)).size > 100, p);
  }
  assert.match(readFileSync(path.join(PUBLIC, 'vendor/gsap-3.15.1/LICENSE-NOTICE.txt'), 'utf8'), /not an OSI-approved open-source licence/);
});

test('size limits: under 1 MiB each, three.js core under the 5 MiB tracked-file cap', () => {
  for (const f of manifest.files) {
    const cap = f.path === 'vendor/three-0.187.0/three.core.js' ? 5 * 1024 * 1024 : 1024 * 1024;
    assert.ok(f.bytes < cap, `${f.path} is ${f.bytes} bytes`);
  }
});

test('vendored scripts use no eval or Function constructor', () => {
  for (const f of manifest.files.filter((x) => x.path.endsWith('.js'))) {
    const s = readFileSync(path.join(PUBLIC, f.path), 'utf8');
    assert.doesNotMatch(s, /\beval\(|new Function\(/, f.path);
  }
});
