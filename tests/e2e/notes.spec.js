// Press and hold a note (task 84): the hold detector and the note panel with its key slider.

import { test, expect } from '@playwright/test';
import { startApp } from './helpers.js';

const pad = (page, track, step) => page.locator(`.pad[data-track="${track}"][data-step="${step}"]`);

// A mouse press held past the 250 ms hold, then lifted where it started.
async function holdAndLift(page, locator, ms = 400) {
  const box = await locator.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await startApp(page);
});

test('press and hold a tuned square, then lift: the note panel opens and the square stays lit', async ({ page }) => {
  await expect(pad(page, 5, 2)).toHaveAttribute('aria-pressed', 'false');
  await holdAndLift(page, pad(page, 5, 2));
  await expect(page.locator('#note-panel')).toBeVisible();
  await expect(page.locator('#note-title')).toHaveText('Bass, step 3');
  await expect(pad(page, 5, 2), 'holding an empty square makes a note').toHaveAttribute('aria-pressed', 'true');
  await page.click('#note-done');
  await expect(page.locator('#note-panel')).toBeHidden();
  await expect(pad(page, 5, 2), 'the hold’s click didn’t toggle it back').toHaveAttribute('aria-pressed', 'true');
});

test('a quick tap still just toggles, and holding a drum opens the panel without the slider', async ({ page }) => {
  await pad(page, 5, 2).click();
  await expect(pad(page, 5, 2)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#note-panel')).toBeHidden();
  // Held notes (task 84): every sound gets ◀ ▶; only tuned ones get the key slider.
  await holdAndLift(page, pad(page, 1, 2));
  await expect(page.locator('#note-panel')).toBeVisible();
  await expect(page.locator('#note-pitch')).toBeHidden();
  await expect(page.locator('#note-length')).toBeVisible();
  await expect(pad(page, 1, 2)).toHaveAttribute('aria-pressed', 'true');
});

for (const way of ['Escape', 'Back', 'a tap outside']) {
  test(`${way} closes the note panel`, async ({ page }) => {
    await holdAndLift(page, pad(page, 5, 2));
    await expect(page.locator('#note-panel')).toBeVisible();
    if (way === 'Escape') await page.keyboard.press('Escape');
    if (way === 'Back') await page.goBack();
    if (way === 'a tap outside') await page.mouse.click(5, 760);
    await expect(page.locator('#note-panel')).toBeHidden();
    await expect(page.locator('#beats')).toBeVisible();
  });
}
