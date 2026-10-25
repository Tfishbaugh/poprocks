// The how-to tour: it runs on first open only, Skip, Escape and Back end it, ❓ replays it,
// a missing control's step is skipped, 🎥 only moves on, the Watch tip shows once, and the
// card never covers the control it points at.

import { test, expect } from '@playwright/test';
import { TOURS, TOUR_KEY } from '../../js/tour.js';
import { cameraCalls, openCamera, record, watchCamera } from './helpers.js';

test.use({ storageState: { cookies: [], origins: [] } });

const tour = (page) => page.locator('.tour');
const stepName = (page) => tour(page).getAttribute('data-step');

async function start(page) {
  await page.goto('./');
  await page.click('#start-btn');
  await expect(page.locator('#beats')).toBeVisible();
}

// Taps Next until the tour ends, and returns the steps it showed.
async function walk(page) {
  const names = [];
  while (await tour(page).isVisible()) {
    names.push(await stepName(page));
    await page.click('.tour-next');
  }
  return names;
}

async function skipTour(page) {
  await page.click('.tour-skip');
  await expect(tour(page)).toBeHidden();
}

// Stand-ins for controls other parts of the app add, when they aren't here yet:
// the Sounds button after the beat numbers, and 🪄 Effects between Again and Save.
function addStandIns() {
  const button = (id, text) => Object.assign(document.createElement('button'), { id, textContent: text, className: 'btn' });
  if (!document.getElementById('sounds')) document.getElementById('slots').after(button('sounds', '🎉'));
  if (document.getElementById('watch-fx')) return;
  const fx = button('watch-fx', '🪄');
  fx.dataset.tour = 'effects';
  document.getElementById('watch-save').before(fx);
}

// The lit control and the card, measured in the page.
function boxes(page) {
  return page.evaluate((tours) => {
    const name = document.querySelector('.tour').dataset.step;
    const { find } = Object.values(tours).flat().find((step) => step.name === name);
    const shown = [...document.querySelectorAll(find)].find((node) => node.getClientRects().length);
    const target = shown ?? document.getElementById('more'); // folded under More on a phone on its side
    const rect = (node) => node.getBoundingClientRect().toJSON();
    const scroll = document.documentElement.scrollWidth > innerWidth;
    return { name, scroll, target: rect(target), card: rect(document.querySelector('.tour-card')), next: rect(document.querySelector('.tour-next')) };
  }, TOURS);
}

const overlap = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

async function expectCardClear(page, view) {
  const { name, scroll, target, card, next } = await boxes(page);
  expect(overlap(card, target), `${name}: the card covers its control`).toBe(false);
  expect(card.left >= 0 && card.top >= 0 && card.right <= view.width && card.bottom <= view.height, `${name}: card on screen`).toBe(true);
  expect(next.height, `${name}: Next is 64 px tall`).toBeGreaterThanOrEqual(64);
  expect(scroll, `${name}: sideways scroll`).toBe(false);
  return name;
}

test('the tour runs on first open, one control at a time, and never again', async ({ page }) => {
  await start(page);
  await expect(tour(page)).toBeVisible();
  await expect(page.locator('.tour-next')).toBeFocused();
  await expect(page.locator('.tour-text')).toHaveText('Tap squares to make a beat');
  expect(await walk(page)).toEqual(['pads', 'play', 'video', 'slots', 'sounds', 'names', 'hold', 'stretch', 'longer']);
  await expect(page.locator('#play')).toBeFocused();
  await expect(page.locator('#play')).toContainText('Play');
  expect(await page.evaluate((key) => localStorage.getItem(key), TOUR_KEY)).toBe('["beats","mix","holds"]');

  await page.reload();
  await page.click('#start-btn');
  await expect(page.locator('#beats')).toBeVisible();
  await expect(tour(page)).toBeHidden();
});

test('the last step says Got it! and has no Skip', async ({ page }) => {
  await start(page);
  for (let i = 0; i < 8; i += 1) await page.click('.tour-next');
  await expect(page.locator('.tour-next')).toHaveText('Got it!');
  await expect(page.locator('.tour-skip')).toBeHidden();
  await expect(page.locator('.tour-dots .tour-dot')).toHaveCount(9);
});

const ENDINGS = {
  Skip: (page) => page.click('.tour-skip'),
  Escape: (page) => page.keyboard.press('Escape'),
  Back: (page) => page.goBack(),
};

