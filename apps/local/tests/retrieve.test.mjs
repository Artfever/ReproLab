import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  loadFilePassages, buildRunPassages, buildCorpus, splitSections,
  MAX_LOG_LINES, MAX_PASSAGE_CHARS,
} from '../assistant/corpus.mjs';
import {
  retrieve, limitContext, tokenize,
  MIN_SCORE, TOP_K, MAX_QUESTION_CHARS, MAX_CONTEXT_CHARS,
} from '../assistant/retrieve.mjs';

const files = loadFilePassages();

test('constants are pinned and printed', (t) => {
  t.diagnostic(`TOP_K=${TOP_K} MIN_SCORE=${MIN_SCORE} MAX_QUESTION_CHARS=${MAX_QUESTION_CHARS} MAX_CONTEXT_CHARS=${MAX_CONTEXT_CHARS}`);
  console.log(`CONSTANTS TOP_K=${TOP_K} MIN_SCORE=${MIN_SCORE} MAX_QUESTION_CHARS=${MAX_QUESTION_CHARS} MAX_CONTEXT_CHARS=${MAX_CONTEXT_CHARS}`);
  assert.equal(TOP_K, 5);
  assert.equal(MIN_SCORE, 2.0);
  assert.equal(MAX_QUESTION_CHARS, 500);
  assert.equal(MAX_CONTEXT_CHARS, 6000);
});

const EXPECTED_TOP = [
  ['What port does the server listen on?', 'setup-04'],
  ['Why did my run end in timed_out?', 'states-04'],
  ['Where is my API key stored?', 'privacy-04'],
  ['How do I delete saved runs?', 'privacy-06'],
  ['Does the assistant tell me if my model converged?', 'assistant-02'],
];
for (const [q, id] of EXPECTED_TOP) {
  test(`top passage for "${q}" is ${id}`, () => {
    const r = retrieve(q, files);
    assert.ok(r.length >= 1 && r.length <= TOP_K);
    assert.equal(r[0].id, id);
    for (const p of r) assert.ok(p.score >= MIN_SCORE);
  });
}

test('a question unrelated to the corpus returns an empty list', () => {
  assert.deepEqual(retrieve('What is the capital of France?', files), []);
  assert.deepEqual(retrieve('the of and', files), []);
  assert.deepEqual(retrieve('qwertyuiop zxcvbnm', files), []);
});

test('same input gives the same output when run twice', () => {
  const q = 'Which Docker image do I need to build?';
  const a = retrieve(q, files);
  const b = retrieve(q, loadFilePassages());
  assert.deepEqual(a, b);
  assert.ok(a.length > 0 && a.length <= TOP_K);
});

test('ties are broken by id regardless of input order', () => {
  const text = 'zebra quartz marker';
  const ps = ['c-03', 'a-01', 'b-02'].map((id) => ({ id, source: 's', text }));
  const bg = Array.from({ length: 20 }, (_, i) => ({ id: `bg-${i}`, source: 's', text: `filler words number${i}` }));
  const ids = (xs) => retrieve('zebra quartz', xs).map((p) => p.id);
  assert.deepEqual(ids([...ps, ...bg]), ['a-01', 'b-02', 'c-03']);
  assert.deepEqual(ids([...bg, ...ps].reverse()), ['a-01', 'b-02', 'c-03']);
});

test('at most TOP_K passages are returned', () => {
  const ps = Array.from({ length: 8 }, (_, i) => ({ id: `p-${String(i).padStart(2, '0')}`, source: 's', text: 'rareword filler' }));
  ps.push(...Array.from({ length: 100 }, (_, i) => ({ id: `q-${i}`, source: 's', text: `other ${i}` })));
  const r = retrieve('rareword', ps);
  assert.equal(r.length, TOP_K);
  assert.deepEqual(r.map((p) => p.id), ['p-00', 'p-01', 'p-02', 'p-03', 'p-04']);
});

test('file passage ids are stable, two-digit, in document order and sourced only from docs/assistant', () => {
  const again = loadFilePassages().map((p) => p.id);
  assert.deepEqual(again, files.map((p) => p.id));
  for (const p of files) {
    assert.match(p.id, /^[a-z]+-\d{2}$/);
    assert.match(p.source, /^docs\/assistant\/[a-z]+\.md$/);
  }
  const states = files.filter((p) => p.id.startsWith('states-')).map((p) => p.id);
  assert.deepEqual(states, states.slice().sort());
  assert.equal(files.find((p) => p.id === 'states-04').text.split('\n')[0], '## timed_out');
  assert.equal(files.find((p) => p.id === 'setup-04').text.split('\n')[0], '## Starting the server');
  assert.equal(new Set(files.map((p) => p.id)).size, files.length);
});

