// docker.mjs: the only module that imports node:child_process.
// Spec 03-local-product, Requirements 5.1, 5.2, 5.3, 5.5, 5.6, 5.7, 5.12.
// Every call is spawn('docker', argsArray, {shell: false}). Arguments come from the fixed flag list
// below plus values the server validated (run id, fixed file paths, numbers). Nothing from a client
// is used as a command, an image or a path.

import { spawn } from 'node:child_process';
import { isRunId } from './sanitize.mjs';

export const DEFAULT_IMAGE = 'reprolab-openbugs:3.2.3-vendored';
export const RUN_LABEL = 'reprolab.run';
const DOCKER_BIN = 'docker';
const MAX_CAPTURE_BYTES = 1024 * 1024;
const NAME_RE = /^rl-[0-9a-f]{32}(-[a-z]{1,16})?$/;
const IMAGE_ID_RE = /^sha256:[0-9a-f]{64}$/;
const IMAGE_RE = /^[A-Za-z0-9][A-Za-z0-9._\-/:@]{0,199}$/;
const versionProbes = new Map();

/** Requirement 5.2, in the order of design.md. The run label and name are added separately. */
export const SECURITY_FLAGS = Object.freeze([
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
]);

/** The image tag comes from the environment only. */
export function resolveImage(env = process.env) {
  const value = env.REPROLAB_IMAGE;
  const image = value === undefined || value === '' ? DEFAULT_IMAGE : value;
  if (!IMAGE_RE.test(image) || image.startsWith('-')) {
    throw new Error('REPROLAB_IMAGE is not a valid image name.');
  }
  return image;
}

export function containerName(runId, suffix) {
  if (!isRunId(runId)) throw new Error('Invalid run id.');
  const name = suffix ? `rl-${runId}-${suffix}` : `rl-${runId}`;
  if (!NAME_RE.test(name)) throw new Error('Invalid container name.');
  return name;
}

function assertName(name) {
  if (typeof name !== 'string' || !NAME_RE.test(name)) throw new Error('Invalid container name.');
}

/**
 * Argument array for `docker create`.
 * @param {{runId: string, name?: string, image: string, imageId?: string|null, command: string[]}} spec
 */
export function buildCreateArgs(spec) {
  if (!isRunId(spec.runId)) throw new Error('Invalid run id.');
  const name = spec.name ?? containerName(spec.runId);
  assertName(name);
  if (typeof spec.image !== 'string' || !IMAGE_RE.test(spec.image) || spec.image.startsWith('-')) {
    throw new Error('Invalid image name.');
  }
  if (!Array.isArray(spec.command) || spec.command.some((c) => typeof c !== 'string')) {
    throw new Error('Invalid container command.');
  }
  let imageId = null;
  if (spec.imageId !== undefined && spec.imageId !== null) {
    if (typeof spec.imageId !== 'string' || !IMAGE_ID_RE.test(spec.imageId)) throw new Error('Invalid image id.');
    imageId = spec.imageId;
  }
  return [
    'create',
    '--name', name,
    '--label', `${RUN_LABEL}=${spec.runId}`,
    ...SECURITY_FLAGS,
    // The manifest's image_digest is the real local image ID, never the run id.
    ...(imageId ? ['-e', `REPROLAB_IMAGE_DIGEST=${imageId}`] : []),
    spec.image,
    ...spec.command,
  ];
}

/**
 * Run `docker <args>` with no shell. Output is captured up to a byte cap.
 * @returns {Promise<{code: number|null, stdout: string, stderr: string, timedOut: boolean, spawnError?: string}>}
 */
export function runDocker(args, { timeoutMs = 60000, input, maxBytes = MAX_CAPTURE_BYTES, signal } = {}) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(DOCKER_BIN, args, { shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (err) {
      resolve({ code: null, stdout: '', stderr: '', timedOut: false, spawnError: err.code ?? 'SPAWN_FAILED' });
      return;
    }
    const out = [];
    const errs = [];
    let outBytes = 0;
    let errBytes = 0;
    let timedOut = false;
    let spawnError;
    let settled = false;
    const collect = (chunks, chunk, used) => {
      const room = maxBytes - used;
      if (room <= 0) return used;
      const piece = chunk.length > room ? chunk.subarray(0, room) : chunk;
      chunks.push(piece);
      return used + piece.length;
    };
    child.stdout.on('data', (c) => { outBytes = collect(out, c, outBytes); });
    child.stderr.on('data', (c) => { errBytes = collect(errs, c, errBytes); });
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);
    const abort = () => child.kill('SIGKILL');
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    const finish = (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      resolve({
        code,
        stdout: Buffer.concat(out).toString('utf8'),
        stderr: Buffer.concat(errs).toString('utf8'),
        timedOut,
        ...(spawnError ? { spawnError } : {}),
      });
    };
    child.on('error', (err) => { spawnError = err.code ?? 'SPAWN_FAILED'; finish(null); });
    child.on('close', (code) => finish(code));
    child.stdin.on('error', () => {});
    if (input !== undefined) child.stdin.end(input);
    else child.stdin.end();
  });
}

