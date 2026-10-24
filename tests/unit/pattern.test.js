import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BPM_MAX, BPM_MIN, STARTERS, STEPS, TRACKS, clear, createHistory, emptyBeat, isEmpty, isOn, isValidBeat,
  surprise, toggle, withBpm,
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
