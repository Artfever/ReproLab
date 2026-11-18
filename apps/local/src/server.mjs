// server.mjs: loopback-only HTTP server skeleton (spec 03-local-product, task 3.1).
// Requirements 3.1 to 3.10. Node built-ins only. Route groups live in ./routes/*.mjs and
// are filled in by later tasks; until then they answer 501.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import os from 'node:os';
import { scrubPaths } from './sanitize.mjs';
import * as realDocker from './docker.mjs';
import { createRunManager } from './runs.mjs';
import { routes as healthRoutes } from './routes/health.mjs';
import { routes as demosRoutes } from './routes/demos.mjs';
import { routes as runsRoutes } from './routes/runs.mjs';
import { routes as assistantRoutes } from './routes/assistant.mjs';
import { MAX_AUDIO_BYTES } from '../assistant/transcription.mjs';

export const BIND_ADDRESS = '127.0.0.1';
export const DEFAULT_PORT = 8765;
export const MAX_BODY_BYTES = 1024 * 1024;
export const MAX_AUDIO_REQUEST_BYTES = MAX_AUDIO_BYTES + 16 * 1024;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PUBLIC_DIR = path.resolve(HERE, '..', 'public');
const REPO_ROOT = path.resolve(HERE, '..', '..', '..');

export const SECURITY_HEADERS = Object.freeze({
  'Content-Security-Policy': "default-src 'self'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'microphone=(self)',
  'Cache-Control': 'no-store',
});

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const HOST_RE = /^(127\.0\.0\.1|localhost|\[::1\]):(\d{1,5})$/i;

/** Parse REPROLAB_PORT. Throws on a bad value. */
export function parsePort(value) {
  if (value === undefined || value === '') return DEFAULT_PORT;
  if (!/^\d{1,5}$/.test(value) || Number(value) > 65535) {
    throw new Error('REPROLAB_PORT must be a whole number from 0 to 65535.');
  }
  return Number(value);
}

/** The bind address is fixed. Any attempt to configure one is refused. */
export function assertNoBindOverride(env) {
  for (const key of ['REPROLAB_HOST', 'REPROLAB_BIND', 'REPROLAB_BIND_ADDRESS', 'REPROLAB_ADDRESS']) {
    if (env[key] !== undefined && env[key] !== '') {
      throw new Error(`${key} is not supported. The server only listens on ${BIND_ADDRESS}.`);
    }
  }
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function send(res, status, { headers = {}, body = '', contentType } = {}) {
  if (res.headersSent) return;
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(String(body), 'utf8');
  const h = { ...SECURITY_HEADERS, ...headers, 'Content-Length': buf.length };
  if (contentType) h['Content-Type'] = contentType;
  res.writeHead(status, h);
  res.end(buf);
}

function sendJson(res, status, obj, headers = {}) {
  send(res, status, {
    headers,
    body: JSON.stringify(obj),
    contentType: 'application/json; charset=utf-8',
  });
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    let done = false;
    const finish = (fn, v) => {
      if (done) return;
      done = true;
      req.off('data', onData);
      req.off('end', onEnd);
      req.off('error', onError);
      fn(v);
    };
    const onData = (chunk) => {
      total += chunk.length;
      if (total > limit) {
        req.pause();
        finish(reject, new HttpError(413, 'The request body is larger than 1 MiB.'));
        return;
      }
      chunks.push(chunk);
    };
    const onEnd = () => finish(resolve, Buffer.concat(chunks));
    const onError = (e) => finish(reject, e);
    req.on('data', onData);
    req.on('end', onEnd);
    req.on('error', onError);
  });
}

function parseJsonBody(buf) {
  if (buf.length === 0) throw new HttpError(400, 'The request body must be JSON, but it was empty.');
  try {
    return JSON.parse(buf.toString('utf8'));
  } catch {
    throw new HttpError(400, 'The request body is not valid JSON.');
  }
}

function buildRouteTable(deps) {
  return [
    ...healthRoutes(deps),
    ...demosRoutes(deps),
    ...runsRoutes(deps),
    ...assistantRoutes(deps),
  ];
}

function serveStatic(publicDir, urlPath, method, res) {
  if (method !== 'GET' && method !== 'HEAD') {
    send(res, 405, { headers: { Allow: 'GET, HEAD' }, body: 'Method not allowed.', contentType: 'text/plain; charset=utf-8' });
    return;
  }
  const notFound = () =>
    send(res, 404, { body: 'Not found.', contentType: 'text/plain; charset=utf-8' });
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return notFound();
  }
  if (decoded.includes('\0') || decoded.includes('\\')) return notFound();
  const segments = decoded.split('/').filter((s) => s !== '');
  if (segments.some((s) => s === '..' || s === '.' || s.startsWith('.'))) return notFound();
  const rel = segments.length === 0 ? 'index.html' : segments.join('/');
  const root = path.resolve(publicDir);
  const full = path.resolve(root, rel);
  if (full !== root && !full.startsWith(root + path.sep)) return notFound();
  let st;
  try {
    st = fs.statSync(full);
  } catch {
    return notFound();
  }
  if (!st.isFile()) return notFound();
  const type = MIME[path.extname(full).toLowerCase()] ?? 'application/octet-stream';
  let data;
  try {
    data = fs.readFileSync(full);
  } catch {
    return notFound();
  }
  send(res, 200, { body: method === 'HEAD' ? Buffer.alloc(0) : data, contentType: type, headers: method === 'HEAD' ? { 'Content-Length': data.length } : {} });
}

