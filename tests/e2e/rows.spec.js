// More rows (task 84): ➕ Row up to 12 and 🗑 Remove row back to 8, with Undo; how 12 rows
// fit on a phone, a phone on its side and a tablet, in light and dark; and that a 12-row beat
// keeps after a reload, sounds balanced and makes a video.

import { test, expect } from '@playwright/test';
import { download, maxVolume, openCamera, record, startApp } from './helpers.js';

const rows = (page) => page.locator('.sound');
const pad = (page, track, step) => page.locator(`.pad[data-track="${track}"][data-step="${step}"]`);

// ➕ Row is after the last name, or under More on phones.
async function addRow(page) {
  if (await page.locator('.add-row').isVisible()) return page.click('.add-row');
  if (!(await page.locator('#add-row-tool').isVisible())) await page.click('#more');
  await page.click('#add-row-tool');
}

async function addRows(page, count) {
  const start = await rows(page).count();
  for (let i = 1; i <= count; i += 1) {
    await addRow(page);
    await expect(rows(page)).toHaveCount(start + i);
  }
}

const cssColor = (page, name) => page.evaluate((n) => {
  const probe = document.createElement('div');
  probe.style.color = `var(${n})`;
  document.body.append(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color;
}, name);

// Calls one of audio-lab.js's functions in the page.
function lab(page, name, ...args) {
  return page.evaluate(async ([fn, params]) => {
    const module = await import(new URL('tests/e2e/audio-lab.js', location.href).href);
    return module[fn](...params);
  }, [name, args]);
}

test.describe('➕ Row on a tablet', () => {
  test.use({ viewport: { width: 1024, height: 768 } });

  test('➕ Row adds rows up to 12, each with a new sound and its own colour', async ({ page }) => {
    await startApp(page);
    await expect(rows(page)).toHaveCount(8);
    await expect(page.locator('#add-row-tool')).toBeHidden();
    await addRows(page, 4);
    await expect(page.locator('.sound .lbl')).toHaveText(
      ['Kick', 'Snare', 'Clap', 'Hat', 'Bell', 'Bass', 'Laser', 'Boing', 'Chord', 'Chug', 'Bass', 'Riff'],
    );
    await expect(page.locator('.add-row'), 'no ➕ at 12 rows').toBeHidden();
    await expect(pad(page, 11, 0)).toHaveAttribute('aria-label', 'Riff, step 1');
    await pad(page, 11, 0).click();
    await expect(pad(page, 11, 0)).toHaveAttribute('aria-pressed', 'true');
    const lit = await pad(page, 11, 0).evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(lit).toBe(await cssColor(page, '--c11'));
  });

  test('↩ takes back one ➕ Row at a time', async ({ page }) => {
    await startApp(page);
    await addRows(page, 2);
    await page.click('#undo');
    await expect(rows(page)).toHaveCount(9);
    await page.click('#undo');
    await expect(rows(page)).toHaveCount(8);
  });

  test('a 12-row beat keeps its rows and sounds after a reload', async ({ page }) => {
    await startApp(page);
    await addRows(page, 4);
    await pad(page, 10, 2).click();
    await page.reload();
    await page.click('#start-btn');
    await expect(rows(page)).toHaveCount(12);
    await expect(rows(page).nth(10)).toContainText('Bass');
    await expect(pad(page, 10, 2)).toHaveAttribute('aria-pressed', 'true');
  });

  test('beat 1 can have 12 rows while beat 2 keeps 8', async ({ page }) => {
    await startApp(page);
    await addRows(page, 4);
    await page.click('.slot[data-slot="1"]');
    await expect(rows(page)).toHaveCount(8);
    await page.click('.slot[data-slot="0"]');
    await expect(rows(page)).toHaveCount(12);
  });

  test('the Copy sheet\'s little picture shows all 12 rows', async ({ page }) => {
    await startApp(page);
    await addRows(page, 4);
    await pad(page, 11, 0).click();
    await page.click('.slot[data-slot="1"]');
    await page.click('#copy');
    const picture = page.locator('.copy-slot[data-slot="0"] canvas');
    await expect(picture).toBeVisible();
    const drawn = await picture.evaluate((canvas) => {
      const [r, g, b] = canvas.getContext('2d').getImageData(0, 11 * 4 + 1, 1, 1).data;
      return `rgb(${r}, ${g}, ${b})`;
    });
    expect(drawn).toBe(await cssColor(page, '--c11'));
  });
});

test.describe('the audio lab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('./');
  });

  // Rows 1 to 8 are Party's; ➕ Row brings Rock's Chord, Chug, Bass and Riff.
  const TWELVE = ['kick', 'snare', 'clap', 'hat', 'cowbell', 'bass', 'laser', 'boing', 'guitar', 'chug', 'rock-bass', 'riff'];

  test('12 rows at once, every step at top speed, never clip', async ({ page }) => {
    const full = Array.from({ length: 12 }, () => 'x'.repeat(32));
    const peak = await lab(page, 'peakOfRows', TWELVE, full, 180);
    expect(peak).toBeLessThan(0.96);
    expect(peak, 'still sounds').toBeGreaterThan(0.3);
  });

  test('4 more rows make a beat a little louder, not a lot', async ({ page }) => {
    const starters = await page.evaluate(async () => (await import(new URL('js/pattern.js', location.href).href)).STARTERS);
    for (const { name, rows: eight, bpm } of starters) {
      const twelve = [...eight, 'x.......x.......', '..x...x...x...x.', 'x.....x...x.....', '....x.......x...'];
      const before = await lab(page, 'rowsLoudness', TWELVE.slice(0, 8), eight, bpm);
      const after = await lab(page, 'rowsLoudness', TWELVE, twelve, bpm);
      expect(after - before, `${name}: the new rows are heard`).toBeGreaterThan(0.3);
      expect(after - before, `${name}: but don't drown out the rest`).toBeLessThan(4);
    }
  });
});

test('a 12-row beat records into a video that plays back', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await startApp(page);
  await page.click('#clear');
  await addRows(page, 4);
  for (const track of [8, 9, 10, 11]) {
    for (const step of [0, 4, 8, 12]) await pad(page, track, step).click();
  }
  await openCamera(page);
  await page.click('#mic');
  await expect(page.locator('#mic')).toContainText('Mic off');
  await record(page, 2);
  const playback = page.locator('#playback');
  await expect.poll(() => playback.evaluate((v) => v.readyState)).toBeGreaterThanOrEqual(1);
  await playback.evaluate((v) => { v.muted = true; return v.play(); });
  await expect.poll(() => playback.evaluate((v) => v.currentTime)).toBeGreaterThan(0.3);
  const { path } = await download(page, testInfo);
  expect(maxVolume(path), 'only rows 9 to 12 play, and they are in the video').toBeGreaterThan(-30);
});
