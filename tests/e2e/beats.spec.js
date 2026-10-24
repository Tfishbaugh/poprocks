// The beat screen: pads, play, tempo, starter beats, clear and undo, slots, keys.

import { test, expect } from '@playwright/test';
import { startApp } from './helpers.js';

const pad = (page, track, step) => page.locator(`.pad[data-track="${track}"][data-step="${step}"]`);
const litCount = (page) => page.locator('.pad.on').count();

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
});

test('the start screen names the app and waits for a tap', async ({ page }) => {
  await page.goto('./');
  await expect(page).toHaveTitle('PopRocks');
  await expect(page.locator('#start-title')).toHaveText('PopRocks');
  await expect(page.locator('#beats')).toBeHidden();
  await page.click('#start-btn');
  await expect(page.locator('#beats')).toBeVisible();
  await expect(page.locator('#play')).toBeFocused();
});

test('tapping a pad lights it, tapping again turns it off', async ({ page }) => {
  await startApp(page);
  await page.click('#clear');
  const target = pad(page, 6, 9);
  await target.click();
  await expect(target).toHaveAttribute('aria-pressed', 'true');
  await expect(target).toHaveClass(/\bon\b/);
  await target.click();
  await expect(target).toHaveAttribute('aria-pressed', 'false');
});

test('▶ plays: the playhead moves, and ⏹ stops it', async ({ page }) => {
  await startApp(page);
  await page.click('#play');
  await expect(page.locator('#play')).toContainText('Stop');
  const seen = new Set();
  for (let i = 0; i < 12; i += 1) {
    seen.add(await page.locator('.pad.now').first().getAttribute('data-step').catch(() => null));
    await page.waitForTimeout(100);
  }
  seen.delete(null);
  expect(seen.size).toBeGreaterThan(3);
  await page.click('#play');
  await expect(page.locator('#play')).toContainText('Play');
  await expect(page.locator('.pad.now')).toHaveCount(0);
});

test('Slower and Faster change the speed between 60 and 180', async ({ page }) => {
  await startApp(page);
  const speed = page.locator('#bpm .num');
  await expect(speed).toHaveText('100');
  await page.click('#faster');
  await expect(speed).toHaveText('110');
  for (let i = 0; i < 10; i += 1) await page.locator('#faster').click({ force: true });
  await expect(speed).toHaveText('180');
  await expect(page.locator('#faster')).toBeDisabled();
  for (let i = 0; i < 14; i += 1) await page.locator('#slower').click({ force: true });
  await expect(speed).toHaveText('60');
  await expect(page.locator('#slower')).toBeDisabled();
});

test('🎲 gives a new beat, 🧽 clears, ↩ brings it all back', async ({ page }) => {
  await startApp(page);
  const first = await page.locator('.pad.on').evaluateAll((pads) => pads.map((p) => p.ariaLabel).join());
  await page.click('#surprise');
  const second = await page.locator('.pad.on').evaluateAll((pads) => pads.map((p) => p.ariaLabel).join());
  expect(second).not.toBe(first);
  await page.click('#clear');
  expect(await litCount(page)).toBe(0);
  await expect(page.locator('#toast')).toContainText('Undo');
  await expect(page.locator('#clear')).toBeDisabled();
  await page.click('#undo');
  const back = await page.locator('.pad.on').evaluateAll((pads) => pads.map((p) => p.ariaLabel).join());
  expect(back).toBe(second);
  await page.click('#undo');
  const original = await page.locator('.pad.on').evaluateAll((pads) => pads.map((p) => p.ariaLabel).join());
  expect(original).toBe(first);
  await expect(page.locator('#undo')).toBeDisabled();
});

test('each kid has a beat slot, and beats are still there after a reload', async ({ page }) => {
  await startApp(page);
  await page.click('.slot[data-slot="2"]');
  await expect(page.locator('.slot[data-slot="2"]')).toHaveAttribute('aria-pressed', 'true');
  expect(await litCount(page)).toBe(0);
  await pad(page, 1, 4).click();
  await pad(page, 3, 0).click();
  await page.click('#faster');
  await page.click('.slot[data-slot="0"]');
  expect(await litCount(page)).toBeGreaterThan(2);

  await page.reload();
  await page.click('#start-btn');
  await expect(page.locator('.slot[data-slot="0"]')).toHaveAttribute('aria-pressed', 'true');
  await page.click('.slot[data-slot="2"]');
  expect(await litCount(page)).toBe(2);
  await expect(pad(page, 1, 4)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#bpm .num')).toHaveText('110');
});

test('arrow keys move around the grid and space toggles a pad', async ({ page }) => {
  await startApp(page);
  await page.click('#clear');
  await pad(page, 0, 0).focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  await expect(pad(page, 1, 2)).toBeFocused();
  await page.keyboard.press('Space');
  await expect(pad(page, 1, 2)).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await expect(pad(page, 0, 0)).toBeFocused();
  await expect(page.locator('.pad[tabindex="0"]')).toHaveCount(1);
});

test('on a turned phone grid, arrow keys follow what you see', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await startApp(page);
  await pad(page, 0, 0).focus();
  await page.keyboard.press('ArrowRight');
  await expect(pad(page, 1, 0)).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(pad(page, 1, 1)).toBeFocused();
});

test('space plays and stops when nothing is focused', async ({ page }) => {
  await startApp(page);
  await page.evaluate(() => document.activeElement.blur());
  await page.keyboard.press('Space');
  await expect(page.locator('#play')).toContainText('Stop');
  await page.evaluate(() => document.activeElement.blur());
  await page.keyboard.press('Space');
  await expect(page.locator('#play')).toContainText('Play');
});

test('on a phone, More opens the small tools', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await startApp(page);
  await expect(page.locator('#surprise')).toBeHidden();
  await page.click('#more');
  await expect(page.locator('#more')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#surprise')).toBeVisible();
  await page.click('#more');
  await expect(page.locator('#surprise')).toBeHidden();
});

test('on a phone the playing row stays in view', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await startApp(page);
  await page.click('.slot[data-slot="1"]');
  await pad(page, 0, 15).scrollIntoViewIfNeeded();
  await pad(page, 0, 15).click();
  await page.waitForTimeout(2100); // following pauses for 2 s after a finger touches the grid
  await page.locator('#grid-wrap').evaluate((el) => { el.scrollTop = 0; });
  await page.click('#play');
  await expect(pad(page, 0, 15)).toHaveClass(/\bnow\b/, { timeout: 5000 });
  await expect(pad(page, 0, 15)).toBeInViewport();
  await page.click('#play');
});

test('every icon button has a word under it, and pads have names', async ({ page }) => {
  await startApp(page);
  const unnamed = await page.locator('button:visible').evaluateAll((buttons) => buttons
    .filter((b) => !(b.getAttribute('aria-label') || b.textContent.replace(/\p{Extended_Pictographic}/gu, '').trim()))
    .map((b) => b.outerHTML.slice(0, 60)));
  expect(unnamed).toEqual([]);
  await expect(pad(page, 5, 3)).toHaveAttribute('aria-label', 'Bass, step 4');
});
