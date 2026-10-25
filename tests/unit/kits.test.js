// The sound kits: names and rows, the one key and chord loop, 🎲 starters per kit, and the
// samples' licenses and credits.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import {
  KITS, SAMPLES, TUNED, bassNote, chordAt, chordNote, fit, isSound, kitById, kitOf, kitStarters, lifted, powerRoot, soundById,
} from '../../js/sounds.js';
import { CREDIT } from '../../js/kits.js';
import { MIN_TRACKS as TRACKS, STARTERS, copyBeat, emptyBeat, isValidBeat, stepCount, surprise, withSounds } from '../../js/pattern.js';

const root = new URL('../../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const labels = (id) => kitById(id).sounds.map((sound) => sound.label);
const ids = (id) => kitById(id).sounds.map((sound) => sound.id);
const E_MINOR = [0, 2, 3, 5, 7, 8, 10];
const inKey = (semis) => E_MINOR.includes(((semis % 12) + 12) % 12);

test('three kits: Party, Rock and K-pop, each with a picture and 8 sounds', () => {
  assert.deepEqual(KITS.map((kit) => kit.label), ['Party', 'Rock', 'K-pop']);
  KITS.forEach((kit) => {
    assert.match(kit.id, /^[a-z0-9-]{1,24}$/, 'a kit id that pattern.js accepts');
    assert.ok(kit.emoji);
    assert.equal(kit.sounds.length, TRACKS);
  });
});

test('Party is the first kit and sounds exactly as before', () => {
  assert.equal(KITS[0].id, 'party');
  assert.deepEqual(KITS[0].sounds.map((s) => s.id), ['kick', 'snare', 'clap', 'hat', 'cowbell', 'bass', 'laser', 'boing']);
  assert.ok(KITS[0].sounds.every((sound) => sound.gain === undefined), 'Party keeps its levels');
});

test('rows keep their job: drums on 1 to 4, notes on 5 to 8, names of 5 letters or fewer', () => {
  assert.deepEqual(labels('rock'), ['Kick', 'Snare', 'Tom', 'Crash', 'Chord', 'Chug', 'Bass', 'Riff']);
  assert.deepEqual(labels('kpop'), ['Kick', 'Clap', 'Snap', 'Hat', '808', 'Bell', 'Chord', 'Hey!']);
  KITS.flatMap((kit) => kit.sounds).forEach((sound) => {
    assert.ok(sound.label.length <= 5, sound.label);
    assert.ok(sound.emoji, sound.label);
  });
});

test('every sound has its own id, so each kit plays its own sounds', () => {
  const ids = KITS.flatMap((kit) => kit.sounds.map((sound) => sound.id));
  assert.equal(new Set(ids).size, ids.length);
});

test('an unknown or missing kit plays Party', () => {
  assert.equal(kitById('nope').id, 'party');
  assert.equal(kitById(undefined).id, 'party');
});

test('any kit’s sound can be found by its id, with its kit', () => {
  assert.equal(soundById('crash').label, 'Crash');
  assert.equal(soundById('crash').kit, 'rock');
  assert.equal(soundById('hey').kit, 'kpop');
  assert.equal(soundById('nope').id, 'kick', 'an unknown id plays Party’s Kick');
  assert.ok(isSound('riff'));
  assert.equal(isSound('nope'), false);
});

test('kitOf names the kit all the rows come from, or null for a mix', () => {
  assert.equal(kitOf(ids('rock')).id, 'rock');
  assert.equal(kitOf([...ids('kpop'), 'hey', 'snap']).id, 'kpop', 'more rows of the same kit');
  assert.equal(kitOf([...ids('party').slice(0, 7), 'riff']), null);
});

test('the chord loop is Em, C, G, D, a chord every 8 steps, and repeats after 32', () => {
  const roots = [0, 8, 16, 24, 32, 63].map((step) => chordAt(step)[0]);
  assert.deepEqual(roots, [0, -4, 3, -2, 0, -2]);
  assert.equal(chordAt(7), chordAt(0));
});

test('every note of every chord is in E minor', () => {
  [0, 8, 16, 24].flatMap((step) => chordAt(step)).forEach((semis) => assert.ok(inKey(semis), String(semis)));
});

test('fit moves a note by octaves into its range', () => {
  assert.equal(fit(0, -5), 0);
  assert.equal(fit(10, -5), -2);
  assert.equal(fit(-7, -5), 5);
  assert.equal(fit(15, -2), 3);
});

test('tuned notes stay in their range on every step of a 64-step beat', () => {
  Array.from({ length: 64 }, (_, step) => step).forEach((step) => {
    [0, 1, 2].forEach((index) => {
      const note = chordNote(step, index, -5);
      assert.ok(note >= -5 && note < 7 && inKey(note), `step ${step}: ${note}`);
    });
  });
});

test('Rock and K-pop bring their own 🎲 starters; Party and mixes use the usual ones', () => {
  assert.equal(kitStarters(ids('party')), undefined);
  assert.equal(kitStarters([...ids('rock').slice(0, 7), 'hey']), undefined, 'a mix');
  assert.equal(kitStarters([...ids('rock'), 'hey']), kitById('rock').starters, 'rows past 8 don’t matter');
  ['rock', 'kpop'].forEach((id) => {
    const starters = kitStarters(ids(id));
    assert.ok(starters.length >= 3, id);
    starters.forEach((starter) => assert.ok(isValidBeat(withSounds(copyBeat(starter), ids(id))), `${id}: ${starter.name}`));
    assert.equal(new Set(starters.map((s) => s.rows.join())).size, starters.length, `${id}: all different`);
  });
});

test('🎲 in Rock picks a Rock starter and keeps the sounds and the length', () => {
  const current = withSounds(emptyBeat(100, 32), ids('rock'));
  const next = surprise(current, () => 0, kitStarters(current.sounds));
  assert.deepEqual(next.sounds, ids('rock'));
  assert.equal(stepCount(next), 32);
  assert.deepEqual(next.rows, kitById('rock').starters[0].rows.map((row) => row.repeat(2)));
});

test('Party’s 🎲 still uses the usual starters when a kit has none', () => {
  const next = surprise(emptyBeat(), () => 0, kitStarters(ids('party')));
  assert.deepEqual(next.rows, STARTERS[0].rows);
});

test('each kit’s preview is 8 rows of 8 steps, with most rows playing', () => {
  KITS.forEach((kit) => {
    assert.equal(kit.demo.length, TRACKS, kit.id);
    kit.demo.forEach((row) => assert.match(row, /^[x.]{8}$/, kit.id));
    assert.ok(kit.demo.filter((row) => row.includes('x')).length >= TRACKS - 2, kit.id);
  });
});

// ---- Samples, licenses and credits ----

const sampleFiles = () => readdirSync(new URL('sounds/', root)).sort();
const ALLOWED = ['CC0 1.0', 'CC BY 3.0', 'CC BY 4.0'];

function licenseEntry(file) {
  const section = read('LICENSES.md').split(`### sounds/${file}\n`)[1]?.split('\n### ')[0] ?? '';
  const field = (name) => section.match(new RegExp(`^- ${name}: (.+)$`, 'm'))?.[1] ?? '';
  return { license: field('License'), source: field('Source'), author: field('Author').split(' (')[0] };
}

test('the samples are the four the engine loads, each small', () => {
  assert.deepEqual(sampleFiles(), Object.keys(SAMPLES).map((name) => `${name}.mp3`).sort());
  sampleFiles().forEach((file) => {
    const size = statSync(new URL(`sounds/${file}`, root)).size;
    assert.ok(size <= 25_000, `${file} is ${size} bytes`);
  });
});

test('LICENSES lists every sample with an allowed license, a Freesound source and its author', () => {
  sampleFiles().forEach((file) => {
    const { license, source, author } = licenseEntry(file);
    assert.ok(ALLOWED.includes(license), `${file}: license "${license}"`);
    assert.match(source, /^https:\/\/freesound\.org\/people\/[^/]+\/sounds\/\d+\/$/, file);
    assert.ok(source.includes(`/people/${author}/`), `${file}: the author is the uploader`);
    assert.equal(author, SAMPLES[file.replace('.mp3', '')], `${file}: sounds.js has the same author`);
  });
});

test('every sample author is in CREDITS and in the app’s "Sounds by" line, which has no links', () => {
  const credits = read('CREDITS.md');
  sampleFiles().map((file) => licenseEntry(file).author).forEach((author) => {
    assert.ok(credits.includes(author), `CREDITS.md: ${author}`);
    assert.ok(CREDIT.includes(author), `in-app credit: ${author}`);
  });
  assert.match(CREDIT, /sounds by/i);
  assert.doesNotMatch(CREDIT, /https?:|www\./);
});

// ---- The key slider (task 84): every spot stays in E minor ----

const STEPS = Array.from({ length: 32 }, (_, step) => step);
const LIFTS = [-4, -3, -2, -1, 0, 1, 2, 3, 4];

test('the tuned sounds are the 8 that play notes', () => {
  assert.deepEqual([...TUNED].sort(), ['808', 'bass', 'bell', 'chug', 'guitar', 'riff', 'rock-bass', 'synth']);
  TUNED.forEach((id) => assert.ok(isSound(id), id));
});

test('a lift moves a note that many steps along E minor', () => {
  assert.equal(lifted(0, 1), 2, 'E up one is F#');
  assert.equal(lifted(0, -1), -2, 'E down one is D');
  assert.equal(lifted(-4, 4), 3, 'C up four is G');
  assert.equal(lifted(10, 1), 12, 'D up one is the next E');
  assert.equal(lifted(7, 0), 7);
});

test('every spot of the key slider, on every step of the chord loop, stays in E minor', () => {
  STEPS.forEach((step) => LIFTS.forEach((lift) => {
    [0, 1, 2].forEach((index) => assert.ok(inKey(chordNote(step, index, -5, lift)), `chord note ${index}, step ${step}, ${lift}`));
    chordAt(step).forEach((semis) => assert.ok(inKey(lifted(fit(semis, -5), lift)), `synth, step ${step}, ${lift}`));
    assert.ok(inKey(bassNote(step, lift) + 5), `bass, step ${step}, ${lift}`);
  }));
});

test('a power chord’s root and its fifth stay in E minor on every spot', () => {
  STEPS.forEach((step) => LIFTS.forEach((lift) => {
    const root = powerRoot(step, lift);
    assert.ok(inKey(root) && inKey(root + 7), `step ${step}, ${lift}: ${root}`);
  }));
  assert.equal(powerRoot(0, 1), 3, 'E up one skips F# (its fifth is C#) and lands on G');
});

test('with no lift, every tuned note plays as before', () => {
  STEPS.forEach((step) => {
    assert.equal(powerRoot(step), fit(chordAt(step)[0], -4));
    assert.equal(chordNote(step, 1, -5, 0), fit(chordAt(step)[1], -5));
  });
});
