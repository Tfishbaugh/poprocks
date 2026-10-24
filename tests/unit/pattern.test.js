import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BPM_MAX, BPM_MIN, DEFAULT_KIT, MAX_STEPS, STARTERS, STEPS, TRACKS, canDouble, clear, copyBeat, copyRow, createHistory,
  double, emptyBeat, isEmpty, isOn, isValidBeat, longer, shorter, stepCount, surprise, toggle, withBpm, withKit,
} from '../../js/pattern.js';
import { SOUNDS } from '../../js/sounds.js';

test('there are 8 sounds and 16 steps', () => {
  assert.equal(TRACKS, 8);
  assert.equal(STEPS, 16);
  assert.equal(SOUNDS.length, TRACKS);
});

test('toggle turns a pad on and off without touching the others', () => {
  const start = emptyBeat();
  const on = toggle(start, 2, 5);
  assert.equal(isOn(on, 2, 5), true);
  assert.equal(on.rows.join('').split('x').length - 1, 1);
  assert.equal(isOn(toggle(on, 2, 5), 2, 5), false);
  assert.equal(isEmpty(start), true, 'the original beat is unchanged');
});

test('clear empties the beat and keeps the tempo; undo brings it back', () => {
  const history = createHistory();
  const beat = withBpm(toggle(emptyBeat(), 0, 0), 140);
  history.push(beat);
  const cleared = clear(beat);
  assert.equal(isEmpty(cleared), true);
  assert.equal(cleared.bpm, 140);
  assert.deepEqual(history.undo(cleared), beat);
  assert.equal(history.canUndo, false);
});

test('undo walks back step by step and stops at the start', () => {
  const history = createHistory();
  let beat = emptyBeat();
  const seen = [beat];
  for (let step = 0; step < 4; step += 1) {
    history.push(beat);
    beat = toggle(beat, 0, step);
    seen.push(beat);
  }
  for (let i = seen.length - 2; i >= 0; i -= 1) {
    beat = history.undo(beat);
    assert.deepEqual(beat, seen[i]);
  }
  assert.deepEqual(history.undo(beat), beat, 'nothing left to undo');
});

test('undo history is capped', () => {
  const history = createHistory(3);
  [1, 2, 3, 4, 5].forEach((n) => history.push(withBpm(emptyBeat(), 60 + n * 10)));
  assert.equal(history.undo(null).bpm, 110);
  assert.equal(history.undo(null).bpm, 100);
  assert.equal(history.undo(null).bpm, 90);
  assert.equal(history.canUndo, false);
});

test('tempo stays between 60 and 180', () => {
  assert.equal(withBpm(emptyBeat(), 500).bpm, BPM_MAX);
  assert.equal(withBpm(emptyBeat(), 10).bpm, BPM_MIN);
  assert.equal(withBpm(emptyBeat(), 125.4).bpm, 125);
});

test('every starter beat is valid, has a kick, and has a name', () => {
  assert.ok(STARTERS.length >= 5);
  STARTERS.forEach((starter) => {
    assert.ok(isValidBeat(starter), starter.name);
    assert.ok(starter.rows[0].includes('x'), `${starter.name} has a kick`);
    assert.ok(starter.name.length > 0);
  });
  assert.equal(new Set(STARTERS.map((s) => s.rows.join())).size, STARTERS.length, 'no duplicates');
});

test('surprise gives a starter that differs from the beat on screen', () => {
  STARTERS.forEach((starter, i) => {
    [0, 0.5, 0.999].forEach((r) => {
      const next = surprise(starter, () => r);
      assert.ok(isValidBeat(next));
      assert.notDeepEqual(next.rows, starter.rows, `starter ${i}, random ${r}`);
    });
  });
});

test('surprise returns a copy, so editing it never changes the starters', () => {
  const next = surprise(emptyBeat(), () => 0);
  next.rows[0] = '................';
  assert.ok(STARTERS[0].rows[0].includes('x'));
});

test('isValidBeat rejects bad shapes', () => {
  const good = emptyBeat();
  assert.equal(isValidBeat(good), true);
  const bad = [
    null, 'beat', 42, {}, { bpm: 100 }, { rows: good.rows },
    { bpm: 'fast', rows: good.rows }, { bpm: 100, rows: good.rows.slice(1) },
    { bpm: 100, rows: [...good.rows.slice(1), 'x'] }, { bpm: 100, rows: [...good.rows.slice(1), 'xxxxxxxxxxxxxxx?'] },
    { bpm: 100, rows: [...good.rows.slice(1), 7] }, { bpm: 999, rows: good.rows }, { bpm: NaN, rows: good.rows },
  ];
  bad.forEach((value) => assert.equal(isValidBeat(value), false, JSON.stringify(value)));
});

