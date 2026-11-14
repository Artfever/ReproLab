// Licence audit for apps/web dependencies (spec 03-local-product, task 10.2, Requirement 18.5).
// Reads apps/web/package-lock.json (packages[*].license). When the lockfile has no licence for a
// package, falls back to the "license" field of its package.json in apps/web/node_modules.
// No network access. Prints a markdown report to stdout. Paths are repository-relative only.
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const webDir = join(root, 'apps', 'web');
const lock = JSON.parse(readFileSync(join(webDir, 'package-lock.json'), 'utf8'));

const COMMON = new Set(['MIT', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause', 'Apache-2.0']);
const COPYLEFT = /(^|[^A-Z])(A?L?GPL|MPL|EPL|CDDL|EUPL|CC-BY-SA|OSL|SSPL)/i;

function normalise(value) {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value.type === 'string') return value.type.trim();
  if (Array.isArray(value)) {
    const parts = value.map(normalise).filter(Boolean);
    return parts.length ? `(${parts.join(' OR ')})` : '';
  }
  return '';
}

function nameOf(path, entry) {
  if (entry.name) return entry.name;
  const i = path.lastIndexOf('node_modules/');
  return i >= 0 ? path.slice(i + 'node_modules/'.length) : path;
}

const rows = [];
for (const [path, entry] of Object.entries(lock.packages ?? {})) {
  if (path === '') continue; // the root project itself
  let licence = normalise(entry.license);
  let source = 'lockfile';
  if (!licence) {
    const manifest = join(webDir, path, 'package.json');
    if (existsSync(manifest)) {
      try {
        const m = JSON.parse(readFileSync(manifest, 'utf8'));
        licence = normalise(m.license) || normalise(m.licenses);
        source = licence ? 'node_modules package.json' : 'none';
      } catch {
        source = 'unreadable package.json';
      }
    } else {
      source = 'not installed';
    }
  }
  rows.push({
    name: nameOf(path, entry),
    version: entry.version ?? '?',
    licence: licence || 'UNKNOWN',
    source,
    optional: Boolean(entry.optional),
    dev: Boolean(entry.dev),
  });
}

function tokens(expr) {
  return expr.replace(/[()]/g, ' ').split(/\s+(?:OR|AND|WITH)\s+|\s+/).filter(Boolean);
}
function classify(expr) {
  if (expr === 'UNKNOWN') return 'unresolved';
  if (/^SEE LICEN[CS]E/i.test(expr)) return 'unresolved';
  if (COPYLEFT.test(expr)) return 'copyleft';
  if (tokens(expr).every((t) => COMMON.has(t))) return 'common permissive';
  return 'unusual';
}

const groups = new Map();
for (const r of rows) {
  const g = groups.get(r.licence) ?? [];
  g.push(r);
  groups.set(r.licence, g);
}
const ids = [...groups.keys()].sort((a, b) => groups.get(b).length - groups.get(a).length || a.localeCompare(b));

const esc = (s) => String(s).replace(/\|/g, '\\|');
const out = [];
out.push('# Dependency licence table: apps/web');
out.push('');
out.push(`Source: \`apps/web/package-lock.json\` (lockfileVersion ${lock.lockfileVersion}), ${rows.length} packages excluding the root project.`);
out.push('Fallback for packages with no lockfile licence: the `license` field of `apps/web/node_modules/<pkg>/package.json`. No network lookups.');
out.push('Flag is a mechanical screen of the SPDX identifier, not a legal verdict. Verdicts belong to `docs/third-party-notices.md` (task 10.3).');
out.push('');
out.push('| Licence identifier | Packages | Flag |');
out.push('| --- | ---: | --- |');
for (const id of ids) out.push(`| ${esc(id)} | ${groups.get(id).length} | ${classify(id)} |`);
out.push(`| **Total** | **${rows.length}** | |`);
out.push('');

const fellBack = rows.filter((r) => r.source !== 'lockfile');
const flagged = ids.filter((id) => classify(id) !== 'common permissive');

out.push('## Packages with unresolved licence');
out.push('');
const unresolved = rows.filter((r) => classify(r.licence) === 'unresolved');
if (unresolved.length === 0) out.push('None. Every package declares a licence identifier.');
else for (const r of unresolved) out.push(`- ${r.name}@${r.version} (${r.source})`);
out.push('');

out.push('## Packages with copyleft or unusual identifiers');
out.push('');
const listed = rows.filter((r) => ['copyleft', 'unusual'].includes(classify(r.licence)));
if (listed.length === 0) out.push('None.');
else {
  out.push('| Package | Version | Licence | Flag | Optional | Dev only |');
  out.push('| --- | --- | --- | --- | --- | --- |');
  for (const r of listed.sort((a, b) => a.licence.localeCompare(b.licence) || a.name.localeCompare(b.name))) {
    out.push(`| ${esc(r.name)} | ${r.version} | ${esc(r.licence)} | ${classify(r.licence)} | ${r.optional ? 'yes' : 'no'} | ${r.dev ? 'yes' : 'no'} |`);
  }
}
out.push('');

out.push('## Licences read from node_modules instead of the lockfile');
out.push('');
if (fellBack.length === 0) out.push('None. The lockfile carried every identifier.');
else for (const r of fellBack) out.push(`- ${r.name}@${r.version}: ${r.licence} (${r.source})`);
out.push('');

out.push('## Committed code with third-party origin (git ls-files review)');
out.push('');
let files = [];
try {
  files = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    .split('\n').filter(Boolean);
} catch {
  out.push('`git ls-files` could not be run; this section is unreviewed.');
}
if (files.length) {
  const suspect = files.filter((f) =>
    /(^|\/)(vendor|third[_-]?party|node_modules)\//i.test(f) ||
    /\.(min\.js|woff2?|ttf|otf|eot|tar|tar\.gz|tgz|zip|jar|so|dll|exe)$/i.test(f));
  out.push(`${files.length} tracked files scanned for vendored directories, minified bundles, fonts and binaries.`);
  out.push('');
  if (suspect.length === 0) out.push('No matching files. This is a filename screen only; file contents were not inspected for copied code.');
  else {
    out.push('Matching files (origin and licence need manual confirmation):');
    out.push('');
    for (const f of suspect) out.push(`- \`${f}\``);
  }
}
out.push('');
out.push(`Packages needing attention in 10.3: ${flagged.length ? flagged.map(esc).join(', ') : 'none'}.`);
out.push('');
process.stdout.write(out.join('\n'));
