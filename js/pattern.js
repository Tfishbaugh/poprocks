// A beat is { bpm, rows, kit }:
// - rows: one string per sound, 'x' on and '.' off, all the same length: 16, 32, 48 or 64 steps;
// - kit: the sound kit's id (sounds.js owns the kits), 'party' when unset.

export const TRACKS = 8;
export const BAR = 16;
export const MAX_STEPS = 64;
export const DEFAULT_KIT = 'party';
export const BPM_MIN = 60;
export const BPM_MAX = 180;
export const BPM_STEP = 10;
export const BPM_DEFAULT = 100;

const ROW = /^[x.]+$/;
const KIT = /^[a-z0-9-]{1,24}$/;
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

export function emptyBeat(bpm = BPM_DEFAULT, steps = BAR, kit = DEFAULT_KIT) {
  return { bpm, rows: Array.from({ length: TRACKS }, () => '.'.repeat(steps)), kit };
}

export function copyBeat(beat) {
  return { bpm: beat.bpm, rows: [...beat.rows], kit: beat.kit ?? DEFAULT_KIT };
}

export function stepCount(beat) {
  return beat.rows[0].length;
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

export function toggle(beat, track, step) {
  return { ...beat, rows: beat.rows.map((row, i) => (i === track ? flip(row, step) : row)) };
}

export function clear(beat) {
  return emptyBeat(beat.bpm, stepCount(beat), beat.kit);
}

export function withKit(beat, kit) {
  return { ...beat, kit };
}

const mapRows = (beat, change) => ({ ...beat, rows: beat.rows.map(change) });

// ➕ Make it longer: 16 more steps, a copy of the last 16, so a kid can add on and change it.
export function longer(beat) {
  if (stepCount(beat) >= MAX_STEPS) return beat;
  return mapRows(beat, (row) => row + row.slice(-BAR));
}

// ✂️ Shorter: takes the last 16 steps away.
export function shorter(beat) {
  if (stepCount(beat) <= BAR) return beat;
  return mapRows(beat, (row) => row.slice(0, -BAR));
}

const firstHalf = (row) => row.slice(0, row.length / 2);

// ×2 Double: the first half of the beat, played again as the second half.
export function canDouble(beat) {
  return beat.rows.some((row) => firstHalf(row).includes('x'));
}

export function double(beat) {
  return mapRows(beat, (row) => firstHalf(row).repeat(2));
}

// Copies one sound's row onto another sound.
export function copyRow(beat, from, to) {
  return mapRows(beat, (row, track) => (track === to ? beat.rows[from] : row));
}

export function clampBpm(bpm) {
  return Math.min(BPM_MAX, Math.max(BPM_MIN, Math.round(bpm)));
}

export function withBpm(beat, bpm) {
  return { ...beat, bpm: clampBpm(bpm) };
}

function isValidLength(steps) {
  return steps % BAR === 0 && steps >= BAR && steps <= MAX_STEPS;
}

function isValidRow(row, steps) {
  return typeof row === 'string' && row.length === steps && ROW.test(row);
}

export function isValidBeat(value) {
  if (!value || typeof value !== 'object') return false;
  if (!Number.isFinite(value.bpm) || value.bpm < BPM_MIN || value.bpm > BPM_MAX) return false;
  if (value.kit !== undefined && !(typeof value.kit === 'string' && KIT.test(value.kit))) return false;
  if (!Array.isArray(value.rows) || value.rows.length !== TRACKS) return false;
  const steps = value.rows[0]?.length;
  return isValidLength(steps) && value.rows.every((row) => isValidRow(row, steps));
}

function sameRows(a, b) {
  return a.rows.every((row, i) => row === b.rows[i]);
}

// A starter, repeated to fill the beat's length.
function fitted(starter, current) {
  const times = stepCount(current) / BAR;
  return { bpm: starter.bpm, rows: starter.rows.map((row) => row.repeat(times)), kit: current.kit ?? DEFAULT_KIT };
}

// A random starter beat that differs from the one on screen. It keeps the beat's length and kit.
// Each kit can bring its own starters (rows keep their job, but row 4 is a crash in Rock).
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
