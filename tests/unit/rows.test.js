// More rows (task 84): a new row's sound, ➕ Row and 🗑 Remove row in pattern.js, and saves of 8 to 12 rows.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KITS, kitById } from '../../js/sounds.js';
import { newRowSound } from '../../js/rows.js';
import {
  MAX_TRACKS, STARTERS, addRow, clear, copyBeat, copyRow, double, isValidBeat, liftAt, longer, removeRow, shorter,
  stepCount, surprise, toggle, trackCount, withLift, withSounds,
} from '../../js/pattern.js';
import { OLD_KEY, STORAGE_KEY, defaultState, loadState, saveState } from '../../js/slots.js';

const ids = (kit) => kitById(kit).sounds.map((sound) => sound.id);

// ---- A new row's sound ----

test('a new row on a whole kit gets the next kit\'s notes, one by one', () => {
  const sounds = ids('party');
  const added = [];
  for (let i = 0; i < 4; i += 1) added.push(newRowSound([...sounds, ...added]));
  assert.deepEqual(added, ['guitar', 'chug', 'rock-bass', 'riff']);
});

test('K-pop wraps round to Party', () => {
  assert.equal(newRowSound(ids('kpop')), 'cowbell');
});

test('a mix first gets an unused note from its last row\'s kit', () => {
  assert.equal(newRowSound(['kick', 'snare', 'clap', 'hat', 'cowbell', 'bass', 'laser', 'riff']), 'guitar');
  assert.equal(newRowSound(['kick', 'snare', 'clap', 'hat', 'cowbell', 'bass', 'riff', 'laser']), 'boing');
});

test('every note comes before any drum', () => {
  assert.equal(newRowSound([...ids('rock').slice(0, 4), 'bass', 'laser', 'boing', 'cowbell']), 'guitar');
  assert.equal(newRowSound([...ids('rock').slice(4), 'kick', 'snare', 'clap', 'rock-kick']), '808');
  const notes = KITS.flatMap((kit) => kit.sounds.slice(4).map((sound) => sound.id));
  assert.equal(newRowSound(notes.slice(0, 11)), notes[11]);
});

test('a new row never repeats a sound already on a row', () => {
  const sounds = ids('rock');
  for (let i = 0; i < 4; i += 1) sounds.push(newRowSound(sounds));
  assert.equal(new Set(sounds).size, 12);
});

test('an unknown sound counts as Party', () => {
  assert.equal(newRowSound(['nope']), 'cowbell');
});

// ---- addRow and removeRow (pattern.js) ----

function inStep(beat) {
  const steps = stepCount(beat);
  assert.equal(beat.sounds.length, beat.rows.length, 'a sound per row');
  assert.equal(beat.pitch.length, beat.rows.length, 'a pitch lane per row');
  beat.pitch.forEach((lane, i) => assert.equal(lane.length, steps, `row ${i + 1}'s pitch`));
  assert.ok(isValidBeat(beat));
}

const twelve = () => [1, 2, 3, 4].reduce((beat) => addRow(beat, newRowSound(beat.sounds)), copyBeat(STARTERS[0]));

test('addRow adds an empty row at the bottom with its sound, up to 12', () => {
  const beat = withLift(toggle(copyBeat(STARTERS[0]), 5, 1), 5, 1, 2);
  const nine = addRow(beat, 'riff');
  inStep(nine);
  assert.equal(trackCount(nine), 9);
  assert.deepEqual(nine.rows.slice(0, 8), beat.rows);
  assert.deepEqual(nine.pitch.slice(0, 8), beat.pitch);
  assert.equal(nine.rows[8], '.'.repeat(16));
  assert.deepEqual(nine.pitch[8], Array(16).fill(0));
  assert.equal(nine.sounds[8], 'riff');
  const full = twelve();
  inStep(full);
  assert.equal(trackCount(full), MAX_TRACKS);
  assert.equal(addRow(full, 'hey'), full, 'no 13th row');
});

