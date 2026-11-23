// Assistant routes (spec 03-local-product, tasks 6.3 and 6.4). Requirements 12.6, 13.1 to 13.10.
// POST /api/assistant/ask (task 6.3) and GET /api/assistant/status (task 6.4, requirements 14.1 to 14.3).
import { buildCorpus, buildRunPassages, loadFilePassages } from '../../assistant/corpus.mjs';
import { retrieve, limitContext } from '../../assistant/retrieve.mjs';
import {
  DECLINE_MESSAGE, buildMessages, isJudgementQuestion, verifyAnswer,
} from '../../assistant/answer.mjs';
import {
  readConfig, chatCompletion, probeEndpoint, scrubKey, ProviderError, PROVIDER_TIMEOUT_MS, PROBE_TIMEOUT_MS,
} from '../../assistant/provider.mjs';
import { getRuns } from './runs.mjs';
import { readTranscriptionConfig, parseAudioUpload, transcribeAudio } from '../../assistant/transcription.mjs';

export const STATUS_CACHE_MS = 10_000;
const ALLOWED_KEYS = new Set(['question', 'runId', 'shareRunContext']);

const declined = () => ({ status: 200, json: { kind: 'declined', message: DECLINE_MESSAGE } });

/** Run passages from the run manager's sanitised record, manifest and scrubbed log. */
function runPassagesFor(run, manifestBuf) {
  const manifest = {
    engine: run.engine,
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
    const { question, runId, shareRunContext } = body;
    if (typeof question !== 'string' || question.trim() === '') {
      return { status: 400, json: { error: 'The question is empty.' } };
    }
    if (runId !== undefined && typeof runId !== 'string') {
      return { status: 400, json: { error: 'The runId must be a string.' } };
    }
    if (shareRunContext !== undefined && typeof shareRunContext !== 'boolean') {
      return { status: 400, json: { error: 'The run context choice must be a boolean.' } };
    }

    let passages;
    if (runId === undefined) {
      passages = loadFilePassages();
    } else {
      const runs = getRuns(deps);
      await runs.ready;
      const run = runs.getRun(runId);
      if (!run) return { status: 404, json: { error: 'Run not found.' } };
      const config = readConfig(env());
      const local = config.ok && ['localhost', '127.0.0.1', '[::1]'].includes(new URL(config.baseUrl).hostname);
      passages = buildCorpus();
      if (local || shareRunContext === true) passages = passages.concat(runPassagesFor(run, runs.getManifest(runId)));
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

  // Requirement 14.1 to 14.3. The probe runs at most once per STATUS_CACHE_MS for the same settings.
  // The response holds only a state and a plain reason: no key, no URL.
  let cached = null; // { key, at, body }
  const nowMs = () => (deps.now ? deps.now() : Date.now());

  async function status() {
    const cfg = readConfig(env());
    if (!cfg.ok) return { status: 200, json: { status: 'disabled', reason: `${cfg.reason}.` } };
    const key = `${cfg.baseUrl}\n${cfg.model}\n${cfg.apiKey ?? ''}`;
    const ttl = deps.statusCacheMs ?? STATUS_CACHE_MS;
    if (cached && cached.key === key && nowMs() - cached.at < ttl) return { status: 200, json: cached.body };
    const { reachable } = await probeEndpoint(cfg, deps.probeTimeoutMs ?? PROBE_TIMEOUT_MS);
    const body = reachable
      ? { status: 'enabled', reason: 'A language-model endpoint is configured and answered a health check.' }
      : { status: 'disabled', reason: 'The language-model endpoint is unreachable.' };
    cached = { key, at: nowMs(), body };
    return { status: 200, json: body };
  }

  function voiceStatus() {
    const cfg = readTranscriptionConfig(env());
    return cfg.ok
      ? { status: 200, json: { status: 'enabled', model: cfg.model } }
      : { status: 200, json: { status: 'disabled', reason: `${cfg.reason}.` } };
  }

  async function transcribe({ body, req }) {
    const config = readTranscriptionConfig(env());
    if (!config.ok) return { status: 503, json: { error: `${config.reason}.` } };
    const upload = parseAudioUpload(body, req.headers['content-type']);
    if (!upload.ok) return { status: upload.status, json: { error: upload.message } };
    let result;
    try {
      result = await (deps.transcribeAudio ?? transcribeAudio)(upload, config, deps.transcriptionOptions ?? {});
    } catch {
      result = { ok: false, class: 'unreachable', message: 'Groq could not complete the transcription.' };
    }
    if (!result.ok) {
      try { deps.log?.(`assistant transcription failure: ${result.class}`); } catch { /* logging must never throw */ }
      return { status: result.class === 'bad_status' ? 502 : 503, json: { error: result.message } };
    }
    return { status: 200, json: { text: result.text } };
  }

  return [
    { method: 'POST', pattern: /^\/api\/assistant\/ask$/, handler: ask },
    { method: 'GET', pattern: /^\/api\/assistant\/status$/, handler: status },
    { method: 'GET', pattern: /^\/api\/assistant\/voice-status$/, handler: voiceStatus },
    { method: 'POST', pattern: /^\/api\/assistant\/transcribe$/, rawBody: true, handler: transcribe },
  ];
}