for (const [way, end] of Object.entries(ENDINGS)) {
  test(`${way} ends the tour, stays on Beats and leaves no history behind`, async ({ page }) => {
    await start(page);
    await page.click('.tour-next');
    await end(page);
    await expect(tour(page)).toBeHidden();
    await expect(page.locator('#beats')).toBeVisible();
    await expect.poll(() => page.evaluate(() => history.state)).toBeNull();
    await page.reload();
    await page.click('#start-btn');
    await expect(tour(page)).toBeHidden();
  });
}

test('keys meant for the beat wait while the tour is open', async ({ page }) => {
  await start(page);
  await page.evaluate(() => document.activeElement.blur());
  await page.keyboard.press(' ');
  await expect(page.locator('#play')).toContainText('Play');
  await expect(tour(page)).toBeVisible();
  for (const focused of ['.tour-skip', '.tour-next', '.tour-skip']) {
    await page.keyboard.press('Tab');
    await expect(page.locator(focused)).toBeFocused();
  }
});

test('❓ Help replays the tour from the start, on a laptop and from More on a phone', async ({ page }) => {
  await start(page);
  await skipTour(page);
  await page.click('#help');
  await expect(tour(page)).toBeVisible();
  expect(await stepName(page)).toBe('pads');
  await skipTour(page);

  await page.setViewportSize({ width: 360, height: 640 });
  await page.click('#more');
  await page.click('#help');
  await expect(tour(page)).toBeVisible();
  await expect(page.locator('#more')).toHaveAttribute('aria-expanded', 'false');
  expect(await walk(page)).toEqual(['pads', 'play', 'video', 'slots', 'sounds', 'names', 'hold', 'stretch', 'longer']);
});

test('a control that is there gets its step; a missing, hidden or vanished one is skipped', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./');
  await page.evaluate(addStandIns);
  await page.click('#start-btn');
  expect(await walk(page)).toEqual(['pads', 'play', 'video', 'slots', 'sounds', 'names', 'hold', 'stretch', 'longer']);

  await page.evaluate(() => { document.getElementById('sounds').hidden = true; });
  await page.click('#help');
  await page.click('.tour-next');
  expect(await stepName(page)).toBe('play');
  await page.evaluate(() => { document.getElementById('make-video').hidden = true; });
  await page.click('.tour-next');
  expect(await stepName(page)).toBe('slots');
  await page.click('.tour-next');
  expect(await stepName(page), 'the hidden Sounds button is skipped').toBe('names');
  await page.click('.tour-next');
  await page.click('.tour-next');
  await page.click('.tour-next');
  expect(await stepName(page)).toBe('longer');
  await page.click('.tour-next');
  await expect(tour(page)).toBeHidden();
  expect(errors).toEqual([]);
});

test('🎥 in the tour only moves on: tapping it never opens the camera', async ({ page }) => {
  await page.addInitScript(watchCamera);
  await start(page);
  await page.click('.tour-next');
  await page.click('.tour-next');
  expect(await stepName(page)).toBe('video');
  await page.click('.tour-spot');
  expect(await stepName(page)).toBe('slots');
  await expect(page.locator('#record')).toBeHidden();
  expect(await cameraCalls(page)).toBe(0);
});

test('the first Watch says Save it to keep it, once; Back and Escape close it and stay on Watch', async ({ page }) => {
  await start(page);
  await skipTour(page);
  await openCamera(page);
  await record(page, 1);
  await expect(tour(page)).toBeVisible();
  expect(await stepName(page), 'the real 🪄 Effects comes first (task 80 effects)').toBe('effects');
  await page.click('.tour-next');
  expect(await stepName(page)).toBe('save');
  await expect(page.locator('.tour-text')).toHaveText('Save it to keep it!');
  await page.goBack();
  await expect(tour(page)).toBeHidden();
  await expect(page.locator('#watch')).toBeVisible();

  await page.click('#watch-again');
  await expect(page.locator('#rec-btn')).toBeEnabled();
  await record(page, 1);
  await expect(page.locator('#watch-save')).toBeFocused();
  await expect(tour(page)).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(page.locator('#beats')).toBeVisible();
});

