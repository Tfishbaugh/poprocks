// The local test server: serves the app under /poprocks/ and nothing outside it.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { serve } from '../../scripts/serve.mjs';

const server = await serve(0);
const base = `http://127.0.0.1:${server.address().port}`;
after(() => server.close());

const status = async (path) => (await fetch(base + path)).status;

test('serves the app under /poprocks/', async () => {
  assert.equal(await status('/poprocks/'), 200);
  assert.equal(await status('/poprocks/js/main.js'), 200);
  const res = await fetch(`${base}/poprocks/js/main.js`);
  assert.match(res.headers.get('content-type'), /text\/javascript/);
});

test('nothing outside /poprocks/ or outside the repo', async () => {
  const paths = ['/', '/index.html', '/poprocks/../package.json', '/poprocks/..%2fpackage.json',
    '/poprocks/%2e%2e%2f%2e%2e%2fetc%2fpasswd', '/poprocks/%2fetc%2fpasswd', '/poprocks/package.json', '/poprocks/js/'];
  for (const path of paths) assert.equal(await status(path), 404, path);
});

test('broken %-encoding gets a 404 instead of crashing the server', async () => {
  assert.equal(await status('/poprocks/%E0%A4%A'), 404);
  assert.equal(await status('/poprocks/%'), 404);
  assert.equal(await status('/poprocks/'), 200, 'still running');
});
