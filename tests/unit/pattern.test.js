import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BAR, BPM_MAX, BPM_MIN, DEFAULT_SOUNDS, LIFT_MAX, MAX_STEPS, MAX_TRACKS, MIN_TRACKS, STARTERS, canDouble, clear, copyBeat,
  copyRow, createHistory, double, emptyBeat, isEmpty, isOn, isValidBeat, liftAt, longer, shorter, stepCount, surprise,
  toggle, trackCount, withBpm, withLift, withSound, withSounds,
} from '../../js/pattern.js';
import { kitById } from '../../js/sounds.js';

const ids = (id) => kitById(id).sounds.map((sound) => sound.id);

test('a beat starts with 8 rows of Party’s sounds and 16 steps, and may have up to 12 rows', () => {
  assert.equal(MIN_TRACKS, 8);
  assert.equal(MAX_TRACKS, 12);
  assert.equal(BAR, 16);
  assert.equal(trackCount(emptyBeat()), MIN_TRACKS);
  assert.deepEqual(emptyBeat().sounds, ids('party'));
  assert.deepEqual(DEFAULT_SOUNDS, ids('party'));
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
      const next = surprise(copyBeat(starter), () => r);
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

test('➖ shorter takes the last 16 steps away, never below 16', () => {
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

test('the sounds ride along: copy, clear, surprise, longer, shorter and ×2 keep them', () => {
  const beat = withSound(withSounds(toggle(emptyBeat(), 0, 0), ids('rock')), 2, 'bell');
  const sounds = [...ids('rock').slice(0, 2), 'bell', ...ids('rock').slice(3)];
  [copyBeat(beat), clear(beat), surprise(beat, () => 0), longer(beat), shorter(longer(beat)), double(longer(beat))]
    .forEach((next) => assert.deepEqual(next.sounds, sounds));
  assert.deepEqual(copyBeat({ bpm: 100, rows: emptyBeat().rows }).sounds, DEFAULT_SOUNDS, 'beats without sounds are Party');
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
  assert.equal(isValidBeat({ ...emptyBeat(), kit: 'kpop' }), true, 'old saves name a kit');
  [['rock'], 12, null, { toString: () => 'rock' }].forEach((kit) => assert.equal(isValidBeat({ ...emptyBeat(), kit }), false, String(kit)));
});

test('surprise can use a kit’s own starters', () => {
  const rock = [{ name: 'Rock 1', bpm: 120, rows: STARTERS[1].rows.map((r, i) => (i === 3 ? '................' : r)) }];
  const next = surprise(withSounds(emptyBeat(), ids('rock')), () => 0, rock);
  assert.deepEqual(next.rows, rock[0].rows);
  assert.equal(next.bpm, 120);
  assert.deepEqual(next.sounds, ids('rock'));
});

// ---- Mix and match (task 84) ----

test('withSound puts one sound on one row; withSounds puts a kit on every row, starting over past 8', () => {
  const beat = withSound(emptyBeat(), 7, 'riff');
  assert.deepEqual(beat.sounds, [...DEFAULT_SOUNDS.slice(0, 7), 'riff']);
  const twelve = { ...emptyBeat(), rows: [...emptyBeat().rows, ...emptyBeat().rows.slice(0, 4)], sounds: [...DEFAULT_SOUNDS, ...DEFAULT_SOUNDS.slice(0, 4)] };
  assert.deepEqual(withSounds(twelve, ids('kpop')).sounds, [...ids('kpop'), ...ids('kpop').slice(0, 4)]);
});

test('a saved beat may have 8 to 12 rows, each with a sound, but not wrong sounds', () => {
  const rows = (n) => Array.from({ length: n }, () => '.'.repeat(16));
  const beat = (n, extra = {}) => ({ bpm: 100, rows: rows(n), sounds: Array(n).fill('kick'), ...extra });
  [8, 9, 12].forEach((n) => assert.ok(isValidBeat(beat(n)), String(n)));
  [7, 13].forEach((n) => assert.equal(isValidBeat(beat(n)), false, String(n)));
  assert.ok(isValidBeat({ bpm: 100, rows: rows(8) }), 'no sounds: an old save');
  const bad = [Array(7).fill('kick'), 'kick', [...Array(7).fill('kick'), 'Kick!'], [...Array(7).fill('kick'), 7], [...Array(7).fill('kick'), 'x'.repeat(25)]];
  bad.forEach((sounds) => assert.equal(isValidBeat(beat(8, { sounds })), false, JSON.stringify(sounds)));
});

// ---- The key slider (task 84): pitch rides with the notes ----

test('withLift moves one note, whole steps from −4 to 4; liftAt reads it back', () => {
  const beat = withLift(toggle(emptyBeat(), 5, 3), 5, 3, 2);
  assert.equal(liftAt(beat, 5, 3), 2);
  assert.equal(liftAt(beat, 5, 4), 0);
  assert.equal(liftAt(withLift(beat, 5, 3, 9), 5, 3), LIFT_MAX);
  assert.equal(liftAt(withLift(beat, 5, 3, -9), 5, 3), -LIFT_MAX);
  assert.equal(liftAt(withLift(beat, 5, 3, 1.4), 5, 3), 1);
});

test('a note turned off forgets its lift, and a new note plays as written', () => {
  const lifted = withLift(toggle(emptyBeat(), 5, 3), 5, 3, 3);
  const off = toggle(lifted, 5, 3);
  assert.equal(liftAt(off, 5, 3), 0);
  assert.equal(liftAt(toggle(off, 5, 3), 5, 3), 0);
});

test('➕ ➖ ×2 and 📋 carry each note’s lift with it', () => {
  const beat = withLift(toggle(emptyBeat(), 5, 3), 5, 3, -2);
  assert.equal(liftAt(longer(beat), 5, 19), -2, '➕ copies the last 16');
  assert.equal(longer(beat).pitch[5].length, 32);
  assert.equal(shorter(longer(beat)).pitch[5].length, 16);
  assert.equal(liftAt(double(longer(beat)), 5, 19), -2, '×2 repeats the first half');
  const copied = copyRow(beat, 5, 6);
  assert.equal(liftAt(copied, 6, 3), -2);
  assert.notEqual(copied.pitch[6], copied.pitch[5], 'a copy, not the same list');
  assert.equal(liftAt(clear(beat), 5, 3), 0);
});

test('a saved pitch must match its rows and stay from −4 to 4', () => {
  const beat = emptyBeat();
  assert.ok(isValidBeat(beat));
  const bad = [[], beat.pitch.slice(1), beat.pitch.map((lane) => lane.slice(1)), beat.pitch.map((lane) => lane.map(() => 5)),
    beat.pitch.map((lane) => lane.map(() => 0.5)), beat.pitch.map((lane) => lane.map(() => '1')), 'up'];
  bad.forEach((pitch) => assert.equal(isValidBeat({ ...beat, pitch }), false, JSON.stringify(pitch).slice(0, 40)));
  assert.deepEqual(copyBeat({ bpm: 100, rows: beat.rows }).pitch, beat.pitch, 'no pitch: every note as written');
});

test('🎲 on a beat with more than 8 rows leaves the extra rows empty', () => {
  const nine = { ...emptyBeat(), rows: [...emptyBeat().rows, 'x'.repeat(16)], sounds: [...DEFAULT_SOUNDS, 'riff'], pitch: [...emptyBeat().pitch, Array(16).fill(1)] };
  const next = surprise(nine, () => 0);
  assert.equal(trackCount(next), 9);
  assert.equal(next.rows[8], '.'.repeat(16));
  assert.ok(isValidBeat(next));
});
