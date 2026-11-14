// assistant/provider.mjs: OpenAI-compatible chat-completions client (requirements 13.1, 13.6 to 13.8).
// Settings come only from the server environment. Dependency-free (node:* only).
// The API key is sent only in the Authorization header. No message, error or log line built here contains it.
import http from 'node:http';
import https from 'node:https';

export const PROVIDER_TIMEOUT_MS = 60_000;
export const PROVIDER_MAX_RESPONSE_BYTES = 64 * 1024;
export const ERROR_CLASSES = Object.freeze(['unreachable', 'timeout', 'bad_status', 'malformed']);

export class ProviderError extends Error {
  /** @param {'unreachable'|'timeout'|'bad_status'|'malformed'} cls */
  constructor(cls, message) {
    super(message);
    this.name = 'ProviderError';
    this.class = cls;
  }
}

/**
 * Validate a Provider base URL. Only http and https, no embedded credentials,
 * no query or fragment. Returns {ok:true, url} (no trailing slash) or {ok:false, reason}.
 */
export function parseBaseUrl(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') return { ok: false, reason: 'No language-model endpoint is configured' };
  let u;
  try {
    u = new URL(raw.trim());
  } catch {
    return { ok: false, reason: 'The language-model endpoint address is not a valid URL' };
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    return { ok: false, reason: 'The language-model endpoint must start with http:// or https://' };
  }
  if (u.username !== '' || u.password !== '') {
    return { ok: false, reason: 'The language-model endpoint address must not contain a user name or password' };
  }
  if (u.search !== '' || u.hash !== '' || u.hostname === '') {
    return { ok: false, reason: 'The language-model endpoint address must be a plain base URL' };
  }
  return { ok: true, url: u.href.replace(/\/+$/, '') };
}

/**
 * Read Provider settings from an environment object (default process.env).
 * Returns {ok:true, baseUrl, model, apiKey|null} or {ok:false, reason}. The reason never contains the key.
 */
export function readConfig(env = process.env) {
  const base = parseBaseUrl(env.REPROLAB_LLM_BASE_URL);
  if (!base.ok) return base;
  const model = typeof env.REPROLAB_LLM_MODEL === 'string' ? env.REPROLAB_LLM_MODEL.trim() : '';
  if (model === '') return { ok: false, reason: 'No language-model name is configured' };
  if (model.length > 200 || !/^[\x20-\x7E]+$/.test(model)) {
    return { ok: false, reason: 'The language-model name is not valid' };
  }
  let apiKey = null;
  const rawKey = env.REPROLAB_LLM_API_KEY;
  if (typeof rawKey === 'string' && rawKey.trim() !== '') {
    apiKey = rawKey.trim();
    if (apiKey.length > 4096 || !/^[\x21-\x7E]+$/.test(apiKey)) {
      return { ok: false, reason: 'The language-model API key setting is not valid' };
    }
  }
  return { ok: true, baseUrl: base.url, model, apiKey };
}

/** Replace every occurrence of the key in text. Used on anything that leaves the server. */
export function scrubKey(text, apiKey) {
  if (typeof text !== 'string' || !apiKey) return text;
  return text.split(apiKey).join('[redacted]');
}

export const PROBE_TIMEOUT_MS = 3000;

/**
 * Health probe: GET <baseUrl>/models. The endpoint counts as reachable when it sends any HTTP
 * response within the timeout (the status code is not judged: this checks reachability only,
 * not that the model works). Resolves {reachable:boolean}; never rejects. No redirects are followed.
 * The key, when set, goes only in the Authorization header.
 */
export function probeEndpoint(config, timeoutMs = PROBE_TIMEOUT_MS) {
  const target = new URL(`${config.baseUrl}/models`);
  const headers = { Accept: 'application/json', Connection: 'close' };
  if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;
  const lib = target.protocol === 'https:' ? https : http;
  return new Promise((resolve) => {
    let settled = false;
    let req;
    const done = (reachable) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { req?.destroy(); } catch { /* ignore */ }
      resolve({ reachable });
    };
    const timer = setTimeout(() => done(false), timeoutMs);
    try {
      req = lib.request(target, { method: 'GET', headers, agent: false }, (res) => {
        res.resume();
        done(true);
      });
      req.on('error', () => done(false));
      req.end();
    } catch {
      done(false);
    }
  });
}

/**
 * POST <baseUrl>/chat/completions. Resolves to the assistant message text.
 * Rejects with ProviderError of class unreachable, timeout, bad_status or malformed.
 */
export function chatCompletion(config, messages, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? PROVIDER_TIMEOUT_MS;
  const maxBytes = opts.maxBytes ?? PROVIDER_MAX_RESPONSE_BYTES;
  const target = new URL(`${config.baseUrl}/chat/completions`);
  const payload = Buffer.from(JSON.stringify({ model: config.model, messages, temperature: 0 }), 'utf8');
  const headers = {
    'Content-Type': 'application/json',
    'Content-Length': payload.length,
    Accept: 'application/json',
    Connection: 'close',
  };
  if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;
  const lib = target.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) => {
    let settled = false;
    let req;
    const done = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (fn === reject) { try { req?.destroy(); } catch { /* ignore */ } }
      fn(value);
    };
    const timer = setTimeout(
      () => done(reject, new ProviderError('timeout', `The language-model endpoint did not answer within ${Math.round(timeoutMs / 1000)} seconds.`)),
      timeoutMs,
    );
    req = lib.request(target, { method: 'POST', headers, agent: false }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        done(reject, new ProviderError('bad_status', `The language-model endpoint answered with HTTP status ${res.statusCode}.`));
        return;
      }
      const chunks = [];
      let total = 0;
      res.on('data', (c) => {
        total += c.length;
        if (total > maxBytes) {
          done(reject, new ProviderError('malformed', `The language-model answer was larger than ${maxBytes / 1024} KiB.`));
          return;
        }
        chunks.push(c);
      });
      res.on('error', () => done(reject, new ProviderError('malformed', 'The language-model answer ended early.')));
      res.on('aborted', () => done(reject, new ProviderError('malformed', 'The language-model answer ended early.')));
      res.on('end', () => {
        let content;
        try {
          const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          content = parsed?.choices?.[0]?.message?.content;
        } catch {
          done(reject, new ProviderError('malformed', 'The language-model answer was not valid JSON.'));
          return;
        }
        if (typeof content !== 'string' || content.trim() === '') {
          done(reject, new ProviderError('malformed', 'The language-model answer had no message text.'));
          return;
        }
        done(resolve, content);
      });
    });
    req.on('error', () => done(reject, new ProviderError('unreachable', 'The language-model endpoint could not be reached.')));
    req.end(payload);
  });
}
