// "Sound for row N" (task 84): tap a row's name and pick any sound for that row, from every kit.
// A tap puts the sound on the row and plays it; the sheet stays open to try more.
// ✕, Back, Escape or a tap outside closes it. #row-extra holds 🗑 Remove row (more rows, task 84).

import { KITS } from './sounds.js';
import { CREDIT } from './kits.js';
import { el } from './dom.js';

function tile(sound) {
  const button = el('button', 'btn row-sound');
  button.type = 'button';
  button.dataset.sound = sound.id;
  button.setAttribute('aria-pressed', 'false');
  button.append(el('span', 'ico', sound.emoji), el('span', 'lbl', sound.label));
  button.firstChild.setAttribute('aria-hidden', 'true');
  return button;
}

// One kit: its name, then its 8 sounds in 2 lines of 4 (drums, then notes).
function group(kit) {
  const box = el('div', 'row-kit');
  box.setAttribute('role', 'group');
  box.setAttribute('aria-label', `${kit.label} sounds`);
  box.append(el('h3', 'row-kit-name', `${kit.emoji} ${kit.label}`), ...kit.sounds.map(tile));
  return box;
}

export function createRowPicker(dialog, { onPick, onClose }) {
  const list = dialog.querySelector('.row-kits');
  list.replaceChildren(...KITS.map(group));
  dialog.querySelector('.kit-credit').textContent = CREDIT;
  let track = -1;

  function mark(id) {
    list.querySelectorAll('.row-sound').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.sound === id));
    });
  }

  function onClick(event) {
    if (event.target === dialog || event.target.closest('.row-close')) return dialog.close();
    const button = event.target.closest('.row-sound');
    if (!button) return;
    mark(button.dataset.sound);
    onPick(track, button.dataset.sound);
  }

  dialog.addEventListener('click', onClick);
  dialog.addEventListener('close', () => onClose(track));

  return {
    open(row, id) {
      track = row;
      dialog.querySelector('#row-title').textContent = `Sound for row ${row + 1}`;
      mark(id);
      dialog.showModal();
      list.querySelector('[aria-pressed="true"]')?.focus({ preventScroll: true });
    },
    get track() {
      return track;
    },
  };
}
