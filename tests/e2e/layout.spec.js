// Phone, phone on its side, tablet and laptop: no sideways scroll, every target at least
// 44 px, every label at least 14 px, and Save far from Delete.

import { test, expect } from '@playwright/test';
import { openCamera, record, startApp } from './helpers.js';

const SIZES = [
  { name: 'phone', width: 360, height: 640 },
  { name: 'phone on its side', width: 852, height: 393 },
  { name: 'tablet', width: 1024, height: 768 },
  { name: 'tablet upright', width: 768, height: 1024 },
  { name: 'laptop', width: 1366, height: 768 },
];

async function sidewaysScroll(page) {
  return page.evaluate(() => {
    const over = (el) => el.scrollWidth > el.clientWidth + 1;
    return [document.documentElement, document.body, ...document.querySelectorAll('.grid-wrap, .bar, .screen')]
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

    test('all 8 sounds and all 16 steps can be reached', async ({ page }) => {
      await startApp(page);
      for (const index of [0, 7, 120, 127]) {
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
