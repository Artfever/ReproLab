// runs.mjs: run lifecycle, Run_Dir persistence and manifest (spec 03-local-product, task 3.3).
// Requirements 5.8 to 5.11, 6.1 to 6.10, 7.1 to 7.7, 8.2.
// Node built-ins only. This module never spawns a process: every Docker call goes through the
// injected `docker` object (src/docker.mjs in production, a fake in tests).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { scrubPaths, safeBaseName, isRunId, isSafeFileName } from './sanitize.mjs';
import { containerName, resolveImage } from './docker.mjs';
import { checkFixtureArtifacts, engineById, interpretFixture } from './engines.mjs';
import { isStandardCoin } from './demos.mjs';
import { openbugsAdapter } from './openbugs.mjs';

export const RUN_STATES = Object.freeze(['queued', 'running', 'succeeded', 'engine_error', 'timed_out', 'runner_error', 'cancelled', 'interrupted']);
export const LOG_MAX_LINES = 2000;
export const LOG_MAX_BYTES = 256 * 1024;
export const CAP_MARGIN_S = 30;
export const SUMMARY_LABEL = 'Computed by ReproLab from the exported samples. Not a convergence or validity claim.';
export const BUSY_MESSAGE = 'One run at a time is supported. Wait for the current run to finish, then try again.';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..', '..');
const HIDDEN_FILES = new Set(['state.json', 'manifest.json', 'summary.json']);
const TERMINAL = new Set(RUN_STATES.slice(2));
const MAX_FILES = 200;
const MAX_FILE_BYTES = 64 * 1024 * 1024;

function sha256Of(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function lastLines(text, n) {
  return text.split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l !== '').slice(-n);
}

/**
 * @param {{docker: object, dataDir?: string, image?: string, roots?: string[],
 *          now?: () => Date, newId?: () => string}} opts
 */
