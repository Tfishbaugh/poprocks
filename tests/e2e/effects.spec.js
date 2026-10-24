// Effects on Watch: colors through a WebGL shader, stickers a kid places and moves, and
// ✅ Use it, which makes a new video with the beat in it and keeps the original.

import { execFileSync } from 'node:child_process';
import { test, expect } from '@playwright/test';
import { cameraCalls, download, duration, liveTracks, maxVolume, openCamera, probe, record, startApp, watchCamera } from './helpers.js';

const SIZES = [
  { width: 360, height: 640 },
  { width: 852, height: 393 },
  { width: 740, height: 360 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 820, height: 1180 },
  { width: 1366, height: 768 },
  { width: 1093, height: 480 },
];

async function filmed(page, seconds = 1, { beat = false } = {}) {
  await startApp(page);
  if (beat) await page.click('#surprise');
  await openCamera(page);
  if (beat) await page.click('#mic');
  await record(page, seconds);
}

async function openEffects(page) {
  await page.click('#watch-fx');
  await expect(page.locator('#fx-tray')).toBeVisible();
  await expect.poll(() => page.locator('#fx-view').evaluate((c) => c.width), { message: 'the preview has the video size' }).toBeGreaterThan(300);
}

// Only a toast that is showing: a closed one keeps its old words.
const toast = (page) => page.locator('#toast:not([hidden])');
const pick = (page, row, name) => page.locator(`#${row} button`, { hasText: name }).click();
const src = (page) => page.locator('#playback').evaluate((v) => v.src);
const spread = ([r, g, b]) => Math.max(r, g, b) - Math.min(r, g, b);

// Reads preview pixels at [x, y] spots given in 0–1, all from the same frame.
function canvasPixels(page, spots) {
  return page.locator('#fx-view').evaluate((canvas, points) => {
    const ctx = canvas.getContext('2d');
    const at = ([x, y]) => [...ctx.getImageData(Math.round(x * (canvas.width - 1)), Math.round(y * (canvas.height - 1)), 1, 1).data].slice(0, 3);
    return points.map(at);
  }, spots);
}

// One frame of a video file, shrunk to 32 × 18, as a function of (x, y) → [r, g, b].
function framePixels(path, at = 1) {
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-ss', String(at), '-i', path, '-frames:v', '1', '-vf', 'scale=32:18', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']);
  return (x, y) => [...raw.subarray((y * 32 + x) * 3, (y * 32 + x) * 3 + 3)];
}

const SPOTS = [[0.1, 0.1], [0.3, 0.3], [0.5, 0.5], [0.7, 0.4], [0.2, 0.8], [0.8, 0.8], [0.9, 0.2]];

