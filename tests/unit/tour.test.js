import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOURS, TOUR_KEY, placeCard, readSeen } from '../../js/tour.js';

const box = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height });
const CARD = { width: 328, height: 230 };

function overlaps(a, at, card) {
  return a.left < at.left + card.width && at.left < a.right && a.top < at.top + card.height && at.top < a.bottom;
}

function inside(at, card, view) {
  return at.left >= 0 && at.top >= 0 && at.left + card.width <= view.width && at.top + card.height <= view.height;
}

test('the card goes below a control near the top', () => {
  const view = { width: 360, height: 640 };
  const slots = box(140, 4, 210, 60);
  const at = placeCard(slots, CARD, view);
  assert.ok(at.top >= slots.bottom + 16, `top ${at.top}`);
  assert.ok(inside(at, CARD, view));
});

test('the card goes above a control near the bottom', () => {
  const view = { width: 360, height: 640 };
  const play = box(110, 560, 140, 80);
  const at = placeCard(play, CARD, view);
  assert.ok(at.top + CARD.height <= play.top - 16, `bottom ${at.top + CARD.height}`);
  assert.ok(inside(at, CARD, view));
});

test('on a short screen the card goes beside a control in the rail', () => {
  const view = { width: 852, height: 393 };
  const play = box(744, 230, 108, 92);
  const at = placeCard(play, CARD, view);
  assert.ok(at.left + CARD.width <= play.left - 16, `right edge ${at.left + CARD.width}`);
  assert.ok(!overlaps(play, at, CARD));
  assert.ok(inside(at, CARD, view));
});

test('the card never covers a control along any edge of the three screens', () => {
  const views = [{ width: 360, height: 640 }, { width: 852, height: 393 }, { width: 1024, height: 768 }];
  views.forEach((view) => {
    const card = { width: Math.min(340, view.width - 32), height: 230 };
    const spots = [[0, 0], [0.5, 0], [1, 0], [0, 0.5], [1, 0.5], [0, 1], [0.5, 1], [1, 1]];
    spots.forEach(([x, y]) => {
      const control = box(x * (view.width - 92), y * (view.height - 92), 92, 92);
      const at = placeCard(control, card, view);
      assert.ok(!overlaps(control, at, card), `${view.width}×${view.height} at ${x},${y}`);
      assert.ok(inside(at, card, view), `${view.width}×${view.height} at ${x},${y} stays on screen`);
    });
  });
});

test('with no room anywhere, the card still stays on screen', () => {
  const view = { width: 400, height: 260 };
  const at = placeCard(box(100, 60, 200, 140), CARD, view);
  assert.ok(at.left >= 0 && at.top >= 0);
});

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return { getItem: (key) => (data.has(key) ? data.get(key) : null), setItem: (key, value) => data.set(key, value) };
}

test('what was seen reads back, and bad or missing data means nothing was seen', () => {
  assert.deepEqual([...readSeen(memoryStorage({ [TOUR_KEY]: '["beats"]' }))], ['beats']);
  assert.equal(readSeen(memoryStorage()).size, 0);
  assert.equal(readSeen(memoryStorage({ [TOUR_KEY]: 'not json' })).size, 0);
  assert.equal(readSeen(memoryStorage({ [TOUR_KEY]: '{"beats":true}' })).size, 0);
  assert.equal(readSeen({ getItem: () => { throw new Error('blocked'); } }).size, 0);
  assert.equal(readSeen(null).size, 0);
});

test('the tour goes pads, Play, video, beat numbers, sounds, names, holding, then length, in few words', () => {
  assert.deepEqual(TOURS.beats.map((step) => step.name), ['pads', 'play', 'video', 'slots', 'sounds', 'names', 'hold', 'longer']);
  assert.deepEqual(TOURS.mix.map((step) => step.name), ['names', 'hold'], 'kids who did the tour see just the new steps');
  assert.deepEqual(TOURS.watch.map((step) => step.name), ['effects', 'save']);
  Object.values(TOURS).flat().forEach((step) => {
    assert.ok(step.find && step.pic, step.name);
    assert.ok(step.text.split(' ').length <= 6, `${step.name}: "${step.text}" is short`);
  });
});
