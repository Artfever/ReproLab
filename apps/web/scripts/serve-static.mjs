// Serves ./out on 127.0.0.1 for local checks. Not for production.
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'out');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.txt': 'text/plain', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

export function createServer() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    let rel = decodeURIComponent(url.pathname);
    if (rel.includes('..')) { res.writeHead(400).end('bad path'); return; }
    let file = path.join(root, rel);
    try {
      if ((await stat(file)).isDirectory()) {
        // Next static export writes /x.html next to an /x/ directory of data files.
        const index = path.join(file, 'index.html');
        file = await stat(index).then(() => index, () => file.replace(/[\\/]+$/, '') + '.html');
      }
    } catch { if (!path.extname(file)) file += '.html'; }
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' }).end(body);
    } catch {
      let body = '';
      try { body = await readFile(path.join(root, '404.html')); } catch { /* none */ }
      res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' }).end(body);
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 4173);
  createServer().listen(port, '127.0.0.1', () => console.log(`http://127.0.0.1:${port}`));
}