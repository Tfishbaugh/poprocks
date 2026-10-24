// Held notes (task 84): how they sound (rendered offline through the real engine), how they
// look on the grid, and the keys and Undo that stretch them.

import { test, expect } from '@playwright/test';

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