/** @returns {Promise<{status: 'ok'|'missing'|'not_running', detail?: string}>} */
export async function checkDocker() {
  const r = await runDocker(['version', '--format', '{{.Server.Version}}'], { timeoutMs: 15000 });
  if (r.spawnError === 'ENOENT') return { status: 'missing' };
  if (r.code === 0 && r.stdout.trim() !== '') return { status: 'ok' };
  if (r.timedOut || r.code !== 0 || r.spawnError) return { status: 'not_running' };
  return { status: 'not_running' };
}

/** @returns {Promise<{present: boolean, id?: string}>} */
export async function checkImage(tag) {
  if (typeof tag !== 'string' || !IMAGE_RE.test(tag) || tag.startsWith('-')) return { present: false };
  const r = await runDocker(['image', 'inspect', '--format', '{{.Id}}', tag], { timeoutMs: 15000 });
  if (r.code === 0 && r.stdout.trim() !== '') return { present: true, id: r.stdout.trim() };
  return { present: false };
}

export async function probeEngine(imageId, command, version) {
  if (!IMAGE_ID_RE.test(imageId)) return false;
  const key = JSON.stringify([imageId, command, version]);
  const cached = versionProbes.get(key);
  if (cached && Date.now() < cached.expiresAt) return cached.result;
  const result = runDocker([
    'run', '--rm', '--pull=never', ...SECURITY_FLAGS, imageId,
    ...(command ?? ['sh', '-c', 'printf "modelQuit()\\n" | OpenBUGS']),
  ], { timeoutMs: 15000, maxBytes: 8192 }).then((run) => run.code === 0 && (command
    ? run.stdout.trim().split(/\r?\n/).at(-1) === version
    : run.stdout.includes(version)));
  if (versionProbes.size >= 32) versionProbes.delete(versionProbes.keys().next().value);
  versionProbes.set(key, { result, expiresAt: Date.now() + 60000 });
  return result;
}

/** `docker create` with the fixed flag list. Resolves with the runDocker result. */
export function createContainer(spec) {
  return runDocker(buildCreateArgs(spec), { timeoutMs: 60000 });
}

/** Copy the contents of a host staging directory into /work/in of the container. */
export function cpIn(name, stagingDir) {
  assertName(name);
  if (typeof stagingDir !== 'string' || stagingDir === '' || stagingDir.startsWith('-')) {
    throw new Error('Invalid staging directory.');
  }
  const src = stagingDir.endsWith('/') || stagingDir.endsWith('\\') ? `${stagingDir}.` : `${stagingDir}/.`;
  return runDocker(['cp', src, `${name}:/work/in`], { timeoutMs: 60000 });
}

/** Copy /work/out of the container into a host directory. */
export function cpOut(name, destDir, from = '/work/out') {
  assertName(name);
  if (from !== '/work/out' && from !== '/work/in') throw new Error('Invalid container path.');
  if (typeof destDir !== 'string' || destDir === '' || destDir.startsWith('-')) {
    throw new Error('Invalid destination directory.');
  }
  return runDocker(['cp', `${name}:${from}/.`, destDir], { timeoutMs: 60000 });
}

/** `docker start -a`. The caller applies the wall-clock cap by passing timeoutMs. */
export function startAttached(name, { timeoutMs, signal }) {
  assertName(name);
  return runDocker(['start', '-a', name], { timeoutMs, signal });
}

export function kill(name) {
  assertName(name);
  return runDocker(['kill', name], { timeoutMs: 15000 });
}

export function removeForce(name) {
  assertName(name);
  return runDocker(['rm', '-f', '-v', name], { timeoutMs: 30000 });
}

/** Remove containers labelled reprolab.run left by an earlier process (Requirement 5.11). */
export async function removeStaleContainers() {
  const r = await runDocker(['ps', '-a', '-q', '--filter', `label=${RUN_LABEL}`], { timeoutMs: 15000 });
  if (r.code !== 0) return { removed: 0 };
  const ids = r.stdout.split(/\s+/).filter((s) => /^[0-9a-f]{12,64}$/.test(s));
  for (const id of ids) await runDocker(['rm', '-f', '-v', id], { timeoutMs: 30000 });
  return { removed: ids.length };
}
