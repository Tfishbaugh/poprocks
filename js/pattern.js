// A beat is { bpm, rows }: one 16-character string per sound, 'x' on and '.' off.

export const TRACKS = 8;
export const STEPS = 16;
export const BPM_MIN = 60;
export const BPM_MAX = 180;
export const BPM_STEP = 10;
export const BPM_DEFAULT = 100;

const ROW = new RegExp(`^[x.]{${STEPS}}$`);
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

export function emptyBeat(bpm = BPM_DEFAULT) {
  return { bpm, rows: Array.from({ length: TRACKS }, () => '.'.repeat(STEPS)) };
}

export function copyBeat(beat) {
  return { bpm: beat.bpm, rows: [...beat.rows] };
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
  return emptyBeat(beat.bpm);
}

export function clampBpm(bpm) {
  return Math.min(BPM_MAX, Math.max(BPM_MIN, Math.round(bpm)));
}

export function withBpm(beat, bpm) {
  return { ...beat, bpm: clampBpm(bpm) };
}

function isValidRow(row) {
  return typeof row === 'string' && ROW.test(row);
}

export function isValidBeat(value) {
  if (!value || typeof value !== 'object') return false;
  if (!Number.isFinite(value.bpm) || value.bpm < BPM_MIN || value.bpm > BPM_MAX) return false;
  if (!Array.isArray(value.rows) || value.rows.length !== TRACKS) return false;
  return value.rows.every(isValidRow);
}

function sameRows(a, b) {
  return a.rows.every((row, i) => row === b.rows[i]);
}

// A random starter beat that differs from the one on screen.
export function surprise(current, random = Math.random) {
  const choices = STARTERS.filter((starter) => !sameRows(starter, current));
  return copyBeat(choices[Math.floor(random() * choices.length)]);
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
