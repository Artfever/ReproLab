// assistant/answer.mjs: prompt build and citation verification (requirements 13.2 to 13.4, 13.9, 13.10).
// Pure functions, no I/O.

export const DECLINE_MESSAGE = 'I cannot answer that from the ReproLab documentation or this run\'s log and manifest.';

export const SYSTEM_PROMPT = [
  'You answer questions about the ReproLab local tool.',
  'Use only the numbered passages in the user message. Do not use any other knowledge.',
  'Cite every claim with the passage id in square brackets, for example [setup-01].',
  'If the passages do not contain the answer, say so and cite nothing.',
  'Do not judge whether results are valid, converged or medically meaningful.',
].join(' ');

// Questions that ask for a scientific-validity, convergence or medical judgement (requirement 13.10).
const JUDGEMENT_RE = new RegExp(
  '\\b(?:converge|converged|converges|converging|convergence|valid|validity|invalid|r-?hat|gelman|geweke|'
  + 'significant|significance|diagnos\\w*|medical|medically|clinical|clinically|patient|patients|'
  + 'treatment|dose|dosage|prescri\\w*|reliable|trustworthy|publishable)\\b',
  'i',
);

export function isJudgementQuestion(question) {
  return JUDGEMENT_RE.test(String(question));
}

/** Messages for the Provider: instruction plus the question and the retrieved passages with ids. */
export function buildMessages(question, passages) {
  const body = passages.map((p) => `[${p.id}] (${p.source})\n${p.text}`).join('\n\n');
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `Question: ${question}\n\nPassages:\n\n${body}` },
  ];
}

/** Every bracketed token that looks like a passage id, in order of first appearance. */
export function extractCitations(text) {
  const ids = [];
  for (const m of String(text).matchAll(/\[([A-Za-z0-9_.-]+)\]/g)) {
    if (!ids.includes(m[1])) ids.push(m[1]);
  }
  return ids;
}

/**
 * Accept only if at least one id is cited and every cited id was retrieved.
 * Returns {ok:true, ids} or {ok:false, reason}.
 */
export function verifyAnswer(text, retrievedIds) {
  const ids = extractCitations(text);
  if (ids.length === 0) return { ok: false, reason: 'no_citation' };
  const allowed = new Set(retrievedIds);
  if (ids.some((id) => !allowed.has(id))) return { ok: false, reason: 'foreign_citation' };
  return { ok: true, ids };
}
