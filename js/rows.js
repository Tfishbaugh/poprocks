// ➕ Row and 🗑 Remove row (task 84, more rows): a beat has 8 to 12 rows.

import { KITS, kitById, soundById } from './sounds.js';
import { MAX_TRACKS } from './pattern.js';
import { el } from './dom.js';

// The kits, starting from the last row's kit and going round.
function kitsFrom(sounds) {
  const start = KITS.indexOf(kitById(soundById(sounds.at(-1)).kit));
  return KITS.map((_, i) => KITS[(start + i) % KITS.length]);
}

// Every kit's notes (its second line of 4) before any drums: a new row is most fun as a new tune.
function notesFirst(kits) {
  return [...kits.flatMap((kit) => kit.sounds.slice(4)), ...kits.flatMap((kit) => kit.sounds.slice(0, 4))];
}

// A new row's sound: the first one not on a row yet, so 4 more rows on a Party beat bring
// Rock's Chord, Chug, Bass and Riff.
export function newRowSound(sounds) {
  const order = notesFirst(kitsFrom(sounds));
  return (order.find((sound) => !sounds.includes(sound.id)) ?? order[0]).id;
}

// The ➕ Row cell after the last sound name: the next row, or upright, the next column.
// Its click stays its own, so the grid never reads it as a pad.
export function createAddRow(onAdd) {
  const button = el('button', 'add-row');
  button.type = 'button';
  button.setAttribute('aria-label', 'Add a row');
  button.append(el('span', 'ico', '➕'), el('span', 'lbl', 'Row'));
  button.firstChild.setAttribute('aria-hidden', 'true');
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    onAdd();
  });
  return button;
}

// grid.js rebuilds the grid's children, so main.js puts the cell back after each render.
export function placeAddRow(grid, button, tracks) {
  if (button.parentNode !== grid) grid.append(button);
  button.hidden = tracks >= MAX_TRACKS;
  button.style.setProperty('--r', tracks + 1);
  button.style.setProperty('--tc', tracks + 1);
}
