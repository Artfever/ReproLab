// Test-only fake of the src/docker.mjs surface used by src/runs.mjs. It never starts a process.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');

/** A Runner-style manifest for `files` (name -> text). */
export function runnerManifest(status, reason, files, extra = {}) {
  const entries = {};
  for (const [n, t] of Object.entries(files)) entries[n] = { sha256: sha(Buffer.from(t)), bytes: Buffer.byteLength(t) };
  return {
    status, reason, argv: ['/opt/openbugs/bin/OpenBUGS', '-t', 'script.txt'], script: "modelSetWD('/work/out')\n",
    exit_code: status === 'timed_out' ? null : 0, runtime_s: 1.5, engine_version: '3.2.3 rev 1012',
    image_digest: 'x', settings: { burn_in: 1 }, n_chains: 2, files: entries, ...extra,
  };
}

/**
 * @param {{docker?: {status: string}, image?: {present: boolean, id?: string},
 *          behaviour?: object|((name: string) => object), summaryStdout?: string, summaryCode?: number,
 *          createCode?: number}} [cfg]
 * behaviour: {files: {name: text}, manifest: object|null, timedOut: bool, gate: Promise, stderr, stdout, cpOutCode}
 */
export function createFakeDocker(cfg = {}) {
  const calls = [];
  const live = new Set();
  const state = {
    docker: cfg.docker ?? { status: 'ok' },
    image: cfg.image ?? { present: true, id: 'sha256:' + 'ab'.repeat(32) },
    behaviour: cfg.behaviour ?? {},
    summaryStdout: cfg.summaryStdout ?? JSON.stringify({ p: { mean: 0.6667, sd: 0.13 } }),
    summaryCode: cfg.summaryCode ?? 0,
    createCode: cfg.createCode ?? 0,
  };
  const rec = (op, name, extra) => calls.push({ op, name, ...extra });
  const behaviourFor = () => (typeof state.behaviour === 'function' ? state.behaviour() : state.behaviour);
  const ok = { code: 0, stdout: '', stderr: '', timedOut: false };

  const api = {
    calls, state, live,
    async checkDocker() { rec('checkDocker'); return state.docker; },
    async checkImage(tag) { rec('checkImage', tag); return state.image; },
    async removeStaleContainers() { rec('removeStale'); return { removed: 0 }; },
    async createContainer(spec) {
      rec('create', spec.name, { spec });
      if (state.createCode !== 0) return { ...ok, code: state.createCode, stderr: 'create failed in C:\\secret' };
      live.add(spec.name);
      return ok;
    },
    async cpIn(name, dir) { rec('cpIn', name, { files: fs.readdirSync(dir).sort() }); return ok; },
    async startAttached(name, opts) {
      rec('start', name, { timeoutMs: opts.timeoutMs });
      if (name.endsWith('-sum')) return { ...ok, code: state.summaryCode, stdout: state.summaryStdout };
      const b = behaviourFor();
      if (b.gate) await b.gate;
      return { code: b.timedOut ? null : 0, stdout: b.stdout ?? '', stderr: b.stderr ?? '', timedOut: Boolean(b.timedOut) };
    },
    async kill(name) { rec('kill', name); return ok; },
    async removeForce(name) { rec('remove', name); live.delete(name); return ok; },
    async cpOut(name, dest) {
      rec('cpOut', name, { dest });
      const b = behaviourFor();
      if (b.cpOutCode) return { ...ok, code: b.cpOutCode, stderr: 'no such path' };
      for (const [n, t] of Object.entries(b.files ?? {})) fs.writeFileSync(path.join(dest, n), t);
      if (b.manifest) fs.writeFileSync(path.join(dest, 'manifest.json'), JSON.stringify(b.manifest));
      return ok;
    },
    ops: (op) => calls.filter((c) => c.op === op),
  };
  return api;
}
