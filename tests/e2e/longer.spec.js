// Longer beats (task 80, pick 1c): one long strip of up to 64 steps, ➕ and ➖, ❮ ❯, the map,
// and a playhead that follows without ever moving the grid from under a finger.

import { test, expect } from '@playwright/test';
import { openCamera, startApp } from './helpers.js';

const pad = (page, track, step) => page.locator(`.pad[data-track="${track}"][data-step="${step}"]`);
const padCount = (page) => page.locator('.pad').count();
const scrolled = (page) => page.locator('#grid-wrap').evaluate((el) => el.scrollLeft + el.scrollTop);

async function makeLong(page, times) {
  for (let i = 0; i < times; i += 1) await page.click('#longer');
}

async function fastest(page) {
  for (let i = 0; i < 8; i += 1) await page.click('#faster');
  await expect(page.locator('#bpm .num')).toHaveText('180');
}

// The pad is on screen and not hidden under the pinned sound names.
async function uncovered(locator) {
  return locator.evaluate((node) => {
    const box = node.getBoundingClientRect();
    return document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2) === node;
  });
}

// Each step is lit for ~83 ms at 180 BPM, too short to poll for, so the page records every step it lights.
async function recordPlayhead(page) {
  await page.evaluate(() => {
    window.__played = new Set();
    const seen = (record) => record.target.classList.contains('now') && window.__played.add(Number(record.target.dataset.step));
    new MutationObserver((records) => records.forEach(seen))
      .observe(document.getElementById('grid'), { attributes: true, attributeFilter: ['class'], subtree: true });
  });
}

const played = (page, step) => page.evaluate((s) => window.__played.has(s), step);

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.emulateMedia({ reducedMotion: 'reduce' }); // instant scrolls, so taps land where they aim
});

test('➕ makes the beat 16 steps longer, up to 64, and shows the new part', async ({ page }) => {
  await startApp(page);
  expect(await padCount(page)).toBe(128);
  await page.click('#longer');
  expect(await padCount(page)).toBe(256);
  await expect(pad(page, 0, 16), 'the new part copies the last 16 steps').toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => uncovered(pad(page, 0, 16))).toBe(true);
  await expect(page.locator('#sr-status')).toHaveText('Your beat is now 32 steps long.');
  await makeLong(page, 2);
  expect(await padCount(page)).toBe(512);
  await expect(page.locator('#longer')).toBeDisabled();
  await expect(pad(page, 7, 63)).toHaveAttribute('aria-label', 'Boing, step 64');
});

test('➖ Shorter takes 16 steps away, and Undo brings them back', async ({ page }) => {
  await startApp(page);
  await expect(page.locator('#shorter')).toBeDisabled();
  await page.click('#longer');
  await pad(page, 6, 20).click();
  await page.click('#shorter');
  expect(await padCount(page)).toBe(128);
  await expect(page.locator('#toast')).toContainText('Made shorter');
  await page.click('#toast-action');
  expect(await padCount(page)).toBe(256);
  await expect(pad(page, 6, 20)).toHaveAttribute('aria-pressed', 'true');
});

test('a long beat plays all the way through, then loops', async ({ page }) => {
  await startApp(page);
  await makeLong(page, 3);
  await fastest(page);
  await recordPlayhead(page);
  await page.click('#play');
  await expect(page.locator('#strip-dot')).toBeVisible();
  await expect.poll(() => played(page, 63), { timeout: 10_000 }).toBe(true);
  await page.evaluate(() => window.__played.clear());
  await expect.poll(() => played(page, 4), { timeout: 10_000 }).toBe(true);
  await page.click('#play');
  await expect(page.locator('#strip-dot')).toBeHidden();
});

test('❮ ❯ move a screenful, and the map shows how much is on screen', async ({ page }) => {
  await startApp(page);
  await expect(page.locator('#strip-back')).toBeDisabled();
  await expect(page.locator('#strip-next')).toBeDisabled();
  await page.click('#longer');
  await page.locator('#grid-wrap').evaluate((el) => { el.scrollLeft = 0; });
  await expect(page.locator('#strip-back')).toBeDisabled();
  await page.click('#strip-next');
  await expect.poll(() => uncovered(pad(page, 0, 16))).toBe(true);
  await expect(page.locator('#strip-next')).toBeDisabled();
  await page.click('#strip-back');
  await expect.poll(() => scrolled(page)).toBeLessThan(2);
  const map = await page.locator('#strip-map').boundingBox();
  const view = await page.locator('#strip-view').boundingBox();
  expect(view.width / map.width).toBeGreaterThan(0.4);
  expect(view.width / map.width).toBeLessThan(0.6);
});

