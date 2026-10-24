// Sound kits: the Sounds button and its cards, Undo, each beat's own kit, the bundled samples,
// the layout, and how the kits sound (rendered offline through the app's real engine).

import { test, expect } from '@playwright/test';
import { startApp } from './helpers.js';

const ROCK = ['Kick', 'Snare', 'Tom', 'Crash', 'Chord', 'Chug', 'Bass', 'Riff'];
const KPOP = ['Kick', 'Clap', 'Snap', 'Hat', '808', 'Bell', 'Chord', 'Hey!'];
const PARTY = ['Kick', 'Snare', 'Clap', 'Hat', 'Bell', 'Bass', 'Laser', 'Boing'];
const SAMPLE_FILES = ['chord', 'crash', 'hey', 'riff'];

const rowNames = (page) => page.locator('.sound .lbl').allTextContents();
const card = (page, name) => page.locator('.kit-card', { hasText: name });

async function pickKit(page, name) {
  await page.click('#sounds');
  await expect(page.locator('#kits')).toBeVisible();
  await card(page, name).click();
  await page.click('#kits-close');
  await expect(page.locator('#kits')).toBeHidden();
}

// Calls one of audio-lab.js's functions in the page.
function lab(page, name, ...args) {
  return page.evaluate(async ([fn, params]) => {
    const module = await import(new URL('tests/e2e/audio-lab.js', location.href).href);
    return module[fn](...params);
  }, [name, args]);
}

test.describe('picking sounds', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
  });

  test('the Sounds button opens big cards; Rock and K-pop rename every row', async ({ page }) => {
    await startApp(page);
    await expect(page.locator('#sounds')).toHaveText(/Party/);
    await expect(page.locator('#sounds')).toHaveAttribute('aria-label', 'Sounds: Party');
    await page.click('#sounds');
    await expect(page.locator('.kit-card .lbl')).toHaveText(['Party', 'Rock', 'K-pop']);
    await expect(card(page, 'Party')).toHaveAttribute('aria-pressed', 'true');
    await expect(card(page, 'Party')).toBeFocused();

    await card(page, 'Rock').click();
    await expect(card(page, 'Rock')).toHaveAttribute('aria-pressed', 'true');
    await expect(card(page, 'Party')).toHaveAttribute('aria-pressed', 'false');
    expect(await rowNames(page)).toEqual(ROCK);
    await expect(page.locator('.pad[data-track="5"][data-step="3"]')).toHaveAttribute('aria-label', 'Chug, step 4');
    await expect(page.locator('.sound').nth(3)).toHaveAttribute('aria-label', 'Crash sound');

    await card(page, 'K-pop').click();
    expect(await rowNames(page)).toEqual(KPOP);
    await page.click('#kits-close');
    await expect(page.locator('#sounds')).toHaveText(/K-pop/);
    await expect(page.locator('#toast')).toContainText('K-pop sounds');

    await page.click('#toast-action');
    expect(await rowNames(page)).toEqual(PARTY);
    await expect(page.locator('#sounds')).toHaveText(/Party/);
  });

  test('↩ takes back a visit to Sounds in one step, however many kits were tried', async ({ page }) => {
    await startApp(page);
    const pads = await page.locator('.pad.on').count();
    await page.click('#sounds');
    await card(page, 'Rock').click();
    await card(page, 'K-pop').click();
    await card(page, 'Rock').click();
    await page.click('#kits-close');
    expect(await rowNames(page)).toEqual(ROCK);
    expect(await page.locator('.pad.on').count(), 'the pattern stays').toBe(pads);
    await page.click('#undo');
    expect(await rowNames(page)).toEqual(PARTY);
    await expect(page.locator('#undo')).toBeDisabled();
  });

  test('trying kits and coming back to the first leaves nothing to undo', async ({ page }) => {
    await startApp(page);
    await page.click('#sounds');
    await card(page, 'Rock').click();
    await card(page, 'Party').click();
    await page.click('#kits-close');
    await expect(page.locator('#toast')).toBeHidden();
    await expect(page.locator('#undo')).toBeDisabled();
  });

  test('each beat number keeps its own kit, after a reload too', async ({ page }) => {
    await startApp(page);
    await pickKit(page, 'Rock');
    await page.click('.slot[data-slot="2"]');
    expect(await rowNames(page)).toEqual(PARTY);
    await pickKit(page, 'K-pop');
    await page.click('.slot[data-slot="0"]');
    expect(await rowNames(page)).toEqual(ROCK);
    await expect(page.locator('#sounds')).toHaveText(/Rock/);

    await page.reload();
    await page.click('#start-btn');
    expect(await rowNames(page)).toEqual(ROCK);
    await page.click('.slot[data-slot="1"]');
    expect(await rowNames(page)).toEqual(PARTY);
    await page.click('.slot[data-slot="2"]');
    expect(await rowNames(page)).toEqual(KPOP);
  });

  test('Escape and a tap outside the cards close the picker', async ({ page }) => {
    await startApp(page);
    await page.click('#sounds');
    await page.keyboard.press('Escape');
    await expect(page.locator('#kits')).toBeHidden();
    await expect(page.locator('#beats')).toBeVisible();
    await page.click('#sounds');
    await page.mouse.click(8, 760);
    await expect(page.locator('#kits')).toBeHidden();
  });

  test('a card tap plays a preview when the beat isn’t playing', async ({ page }) => {
    await page.addInitScript(() => {
      window.__starts = 0;
      const start = AudioScheduledSourceNode.prototype.start;
      AudioScheduledSourceNode.prototype.start = function count(...args) {
        window.__starts += 1;
        return start.apply(this, args);
      };
    });
    await startApp(page);
    await page.click('#sounds');
    const before = await page.evaluate(() => window.__starts);
    await card(page, 'Rock').click();
    await expect.poll(() => page.evaluate(() => window.__starts)).toBeGreaterThan(before + 8);
  });

  test('🎲 in Rock gives a Rock starter beat', async ({ page }) => {
    await startApp(page);
    await pickKit(page, 'Rock');
    await page.click('#surprise');
    const lit = await page.locator('.pad.on').evaluateAll((pads) => pads.map((p) => `${p.dataset.track}:${p.dataset.step}`).sort());
    const starters = await page.evaluate(async () => {
      const { kitStarters } = await import(new URL('js/sounds.js', location.href).href);
      return kitStarters('rock').map((s) => s.rows.flatMap((row, track) => [...row].flatMap((c, step) => (c === 'x' ? [`${track}:${step}`] : []))).sort());
    });
    expect(starters).toContainEqual(lit);
    expect(await rowNames(page)).toEqual(ROCK);
  });
});

