// Tests for server.mjs (spec 03-local-product task 3.1; Requirements 3.1 to 3.10).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createServer, assertNoBindOverride, parsePort, MAX_BODY_BYTES } from '../src/server.mjs';
import { createRunManager } from '../src/runs.mjs';
import { createFakeDocker } from './helpers/fake-docker.mjs';

let app;
let port;
let tmp;

// Raw request so tests control Host, Origin and the exact path.
function request({ method = 'GET', path: p = '/', headers = {}, body, chunks }) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port, method, path: p, headers, agent: false },
      (res) => {
        const parts = [];
        res.on('data', (c) => parts.push(c));
        const done = () =>
          resolve({ status: res.statusCode, headers: res.headers, text: Buffer.concat(parts).toString('utf8') });
        res.on('end', done);
        res.on('error', done);
        res.on('close', done);
      },
    );
    req.on('error', (e) => {
      // A 413 may reset the connection while the client is still writing.
      if (!['ECONNRESET', 'EPIPE'].includes(e.code)) reject(e);
    });
    if (chunks) {
      for (const c of chunks) req.write(c);
      req.end();
    } else {
      req.end(body);
    }
  });
}

before(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rl-server-'));
  const pub = path.join(tmp, 'public');
  fs.mkdirSync(pub);
  fs.writeFileSync(path.join(pub, 'index.html'), '<!doctype html><title>t</title>');
  fs.writeFileSync(path.join(pub, 'a.css'), 'body{}');
  fs.mkdirSync(path.join(pub, 'fonts'));
  fs.writeFileSync(path.join(pub, 'fonts', 'f.woff2'), Buffer.from('wOF2'));
  fs.writeFileSync(path.join(pub, 'p.webp'), Buffer.from('RIFF'));
  fs.writeFileSync(path.join(tmp, 'secret.txt'), 'SECRET');
  const runs = createRunManager({ docker: createFakeDocker(), dataDir: path.join(tmp, 'data'), image: 'reprolab-openbugs:test' });
  app = createServer({ publicDir: pub, log: () => {}, runs });
  port = (await app.listen(0)).port;
});

after(async () => {
  await app.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('binds to 127.0.0.1 only', () => {
  assert.equal(app.server.address().address, '127.0.0.1');
});

test('bind-address settings are refused and ports are validated', () => {
  assert.throws(() => assertNoBindOverride({ REPROLAB_HOST: '0.0.0.0' }), /not supported/);
  assert.throws(() => assertNoBindOverride({ REPROLAB_BIND: '::' }), /not supported/);
  assert.doesNotThrow(() => assertNoBindOverride({}));
  assert.equal(parsePort(undefined), 8765);
  assert.equal(parsePort('0'), 0);
  assert.throws(() => parsePort('70000'));
  assert.throws(() => parsePort('abc'));
});

test('bad Host header gets 403', async () => {
  for (const host of ['evil.example', `evil.example:${port}`, '127.0.0.1', `127.0.0.1:${port + 1}`, `10.0.0.5:${port}`]) {
    const r = await request({ path: '/api/health', headers: { Host: host } });
    assert.equal(r.status, 403, `Host ${host}`);
  }
});

test('localhost and 127.0.0.1 hosts are accepted', async () => {
  for (const host of [`localhost:${port}`, `127.0.0.1:${port}`]) {
    const r = await request({ path: '/api/health', headers: { Host: host } });
    assert.equal(r.status, 200, `Host ${host}`);
  }
});

test('bad Origin gets 403, good Origins pass', async () => {
  for (const origin of ['http://evil.example', `http://evil.example:${port}`, 'null', `https://127.0.0.1:${port}`, `http://127.0.0.1:${port + 1}`]) {
    const r = await request({ path: '/api/health', headers: { Origin: origin } });
    assert.equal(r.status, 403, `Origin ${origin}`);
  }
  for (const origin of [`http://127.0.0.1:${port}`, `http://localhost:${port}`]) {
    const r = await request({ path: '/api/health', headers: { Origin: origin } });
    assert.equal(r.status, 200, `Origin ${origin}`);
  }
});

test('body of exactly 1 MiB is read; 1 MiB + 1 byte gets 413', async () => {
  const ok = await request({
    method: 'POST',
    path: '/api/validate',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pad: 'x'.repeat(MAX_BODY_BYTES - 20) }),
  });
  assert.equal(ok.status, 200);

  const piece = Buffer.alloc(64 * 1024, 0x61);
  const chunks = [];
  let sent = 0;
  while (sent < MAX_BODY_BYTES + 1) {
    const n = Math.min(piece.length, MAX_BODY_BYTES + 1 - sent);
    chunks.push(piece.subarray(0, n));
    sent += n;
  }
  const big = await request({ method: 'POST', path: '/api/validate', headers: { 'Content-Type': 'application/json' }, chunks });
  assert.equal(big.status, 413);
});

