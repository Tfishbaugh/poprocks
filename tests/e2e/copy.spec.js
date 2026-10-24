// Copy and paste (task 80, pick 4c): 📋 a beat to another number, 📋 a sound's row onto
// another sound, and ×2 Double. Each has Undo.

import { test, expect } from '@playwright/test';
import { startApp } from './helpers.js';

const pad = (page, track, step) => page.locator(`.pad[data-track="${track}"][data-step="${step}"]`);
const lit = (page) => page.locator('.pad.on').evaluateAll((pads) => pads.map((p) => p.ariaLabel).join());
const litCount = (page) => page.locator('.pad.on').count();

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
});

test('📋 Copy beat copies to another number and takes you there, with Undo', async ({ page }) => {
  await startApp(page);
  await page.click('#faster');
  const source = await lit(page);
  await page.click('#copy');
  await expect(page.locator('#copy-sheet')).toBeVisible();
  await expect(page.locator('.copy-slot')).toHaveCount(3);
  await expect(page.locator('.copy-slot[data-slot="2"]')).toContainText('Empty');
  await page.locator('.copy-slot[data-slot="2"]').click();
  await expect(page.locator('#copy-sheet')).toBeHidden();
  await expect(page.locator('.slot[data-slot="2"]')).toHaveAttribute('aria-pressed', 'true');
  expect(await lit(page)).toBe(source);
  await expect(page.locator('#bpm .num')).toHaveText('110');
  await expect(page.locator('#toast')).toContainText('Now on beat 3');
  await page.click('#toast-action');
  expect(await litCount(page), 'beat 3 is empty again').toBe(0);
  await page.click('.slot[data-slot="0"]');
  expect(await lit(page), 'the beat it came from is untouched').toBe(source);
});

test('a beat number that has a beat shows a little picture of it', async ({ page }) => {
  await startApp(page);
  await page.click('.slot[data-slot="1"]');
  await pad(page, 0, 0).click();
  await page.click('#copy');
  await expect(page.locator('.copy-slot[data-slot="0"] canvas.mini')).toBeVisible();
  await expect(page.locator('.copy-slot[data-slot="0"]')).toHaveAttribute('aria-label', /replaced/);
  await expect(page.locator('.copy-slot[data-slot="1"]')).toHaveCount(0);
});

test('copy a sound: tap the sound, then the sound it goes onto', async ({ page }) => {
  await startApp(page);
  await page.click('#copy');
  await page.locator('.copy-sound[data-track="0"]').click();
  await expect(page.locator('#copy-row-title')).toHaveText('Paste Kick onto…');
  await expect(page.locator('.copy-sound[data-track="0"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.copy-sound[data-track="1"]').click();
  await expect(page.locator('#copy-sheet')).toBeHidden();
  await expect(pad(page, 1, 0)).toHaveAttribute('aria-pressed', 'true');
  await expect(pad(page, 1, 8)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#toast')).toContainText('Copied Kick onto Snare');
  await page.click('#toast-action');
  await expect(pad(page, 1, 0)).toHaveAttribute('aria-pressed', 'false');
});

test('tapping the picked sound again un-picks it', async ({ page }) => {
  await startApp(page);
  await page.click('#copy');
  await page.locator('.copy-sound[data-track="3"]').click();
  await page.locator('.copy-sound[data-track="3"]').click();
  await expect(page.locator('#copy-row-title')).toHaveText('Copy a sound');
  await expect(page.locator('.copy-sound[aria-pressed="true"]')).toHaveCount(0);
});

const CLOSERS = {
  '✕ Close': (page) => page.click('#copy-close'),
  Escape: (page) => page.keyboard.press('Escape'),
  'Back (Android)': (page) => page.goBack(),
  'a tap outside': (page) => page.mouse.click(4, 4),
};

for (const [name, close] of Object.entries(CLOSERS)) {
  test(`the Copy sheet closes with ${name}, and the beat screen waits behind it`, async ({ page }) => {
    await startApp(page);
    await page.click('#copy');
    expect(await page.locator('#beats').evaluate((el) => el.inert)).toBe(true);
    await close(page);
    await expect(page.locator('#copy-sheet')).toBeHidden();
    await expect(page.locator('#beats')).toBeVisible();
    expect(await page.locator('#beats').evaluate((el) => el.inert)).toBe(false);
    await expect.poll(() => page.evaluate(() => history.state)).toBeNull();
  });
}

test('×2 Double repeats the first half, with Undo, and waits for notes in the first half', async ({ page }) => {
  await startApp(page);
  await page.click('#clear');
  await expect(page.locator('#double')).toBeDisabled();
  await pad(page, 2, 15).click();
  await expect(page.locator('#double'), 'only the second half has notes').toBeDisabled();
  await pad(page, 2, 3).click();
  await page.click('#double');
  await expect(pad(page, 2, 11)).toHaveAttribute('aria-pressed', 'true');
  await expect(pad(page, 2, 15)).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#toast')).toContainText('Doubled');
  await page.click('#toast-action');
  await expect(pad(page, 2, 11)).toHaveAttribute('aria-pressed', 'false');
  await expect(pad(page, 2, 15)).toHaveAttribute('aria-pressed', 'true');
});

test('on a phone, Copy is under More and the sheet fits', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await startApp(page);
  await page.click('#more');
  await page.click('#copy');
  const card = await page.locator('.sheet-card').boundingBox();
  expect(card.x).toBeGreaterThanOrEqual(0);
  expect(card.x + card.width).toBeLessThanOrEqual(360);
  for (const target of await page.locator('.copy-slot, .copy-sound, #copy-close').all()) {
    const box = await target.boundingBox();
    expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
  }
});
