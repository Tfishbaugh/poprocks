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
  if (await page.locator('#clear').isEnabled()) await page.click('#clear');
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
const FADE = 0.08;
const TUNED = ['guitar', 'synth', 'chug', 'bass', 'rock-bass', '808', 'riff', 'bell'];
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

  test('a guitar chord stops when its squares end, not when the 1.4 s sample does', async ({ page }) => {
    const bpm = 100;
    const after = (n) => [stepAt(n, bpm) + 0.15, stepAt(n, bpm) + 0.45];
    const held = await lab(page, 'levels', 'guitar', 'x---............', bpm, [[stepAt(2, bpm), stepAt(4, bpm)], after(4)]);
    const single = await lab(page, 'levels', 'guitar', 'x...............', bpm, [[stepAt(0, bpm), stepAt(1, bpm)], after(1)]);
    expect(held[0][0], 'the held one rings in its 3rd and 4th squares').toBeGreaterThan(-35);
    expect(held[1][1], 'and has ended after them').toBeLessThan(-60);
    expect(single[0][0], 'the single one rings in its square').toBeGreaterThan(-35);
    expect(single[1][1], 'and has ended after it').toBeLessThan(-60);
  });

  // Travis (PR 3 QC): "A held note is the same length as a single note." A tuned note lasts its squares.
  test('a single tuned note is quiet by its square’s end plus the fade; a 4-step hold lasts about 4 times as long', async ({ page }) => {
    const [bpm, step] = [100, 0.15];
    for (const id of TUNED) {
      const single = await lab(page, 'lasts', id, 'x...............', bpm);
      const held = await lab(page, 'lasts', id, 'x---............', bpm);
      const times = (held - FADE) / (single - FADE);
      expect(single, `${id}: a single note lasts ${single.toFixed(2)} s`).toBeLessThanOrEqual(step + FADE + 0.02);
      expect(times, `${id}: held ${held.toFixed(2)} s, single ${single.toFixed(2)} s`).toBeGreaterThan(3.5);
      expect(times).toBeLessThan(4.5);
    }
  });

  test('at the slowest tempo a single tuned note still lasts its whole square', async ({ page }) => {
    const [bpm, step] = [60, 0.25];
    for (const id of TUNED) {
      const single = await lab(page, 'lasts', id, 'x...............', bpm);
      expect(single, `${id}: ${single.toFixed(2)} s`).toBeGreaterThanOrEqual(step);
      expect(single, id).toBeLessThanOrEqual(step + FADE + 0.02);
    }
  });

  test('drums and effects stay one-shot hits: a single crash rings on past its square', async ({ page }) => {
    expect(await lab(page, 'lasts', 'crash', 'x...............', 100)).toBeGreaterThan(0.5);
  });

  // Kits are balanced on each sound's one-shot hit over 0.4 s, so a held note rings on at about
  // that level. The samples (guitar, riff) ring as they were recorded.
  for (const id of ['synth', 'chug', 'bass', 'rock-bass', '808', 'bell']) {
    test(`a held ${id} rings on about as loud as its hit`, async ({ page }) => {
      const bpm = 100;
      const ringing = [stepAt(3, bpm), stepAt(4, bpm)];
      const [[held]] = await lab(page, 'levels', id, 'x-------........', bpm, [ringing]);
      const hit = await lab(page, 'hitLevel', id);
      expect(Math.abs(held - hit), `held ${held.toFixed(1)} dB, hit ${hit.toFixed(1)} dB`).toBeLessThan(4);
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

// ---- Press, hold and slide ----

async function center(locator) {
  const box = await locator.boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

// A mouse press on `from`, held `ms` (0: it drags right away), slid to `to`, and lifted there.
async function mouseSlide(page, from, to, ms = 0) {
  const [a, b] = [await center(from), await center(to)];
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  if (ms) await page.waitForTimeout(ms);
  await page.mouse.move(b.x, b.y, { steps: 8 });
  await page.mouse.up();
}

async function mouseHold(page, locator) {
  const a = await center(locator);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.waitForTimeout(400);
  await page.mouse.up();
}

// Real touch input through Chromium's own gesture handling, so an unheld swipe really scrolls.
async function finger(page) {
  const cdp = await page.context().newCDPSession(page);
  const send = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
  return async function slide(from, to, { hold = 0, moves = 8, gap = 20 } = {}) {
    await send('touchStart', [from]);
    if (hold) await page.waitForTimeout(hold);
    for (let i = 1; i <= moves; i += 1) {
      await send('touchMove', [{ x: from.x + ((to.x - from.x) * i) / moves, y: from.y + ((to.y - from.y) * i) / moves }]);
      await page.waitForTimeout(gap);
    }
    await send('touchEnd', []);
  };
}

const panel = (page) => page.locator('#note-panel');
const overlaps = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

test.describe('stretching with a mouse', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await startApp(page);
    await page.click('#clear');
  });

  test('press, hold and slide makes one bar, opens no panel, and is one ↩', async ({ page }) => {
    await mouseSlide(page, pad(page, 5, 2), pad(page, 5, 5), 350);
    expect(await lit(page, 5)).toEqual([2, 3, 4, 5]);
    await expect(panel(page)).toBeHidden();
    await expect(pad(page, 5, 3)).toHaveClass(/join-prev/);
    await page.click('#undo');
    expect(await lit(page, 5)).toEqual([]);
  });

  test('a mouse can drag right away, without holding first', async ({ page }) => {
    await mouseSlide(page, pad(page, 6, 4), pad(page, 6, 7));
    expect(await lit(page, 6)).toEqual([4, 5, 6, 7]);
    await expect(panel(page)).toBeHidden();
  });

  test('a mouse drag that starts at once, pauses past the hold, then carries on is one bar and one ↩', async ({ page }) => {
    const [a, b, c] = [await center(pad(page, 5, 4)), await center(pad(page, 5, 5)), await center(pad(page, 5, 7))];
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 3 });
    await page.waitForTimeout(400);
    await page.mouse.move(c.x, c.y, { steps: 4 });
    await page.mouse.up();
    expect(await lit(page, 5)).toEqual([4, 5, 6, 7]);
    await page.click('#undo');
    expect(await lit(page, 5)).toEqual([]);
  });

  test('a bar grabbed anywhere moves its end as far as the finger; sliding back shortens it', async ({ page }) => {
    await holdBass(page, 4); // steps 3 to 6
    const [from, ahead, back] = [await center(pad(page, 5, 3)), await center(pad(page, 5, 5)), await center(pad(page, 5, 1))];
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.waitForTimeout(350);
    await page.mouse.move(ahead.x, ahead.y, { steps: 6 });
    expect(await lit(page, 5)).toEqual([2, 3, 4, 5, 6, 7]);
    await page.mouse.move(back.x, back.y, { steps: 6 });
    await page.mouse.up();
    expect(await lit(page, 5)).toEqual([2, 3]);
    await page.click('#undo');
    expect(await lit(page, 5)).toEqual([2, 3, 4, 5]);
  });

  test('lifting without a slide opens ◀ ▶: each tap is a step, no dragging, one ↩ for the visit', async ({ page }) => {
    await mouseHold(page, pad(page, 5, 2));
    await expect(panel(page)).toBeVisible();
    const [shorter, longer] = [page.getByRole('button', { name: 'Shorter note' }), page.getByRole('button', { name: 'Longer note' })];
    await expect(shorter).toHaveAttribute('aria-disabled', 'true');
    for (const target of [shorter, longer]) {
      const box = await target.boundingBox();
      expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(48);
    }
    await longer.click();
    await longer.click();
    expect(await lit(page, 5)).toEqual([2, 3, 4]);
    await expect(page.locator('#sr-status')).toHaveText('Held for 3 steps.');
    await shorter.click();
    expect(await lit(page, 5)).toEqual([2, 3]);
    await page.click('#note-done');
    await expect(panel(page)).toBeHidden();
    await page.click('#undo');
    expect(await lit(page, 5)).toEqual([], 'the note the hold made and its stretch go in one ↩');
  });

  test('▶ stops at the next note', async ({ page }) => {
    await pad(page, 5, 4).click();
    await mouseHold(page, pad(page, 5, 2));
    const longer = page.getByRole('button', { name: 'Longer note' });
    await longer.click();
    await expect(longer).toHaveAttribute('aria-disabled', 'true');
    await longer.click({ force: true });
    expect(await lit(page, 5)).toEqual([2, 3, 4]);
    await expect(pad(page, 5, 4)).not.toHaveClass(/join-prev/);
  });

  test('the panel keeps clear of the steps a note grows into', async ({ page }) => {
    await mouseHold(page, pad(page, 5, 6));
    await expect(panel(page)).toBeVisible();
    const card = await page.locator('.note-card').boundingBox();
    for (const step of [6, 7, 8, 9]) expect(overlaps(card, await pad(page, 5, step).boundingBox()), `step ${step + 1}`).toBe(false);
  });
});

