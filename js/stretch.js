// Stretching held notes on the grid (task 84). Keys: Shift+→ holds the focused note one step
// longer and Shift+← one step shorter (Shift+↓ and Shift+↑ too on an upright screen, where
// steps run down). On an empty square, Shift+→ starts a 2-step note there.

import { holdTo, noteEnd, noteStart } from './holds.js';

const BY = { ArrowRight: 1, ArrowLeft: -1 };
const BY_TURNED = { ...BY, ArrowDown: 1, ArrowUp: -1 };

function withRow(beat, track, row) {
  return { ...beat, rows: beat.rows.map((old, i) => (i === track ? row : old)) };
}

export function createStretch({ root, turned, beat, commit, announce }) {
  function stretchBy(track, step, by) {
    const row = beat().rows[track];
    const start = noteStart(row, step);
    if (start < 0 && by < 0) return;
    const from = start < 0 ? step : start;
    const end = start < 0 ? step : noteEnd(row, start);
    const next = holdTo(row, from, end + by);
    if (next === row) return;
    commit(withRow(beat(), track, next));
    const steps = noteEnd(next, from) - from + 1;
    announce(steps > 1 ? `Held for ${steps} steps.` : 'Not held.');
  }

  // Before the grid's own arrows, which move focus.
  function onKey(event) {
    const { track, step } = event.target.dataset;
    const by = event.shiftKey && (turned() ? BY_TURNED : BY)[event.key];
    if (!by || step === undefined) return;
    event.preventDefault();
    event.stopPropagation();
    stretchBy(Number(track), Number(step), by);
  }

  root.addEventListener('keydown', onKey, true);
}
