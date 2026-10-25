// Toasts (task 84 tweak): a ✕ that closes one at once, and shorter times. A toast stays 2.5 s,
// or 4 s when it asks for something (Undo, Try again); "Video deleted." stays 10 s with no ✕.
// ↩ in the bar still undoes after a toast goes.

import { test, expect } from '@playwright/test';
import { download, openCamera, record, startApp } from './helpers.js';

const SIZES = [{ width: 360, height: 640 }, { width: 640, height: 360 }, { width: 1024, height: 768 }];
const apart = (a, b) => a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;
const showing = (page) => page.locator('#toast:not([hidden])');
const litPads = (page) => page.locator('.pad.on').count();
const pad = (page, track, step) => page.locator(`.pad[data-track="${track}"][data-step="${step}"]`);

async function tool(page, id) {
  if (!(await page.locator(`#${id}`).isVisible())) await page.click('#more');
  await page.click(`#${id}`);
}

// Past the toast's first 0.8 s, when its Undo and ✕ start catching taps.
const settled = (page) => expect(page.locator('#toast.fresh')).toHaveCount(0);

// Each toast's time on screen, in ms, measured in the page from showing to closing.
function timeToasts() {
  window.__toastMs = [];
  let shown = 0;
  const watch = () => {
    const node = document.getElementById('toast');
    new MutationObserver(() => {
      if (!node.hidden) {
        shown = performance.now();
        return;
      }
      window.__toastMs.push(performance.now() - shown);
    }).observe(node, { attributes: true, attributeFilter: ['hidden'] });
  };
  document.addEventListener('DOMContentLoaded', watch);
}

// The next toast to close took about `ms`: a timer can run late on a busy machine, never early.
async function lasted(page, count, ms) {
  await expect.poll(() => page.evaluate(() => window.__toastMs.length), { timeout: ms + 3000 }).toBe(count);
  const took = await page.evaluate((at) => window.__toastMs[at], count - 1);
  expect(took).toBeGreaterThanOrEqual(ms - 50);
  expect(took).toBeLessThan(ms + 600);
}

test('✕ closes a toast at once and runs its end: an effect’s Undo lets the old copy go', async ({ page }) => {
  await page.addInitScript(() => {
    window.__revoked = [];
    const revoke = URL.revokeObjectURL.bind(URL);
    URL.revokeObjectURL = (url) => {
      window.__revoked.push(url);
      revoke(url);
    };
  });
  await startApp(page);
  await openCamera(page);
  await record(page, 1);
  await page.click('#watch-fx');
  await expect(page.locator('#fx-tray')).toBeVisible();
  await page.locator('#fx-filters button', { hasText: 'Gray' }).click();
  await page.click('#fx-use');
  await expect(showing(page)).toContainText('Gray added ✓', { timeout: 15_000 });
  const gray = await page.locator('#playback').evaluate((v) => v.src);
  await page.click('#watch-fx');
  await expect(page.locator('#fx-tray')).toBeVisible();
  await page.locator('#fx-filters button', { hasText: 'None' }).click();
  await page.click('#fx-use');
  await expect(showing(page)).toContainText('Back to the original ✓');
  await settled(page);
  expect(await page.evaluate(() => window.__revoked), 'the gray copy waits on the toast').not.toContain(gray);
  await page.click('#toast-close');
  await expect(page.locator('#toast')).toBeHidden({ timeout: 100 });
  expect(await page.evaluate(() => window.__revoked), 'closing ran the toast’s end').toContain(gray);
  await expect(page.locator('#watch')).toBeVisible();
});

test('a tap on ✕ in its first 0.8 s reaches the pad under it, and the toast stays', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 360 });
  await startApp(page);
  await tool(page, 'clear');
  await expect(showing(page)).toContainText('Beat cleared');
  const box = await page.locator('#toast-close').boundingBox();
  const at = [box.x + box.width / 2, box.y + box.height / 2];
  await expect(page.locator('#toast-close'), 'it shows it isn’t ready yet').not.toHaveCSS('opacity', '1');
  const under = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('.pad')?.dataset, at);
  expect(under, 'a pad is under ✕ at this size').toBeTruthy();
  await page.mouse.click(...at);
  await expect(pad(page, under.track, under.step), 'the tap reached the pad').toHaveAttribute('aria-pressed', 'true');
  await expect(showing(page), 'the quick tap was not ✕').toContainText('Beat cleared');
  await settled(page);
  const caught = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('#toast-close') !== null, at);
  expect(caught, 'after 0.8 s ✕ catches taps').toBe(true);
});

test('a tap at Undo’s edge nearest ✕ is Undo, 16 px from ✕', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await startApp(page);
  const before = await litPads(page);
  await tool(page, 'clear');
  await expect(showing(page)).toContainText('Beat cleared');
  await settled(page);
  const undo = await page.locator('#toast-action').boundingBox();
  const close = await page.locator('#toast-close').boundingBox();
  expect(close.x - (undo.x + undo.width)).toBeGreaterThanOrEqual(15.5);
  await page.mouse.click(undo.x + undo.width - 1, undo.y + undo.height / 2);
  expect(await litPads(page)).toBe(before);
  await expect(page.locator('#toast')).toBeHidden();
});

