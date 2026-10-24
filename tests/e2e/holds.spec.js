// Held notes (task 84): how they sound (rendered offline through the real engine), how they
// look on the grid, and the keys and Undo that stretch them.

import { test, expect } from '@playwright/test';
import { startApp } from './helpers.js';

const pad = (page, track, step) => page.locator(`.pad[data-track="${track}"][data-step="${step}"]`);
const lit = (page, track) => page.locator(`.pad.on[data-track="${track}"]`).evaluateAll((pads) => pads.map((p) => Number(p.dataset.step)));
const corners = (locator) => locator.evaluate((node) => {
  const style = getComputedStyle(node);
  const px = (name) => parseFloat(style[name]);
  return {
    left: px('borderLeftWidth'), right: px('borderRightWidth'), top: px('borderTopWidth'), bottom: px('borderBottomWidth'),
    tl: px('borderTopLeftRadius'), tr: px('borderTopRightRadius'), bl: px('borderBottomLeftRadius'), br: px('borderBottomRightRadius'),
  };
});

// A plain note on the Bass row at step 3, then Shift+→ until it holds `steps` steps.
async function holdBass(page, steps, start = 2) {
  await page.click('#clear');
  await pad(page, 5, start).click();
  await pad(page, 5, start).focus();
  for (let i = 1; i < steps; i += 1) await page.keyboard.press('Shift+ArrowRight');
}

// Calls one of hold-lab.js's functions in the page.
function lab(page, name, ...args) {
  return page.evaluate(async ([fn, params]) => {
    const module = await import(new URL('tests/e2e/hold-lab.js', location.href).href);
    return module[fn](...params);
  }, [name, args]);
}

const START = 0.05;
const stepAt = (n, bpm) => START + (n * 15) / bpm;

test.describe('how held notes sound', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('./');
  });

  test('a held chord rings for all its steps, then goes quiet', async ({ page }) => {
    const bpm = 100;
    const late = [stepAt(6, bpm), stepAt(8, bpm)]; // the last 2 steps of an 8-step hold
    const after = [stepAt(8, bpm) + 0.15, stepAt(8, bpm) + 0.5];
    const held = await lab(page, 'levels', 'synth', 'x-------........', bpm, [late, after]);
    const short = await lab(page, 'levels', 'synth', 'x...............', bpm, [late, after]);
    expect(held[0][0], 'still ringing at the end of the hold').toBeGreaterThan(-40);
    expect(held[0][0] - short[0][0], 'louder than a short note there').toBeGreaterThan(20);
    expect(held[1][1], 'quiet once the hold ends').toBeLessThan(-60);
  });

  test('a held guitar chord stops when its hold ends, not when the sample does', async ({ page }) => {
    const bpm = 100;
    const during = [stepAt(2, bpm), stepAt(4, bpm)];
    const after = [stepAt(4, bpm) + 0.15, stepAt(4, bpm) + 0.45]; // the 1.4 s sample would still ring
    const held = await lab(page, 'levels', 'guitar', 'x---............', bpm, [during, after]);
    const short = await lab(page, 'levels', 'guitar', 'x...............', bpm, [during, after]);
    expect(held[0][0]).toBeGreaterThan(-35);
    expect(short[1][0], 'a short note rings on').toBeGreaterThan(-45);
    expect(held[1][1], 'the held one has ended').toBeLessThan(-60);
  });

  // Kits are balanced on each sound's first 0.4 s, so a held note rings on at about that level.
  // The samples (guitar, riff) ring as they were recorded.
  for (const id of ['synth', 'chug', 'bass', 'rock-bass', '808', 'bell']) {
    test(`a held ${id} rings on about as loud as its short note`, async ({ page }) => {
      const bpm = 100;
      const ringing = [stepAt(3, bpm), stepAt(4, bpm)];
      const [[held]] = await lab(page, 'levels', id, 'x-------........', bpm, [ringing]);
      const [[short]] = await lab(page, 'levels', id, 'x...............', bpm, [[START, START + 0.4]]);
      expect(Math.abs(held - short), `held ${held.toFixed(1)} dB, short ${short.toFixed(1)} dB`).toBeLessThan(4);
    });
  }

  test('a held snare rolls: it hits on every step of the bar', async ({ page }) => {
    const bpm = 100;
    const hits = [0, 1, 2, 3].map((n) => [stepAt(n, bpm), stepAt(n, bpm) + 0.03]);
    const gaps = [1, 2, 3].map((n) => [stepAt(n, bpm) - 0.03, stepAt(n, bpm)]);
    const levels = await lab(page, 'levels', 'snare', 'x---............', bpm, [...hits, ...gaps]);
    const [peaks, before] = [levels.slice(0, 4).map(([, p]) => p), levels.slice(4).map(([, p]) => p)];
    peaks.forEach((p, n) => expect(p, `step ${n + 1} hits`).toBeGreaterThan(-12));
    before.forEach((p, n) => expect(peaks[n + 1] - p, `step ${n + 2} is a new hit`).toBeGreaterThan(6));
  });
});

