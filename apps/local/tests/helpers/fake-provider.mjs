// TEST DOUBLE ONLY (Fake_Provider, requirement 13.11). Never imported by shipped code.
// A local HTTP server that imitates an OpenAI-compatible chat-completions endpoint.
import http from 'node:http';

/**
 * @param {(call: {n: number, headers: object, body: any}, res: http.ServerResponse) => void} respond
 *   Called for each POST /v1/chat/completions. Default answers 200 with a fixed reply.
 */
export async function startFakeProvider(respond) {
  const calls = [];
  const sockets = new Set();
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      let body = null;
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { /* keep null */ }
      if (req.method !== 'POST' || req.url !== '/v1/chat/completions') {
        res.writeHead(404).end();
        return;
      }
      const call = { n: calls.length + 1, headers: req.headers, body };
      calls.push(call);
      (respond ?? replyWith('ok'))(call, res);
    });
  });
  server.on('connection', (s) => { sockets.add(s); s.on('close', () => sockets.delete(s)); });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  return {
    port,
    baseUrl: `http://127.0.0.1:${port}/v1`,
    calls,
    get count() { return calls.length; },
    close: () => new Promise((resolve) => {
      for (const s of sockets) s.destroy();
      server.close(() => resolve());
    }),
  };
}

/** 200 response whose message content is `content`. */
export function replyWith(content) {
  return (_call, res) => {
    const body = JSON.stringify({ choices: [{ message: { role: 'assistant', content } }] });
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(body);
  };
}

/** A port with nothing listening, for connection-refused tests. */
export async function closedPort() {
  const s = http.createServer();
  await new Promise((resolve) => s.listen(0, '127.0.0.1', resolve));
  const { port } = s.address();
  await new Promise((resolve) => s.close(resolve));
  return port;
}
