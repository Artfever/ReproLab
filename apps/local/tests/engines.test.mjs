import test from 'node:test';
import assert from 'node:assert/strict';
import { engineById, interpretFixture, listEngines, validateEngineRequest } from '../src/engines.mjs';
import { listDemos } from '../src/demos.mjs';

test('catalog lists nine distinct engines and presence alone does not imply ready', async () => {
  const docker = {
    checkDocker: async () => ({ status: 'ok' }),
    checkImage: async () => ({ present: true, id: 'local-id' }),
    probeEngine: async (_id, _command, version) => version === '3.2.3',
  };
  const catalog = await listEngines(docker, 'local-openbugs');
  assert.equal(new Set(catalog.map(({ id }) => id)).size, 9);
  for (const entry of catalog) {
    assert.equal(entry.status, entry.id === 'openbugs' ? 'ready' : 'setup_required');
    assert.equal(entry.platform, 'linux/amd64');
    assert.equal(entry.command, undefined);
  }
});

test('legacy uploads still validate and fixtures cannot override runtime commands', () => {
  const coin = listDemos()[0].request;
  assert.equal(validateEngineRequest(coin).ok, true);
  const fixture = { engine: 'pymc2', workflow: 'coin', case: 'demo' };
  assert.equal(validateEngineRequest(fixture).ok, true);
  assert.equal(validateEngineRequest({ ...fixture, engine: 'constructor' }).ok, false);
  assert.equal(validateEngineRequest({ ...fixture, workflow: 'custom' }).ok, false);
  assert.equal(validateEngineRequest({ ...fixture, image: 'user/image' }).ok, false);
  assert.equal(validateEngineRequest({ engine: 'cufflinks', workflow: 'assemble', case: 'linked', parentRunId: '../bad' }).ok, false);
});

test('missing artifacts fail interpretation, while valid but different results fail comparison', () => {
  const adapter = engineById('pymc2');
  const report = { version: adapter.version, runtimeS: 1, peakRssKiB: 2048, values: adapter.reference };
  const files = [{ name: 'traces.csv', bytes: 500 }];
  assert.equal(interpretFixture(adapter, report, []), null);
  assert.equal(interpretFixture(adapter, report, files).status, 'passed');
  assert.equal(interpretFixture(adapter, { ...report, values: { ...report.values, mean: 0.9 } }, files).status, 'failed');
});