test('tapping or dragging the map jumps along the beat', async ({ page }) => {
  await startApp(page);
  await makeLong(page, 3);
  const map = await page.locator('#strip-map').boundingBox();
  await page.mouse.click(map.x + 4, map.y + map.height / 2);
  await expect.poll(() => uncovered(pad(page, 0, 0))).toBe(true);
  await page.mouse.move(map.x + 4, map.y + map.height / 2);
  await page.mouse.down();
  await page.mouse.move(map.x + map.width - 2, map.y + map.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => uncovered(pad(page, 0, 63))).toBe(true);
});

test('the playhead follows, but never moves the grid from under a finger', async ({ page }) => {
  await startApp(page);
  await makeLong(page, 3);
  await fastest(page);
  await page.locator('#grid-wrap').evaluate((el) => { el.scrollLeft = 0; });
  await recordPlayhead(page);
  await page.click('#play');
  const box = await pad(page, 4, 2).boundingBox();
  await page.mouse.move(box.x + 10, box.y + 10);
  await page.mouse.down();
  await expect.poll(() => played(page, 30), { timeout: 10_000 }).toBe(true);
  expect(await scrolled(page), 'a finger is on the grid').toBe(0);
  await page.mouse.up();
  await page.waitForTimeout(1500);
  expect(await scrolled(page), 'and just after it lifts').toBe(0);
  await page.click('#play');
  await page.click('#play');
  await expect.poll(() => scrolled(page), { timeout: 8000 }).toBeGreaterThan(100);
  await page.click('#play');
});

test('a long beat is saved and comes back after a reload', async ({ page }) => {
  await startApp(page);
  await makeLong(page, 2);
  await pad(page, 6, 40).click();
  await page.reload();
  await page.click('#start-btn');
  expect(await padCount(page)).toBe(384);
  await expect(pad(page, 6, 40)).toHaveAttribute('aria-pressed', 'true');
});

test('Make video films the whole long beat', async ({ page }) => {
  await startApp(page);
  await page.click('#longer');
  await fastest(page);
  await openCamera(page);
  await recordPlayhead(page);
  await page.click('#rec-btn');
  await expect(page.locator('#rec-btn')).toContainText('Stop', { timeout: 6000 });
  await expect.poll(() => played(page, 28), { timeout: 8000 }).toBe(true);
  await page.click('#rec-btn');
  await expect(page.locator('#watch')).toBeVisible();
});

test('arrow keys run on past step 16 into the longer part', async ({ page }) => {
  await startApp(page);
  await page.click('#longer');
  await page.locator('#grid-wrap').evaluate((el) => { el.scrollLeft = 0; });
  await pad(page, 0, 15).focus();
  await page.keyboard.press('ArrowRight');
  await expect(pad(page, 0, 16)).toBeFocused();
  await expect.poll(() => uncovered(pad(page, 0, 16))).toBe(true);
});

test('on an upright phone the strip runs down, and ❮ ❯ move along it', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await startApp(page);
  await page.click('#longer');
  await page.locator('#grid-wrap').evaluate((el) => { el.scrollTop = 0; });
  await page.click('#strip-next');
  await expect.poll(() => scrolled(page)).toBeGreaterThan(100);
  await page.click('#strip-back');
  await expect.poll(() => scrolled(page)).toBeLessThan(2);
});

test('on a phone on its side, ❮ ❯ sit in the rail and ➕ is under More', async ({ page }) => {
  await page.setViewportSize({ width: 852, height: 393 });
  await startApp(page);
  await expect(page.locator('#strip-map')).toBeHidden();
  await expect(page.locator('#longer')).toBeHidden();
  await expect(page.locator('#strip-next')).toBeVisible();
  await page.click('#more');
  await page.click('#longer-tool');
  expect(await padCount(page)).toBe(256);
  await page.locator('#grid-wrap').evaluate((el) => { el.scrollLeft = 0; });
  await page.locator('.sound').first().click();
  await page.click('#strip-next');
  await expect.poll(() => uncovered(pad(page, 0, 16))).toBe(true);
});

test.describe('on a touch screen', () => {
  test.use({ hasTouch: true });

  // A touch pan sends pointercancel while the finger stays down; the grid must still wait.
  test('a finger held on the grid keeps the playhead from moving it, even past 8 s', async ({ page }) => {
    test.setTimeout(60_000);
    await startApp(page);
    await makeLong(page, 3);
    await fastest(page);
    await page.locator('#grid-wrap').evaluate((el) => { el.scrollLeft = 0; });
    await recordPlayhead(page);
    await page.click('#play');
    const box = await pad(page, 4, 2).boundingBox();
    const cdp = await page.context().newCDPSession(page);
    const at = (dx) => [{ x: box.x + 20 + dx, y: box.y + 20 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: at(0) });
    for (const dx of [-10, -30, -60, -90]) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: at(dx) });
    await page.waitForTimeout(500); // the pan itself settles
    const held = await scrolled(page);
    await page.waitForTimeout(9500);
    expect(await played(page, 40), 'the playhead went past the screen').toBe(true);
    expect(await scrolled(page), 'the grid stayed where the finger put it').toBe(held);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.click('#play');
  });
});

