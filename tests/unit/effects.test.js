// The math and data behind effects: sticker placing and moving, fitting the picture,
// the names kids see, and when the 🪄 button may show.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FILTERS, MAX_STICKERS, STICKERS, STICKER_SIZE, addSticker, clamp01, clock, effectLabel, effectsSupported,
  fitRect, isPlain, moveSticker, plain, sameSettings, stickerBox,
} from '../../js/effects.js';

test('the six colors, in the order Travis picked', () => {
  assert.deepEqual(FILTERS.map(({ label }) => label), ['None', 'Gray', 'Rainbow', 'Neon', 'Mirror', 'Comic']);
});

test('six stickers drawn for the app: short names, a color and a closed path for every part', () => {
  assert.equal(STICKERS.length, 6);
  assert.equal(new Set(STICKERS.map(({ id }) => id)).size, 6);
  STICKERS.forEach(({ label, parts }) => {
    assert.ok(label.length <= 6, label);
    parts.forEach(([fill, d]) => {
      assert.match(fill, /^#[0-9A-F]{6}$/, `${label} fill`);
      assert.match(d, /^M[\d .A-Z-]+Z$/, `${label} path`);
    });
  });
});

test('a new sticker lands in the middle, the next ones a little lower-right', () => {
  const one = addSticker([], 'star');
  assert.deepEqual(one, [{ id: 'star', x: 0.5, y: 0.5 }]);
  const two = addSticker(one, 'heart');
  assert.ok(two[1].x > 0.5 && two[1].y > 0.5);
  assert.equal(one.length, 1, 'the old list is left alone');
});

test(`at most ${MAX_STICKERS} stickers`, () => {
  const full = Array.from({ length: MAX_STICKERS }).reduce((list) => addSticker(list, 'zap'), []);
  assert.equal(full.length, MAX_STICKERS);
  assert.equal(addSticker(full, 'zap'), full);
  full.forEach(({ x, y }) => assert.ok(x <= 1 && y <= 1));
});

test('moving a sticker keeps its middle on the picture and leaves the others', () => {
  const list = [{ id: 'star', x: 0.5, y: 0.5 }, { id: 'note', x: 0.2, y: 0.2 }];
  assert.deepEqual(moveSticker(list, 0, 1.4, -0.3), [{ id: 'star', x: 1, y: 0 }, list[1]]);
  assert.deepEqual(moveSticker(list, 1, 0.3, 0.6)[1], { id: 'note', x: 0.3, y: 0.6 });
  assert.equal(list[0].x, 0.5);
  assert.equal(clamp01(-2), 0);
  assert.equal(clamp01(0.25), 0.25);
});

test('a sticker is square on a wide picture, sized from its shorter side', () => {
  const box = stickerBox({ x: 0.5, y: 0.5 }, 1280, 720);
  const size = STICKER_SIZE * 720;
  assert.ok(Math.abs((box.width / 100) * 1280 - size) < 1e-9);
  assert.ok(Math.abs((box.height / 100) * 720 - size) < 1e-9);
  assert.ok(Math.abs(box.left + box.width / 2 - 50) < 1e-9);
  assert.ok(Math.abs(box.top + box.height / 2 - 50) < 1e-9);
});

test('the picture fits inside its box like object-fit: contain', () => {
  assert.deepEqual(fitRect(1280, 720, 640, 640), { left: 0, top: 140, width: 640, height: 360 });
  assert.deepEqual(fitRect(720, 1280, 800, 640), { left: 220, top: 0, width: 360, height: 640 });
  assert.deepEqual(fitRect(400, 300, 400, 300), { left: 0, top: 0, width: 400, height: 300 });
});

test('the name in "Adding …" and "… added ✓"', () => {
  assert.equal(effectLabel({ filter: 'rainbow', stickers: [] }), 'Rainbow');
  assert.equal(effectLabel({ filter: 'none', stickers: [{ id: 'star' }] }), 'Stickers');
  assert.equal(effectLabel({ filter: 'comic', stickers: [{ id: 'star' }] }), 'Comic + stickers');
});

test('plain means no color and no stickers', () => {
  assert.ok(isPlain(plain()));
  assert.ok(!isPlain({ filter: 'gray', stickers: [] }));
  assert.ok(!isPlain({ filter: 'none', stickers: [{ id: 'star', x: 0.5, y: 0.5 }] }));
  assert.ok(sameSettings({ filter: 'neon', stickers: [] }, { filter: 'neon', stickers: [] }));
  assert.ok(!sameSettings({ filter: 'neon', stickers: [] }, plain()));
});

test('time left reads like the record screen', () => {
  assert.equal(clock(12.2), '0:13 left');
  assert.equal(clock(65), '1:05 left');
  assert.equal(clock(-1), '0:00 left');
});

test('🪄 shows only where a canvas can be filmed and the sound mixed', () => {
  const format = { mimeType: 'video/mp4', ext: 'mp4' };
  const full = { HTMLCanvasElement: { prototype: { captureStream() {} } }, AudioContext: { prototype: { createMediaStreamDestination() {} } } };
  assert.equal(effectsSupported(format, full), true);
  assert.equal(effectsSupported(null, full), false, 'no video format');
  assert.equal(effectsSupported(format, { ...full, HTMLCanvasElement: { prototype: {} } }), false, 'no captureStream');
  assert.equal(effectsSupported(format, { HTMLCanvasElement: full.HTMLCanvasElement }), false, 'no Web Audio');
});