test.describe('stretching with a finger', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await startApp(page);
    await page.click('#more');
    await page.click('#clear');
  });

  test('press, hold and slide makes one bar, the page doesn’t scroll, and it’s one ↩', async ({ page }) => {
    const slide = await finger(page);
    const top = await page.locator('#grid-wrap').evaluate((wrap) => wrap.scrollTop);
    await slide(await center(pad(page, 5, 2)), await center(pad(page, 5, 5)), { hold: 400 });
    expect(await lit(page, 5)).toEqual([2, 3, 4, 5]);
    await expect(panel(page)).toBeHidden();
    expect(await page.locator('#grid-wrap').evaluate((wrap) => wrap.scrollTop)).toBe(top);
    await page.click('#more');
    await page.click('#undo');
    expect(await lit(page, 5)).toEqual([]);
  });

  test('a quick swipe still scrolls, and lights nothing', async ({ page }) => {
    const wrap = page.locator('#grid-wrap');
    const scrolled = () => wrap.evaluate((node) => Math.round(node.scrollTop));
    await page.emulateMedia({ reducedMotion: 'reduce' }); // ➕ jumps to its new steps at once
    await page.click('#longer');
    const top = await scrolled();
    expect(top).toBeGreaterThan(100);
    const slide = await finger(page);
    const from = await center(pad(page, 3, 20));
    await slide(from, { x: from.x, y: from.y + 300 }, { moves: 6, gap: 10 });
    await expect.poll(scrolled).toBeLessThan(top - 50);
    expect(await page.locator('.pad.on').count()).toBe(0);
    await expect(panel(page)).toBeHidden();
  });

  test('hold and lift, then tap ◀ ▶: no dragging needed', async ({ page }) => {
    const slide = await finger(page);
    const at = await center(pad(page, 1, 3));
    await slide(at, at, { hold: 400, moves: 1 });
    await expect(panel(page)).toBeVisible();
    await page.getByRole('button', { name: 'Longer note' }).tap();
    await page.getByRole('button', { name: 'Longer note' }).tap();
    expect(await lit(page, 1)).toEqual([3, 4, 5]);
    await page.locator('#note-done').tap();
    await expect(panel(page)).toBeHidden();
  });
});

