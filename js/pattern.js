// A beat is { bpm, rows, sounds, pitch }, with 8 to 12 rows:
// - rows: one string per row, 'x' on and '.' off, all the same length: 16, 32, 48 or 64 steps;
// - sounds: the sound id each row plays (sounds.js owns the sounds), so any row can play any sound;
// - pitch: per row, a number per step: how many steps of E minor the key slider moves that note
//   (task 84), 0 as written. Only tuned sounds use it.

export const MIN_TRACKS = 8;
export const MAX_TRACKS = 12;
export const BAR = 16;
export const MAX_STEPS = 64;
export const LIFT_MAX = 4;
export const BPM_MIN = 60;
export const BPM_MAX = 180;
export const BPM_STEP = 10;
export const BPM_DEFAULT = 100;

// Party's sounds, row by row (tests/unit/kits.test.js checks they match sounds.js).
export const DEFAULT_SOUNDS = ['kick', 'snare', 'clap', 'hat', 'cowbell', 'bass', 'laser', 'boing'];

const ROW = /^[x.]+$/;
const ID = /^[a-z0-9-]{1,24}$/;
const HISTORY_MAX = 50;

// Track order: kick, snare, clap, hi-hat, cowbell, bass, laser, boing.
export const STARTERS = [
  { name: 'Boom Clap', bpm: 100, rows: [
    'x.......x.......', '................', '....x.......x...', 'x.x.x.x.x.x.x.x.',
    '................', 'x.....x...x.....', '................', '................'] },
  { name: 'Rock', bpm: 110, rows: [
    'x.....x.x.......', '....x.......x...', '................', 'x.x.x.x.x.x.x.x.',
    '................', 'x.....x.x.......', '................', '................'] },
  { name: 'Hip Hop', bpm: 90, rows: [
    'x......x..x.....', '....x.......x...', '................', 'x.x.x.x.x.x.xxx.',
    '................', 'x......x..x.....', '................', '..............x.'] },
  { name: 'Disco', bpm: 120, rows: [
    'x...x...x...x...', '................', '....x.......x...', '..x...x...x...x.',
    '.......x........', 'x.x...x.x.x...x.', '................', '................'] },
  { name: 'Space', bpm: 100, rows: [
    'x.......x.x.....', '....x.......x...', '................', 'x.x.x.x.x.x.x.x.',
    '................', 'x...x...x...x...', '......x.......x.', '...........x....'] },
  { name: 'Cowbell Party', bpm: 120, rows: [
    'x...x...x...x...', '....x.......x...', '................', '..x...x...x...x.',
    'x..x..x...x..x..', '................', '................', '...........x....'] },
  { name: 'Bouncy', bpm: 130, rows: [
    'x..x..x...x..x..', '................', '....x.......x...', '..x...x...x...x.',
    '................', 'x..x..x...x..x..', '................', 'x.......x.......'] },
];

const flat = (steps) => Array(steps).fill(0);

export function emptyBeat(bpm = BPM_DEFAULT, steps = BAR, sounds = DEFAULT_SOUNDS) {
  return { bpm, rows: sounds.map(() => '.'.repeat(steps)), sounds: [...sounds], pitch: sounds.map(() => flat(steps)) };
}

// A starter or an old save has no pitch: its notes play as written.
export function copyBeat(beat) {
  const pitch = beat.pitch ?? beat.rows.map((row) => flat(row.length));
  return { bpm: beat.bpm, rows: [...beat.rows], sounds: [...(beat.sounds ?? DEFAULT_SOUNDS)], pitch: pitch.map((lane) => [...lane]) };
}

export function stepCount(beat) {
  return beat.rows[0].length;
}

export function trackCount(beat) {
  return beat.rows.length;
}

export function isOn(beat, track, step) {
  return beat.rows[track][step] === 'x';
}

export function isEmpty(beat) {
  return beat.rows.every((row) => !row.includes('x'));
}

function flip(row, step) {
  const next = row[step] === 'x' ? '.' : 'x';
  return row.slice(0, step) + next + row.slice(step + 1);
}

const setAt = (lane, step, value) => lane.map((old, i) => (i === step ? value : old));

// A new note plays as written, and a note turned off forgets how far it was moved.
export function toggle(beat, track, step) {
  const rows = beat.rows.map((row, i) => (i === track ? flip(row, step) : row));
  return { ...beat, rows, pitch: beat.pitch.map((lane, i) => (i === track ? setAt(lane, step, 0) : lane)) };
}

export function clear(beat) {
  return emptyBeat(beat.bpm, stepCount(beat), beat.sounds);
}

// ---- Mix and match (task 84): any sound on any row ----

export function withSound(beat, track, id) {
  return { ...beat, sounds: beat.sounds.map((old, i) => (i === track ? id : old)) };
}

// A kit's 8 sounds on every row; rows past 8 start over at its first sound.
export function withSounds(beat, ids) {
  return { ...beat, sounds: beat.sounds.map((_, i) => ids[i % ids.length]) };
}

// ---- The key slider (task 84) ----

export function liftAt(beat, track, step) {
  return beat.pitch[track][step];
}

export function withLift(beat, track, step, lift) {
  const clamped = Math.max(-LIFT_MAX, Math.min(LIFT_MAX, Math.round(lift)));
  return { ...beat, pitch: beat.pitch.map((lane, i) => (i === track ? setAt(lane, step, clamped) : lane)) };
}

