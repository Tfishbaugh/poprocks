// Mix and match (task 84): tap a row's name to put any kit's sound on it; the Sounds button's kits
// are presets for every row, and shows 🎨 Mix for a mix.

import { test, expect } from '@playwright/test';
import { startApp } from './helpers.js';

const name = (page, track) => page.locator(`.sound[data-track="${track}"]`);
const tile = (page, id) => page.locator(`#row-sheet .row-sound[data-sound="${id}"]`);
const pad = (page, track, step) => page.locator(`.pad[data-track="${track}"][data-step="${step}"]`);
const sheet = (page) => page.locator('#row-sheet');
const rowNames = (page) => page.locator('.sound .lbl').allTextContents();
const PARTY = ['Kick', 'Snare', 'Clap', 'Hat', 'Bell', 'Bass', 'Laser', 'Boing'];
const ROCK = ['Kick', 'Snare', 'Tom', 'Crash', 'Chord', 'Chug', 'Bass', 'Riff'];

async function pickRowSound(page, track, id) {
  await name(page, track).click();
  await expect(sheet(page)).toBeVisible();
  await tile(page, id).click();
  await page.click('#row-close');
  await expect(sheet(page)).toBeHidden();
}

test.describe('the row sheet', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await startApp(page);
  });

  test('a name has a ▾, and a tap opens "Sound for row N" with the row’s sound lit', async ({ page }) => {
    await expect(name(page, 7).locator('.pick')).toHaveText('▾');
    await expect(name(page, 7)).toHaveAttribute('aria-haspopup', 'dialog');
    await name(page, 7).click();
    await expect(page.locator('#row-title')).toHaveText('Sound for row 8');
    await expect(page.locator('.row-kit-name')).toHaveText(['🎉 Party', '🎸 Rock', '💖 K-pop']);
    await expect(page.locator('.row-sound')).toHaveCount(24);
    await expect(tile(page, 'boing')).toHaveAttribute('aria-pressed', 'true');
    await expect(tile(page, 'boing')).toBeFocused();
    await expect(page.locator('#row-sheet .kit-credit')).toContainText('CC0');
  });

  test('a pick renames the row and its pads, and one ↩ takes back the whole visit', async ({ page }) => {
    await pad(page, 7, 3).click();
    await name(page, 7).click();
    await tile(page, 'hey').click();
    await tile(page, 'crash').click();
    await tile(page, 'riff').click();
    await expect(tile(page, 'riff')).toHaveAttribute('aria-pressed', 'true');
    await expect(tile(page, 'boing')).toHaveAttribute('aria-pressed', 'false');
    await expect(name(page, 7).locator('.lbl')).toHaveText('Riff');
    await expect(pad(page, 7, 3)).toHaveAttribute('aria-label', 'Riff, step 4');
    await expect(pad(page, 7, 3), 'the notes stay').toHaveAttribute('aria-pressed', 'true');
    await page.click('#row-close');
    await expect(page.locator('#toast:not([hidden])')).toContainText('⚡ Riff on row 8');
    await expect(name(page, 7)).toBeFocused();
    await page.click('#undo');
    await expect(name(page, 7).locator('.lbl')).toHaveText('Boing');
    await expect(pad(page, 7, 3)).toHaveAttribute('aria-pressed', 'true');
  });

  test('the toast’s Undo puts the row’s old sound back', async ({ page }) => {
    await pickRowSound(page, 0, 'snap');
    await page.click('#toast-action');
    await expect(name(page, 0).locator('.lbl')).toHaveText('Kick');
  });

  test('trying sounds and coming back to the first leaves nothing to undo', async ({ page }) => {
    await expect(page.locator('#undo')).toBeDisabled();
    await name(page, 2).click();
    await tile(page, 'snap').click();
    await tile(page, 'clap').click();
    await page.click('#row-close');
    await expect(page.locator('#undo')).toBeDisabled();
  });

  for (const way of ['Escape', 'Back', 'a tap outside']) {
    test(`${way} closes the row sheet and stays on Beats`, async ({ page }) => {
      await name(page, 1).click();
      await expect(sheet(page)).toBeVisible();
      if (way === 'Escape') await page.keyboard.press('Escape');
      if (way === 'Back') await page.goBack();
      if (way === 'a tap outside') await page.mouse.click(4, 4);
      await expect(sheet(page)).toBeHidden();
      await expect(page.locator('#beats')).toBeVisible();
      await expect.poll(() => page.evaluate(() => history.state)).toBeNull();
    });
  }
});

test.describe('kits as presets', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await startApp(page);
  });

  test('one row from another kit makes it 🎨 Mix, and a kit card sets every row again', async ({ page }) => {
    await pickRowSound(page, 7, 'riff');
    await expect(page.locator('#sounds')).toContainText('Mix');
    await expect(page.locator('#sounds')).toHaveAttribute('aria-label', 'Sounds: Mix');
    await page.click('#sounds');
    await expect(page.locator('.kit-card[aria-pressed="true"]')).toHaveCount(0);
    await page.locator('.kit-card', { hasText: 'Rock' }).click();
    await page.click('#kits-close');
    expect(await rowNames(page)).toEqual(ROCK);
    await expect(page.locator('#sounds')).toContainText('Rock');
  });

  test('🎲 keeps a mix’s sounds', async ({ page }) => {
    await pickRowSound(page, 4, 'synth');
    const before = await rowNames(page);
    await page.click('#surprise');
    expect(await rowNames(page)).toEqual(before);
  });

  test('each beat number keeps its own sounds, after a reload too', async ({ page }) => {
    await pickRowSound(page, 5, 'chug');
    await page.click('.slot[data-slot="1"]');
    expect(await rowNames(page)).toEqual(PARTY);
    await page.reload();
    await page.click('#start-btn');
    await page.click('.slot[data-slot="0"]');
    await expect(name(page, 5).locator('.lbl')).toHaveText('Chug');
  });

  test('📋 copies a row’s notes onto another row, not its sound', async ({ page }) => {
    await pickRowSound(page, 6, 'bell');
    await page.click('#copy');
    await page.locator('.copy-sound[data-track="0"]').click();
    await page.locator('.copy-sound[data-track="6"]').click();
    await expect(name(page, 6).locator('.lbl')).toHaveText('Bell');
    await expect(pad(page, 6, 0)).toHaveAttribute('aria-pressed', 'true');
  });
});

// The sheet fits, with big targets, at a phone, a phone on its side and a tablet, light and dark.
for (const size of [{ width: 360, height: 640 }, { width: 640, height: 360 }, { width: 820, height: 1180 }]) {
  for (const scheme of ['light', 'dark']) {
    test(`at ${size.width}×${size.height} (${scheme}) the row sheet fits with 48 px tiles`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.emulateMedia({ colorScheme: scheme });
      await startApp(page);
      await name(page, 3).click();
      await expect(sheet(page)).toBeVisible();
      const sizes = await page.locator('.row-sound').evaluateAll((tiles) => tiles.map((t) => t.getBoundingClientRect()).map((r) => Math.min(r.width, r.height)));
      expect(Math.min(...sizes)).toBeGreaterThanOrEqual(48);
      const card = await page.locator('#row-sheet .kits-card').boundingBox();
      expect(card.x).toBeGreaterThanOrEqual(0);
      expect(card.x + card.width).toBeLessThanOrEqual(size.width);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await tile(page, 'riff').scrollIntoViewIfNeeded();
      await tile(page, 'riff').click();
      await expect(name(page, 3).locator('.lbl')).toHaveText('Riff');
    });
  }
}
