// Stretching held notes on the grid (task 84).
// - Press and hold a square (js/hold.js), then slide along its row: the bar's end moves as far as
//   the finger does, so a note can be grabbed anywhere on its bar. An empty square becomes a note.
// - Lift without sliding, and the note panel's ◀ ▶ change its length a step at a time.
// - Keys: Shift+→ holds the focused note one step longer and Shift+← one shorter (Shift+↓ and
//   Shift+↑ too on an upright screen, where steps run down). On an empty square, Shift+→ starts
//   a 2-step note there.

import { holdTo, noteEnd, noteStart, stretchLimit } from './holds.js';
import { button, el } from './dom.js';

const BY = { ArrowRight: 1, ArrowLeft: -1 };
const BY_TURNED = { ...BY, ArrowDown: 1, ArrowUp: -1 };
const NEAR = 3; // steps past a note's end that the note panel keeps clear of, for ▶ to grow into

function withRow(beat, track, row) {
  return { ...beat, rows: beat.rows.map((old, i) => (i === track ? row : old)) };
}

function lengthButton(icon, label) {
  const node = button('note-step', label);
  node.append(el('span', 'ico', icon));
  node.firstChild.setAttribute('aria-hidden', 'true');
  return node;
}

function union(a, b) {
  const [left, top] = [Math.min(a.left, b.left), Math.min(a.top, b.top)];
  const [right, bottom] = [Math.max(a.right, b.right), Math.max(a.bottom, b.bottom)];
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

const lengthWords = (steps) => (steps > 1 ? `Held for ${steps} steps.` : 'Not held.');

// `commit` makes each key press its own ↩; `edit` adds to the open press and hold's one ↩.
// `preview(track, row, start)` plays a note as the beat would.
export function createStretch({ root, slot, turned, beat, commit, edit, announce, preview }) {
  const shorter = lengthButton('◀︎', 'Shorter note');
  const longer = lengthButton('▶︎', 'Longer note');
  let held = null; // { track, step, start, end }: the note held, and where it was held

  const rowOf = () => beat().rows[held.track];
  const endOf = () => noteEnd(rowOf(), held.start);

  function grab({ track, step }) {
    const start = noteStart(beat().rows[track], step);
    held = { track, step, start, end: noteEnd(beat().rows[track], start) };
  }

  function setEnd(end) {
    const next = holdTo(rowOf(), held.start, end);
    if (next === rowOf()) return false;
    edit(withRow(beat(), held.track, next));
    return true;
  }

  function hear() {
    preview(held.track, rowOf(), held.start);
  }

  function showLength() {
    const end = endOf();
    shorter.setAttribute('aria-disabled', String(end === held.start));
    longer.setAttribute('aria-disabled', String(end >= stretchLimit(rowOf(), held.start)));
  }

  function step(by) {
    if (!setEnd(endOf() + by)) return;
    showLength();
    announce(lengthWords(endOf() - held.start + 1));
    hear();
  }

  function stretchBy(track, at, by) {
    const row = beat().rows[track];
    const start = noteStart(row, at);
    if (start < 0 && by < 0) return;
    const from = start < 0 ? at : start;
    const end = start < 0 ? at : noteEnd(row, start);
    const next = holdTo(row, from, end + by);
    if (next === row) return;
    commit(withRow(beat(), track, next));
    announce(lengthWords(noteEnd(next, from) - from + 1));
  }

  // Before the grid's own arrows, which move focus.
  function onKey(event) {
    const { track, step: at } = event.target.dataset;
    const by = event.shiftKey && (turned() ? BY_TURNED : BY)[event.key];
    if (!by || at === undefined) return;
    event.preventDefault();
    event.stopPropagation();
    stretchBy(Number(track), Number(at), by);
  }

  root.addEventListener('keydown', onKey, true);
  slot.append(shorter, longer);
  shorter.addEventListener('click', () => step(-1));
  longer.addEventListener('click', () => step(1));

  return {
    // The hold started: an empty square becomes a note, and it pops with its sound.
    hold(note) {
      const row = beat().rows[note.track];
      const empty = noteStart(row, note.step) < 0;
      if (empty) edit(withRow(beat(), note.track, holdTo(row, note.step, note.step)));
      grab(note);
      if (empty) hear();
    },
    // The held finger moved onto `note` (null off the squares).
    move(note) {
      if (held && note) setEnd(held.end + note.step - held.step);
    },
    // The finger came up after a slide: hear the note as it is now.
    slid() {
      if (held) hear();
    },
    // The note panel opens on `note`: ◀ ▶ go in its length slot.
    open(note) {
      grab(note);
      showLength();
      slot.hidden = false;
    },
    // Where the note panel keeps clear of: the held square and the next steps the bar grows into.
    room(note) {
      const far = Math.min(endOf() + NEAR, stretchLimit(rowOf(), held.start));
      const end = root.querySelector(`.pad[data-track="${held.track}"][data-step="${far}"]`);
      return union(note.pad.getBoundingClientRect(), end.getBoundingClientRect());
    },
  };
}
