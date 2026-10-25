// Held notes (task 84): the '-' mark, tidying, toggling a bar, ➕ ➖ ×2 📋, loading, and when
// a held note starts and ends on the audio clock.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createHoldPlayer, createNotePreview, cue, holdTo, noteEnd, noteLift, noteStart, removeNote, stretchLimit, tidyRow,
} from '../../js/holds.js';
import {
  copyBeat, copyRow, double, emptyBeat, isEmpty, isOn, isValidBeat, longer, shorter, toggle,
} from '../../js/pattern.js';
import { STORAGE_KEY, loadState } from '../../js/slots.js';
import { INTERVAL_MS, START_DELAY, createScheduler, stepDuration } from '../../js/scheduler.js';
import { CAP, TUNED } from '../../js/sounds.js';

const EPS = 1e-9;
const withRow = (row, track = 5) => {
  const beat = emptyBeat(100, row.length);
  return { ...beat, rows: beat.rows.map((old, i) => (i === track ? row : old)) };
};

// ---- Marks ----

test('tidying turns a cut-off hold into a note of its own, and leaves good rows alone', () => {
  assert.equal(tidyRow('-..x--.'), 'x..x--.');
  assert.equal(tidyRow('--.x'), 'x-.x');
  assert.equal(tidyRow('x.-.-'), 'x.x.x');
  assert.equal(tidyRow('x---x-..'), 'x---x-..');
  assert.equal(tidyRow('........'), '........');
});

test('a note is found from any step of its bar, and ends where its holds end', () => {
  const row = '.x---.x-';
  assert.equal(noteStart(row, 0), -1);
  [1, 2, 3, 4].forEach((step) => assert.equal(noteStart(row, step), 1, `step ${step}`));
  assert.equal(noteEnd(row, 1), 4);
  assert.equal(noteStart(row, 7), 6);
  assert.equal(noteEnd(row, 6), 7);
  assert.equal(noteEnd('x.', 0), 0);
});

test('a note stretches up to the next note or the beat’s end, never past', () => {
  assert.equal(stretchLimit('x..x....', 0), 2);
  assert.equal(stretchLimit('x.......', 0), 7);
  assert.equal(holdTo('x..x....', 0, 9), 'x--x....');
  assert.equal(holdTo('........', 2, 4), '..x--...');
  assert.equal(holdTo('x---....', 0, 1), 'x-......', 'sliding back shortens it');
  assert.equal(holdTo('x---....', 0, -3), 'x.......', 'never shorter than one step');
  assert.equal(holdTo('......x.', 6, 30), '......x-', 'it stops at the beat’s end');
});

test('removing a note takes its whole bar, wherever it’s tapped', () => {
  assert.equal(removeNote('.x---.x-', 3), '......x-');
  assert.equal(removeNote('.x---.x-', 1), '......x-');
  assert.equal(removeNote('.x---.x-', 0), '.x---.x-');
});

// ---- Beats ----

test('a held step is lit, and a tap anywhere on the bar takes the note away', () => {
  const beat = withRow('..x---..........');
  assert.equal(isOn(beat, 5, 4), true);
  assert.equal(isOn(beat, 5, 6), false);
  const tapped = toggle(beat, 5, 4);
  assert.equal(tapped.rows[5], '................');
  assert.equal(isEmpty(tapped), true);
  assert.equal(toggle(tapped, 5, 4).rows[5], '....x...........', 'a tap on an empty square is a plain note');
});

test('rows with holds are valid; bad marks are not', () => {
  assert.equal(isValidBeat(withRow('x---x-..........')), true);
  assert.equal(isValidBeat(withRow('x---x-.........o')), false);
  assert.equal(isValidBeat(withRow('x---x-.........=')), false);
});

test('➕ copies the last 16 steps; a hold cut off at the copy’s start becomes a note', () => {
  // A note held across the bar line: steps 14 to 17.
  const beat = withRow(`${'.'.repeat(14)}x---${'.'.repeat(14)}`);
  const next = longer(beat);
  assert.equal(next.rows[5], `${'.'.repeat(14)}x---${'.'.repeat(14)}x-${'.'.repeat(14)}`);
});

test('➖ cuts a long note at the new end', () => {
  const beat = withRow(`${'.'.repeat(12)}x-------${'.'.repeat(12)}`);
  assert.equal(shorter(beat).rows[5], `${'.'.repeat(12)}x---`);
});

test('×2 repeats the first half; a note held over the middle is cut there', () => {
  const beat = withRow(`x.....x---......${'.'.repeat(16)}`);
  const held = withRow(`${'.'.repeat(14)}x---${'.'.repeat(14)}`);
  assert.equal(double(beat).rows[5], 'x.....x---......'.repeat(2));
  assert.equal(double(held).rows[5], `${'.'.repeat(14)}x-`.repeat(2));
});