test.describe('held notes on the grid', () => {
  test('Shift+→ stretches the focused note into one bar, Shift+← shrinks it, one ↩ a press', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await startApp(page);
    await holdBass(page, 4);
    expect(await lit(page, 5)).toEqual([2, 3, 4, 5]);
    await expect(pad(page, 5, 2)).toBeFocused();
    await expect(page.locator('#sr-status')).toHaveText('Held for 4 steps.');
    await expect(pad(page, 5, 2)).toHaveAttribute('aria-label', 'Bass, step 3, held');
    await expect(pad(page, 5, 4)).toHaveAttribute('aria-label', 'Bass, step 5, held');
    await expect(pad(page, 5, 4)).toHaveAttribute('aria-pressed', 'true');
    await expect(pad(page, 5, 6)).toHaveAttribute('aria-label', 'Bass, step 7');

    await page.keyboard.press('Shift+ArrowLeft');
    expect(await lit(page, 5)).toEqual([2, 3, 4]);
    await page.click('#undo');
    expect(await lit(page, 5)).toEqual([2, 3, 4, 5]);
    await page.click('#undo');
    expect(await lit(page, 5)).toEqual([2, 3, 4]);
  });

  test('a note stretches up to the next note and no further, and shrinks to one step', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await startApp(page);
    await holdBass(page, 1);
    await pad(page, 5, 5).click();
    await pad(page, 5, 2).focus();
    for (let i = 0; i < 5; i += 1) await page.keyboard.press('Shift+ArrowRight');
    expect(await lit(page, 5)).toEqual([2, 3, 4, 5]);
    await expect(pad(page, 5, 5)).not.toHaveClass(/join-prev/);
    for (let i = 0; i < 5; i += 1) await page.keyboard.press('Shift+ArrowLeft');
    expect(await lit(page, 5)).toEqual([2, 5]);
    await expect(pad(page, 5, 2)).toHaveAttribute('aria-label', 'Bass, step 3');
    await expect(page.locator('#sr-status')).toHaveText('Not held.');
  });

  test('Shift+→ on an empty square starts a 2-step note there', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await startApp(page);
    await page.click('#clear');
    await pad(page, 1, 7).focus();
    await page.keyboard.press('Shift+ArrowLeft');
    expect(await lit(page, 1)).toEqual([]);
    await page.keyboard.press('Shift+ArrowRight');
    expect(await lit(page, 1)).toEqual([7, 8]);
  });

  test('a tap anywhere on a bar takes the whole note away, and ↩ brings it back', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await startApp(page);
    await holdBass(page, 4);
    await pad(page, 5, 4).click();
    expect(await lit(page, 5)).toEqual([]);
    await page.click('#undo');
    expect(await lit(page, 5)).toEqual([2, 3, 4, 5]);
  });

  test('wide: one bar across the row, rounded only at its ends', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await startApp(page);
    await holdBass(page, 3);
    const [first, middle, last] = await Promise.all([2, 3, 4].map((step) => corners(pad(page, 5, step))));
    expect(first).toMatchObject({ right: 0, tr: 0, br: 0, left: 3 });
    expect(first.tl).toBeGreaterThan(8);
    expect(middle).toMatchObject({ left: 0, right: 0, tl: 0, tr: 0, bl: 0, br: 0, top: 3, bottom: 3 });
    expect(last).toMatchObject({ left: 0, tl: 0, bl: 0, right: 3 });
    expect(last.br).toBeGreaterThan(8);
    const box = (step) => pad(page, 5, step).boundingBox();
    const [a, b] = await Promise.all([box(2), box(3)]);
    expect(Math.abs(a.x + a.width - b.x), 'no gap between steps').toBeLessThan(1);
  });

  test('upright: the bar runs down the row, rounded only at its ends', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await startApp(page);
    await page.click('#more'); // 🧽 Clear is under More on a phone
    await holdBass(page, 3);
    const [first, middle, last] = await Promise.all([2, 3, 4].map((step) => corners(pad(page, 5, step))));
    expect(first).toMatchObject({ bottom: 0, bl: 0, br: 0, left: 3, right: 3 });
    expect(first.tl).toBeGreaterThan(8);
    expect(middle).toMatchObject({ top: 0, bottom: 0, tl: 0, tr: 0, bl: 0, br: 0 });
    expect(last).toMatchObject({ top: 0, tl: 0, tr: 0 });
    expect(last.bl).toBeGreaterThan(8);
  });

  test('a bar crossing a bar line joins over the divider', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await startApp(page);
    await page.click('#longer');
    await holdBass(page, 4, 14);
    expect(await lit(page, 5)).toEqual([14, 15, 16, 17]);
    expect(await corners(pad(page, 5, 16))).toMatchObject({ left: 0, right: 0 });
  });
});
