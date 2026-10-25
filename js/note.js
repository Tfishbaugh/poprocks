// The note panel (task 84): press and hold a square, then lift, and it opens beside the note.
// Its ↕ key slider makes a tuned note up to 4 steps higher or lower along E minor.
// Held notes (PR 3) put ◀ ▶ in its #note-length slot. ✓ Done, a tap outside, Escape or Back closes it.

import { placeCard } from './tour.js';

export const LIFT_MAX = 4;

// What a screen reader hears for each spot: "2 higher", "1 lower", "as written".
export function liftWords(lift) {
  if (!lift) return 'as written';
  return `${Math.abs(lift)} ${lift > 0 ? 'higher' : 'lower'}`;
}

// What a square shows: ↑2, ↓1, or nothing.
export function liftMark(lift) {
  if (!lift) return '';
  return `${lift > 0 ? '↑' : '↓'}${Math.abs(lift)}`;
}

// open(note, { lift, tuned, label }): note is hold.js's { pad, track, step }. An untuned note
// (a drum) gets no slider; until held notes fill #note-length, main.js only opens it for tuned ones.
export function createNotePanel(dialog, { onLift, onClose }) {
  const slider = dialog.querySelector('#note-slider');
  const card = dialog.querySelector('.note-card');
  let note = null;

  function show(lift) {
    slider.value = String(lift);
    slider.setAttribute('aria-valuetext', liftWords(lift));
  }

  function place() {
    const view = { width: innerWidth, height: innerHeight };
    const box = note.box ?? note.pad.getBoundingClientRect(); // held notes: the steps a note grows into
    const { left, top } = placeCard(box, card.getBoundingClientRect(), view);
    dialog.style.left = `${left}px`;
    dialog.style.top = `${top}px`;
  }

  function onInput() {
    const lift = Number(slider.value);
    show(lift);
    onLift(note, lift);
  }

  // The dialog box itself is only hit outside the card: a tap there closes it.
  function onClick(event) {
    if (event.target === dialog || event.target.closest('#note-done')) dialog.close();
  }

  slider.addEventListener('input', onInput);
  dialog.addEventListener('click', onClick);
  dialog.addEventListener('close', () => {
    const was = note;
    note = null;
    onClose(was);
  });

  return {
    open(target, { lift = 0, tuned = true, label = '' } = {}) {
      note = target;
      dialog.querySelector('#note-title').textContent = label;
      dialog.querySelector('#note-pitch').hidden = !tuned;
      show(lift);
      dialog.showModal();
      place();
      (tuned ? slider : dialog.querySelector('#note-done')).focus({ preventScroll: true });
    },
    close() {
      if (dialog.open) dialog.close();
    },
    get note() {
      return note;
    },
  };
}