test('an Undo toast stays 4 s, and ↩ still undoes after it goes', async ({ page }) => {
  await page.addInitScript(timeToasts);
  await startApp(page);
  const before = await litPads(page);
  await page.click('#clear');
  await lasted(page, 1, 4000);
  await page.click('#copy');
  await page.locator('.copy-slot[data-slot="2"]').click();
  await expect(showing(page)).toContainText('Now on beat 3');
  await lasted(page, 2, 4000);
  await page.click('#undo');
  await page.click('.slot[data-slot="0"]');
  await page.click('#undo');
  expect(await litPads(page)).toBe(before);
});

test('a note stays 2.5 s, and "Video deleted." stays 10 s with no ✕, even for Escape', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await page.addInitScript(timeToasts);
  await startApp(page);
  await openCamera(page);
  await record(page, 1);
  await download(page, testInfo);
  await expect(showing(page)).toContainText('Saved to Downloads');
  await expect(page.locator('#toast-close')).toBeVisible();
  await lasted(page, 1, 2500);
  await page.click('#watch-delete');
  await expect(showing(page)).toContainText('Video deleted');
  await expect(page.locator('#toast-close')).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(showing(page), 'Escape leaves it, as there is no ✕').toContainText('Video deleted');
  await lasted(page, 2, 10_000);
});

test('a "Try again" note stays 4 s', async ({ page }) => {
  await page.addInitScript(timeToasts);
  await page.addInitScript(() => {
    const Real = window.MediaRecorder;
    window.MediaRecorder = class extends Real {
      addEventListener(type, handler, options) {
        const empty = () => handler({ data: new Blob([]) });
        super.addEventListener(type, type === 'dataavailable' ? empty : handler, options);
      }
    };
  });
  await startApp(page);
  await openCamera(page);
  await page.click('#rec-btn');
  await expect(page.locator('#rec-btn')).toContainText('Stop', { timeout: 6000 });
  await page.waitForTimeout(1000);
  await page.click('#rec-btn');
  await expect(showing(page)).toContainText('Try again');
  await lasted(page, 1, 4000);
});

test('Escape closes a toast and stays on Beats; on a phone, open More closes first', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await startApp(page);
  await page.click('#more');
  await page.click('#clear');
  await expect(showing(page)).toContainText('Beat cleared');
  await expect(page.locator('#bar'), 'More is still open').toHaveClass(/more-open/);
  await page.keyboard.press('Escape');
  await expect(page.locator('#bar')).not.toHaveClass(/more-open/);
  await expect(showing(page), 'More closed first').toContainText('Beat cleared');
  await page.keyboard.press('Escape');
  await expect(page.locator('#toast')).toBeHidden();
  await expect(page.locator('#beats')).toBeVisible();
});

test('Escape closes a sheet over a toast first', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await startApp(page);
  await page.click('#clear');
  await expect(showing(page)).toContainText('Beat cleared');
  await page.click('#copy');
  await expect(page.locator('#copy-sheet')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#copy-sheet')).toBeHidden();
  await expect(showing(page), 'the sheet closed first').toContainText('Beat cleared');
});

test('Escape on a toast you Tab to sends focus back to Play', async ({ page }) => {
  await startApp(page);
  await page.click('#clear');
  await page.locator('#toast-close').focus();
  await page.keyboard.press('Escape');
  await expect(page.locator('#toast')).toBeHidden();
  await expect(page.locator('#play')).toBeFocused();
});

for (const size of SIZES) {
  for (const colorScheme of ['light', 'dark']) {
    test(`at ${size.width}×${size.height} in ${colorScheme}, ✕ is big, named Close, and clear of ➖, ➕ and Undo`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.emulateMedia({ colorScheme });
      await startApp(page);
      await tool(page, 'copy');
      await page.locator('.copy-sound[data-track="7"]').click();
      await page.locator('.copy-sound[data-track="5"]').click();
      await expect(showing(page)).toContainText('Copied');
      await settled(page);
      const close = page.locator('#toast-close');
      await expect(close).toHaveAccessibleName('Close');
      const box = await close.boundingBox();
      expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(48);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(size.width);
      expect(apart(box, await page.locator('#toast-action').boundingBox()), 'clear of Undo').toBe(true);
      for (const id of ['shorter', 'longer', 'shorter-tool', 'longer-tool']) {
        if (await page.locator(`#${id}`).isVisible()) expect(apart(box, await page.locator(`#${id}`).boundingBox()), `clear of #${id}`).toBe(true);
      }
      const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(wide, 'no sideways scroll').toBe(false);
    });
  }
}