test('📋 copies a row’s holds onto another sound', () => {
  const beat = withRow('x---..x-........', 2);
  assert.equal(copyRow(beat, 2, 6).rows[6], 'x---..x-........');
});

test('loading tidies stray holds, and old saves load as they are', () => {
  const stray = withRow('-...x-..........');
  assert.equal(copyBeat(stray).rows[5], 'x...x-..........');
  const old = withRow('x...x...........');
  const storage = { getItem: () => JSON.stringify({ slot: 0, slots: [stray, old] }) };
  const state = loadState(storage);
  assert.equal(state.slots[0].rows[5], 'x...x-..........');
  assert.deepEqual(state.slots[1].rows, old.rows);
  assert.equal(STORAGE_KEY.startsWith('poprocks'), true);
});

// ---- Which sounds ring ----

test('the 8 tuned sounds ring; drums and effects roll', () => {
  ['guitar', 'synth', 'chug', 'bass', 'rock-bass', '808', 'riff', 'bell'].forEach((id) => assert.ok(TUNED.has(id), id));
  ['kick', 'snare', 'hat', 'cowbell', 'laser', 'crash', 'hey', 'snap'].forEach((id) => assert.ok(!TUNED.has(id), id));
});

test('each step’s cue: start, keep, play again on a chord change, end', () => {
  const row = 'x-.x---x--------';
  assert.equal(cue(row, 0, true, false), 'hold');
  assert.equal(cue(row, 1, true, true), 'keep');
  assert.equal(cue(row, 2, true, true), 'off');
  assert.equal(cue(row, 7, true, false), 'hold');
  assert.equal(cue(row, 8, true, true), 'hold', 'a chord change plays it again');
  assert.equal(cue(row, 9, true, true), 'keep');
  assert.equal(cue(row, 9, true, false), 'hold', 'a hold with nothing ringing (stretched while playing) starts one');
  assert.equal(cue('x.', 0, true, false), 'hold', 'a one-step tuned note lasts its square too');
  assert.equal(cue(row, 1, false, false), 'hit', 'a drum rolls');
  assert.equal(cue(row, 2, false, false), 'off');
});

// ---- On the audio clock ----

// The real scheduler, a fake clock and a fake engine that logs what it's told.
function rig({ rows, ids, bpm = 120, steps = rows[0].length }) {
  const clock = { t: 0 };
  const log = [];
  const times = [];
  const engine = {
    play: (id, time, step) => log.push({ type: 'hit', id, time, step }),
    hold(id, time, step) {
      const note = { type: 'hold', id, time, step, off: null };
      log.push(note);
      return { release: (off) => { note.off ??= off; } };
    },
  };
  const player = createHoldPlayer(engine);
  const beat = { rows };
  const onStep = (step, time) => {
    times.push({ step, time });
    beat.rows.forEach((row, track) => player.step(row, track, ids[track], step, time));
  };
  const timers = { setInterval: () => 1, clearInterval: () => {} };
  const scheduler = createScheduler({ now: () => clock.t, onStep, steps, bpm, timers });
  const run = (seconds) => {
    const end = clock.t + seconds;
    while (clock.t < end) {
      clock.t += INTERVAL_MS / 1000;
      scheduler.tick();
    }
  };
  return { clock, log, times, player, scheduler, run, beat };
}

const holds = (log) => log.filter((entry) => entry.type === 'hold');
const at = (n, bpm = 120) => START_DELAY + n * stepDuration(bpm);

test('a held note ends at the step after its last hold', () => {
  const { log, scheduler, run } = rig({ rows: ['..x---..........'], ids: ['bass'] });
  scheduler.start();
  run(1.5);
  const [note] = holds(log);
  assert.ok(Math.abs(note.time - at(2)) < EPS);
  assert.ok(Math.abs(note.off - at(6)) < EPS);
});

test('a single tuned note ends at its own square’s end, so a held one sounds longer', () => {
  const { log, scheduler, run } = rig({ rows: ['..x.x---........'], ids: ['guitar'] });
  scheduler.start();
  run(1.5);
  const [single, held] = holds(log);
  assert.ok(Math.abs(single.time - at(2)) < EPS);
  assert.ok(Math.abs(single.off - at(3)) < EPS, 'one square');
  assert.ok(Math.abs(held.off - at(8)) < EPS, 'four squares');
});