test('invalid JSON and empty body get 400 without a stack trace', async () => {
  for (const body of ['{not json', '']) {
    const r = await request({ method: 'POST', path: '/api/runs', headers: { 'Content-Type': 'application/json' }, body });
    assert.equal(r.status, 400);
    assert.ok(!/\bat\s.+\(.+:\d+:\d+\)/.test(r.text), 'no stack trace');
    assert.ok(JSON.parse(r.text).error.length > 10);
  }
});

test('wrong method gets 405 with Allow; static rejects POST', async () => {
  const a = await request({ method: 'POST', path: '/api/health', body: '{}' });
  assert.equal(a.status, 405);
  assert.equal(a.headers.allow, 'GET');
  const b = await request({ method: 'GET', path: '/api/runs' });
  assert.equal(b.status, 405);
  const c = await request({ method: 'DELETE', path: '/api/assistant/ask' });
  assert.equal(c.status, 405);
  const d = await request({ method: 'POST', path: '/index.html', body: '{}' });
  assert.equal(d.status, 405);
});

test('path traversal and dotfiles get 404', async () => {
  for (const p of ['/../secret.txt', '/%2e%2e/secret.txt', '/..%2fsecret.txt', '/a/../../secret.txt', '/%5c..%5csecret.txt', '/..\\secret.txt', '/%00', '/.hidden', '/nope.html']) {
    const r = await request({ path: p });
    assert.equal(r.status, 404, p);
    assert.ok(!r.text.includes('SECRET'), p);
  }
});

test('static files are served and every response carries the security headers', async () => {
  const cases = [
    ['/', 200],
    ['/index.html', 200],
    ['/a.css', 200],
    ['/missing', 404],
    ['/api/health', 200],
    ['/api/nothing', 404],
    ['/api/runs', 405],
  ];
  for (const [p, status] of cases) {
    const r = await request({ path: p });
    assert.equal(r.status, status, p);
    assert.equal(r.headers['content-security-policy'], "default-src 'self'", p);
    assert.equal(r.headers['x-content-type-options'], 'nosniff', p);
    assert.equal(r.headers['referrer-policy'], 'no-referrer', p);
    assert.equal(r.headers['permissions-policy'], 'microphone=(self)', p);
    assert.equal(r.headers['cache-control'], 'no-store', p);
  }
  const bad = await request({ path: '/', headers: { Host: 'evil.example' } });
  assert.equal(bad.headers['content-security-policy'], "default-src 'self'");
});

test('self-hosted fonts and images get their own content type with the security headers (spec 05 task 2)', async () => {
  for (const [p, type] of [['/fonts/f.woff2', 'font/woff2'], ['/p.webp', 'image/webp']]) {
    const r = await request({ path: p });
    assert.equal(r.status, 200, p);
    assert.equal(r.headers['content-type'], type, p);
    assert.equal(r.headers['content-security-policy'], "default-src 'self'", p);
    assert.equal(r.headers['x-content-type-options'], 'nosniff', p);
  }
});

test('all required routes exist (a handler answers; never 404 or 405 for the documented method)', async () => {
  const routes = [
    ['GET', '/api/health'],
    ['GET', '/api/demos'],
    ['POST', '/api/validate'],
    ['POST', '/api/runs'],
    ['GET', `/api/runs/${'0'.repeat(32)}`],
    ['GET', `/api/runs/${'0'.repeat(32)}/manifest`],
    ['GET', `/api/runs/${'0'.repeat(32)}/files/log.txt`],
    ['POST', '/api/assistant/ask'],
    ['GET', '/api/assistant/status'],
    ['GET', '/api/assistant/voice-status'],
    ['POST', '/api/assistant/transcribe'],
  ];
  for (const [method, p] of routes) {
    const r = await request({ method, path: p, body: method === 'POST' ? '{}' : undefined });
    // Unknown run ids legitimately answer 404 with a JSON error body; a missing route answers 404 with "Not found."
    assert.notEqual(r.status, 405, `${method} ${p}`);
    if (r.status === 404) assert.match(r.text, /Run not found|File not found/, `${method} ${p}`);
  }
});
