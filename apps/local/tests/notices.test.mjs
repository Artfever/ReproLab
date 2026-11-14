import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const text = readFileSync(path.join(root, 'docs', 'third-party-notices.md'), 'utf8');

test('notices state the MIT boundary and that it grants no rights to OpenBUGS', () => {
  assert.match(text, /MIT/);
  assert.match(text, /grants no rights/);
  assert.doesNotMatch(text, /No repository licence has been chosen/);
  assert.doesNotMatch(text, /No `LICENSE` file has been added/);
});

test('notices keep the dependency table heading and the named licence notes', () => {
  assert.match(text, /^### Dependency licences \(apps\/web\)$/m);
  assert.match(text, /LGPL optional `sharp` and libvips packages/);
  assert.match(text, /MPL-2\.0 `axe-core`/);
});

test('notices list every open item', () => {
  const items = [
    'GPL v2/v3 inconsistency',
    'Unmatched tarball checksum',
    'Tarball predates r1018',
    'Unknown revision of `libOpenBUGS.so`',
    'CpcBeautifier',
    'TAUCS',
    'Examples, GeoBUGS and Reliability data rights',
    'No legal review',
  ];
  for (const item of items) assert.ok(text.includes(item), `missing open item: ${item}`);
});

test('notices do not call the GitHub mirror authenticated', () => {
  assert.match(text, /we do not call it authenticated/);
  assert.doesNotMatch(text, /authentic copy|is authentic|verified authentic/i);
});