// ---- More rows (task 84): ➕ Row and 🗑 Remove row, from 8 to 12 rows ----

// ➕ Row: a new empty row at the bottom that plays `id`.
export function addRow(beat, id) {
  if (trackCount(beat) >= MAX_TRACKS) return beat;
  const steps = stepCount(beat);
  return { ...beat, rows: [...beat.rows, '.'.repeat(steps)], sounds: [...beat.sounds, id], pitch: [...beat.pitch, flat(steps)] };
}

// 🗑 Remove row: its notes, sound and pitch go, and the rows below move up.
export function removeRow(beat, track) {
  if (trackCount(beat) <= MIN_TRACKS || !beat.rows[track]) return beat;
  const keep = (_, i) => i !== track;
  return { ...beat, rows: beat.rows.filter(keep), sounds: beat.sounds.filter(keep), pitch: beat.pitch.filter(keep) };
}

// ---- Longer, shorter, ×2 and copy: rows and their pitch change together ----

// `change` gets a row (a string) or its pitch (an array), so it may use only what both have.
const mapLanes = (beat, change) => ({ ...beat, rows: beat.rows.map(change), pitch: beat.pitch.map(change) });

// ➕ Make it longer: 16 more steps, a copy of the last 16, so a kid can add on and change it.
export function longer(beat) {
  if (stepCount(beat) >= MAX_STEPS) return beat;
  return mapLanes(beat, (lane) => lane.concat(lane.slice(-BAR)));
}

// ➖ Shorter: takes the last 16 steps away.
export function shorter(beat) {
  if (stepCount(beat) <= BAR) return beat;
  return mapLanes(beat, (lane) => lane.slice(0, -BAR));
}

const firstHalf = (lane) => lane.slice(0, lane.length / 2);

// ×2 Double: the first half of the beat, played again as the second half.
export function canDouble(beat) {
  return beat.rows.some((row) => firstHalf(row).includes('x'));
}

export function double(beat) {
  return mapLanes(beat, (lane) => firstHalf(lane).concat(firstHalf(lane)));
}

// Copies one row's notes, and how far each is moved, onto another row. Its sound stays.
export function copyRow(beat, from, to) {
  return { ...beat, rows: beat.rows.map((row, i) => (i === to ? beat.rows[from] : row)), pitch: beat.pitch.map((lane, i) => (i === to ? [...beat.pitch[from]] : lane)) };
}

export function clampBpm(bpm) {
  return Math.min(BPM_MAX, Math.max(BPM_MIN, Math.round(bpm)));
}

export function withBpm(beat, bpm) {
  return { ...beat, bpm: clampBpm(bpm) };
}

// ---- Checking a saved beat ----

function isValidLength(steps) {
  return steps % BAR === 0 && steps >= BAR && steps <= MAX_STEPS;
}

function isValidRow(row, steps) {
  return typeof row === 'string' && row.length === steps && ROW.test(row);
}

const isLift = (value) => Number.isInteger(value) && Math.abs(value) <= LIFT_MAX;

function isValidLane(lane, steps) {
  return Array.isArray(lane) && lane.length === steps && lane.every(isLift);
}

// `sounds` and `pitch` may be missing (saves from before task 84) but not wrong.
function isValidExtra(value, tracks, steps) {
  if (value.kit !== undefined && !(typeof value.kit === 'string' && ID.test(value.kit))) return false;
  if (value.sounds !== undefined && !(Array.isArray(value.sounds) && value.sounds.length === tracks)) return false;
  if (value.sounds?.some((id) => !(typeof id === 'string' && ID.test(id)))) return false;
  if (value.pitch === undefined) return true;
  return Array.isArray(value.pitch) && value.pitch.length === tracks && value.pitch.every((lane) => isValidLane(lane, steps));
}

export function isValidBeat(value) {
  if (!value || typeof value !== 'object') return false;
  if (!Number.isFinite(value.bpm) || value.bpm < BPM_MIN || value.bpm > BPM_MAX) return false;
  if (!Array.isArray(value.rows) || value.rows.length < MIN_TRACKS || value.rows.length > MAX_TRACKS) return false;
  const steps = value.rows[0]?.length;
  if (!isValidLength(steps) || !value.rows.every((row) => isValidRow(row, steps))) return false;
  return isValidExtra(value, value.rows.length, steps);
}

function sameRows(a, b) {
  return a.rows.every((row, i) => row === b.rows[i]);
}

// A starter, repeated to fill the beat's length. It keeps the beat's sounds; rows past 8 start empty.
function fitted(starter, current) {
  const times = stepCount(current) / BAR;
  const rows = current.sounds.map((_, i) => (starter.rows[i] ?? '.'.repeat(BAR)).repeat(times));
  return copyBeat({ bpm: starter.bpm, rows, sounds: current.sounds });
}

// A random starter beat that differs from the one on screen. It keeps the beat's length and sounds.
// A kit can bring its own starters (rows keep their job, but row 4 is a crash in Rock).
export function surprise(current, random = Math.random, starters = STARTERS) {
  const choices = starters.map((starter) => fitted(starter, current)).filter((beat) => !sameRows(beat, current));
  return choices[Math.floor(random() * choices.length)];
}

export function createHistory(limit = HISTORY_MAX) {
  const past = [];
  return {
    push(beat) {
      past.push(beat);
      if (past.length > limit) past.shift();
    },
    undo(current) {
      return past.pop() ?? current;
    },
    get canUndo() {
      return past.length > 0;
    },
  };
}
