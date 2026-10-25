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

test('a quick tap still just toggles, and holding a drum opens nothing', async ({ page }) => {
  await pad(page, 5, 2).click();
  await expect(pad(page, 5, 2)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#note-panel')).toBeHidden();
  await holdAndLift(page, pad(page, 1, 2));
  await expect(page.locator('#note-panel')).toBeHidden();
  await expect(pad(page, 1, 2)).toHaveAttribute('aria-pressed', 'false');
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

test.describe('on a touch screen', () => {
  test.use({ hasTouch: true });

  // A finger's hold, lifted where it started. Touch sends its click where the finger lifts, which by
  // then is the panel's backdrop: that click must not close the panel it just opened.
  test('a finger’s press and hold opens the panel, and it stays open', async ({ page }) => {
    const box = await pad(page, 5, 2).boundingBox();
    const at = [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }];
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: at });
    await page.waitForTimeout(400);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(400);
    await expect(page.locator('#note-panel')).toBeVisible();
    await expect(pad(page, 5, 2)).toHaveAttribute('aria-pressed', 'true');
    await page.locator('#note-done').tap();
    await expect(page.locator('#note-panel')).toBeHidden();
    await pad(page, 5, 4).tap();
    await expect(pad(page, 5, 4), 'the next tap toggles as usual').toHaveAttribute('aria-pressed', 'true');
  });
});

// ---- The key slider ----

const lift = (page, track, step) => pad(page, track, step).getAttribute('data-lift');

test('the slider moves a note higher or lower; the square shows it and says it', async ({ page }) => {
  await holdAndLift(page, pad(page, 5, 2));
  await expect(page.locator('#note-slider')).toBeFocused();
  await expect(page.locator('#note-slider')).toHaveAttribute('aria-valuetext', 'as written');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await expect(page.locator('#note-slider')).toHaveAttribute('aria-valuetext', '2 higher');
  expect(await lift(page, 5, 2)).toBe('↑2');
  await expect(pad(page, 5, 2)).toHaveAttribute('aria-label', 'Bass, step 3, 2 higher');
  for (let i = 0; i < 3; i += 1) await page.keyboard.press('ArrowDown');
  expect(await lift(page, 5, 2)).toBe('↓1');
  await page.click('#note-done');
  await expect(pad(page, 5, 2)).toHaveAttribute('aria-label', 'Bass, step 3, 1 lower');
});

test('one ↩ takes back a whole press and hold: the new note and its moves', async ({ page }) => {
  await holdAndLift(page, pad(page, 5, 2));
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await page.click('#note-done');
  await page.click('#undo');
  await expect(pad(page, 5, 2)).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#undo')).toBeDisabled();
});

test('the panel opens at the note’s own height, and a note keeps it after a reload', async ({ page }) => {
  await holdAndLift(page, pad(page, 5, 0));
  await page.keyboard.press('ArrowDown');
  await page.click('#note-done');
  await holdAndLift(page, pad(page, 5, 0));
  await expect(page.locator('#note-slider')).toHaveValue('-1');
  await page.click('#note-done');
  await expect.poll(() => page.evaluate(() => history.state?.poprocks ?? null), { message: 'the panel’s Back entry is gone' }).toBeNull();
  await page.reload();
  await page.click('#start-btn');
  expect(await lift(page, 5, 0)).toBe('↓1');
});

test('Shift+↑ and Shift+↓ move a focused tuned note, one ↩ each; drums don’t move', async ({ page }) => {
  await pad(page, 5, 0).focus();
  await page.keyboard.press('Shift+ArrowUp');
  expect(await lift(page, 5, 0)).toBe('↑1');
  await expect(page.locator('#sr-status')).toHaveText('Bass, step 1, 1 higher');
  await page.keyboard.press('Shift+ArrowDown');
  await page.keyboard.press('Shift+ArrowDown');
  expect(await lift(page, 5, 0)).toBe('↓1');
  await page.click('#undo');
  expect(await lift(page, 5, 0)).toBe('');
  await pad(page, 0, 0).focus();
  await page.keyboard.press('Shift+ArrowUp');
  expect(await lift(page, 0, 0)).toBe('');
  await expect(pad(page, 0, 0), 'the arrow didn’t move focus either').toBeFocused();
});

test('a note can go 4 steps either way, and no further', async ({ page }) => {
  await pad(page, 5, 0).focus();
  for (let i = 0; i < 6; i += 1) await page.keyboard.press('Shift+ArrowUp');
  expect(await lift(page, 5, 0)).toBe('↑4');
});

for (const size of [{ width: 360, height: 640 }, { width: 640, height: 360 }, { width: 820, height: 1180 }]) {
  test(`at ${size.width}×${size.height} the panel sits on screen beside its note`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.reload();
    await page.click('#start-btn');
    const target = pad(page, 5, 6);
    await target.scrollIntoViewIfNeeded();
    await holdAndLift(page, target);
    const card = await page.locator('.note-card').boundingBox();
    const box = await target.boundingBox();
    expect(card.x >= 0 && card.y >= 0 && card.x + card.width <= size.width && card.y + card.height <= size.height).toBe(true);
    const apart = card.x + card.width <= box.x || box.x + box.width <= card.x || card.y + card.height <= box.y || box.y + box.height <= card.y;
    expect(apart, 'the panel never covers its note').toBe(true);
    const slider = await page.locator('#note-slider').boundingBox();
    expect(slider.width).toBeGreaterThanOrEqual(44);
    expect(slider.height).toBeGreaterThan(slider.width);
  });
}
