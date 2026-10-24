// The Sounds picker: a big card for each kit. A tap switches the beat's sounds at once and
// plays a little preview; the picker stays open so kids can try them all.

import { KITS, SAMPLES } from './sounds.js';

const names = (list) => `${list.slice(0, -1).join(', ')} and ${list.at(-1)}`;

// No links: the names are a thank-you, and LICENSES says where each sound came from.
export const CREDIT = `Guitar, crash and Hey! sounds by ${names(Object.values(SAMPLES))} (CC0, from Freesound).`;

function el(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text) node.textContent = text;
  return node;
}

function hidden(node) {
  node.setAttribute('aria-hidden', 'true');
  return node;
}

function card(kit) {
  const button = el('button', 'kit-card');
  button.type = 'button';
  button.dataset.kit = kit.id;
  button.setAttribute('aria-pressed', 'false');
  const preview = hidden(el('span', 'kit-sounds', kit.sounds.map((sound) => sound.emoji).join(' ')));
  button.append(hidden(el('span', 'ico', kit.emoji)), el('span', 'lbl', kit.label), preview);
  return button;
}

export function createKitPicker(dialog, { onPick, onClose }) {
  const cards = dialog.querySelector('.kit-cards');
  cards.replaceChildren(...KITS.map(card));
  dialog.querySelector('.kit-credit').textContent = CREDIT;

  function mark(id) {
    cards.querySelectorAll('.kit-card').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.kit === id));
    });
  }

  // The dialog box itself is only hit outside the card: a tap on the dimmed backdrop closes it.
  function onClick(event) {
    if (event.target === dialog || event.target.closest('.kits-close')) return dialog.close();
    const button = event.target.closest('.kit-card');
    if (!button) return;
    mark(button.dataset.kit);
    onPick(button.dataset.kit);
  }

  dialog.addEventListener('click', onClick);
  dialog.addEventListener('close', onClose);

  return {
    open(id) {
      mark(id);
      dialog.showModal();
      cards.querySelector('[aria-pressed="true"]')?.focus({ preventScroll: true });
    },
    close() {
      dialog.close();
    },
    get isOpen() {
      return dialog.open;
    },
  };
}

function labelSounds(root, sounds) {
  root.querySelectorAll('.sound').forEach((button) => {
    const sound = sounds[button.dataset.track];
    button.querySelector('.ico').textContent = sound.emoji;
    button.querySelector('.lbl').textContent = sound.label;
    button.setAttribute('aria-label', `${sound.label} sound`);
  });
}

// A pad is named like "Kick, step 3": only the part before the comma changes.
function labelPads(root, sounds) {
  root.querySelectorAll('.pad').forEach((pad) => {
    const name = pad.getAttribute('aria-label');
    pad.setAttribute('aria-label', sounds[pad.dataset.track].label + name.slice(name.indexOf(',')));
  });
}

// Puts a kit's pictures and names on the grid that's already there.
export function labelGrid(root, sounds) {
  labelSounds(root, sounds);
  labelPads(root, sounds);
}
