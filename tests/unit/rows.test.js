import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KITS } from '../../js/sounds.js';
import { newRowSound } from '../../js/rows.js';

const ids = (kit) => KITS.find((k) => k.id === kit).sounds.map((sound) => sound.id);

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