test('the samples come from the app itself and are kept for offline use', async ({ page }) => {
  const requests = [];
  page.on('requestfinished', async (request) => {
    const response = await request.response();
    if (request.url().includes('/sounds/')) requests.push([new URL(request.url()).pathname, response.status(), response.headers()['content-type']]);
  });
  await startApp(page);
  await expect.poll(() => requests.length).toBeGreaterThanOrEqual(SAMPLE_FILES.length);
  requests.forEach(([path, status, type]) => {
    expect(path).toMatch(/^\/poprocks\/sounds\/[a-z]+\.mp3$/);
    expect(status).toBe(200);
    expect(type).toBe('audio/mpeg');
  });
  expect(await lab(page, 'samplesLoaded')).toEqual(SAMPLE_FILES);
  await page.evaluate(() => navigator.serviceWorker.ready);
  const cached = await page.evaluate(async (files) => {
    const cache = await caches.open('poprocks-v1');
    const hits = await Promise.all(files.map((name) => cache.match(`./sounds/${name}.mp3`)));
    return hits.map(Boolean);
  }, SAMPLE_FILES);
  expect(cached).toEqual(SAMPLE_FILES.map(() => true));
});

// ---- Layout ----

const SIZES = [
  { width: 360, height: 640 }, { width: 400, height: 800 }, { width: 480, height: 900 }, { width: 520, height: 900 },
  { width: 600, height: 900 }, { width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 1366, height: 768 },
  { width: 852, height: 393 }, { width: 740, height: 360 },
];

async function offscreen(page, selector) {
  return page.locator(selector).evaluateAll((nodes) => nodes.filter((node) => {
    const box = node.getBoundingClientRect();
    return box.left < 0 || box.top < 0 || box.right > innerWidth + 0.5 || box.bottom > innerHeight + 0.5
      || box.width < 43.5 || box.height < 43.5;
  }).map((node) => node.id || node.textContent));
}

// On a phone on its side the rail has no room for Sounds, so it waits under More.
async function openSounds(page) {
  if (await page.locator('#sounds').isVisible()) return page.click('#sounds');
  await page.click('#more');
  await page.click('#sounds-tool');
}

for (const size of SIZES) {
  test(`at ${size.width}×${size.height} the Sounds button and the picker fit, with big targets`, async ({ page }) => {
    await page.setViewportSize(size);
    await startApp(page);
    const rail = size.height <= 520 && size.width > size.height;
    await expect(page.locator(rail ? '#more' : '#sounds')).toBeVisible();
    expect(await offscreen(page, `${rail ? '#more' : '#sounds'}, .slot, #play, #make-video`)).toEqual([]);
    const wide = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    expect(wide, 'no sideways scroll').toBe(false);
    // On a phone the word hides to make room (the logo hides on its side), but stays for screen readers.
    if (await page.locator('.logo').isVisible()) await expect(page.getByRole('heading', { name: 'PopRocks' })).toBeAttached();
    await openSounds(page);
    await expect(page.locator('#kits')).toBeVisible();
    expect(await offscreen(page, '.kit-card, #kits-close')).toEqual([]);
    const small = await page.locator('#kits .lbl, .kit-credit').evaluateAll((nodes) => nodes
      .filter((node) => parseFloat(getComputedStyle(node).fontSize) < 14).map((node) => node.textContent));
    expect(small).toEqual([]);
    await expect(page.locator('.kit-credit')).toContainText(/sounds by/i);
  });
}

