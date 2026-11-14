#!/usr/bin/env node
// Tracked-file audit (spec 03, Requirement 20). Fails when the repository tracks
// something it must not publish. Uses only Node built-ins.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const MAX_BYTES = 5 * 1024 * 1024;
const BAD_EXT = ['.tar.gz', '.tgz', '.tar', '.zip', '.so', '.dll', '.exe', '.odc', '.bmp'];
const BAD_PREFIX = ['vendor/', 'local-data/', 'runs/'];
const HASH_LIST = 'docs/evidence/input_hashes_upstream_examples.txt';

// Built from pieces so this file never contains a literal match.
const CREDENTIALS = [
  ['private key header', new RegExp('-----BEGIN ' + '(?:[A-Z]+ )*PRIVATE KEY-----')],
  ['sk- token', new RegExp('\\bsk' + '-\\w{20,}')],
  ['bearer token', new RegExp('Bearer ' + '\\w{20,}')],
  // Env-file/shell style (`NAME=value`) or any quoted literal. A bare identifier on the
  // right of `:` or `=` inside code is a variable reference, not a secret.
  ['REPROLAB_LLM_API_KEY value', new RegExp(
    'REPROLAB_LLM_API_KEY' + '(?:=(?![\\s$<{"\'`])[^\\s#]+|\\s*[=:]\\s*(?:"[^"$]+"|\'[^\'$]+\'))',
  )],
];

// Home-directory style paths with a concrete user name. Placeholders are allowed.
const MACHINE_PATH = new RegExp(
  '(?:\\b[A-Za-z]:[\\\\/]+Users[\\\\/]+|/home/|/Users/)([A-Za-z0-9._-]+)',
  'g',
);
const PLACEHOLDER = /^(?:user|username|you|name|me|runner|node|app|<.*|\$.*|%.*|redacted|example|your.*|\.\.\.|x+)$/i;

export function isTextBuffer(buf) {
  return !buf.subarray(0, 8000).includes(0);
}

function lower(p) { return p.toLowerCase(); }

/**
 * @param {object} o
 * @param {string[]} o.files tracked paths, forward slashes
 * @param {(p:string)=>Buffer} o.readFile
 * @param {(p:string)=>number} o.sizeOf
 * @param {Map<string,string>} [o.upstream] lower-case base name -> sha256
 * @returns {{rule:string,file:string,detail:string}[]}
 */
export function audit({ files, readFile, sizeOf, upstream = new Map() }) {
  const out = [];
  const add = (rule, file, detail) => out.push({ rule, file, detail });
  for (const file of files) {
    const lf = lower(file);
    const ext = BAD_EXT.find((e) => lf.endsWith(e));
    if (ext) add('forbidden-extension', file, `extension ${ext}`);
    const pre = BAD_PREFIX.find((p) => lf.startsWith(p));
    if (pre) add('forbidden-path', file, `under ${pre}`);
    let size = 0;
    try { size = sizeOf(file); } catch { /* file listed but missing */ }
    if (size > MAX_BYTES) add('too-large', file, `${size} bytes`);
    let buf = null;
    try { buf = readFile(file); } catch { /* unreadable */ }
    if (!buf) continue;
    const base = path.posix.basename(lf);
    const want = upstream.get(base);
    if (want && createHash('sha256').update(buf).digest('hex') === want) {
      add('upstream-example', file, 'name and SHA-256 match an upstream example');
    }
    if (!isTextBuffer(buf)) continue;
    const text = buf.toString('utf8');
    for (const [label, re] of CREDENTIALS) {
      if (re.test(text)) add('credential', file, label);
    }
    for (const m of text.matchAll(MACHINE_PATH)) {
      if (!PLACEHOLDER.test(m[1])) { add('machine-path', file, 'home-directory path with a user name'); break; }
    }
  }
  return out;
}

export function parseUpstreamHashes(text) {
  const map = new Map();
  for (const line of text.split(/\r?\n/)) {
    const m = /^([0-9a-f]{64})\s+\*?(.+?)\s*$/i.exec(line);
    if (m) map.set(path.posix.basename(m[2].replace(/\\/g, '/')).toLowerCase(), m[1].toLowerCase());
  }
  return map;
}

export function auditRepo(root) {
  const raw = execFileSync('git', ['ls-files', '-z'], { cwd: root, maxBuffer: 64 * 1024 * 1024 });
  const files = raw.toString('utf8').split('\0').filter(Boolean);
  let upstream = new Map();
  try { upstream = parseUpstreamHashes(readFileSync(path.join(root, HASH_LIST), 'utf8')); } catch { /* none */ }
  const abs = (p) => path.join(root, p);
  const findings = audit({
    files,
    readFile: (p) => readFileSync(abs(p)),
    sizeOf: (p) => statSync(abs(p)).size,
    upstream,
  });
  return { files, findings };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const { files, findings } = auditRepo(root);
  console.log(`Tracked-file audit: ${files.length} tracked files checked.`);
  for (const f of findings) console.log(`FAIL [${f.rule}] ${f.file}: ${f.detail}`);
  console.log(findings.length ? `Result: FAIL (${findings.length} findings)` : 'Result: PASS');
  process.exit(findings.length ? 1 : 0);
}
