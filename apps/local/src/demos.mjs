// demos.mjs: demo catalogue and upstream presence check (spec 03-local-product, task 4.1).
// Requirements 9.7, 10.4, 10.5, 10.6. Node built-ins only.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, '..', '..', '..');
export const DEFAULT_UPSTREAM_DIR = path.join(REPO_ROOT, 'local-data', 'upstream');
export const DEFAULT_HASH_FILE = path.join(REPO_ROOT, 'docs', 'evidence', 'input_hashes_upstream_examples.txt');
export const DEFAULT_EXAMPLES_DIR = path.join(REPO_ROOT, 'examples', 'reprolab');

export const SEEDS_FILES = Object.freeze(['Seedsmodel.txt', 'Seedsdata.txt', 'Seedsinits1.txt', 'Seedsinits2.txt']);
export const SEEDS_TITLE = 'Seeds (your own upstream copy)';
export const SEEDS_LABEL = 'Historical example. Its pre-declared comparison with the published values failed; see the recorded evidence on the public site.';
export const SEEDS_HOWTO = 'Seeds is not included. Download the OpenBUGS tarball yourself, then run scripts/extract-seeds.ps1 (or .sh) with its path to place the four Seeds files in local-data/upstream/.';

const readText = (p) => fs.readFileSync(p, 'utf8');

/** Parse "<sha256>  <name>" lines into a Map of name to lower-case hash. */
export function parseHashFile(text) {
  const map = new Map();
  for (const line of String(text).split(/\r?\n/)) {
    const m = /^([0-9a-fA-F]{64})\s+\*?(\S+)\s*$/.exec(line.trim());
    if (m) map.set(m[2], m[1].toLowerCase());
  }
  return map;
}

function coinRequest(dir, model) {
  return {
    model: readText(path.join(dir, model)),
    data: readText(path.join(path.dirname(dir), 'coin', 'data.txt')),
    inits: [readText(path.join(path.dirname(dir), 'coin', 'inits1.txt')), readText(path.join(path.dirname(dir), 'coin', 'inits2.txt'))],
    monitors: ['p'],
    burnIn: 1000,
    samples: 10000,
    thin: 1,
    seed: 1,
    timeoutS: 120,
    chains: 2,
  };
}

/** Returns the Seeds demo entry: with `request` when present and verified, else with `missingReason`. */
function seedsEntry({ upstreamDir, hashFile }) {
  const base = { id: 'seeds-upstream', title: SEEDS_TITLE, kind: 'upstream', label: SEEDS_LABEL };
  let expected;
  try {
    expected = parseHashFile(readText(hashFile));
  } catch {
    return { ...base, missingReason: 'The recorded hash list could not be read, so the Seeds files cannot be checked.' };
  }
  const missing = [];
  const wrong = [];
  const texts = {};
  for (const name of SEEDS_FILES) {
    const want = expected.get(name);
    if (!want) {
      wrong.push(name);
      continue;
    }
    let buf;
    try {
      buf = fs.readFileSync(path.join(upstreamDir, name));
    } catch {
      missing.push(name);
      continue;
    }
    if (crypto.createHash('sha256').update(buf).digest('hex') !== want) wrong.push(name);
    else texts[name] = buf.toString('utf8');
  }
  if (missing.length || wrong.length) {
    const parts = [];
    if (missing.length) parts.push(`missing: ${missing.join(', ')}`);
    if (wrong.length) parts.push(`does not match the recorded hash: ${wrong.join(', ')}`);
    return { ...base, missingReason: `${SEEDS_HOWTO} (${parts.join('; ')})` };
  }
  return {
    ...base,
    request: {
      model: texts['Seedsmodel.txt'],
      data: texts['Seedsdata.txt'],
      inits: [texts['Seedsinits1.txt'], texts['Seedsinits2.txt']],
      monitors: ['alpha0', 'alpha1', 'alpha2', 'alpha12', 'sigma'],
      burnIn: 1000,
      samples: 10000,
      thin: 1,
      seed: 1,
      timeoutS: 300,
      chains: 2,
    },
  };
}

/**
 * Build the demo list. Seeds appears with a `request` only when all four files verify;
 * otherwise it carries `missingReason` and no `request`.
 */
export function listDemos(opts = {}) {
  const examplesDir = opts.examplesDir ?? DEFAULT_EXAMPLES_DIR;
  const upstreamDir = opts.upstreamDir ?? DEFAULT_UPSTREAM_DIR;
  const hashFile = opts.hashFile ?? DEFAULT_HASH_FILE;
  const coinDir = path.join(examplesDir, 'coin');
  const badDir = path.join(examplesDir, 'coin-invalid');
  return [
    { id: 'coin', title: 'Coin (ReproLab example, known answer)', kind: 'reprolab', request: coinRequest(coinDir, 'model.txt') },
    { id: 'coin-invalid', title: 'Coin with a deliberate syntax error', kind: 'invalid', request: coinRequest(badDir, 'model.txt') },
    seedsEntry({ upstreamDir, hashFile }),
  ];
}
