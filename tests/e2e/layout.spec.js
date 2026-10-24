// Phone, phone on its side, tablet and laptop: no sideways scroll, every target at least
// 44 px, every label at least 14 px, and Save far from Delete.

import { test, expect } from '@playwright/test';
import { openCamera, record, startApp } from './helpers.js';

const SIZES = [
  { name: 'phone', width: 360, height: 640 },
  { name: 'phone on its side', width: 852, height: 393 },
  { name: 'small phone on its side', width: 740, height: 360 },
  { name: 'tablet', width: 1024, height: 768 },
  { name: 'tablet upright', width: 768, height: 1024 },
  { name: 'iPad Air upright', width: 820, height: 1180 },
  { name: 'laptop', width: 1366, height: 768 },
  { name: 'short laptop window', width: 1093, height: 480 },
];

// Scrolls each pad into view (as a finger or the arrow keys would) and checks nothing covers it.
async function unreachablePads(page) {
  return page.evaluate(() => [...document.querySelectorAll('.pad')].filter((pad) => {
    pad.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const box = pad.getBoundingClientRect();
    return document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2) !== pad;
  }).map((pad) => pad.getAttribute('aria-label')));
}

async function sidewaysScroll(page) {
  return page.evaluate(() => {
    const over = (el) => el.scrollWidth > el.clientWidth + 1;
    // The grid itself may scroll its steps sideways on small phones; the page never does.
    return [document.documentElement, document.body, ...document.querySelectorAll('.bar, .screen, .top, .strip-nav')]
      .filter((el) => el.offsetParent !== null || el === document.body || el === document.documentElement)
      .filter(over)
      .map((el) => el.id || el.className || el.tagName);
  });
}

// Visible buttons smaller than 44 x 44 px, and visible labels under 14 px.
async function smallThings(page) {
  return page.evaluate(() => {
    const visible = (el) => el.checkVisibility() && el.getBoundingClientRect().width > 0;
    const buttons = [...document.querySelectorAll('button')].filter(visible).filter((el) => {
      const box = el.getBoundingClientRect();
      return box.width < 44 - 0.5 || box.height < 44 - 0.5;
    });
    const labels = [...document.querySelectorAll('.lbl')].filter(visible)
      .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 14);
    return [...buttons, ...labels].map((el) => `${el.id || el.getAttribute('aria-label') || el.textContent}`);
  });
}

async function expectGoodLayout(page, where) {
  expect(await sidewaysScroll(page), `${where}: sideways scroll`).toEqual([]);
  expect(await smallThings(page), `${where}: too small`).toEqual([]);
}

async function gap(page, a, b) {
  const [x, y] = [await page.locator(a).boundingBox(), await page.locator(b).boundingBox()];
  const dx = Math.max(0, x.x - (y.x + y.width), y.x - (x.x + x.width));
  const dy = Math.max(0, x.y - (y.y + y.height), y.y - (x.y + x.height));
  return Math.hypot(dx, dy);
}