test('a note held to the last step ends at the loop’s end, not after it', () => {
  const { log, scheduler, run } = rig({ rows: ['............x---'], ids: ['synth'] });
  scheduler.start();
  run(4);
  const [first, second] = holds(log);
  assert.ok(Math.abs(first.time - at(12)) < EPS);
  assert.ok(Math.abs(first.off - at(16)) < EPS, 'off on the next loop’s first step');
  assert.ok(Math.abs(second.time - at(28)) < EPS, 'and it plays again next time round');
});

test('a tempo change mid-note ends it on the new tempo’s step', () => {
  const { log, times, scheduler, run } = rig({ rows: ['x-----..........'], ids: ['808'], bpm: 120 });
  scheduler.start();
  run(0.2);
  const queued = times.length;
  scheduler.setBpm(60);
  run(2);
  const [note] = holds(log);
  const step6 = times.find(({ step }) => step === 6);
  assert.ok(queued < 6, 'the tempo changed while the note was ringing');
  assert.ok(Math.abs(step6.time - times[5].time - stepDuration(60)) < EPS, 'step 6 is on the new tempo');
  assert.ok(Math.abs(note.off - step6.time) < EPS, `off at ${note.off}`);
});

test('a note held over a chord change plays again on the new chord, then ends', () => {
  const { log, scheduler, run } = rig({ rows: ['x-----------....'], ids: ['guitar'] });
  scheduler.start();
  run(1.8);
  const [first, second] = holds(log);
  assert.ok(Math.abs(first.time - at(0)) < EPS);
  assert.ok(Math.abs(first.off - at(8)) < EPS);
  assert.equal(second.step, 8);
  assert.ok(Math.abs(second.time - at(8)) < EPS);
  assert.ok(Math.abs(second.off - at(12)) < EPS);
});

test('an edit while a note rings ends it at the next step', () => {
  const { log, times, scheduler, run, beat } = rig({ rows: ['x-------........'], ids: ['chug'] });
  scheduler.start();
  run(0.3);
  const next = times.length;
  beat.rows = ['x-..............'];
  run(1);
  const [note] = holds(log);
  assert.ok(next > 1 && next < 8, 'the edit came while the note was ringing');
  assert.ok(Math.abs(note.off - times[next].time) < EPS, `off at ${note.off}`);
});

test('Stop ends every ringing note at once', () => {
  const { clock, log, player, scheduler, run } = rig({ rows: ['x-------........', 'x---------......'], ids: ['bass', 'bell'] });
  scheduler.start();
  run(0.4);
  scheduler.stop();
  player.releaseAll(clock.t);
  holds(log).forEach((note) => assert.equal(note.off, clock.t));
  assert.equal(holds(log).length, 2);
});

test('a held drum rolls: it plays on every step of the bar', () => {
  const { log, scheduler, run } = rig({ rows: ['..x---..........'], ids: ['snare'] });
  scheduler.start();
  run(1.5);
  const hits = log.filter((entry) => entry.type === 'hit' && entry.time < at(16));
  assert.deepEqual(hits.map((hit) => hit.step), [2, 3, 4, 5]);
  assert.equal(holds(log).length, 0);
});

test('a row switched to a drum mid-note ends the held note', () => {
  const ids = ['bass'];
  const { log, scheduler, run } = rig({ rows: ['x-------........'], ids });
  scheduler.start();
  run(0.3);
  ids[0] = 'kick';
  run(0.5);
  const [note] = holds(log);
  assert.ok(note.off !== null && note.off < at(8));
  assert.ok(log.some((entry) => entry.type === 'hit' && entry.id === 'kick'));
});

test('the cap outlasts the longest ring: 8 steps at the slowest tempo', () => {
  assert.ok(CAP > 8 * stepDuration(60));
});

// ---- The look ----

const hexes = (block) => Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((m) => [m[1], m[2]]));
const channel = (hex, i) => {
  const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex) => 0.2126 * channel(hex, 0) + 0.7152 * channel(hex, 1) + 0.0722 * channel(hex, 2);
const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

test('in dark mode a held bar stands out 4.5:1 from the empty squares around it, in every row’s colour', () => {
  const css = readFileSync(new URL('../../app.css', import.meta.url), 'utf8');
  const dark = { ...hexes(css.match(/^:root\s*{([^}]*)}/m)[1]), ...hexes(css.match(/@media \(prefers-color-scheme: dark\)\s*{\s*:root\s*{([^}]*)}/)[1]) };
  const rows = Object.keys(dark).filter((name) => /^c\d+$/.test(name));
  assert.ok(rows.length >= 8);
  rows.forEach((c) => ['pad-off', 'pad-alt'].forEach((bg) => {
    assert.ok(ratio(dark[c], dark[bg]) >= 4.5, `--${c} on --${bg}: ${ratio(dark[c], dark[bg]).toFixed(2)}:1`);
  }));
});