test('the Watch tip shows 🪄 Effects first when it is there; Got it stays on Watch', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(addStandIns);
  await page.click('#start-btn');
  await skipTour(page);
  await openCamera(page);
  await record(page, 1);
  await page.keyboard.press('Escape');
  await expect(tour(page)).toBeHidden();
  await expect(page.locator('#watch')).toBeVisible();

  await page.evaluate((key) => localStorage.setItem(key, '["beats"]'), TOUR_KEY);
  await page.reload();
  await page.evaluate(addStandIns);
  await page.click('#start-btn');
  await openCamera(page);
  await record(page, 1);
  expect(await walk(page)).toEqual(['effects', 'save']);
  await expect(page.locator('#watch')).toBeVisible();
  await expect.poll(() => page.evaluate(() => history.state)).toEqual({ poprocks: 'watch' });
  await page.goBack();
  await expect(page.locator('#beats')).toBeVisible();
});

const SIZES = [
  { name: 'phone', width: 360, height: 640 },
  { name: 'phone on its side', width: 852, height: 393 },
  { name: 'tablet', width: 1024, height: 768 },
];

for (const view of SIZES) {
  test(`${view.name} ${view.width}×${view.height}: no card covers its control`, async ({ page }) => {
    await page.setViewportSize(view);
    await page.goto('./');
    await page.evaluate(addStandIns);
    await page.click('#start-btn');
    const seen = [];
    while (await tour(page).isVisible()) {
      seen.push(await expectCardClear(page, view));
      await page.click('.tour-next');
    }
    // On a phone on its side, Sounds and ➕ wait under More, and their steps point at More.
    expect(seen).toEqual(expect.arrayContaining(['pads', 'play', 'video', 'slots', 'sounds', 'names', 'hold', 'stretch', 'longer']));

    await openCamera(page);
    await record(page, 1);
    while (await tour(page).isVisible()) {
      seen.push(await expectCardClear(page, view));
      await page.click('.tour-next');
    }
    expect(seen).toEqual(expect.arrayContaining(['effects', 'save']));
  });
}

test('on a phone on its side, Sounds and ➕ point at More, where they are folded', async ({ page }) => {
  await page.setViewportSize({ width: 852, height: 393 });
  await start(page);
  for (let i = 0; i < 4; i += 1) await page.click('.tour-next');
  expect(await stepName(page)).toBe('sounds');
  await expect(page.locator('.tour-text')).toHaveText('Pick new sounds: tap More');
  const more = await page.locator('#more').boundingBox();
  const ringsMore = async () => {
    const spot = await page.locator('.tour-spot').boundingBox();
    return spot.x <= more.x && spot.x + spot.width >= more.x + more.width;
  };
  await expect.poll(ringsMore, { message: 'the lit ring sits around More' }).toBe(true);
  for (let i = 0; i < 4; i += 1) await page.click('.tour-next');
  expect(await stepName(page)).toBe('longer');
  await expect(page.locator('.tour-text')).toHaveText('Make it longer: tap More');
});

// Task 84: kids who already did the tour see only its 3 new steps, once.
// Held notes: a device that saw PR 2's new steps (Travis's included) still gets the stretch card, once.
test('after PR 2’s tour, only the stretch card shows, once, even on an empty beat', async ({ page }) => {
  await page.addInitScript((key) => {
    if (sessionStorage.getItem('again')) return;
    localStorage.setItem(key, '["beats","mix","watch"]');
    localStorage.setItem('poprocks.v2', '{"slot":1,"slots":[]}'); // beat 2: empty
  }, TOUR_KEY);
  await start(page);
  await expect(page.locator('.pad.on')).toHaveCount(0);
  await expect(page.locator('.tour-text')).toHaveText('Hold a note, slide it longer');
  expect(await walk(page)).toEqual(['stretch']);
  await page.evaluate(() => sessionStorage.setItem('again', '1'));
  await page.reload();
  await page.click('#start-btn');
  await expect(page.locator('#beats')).toBeVisible();
  await expect(tour(page)).toBeHidden();
});

test('after the old tour, only the new steps show, once: tap a name, hold a note, slide it', async ({ page }) => {
  await page.addInitScript((key) => { if (!sessionStorage.getItem('again')) localStorage.setItem(key, '["beats","watch"]'); }, TOUR_KEY);
  await start(page);
  await expect(page.locator('.tour-text')).toHaveText('Tap a name to change sounds');
  expect(await walk(page)).toEqual(['names', 'hold', 'stretch']);
  await page.evaluate(() => sessionStorage.setItem('again', '1'));
  await page.reload();
  await page.click('#start-btn');
  await expect(page.locator('#beats')).toBeVisible();
  await expect(tour(page)).toBeHidden();
});
