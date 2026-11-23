import { openbugsAdapter } from './openbugs.mjs';
import { isRunId } from './sanitize.mjs';

const tolerance = 0.00001;
const engines = [
  { id: 'openbugs', name: 'OpenBUGS', version: '3.2.3', workflow: 'bugs', description: 'Run a BUGS model with your files or a built-in demonstration.' },
  { id: 'pymc2', name: 'PyMC 2', version: '2.3.8', workflow: 'coin', description: 'Two seeded chains, 1,000 burn-in and 10,000 retained draws each.', files: ['traces.csv'], reference: { mean: 2 / 3, sd: Math.sqrt(2 / 117), draws: 20000 }, tolerance: 0.01, source: 'https://pypi.org/project/pymc/2.3.8/', checksum: '1dfef8e06d9773f2b0fd44b38d5187d6f4b3393726bb2a5723ca2d3bce1934ab' },
  { id: 'caffe', name: 'Caffe', version: '1.0', workflow: 'scores', description: 'Score an authored NCHW tensor using fixed weights.', files: [], reference: { scores: [[24.5, 7]], shape: [1, 1, 2, 3], layout: 'NCHW' }, source: 'https://github.com/BVLC/caffe/releases/tag/1.0' },
  { id: 'theano', name: 'Theano', version: '1.0.5', workflow: 'gradient', description: 'Compile a matrix product and differentiate its squared loss.', files: [], reference: { output: [[0], [2]], gradient: [[12], [16]], dtype: 'float64' }, source: 'https://pypi.org/project/Theano/1.0.5/' },
  { id: 'chainer', name: 'Chainer', version: '7.8.1', workflow: 'checkpoint', description: 'Score a fixed input before and after restoring a numeric checkpoint.', files: ['checkpoint.npz'], reference: { logits: [[11.5, -2]], restored: [[11.5, -2]] }, source: 'https://pypi.org/project/chainer/7.8.1/' },
  { id: 'qiime1', name: 'QIIME 1', version: '1.9.1', workflow: 'counts', description: 'Summarize an artificial feature count table.', files: ['counts.tsv'], reference: { sampleTotals: [6, 9], featureTotals: [5, 2, 8], featureCount: 3 }, source: 'https://anaconda.org/bioconda/qiime' },
  { id: 'tophat2', name: 'TopHat2', version: '2.1.1', workflow: 'align', description: 'Align four artificial reads to a generated reference.', files: ['accepted_hits.bam'], reference: { records: 4, reference: 'artificial' }, source: 'https://anaconda.org/bioconda/tophat' },
  { id: 'cufflinks', name: 'Cufflinks', version: '2.2.1', workflow: 'assemble', description: 'Assemble isoforms from an authored artificial alignment.', files: ['isoforms.tsv'], reference: { isoforms: 1, positive: 1 }, source: 'https://anaconda.org/bioconda/cufflinks' },
  { id: 'niftynet', name: 'NiftyNet', version: '0.6.0', workflow: 'volume', description: 'Restore an authored checkpoint and run CPU inference on a synthetic volume.', files: ['volume.npy', 'slice.png'], reference: { shape: [2, 3, 4], sum: 552, range: [0, 46] }, source: 'https://pypi.org/project/NiftyNet/0.6.0/' },
];
const runtimePins = {
  pymc2: { python: '3.8.20', numpy: '1.19.5', scipy: '1.5.4' },
  caffe: { ubuntuPackage: '1.0.0+git20180821.99bd997-5build3' },
  theano: { python: '3.8.20', numpy: '1.23.5', scipy: '1.10.1' },
  chainer: { python: '3.8.20', numpy: '1.23.5' },
  qiime1: { registryDigest: 'sha256:ccdf61ea66f2dc0ce74592d9292ed67fa36af40a16be753eb62bf56c5a7d550d' },
  tophat2: { registryDigest: 'sha256:15e907a6d9c63847f3a786522f1e6351f02cdf90faef8defa09b88f6fc58b7ff' },
  cufflinks: { registryDigest: 'sha256:1aa3f262e175a02be21c7d334e9e1a95302426ef98c835595d682da197503cc8' },
  niftynet: { python: '3.7.17', tensorflow: '1.15.5', numpy: '1.18.5' },
};
const fixtureSettings = {
  pymc2: { trials: 10, successes: 7, burnIn: 1000, samples: 10000, thin: 1, chains: 2, seeds: [1, 2] },
  caffe: { layout: 'NCHW', dtype: 'float32' },
  theano: { dtype: 'float64' },
  tophat2: { referenceSeed: 74, threads: 1 },
  cufflinks: { referenceSeed: 74, threads: 1, seed: 0 },
  niftynet: { cpuThreads: 1, dtype: 'float32' },
};
for (const engine of engines) {
  if (engine.files) {
    engine.runtimePin = runtimePins[engine.id];
    engine.settings = fixtureSettings[engine.id] ?? {};
    engine.image = `reprolab-${engine.id}:cpu-v1`;
    engine.command = (caseId) => [
      ...(engine.id === 'theano' ? ['env', 'THEANO_FLAGS=device=cpu,floatX=float64,base_compiledir=/work/theano,blas.ldflags='] : []),
      engine.id === 'caffe' ? 'python3' : 'python', '/opt/reprolab/worker.py', engine.id, caseId,
    ];
    engine.timeoutS = 120;
  }
}
export const engineById = (id) => engines.find((engine) => engine.id === id);

export function fixtureDemos(engine) {
  if (!engine.files) return [];
  return [
    { id: 'demo', title: 'Demonstration', kind: 'reprolab' },
    { id: 'failure', title: 'Deliberate failure', kind: 'invalid' },
  ].map((demo) => ({ ...demo, request: { engine: engine.id, workflow: engine.workflow, case: demo.id } }));
}