// A fake engine that logs where each sound goes, with channels whose fades are logged too.
function previewRig() {
  const log = [];
  const channels = [];
  const engine = {
    ctx: { currentTime: 10 },
    channel() {
      const channel = { faded: null, gain: { setTargetAtTime: (value, time) => { channel.faded = { value, time }; } } };
      channels.push(channel);
      return channel;
    },
    play: (id, time, step, lift, dest) => log.push({ type: 'hit', id, time, step, lift, dest }),
    hold(id, time, step, lift, dest) {
      const note = { type: 'hold', id, time, step, lift, dest, off: null };
      log.push(note);
      return { release: (off) => { note.off ??= off; } };
    },
  };
  return { engine, log, channels };
}

test('a preview plays one note for its length, at its height, through its own channel', () => {
  const { engine, log, channels } = previewRig();
  createNotePreview(engine).play('..x---..', 'bass', 2, 0.1, 2);
  const [held] = log;
  assert.equal(held.step, 2);
  assert.equal(held.lift, 2);
  assert.equal(held.dest, channels[0]);
  assert.ok(Math.abs(held.time - 10.02) < EPS);
  assert.ok(Math.abs(held.off - 10.42) < EPS, 'off after 4 steps');
});

test('the next preview, or stop, fades out what’s left of the last one, a drum roll too', () => {
  const { engine, log, channels } = previewRig();
  const preview = createNotePreview(engine);
  preview.play('x-----------', 'snare', 0, 0.1);
  assert.equal(log.length, 12, 'a held snare rolls');
  log.forEach((hit) => assert.equal(hit.dest, channels[0]));
  engine.ctx.currentTime = 10.28;
  preview.play('x-----------', 'snare', 0, 0.1);
  assert.deepEqual(channels[0].faded, { value: 0, time: 10.28 }, 'the first roll fades out');
  assert.equal(channels[1].faded, null);
  preview.stop();
  assert.equal(channels[1].faded.value, 0, 'stop (Play) fades the second');
});

// ---- Held notes and the key slider ----

const withPitch = (beat, track, step, lift) => ({
  ...beat, pitch: beat.pitch.map((lane, i) => (i === track ? lane.map((old, s) => (s === step ? lift : old)) : lane)),
});

test('a held note plays at its first step’s height all along its bar', () => {
  const beat = withPitch(withRow('..x---..........'), 5, 2, 2);
  [2, 3, 4, 5].forEach((step) => assert.equal(noteLift(beat, 5, step), 2, `step ${step}`));
  assert.equal(noteLift(beat, 5, 0), 0, 'an empty square has none');
});

test('a tap mid-bar takes the note away and forgets its first step’s height', () => {
  const beat = withPitch(withRow('..x---..........'), 5, 2, 3);
  const tapped = toggle(beat, 5, 4);
  assert.equal(tapped.rows[5], '................');
  assert.equal(tapped.pitch[5][2], 0);
});

test('a ringing note plays again when the key slider moves it, and not otherwise', () => {
  const { engine, log } = previewRig();
  const player = createHoldPlayer(engine);
  const row = 'x-----..';
  player.step(row, 0, 'bass', 0, 1, 0);
  player.step(row, 0, 'bass', 1, 1.1, 0);
  player.step(row, 0, 'bass', 2, 1.2, 2);
  const holds = log.filter((entry) => entry.type === 'hold');
  assert.equal(holds.length, 2);
  assert.equal(holds[0].off, 1.2, 'the old height ends where the new one starts');
  assert.equal(holds[1].lift, 2);
});

test('rows past the beat’s last end their held notes (a row taken away)', () => {
  const { engine, log } = previewRig();
  const player = createHoldPlayer(engine);
  player.step('x-------', 3, 'bass', 0, 1, 0);
  player.step('x-------', 9, 'synth', 0, 1, 0);
  player.trim(8, 1.3);
  const [kept, cut] = log;
  assert.equal(cut.off, 1.3);
  assert.equal(kept.off, null);
});

test('➕ copies a note held into the last 16 as a note of its own, at its height, never joined', () => {
  // 32 steps: a note at 13 held to 21 (lifted 2), and a note on the last step.
  const beat = withPitch(withRow(`${'.'.repeat(12)}x--------${'.'.repeat(10)}x`), 5, 12, 2);
  const next = longer(beat);
  assert.equal(next.rows[5].slice(31, 37), 'xx----', 'the last step stays one step; the copy starts a note');
  assert.equal(next.pitch[5][32], 2);
  assert.equal(next.rows[5].length, 48);
});