export function createRunManager(opts) {
  const docker = opts.docker;
  const dataDir = path.resolve(opts.dataDir ?? path.join(REPO_ROOT, 'local-data'));
  const runsDir = path.join(dataDir, 'runs');
  const tmpDir = path.join(dataDir, 'tmp');
  const image = opts.image ?? resolveImage();
  const now = opts.now ?? (() => new Date());
  const newId = opts.newId ?? (() => crypto.randomBytes(16).toString('hex'));
  const roots = [...new Set([REPO_ROOT, os.homedir(), process.cwd(), dataDir, ...(opts.roots ?? [])])];
  const scrub = (t) => scrubPaths(String(t ?? ''), roots);

  /** @type {Map<string, object>} */
  const records = new Map();
  /** @type {Map<string, Promise<void>>} */
  const flows = new Map();
  const cancellation = new Map();
  let current = null;

  const runDirOf = (id) => path.join(runsDir, id);

  function persist(rec) {
    const dir = runDirOf(rec.id);
    fs.mkdirSync(dir, { recursive: true });
    const tmp = path.join(dir, 'state.json.tmp');
    fs.writeFileSync(tmp, JSON.stringify(rec, null, 2));
    fs.renameSync(tmp, path.join(dir, 'state.json'));
  }

  function loadExisting() {
    let names = [];
    try { names = fs.readdirSync(runsDir); } catch { return; }
    for (const name of names) {
      if (!isRunId(name)) continue;
      try {
        const rec = JSON.parse(fs.readFileSync(path.join(runsDir, name, 'state.json'), 'utf8'));
        if (!rec || rec.id !== name || !RUN_STATES.includes(rec.state)) continue;
        rec.files = Array.isArray(rec.files) ? rec.files.filter((f) => f && isSafeFileName(f.name)) : [];
        if (!TERMINAL.has(rec.state)) {
          rec.state = rec.engine ? 'interrupted' : 'runner_error';
          rec.finalizing = false;
          rec.reason = 'The local server restarted while this run was in progress. Start the run again.';
          rec.finishedAt = now().toISOString();
          try {
            const previousEngine = engineById(rec.engine);
            if (rec.engine) rec.files = listOutputFiles(runDirOf(name), outputAllowlist(previousEngine));
            const manifest = { schema_version: 2, run_id: name, engine: rec.engine ?? 'openbugs',
              workflow: rec.workflow ?? 'bugs', settings: rec.request, state: rec.state, reason: rec.reason,
              finished_at: rec.finishedAt, output_files: rec.files };
            fs.writeFileSync(path.join(runsDir, name, 'manifest.json'), JSON.stringify(manifest, null, 2));
            for (const staging of [name, `${name}-sum`]) fs.rmSync(path.join(tmpDir, staging), { recursive: true, force: true });
            persist(rec);
          } catch { /* keep the in-memory correction */ }
        }
        records.set(name, rec);
      } catch { /* unreadable state.json: ignore the directory */ }
    }
  }

  const ready = (async () => {
    fs.mkdirSync(runsDir, { recursive: true });
    fs.mkdirSync(tmpDir, { recursive: true });
    try { await docker.removeStaleContainers(); } catch { /* Docker may be absent; reported per run */ }
    loadExisting();
  })();

  async function dockerPreflight(targetImage = image) {
    const d = await docker.checkDocker();
    if (d.status === 'missing') return { ok: false, reason: 'Docker is not installed. Install Docker Desktop, then try again.' };
    if (d.status !== 'ok') return { ok: false, reason: 'Docker is not running. Start Docker Desktop and try again.' };
    const img = await docker.checkImage(targetImage);
    if (!img.present) {
      return { ok: false, reason: `The image ${targetImage} does not exist on this machine. Follow the image setup in the README, then try again.` };
    }
    return { ok: true, imageId: img.id ?? null };
  }

  async function health() {
    await ready;
    const d = await docker.checkDocker();
    const status = d.status === 'ok' || d.status === 'missing' ? d.status : 'not_running';
    if (status !== 'ok') return { ok: false, docker: status, image: 'missing', imageId: null };
    const img = await docker.checkImage(image);
    return { ok: img.present === true, docker: 'ok', image: img.present ? 'present' : 'missing', imageId: img.present ? img.id ?? null : null };
  }

  function stageInputs(id, value) {
    const dir = path.join(tmpDir, id);
    fs.mkdirSync(dir, { recursive: true });
    for (const [name, input] of openbugsAdapter.prepare(value)) fs.writeFileSync(path.join(dir, name), input, 'ascii');
    return dir;
  }

  function stageParent(id, parentId) {
    const parent = records.get(parentId);
    const file = parent?.files.find((artifact) => artifact.name === 'accepted_hits.bam');
    if (parent?.engine !== 'tophat2' || parent.state !== 'succeeded' || parent.comparison?.status !== 'passed'
        || !file || file.bytes > 1024 * 1024) throw new Error('Select a successful TopHat2 fixture run.');
    const bytes = getFile(parentId, file.name);
    if (!bytes || sha256Of(bytes) !== file.sha256) throw new Error('TopHat2 alignment hash mismatch.');
    const header = gunzipSync(bytes, { maxOutputLength: 8 * 1024 * 1024 });
    const refs = 8 + header.readUInt32LE(4);
    if (header.subarray(0, 4).toString('hex') !== '42414d01' || refs + 23 > header.length
        || header.readUInt32LE(refs) !== 1 || header.readUInt32LE(refs + 4) !== 11
        || header.subarray(refs + 8, refs + 19).toString() !== 'artificial\0'
        || header.readUInt32LE(refs + 19) !== 1200) throw new Error('TopHat2 alignment reference mismatch.');
    const dir = path.join(tmpDir, id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, file.name), bytes);
    return { dir, file };
  }

  function listOutputFiles(dir, allow) {
    const out = [];
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
    for (const e of entries.sort((a, b) => (a.name < b.name ? -1 : 1)).slice(0, MAX_FILES)) {
      if (!e.isFile() || HIDDEN_FILES.has(e.name) || !isSafeFileName(e.name)) continue;
      if (allow ? !allow.has(e.name) : !/^(model|data|inits[1-4]|coda_CODA(chain[1-4]|index)|log|stderr|script)\.txt$/.test(e.name)) continue;
      const full = path.join(dir, e.name);
      const st = fs.statSync(full);
      if (st.size > (allow ? 4 * 1024 * 1024 : MAX_FILE_BYTES)) continue;
      out.push({ name: e.name, bytes: st.size, sha256: sha256Of(fs.readFileSync(full)) });
    }
    return out;
  }

  function outputAllowlist(entry) {
    return entry?.files ? new Set(['result.json', 'log.txt', ...entry.files]) : null;
  }

  function readRunnerManifest(dir) {
    try {
      const m = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
      if (m && typeof m === 'object' && !Array.isArray(m) && typeof m.status === 'string') return m;
    } catch { /* absent or unreadable */ }
    return null;
  }

  async function computeSummary(rec, dir, created, signal) {
    const codaFiles = openbugsAdapter.summaryFiles(fs.readdirSync(dir));
    if (codaFiles.length === 0) return { available: false, reason: 'No CODA files were found, so no summary was computed.' };
    const sumStage = path.join(tmpDir, `${rec.id}-sum`);
    try {
      fs.mkdirSync(sumStage, { recursive: true });
      for (const n of codaFiles) fs.copyFileSync(path.join(dir, n), path.join(sumStage, n));
      const name = containerName(rec.id, 'sum');
      const c = await docker.createContainer({
        runId: rec.id, name, image,
        command: openbugsAdapter.summaryCommand,
      });
      if (c.code !== 0) return { available: false, reason: 'The summary container could not be created.' };
      created.push(name);
      const cp = await docker.cpIn(name, sumStage);
      if (cp.code !== 0) return { available: false, reason: 'The exported samples could not be copied into the summary container.' };
      const r = await docker.startAttached(name, { timeoutMs: 60000, signal });
      if (r.timedOut || r.code !== 0) {
        return { available: false, reason: `The summary command failed. ${scrub(lastLines(r.stderr ?? '', 3).join(' '))}`.trim() };
      }
      let parsed;
      try { parsed = JSON.parse(r.stdout); } catch { return { available: false, reason: 'The summary output could not be read.' }; }
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { available: false, reason: 'The summary output could not be read.' };
      }
      return { available: true, label: SUMMARY_LABEL, computedBy: 'ReproLab services/runner coda.py', nodes: parsed };
    } catch (err) {
      return { available: false, reason: scrub(`The summary could not be computed: ${err?.message ?? err}`) };
    } finally {
      fs.rmSync(sumStage, { recursive: true, force: true });
    }
  }

  function buildManifest(rec, runner, value, imageId) {
    const base = runner ? { ...runner } : {};
    const names = rec.names ?? {};
    const inputOf = (text, upload) => {
      const buf = Buffer.from(text, 'ascii');
      const o = { sha256: sha256Of(buf), bytes: buf.length };
      const n = safeBaseName(upload);
      if (n) o.upload_name = n;
      return o;
    };
    const manifest = {
      ...base,
      schema_version: 2,
      adapter_version: 1,
      engine: rec.engine ?? 'openbugs',
      workflow: rec.workflow ?? 'bugs',
      source: 'OpenBUGS Linux source archive 3.2.3',
      source_sha256: 'a289c4da0c4ac371f8013226c85ebd0a9e1dec5de9b858950e4854cb814b4ed8',
      platform: 'linux/amd64',
      started_at: rec.startedAt,
      finished_at: rec.finishedAt,
      comparison: rec.comparison ?? null,
      run_id: rec.id,
      state: rec.state,
      reason: rec.reason,
      image: { tag: image, id: imageId ?? null },
      created_at: rec.createdAt,
      inputs: {
        model: inputOf(value.model, names.model),
        data: inputOf(value.data, names.data),
        inits: value.inits.map((t, i) => inputOf(t, Array.isArray(names.inits) ? names.inits[i] : undefined)),
      },
      output_files: rec.files,
      limits_note: 'Local run of the OpenBUGS command-line workflow. A finished run is not a validated scientific result.',
    };
    if (rec.summary?.available) manifest.summary_computed_by = rec.summary.computedBy;
    return manifest;
  }

  async function flow(rec, value, controller) {
    const entry = value.engine ? engineById(value.engine) : null;
    const targetImage = entry?.image ?? image;
    const allow = outputAllowlist(entry);
    const created = [];
    const dir = runDirOf(rec.id);
    let staging = null;
    let capped = false;
    let tail = '';
    let imageId = null;
    let runner = null;
    let parentFile = null;
    try {
      // While `finalizing` is true, readers see `running`: the outcome is only final once the
      // summary, the file list, the manifest and the container cleanup are all done.
      rec.finalizing = true;
      rec.state = 'running';
      rec.startedAt = now().toISOString();
      persist(rec);

      const pre = await dockerPreflight(targetImage);
      if (controller.signal.aborted) return;
      if (!pre.ok) { rec.state = 'runner_error'; rec.reason = pre.reason; return; }
      imageId = pre.imageId;

      if (!entry) staging = stageInputs(rec.id, value);
      if (value.parentRunId) {
        const parent = stageParent(rec.id, value.parentRunId);
        staging = parent.dir;
        parentFile = parent.file;
      }
      const name = containerName(rec.id);
      const command = entry ? entry.command(value.case) : openbugsAdapter.command(value);
      const c = await docker.createContainer({ runId: rec.id, name, image: entry ? imageId ?? targetImage : targetImage, imageId, command });
      if (c.code !== 0) {
        rec.state = 'runner_error';
        rec.reason = scrub(`Docker could not create the container. ${lastLines(c.stderr ?? '', 5).join(' ')}`.trim());
        return;
      }
      created.push(name);
      if (staging) {
        const cin = await docker.cpIn(name, staging);
        if (cin.code !== 0) {
          rec.state = 'runner_error';
          rec.reason = scrub(`The input files could not be copied into the container. ${lastLines(cin.stderr ?? '', 5).join(' ')}`.trim());
          return;
        }
      }
      if (controller.signal.aborted) return;
      const started = await docker.startAttached(name, { timeoutMs: (value.timeoutS + CAP_MARGIN_S) * 1000, signal: controller.signal });
      if (started.timedOut) {
        capped = true;
        await docker.kill(name);
      }
      if (controller.signal.aborted) await docker.kill(name);
      tail = scrub(lastLines(`${started.stderr ?? ''}\n${started.stdout ?? ''}`, 20).join(' | '));
      fs.mkdirSync(dir, { recursive: true });
      const out = await docker.cpOut(name, dir);
      if (controller.signal.aborted) {
        if (entry) fs.writeFileSync(path.join(dir, 'log.txt'), scrub(tail));
        return;
      }
      if (entry) {
        const log = scrub(`${started.stdout ?? ''}\n${started.stderr ?? ''}`).slice(0, LOG_MAX_BYTES);
        fs.writeFileSync(path.join(dir, 'log.txt'), log);
        rec.exitCode = started.code;
        if (capped) {
          rec.state = 'timed_out';
          rec.reason = 'Stopped by the server time limit.';
        } else if (started.code !== 0) {
          rec.state = started.code === null ? 'runner_error' : 'engine_error';
          rec.reason = tail || 'The engine command failed.';
        } else {
          let report;
          const files = listOutputFiles(dir, allow);
          if (out.code === 0 && files.some((file) => file.name === 'result.json' && file.bytes <= 65536)) {
            try { report = JSON.parse(fs.readFileSync(path.join(dir, 'result.json'), 'utf8')); } catch { /* malformed */ }
          }
          rec.comparison = interpretFixture(entry, report, files);
          if (rec.comparison) {
            const artifacts = checkFixtureArtifacts(entry, (name) => fs.readFileSync(path.join(dir, name)));
            if (!artifacts) rec.comparison = null;
            if (Array.isArray(artifacts)) {
              const expected = Array.from({ length: 24 }, (_, index) => index * 2);
              rec.comparison.expected = { ...rec.comparison.expected, voxels: expected };
              rec.comparison.observed = { ...rec.comparison.observed, voxels: artifacts };
              if (artifacts.some((v, i) => v !== expected[i])) rec.comparison.status = 'failed';
            }
          }
          rec.state = rec.comparison ? 'succeeded' : 'engine_error';
          rec.reason = rec.comparison ? 'The engine produced the required outputs.' : 'Required engine outputs were missing or malformed.';
          rec.runtimeS = rec.comparison ? report.runtimeS : null;
          rec.engineVersion = rec.comparison ? entry.version : null;
          rec.peakRssKiB = rec.comparison ? report.peakRssKiB : null;
        }
        return;
      }
      runner = out.code === 0 ? readRunnerManifest(dir) : null;

      if (capped) {
        rec.state = 'runner_error';
        rec.reason = 'Stopped by the server time limit.';
      } else if (!runner) {
        rec.state = 'runner_error';
        rec.reason = `The container finished without a readable run manifest.${tail ? ` Last output: ${tail}` : ''}`;
      } else {
        // Requirement 6.6: the state comes from the Runner's classification, never an exit code.
        const outcome = openbugsAdapter.interpret(runner);
        rec.state = outcome.state;
        rec.reason = scrub(outcome.reason);
        rec.engineVersion = typeof runner.engine_version === 'string' ? scrub(runner.engine_version) : null;
        rec.runtimeS = typeof runner.runtime_s === 'number' ? runner.runtime_s : null;
      }

      if (rec.state === 'succeeded') {
        rec.summary = await computeSummary(rec, dir, created, controller.signal);
        const summary = path.join(dir, 'summary.json');
        fs.writeFileSync(`${summary}.tmp`, JSON.stringify(rec.summary));
        fs.renameSync(`${summary}.tmp`, summary);
        const p = rec.summary.nodes?.p;
        if (p && isStandardCoin(value)) {
          const expected = { mean: 2 / 3, sd: Math.sqrt(2 / 117), draws: 20000 };
          const observed = { mean: p.mean, sd: p.sd, draws: p.n };
          const passed = p.n === expected.draws && Math.abs(p.mean - expected.mean) <= 0.01
            && Math.abs(p.sd - expected.sd) <= 0.01;
          rec.comparison = { status: passed ? 'passed' : 'failed', expected, observed, absoluteTolerance: 0.01 };
        }
      }
    } catch (err) {
      rec.state = 'runner_error';
      rec.reason = scrub(`The local server could not complete the run: ${err?.message ?? err}`);
    } finally {
      for (const n of created) {
        try { await docker.removeForce(n); } catch { /* best effort; stale cleanup runs at next start */ }
      }
      if (staging) fs.rmSync(staging, { recursive: true, force: true });
      if (controller.signal.aborted) {
        rec.state = 'cancelled';
        rec.reason = 'Cancelled by the user.';
        rec.comparison = null;
      }
      try {
        fs.mkdirSync(dir, { recursive: true });
        rec.files = listOutputFiles(dir, allow);
        rec.finishedAt = now().toISOString();
        const manifest = entry ? {
          schema_version: 2, adapter_version: 1, run_id: rec.id,
          engine: entry.id, engine_version: rec.engineVersion, workflow: entry.workflow,
          source: entry.source, source_sha256: entry.checksum ?? null,
          runtime_pin: entry.runtimePin,
          image: { tag: targetImage, id: imageId, platform: 'linux/amd64' },
          settings: rec.request, state: rec.state, reason: rec.reason, exit_code: rec.exitCode ?? null,
          ...(parentFile ? { parent_run_id: value.parentRunId, inputs: { alignment: parentFile } } : {}),
          comparison: rec.comparison ?? null, runtime_s: rec.runtimeS, peak_rss_kib: rec.peakRssKiB ?? null,
          created_at: rec.createdAt, started_at: rec.startedAt, finished_at: rec.finishedAt, output_files: rec.files,
        } : buildManifest(rec, runner, value, imageId);
        const manifestPath = path.join(dir, 'manifest.json');
        fs.writeFileSync(`${manifestPath}.tmp`, scrub(JSON.stringify(manifest, null, 2)) + '\n');
        fs.renameSync(`${manifestPath}.tmp`, manifestPath);
        rec.finalizing = false;
        persist(rec);
      } catch (err) {
        rec.finalizing = false;
        rec.reason = scrub(`${rec.reason ?? ''} (The run record could not be saved: ${err?.message ?? err})`);
      }
      current = null;
      cancellation.delete(rec.id);
    }
  }

  /** Start a validated Run_Request. Returns {busy:true} when a run is queued or running. */
  async function submit(value) {
    await ready;
    if (current) return { busy: true };
    const id = newId();
    const rec = {
      id, state: 'queued', reason: 'Waiting to start.', createdAt: now().toISOString(), startedAt: null, finishedAt: null,
      engine: value.engine ?? 'openbugs', workflow: value.workflow ?? 'bugs',
      request: value.engine ? { ...value.settings, case: value.case, timeoutS: value.timeoutS, ...(value.parentRunId ? { parentRunId: value.parentRunId } : {}) } : {
        burnIn: value.burnIn, samples: value.samples, thin: value.thin, seed: value.seed,
        timeoutS: value.timeoutS, chains: value.inits.length, monitors: [...value.monitors],
      },
      names: {
        ...(safeBaseName(value.names?.model) ? { model: safeBaseName(value.names.model) } : {}),
        ...(safeBaseName(value.names?.data) ? { data: safeBaseName(value.names.data) } : {}),
        ...(Array.isArray(value.names?.inits) ? { inits: value.names.inits.map((n) => safeBaseName(n) ?? '') } : {}),
      },
      engineVersion: null, runtimeS: null, files: [],
    };
    current = id;
    records.set(id, rec);
    try { persist(rec); } catch { /* flow persists again */ }
    const controller = new AbortController();
    cancellation.set(id, controller);
    const p = flow(rec, value, controller).catch(() => {});
    flows.set(id, p);
    void p.then(() => flows.delete(id));
    return { id, state: 'queued' };
  }

  function readLog(id) {
    const file = path.join(runDirOf(id), 'log.txt');
    let fd;
    try {
      fd = fs.openSync(file, 'r');
      const size = fs.fstatSync(fd).size;
      const want = Math.min(size, LOG_MAX_BYTES + 1);
      const buf = Buffer.alloc(want);
      const n = fs.readSync(fd, buf, 0, want, 0);
      let truncated = size > LOG_MAX_BYTES;
      let text = buf.subarray(0, Math.min(n, LOG_MAX_BYTES)).toString('latin1');
      let lines = text.split(/\r?\n/);
      if (truncated) lines.pop(); // drop the possibly partial last line
      else if (lines.length && lines[lines.length - 1] === '') lines.pop();
      if (lines.length > LOG_MAX_LINES) { lines = lines.slice(0, LOG_MAX_LINES); truncated = true; }
      return { lines: lines.map((l) => scrub(l.replace(/[^\x09\x20-\x7E]/g, '?'))), truncated };
    } catch {
      return { lines: [], truncated: false };
    } finally {
      if (fd !== undefined) try { fs.closeSync(fd); } catch { /* ignore */ }
    }
  }

  function getRun(id) {
    if (!isRunId(id)) return null;
    const rec = records.get(id);
    if (!rec) return null;
    const finalizing = rec.finalizing === true;
    return {
      id: rec.id,
      state: finalizing ? 'running' : rec.state,
      reason: finalizing ? 'The run is being finished: collecting files and the summary.' : scrub(rec.reason),
      settings: rec.request,
      engine: rec.engine ?? 'openbugs',
      workflow: rec.workflow ?? 'bugs',
      comparison: rec.comparison ?? null,
      engineVersion: rec.engineVersion ?? null,
      runtimeS: rec.runtimeS ?? null,
      createdAt: rec.createdAt,
      files: rec.files.map((f) => ({ name: f.name, bytes: f.bytes, sha256: f.sha256 })),
      log: readLog(id),
      summary: rec.summary ?? null,
    };
  }

  function getManifest(id) {
    if (!isRunId(id)) return null;
    const rec = records.get(id);
    if (!rec || !TERMINAL.has(rec.state) || rec.finalizing === true) return null;
    try {
      return Buffer.from(scrub(fs.readFileSync(path.join(runDirOf(id), 'manifest.json'), 'utf8')), 'utf8');
    } catch { return null; }
  }

  function getFile(id, name) {
    if (!isRunId(id) || !isSafeFileName(name)) return null;
    const rec = records.get(id);
    if (!rec || !rec.files.some((f) => f.name === name)) return null;
    try {
      const target = path.join(runDirOf(id), name);
      const stat = fs.lstatSync(target);
      if (!stat.isFile() || stat.size > MAX_FILE_BYTES) return null;
      const bytes = fs.readFileSync(target);
      return /\.(npz|bam|png|nii|npy)$/.test(name) ? bytes : Buffer.from(scrub(bytes.toString('latin1')), 'latin1');
    } catch { return null; }
  }

  function getBundle(id, mode) {
    const bytes = getManifest(id);
    if (!bytes) return null;
    const manifest = JSON.parse(bytes.toString('utf8'));
    const files = {};
    if (mode !== 'metadata') {
      let total = 0;
      for (const file of manifest.output_files ?? []) {
        if (mode !== 'inputs' && /^(model|data|inits\d+)\.txt$/.test(file.name)) continue;
        total += file.bytes;
        if (total > 24 * 1024 * 1024) return { tooLarge: true };
        const content = getFile(id, file.name);
        if (content) files[file.name] = { encoding: 'base64', content: content.toString('base64'), sha256: sha256Of(content) };
      }
    }
    const replay = manifest.engine === 'openbugs'
      ? 'Select OpenBUGS on Run and use the recorded settings and inputs. See the README for the image setup.'
      : 'Build the recorded engine image using the README, then select the recorded engine and fixture on Run.';
    const summary = records.get(id)?.summary;
    return { bytes: Buffer.from(JSON.stringify({ schema_version: 1, manifest, replay, summary, files })) };
  }

  return {
    ready, submit, getRun, getManifest, getFile, getBundle, health,
    cancel(id) {
      const controller = cancellation.get(id);
      if (!controller) return false;
      controller.abort();
      return true;
    },
    /** Resolves when every started run has finished its cleanup (tests). */
    async whenIdle() { await Promise.all([...flows.values()]); },
    isBusy: () => current !== null,
    runDirOf,
  };
}