test('on a wide screen ❮ ❯ land each 16 steps right after the sound names', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await startApp(page);
  await makeLong(page, 2);
  await page.locator('#grid-wrap').evaluate((el) => { el.scrollLeft = 0; });
  // The section's first pad starts at the names' edge, never under them (at the very end the strip
  // can't scroll further, so it may sit a gutter's width past the edge).
  const fits = async (step) => {
    const names = await page.locator('.sound').first().boundingBox();
    const first = await pad(page, 0, step).boundingBox();
    const gap = first.x - (names.x + names.width);
    return gap >= -1 && gap < 16;
  };
  await page.click('#strip-next');
  await expect.poll(() => fits(16)).toBe(true);
  await page.click('#strip-next');
  await expect.poll(() => fits(32)).toBe(true);
  await page.click('#strip-back');
  await expect.poll(() => fits(16)).toBe(true);
  await page.click('#strip-back');
  await expect.poll(() => scrolled(page)).toBe(0);
});

test('➖ Shorter shows where the beat now ends', async ({ page }) => {
  await startApp(page);
  await makeLong(page, 3);
  await page.locator('#grid-wrap').evaluate((el) => { el.scrollLeft = 0; });
  await page.click('#shorter');
  await expect.poll(() => uncovered(pad(page, 0, 47))).toBe(true);
});

// ➖ Shorter (task 84, pick 7a): beside ➕, the same size, so it's found without More.
const box = (page, selector) => page.locator(selector).boundingBox();

async function sideBySide(page, left, right) {
  const [a, b] = [await box(page, left), await box(page, right)];
  const gap = b.x - (a.x + a.width);
  return {
    sameRow: Math.abs(a.y - b.y) < 2 && Math.abs(a.height - b.height) < 2,
    nextTo: gap >= 0 && gap <= 12,
    sameSize: Math.abs(a.width - b.width) < 8,
    big: Math.min(a.width, b.width) >= 48 && Math.min(a.height, b.height) >= 44,
  };
}

const ALL_GOOD = { sameRow: true, nextTo: true, sameSize: true, big: true };

for (const size of [{ width: 360, height: 640 }, { width: 820, height: 1180 }, { width: 1280, height: 800 }]) {
  test(`at ${size.width}×${size.height} ➖ Shorter sits beside ➕ Longer above the grid`, async ({ page }) => {
    await page.setViewportSize(size);
    await startApp(page);
    await expect(page.locator('#strip-nav #shorter')).toBeVisible();
    expect(await sideBySide(page, '#shorter', '#longer')).toEqual(ALL_GOOD);
    expect((await box(page, '#strip-map')).width, 'the map still shows').toBeGreaterThan(40);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.locator('#shorter-tool'), 'no second Shorter in the tools').toBeHidden();
    await expect(page.locator('#shorter .ico')).toHaveText('➖');
    await expect(page.locator('#shorter .lbl')).toHaveText('Shorter');
  });
}

test('on a phone on its side, ➖ and ➕ fold into More, side by side', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 360 });
  await startApp(page);
  await expect(page.locator('#shorter')).toBeHidden();
  await expect(page.locator('#longer')).toBeHidden();
  await page.click('#more');
  await expect(page.locator('#shorter-tool')).toBeDisabled();
  expect(await sideBySide(page, '#shorter-tool', '#longer-tool')).toEqual(ALL_GOOD);
  await page.click('#longer-tool');
  await page.click('#shorter-tool');
  expect(await padCount(page)).toBe(128);
  await expect(page.locator('#shorter-tool')).toBeDisabled();
});

test('➖ greys out at 16 steps, and one ↩ undoes it', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await startApp(page);
  await expect(page.locator('#shorter')).toBeDisabled();
  await makeLong(page, 2);
  await pad(page, 6, 40).click();
  await expect(pad(page, 6, 40)).toHaveAttribute('aria-pressed', 'true');
  await page.click('#shorter');
  await expect(page.locator('#shorter')).toBeEnabled();
  expect(await padCount(page)).toBe(256);
  await page.click('#shorter');
  await expect(page.locator('#shorter')).toBeDisabled();
  await expect(page.locator('#toast:not([hidden])')).toContainText('Made shorter');
  await page.click('#more');
  await page.click('#undo');
  expect(await padCount(page)).toBe(256);
  await page.click('#undo');
  expect(await padCount(page)).toBe(384);
  await expect(pad(page, 6, 40)).toHaveAttribute('aria-pressed', 'true');
});
