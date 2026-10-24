// After one visit the app works with Wi-Fi off: load, take the server away, reload.

import { test, expect } from '@playwright/test';
import { serve } from '../../scripts/serve.mjs';
import { tourSeen } from './seen.js';

test('works offline after the first visit', async ({ browser }) => {
  const server = await serve(0);
  const base = `http://127.0.0.1:${server.address().port}/poprocks/`;
  const context = await browser.newContext({ storageState: tourSeen(new URL(base).origin) });
  const page = await context.newPage();
  await page.goto(base);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

  server.closeAllConnections();
  await new Promise((done) => server.close(done));
  const refused = await page.evaluate((url) => fetch(url, { cache: 'no-store' }).then(() => false, () => true), `${base}nope`);
  expect(refused, 'the server is really gone').toBe(true);

  await page.reload();
  await page.click('#start-btn');
  await expect(page.locator('.pad')).toHaveCount(128);
  await page.locator('.pad').nth(3).click();
  await page.click('#play');
  await expect(page.locator('.pad.now').first()).toBeAttached();
  await page.click('#play');
  const iconLoaded = await page.locator('.logo img').evaluate((img) => img.complete && img.naturalWidth > 0);
  expect(iconLoaded).toBe(true);
  await context.close();
});

test('the service worker clears only its own old caches, never other apps on the origin', async ({ browser }) => {
  const server = await serve(0);
  const base = `http://127.0.0.1:${server.address().port}/poprocks/`;
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${base}icons/icon.svg`);
  await page.evaluate(async () => {
    await (await caches.open('other-app-v1')).put('/other/', new Response('theirs'));
    await (await caches.open('poprocks-v0')).put('/poprocks/old', new Response('old'));
  });
  await page.goto(base);
  await page.evaluate(() => navigator.serviceWorker.ready);
  const keys = async () => (await page.evaluate(() => caches.keys())).sort();
  await expect.poll(keys).toEqual(['other-app-v1', 'poprocks-v1']);
  await context.close();
  server.close();
});