for (const size of SIZES) {
  test.describe(`${size.name} ${size.width}×${size.height}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test('every screen fits, with big targets', async ({ page }) => {
      await page.goto('./');
      await expectGoodLayout(page, 'start');
      await page.click('#start-btn');
      await expect(page.locator('#beats')).toBeVisible();
      await expectGoodLayout(page, 'beats');
      if (await page.locator('#more').isVisible()) {
        await page.click('#more');
        await expect(page.locator('#tools')).toBeVisible();
        await expectGoodLayout(page, 'beats with More open');
      }
      await openCamera(page);
      await expectGoodLayout(page, 'record');
      await record(page, 1);
      await expectGoodLayout(page, 'watch');
      expect(await gap(page, '#watch-save', '#watch-delete')).toBeGreaterThanOrEqual(96);
    });

    test('every one of the 128 pads can be reached and tapped', async ({ page }) => {
      await startApp(page);
      expect(await unreachablePads(page)).toEqual([]);
      for (const index of [0, 15, 112, 127]) {
        const pad = page.locator('.pad').nth(index);
        await pad.scrollIntoViewIfNeeded();
        await pad.click();
        await expect(pad).toHaveAttribute('aria-pressed', /true|false/);
      }
      await expect(page.locator('.sound')).toHaveCount(8);
      await expect(page.locator('#play')).toBeInViewport();
      await expect(page.locator('#make-video')).toBeInViewport();
    });
  });
}

test('the phone grid turns: sounds across the top, steps going down', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await startApp(page);
  const kick = await page.locator('.sound').nth(0).boundingBox();
  const boing = await page.locator('.sound').nth(7).boundingBox();
  expect(Math.abs(kick.y - boing.y)).toBeLessThan(1);
  const step1 = await page.locator('.pad').nth(0).boundingBox();
  const step2 = await page.locator('.pad').nth(1).boundingBox();
  expect(step2.y).toBeGreaterThan(step1.y);
  expect(Math.abs(step2.x - step1.x)).toBeLessThan(1);
});

test('the tablet grid has sounds down the side and steps across', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await startApp(page);
  const step1 = await page.locator('.pad').nth(0).boundingBox();
  const step2 = await page.locator('.pad').nth(1).boundingBox();
  expect(step2.x).toBeGreaterThan(step1.x);
  expect(Math.abs(step2.y - step1.y)).toBeLessThan(1);
  const grid = await page.locator('#grid-wrap').evaluate((el) => el.scrollHeight <= el.clientHeight + 1);
  expect(grid, 'all 8 rows fit without scrolling').toBe(true);
});

const scrolls = (page) => page.locator('#grid-wrap').evaluate((el) => ({
  across: el.scrollWidth > el.clientWidth + 1,
  down: el.scrollHeight > el.clientHeight + 1,
}));

for (const size of [{ width: 1366, height: 768 }, { width: 1024, height: 768 }, { width: 1280, height: 600 }, { width: 915, height: 412 }]) {
  test(`at ${size.width}×${size.height} the whole beat fits, no scrolling`, async ({ page }) => {
    await page.setViewportSize(size);
    await startApp(page);
    expect(await scrolls(page)).toEqual({ across: false, down: false });
  });
}

for (const size of [{ width: 852, height: 393 }, { width: 740, height: 360 }]) {
  test(`on a phone on its side (${size.width}×${size.height}), all 8 sounds fit top to bottom`, async ({ page }) => {
    await page.setViewportSize(size);
    await startApp(page);
    expect((await scrolls(page)).down).toBe(false);
    await expect(page.locator('.sound').nth(7)).toBeInViewport({ ratio: 1 });
    await expect(page.locator('.slot').nth(3)).toBeInViewport();
  });
}

test('at 852×393 all 16 steps fit across, next to the rail', async ({ page }) => {
  await page.setViewportSize({ width: 852, height: 393 });
  await startApp(page);
  expect(await scrolls(page)).toEqual({ across: false, down: false });
});

for (const size of [{ width: 360, height: 640 }, { width: 768, height: 1024 }, { width: 820, height: 1180 }]) {
  test(`upright at ${size.width}×${size.height} the grid never scrolls sideways`, async ({ page }) => {
    await page.setViewportSize(size);
    await startApp(page);
    expect((await scrolls(page)).across).toBe(false);
  });
}

test('iPhone on its side: the notch gap is counted once, and More never covers Make video', async ({ page }) => {
  await page.setViewportSize({ width: 852, height: 393 });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 0, left: 59, right: 59, bottom: 21 } });
  await startApp(page);
  const names = await page.locator('.sound').first().boundingBox();
  expect(names.x).toBeGreaterThanOrEqual(59);
  expect(names.x).toBeLessThan(59 + 12);
  const rail = await page.locator('#make-video').boundingBox();
  expect(rail.x + rail.width).toBeLessThanOrEqual(852 - 59 + 1);
  expect(await unreachablePads(page)).toEqual([]);
  await page.click('#more');
  const tray = await page.locator('#tools').boundingBox();
  expect(tray.x + tray.width, 'the tray stays left of the rail').toBeLessThanOrEqual(rail.x);
});

test('Watch on a phone on its side gives the video the full height', async ({ page }) => {
  await page.setViewportSize({ width: 852, height: 393 });
  await startApp(page);
  await openCamera(page);
  await record(page, 1);
  const video = await page.locator('#playback').boundingBox();
  expect(video.height).toBeGreaterThan(360);
  const save = await page.locator('#watch-save').boundingBox();
  const remove = await page.locator('#watch-delete').boundingBox();
  expect(save.y).toBeGreaterThan(remove.y + remove.height + 96);
  expect(save.x + save.width).toBeGreaterThan(800);
});

test('when 16 steps don’t fit across, the grid follows the playhead sideways', async ({ page }) => {
  await page.setViewportSize({ width: 740, height: 360 });
  await startApp(page);
  expect((await scrolls(page)).across).toBe(true);
  const last = page.locator('.pad[data-track="0"][data-step="15"]');
  await expect(last).not.toBeInViewport({ ratio: 1 });
  await page.click('#play');
  await expect(last).toHaveClass(/\bnow\b/, { timeout: 5000 });
  await expect(last).toBeInViewport({ ratio: 1 });
  const covered = await last.evaluate((pad) => {
    const box = pad.getBoundingClientRect();
    return document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2) !== pad;
  });
  expect(covered, 'the sticky sound names never cover the playing step').toBe(false);
  await page.click('#play');
});

test('the small tools sit out from 1024 px wide, and fold under More below that', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await startApp(page);
  await expect(page.locator('#more')).toBeHidden();
  await expect(page.locator('#undo')).toBeVisible();
  await expect(page.locator('#copy')).toBeVisible();
  await page.setViewportSize({ width: 820, height: 1180 });
  await expect(page.locator('#more')).toBeVisible();
  await expect(page.locator('#undo')).toBeHidden();
  await page.click('#more');
  await expect(page.locator('#copy')).toBeVisible();
});

// A 64-step beat at every size: the page never scrolls sideways and every one of the 512 pads can be reached.
for (const size of [{ width: 360, height: 640 }, { width: 852, height: 393 }, { width: 1024, height: 768 }, { width: 1366, height: 768 }]) {
  test(`a 64-step beat at ${size.width}×${size.height}: every pad reachable, no sideways page`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await startApp(page);
    const viaMore = !(await page.locator('#longer').isVisible());
    if (viaMore) await page.click('#more');
    for (let i = 0; i < 3; i += 1) await page.click(viaMore ? '#longer-tool' : '#longer');
    if (viaMore) await page.keyboard.press('Escape');
    await expect(page.locator('.pad')).toHaveCount(512);
    expect(await sidewaysScroll(page)).toEqual([]);
    expect(await smallThings(page)).toEqual([]);
    expect(await unreachablePads(page)).toEqual([]);
  });
}
