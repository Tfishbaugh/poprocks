// Kid safety: no camera until 🎥, the camera always turns off, nothing leaves the device.

import { test, expect } from '@playwright/test';
import { cameraCalls, liveTracks, openCamera, record, startApp, watchCamera } from './helpers.js';

test.beforeEach(async ({ context, page }) => {
  // Safety net: if anything ever tried to reach another site, it fails here instead of going out.
  await context.route((url) => url.hostname !== '127.0.0.1', (route) => route.abort());
  await page.addInitScript(watchCamera);
});

async function hidePage(page) {
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

test('no camera or mic request before 🎥', async ({ page }) => {
  await startApp(page);
  await page.click('.pad >> nth=5');
  await page.click('#play');
  await page.waitForTimeout(500);
  await page.click('#play');
  await page.click('#surprise');
  await page.click('.slot >> nth=2');
  await page.click('.sound >> nth=0');
  expect(await cameraCalls(page)).toBe(0);
  await openCamera(page);
  expect(await cameraCalls(page)).toBe(1);
  expect(await liveTracks(page)).toBe(2);
});

test('✕ turns the camera and mic off', async ({ page }) => {
  await startApp(page);
  await openCamera(page);
  await page.click('#rec-close');
  await expect(page.locator('#beats')).toBeVisible();
  await expect.poll(() => liveTracks(page)).toBe(0);
});

test('the camera is off while watching the video', async ({ page }) => {
  await startApp(page);
  await openCamera(page);
  await record(page, 1);
  await expect.poll(() => liveTracks(page)).toBe(0);
});

test('leaving the app while filming stops, keeps the clip and turns the camera off', async ({ page }) => {
  await startApp(page);
  await openCamera(page);
  await page.click('#rec-btn');
  await expect(page.locator('#rec-btn')).toContainText('Stop', { timeout: 6000 });
  await page.waitForTimeout(1500);
  await hidePage(page);
  await expect(page.locator('#watch')).toBeVisible();
  await expect.poll(() => liveTracks(page)).toBe(0);
});

test('leaving the app on the record screen turns the camera off', async ({ page }) => {
  await startApp(page);
  await openCamera(page);
  await hidePage(page);
  await expect.poll(() => liveTracks(page)).toBe(0);
  await expect(page.locator('#rec-retry')).toBeVisible();
});

test('a camera that is still opening when you leave is closed straight away', async ({ page }) => {
  await page.addInitScript(() => {
    const open = navigator.mediaDevices.getUserMedia;
    navigator.mediaDevices.getUserMedia = (c) => new Promise((done) => setTimeout(() => done(open(c)), 800));
  });
  await startApp(page);
  await page.click('#make-video');
  await page.click('#rec-close');
  await page.waitForTimeout(1500);
  expect(await liveTracks(page)).toBe(0);
});

test('a blocked camera gets a friendly message and a retry', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('no', 'NotAllowedError'));
  });
  await startApp(page);
  await page.click('#make-video');
  await expect(page.locator('#rec-msg')).toContainText('grown-up');
  await expect(page.locator('#rec-retry')).toBeVisible();
  await expect(page.locator('#rec-btn')).toBeDisabled();
});

test('zero requests to other sites, through a whole session', async ({ context, page }, testInfo) => {
  const urls = [];
  context.on('request', (request) => urls.push(request.url()));
  await startApp(page);
  await page.click('#play');
  await page.waitForTimeout(500);
  await page.click('#play');
  await openCamera(page);
  await record(page, 1);
  const origin = new URL(testInfo.project.use.baseURL).origin;
  const outside = urls.filter((url) => !url.startsWith(origin) && !url.startsWith('blob:') && !url.startsWith('data:'));
  expect(urls.length).toBeGreaterThan(5);
  expect(outside).toEqual([]);
});

test('the Content-Security-Policy is set and blocks outside requests', async ({ page }) => {
  await startApp(page);
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("connect-src 'self'");
  expect(csp).not.toContain('unsafe');
  const blocked = await page.evaluate(() => new Promise((done) => {
    document.addEventListener('securitypolicyviolation', (e) => done(e.effectiveDirective), { once: true });
    fetch('https://example.com/').catch(() => {});
  }));
  expect(blocked).toBe('connect-src');
});

test('no outside links on any screen', async ({ page }) => {
  const outsideLinks = () => page.evaluate(() => [...document.querySelectorAll('a[href], area[href], form, iframe')]
    .filter((el) => !el.href?.startsWith('blob:')).length);
  await startApp(page);
  expect(await outsideLinks()).toBe(0);
  await openCamera(page);
  expect(await outsideLinks()).toBe(0);
  await record(page, 1);
  expect(await outsideLinks()).toBe(0);
});
