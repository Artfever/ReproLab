// assistant/corpus.mjs: builds the Assistant Corpus (requirements 12.1 to 12.4).
// Only docs/assistant/*.md sections and the current Run's log lines and manifest
// fields are ever turned into passages. Dependency-free (node:* only).
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DOCS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..', '..', '..', 'docs', 'assistant',
);

// Manifest fields that become Run passages (design.md, Corpus passages).
export const MANIFEST_FIELDS = Object.freeze([
  'state', 'reason', 'engine_version', 'settings', 'runtime_s', 'image_id', 'exit_code',
]);

// Bounds so one Run cannot make the corpus unbounded.
export const MAX_LOG_LINES = 5000;
export const MAX_PASSAGE_CHARS = 1200;

function clip(text) {
  return text.length > MAX_PASSAGE_CHARS ? text.slice(0, MAX_PASSAGE_CHARS) : text;
}

/** Split one markdown document at lines starting with "## ". Pure. */
export function splitSections(stem, markdown) {
  const lines = String(markdown).replace(/\r\n?/g, '\n').split('\n');
  const sections = [];
  let current = null;
  for (const line of lines) {
    if (line.startsWith('## ')) {
      current = [line];
      sections.push(current);
    } else if (current) {
      current.push(line);
    }
  }
  return sections.map((ls, i) => ({
    id: `${stem}-${String(i + 1).padStart(2, '0')}`,
    source: `docs/assistant/${stem}.md`,
    text: ls.join('\n').trim(),
  }));
}

/** Load every docs/assistant/*.md file, sorted by file name. */
export function loadFilePassages(dir = DOCS_DIR) {
  const names = readdirSync(dir).filter((n) => n.endsWith('.md')).sort();
  const out = [];
  for (const name of names) {
    const stem = name.slice(0, -3);
    out.push(...splitSections(stem, readFileSync(path.join(dir, name), 'utf8')));
  }
  return out;
}

/**
 * Run passages from an already sanitised manifest and scrubbed log text.
 * Log line n (1-based) gets id run-log-L<n>; each present manifest field
 * gets run-manifest-<field>. Fields absent from the manifest are skipped.
 */
export function buildRunPassages({ manifest, log } = {}) {
  const out = [];
  if (manifest && typeof manifest === 'object') {
    for (const key of MANIFEST_FIELDS) {
      if (!Object.hasOwn(manifest, key) || manifest[key] === undefined) continue;
      const v = manifest[key];
      const value = typeof v === 'string' ? v : JSON.stringify(v);
      out.push({ id: `run-manifest-${key}`, source: 'run manifest', text: clip(`${key}: ${value}`) });
    }
  }
  if (typeof log === 'string' && log.length > 0) {
    const lines = log.replace(/\r\n?/g, '\n').split('\n');
    if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
    const n = Math.min(lines.length, MAX_LOG_LINES);
    for (let i = 0; i < n; i++) {
      if (lines[i].trim() === '') continue;
      out.push({ id: `run-log-L${i + 1}`, source: 'run log', text: clip(lines[i]) });
    }
  }
  return out;
}

/** Full corpus: file passages plus Run passages when a Run is supplied. */
export function buildCorpus({ run, dir } = {}) {
  const files = loadFilePassages(dir);
  return run ? files.concat(buildRunPassages(run)) : files;
}
