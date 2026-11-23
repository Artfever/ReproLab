// Acceptance check for task 11.4 (spec 03-local-product, Requirement 19):
// everything the root README names must exist in the repository, the required sections must be present,
// and the README must not overclaim about the tarball or the mirror.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_IMAGE } from '../src/docker.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..', '..');
const localApp = path.join(root, 'apps', 'local');
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8').replace(/\r\n/g, '\n');

const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');
const exists = (rel) => fs.existsSync(path.join(root, rel));

// Fenced blocks and inline spans.
const fenced = [...readme.matchAll(/```[A-Za-z]*\n([\s\S]*?)```/g)].map((m) => m[1]);
const prose = readme.replace(/```[A-Za-z]*\n[\s\S]*?```/g, '');
const spans = [...prose.matchAll(/`([^`\n]+)`/g)].map((m) => m[1]);
const codeLines = fenced.flatMap((b) => b.split('\n'));

const scriptsText = [path.join(root, 'scripts'), path.join(localApp, 'scripts')]
  .flatMap((dir) => fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile()).map((entry) => fs.readFileSync(path.join(dir, entry.name), 'utf8')))
  .join('\n');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'evidence') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else if (/\.(mjs|js|ps1|sh)$/.test(e.name)) out.push(p);
  }
  return out;
}
const sourceText = [path.join(localApp, 'src'), path.join(localApp, 'assistant')]
  .flatMap((d) => walk(d)).map((f) => fs.readFileSync(f, 'utf8')).join('\n');

// ---------- paths, scripts ----------

const NOT_IN_GIT = /^(vendor|local-data)(\/|$)/; // git-ignored by design; the README says so
// Names with a slash that are not repository paths: the Docker platform, the GitHub mirror, the clone folder.
const NOT_PATHS = new Set(['linux/amd64', 'chjackson/openbugsdoc', 'ReproLab']);
const TESTED_HASH = 'a289c4da0c4ac371f8013226c85ebd0a9e1dec5de9b858950e4854cb814b4ed8';

function pathCandidates() {
  const out = new Set();
  for (const s of spans) {
    if (/\s/.test(s) || !/[\\/]/.test(s)) continue;
    if (/^(https?:|\$|-|\/api)/.test(s) || /[<>*{}]|\.\.\./.test(s)) continue;
    out.add(s.replace(/\\/g, '/').replace(/^\.\//, ''));
  }
  const all = `${prose}\n${codeLines.join('\n')}`;
  for (const m of all.matchAll(/\bscripts[\\/](?:tests[\\/])?[\w.-]+\.(?:ps1|sh|mjs)\b/g)) out.add(m[0].replace(/\\/g, '/'));
  for (const l of codeLines) {
    const cd = l.match(/^cd\s+(\S+)/);
    if (cd) out.add(cd[1].replace(/\\/g, '/'));
    const tar = l.match(/(?:-Tarball\s+)?(vendor[\\/]OpenBUGS-3\.2\.3\.tar\.gz)/);
    if (tar) out.add(tar[1].replace(/\\/g, '/'));
  }
  return [...out];
}

test('README names a reasonable number of repository paths (guards against an empty extraction)', () => {
  assert.ok(pathCandidates().length >= 30, `only ${pathCandidates().length} candidates`);
});

test('every path, script and folder named in the README exists (git-ignored vendor/ and local-data/ excepted)', () => {
  const missing = pathCandidates().filter((p) => {
    if (NOT_IN_GIT.test(p) || NOT_PATHS.has(p)) return false;
    // Short names in the repository map ("src/", "public/") are relative to apps/local; "local-product/" to docs/evidence.
    return !(exists(p) || fs.existsSync(path.join(localApp, p)) || exists(`docs/evidence/${p}`));
  });
  assert.deepEqual(missing, []);
});

test('every script the README runs is one of the scripts in scripts/', () => {
  const named = new Set([...readme.matchAll(/\bscripts[\\/](?:tests[\\/])?([\w.-]+\.(?:ps1|sh|mjs))\b/g)].map((m) => m[1]));
  for (const base of ['build-image', 'start', 'reset-local', 'extract-seeds']) {
    assert.ok(named.has(`${base}.ps1`) && named.has(`${base}.sh`), `${base} .ps1 and .sh are both named`);
  }
  assert.ok(named.has('audit-tracked.mjs') && named.has('check-license.mjs'));
});

// ---------- flags ----------

// A flag is valid if the script text has it literally (bash) or declares the PowerShell parameter ($Name).
function scriptHasFlag(text, flag) {
  const low = text.toLowerCase();
  const f = flag.toLowerCase();
  return low.includes(f) || (!f.startsWith('--') && low.includes(`$${f.slice(1)}`));
}

const HOST_FLAGS = new Set(['-ExecutionPolicy', '-File', '-NoProfile', '--test']);

test('flags used on script command lines exist in that script', () => {
  const lines = [...codeLines, ...spans];
  let checked = 0;
  for (const line of lines) {
    const m = line.match(/scripts[\\/]([\w.-]+\.(?:ps1|sh))\b(.*)$/);
    if (!m) continue;
    const text = read('scripts', m[1]).toLowerCase();
    for (const f of m[2].matchAll(/(?:^|\s)(--?[A-Za-z][\w-]*)/g)) {
      checked += 1;
      assert.ok(scriptHasFlag(text, f[1]), `${f[1]} is not in scripts/${m[1]} (line: ${line})`);
    }
  }
  assert.ok(checked >= 3, `only ${checked} flags checked`);
});

test('flags named on their own in prose exist in a script', () => {
  const flags = new Set();
  for (const s of spans) {
    if (/^(docker|node|npm|git)\b/.test(s)) continue;
    for (const f of s.matchAll(/(?:^|\s)(--?[A-Za-z][\w-]*)(?=\s|$)/g)) if (!HOST_FLAGS.has(f[1])) flags.add(f[1]);
  }
  for (const expected of ['-FetchMirror', '--fetch-mirror', '-DryRun', '--dry-run', '-Tag', '--tag', '-CheckOnly', '--check-only']) {
    assert.ok(flags.has(expected) || readme.includes(expected), `README should mention ${expected}`);
  }
  for (const f of flags) assert.ok(scriptHasFlag(scriptsText, f), `${f} is not used by any script`);
});

// ---------- environment variables and defaults ----------

test('every REPROLAB_ variable in the README is read by the server, a script or a test', () => {
  const vars = new Set(readme.match(/\bREPROLAB_[A-Z_]+\b/g));
  const testsText = walk(here).map((file) => fs.readFileSync(file, 'utf8')).join('\n');
  assert.ok(vars.has('REPROLAB_IMAGE') && vars.has('REPROLAB_PORT') && vars.has('REPROLAB_LLM_BASE_URL'));
  for (const v of vars) assert.ok((sourceText + scriptsText + testsText).includes(v), `${v} is not read anywhere`);
});

test('the default image tag is the same in the server, scripts and README, and no tag has to be passed', () => {
  assert.equal(DEFAULT_IMAGE, 'reprolab-openbugs:3.2.3-vendored');
  for (const f of ['start.ps1', 'start.sh', 'build-image.ps1', 'build-image.sh', 'run-container.ps1']) {
    assert.ok(read('scripts', f).includes(DEFAULT_IMAGE), `scripts/${f} default tag`);
  }
  assert.ok(read('infra', 'openbugs', 'Dockerfile').includes(DEFAULT_IMAGE));
  assert.match(readme, new RegExp(String.raw`\| \`REPROLAB_IMAGE\` \| \`${DEFAULT_IMAGE}\``));
  for (const l of codeLines.filter((x) => /build-image\.(ps1|sh)/.test(x))) assert.ok(!/-Tag|--tag/i.test(l), `quick start passes a tag: ${l}`);
  assert.ok(!/reprolab-openbugs:3\.2\.3(?!-vendored)/.test(readme), 'README still names the old tag');
});