/**
 * Build the server. Nothing listens until `listen()` is called.
 * @param {{docker?: object, runs?: object, provider?: object, publicDir?: string, log?: (msg: string) => void}} [deps]
 */
export function createServer(deps = {}) {
  const publicDir = deps.publicDir ?? DEFAULT_PUBLIC_DIR;
  const log = deps.log ?? ((m) => console.error(m));
  const table = buildRouteTable(deps);
  const roots = [REPO_ROOT, os.homedir(), process.cwd()];

  const server = http.createServer((req, res) => {
    handle(req, res).catch((err) => {
      try {
        log(`Unhandled error: ${scrubPaths(String(err?.stack ?? err), roots)}`);
      } catch {
        /* logging must never throw */
      }
      sendJson(res, 500, { error: 'Something went wrong in the local server.' });
    });
  });
  server.requestTimeout = 60_000;
  server.headersTimeout = 15_000;

  function serverPort() {
    const a = server.address();
    return a && typeof a === 'object' ? a.port : undefined;
  }

  function hostOk(host) {
    const m = typeof host === 'string' ? HOST_RE.exec(host) : null;
    return Boolean(m) && Number(m[2]) === serverPort();
  }

  function originOk(origin) {
    const p = serverPort();
    return origin === `http://127.0.0.1:${p}` || origin === `http://localhost:${p}`;
  }

  async function handle(req, res) {
    if (!hostOk(req.headers.host)) return send(res, 403, { body: 'Forbidden.', contentType: 'text/plain; charset=utf-8' });
    if (req.headers.origin !== undefined && !originOk(req.headers.origin)) {
      return send(res, 403, { body: 'Forbidden.', contentType: 'text/plain; charset=utf-8' });
    }
    const method = req.method ?? 'GET';
    let url;
    try {
      url = new URL(req.url ?? '/', `http://${BIND_ADDRESS}`);
    } catch {
      return send(res, 400, { body: 'Bad request.', contentType: 'text/plain; charset=utf-8' });
    }

    const matching = [];
    for (const r of table) {
      const m = r.pattern.exec(url.pathname);
      if (m) matching.push({ route: r, params: m.groups ?? {} });
    }
    if (matching.length === 0) {
      if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
        return sendJson(res, 404, { error: 'Not found.' });
      }
      return serveStatic(publicDir, url.pathname, method, res);
    }
    const hit = matching.find((x) => x.route.method === method);
    if (!hit) {
      const allow = [...new Set(matching.map((x) => x.route.method))].join(', ');
      return sendJson(res, 405, { error: 'Method not allowed.' }, { Allow: allow });
    }

    let body;
    if (method === 'POST') {
      try {
        body = await readBody(req, hit.route.rawBody ? MAX_AUDIO_REQUEST_BYTES : MAX_BODY_BYTES);
        if (!hit.route.rawBody) body = parseJsonBody(body);
      } catch (e) {
        if (e instanceof HttpError) {
          const headers = e.status === 413 ? { Connection: 'close' } : {};
          return sendJson(res, e.status, { error: e.message }, headers);
        }
        throw e;
      }
    }
    const out = await hit.route.handler({ req, url, params: hit.params, body, deps });
    if (out && out.stream) return out.stream(res, { send, sendJson });
    sendJson(res, out?.status ?? 200, out?.json ?? {}, out?.headers ?? {});
  }

  return {
    server,
    /** Listen on 127.0.0.1 only. Port 0 picks a free port (tests). */
    listen(port = DEFAULT_PORT) {
      return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, BIND_ADDRESS, () => {
          server.off('error', reject);
          resolve(server.address());
        });
      });
    },
    close() {
      return new Promise((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections?.();
      });
    },
  };
}

async function main() {
  assertNoBindOverride(process.env);
  const port = parsePort(process.env.REPROLAB_PORT);
  // Built here (not lazily) so stale labelled containers are removed at start (Requirement 5.11).
  const runs = createRunManager({ docker: realDocker });
  const app = createServer({ runs });
  const addr = await app.listen(port);
  console.log(`ReproLab local server: http://${BIND_ADDRESS}:${addr.port}/`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((e) => {
    console.error(String(e?.message ?? e));
    process.exit(1);
  });
}
