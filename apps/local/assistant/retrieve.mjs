// assistant/retrieve.mjs: pure lexical retrieval (requirements 12.5 to 12.8).
// BM25 (k1 1.2, b 0.75), no dependencies, deterministic, ties broken by id.

export const TOP_K = 5;
export const MIN_SCORE = 2.0;
export const MAX_QUESTION_CHARS = 500;
export const MAX_CONTEXT_CHARS = 6000;
const K1 = 1.2;
const B = 0.75;

const STOP_WORDS = new Set((
  'a an and are as at be but by can do does for from has have how i if in is it its '
  + 'me my of on or so that the their then there these this to was we what when where '
  + 'which who why will with you your'
).split(' '));

export function tokenize(text) {
  const out = [];
  for (const t of String(text).toLowerCase().match(/[a-z0-9_]+/g) ?? []) {
    if (!STOP_WORDS.has(t)) out.push(t);
  }
  return out;
}

function byScoreThenId(a, b) {
  if (b.score !== a.score) return b.score - a.score;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Rank passages for a question. Returns at most TOP_K entries
 * {id, source, text, score} with score >= MIN_SCORE, best first.
 * Throws an Error with code 'question_too_long' or 'question_empty'.
 */
export function retrieve(question, passages) {
  if (typeof question !== 'string' || question.trim() === '') {
    throw Object.assign(new Error('The question is empty.'), { code: 'question_empty' });
  }
  if (question.length > MAX_QUESTION_CHARS) {
    throw Object.assign(
      new Error(`The question is longer than ${MAX_QUESTION_CHARS} characters.`),
      { code: 'question_too_long' },
    );
  }
  const qTerms = [...new Set(tokenize(question))];
  if (qTerms.length === 0 || passages.length === 0) return [];

  const docs = passages.map((p) => {
    const tf = new Map();
    const tokens = tokenize(p.text);
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
    return { p, tf, len: tokens.length };
  });
  const N = docs.length;
  const avgLen = docs.reduce((s, d) => s + d.len, 0) / N || 1;
  const df = new Map(qTerms.map((t) => [t, docs.filter((d) => d.tf.has(t)).length]));

  const scored = [];
  for (const d of docs) {
    let score = 0;
    for (const t of qTerms) {
      const f = d.tf.get(t);
      if (!f) continue;
      const n = df.get(t);
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      score += idf * ((f * (K1 + 1)) / (f + K1 * (1 - B + B * (d.len / avgLen))));
    }
    // Round so equal scores compare equal across platforms.
    score = Math.round(score * 1e9) / 1e9;
    if (score >= MIN_SCORE) scored.push({ id: d.p.id, source: d.p.source, text: d.p.text, score });
  }
  return scored.sort(byScoreThenId).slice(0, TOP_K);
}

/**
 * Select ranked passages that fit in MAX_CONTEXT_CHARS (ids included in the
 * count). A passage that does not fit is skipped whole, never truncated.
 */
export function limitContext(ranked, max = MAX_CONTEXT_CHARS) {
  const kept = [];
  let used = 0;
  for (const p of ranked) {
    const cost = p.id.length + p.text.length + 6;
    if (used + cost > max) continue;
    kept.push(p);
    used += cost;
  }
  return { passages: kept, chars: used };
}