export function validateEngineRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return openbugsAdapter.validate(body);
  const { engine = 'openbugs', workflow, ...input } = body;
  const entry = engineById(engine);
  const problems = [];
  const reject = (field, message) => ({ ok: false, problems: [{ field, message }] });
  if (!entry) return reject('engine', 'Choose a registered engine.');
  if (engine === 'openbugs') {
    if (workflow !== undefined && workflow !== entry.workflow) return reject('workflow', 'Choose a registered OpenBUGS workflow.');
    return openbugsAdapter.validate(input);
  }
  if (!entry.image) return reject('engine', 'This engine workflow is planned.');
  if (workflow !== entry.workflow) return reject('workflow', 'Choose a registered engine workflow.');
  const linked = engine === 'cufflinks' && input.case === 'linked';
  if (Object.keys(input).some((key) => key !== 'case' && !(linked && key === 'parentRunId'))) {
    return reject('case', 'Only the declared fixture fields are accepted.');
  }
  if (!linked && !['demo', 'failure'].includes(input.case)) return reject('case', 'Choose a fixture case.');
  if (linked && !isRunId(input.parentRunId)) return reject('parentRunId', 'Enter the ID of a completed TopHat2 demonstration.');
  return { ok: true, problems, value: { engine, workflow, case: input.case, timeoutS: entry.timeoutS,
    settings: engine === 'pymc2' && input.case === 'failure' ? { ...entry.settings, successes: 11 } : entry.settings,
    ...(linked ? { parentRunId: input.parentRunId } : {}) } };
}

export async function listEngines(docker, openbugsImage) {
  const status = await docker.checkDocker();
  return Promise.all(engines.map(async (engine) => {
    const { id, name, version, workflow, description } = engine;
    const image = id === 'openbugs' ? openbugsImage : engine.image;
    const metadata = { id, name, version, workflow, description, platform: 'linux/amd64',
      ...(engine.files ? { timeoutS: engine.timeoutS, outputFiles: ['result.json', 'log.txt', ...engine.files] } : {}) };
    if (!image) return { ...metadata, status: 'planned', setup: 'This workflow is still being implemented.' };
    if (status.status !== 'ok') return { ...metadata, status: 'setup_required', setup: 'Start Docker to run this engine.' };
    const installed = await docker.checkImage(image);
    if (!installed.present) {
      const setup = id === 'openbugs' ? 'Build the OpenBUGS image using the README.' : `Build the ${id} image using the README.`;
      return { ...metadata, status: 'setup_required', setup };
    }
    const probe = await docker.probeEngine?.(installed.id, engine.command?.('probe'), version);
    return { ...metadata, status: probe ? 'ready' : 'setup_required', setup: probe ? '' : 'The installed image did not pass its version probe.' };
  }));
}

function matches(actual, expected, margin) {
  if (typeof expected === 'number') return Number.isFinite(actual) && Math.abs(actual - expected) <= margin;
  if (Array.isArray(expected)) return Array.isArray(actual) && actual.length === expected.length
    && expected.every((value, index) => matches(actual[index], value, margin));
  return actual === expected;
}

function isWellFormed(actual, expected) {
  if (typeof expected === 'number') return Number.isFinite(actual);
  if (Array.isArray(expected)) return Array.isArray(actual) && actual.length === expected.length
    && expected.every((value, index) => isWellFormed(actual[index], value));
  return typeof actual === typeof expected;
}

export function interpretFixture(entry, report, files) {
  if (report?.version !== entry.version || !Number.isFinite(report.runtimeS) || report.runtimeS < 0
      || !Number.isFinite(report.peakRssKiB) || report.peakRssKiB <= 0
      || !report.values || Object.keys(report.values).length !== Object.keys(entry.reference).length
      || !Object.entries(entry.reference).every(([key, value]) => isWellFormed(report.values[key], value))
      || !entry.files.every((name) => files.some((file) => file.name === name && file.bytes > 0))) return null;
  const passed = Object.entries(entry.reference).every(([key, value]) =>
    matches(report.values[key], value, entry.tolerance ?? tolerance));
  return { status: passed ? 'passed' : 'failed', expected: entry.reference, observed: report.values, absoluteTolerance: entry.tolerance ?? tolerance };
}

export function checkFixtureArtifacts(entry, read) {
  if (entry.id === 'niftynet') {
    const volume = read('volume.npy');
    const png = read('slice.png');
    if (volume.length < 106 || volume.subarray(0, 8).toString('hex') !== '934e554d50590100') return false;
    const headerLength = volume.readUInt16LE(8);
    const offset = 10 + headerLength;
    const header = volume.subarray(10, offset).toString('ascii');
    if (!header.includes("'descr': '<f4'") || !header.includes("'fortran_order': False")
        || !header.includes("'shape': (2, 3, 4)") || offset + 96 !== volume.length) return false;
    if (png.length < 24 || png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a'
        || png.readUInt32BE(16) !== 160 || png.readUInt32BE(20) !== 120) return false;
    const values = Array.from({ length: 24 }, (_, i) => volume.readFloatLE(offset + i * 4));
    return values.every(Number.isFinite) ? values : false;
  }
  if (entry.id !== 'pymc2') return true;
  const lines = read('traces.csv').toString('utf8').trimEnd().split(/\r?\n/);
  return lines.length === 20001 && lines[0] === 'chain,draw,p' && lines.slice(1).every((row, index) => {
    const [chain, draw, encoded, extra] = row.split(',');
    const value = Number(encoded);
    return Number(chain) === (index < 10000 ? 1 : 2) && Number(draw) === index % 10000 + 1
      && encoded !== '' && Number.isFinite(value) && value >= 0 && value <= 1 && extra === undefined;
  });
}