test('a new row on a long beat is as long as the others', () => {
  const beat = addRow(longer(longer(copyBeat(STARTERS[1]))), 'bell');
  inStep(beat);
  assert.equal(beat.rows[8], '.'.repeat(48));
});

test('removeRow takes one row away with its sound and pitch; the rows below move up', () => {
  const beat = withLift(toggle(twelve(), 10, 3), 10, 3, -2);
  const less = removeRow(beat, 9);
  inStep(less);
  assert.equal(trackCount(less), 11);
  assert.deepEqual(less.rows, beat.rows.filter((_, i) => i !== 9));
  assert.deepEqual(less.sounds, beat.sounds.filter((_, i) => i !== 9));
  assert.equal(liftAt(less, 9, 3), -2, 'row 11 is now row 10, lift and all');
  assert.deepEqual(removeRow(less, 0).sounds, beat.sounds.filter((_, i) => i !== 9 && i !== 0), 'any row can go');
});

test('removeRow never goes below 8 rows, and ignores a row that isn\'t there', () => {
  const eight = copyBeat(STARTERS[0]);
  assert.equal(removeRow(eight, 3), eight);
  const nine = addRow(eight, 'riff');
  [-1, 9, 1.5, undefined].forEach((track) => assert.equal(removeRow(nine, track), nine, String(track)));
  assert.deepEqual(removeRow(nine, 8), eight, 'adding then removing the new row is no change');
});

test('a 12-row beat stays 12 rows, in step, through every edit', () => {
  const beat = twelve();
  const edits = {
    toggle: toggle(beat, 11, 4),
    clear: clear(beat),
    surprise: surprise(beat, () => 0.5),
    longer: longer(beat),
    shorter: shorter(longer(beat)),
    double: double(longer(toggle(beat, 11, 0))),
    copyRow: copyRow(beat, 0, 11),
    withSounds: withSounds(beat, ids('kpop')),
    withLift: withLift(toggle(beat, 8, 0), 8, 0, 3),
  };
  Object.entries(edits).forEach(([name, edited]) => {
    assert.equal(trackCount(edited), 12, name);
    inStep(edited);
  });
});

// ---- Saves ----

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return { getItem: (key) => (data.has(key) ? data.get(key) : null), setItem: (key, value) => data.set(key, String(value)) };
}

test('an old 8-row save still loads as 8 rows, and ➕ Row works on it', () => {
  const old = { bpm: 100, rows: STARTERS[2].rows, kit: 'rock' };
  const [beat] = loadState(memoryStorage({ [OLD_KEY]: JSON.stringify({ slot: 0, slots: [old] }) })).slots;
  assert.equal(trackCount(beat), 8);
  inStep(beat);
  const nine = addRow(beat, newRowSound(beat.sounds));
  inStep(nine);
  assert.equal(nine.sounds[8], '808', 'a Rock beat gets K-pop\'s first note');
});

test('a beat grown to 12 rows and one shrunk back save and load as they are', () => {
  const storage = memoryStorage();
  const state = defaultState();
  state.slots[0] = withLift(toggle(twelve(), 11, 2), 11, 2, 1);
  state.slots[1] = removeRow(removeRow(twelve(), 8), 3);
  saveState(storage, state);
  const loaded = loadState(storage);
  assert.deepEqual(loaded.slots[0], state.slots[0]);
  assert.equal(trackCount(loaded.slots[1]), 10);
  assert.deepEqual(loaded.slots[1], state.slots[1]);
});

test('a save with 13 rows falls back for that slot only', () => {
  const beat = twelve();
  const thirteen = { ...beat, rows: [...beat.rows, beat.rows[0]], sounds: [...beat.sounds, 'tom'], pitch: [...beat.pitch, beat.pitch[0]] };
  const loaded = loadState(memoryStorage({ [STORAGE_KEY]: JSON.stringify({ slot: 0, slots: [thirteen, beat] }) }));
  assert.equal(trackCount(loaded.slots[0]), 8);
  assert.deepEqual(loaded.slots[1], beat);
});
