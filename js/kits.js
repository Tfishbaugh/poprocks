// The Sounds picker: a big card for each kit. A tap puts the kit's sounds on every row at once
// and plays a little preview; the picker stays open so kids can try them all. With a mix of
// kits (task 84) no card is lit.

import { KITS, SAMPLES } from './sounds.js';
import { el } from './dom.js';

const names = (list) => `${list.slice(0, -1).join(', ')} and ${list.at(-1)}`;

// No links: the names are a thank-you, and LICENSES says where each sound came from.
export const CREDIT = `Guitar, crash and Hey! sounds by ${names(Object.values(SAMPLES))} (CC0, from Freesound).`;

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
    // `id` is null for a mix: no card is lit, and focus starts on the first.
    open(id) {
      mark(id);
      dialog.showModal();
      (cards.querySelector('[aria-pressed="true"]') ?? cards.firstChild).focus({ preventScroll: true });
    },
  };
}
