// More rows (task 84): ➕ Row up to 12 and 🗑 Remove row back to 8, with Undo; how 12 rows
// fit on a phone, a phone on its side and a tablet, in light and dark; and that a 12-row beat
// keeps after a reload, sounds balanced and makes a video.

import { test, expect } from '@playwright/test';
import { download, maxVolume, openCamera, record, startApp } from './helpers.js';

const names = (page) => page.locator('.sound');
const name = (page, track) => page.locator(`.sound[data-track="${track}"]`);
const pad = (page, track, step) => page.locator(`.pad[data-track="${track}"][data-step="${step}"]`);
const sheet = (page) => page.locator('#row-sheet');
const toast = (page) => page.locator('#toast:not([hidden])');

// ➕ Row is after the last name, or under More on phones.
async function addRow(page) {
  if (await page.locator('.add-row').isVisible()) return page.click('.add-row');
  if (!(await page.locator('#add-row-tool').isVisible())) await page.click('#more');
  await page.click('#add-row-tool');
}

async function addRows(page, count) {
  const start = await names(page).count();
  for (let i = 1; i <= count; i += 1) {
    await addRow(page);
    await expect(names(page)).toHaveCount(start + i);
  }
  if (await page.locator('#more').getAttribute('aria-expanded') === 'true') await page.click('#more');
}

async function removeRow(page, track) {
  await name(page, track).scrollIntoViewIfNeeded();
  await name(page, track).click();
  await expect(sheet(page)).toBeVisible();
  await page.click('#remove-row');
  await expect(sheet(page)).toBeHidden();
}

const labels = (page) => page.locator('.sound .lbl').allTextContents();

