// sanitize.mjs: pure helpers for host-path scrubbing and name checks.
// Spec 03-local-product, Requirements 7.2, 7.3, 7.5, 7.6, 7.7. Node built-ins only; no imports.

export const LOCAL_PATH = '<local-path>';
const MAX_BASE_NAME = 100;

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isWindowsRoot(root) {
  return /^[A-Za-z]:[\\/]/.test(root) || root.startsWith('\\\\');
}

// All textual spellings of one root that could appear in a log, JSON string or URL.
function variantsOf(root) {
  const fwd = root.replace(/\\/g, '/');
  const out = new Set();
  out.add(root);
  out.add(fwd);
  // Backslash form, plus JSON-escaped (2) and double-JSON-escaped (4) forms.
  for (const n of [1, 2, 4]) out.add(fwd.replace(/\//g, '\\'.repeat(n)));
  // Percent-encoded forms.
  const encUri = encodeURI(fwd);
  const encComp = encodeURIComponent(fwd);
  const encColon = encUri.replace(/:/g, '%3A');
  for (const e of [encUri, encComp, encColon]) out.add(e);
  // file: URL forms (drive paths use three slashes, POSIX paths two plus the leading slash).
  const prefix = fwd.startsWith('/') ? 'file://' : 'file:///';
  for (const e of [fwd, encUri, encColon]) out.add(prefix + e);
  return [...out].filter((v) => v.length >= 2);
}

/**
 * Replace every occurrence of each root (and its slash, URL-encoded, JSON-escaped and
 * file: URL spellings) with `<local-path>`. Matching is case-insensitive for Windows roots.
 * @param {string} text
 * @param {string[]} roots
 * @returns {string}
 */
export function scrubPaths(text, roots) {
  if (typeof text !== 'string' || text.length === 0) return typeof text === 'string' ? text : '';
  const items = [];
  for (const raw of Array.isArray(roots) ? roots : []) {
    if (typeof raw !== 'string') continue;
    let root = raw.trim();
    while (root.length > 1 && /[\\/]$/.test(root)) root = root.slice(0, -1);
    // Refuse roots that would erase ordinary text (empty, "/", "C:").
    if (root.length < 3 || /^[A-Za-z]:$/.test(root)) continue;
    const ci = isWindowsRoot(root);
    for (const v of variantsOf(root)) items.push({ v, ci: ci || v.includes('%') });
  }
  items.sort((a, b) => b.v.length - a.v.length);
  let result = text;
  for (const { v, ci } of items) {
    result = result.replace(new RegExp(escapeRegExp(v), ci ? 'gi' : 'g'), LOCAL_PATH);
  }
  return result;
}

/**
 * Reduce an uploaded file name to a plain base name of at most 100 characters.
 * Returns null when nothing usable remains or the name contains control characters.
 * @param {unknown} name
 * @returns {string|null}
 */
export function safeBaseName(name) {
  if (typeof name !== 'string') return null;
  if (/[\x00-\x1F\x7F]/.test(name)) return null;
  const base = name.split(/[\\/]/).pop() ?? '';
  const plain = base.replace(/[^A-Za-z0-9._ -]/g, '_').slice(0, MAX_BASE_NAME);
  if (plain.trim() === '' || /^\.+$/.test(plain)) return null;
  return plain;
}

/** True for a 32-character lowercase hex Run_Id. */
export function isRunId(id) {
  return typeof id === 'string' && /^[0-9a-f]{32}$/.test(id);
}

/** True for a plain file name with no separators, `..`, NUL or control characters. */
export function isSafeFileName(name) {
  return (
    typeof name === 'string' &&
    name.length >= 1 &&
    name.length <= 128 &&
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name) &&
    !name.includes('..')
  );
}