test('splitSections splits only at second-level headings and ignores the preamble', () => {
  const s = splitSections('x', '# Title\n\nintro\n\n## One\n\na\n\n### Sub\n\nb\n\n## Two\r\n\r\nc\n');
  assert.deepEqual(s.map((p) => p.id), ['x-01', 'x-02']);
  assert.ok(s[0].text.includes('### Sub') && !s[0].text.includes('intro'));
});

test('Run passages use run-log-L<n> and run-manifest-<field> ids', () => {
  const run = {
    manifest: { state: 'engine_error', reason: 'error pos 58', engine_version: '3.2.3 rev 1012', settings: { chains: 2 }, runtime_s: 1.5, exit_code: 0, secret_extra: 'x' },
    log: 'model is syntactically correct\n\nUndefined variable zeta\n',
  };
  const r = buildRunPassages(run);
  assert.deepEqual(r.map((p) => p.id), [
    'run-manifest-state', 'run-manifest-reason', 'run-manifest-engine_version',
    'run-manifest-settings', 'run-manifest-runtime_s', 'run-manifest-exit_code',
    'run-log-L1', 'run-log-L3',
  ]);
  assert.equal(r.find((p) => p.id === 'run-manifest-settings').text, 'settings: {"chains":2}');
  assert.ok(!r.some((p) => p.text.includes('secret_extra')));
  assert.deepEqual(buildRunPassages(run), r);
});

test('a Run log line is retrievable with its line id', () => {
  const log = ['model is syntactically correct', 'data loaded', 'Undefined variable zeta in the likelihood block'].join('\n');
  const corpus = [...files, ...buildRunPassages({ manifest: { state: 'engine_error' }, log })];
  const r = retrieve('Undefined variable zeta', corpus);
  assert.equal(r[0].id, 'run-log-L3');
  assert.ok(buildCorpus({ run: { log } }).some((p) => p.id === 'run-log-L1'));
  assert.ok(!buildCorpus().some((p) => p.id.startsWith('run-')));
});

test('Run passages are bounded in count and length', () => {
  const log = Array.from({ length: MAX_LOG_LINES + 50 }, (_, i) => `line ${i}`).join('\n');
  const r = buildRunPassages({ log });
  assert.equal(r.length, MAX_LOG_LINES);
  assert.equal(r.at(-1).id, `run-log-L${MAX_LOG_LINES}`);
  const long = buildRunPassages({ log: 'x'.repeat(MAX_PASSAGE_CHARS * 3) });
  assert.equal(long[0].text.length, MAX_PASSAGE_CHARS);
});

test('question length is bounded at 500 characters', () => {
  assert.doesNotThrow(() => retrieve('a'.repeat(MAX_QUESTION_CHARS), files));
  assert.throws(() => retrieve('a'.repeat(MAX_QUESTION_CHARS + 1), files), { code: 'question_too_long' });
  assert.throws(() => retrieve('   ', files), { code: 'question_empty' });
  assert.throws(() => retrieve(42, files), { code: 'question_empty' });
});

test('context is bounded at 6000 characters and passages are never truncated', () => {
  const big = (id, n) => ({ id, source: 's', text: 'y'.repeat(n), score: 5 });
  const ranked = [big('a-01', 2500), big('b-01', 2500), big('c-01', 2500), big('d-01', 100)];
  const { passages, chars } = limitContext(ranked);
  assert.deepEqual(passages.map((p) => p.id), ['a-01', 'b-01', 'd-01']);
  assert.ok(chars <= MAX_CONTEXT_CHARS);
  for (const p of passages) assert.equal(p.text.length, ranked.find((r) => r.id === p.id).text.length);
  const real = limitContext(retrieve('How do I delete saved runs?', files));
  assert.ok(real.chars <= MAX_CONTEXT_CHARS && real.passages.length > 0);
});

test('tokenizer lowercases, keeps underscores and drops stop words', () => {
  assert.deepEqual(tokenize('Why did the RUN end in timed_out?'), ['did', 'run', 'end', 'timed_out']);
});
