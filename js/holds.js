// Held notes (task 84). A row marks a note's first step 'x' and each step it keeps holding '-',
// so 'x---' is a 4-step note. Tuned sounds ring for the length; drums and effects roll,
// playing on every step. A note stops at the beat's end: it never wraps.

import { TUNED, chordAt } from './sounds.js';

export const HOLD = '-';

// A '-' with no note before it (left by a cut, a copy or a bad save) starts a note of its own.
// It sounds the same: a bar line is always a chord change, where a held note plays again anyway.
export function tidyRow(row) {
  return row.replace(/(^|\.)-/g, '$1x');
}

export function tidy(beat) {
  return { ...beat, rows: beat.rows.map(tidyRow) };
}

// The first step of the note covering `step`, or -1 on an empty square.
export function noteStart(row, step) {
  if (row[step] !== 'x' && row[step] !== HOLD) return -1;
  let start = step;
  while (row[start] === HOLD) start -= 1;
  return start;
}

// The last step of the note that starts at `start`.
export function noteEnd(row, start) {
  let end = start;
  while (row[end + 1] === HOLD) end += 1;
  return end;
}

// How far a note can stretch: up to the next note, or the beat's end.
export function stretchLimit(row, start) {
  const next = row.indexOf('x', start + 1);
  return (next < 0 ? row.length : next) - 1;
}

// The note at `start`, held through `end` (kept between its start and its limit).
export function holdTo(row, start, end) {
  const last = Math.min(Math.max(end, start), stretchLimit(row, start));
  const old = Math.max(noteEnd(row, start), last);
  return row.slice(0, start) + 'x' + HOLD.repeat(last - start) + '.'.repeat(old - last) + row.slice(old + 1);
}

// Takes away the whole note covering `step`, wherever on the bar it's tapped.
export function removeNote(row, step) {
  const start = noteStart(row, step);
  if (start < 0) return row;
  const end = noteEnd(row, start);
  return row.slice(0, start) + '.'.repeat(end - start + 1) + row.slice(end + 1);
}

// How far the key slider moved the note covering `step` (task 84): a held note plays at its first
// step's height all along its bar. An empty square reads its row's first step, and plays nothing.
export function noteLift(beat, track, step) {
  return beat.pitch[track][Math.max(noteStart(beat.rows[track], step), 0)];
}

// ---- On the grid ----

// A held note shows as one bar: each step joins the step before or after it (app.css draws that).
// Returns whether the step is on a held note's bar, so its name can say so: "Bass, step 5, held".
export function showHold(pad, row, step) {
  const joinPrev = row[step] === HOLD;
  const joinNext = row[step + 1] === HOLD;
  pad.classList.toggle('join-prev', joinPrev);
  pad.classList.toggle('join-next', joinNext);
  return joinPrev || joinNext;
}

// ---- Playing ----

const chordChanges = (step) => chordAt(step) !== chordAt(step - 1);

// What a row does at a step: 'hit' plays a short note, 'hold' starts a held one, 'keep' lets
// the held note ring on, and 'off' ends it. A new note always ends the one before.
export function cue(row, step, rings, ringing) {
  const cell = row[step];
  if (cell !== 'x' && cell !== HOLD) return 'off';
  if (!rings) return 'hit';
  if (cell === 'x') return row[step + 1] === HOLD ? 'hold' : 'hit';
  return ringing && !chordChanges(step) ? 'keep' : 'hold';
}

// Plays each row's step as the scheduler reaches it. Tuned sounds ring; the rest roll. A ringing
// note whose height the key slider changed plays again at the new height. A held note ends on the audio clock at the
// first step that doesn't hold it, so a tempo change, an edit, the loop's end and Stop all end it on time.
export function createHoldPlayer(engine) {
  const ringing = new Map();

  function release(track, time) {
    ringing.get(track)?.note.release(time);
    ringing.delete(track);
  }

  return {
    step(row, track, id, step, time, lift = 0) {
      const now = ringing.get(track);
      const action = cue(row, step, TUNED.has(id), now?.id === id && now.lift === lift);
      if (action === 'keep') return;
      release(track, time);
      if (action === 'hit') engine.play(id, time, step, lift);
      if (action === 'hold') ringing.set(track, { id, lift, note: engine.hold(id, time, step, lift) });
    },
    releaseAll(time) {
      [...ringing.keys()].forEach((track) => release(track, time));
    },
  };
}

function playNote(player, row, id, start, at, lift) {
  const end = noteEnd(row, start);
  for (let step = start; step <= end; step += 1) player.step(row, 0, id, step, at(step), lift);
  player.releaseAll(at(end + 1));
}

// Plays one note from now, as the beat would: ringing, or rolling, for its length. Starting
// another ends a note still ringing from this one.
export function createNotePreview(engine) {
  let notes = [];
  const keep = (note) => {
    notes.push(note);
    return note;
  };
  const engineKept = { play: engine.play, hold: (...args) => keep(engine.hold(...args)) };

  return function preview(row, id, start, stepTime, lift = 0) {
    const now = engine.ctx.currentTime + 0.02;
    notes.forEach((note) => note.release(now));
    notes = [];
    playNote(createHoldPlayer(engineKept), row, id, start, (step) => now + (step - start) * stepTime, lift);
  };
}
