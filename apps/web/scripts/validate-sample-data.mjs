// Fails the build when content/sample-run.json is missing, malformed, or out of date with the evidence.
import { readFileSync, existsSync } from 'node:fs';
import { generate, serialize, OUT_PATH } from './build-sample-data.mjs';
import { validateSampleRun } from '../src/lib/sample-run-schema.mjs';

try {
  if (!existsSync(OUT_PATH)) throw new Error('content/sample-run.json is missing. Run: npm run data');
  const text = readFileSync(OUT_PATH, 'utf8');
  const result = validateSampleRun(JSON.parse(text));
  if (!result.ok) throw new Error(`content/sample-run.json is invalid at ${result.field}`);
  let fresh = null;
  try { fresh = serialize(generate()); } catch { /* evidence not available (for example a Vercel build rooted at apps/web): schema check only */ }
  if (fresh !== null && fresh !== text) throw new Error('content/sample-run.json is out of date with the evidence. Run: npm run data');
  console.log(`sample data OK${fresh === null ? ' (schema only; evidence not reachable)' : ''}`);
} catch (e) { console.error(`sample data error: ${e.message}`); process.exit(1); }