test('npm commands in the README exist in a package.json', () => {
  const pkgs = ['local', 'web'].map((a) => JSON.parse(read('apps', a, 'package.json')).scripts);
  const has = (n) => pkgs.some((s) => s && n in s);
  const used = new Set();
  for (const l of [...codeLines, ...spans]) {
    const m = l.match(/\bnpm(?:\.cmd)?\s+(run\s+)?([\w:-]+)/);
    if (m) used.add(m[1] ? m[2] : m[2]);
  }
  for (const n of used) {
    if (n === 'ci') assert.ok(exists('apps/web/package-lock.json'), 'npm ci needs a lockfile');
    else assert.ok(has(n) || n === 'test' || n === 'start', `npm script ${n} is missing`);
  }
  assert.ok(used.has('test') && used.has('start') && used.has('ci') && used.has('check'));
  const testScript = JSON.parse(read('apps', 'local', 'package.json')).scripts.test;
  assert.ok(readme.includes('node --test "tests/**/*.test.mjs"'));
  assert.equal(testScript, 'node --test "tests/**/*.test.mjs"');
});

// ---------- required sections and wording ----------

test('required sections are present', () => {
  const headings = [...readme.matchAll(/^#{1,4} (.+)$/gm)].map((m) => m[1]);
  const need = [
    /^ReproLab$/, /What this is and is not/, /Product scope and licence/, /Test the real OpenBUGS engine/, /^Prerequisites$/,
    /Manual step/, /^Quick start$/, /Sample runs/, /Coin/, /Seeds/, /Assistant setup/, /^Tests$/, /Expected outputs/,
    /^Limitations$/, /^Troubleshooting$/, /Quick reset/, /How Kiro shaped this/, /^Licence$/,
  ];
  for (const re of need) assert.ok(headings.some((h) => re.test(h)), `missing heading ${re}`);
});

test('prerequisites name Node 24, Docker, Git, PowerShell and the Windows WSL2 / Linux setups', () => {
  const sec = readme.split(/^## Prerequisites$/m)[1].split(/^## /m)[0];
  for (const w of ['Node.js', '24.x', 'Docker', 'WSL2', 'Git', 'PowerShell', 'Python']) assert.ok(sec.includes(w), w);
});

test('the manual tarball download box is a prominent blockquote before the quick start', () => {
  const manual = readme.indexOf('## Manual step');
  const quick = readme.indexOf('## Quick start');
  assert.ok(manual > 0 && manual < quick);
  const box = readme.slice(manual, quick).split('\n').filter((l) => l.startsWith('>')).join('\n');
  assert.match(box, /You must download this file yourself, in a web browser/);
  assert.match(box, /OpenBUGS-3\.2\.3\.tar\.gz/);
  assert.match(box, /vendor\/OpenBUGS-3\.2\.3\.tar\.gz/);
  assert.match(box, /never commit/i);
});

test('the hash is labelled "the copy we tested" and matches what the build scripts check', () => {
  assert.match(readme, /the copy we tested/);
  assert.match(readme, /not a checksum published by upstream/);
  assert.ok(readme.includes(TESTED_HASH));
  assert.ok(read('scripts', 'build-image.ps1').includes(TESTED_HASH));
  assert.ok(read('scripts', 'build-image.sh').includes(TESTED_HASH));
});

test('no invented SourceForge checksum: the only 64-hex value is the tested copy, and no short hashes appear', () => {
  const hex64 = readme.match(/\b[0-9a-f]{64}\b/gi) ?? [];
  assert.ok(hex64.length >= 1 && hex64.every((h) => h === TESTED_HASH), `unexpected hashes: ${hex64}`);
  assert.deepEqual(readme.match(/\b(?:[0-9a-f]{32}|[0-9a-f]{40})\b/gi) ?? [], []);
  assert.match(readme, /SourceForge publishes no checksum/);
});

test('the mirror is described as unauthenticated and never as authenticated or official', () => {
  assert.match(readme, /unauthenticated mirror copy/);
  assert.match(readme, /not upstream-verified/);
  assert.doesNotMatch(readme, /(?<!un)authenticated/i);
  assert.doesNotMatch(readme, /official mirror|trusted mirror|verified mirror/i);
  assert.match(readme, /off by default/);
});

test('troubleshooting covers Docker not running, image missing, port in use and the WSL seek problem', () => {
  const sec = readme.split(/^## Troubleshooting$/m)[1].split(/^## /m)[0];
  assert.match(sec, /installed but not running/);
  assert.match(sec, /is not present/);
  assert.match(sec, /Port in use/);
  assert.match(sec, /seek/i);
  assert.match(sec, /bind mount/);
});

test('scope statements: ReproLab licence and testable OpenBUGS engine', () => {
  assert.match(readme, /project owner authorizes reuse, modification and redistribution of ReproLab-authored code under the MIT terms/);
  assert.match(readme, /OpenBUGS 3\.2\.3 is included in ReproLab's local execution stack as its third-party inference engine/);
  assert.match(readme, /Test the real OpenBUGS engine/);
  assert.match(readme, /deliberate syntax-error model/);
  assert.doesNotMatch(readme, /NO-GO|not cleared for public redistribution/i);
});

test('"How Kiro shaped this" names the specs, steering files and hook', () => {
  const sec = readme.split(/^## How Kiro shaped this$/m)[1].split(/^## /m)[0];
  for (const s of ['00-engine-feasibility', '01-web-mvp', '01-end-to-end-web-run', '02-grounded-assistant', '03-local-product']) {
    assert.ok(sec.includes(s), s);
    assert.ok(exists(`.kiro/specs/${s}`), `.kiro/specs/${s}`);
  }
  for (const s of ['product.md', 'engineering.md', 'security-and-privacy.md', 'scientific-integrity.md', 'open-source.md']) {
    assert.ok(sec.includes(s), s);
    assert.ok(exists(`.kiro/steering/${s}`), `.kiro/steering/${s}`);
  }
  assert.ok(sec.includes('validate-on-save.json') && exists('.kiro/hooks/validate-on-save.json'));
});

test('README makes no claim that is unbacked by the repository for the recorded evidence files it cites', () => {
  const cited = [...readme.matchAll(/`(docs\/evidence\/[^`\s*<>]+)`/g)].map((m) => m[1]).filter((p) => !p.endsWith('/'));
  assert.ok(cited.length >= 5);
  for (const p of cited) assert.ok(exists(p), p);
});
