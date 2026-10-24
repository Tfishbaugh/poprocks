// A tiny static server for the tests. It serves the app under /poprocks/, like GitHub Pages,
// so a path that forgets to be relative breaks in tests too. Local only (127.0.0.1).

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const BASE = '/poprocks/';
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

function filePath(url) {
  const { pathname } = new URL(url, 'http://localhost');
  if (!pathname.startsWith(BASE)) return null;
  const rel = decodeURIComponent(pathname.slice(BASE.length)) || 'index.html';
  const full = resolve(ROOT, normalize(rel));
  if (!full.startsWith(ROOT + sep) || !TYPES[extname(full)]) return null;
  return full;
}

async function handle(req, res) {
  try {
    const full = filePath(req.url);
    if (!full) return void res.writeHead(404).end('Not found');
    const body = await readFile(full);
    res.writeHead(200, { 'Content-Type': TYPES[extname(full)], 'Cache-Control': 'no-cache' }).end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
}

export function serve(port = 0) {
  const server = createServer(handle);
  return new Promise((done) => server.listen(port, '127.0.0.1', () => done(server)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = await serve(Number(process.env.PORT ?? 4173));
  console.log(`Serving on http://127.0.0.1:${server.address().port}${BASE}`);
}