function overlaps(boxes) {
  const hit = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
  return boxes.flatMap((a, i) => boxes.slice(i + 1).filter((b) => hit(a.box, b.box)).map((b) => `${a.id} × ${b.id}`));
}

for (const size of [{ width: 740, height: 360 }, { width: 852, height: 393 }]) {
  test(`on a phone on its side (${size.width}×${size.height}) nothing in the rail overlaps, and Sounds opens from More`, async ({ page }) => {
    await page.setViewportSize(size);
    await startApp(page);
    const ids = ['slots', 'strip-back', 'strip-next', 'more', 'play', 'make-video'];
    const boxes = await Promise.all(ids.map(async (id) => ({ id, box: await page.locator(`#${id}`).boundingBox() })));
    expect(overlaps(boxes)).toEqual([]);
    await expect(page.locator('#sounds')).toBeHidden();
    await openSounds(page);
    await expect(page.locator('#kits')).toBeVisible();
    await card(page, 'K-pop').click();
    await page.click('#kits-close');
    expect(await rowNames(page)).toEqual(KPOP);
    await expect(page.locator('#sounds-tool')).toHaveAttribute('aria-label', 'Sounds: K-pop');
  });
}

// ---- How the kits sound ----

test.describe('how the kits sound', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('./');
  });

  test('every sound of every kit is heard, and none drowns out the rest', async ({ page }) => {
    const ids = await page.evaluate(async () => {
      const { KITS } = await import(new URL('js/sounds.js', location.href).href);
      return KITS.flatMap((kit) => kit.sounds.map((sound) => sound.id));
    });
    for (const id of ids) {
      const lufs = await lab(page, 'loudness', id, 0, 0.1);
      expect(lufs, id).toBeGreaterThan(-40);
      expect(lufs, id).toBeLessThan(-9);
    }
  });

  test('switching kits keeps a beat about as loud as it was', async ({ page }) => {
    const starters = await page.evaluate(async () => (await import(new URL('js/pattern.js', location.href).href)).STARTERS);
    const diffs = { rock: [], kpop: [] };
    for (const { rows, bpm } of starters) {
      const party = await lab(page, 'beatLoudness', 'party', rows, bpm);
      for (const kit of Object.keys(diffs)) diffs[kit].push((await lab(page, 'beatLoudness', kit, rows, bpm)) - party);
    }
    Object.entries(diffs).forEach(([kit, list]) => {
      const mean = list.reduce((sum, d) => sum + d, 0) / list.length;
      expect(Math.abs(mean), `${kit}: on average ${mean.toFixed(1)} dB from Party`).toBeLessThan(1.5);
      list.forEach((d, i) => expect(Math.abs(d), `${kit}, starter ${i}: ${d.toFixed(1)} dB`).toBeLessThan(2.5));
    });
  });

  test('the limiter keeps even every row at once, every step, at top speed from clipping', async ({ page }) => {
    const full = Array.from({ length: 8 }, () => 'x'.repeat(32));
    for (const kit of ['party', 'rock', 'kpop']) {
      const everything = await lab(page, 'peakOfBeat', kit, full, 180);
      expect(everything, kit).toBeLessThan(0.96);
      expect(everything, `${kit} still sounds`).toBeGreaterThan(0.3);
      for (const step of [0, 8, 16, 24]) expect(await lab(page, 'peakOfAll', kit, step), `${kit} at ${step}`).toBeLessThan(0.96);
    }
  });

  test('tuned sounds follow the chord loop, Em, C, G, D, in one key', async ({ page }) => {
    const expected = {
      guitar: [82.41, 65.41, 98.0, 73.42],
      riff: [164.81, 130.81, 196.0, 146.83],
      'rock-bass': [41.2, 65.41, 49.0, 36.71],
      808: [41.2, 65.41, 49.0, 36.71],
    };
    for (const [id, notes] of Object.entries(expected)) {
      for (const [i, hz] of notes.entries()) {
        const heard = await lab(page, 'pitchOf', id, i * 8);
        const cents = 1200 * Math.log2(heard / hz);
        expect(Math.abs(cents), `${id} at step ${i * 8}: ${heard.toFixed(1)} Hz, wanted ${hz}`).toBeLessThan(35);
      }
    }
  });
});
