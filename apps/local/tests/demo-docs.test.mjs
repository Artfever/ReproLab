// Acceptance check for task 13.2 (spec 03-local-product, Requirements 22.1 and 22.2):
// the demo script's timed segments fit in 3:00, are contiguous, and the honesty statements are present.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (f) => fs.readFileSync(path.join(root, 'docs', 'demo', f), 'utf8').replace(/\r\n/g, '\n');
const script = read('script.md');
const shots = read('shot-list.md');

const toSec = (m, s) => Number(m) * 60 + Number(s);
const SEG = /^### \[(\d\d):(\d\d)-(\d\d):(\d\d)\]/;

const segments = [];
{
  const lines = script.split('\n');
  lines.forEach((line, i) => {
    const m = line.match(SEG);
    if (!m) return;
    const start = toSec(m[1], m[2]);
    const end = toSec(m[3], m[4]);
    // Narration blockquotes that follow, up to the next segment heading.
    let j = i + 1;
    let words = 0;
    while (j < lines.length && !SEG.test(lines[j]) && !/^## /.test(lines[j])) {
      const q = lines[j].match(/^> \*\*Narration[^*]*\*\*(.*)$/);
      if (q) words = Math.max(words, q[1].trim().split(/\s+/).length);
      j += 1;
    }
    segments.push({ start, end, dur: end - start, words });
  });
}

test('the script has seven timed segments, each with a positive duration', () => {
  assert.equal(segments.length, 7);
  for (const s of segments) assert.ok(s.dur > 0, JSON.stringify(s));
});

test('segments are contiguous, start at 0:00, and total at most 180 seconds', () => {
  assert.equal(segments[0].start, 0);
  for (let i = 1; i < segments.length; i += 1) assert.equal(segments[i].start, segments[i - 1].end, `gap before segment ${i + 1}`);
  const total = segments.reduce((a, s) => a + s.dur, 0);
  assert.equal(total, segments.at(-1).end);
  assert.ok(total <= 180, `total ${total} s`);
});

test('the summary table and the stated total agree with the segment headings', () => {
  const total = segments.reduce((a, s) => a + s.dur, 0);
  const rows = [...script.matchAll(/^\| \d\. .*\| \[(\d\d):(\d\d)-(\d\d):(\d\d)\] \| (\d+) \|/gm)];
  assert.equal(rows.length, segments.length);
  rows.forEach((m, i) => {
    assert.equal(toSec(m[3], m[4]) - toSec(m[1], m[2]), Number(m[5]), `table row ${i + 1} seconds column`);
    assert.equal(toSec(m[1], m[2]), segments[i].start);
    assert.equal(toSec(m[3], m[4]), segments[i].end);
  });
  const stated = script.match(/Total: (\d+) seconds \((\d+):(\d\d)\)/);
  assert.ok(stated, 'total line');
  assert.equal(Number(stated[1]), total);
  assert.equal(toSec(stated[2], stated[3]), total);
});

test('shot list times match the script segments', () => {
  const times = [...shots.matchAll(/^\| \d \| \[(\d\d):(\d\d)-(\d\d):(\d\d)\]/gm)].map((m) => [toSec(m[1], m[2]), toSec(m[3], m[4])]);
  assert.deepEqual(times, segments.map((s) => [s.start, s.end]));
});

test('narration fits each segment at no more than 2.6 words per second', () => {
  for (const s of segments) assert.ok(s.words / s.dur <= 2.6, `${s.words} words in ${s.dur} s`);
});

test('the script and shot list say plainly that no video exists and nothing is uploaded', () => {
  for (const doc of [script, shots]) {
    assert.match(doc, /no video exists yet/i);
    assert.match(doc, /none has been uploaded|none has been uploaded anywhere/i);
  }
  assert.match(script, /real screen capture/i);
  assert.match(shots, /No fake footage/i);
});

test('"uploaded" and "published" never appear as a claim: every use sits in a negated sentence', () => {
  for (const [name, doc] of [['script.md', script], ['shot-list.md', shots]]) {
    for (const line of doc.split('\n')) {
      const stripped = line.replace(/published (reference )?values/gi, '');
      if (!/\b(uploaded|published)\b/i.test(stripped)) continue;
      assert.match(stripped, /\b(no|not|none|never|nothing|unless)\b|\bDo not\b/i, `${name}: ${line}`);
    }
  }
});

test('required honesty statements are present in the script', () => {
  const required = [
    /FAILED/, /pre-declared/i, /historical/i, /post hoc/i,
    /MIT/, /ReproLab code only/i, /OpenBUGS as its original engine/i,
    /not a scientific finding/i, /switched off/i, /not a hosted service/i,
    /engine error/i, /SHA-256/, /What NOT to claim/,
  ];
  for (const re of required) assert.match(script, re, String(re));
});

test('the shot list has a pre-recording checklist, a disabled-assistant fallback and the ollama state', () => {
  assert.match(shots, /## Pre-recording checklist/);
  assert.match(shots, /## Fallback when the assistant is disabled/);
  assert.match(shots, /Ollama/);
  assert.match(shots, /scripts\\start\.ps1/);
});

test('the demo docs name no hosted URL and no secret-looking text', () => {
  for (const doc of [script, shots]) {
    assert.doesNotMatch(doc, /\bsk-[A-Za-z0-9]/);
    assert.doesNotMatch(doc, /Bearer\s/);
    assert.doesNotMatch(doc, /https?:\/\/(?!127\.0\.0\.1)/);
  }
});