test('🪄 Effects opens a live preview, with Colors and Stickers, and ✅ Use it where Save was', async ({ page }) => {
  await filmed(page);
  await expect(page.locator('#watch-fx')).toHaveAttribute('data-tour', 'effects');
  const save = await page.locator('#watch-save').boundingBox();
  await openEffects(page);
  await expect(page.locator('#fx-filters button')).toHaveText(['None', 'Gray', 'Rainbow', 'Neon', 'Mirror', 'Comic']);
  await expect(page.locator('#fx-sticker-row button')).toHaveCount(6);
  await expect(page.locator('#fx-filters button', { hasText: 'None' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#fx-filters button', { hasText: 'None' })).toBeFocused();
  for (const id of ['#watch-save', '#watch-delete', '#watch-again', '#watch-back', '#watch-fx']) await expect(page.locator(id)).toBeHidden();
  const use = await page.locator('#fx-use').boundingBox();
  expect(Math.abs(use.x + use.width - (save.x + save.width))).toBeLessThan(2);
  expect(Math.abs(use.y + use.height - (save.y + save.height))).toBeLessThan(2);
  const colors = await canvasPixels(page, SPOTS);
  expect(colors.some((pixel) => pixel.some((c) => c > 20)), 'the preview shows the video').toBe(true);
});

test('Gray turns the preview gray, Mirror makes both sides match, and every color draws', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await filmed(page);
  await openEffects(page);
  const plainColors = await canvasPixels(page, SPOTS);
  expect(Math.max(...plainColors.map(spread)), 'the test video has color to lose').toBeGreaterThan(20);

  await pick(page, 'fx-filters', 'Gray');
  await expect(page.locator('#fx-filters button', { hasText: 'Gray' })).toHaveAttribute('aria-pressed', 'true');
  await page.waitForTimeout(200);
  const gray = await canvasPixels(page, SPOTS);
  expect(Math.max(...gray.map(spread))).toBeLessThanOrEqual(6);

  await pick(page, 'fx-filters', 'Mirror');
  await page.waitForTimeout(200);
  const left = SPOTS.map(([x, y]) => [x / 2, y]);
  const right = SPOTS.map(([x, y]) => [1 - x / 2, y]);
  const [l, r] = [await canvasPixels(page, [...left, ...right])].map((all) => [all.slice(0, left.length), all.slice(left.length)])[0];
  l.forEach((pixel, i) => pixel.forEach((c, k) => expect(Math.abs(c - r[i][k]), `spot ${i}`).toBeLessThanOrEqual(10)));

  for (const name of ['Rainbow', 'Neon', 'Comic']) {
    await pick(page, 'fx-filters', name);
    await page.waitForTimeout(150);
    const pixels = await canvasPixels(page, SPOTS);
    expect(new Set(pixels.map(String)).size, `${name} draws a picture`).toBeGreaterThan(1);
  }
  expect(errors).toEqual([]);
});

test('stickers: tap to add, drag to move, arrow keys nudge, ✕ or Delete removes, 8 at most', async ({ page }) => {
  await filmed(page);
  await openEffects(page);
  const stage = await page.locator('#fx-stage').boundingBox();
  await pick(page, 'fx-sticker-row', 'Star');
  const star = page.locator('.fx-sticker').first();
  await expect(star).toHaveAttribute('aria-label', 'Star sticker');
  await expect(star).toHaveClass(/selected/);
  const start = await star.boundingBox();
  expect(Math.abs(start.x + start.width / 2 - (stage.x + stage.width / 2))).toBeLessThan(2);

  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(start.x + start.width / 2 - 60, start.y + start.height / 2 - 30, { steps: 5 });
  await page.mouse.up();
  const moved = await star.boundingBox();
  expect(moved.x - start.x).toBeCloseTo(-60, -1);
  expect(moved.y - start.y).toBeCloseTo(-30, -1);

  await star.focus();
  await page.keyboard.press('ArrowRight');
  const nudged = await page.locator('.fx-sticker').first().boundingBox();
  expect(nudged.x - moved.x).toBeCloseTo(stage.width * 0.02, 0);

  await page.click('#fx-remove');
  await expect(page.locator('.fx-sticker')).toHaveCount(0);
  await expect(page.locator('#fx-remove')).toBeHidden();

  for (let i = 0; i < 9; i += 1) await page.locator('#fx-sticker-row button', { hasText: 'Heart' }).click({ force: true });
  await expect(page.locator('.fx-sticker')).toHaveCount(8);
  await expect(page.locator('#fx-sticker-row button').first()).toBeDisabled();
  await page.locator('.fx-sticker').nth(3).focus();
  await page.keyboard.press('Delete');
  await expect(page.locator('.fx-sticker')).toHaveCount(7);
  await expect(page.locator('#fx-sticker-row button').first()).toBeEnabled();
});

test('✅ Use it makes a new video with the effect and the beat in it', async ({ page }, testInfo) => {
  await filmed(page, 3, { beat: true });
  const original = await src(page);
  const before = await download(page, testInfo);
  await openEffects(page);
  await pick(page, 'fx-filters', 'Gray');
  await pick(page, 'fx-sticker-row', 'Star');
  await page.click('#fx-use');
  await expect(page.locator('#fx-stop')).toBeVisible();
  await expect(page.locator('#fx-status')).toHaveText('Adding Gray + stickers…');
  await expect(page.locator('#fx-time')).toContainText('left');
  await expect(page.locator('#fx-tray')).toBeHidden();
  await expect(page.locator('#watch-save')).toBeVisible({ timeout: 15_000 });
  await expect(toast(page)).toContainText('Gray + stickers added ✓');
  expect(await src(page)).not.toBe(original);

  const made = await download(page, testInfo);
  expect(probe(made.path).streams.map((s) => s.codec_type).sort()).toEqual(['audio', 'video']);
  expect(Math.abs(duration(made.path) - duration(before.path)), 'as long as the original').toBeLessThan(0.8);
  expect(maxVolume(made.path), 'the beat is in it').toBeGreaterThan(-30);
  const pixel = framePixels(made.path);
  expect(spread(pixel(2, 2)), 'the picture is gray').toBeLessThanOrEqual(12);
  const star = pixel(16, 9);
  expect(star[0] - star[2], 'the star in the middle stays yellow').toBeGreaterThan(60);
  const plain = framePixels(before.path);
  expect(Math.max(...[[2, 2], [8, 4], [24, 14], [16, 9]].map(([x, y]) => spread(plain(x, y)))), 'the original was in color').toBeGreaterThan(20);
});

async function makeRainbow(page) {
  await openEffects(page);
  await pick(page, 'fx-filters', 'Rainbow');
  await page.click('#fx-use');
  await expect(toast(page)).toContainText('Rainbow added ✓', { timeout: 15_000 });
}

test('Undo and None bring back the original, and effects always start from it', async ({ page }) => {
  await filmed(page);
  const original = await src(page);
  await makeRainbow(page);
  expect(await src(page)).not.toBe(original);
  await page.click('#toast-action');
  await expect.poll(() => src(page)).toBe(original);

  await makeRainbow(page);
  const rainbow = await src(page);

  await openEffects(page);
  expect(await src(page), 'the preview starts from the original').toBe(original);
  await expect(page.locator('#fx-filters button', { hasText: 'Rainbow' })).toHaveAttribute('aria-pressed', 'true');
  await pick(page, 'fx-filters', 'None');
  await page.click('#fx-use');
  await expect(toast(page)).toContainText('Back to the original ✓');
  expect(await src(page)).toBe(original);
  await page.click('#toast-action');
  await expect.poll(() => src(page)).toBe(rainbow);
});

test('✅ Use it still works when tapped while the preview loops back to the start', async ({ page }) => {
  await filmed(page);
  await openEffects(page);
  await pick(page, 'fx-filters', 'Gray');
  await page.evaluate(() => {
    document.getElementById('playback').currentTime = 0.5;
    document.getElementById('fx-use').click();
  });
  await expect(toast(page)).toContainText('Gray added ✓', { timeout: 15_000 });
});

test('if making the effect can’t start, the kid sees why and the video is unchanged', async ({ page }) => {
  await page.addInitScript(() => {
    const Real = window.MediaRecorder;
    let count = 0;
    window.MediaRecorder = class extends Real {
      constructor(...args) {
        count += 1;
        if (count > 1) throw new DOMException('no', 'NotSupportedError');
        super(...args);
      }
    };
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await filmed(page);
  const original = await src(page);
  await openEffects(page);
  await pick(page, 'fx-filters', 'Gray');
  await page.click('#fx-use');
  await expect(toast(page)).toContainText('Couldn’t add the effect');
  await expect(page.locator('#fx-tray')).toBeVisible();
  await expect(page.locator('#fx-use')).toBeVisible();
  await page.click('#fx-close');
  expect(await src(page)).toBe(original);
  expect(errors).toEqual([]);
});

test('✕ Stop throws the half-made video away, and ✕ Close leaves the video as it was', async ({ page }) => {
  await filmed(page, 3);
  const original = await src(page);
  await openEffects(page);
  await pick(page, 'fx-filters', 'Neon');
  await page.click('#fx-use');
  await expect(page.locator('#fx-stop')).toBeVisible();
  await page.waitForTimeout(800);
  await page.click('#fx-stop');
  await expect(toast(page)).toContainText('didn’t change');
  await expect(page.locator('#fx-tray')).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page.locator('#toast-msg')).not.toContainText('added');
  await page.click('#fx-close');
  await expect(page.locator('#watch-save')).toBeVisible();
  await expect(page.locator('#watch-fx')).toBeFocused();
  expect(await src(page)).toBe(original);
  expect(await page.locator('#playback').evaluate((v) => v.controls && !v.muted && !v.loop)).toBe(true);
});

test('Back and Escape leave Effects but stay on Watch, and history stays tidy', async ({ page }) => {
  await filmed(page);
  await openEffects(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('#watch-save')).toBeVisible();
  await expect(page.locator('#watch')).toBeVisible();
  await expect.poll(() => page.evaluate(() => history.state?.poprocks)).toBe('watch');

  await openEffects(page);
  await page.goBack();
  await expect(page.locator('#watch-save')).toBeVisible();
  await expect(page.locator('#watch')).toBeVisible();
  await expect.poll(() => page.evaluate(() => history.state?.poprocks)).toBe('watch');

  await openEffects(page);
  await page.click('#fx-close');
  await expect.poll(() => page.evaluate(() => history.state?.poprocks)).toBe('watch');
  await page.goBack();
  await expect(page.locator('#beats')).toBeVisible();
  await expect(page.locator('#last-video')).toBeVisible();
});

test('Back while an effect is being made stops it and stays on Watch', async ({ page }) => {
  await filmed(page, 3);
  const original = await src(page);
  await openEffects(page);
  await pick(page, 'fx-filters', 'Comic');
  await page.click('#fx-use');
  await expect(page.locator('#fx-stop')).toBeVisible();
  await page.goBack();
  await expect(page.locator('#watch-save')).toBeVisible();
  await expect(toast(page)).toContainText('didn’t change');
  expect(await src(page)).toBe(original);
});

test('leaving the app while an effect is being made stops it and keeps the video', async ({ page }) => {
  await filmed(page, 3);
  await openEffects(page);
  await pick(page, 'fx-filters', 'Gray');
  await page.click('#fx-use');
  await expect(page.locator('#fx-stop')).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(toast(page)).toContainText('Stopped');
  await expect(page.locator('#fx-tray')).toBeVisible();
});

test('effects never open the camera or reach other sites', async ({ context, page }, testInfo) => {
  await context.route((url) => url.hostname !== '127.0.0.1', (route) => route.abort());
  await page.addInitScript(watchCamera);
  const urls = [];
  context.on('request', (request) => urls.push(request.url()));
  await filmed(page);
  expect(await cameraCalls(page)).toBe(1);
  await openEffects(page);
  await pick(page, 'fx-filters', 'Gray');
  await pick(page, 'fx-sticker-row', 'Crown');
  await page.click('#fx-use');
  await expect(toast(page)).toContainText('added ✓', { timeout: 15_000 });
  expect(await cameraCalls(page)).toBe(1);
  expect(await liveTracks(page)).toBe(0);
  const origin = new URL(testInfo.project.use.baseURL).origin;
  expect(urls.filter((url) => !url.startsWith(origin) && !url.startsWith('blob:') && !url.startsWith('data:'))).toEqual([]);
});

test('without WebGL there is no 🪄, and Watch works as before', async ({ page }) => {
  await page.addInitScript(() => {
    const real = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function getContext(type, ...rest) {
      return type === 'webgl' ? null : real.call(this, type, ...rest);
    };
  });
  await filmed(page);
  await expect(page.locator('#watch-fx')).toBeHidden();
  await expect(page.locator('#watch-save')).toBeVisible();
  await expect(page.locator('#watch-again')).toBeVisible();
});

// ---- Layout: every size, while choosing and while making ----

async function sideways(page) {
  return page.evaluate(() => [document.documentElement, document.body, ...document.querySelectorAll('.screen, .fx-tray, .watch-bottom')]
    .filter((el) => el.checkVisibility?.() ?? true)
    .filter((el) => el.scrollWidth > el.clientWidth + 1)
    .map((el) => el.id || el.className || el.tagName));
}

async function tooSmall(page) {
  return page.evaluate(() => {
    const visible = (el) => el.checkVisibility() && el.getBoundingClientRect().width > 0;
    const small = [...document.querySelectorAll('button')].filter(visible).filter((el) => {
      const box = el.getBoundingClientRect();
      return box.width < 44 - 0.5 || box.height < 44 - 0.5;
    });
    const tiny = [...document.querySelectorAll('.lbl, .fx-name')].filter(visible).filter((el) => parseFloat(getComputedStyle(el).fontSize) < 14);
    return [...small, ...tiny].map((el) => el.id || el.getAttribute('aria-label') || el.textContent);
  });
}

function overlaps(a, b) {
  return a.x < b.x + b.width - 1 && b.x < a.x + a.width - 1 && a.y < b.y + b.height - 1 && b.y < a.y + a.height - 1;
}

for (const size of SIZES) {
  test(`${size.width}×${size.height}: Watch, Effects and making all fit, with big targets`, async ({ page }) => {
    await page.setViewportSize(size);
    await filmed(page);
    for (const id of ['#watch-again', '#watch-fx', '#watch-save']) await expect(page.locator(id)).toBeInViewport({ ratio: 1 });
    expect(await sideways(page), 'watch').toEqual([]);
    expect(await tooSmall(page), 'watch').toEqual([]);

    await openEffects(page);
    await pick(page, 'fx-sticker-row', 'Shades');
    await expect(page.locator('#fx-tray')).toBeInViewport({ ratio: 1 });
    await expect(page.locator('#fx-use')).toBeInViewport({ ratio: 1 });
    await expect(page.locator('#fx-close')).toBeInViewport({ ratio: 1 });
    const stage = await page.locator('#fx-stage').boundingBox();
    expect(stage.height, 'the preview is big enough to place stickers').toBeGreaterThan(140);
    expect(overlaps(stage, await page.locator('#fx-tray').boundingBox()), 'the tray never covers the picture').toBe(false);
    expect(overlaps(stage, await page.locator('#fx-use').boundingBox()), 'Use it never covers the picture').toBe(false);
    expect(await sideways(page), 'effects').toEqual([]);
    expect(await tooSmall(page), 'effects').toEqual([]);

    await page.click('#fx-use');
    await expect(page.locator('#fx-stop')).toBeVisible();
    await expect(page.locator('#fx-making')).toBeInViewport({ ratio: 1 });
    expect(await tooSmall(page), 'making').toEqual([]);
    await expect(toast(page)).toContainText('added ✓', { timeout: 15_000 });
  });
}

// ---- Review fixes at integration (task 80) ----

test('✕ Close keeps the chosen color and stickers as a draft for next time', async ({ page }) => {
  await filmed(page);
  await openEffects(page);
  await pick(page, 'fx-filters', 'Comic');
  await pick(page, 'fx-sticker-row', 'Star');
  await page.click('#fx-close');
  await expect(page.locator('#watch-save')).toBeVisible();
  await openEffects(page);
  await expect(page.locator('#fx-filters button', { hasText: 'Comic' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.fx-sticker')).toHaveCount(1);
});

test('opening 🪄 again ends the last effect’s Undo, so the video never breaks', async ({ page }) => {
  await filmed(page);
  await makeRainbow(page);
  const rainbow = await src(page);
  await page.click('#watch-fx');
  await expect(page.locator('#fx-tray')).toBeVisible();
  await expect(page.locator('#toast')).toBeHidden();
  await page.click('#fx-close');
  await expect.poll(() => src(page)).toBe(rainbow);
  await expect.poll(() => page.locator('#playback').evaluate((v) => v.error === null && v.readyState > 0)).toBe(true);
});