// ---- Longer beats and copy (task 80) ----

const row = (beat, track) => beat.rows[track];

test('➕ longer adds 16 steps, a copy of the last 16, up to 64', () => {
  let beat = toggle(toggle(emptyBeat(), 0, 0), 1, 15);
  beat = longer(beat);
  assert.equal(stepCount(beat), 32);
  assert.equal(row(beat, 0), 'x...............x...............');
  assert.equal(row(beat, 1), '...............x...............x');
  beat = longer(longer(beat));
  assert.equal(stepCount(beat), MAX_STEPS);
  assert.equal(longer(beat), beat, 'no longer than 64');
  assert.ok(isValidBeat(beat));
});

test('✂️ shorter takes the last 16 steps away, never below 16', () => {
  const long = longer(toggle(emptyBeat(), 2, 3));
  const beat = shorter(toggle(long, 2, 20));
  assert.equal(stepCount(beat), 16);
  assert.equal(row(beat, 2), '...x............');
  assert.equal(shorter(beat), beat);
});

test('×2 double repeats the first half as the second half, at any length', () => {
  const beat = toggle(toggle(emptyBeat(), 0, 1), 0, 12);
  assert.equal(row(double(beat), 0), '.x.......x......');
  const long = toggle(longer(emptyBeat()), 3, 5);
  assert.equal(row(double(long), 3), '.....x..........'.repeat(2));
  assert.equal(canDouble(emptyBeat()), false);
  assert.equal(canDouble(toggle(emptyBeat(), 0, 12)), false, 'only the second half has notes');
  assert.equal(canDouble(beat), true);
});

test('copying a sound puts its row onto another sound and leaves the rest', () => {
  const beat = toggle(toggle(emptyBeat(), 0, 0), 0, 8);
  const copied = copyRow(toggle(beat, 3, 3), 0, 3);
  assert.equal(row(copied, 3), row(beat, 0));
  assert.equal(row(copied, 0), row(beat, 0));
  assert.ok(isEmpty({ rows: copied.rows.filter((_, t) => t !== 0 && t !== 3) }));
});

test('the kit rides along: copy, clear, surprise, longer and withKit keep it', () => {
  const beat = withKit(toggle(emptyBeat(), 0, 0), 'rock');
  assert.equal(copyBeat(beat).kit, 'rock');
  assert.equal(clear(beat).kit, 'rock');
  assert.equal(surprise(beat, () => 0).kit, 'rock');
  assert.equal(longer(beat).kit, 'rock');
  assert.equal(emptyBeat().kit, DEFAULT_KIT);
  assert.equal(copyBeat({ bpm: 100, rows: emptyBeat().rows }).kit, DEFAULT_KIT, 'old beats are party');
});

test('clear and surprise keep a long beat long', () => {
  const long = longer(longer(toggle(emptyBeat(), 0, 0)));
  assert.equal(stepCount(clear(long)), 48);
  const fresh = surprise(long, () => 0.5);
  assert.equal(stepCount(fresh), 48);
  assert.ok(isValidBeat(fresh));
  assert.equal(row(fresh, 0).slice(0, 16), row(fresh, 0).slice(16, 32), 'the starter repeats');
});

test('beats of 16, 32, 48 and 64 steps are valid; other lengths and mixed rows are not', () => {
  [16, 32, 48, 64].forEach((steps) => assert.ok(isValidBeat(emptyBeat(100, steps)), String(steps)));
  [0, 8, 20, 80, 128].forEach((steps) => assert.equal(isValidBeat(emptyBeat(100, steps)), false, String(steps)));
  const mixed = emptyBeat(100, 32);
  mixed.rows[5] = '.'.repeat(16);
  assert.equal(isValidBeat(mixed), false);
  assert.equal(isValidBeat({ ...emptyBeat(), kit: 'Rock Kit!' }), false);
  assert.equal(isValidBeat({ ...emptyBeat(), kit: 'kpop' }), true);
});

test('surprise can use a kit’s own starters', () => {
  const rock = [{ name: 'Rock 1', bpm: 120, rows: STARTERS[1].rows.map((r, i) => (i === 3 ? '................' : r)) }];
  const next = surprise(withKit(emptyBeat(), 'rock'), () => 0, rock);
  assert.deepEqual(next.rows, rock[0].rows);
  assert.equal(next.bpm, 120);
  assert.equal(next.kit, 'rock');
});
