// Assistant routes (spec 03-local-product, tasks 6.3 and 6.4). Requirements 12.6, 13.1 to 13.10.
// POST /api/assistant/ask is implemented here. GET /api/assistant/status stays 501 until task 6.4.
import { buildCorpus, buildRunPassages, loadFilePassages } from '../../assistant/corpus.mjs';
import { retrieve, limitContext } from '../../assistant/retrieve.mjs';
import {
  DECLINE_MESSAGE, buildMessages, isJudgementQuestion, verifyAnswer,
} from '../../assistant/answer.mjs';
import { readConfig, chatCompletion, scrubKey, ProviderError, PROVIDER_TIMEOUT_MS } from '../../assistant/provider.mjs';
import { getRuns } from './runs.mjs';

const notImplemented = () => ({ status: 501, json: { error: 'Not implemented yet.' } });
const ALLOWED_KEYS = new Set(['question', 'runId']);

const declined = () => ({ status: 200, json: { kind: 'declined', message: DECLINE_MESSAGE } });

/** Run passages from the run manager's sanitised record, manifest and scrubbed log. */
function runPassagesFor(run, manifestBuf) {
  const manifest = {
    state: run.state,
    reason: run.reason,
    engine_version: run.engineVersion,
    settings: run.settings,
    runtime_s: run.runtimeS,
  };
  if (manifestBuf) {
    try {
      const m = JSON.parse(manifestBuf.toString('utf8'));
      if (m && typeof m === 'object' && !Array.isArray(m)) {
        for (const [k, v] of Object.entries(m)) if (v !== null && v !== undefined) manifest[k] = v;
      }
    } catch { /* keep the record fields */ }
  }
  for (const k of Object.keys(manifest)) if (manifest[k] === null || manifest[k] === undefined) delete manifest[k];
  return buildRunPassages({ manifest, log: (run.log?.lines ?? []).join('\n') });
}

export function routes(deps = {}) {
  const env = () => deps.providerEnv ?? process.env;
  const logClass = (cls) => {
    // Only the failure class is logged. Never the request, the response or any setting.
    try { deps.log?.(`assistant provider failure: ${cls}`); } catch { /* logging must never throw */ }
  };

  async function ask({ body }) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return { status: 400, json: { error: 'The request must be a JSON object with a "question".' } };
    }
    for (const k of Object.keys(body)) {
      if (!ALLOWED_KEYS.has(k)) return { status: 400, json: { error: `The request has an unknown field "${k}".` } };
    }
    const { question, runId } = body;
    if (typeof question !== 'string' || question.trim() === '') {
      return { status: 400, json: { error: 'The question is empty.' } };
    }
    if (runId !== undefined && typeof runId !== 'string') {
      return { status: 400, json: { error: 'The runId must be a string.' } };
    }

    let passages;
    if (runId === undefined) {
      passages = loadFilePassages();
    } else {
      const runs = getRuns(deps);
      await runs.ready;
      const run = runs.getRun(runId);
      if (!run) return { status: 404, json: { error: 'Run not found.' } };
      passages = buildCorpus().concat(runPassagesFor(run, runs.getManifest(runId)));
    }

    // 13.10: judgement questions are declined and never sent to the Provider.
    if (isJudgementQuestion(question)) return declined();

    let ranked;
    try {
      ranked = retrieve(question, passages);
    } catch (e) {
      if (e?.code === 'question_empty' || e?.code === 'question_too_long') {
        return { status: 400, json: { error: e.message } };
      }
      throw e;
    }
    const { passages: context } = limitContext(ranked);
    // 12.6: nothing supported, so no Provider call.
    if (context.length === 0) return declined();

    const cfg = readConfig(env());
    if (!cfg.ok) {
      return { status: 503, json: { kind: 'error', class: 'not_configured', message: `${cfg.reason}.` } };
    }

    let text;
    try {
      text = await chatCompletion(cfg, buildMessages(question, context), {
        timeoutMs: deps.providerTimeoutMs ?? PROVIDER_TIMEOUT_MS,
      });
    } catch (e) {
      const cls = e instanceof ProviderError ? e.class : 'unreachable';
      const message = e instanceof ProviderError ? e.message : 'The language-model endpoint could not be reached.';
      logClass(cls);
      return { status: 502, json: { kind: 'error', class: cls, message: scrubKey(message, cfg.apiKey) } };
    }

    const verdict = verifyAnswer(text, context.map((p) => p.id));
    if (!verdict.ok) return declined();
    const byId = new Map(context.map((p) => [p.id, p]));
    return {
      status: 200,
      json: {
        kind: 'answer',
        text: scrubKey(text, cfg.apiKey),
        citations: verdict.ids.map((id) => ({
          id,
          source: byId.get(id).source,
          text: scrubKey(byId.get(id).text, cfg.apiKey),
        })),
      },
    };
  }

  return [
    { method: 'POST', pattern: /^\/api\/assistant\/ask$/, handler: ask },
    { method: 'GET', pattern: /^\/api\/assistant\/status$/, handler: notImplemented },
  ];
}
