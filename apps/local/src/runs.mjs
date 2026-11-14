// runs.mjs: run lifecycle, Run_Dir persistence and manifest (spec 03-local-product, task 3.3).
// Requirements 5.8 to 5.11, 6.1 to 6.10, 7.1 to 7.7, 8.2.
// Node built-ins only. This module never spawns a process: every Docker call goes through the
// injected `docker` object (src/docker.mjs in production, a fake in tests).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { scrubPaths, safeBaseName, isRunId, isSafeFileName } from './sanitize.mjs';
import { containerName, resolveImage } from './docker.mjs';

export const RUN_STATES = Object.freeze(['queued', 'running', 'succeeded', 'engine_error', 'timed_out', 'runner_error']);
export const LOG_MAX_LINES = 2000;
export const LOG_MAX_BYTES = 256 * 1024;
export const CAP_MARGIN_S = 30;
export const SUMMARY_LABEL = 'Computed by ReproLab from the exported samples. Not a convergence or validity claim.';
export const BUSY_MESSAGE = 'One run at a time is supported. Wait for the current run to finish, then try again.';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..', '..');
const HIDDEN_FILES = new Set(['state.json', 'manifest.json', 'summary.json']);
const TERMINAL = new Set(['succeeded', 'engine_error', 'timed_out', 'runner_error']);
const STATUS_TO_STATE = { succeeded: 'succeeded', failed: 'engine_error', timed_out: 'timed_out' };
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
          rec.state = 'runner_error';
          rec.reason = 'The local server restarted while this run was in progress. Start the run again.';
          rec.finishedAt = now().toISOString();
          try { persist(rec); } catch { /* keep the in-memory correction */ }
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

  async function dockerPreflight() {
    const d = await docker.checkDocker();
    if (d.status === 'missing') return { ok: false, reason: 'Docker is not installed. Install Docker Desktop, then try again.' };
    if (d.status !== 'ok') return { ok: false, reason: 'Docker is not running. Start Docker Desktop and try again.' };
    const img = await docker.checkImage(image);
    if (!img.present) {
      return { ok: false, reason: `The image ${image} does not exist on this machine. Build it with the build-image script, then try again.` };
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
    fs.writeFileSync(path.join(dir, 'model.txt'), value.model, 'ascii');
    fs.writeFileSync(path.join(dir, 'data.txt'), value.data, 'ascii');
    value.inits.forEach((t, i) => fs.writeFileSync(path.join(dir, `inits${i + 1}.txt`), t, 'ascii'));
    return dir;
  }

  function runnerCommand(value) {
    return [
      'python3', '-m', 'reprolab_runner.cli', 'run',
      '--model', '/work/in/model.txt',
      '--data', '/work/in/data.txt',
      '--inits', ...value.inits.map((_, i) => `/work/in/inits${i + 1}.txt`),
      '--monitor', ...value.monitors,
      '--burn-in', String(value.burnIn),
      '--samples', String(value.samples),
      '--thin', String(value.thin),
      '--seed', String(value.seed),
      '--timeout', String(value.timeoutS),
      '--out', '/work/out',
    ];
  }

  function listOutputFiles(dir) {
    const out = [];
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
    for (const e of entries.sort((a, b) => (a.name < b.name ? -1 : 1)).slice(0, MAX_FILES)) {
      if (!e.isFile() || HIDDEN_FILES.has(e.name) || !isSafeFileName(e.name)) continue;
      const full = path.join(dir, e.name);
      const st = fs.statSync(full);
      if (st.size > MAX_FILE_BYTES) continue;
      out.push({ name: e.name, bytes: st.size, sha256: sha256Of(fs.readFileSync(full)) });
    }
    return out;
  }

  function readRunnerManifest(dir) {
    try {
      const m = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
      if (m && typeof m === 'object' && !Array.isArray(m) && typeof m.status === 'string') return m;
    } catch { /* absent or unreadable */ }
    return null;
  }

  async function computeSummary(rec, dir, created) {
    const codaFiles = fs.readdirSync(dir).filter((n) => /^coda_[A-Za-z0-9_.-]+\.txt$/.test(n));
    if (codaFiles.length === 0) return { available: false, reason: 'No CODA files were found, so no summary was computed.' };
    const sumStage = path.join(tmpDir, `${rec.id}-sum`);
    try {
      fs.mkdirSync(sumStage, { recursive: true });
      for (const n of codaFiles) fs.copyFileSync(path.join(dir, n), path.join(sumStage, n));
      const name = containerName(rec.id, 'sum');
      const c = await docker.createContainer({
        runId: rec.id, name, image,
        command: ['python3', '-m', 'reprolab_runner.cli', 'summarize', '--dir', '/work/in'],
      });
      if (c.code !== 0) return { available: false, reason: 'The summary container could not be created.' };
      created.push(name);
      const cp = await docker.cpIn(name, sumStage);
      if (cp.code !== 0) return { available: false, reason: 'The exported samples could not be copied into the summary container.' };
      const r = await docker.startAttached(name, { timeoutMs: 60000 });
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

  async function flow(rec, value) {
    const created = [];
    const dir = runDirOf(rec.id);
    let staging = null;
    let capped = false;
    let tail = '';
    let imageId = null;
    let runner = null;
    try {
      // While `finalizing` is true, readers see `running`: the outcome is only final once the
      // summary, the file list, the manifest and the container cleanup are all done.
      rec.finalizing = true;
      rec.state = 'running';
      rec.startedAt = now().toISOString();
      persist(rec);

      const pre = await dockerPreflight();
      if (!pre.ok) { rec.state = 'runner_error'; rec.reason = pre.reason; return; }
      imageId = pre.imageId;

      staging = stageInputs(rec.id, value);
      const name = containerName(rec.id);
      const c = await docker.createContainer({ runId: rec.id, name, image, imageId, command: runnerCommand(value) });
      if (c.code !== 0) {
        rec.state = 'runner_error';
        rec.reason = scrub(`Docker could not create the container. ${lastLines(c.stderr ?? '', 5).join(' ')}`.trim());
        return;
      }
      created.push(name);
      const cin = await docker.cpIn(name, staging);
      if (cin.code !== 0) {
        rec.state = 'runner_error';
        rec.reason = scrub(`The input files could not be copied into the container. ${lastLines(cin.stderr ?? '', 5).join(' ')}`.trim());
        return;
      }
      const started = await docker.startAttached(name, { timeoutMs: (value.timeoutS + CAP_MARGIN_S) * 1000 });
      if (started.timedOut) {
        capped = true;
        await docker.kill(name);
      }
      tail = scrub(lastLines(`${started.stderr ?? ''}\n${started.stdout ?? ''}`, 20).join(' | '));
      fs.mkdirSync(dir, { recursive: true });
      const out = await docker.cpOut(name, dir);
      runner = out.code === 0 ? readRunnerManifest(dir) : null;

      if (capped) {
        rec.state = 'runner_error';
        rec.reason = 'Stopped by the server time limit.';
      } else if (!runner) {
        rec.state = 'runner_error';
        rec.reason = `The container finished without a readable run manifest.${tail ? ` Last output: ${tail}` : ''}`;
      } else {
        // Requirement 6.6: the state comes from the Runner's classification, never an exit code.
        rec.state = STATUS_TO_STATE[runner.status] ?? 'runner_error';
        rec.reason = scrub(typeof runner.reason === 'string' ? runner.reason : 'The Runner gave no reason.');
        if (!STATUS_TO_STATE[runner.status]) rec.reason = `The run manifest has an unknown status. ${rec.reason}`;
        rec.engineVersion = typeof runner.engine_version === 'string' ? scrub(runner.engine_version) : null;
        rec.runtimeS = typeof runner.runtime_s === 'number' ? runner.runtime_s : null;
      }

      if (rec.state === 'succeeded') {
        rec.summary = await computeSummary(rec, dir, created);
        fs.writeFileSync(path.join(dir, 'summary.json'), JSON.stringify(rec.summary));
      }
    } catch (err) {
      rec.state = 'runner_error';
      rec.reason = scrub(`The local server could not complete the run: ${err?.message ?? err}`);
    } finally {
      for (const n of created) {
        try { await docker.removeForce(n); } catch { /* best effort; stale cleanup runs at next start */ }
      }
      if (staging) fs.rmSync(staging, { recursive: true, force: true });
      try {
        fs.mkdirSync(dir, { recursive: true });
        rec.files = listOutputFiles(dir);
        rec.finishedAt = now().toISOString();
        const manifest = buildManifest(rec, runner, value, imageId);
        fs.writeFileSync(path.join(dir, 'manifest.json'), scrub(JSON.stringify(manifest, null, 2)) + '\n');
        rec.finalizing = false;
        persist(rec);
      } catch (err) {
        rec.finalizing = false;
        rec.reason = scrub(`${rec.reason ?? ''} (The run record could not be saved: ${err?.message ?? err})`);
      }
      current = null;
    }
  }

  /** Start a validated Run_Request. Returns {busy:true} when a run is queued or running. */
  async function submit(value) {
    await ready;
    if (current) return { busy: true };
    const id = newId();
    const rec = {
      id, state: 'queued', reason: 'Waiting to start.', createdAt: now().toISOString(), startedAt: null, finishedAt: null,
      request: {
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
    const p = flow(rec, value).catch(() => {});
    flows.set(id, p);
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
      return Buffer.from(scrub(fs.readFileSync(path.join(runDirOf(id), name), 'latin1')), 'latin1');
    } catch { return null; }
  }

  return {
    ready, submit, getRun, getManifest, getFile, health,
    /** Resolves when every started run has finished its cleanup (tests). */
    async whenIdle() { await Promise.all([...flows.values()]); },
    isBusy: () => current !== null,
    runDirOf,
  };
}