// Task 84, more rows: a beat has up to 12 rows, and every one of them holds.
test.describe('held notes on rows 9 to 12', () => {
  // ➕ Row sits after the last name when there's room, and under More when there isn't.
  async function addRow(page) {
    if (await page.locator('.add-row').isVisible()) return page.click('.add-row');
    if (!(await page.locator('#add-row-tool').isVisible())) await page.click('#more');
    await page.click('#add-row-tool');
  }

  async function twelveRows(page) {
    await startApp(page);
    for (let i = 0; i < 4; i += 1) await addRow(page);
    await expect(page.locator('.sound')).toHaveCount(12);
  }

  test('wide: a slide, ◀ ▶ and the bar on row 12', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await twelveRows(page);
    await mouseSlide(page, pad(page, 11, 2), pad(page, 11, 5), 350);
    expect(await lit(page, 11)).toEqual([2, 3, 4, 5]);
    const name = (await page.locator('.sound').nth(11).locator('.lbl').textContent()).trim();
    await expect(pad(page, 11, 3)).toHaveAttribute('aria-label', `${name}, step 4, held`);
    expect(await corners(pad(page, 11, 3))).toMatchObject({ left: 0, right: 0 });
    await mouseHold(page, pad(page, 11, 9));
    await page.getByRole('button', { name: 'Longer note' }).click();
    await page.click('#note-done');
    expect(await lit(page, 11)).toEqual([2, 3, 4, 5, 9, 10]);
  });

  test('upright: Shift+→ makes a bar down row 10', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await twelveRows(page);
    await pad(page, 9, 4).focus();
    await page.keyboard.press('Shift+ArrowRight');
    await page.keyboard.press('Shift+ArrowRight');
    expect(await lit(page, 9)).toEqual([4, 5, 6]);
    expect(await corners(pad(page, 9, 5))).toMatchObject({ top: 0, bottom: 0 });
  });
});

// A held note's height is its first step's, wherever on its bar the key slider is used.
test.describe('the key slider on a held note', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await startApp(page);
    await holdBass(page, 4); // steps 3 to 6
  });

  test('Shift+↑ on a middle step moves the note’s first step', async ({ page }) => {
    await pad(page, 5, 4).focus();
    await page.keyboard.press('Shift+ArrowUp');
    await expect(pad(page, 5, 2)).toHaveAttribute('data-lift', '↑1');
    await expect(pad(page, 5, 4)).toHaveAttribute('data-lift', '');
    await expect(pad(page, 5, 2)).toHaveAttribute('aria-label', 'Bass, step 3, held, 1 higher');
  });

  test('a hold on a middle step opens the panel at the first step’s height, and moves that', async ({ page }) => {
    await pad(page, 5, 2).focus();
    await page.keyboard.press('Shift+ArrowUp');
    await mouseHold(page, pad(page, 5, 4));
    await expect(page.locator('#note-title')).toHaveText('Bass, step 3');
    await expect(page.locator('#note-slider')).toHaveValue('1');
    await page.locator('#note-slider').press('ArrowUp');
    await page.click('#note-done');
    await expect(pad(page, 5, 2)).toHaveAttribute('data-lift', '↑2');
    expect(await lit(page, 5)).toEqual([2, 3, 4, 5]);
  });
});
