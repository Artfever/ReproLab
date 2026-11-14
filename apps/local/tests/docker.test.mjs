// Tests for src/docker.mjs. Spec 03-local-product, Requirements 5.1, 5.2, 5.3, 5.6, 5.12.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildCreateArgs, containerName, resolveImage, SECURITY_FLAGS, DEFAULT_IMAGE, runDocker,
} from '../src/docker.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LOCAL = path.resolve(HERE, '..');
const RUN_ID = 'a'.repeat(32);
const IMAGE_ID = `sha256:${'f6'.repeat(32)}`;

test('REPROLAB_IMAGE_DIGEST is the image id, never the run id; absent when unknown; bad ids rejected', () => {
  const withId = buildCreateArgs({ runId: RUN_ID, image: DEFAULT_IMAGE, imageId: IMAGE_ID, command: ['x'] });
  assert.ok(withId.includes(`REPROLAB_IMAGE_DIGEST=${IMAGE_ID}`));
  assert.ok(!withId.some((a) => a.includes(`REPROLAB_IMAGE_DIGEST=${RUN_ID}`)));
  const without = buildCreateArgs({ runId: RUN_ID, image: DEFAULT_IMAGE, imageId: null, command: ['x'] });
  assert.ok(!without.some((a) => a.includes('REPROLAB_IMAGE_DIGEST')));
  assert.throws(() => buildCreateArgs({ runId: RUN_ID, image: DEFAULT_IMAGE, imageId: 'x; rm', command: ['x'] }));
});

test('create args contain exactly the Requirement 5.2 flags in order', () => {
  const args = buildCreateArgs({
    runId: RUN_ID, image: DEFAULT_IMAGE, imageId: IMAGE_ID, command: ['python3', '-m', 'reprolab_runner.cli', 'run'],
  });
  assert.deepEqual(args, [
    'create',
    '--name', `rl-${RUN_ID}`,
    '--label', `reprolab.run=${RUN_ID}`,
    '--platform', 'linux/amd64',
    '--network', 'none',
    '--read-only',
    '--cap-drop', 'ALL',
    '--security-opt', 'no-new-privileges',
    '--pids-limit', '128',
    '--memory', '1024m',
    '--cpus', '1',
    '--tmpfs', '/tmp',
    '--user', '10001',
    '-v', '/work',
    '-e', `REPROLAB_IMAGE_DIGEST=${IMAGE_ID}`,
    DEFAULT_IMAGE,
    'python3', '-m', 'reprolab_runner.cli', 'run',
  ]);
  assert.ok(Object.isFrozen(SECURITY_FLAGS));
});

test('no bind mount and no host path flag is ever produced', () => {
  const args = buildCreateArgs({ runId: RUN_ID, image: DEFAULT_IMAGE, command: ['x'] });
  assert.equal(args.filter((a) => a === '-v').length, 1);
  assert.equal(args[args.indexOf('-v') + 1], '/work');
  assert.ok(!args.some((a) => a === '--mount' || a === '--privileged' || a === '--network=host'));
});

test('run id, container name and image are validated', () => {
  assert.throws(() => buildCreateArgs({ runId: 'abc', image: DEFAULT_IMAGE, command: [] }));
  assert.throws(() => buildCreateArgs({ runId: RUN_ID, image: '--privileged', command: [] }));
  assert.throws(() => buildCreateArgs({ runId: RUN_ID, image: 'a b', command: [] }));
  assert.throws(() => buildCreateArgs({ runId: RUN_ID, name: 'x; rm', image: DEFAULT_IMAGE, command: [] }));
  assert.throws(() => containerName('../x'));
  assert.equal(containerName(RUN_ID, 'sum'), `rl-${RUN_ID}-sum`);
});

test('image comes from REPROLAB_IMAGE and defaults to the pinned tag', () => {
  assert.equal(resolveImage({}), 'reprolab-openbugs:3.2.3-vendored');
  assert.equal(resolveImage({ REPROLAB_IMAGE: 'reprolab-openbugs:other' }), 'reprolab-openbugs:other');
  assert.throws(() => resolveImage({ REPROLAB_IMAGE: '-v /:/h' }));
});

test('runDocker never uses a shell: metacharacters stay literal arguments', async () => {
  const r = await runDocker(['version', '--format', '&& echo injected'], { timeoutMs: 20000 });
  assert.ok(!r.stdout.includes('injected\n') || r.stdout.includes('&&'));
  assert.equal(typeof r.timedOut, 'boolean');
});

function listSources(dir) {
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...listSources(full));
    else if (/\.(mjs|js|cjs|ts)$/.test(entry.name)) found.push(full);
  }
  return found;
}

test('only docker.mjs imports child_process; docker.mjs uses shell:false', () => {
  const roots = [path.join(LOCAL, 'src'), path.join(LOCAL, 'assistant')].filter((d) => fs.existsSync(d));
  const offenders = [];
  for (const root of roots) {
    for (const file of listSources(root)) {
      const text = fs.readFileSync(file, 'utf8');
      if (/child_process/.test(text) && path.basename(file) !== 'docker.mjs') offenders.push(file);
    }
  }
  assert.deepEqual(offenders, []);
  const docker = fs.readFileSync(path.join(LOCAL, 'src', 'docker.mjs'), 'utf8');
  assert.match(docker, /shell: false/);
  assert.ok(!/\bexec(Sync|File|FileSync)?\s*\(/.test(docker));
  assert.ok(!/shell:\s*true/.test(docker));
});