// A CSS color, as the browser computes it in the current theme.
const cssColor = (page, variable) => page.evaluate((v) => {
  const probe = document.createElement('div');
  probe.style.color = `var(${v})`;
  document.body.append(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color;
}, variable);

// Calls one of audio-lab.js's functions in the page.
function lab(page, fn, ...args) {
  return page.evaluate(async ([f, params]) => {
    const module = await import(new URL('tests/e2e/audio-lab.js', location.href).href);
    return module[f](...params);
  }, [fn, args]);
}

const PARTY = ['Kick', 'Snare', 'Clap', 'Hat', 'Bell', 'Bass', 'Laser', 'Boing'];

test.describe('➕ Row and 🗑 Remove row on a tablet', () => {
  test.use({ viewport: { width: 1024, height: 768 } });

  test('➕ Row adds rows up to 12, each with a new sound and its own colour', async ({ page }) => {
    await startApp(page);
    await expect(names(page)).toHaveCount(8);
    await expect(page.locator('#add-row-tool')).toBeHidden();
    await addRows(page, 4);
    expect(await labels(page)).toEqual([...PARTY, 'Chord', 'Chug', 'Bass', 'Riff']);
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
    await expect(names(page)).toHaveCount(9);
    await page.click('#undo');
    await expect(names(page)).toHaveCount(8);
    await expect(page.locator('#undo')).toBeDisabled();
  });

  test('🗑 shows only above 8 rows, and takes 12 rows back to 8', async ({ page }) => {
    await startApp(page);
    await name(page, 2).click();
    await expect(page.locator('#remove-row')).toBeHidden();
    await page.keyboard.press('Escape');
    await addRows(page, 4);
    for (const count of [11, 10, 9, 8]) {
      await removeRow(page, 8);
      await expect(names(page)).toHaveCount(count);
    }
    expect(await labels(page)).toEqual(PARTY);
    await name(page, 0).click();
    await expect(page.locator('#remove-row'), 'no 🗑 at 8 rows').toBeHidden();
  });

  test('🗑 on a middle row moves the rows below up; the toast\'s Undo brings it back', async ({ page }) => {
    await startApp(page);
    await addRows(page, 1);
    await pad(page, 3, 5).click();
    await removeRow(page, 3);
    await expect(toast(page)).toContainText('Hat row removed');
    expect(await labels(page)).toEqual(['Kick', 'Snare', 'Clap', 'Bell', 'Bass', 'Laser', 'Boing', 'Chord']);
    await expect(page.locator('.add-row')).toBeVisible();
    await toast(page).locator('#toast-action').click();
    expect(await labels(page)).toEqual([...PARTY, 'Chord']);
    await expect(pad(page, 3, 5)).toHaveAttribute('aria-pressed', 'true');
  });

  test('↩ takes back 🗑 in one step, and a sound tried on the same visit in another', async ({ page }) => {
    await startApp(page);
    await addRows(page, 2);
    await name(page, 9).click();
    await page.click('#row-sheet .row-sound[data-sound="hey"]');
    await page.click('#remove-row');
    await expect(names(page)).toHaveCount(9);
    await expect(toast(page)).toContainText('Hey! row removed');
    await page.click('#undo');
    await expect(names(page)).toHaveCount(10);
    await expect(name(page, 9).locator('.lbl')).toHaveText('Hey!');
    await page.click('#undo');
    await expect(name(page, 9).locator('.lbl')).toHaveText('Chug');
    await page.click('#undo');
    await page.click('#undo');
    await expect(names(page)).toHaveCount(8);
  });

  test('a 12-row beat keeps its rows and sounds after a reload', async ({ page }) => {
    await startApp(page);
    await addRows(page, 4);
    await pad(page, 10, 2).click();
    await page.reload();
    await page.click('#start-btn');
    await expect(names(page)).toHaveCount(12);
    expect(await labels(page)).toEqual([...PARTY, 'Chord', 'Chug', 'Bass', 'Riff']);
    await expect(pad(page, 10, 2)).toHaveAttribute('aria-pressed', 'true');
  });

  test('beat 1 can have 12 rows while beat 2 keeps 8', async ({ page }) => {
    await startApp(page);
    await addRows(page, 4);
    await page.click('.slot[data-slot="1"]');
    await expect(names(page)).toHaveCount(8);
    await expect(page.locator('.add-row')).toBeVisible();
    await page.click('.slot[data-slot="0"]');
    await expect(names(page)).toHaveCount(12);
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

test('in a short laptop window ➕ Row sits with the tools, so 8 rows still fit without scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 600 });
  await startApp(page);
  await expect(page.locator('.add-row')).toBeHidden();
  await expect(page.locator('#add-row-tool')).toBeVisible();
  await page.click('#add-row-tool');
  await expect(names(page)).toHaveCount(9);
  await expect(name(page, 8)).toContainText('Chord');
});

// Buttons under 44 px, and anything wider than the screen.
function layoutProblems(page) {
  return page.evaluate(() => {
    const visible = (el) => el.checkVisibility() && el.getBoundingClientRect().width > 0;
    const small = [...document.querySelectorAll('#beats button')].filter(visible)
      .filter((el) => Math.min(el.getBoundingClientRect().width, el.getBoundingClientRect().height) < 43.5)
      .map((el) => el.id || el.getAttribute('aria-label'));
    const wide = [document.documentElement, document.body, ...document.querySelectorAll('.screen, .bar, .top, .strip-nav')]
      .filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => el.id || el.className || el.tagName);
    return { small, wide };
  });
}

// Scrolls each pad into view (as a finger or the arrow keys would) and checks nothing covers it.
function unreachablePads(page) {
  return page.evaluate(() => [...document.querySelectorAll('.pad')].filter((el) => {
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const box = el.getBoundingClientRect();
    return document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2) !== el;
  }).map((el) => el.getAttribute('aria-label')));
}

// Where row 1's name sits in the grid's box, after scrolling the grid as far as it goes.
function nameAfterScroll(page) {
  return page.evaluate(() => {
    const wrap = document.getElementById('grid-wrap');
    wrap.scrollTo(wrap.scrollWidth, wrap.scrollHeight);
    const [box, frame] = [document.querySelector('.sound').getBoundingClientRect(), wrap.getBoundingClientRect()];
    return { top: box.top - frame.top, left: box.left - frame.left, bottom: frame.bottom - box.bottom, right: frame.right - box.right };
  });
}

const SIZES = [
  { name: 'phone', width: 360, height: 640, pinned: 'top' },
  { name: 'phone on its side', width: 640, height: 360, pinned: 'left' },
  { name: 'tablet', width: 1024, height: 768, pinned: 'left' },
];

for (const size of SIZES) {
  for (const scheme of ['light', 'dark']) {
    test(`12 rows on a ${size.name} (${size.width}×${size.height}, ${scheme}): no sideways page, 44 px pads, names pinned`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      await startApp(page);
      await addRows(page, 4);
      expect(await layoutProblems(page)).toEqual({ small: [], wide: [] });
      expect(await unreachablePads(page)).toEqual([]);
      for (const track of [8, 11]) {
        await pad(page, track, 0).scrollIntoViewIfNeeded();
        await pad(page, track, 0).click();
        const lit = await pad(page, track, 0).evaluate((el) => getComputedStyle(el).backgroundColor);
        expect(lit, `row ${track + 1} in its ${scheme} colour`).toBe(await cssColor(page, `--c${track}`));
      }
      const pinned = await nameAfterScroll(page);
      expect(Math.abs(pinned[size.pinned]), `the names stay at the ${size.pinned} while the grid scrolls`).toBeLessThanOrEqual(12);
      await page.screenshot({ path: test.info().outputPath('twelve-rows.png') });
    });
  }
}

test.describe('the audio lab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('./');
  });

  // Rows 1 to 8 are Party's; ➕ Row brings Rock's Chord, Chug, Bass and Riff.
  const TWELVE = ['kick', 'snare', 'clap', 'hat', 'cowbell', 'bass', 'laser', 'boing', 'guitar', 'chug', 'rock-bass', 'riff'];

  test('12 rows at once, every step at top speed, never clip', async ({ page }) => {
    const full = Array.from({ length: 12 }, () => 'x'.repeat(32));
    const peak = await lab(page, 'peakOfBeat', TWELVE, full, 180);
    expect(peak).toBeLessThan(0.96);
    expect(peak, 'still sounds').toBeGreaterThan(0.3);
  });

  // The bus's compressor and limiter hold a busy 12-row beat near the loudest 8-row starters
  // (about −12 LUFS), so a quiet beat gets louder with 4 busy rows and a loud one barely does.
  test('4 busy rows are heard, but a 12-row beat is never much louder than the loudest 8-row one', async ({ page }) => {
    const starters = await page.evaluate(async () => (await import(new URL('js/pattern.js', location.href).href)).STARTERS);
    const more = ['x.......x.......', '..x...x...x...x.', 'x.....x...x.....', '....x.......x...'];
    const eights = [];
    const twelves = [];
    for (const { name: beatName, rows, bpm } of starters) {
      eights.push(await lab(page, 'beatLoudness', TWELVE.slice(0, 8), rows, bpm));
      twelves.push(await lab(page, 'beatLoudness', TWELVE, [...rows, ...more], bpm));
      expect(twelves.at(-1) - eights.at(-1), `${beatName}: the new rows are heard`).toBeGreaterThan(0.3);
    }
    const [loudest8, loudest12] = [Math.max(...eights), Math.max(...twelves)];
    expect(loudest12 - loudest8, `12 rows at ${loudest12.toFixed(1)} LUFS, 8 at ${loudest8.toFixed(1)}`).toBeLessThan(1.5);
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
