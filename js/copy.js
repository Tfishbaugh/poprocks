// 📋 Copy: a whole beat onto another beat number, or one sound's row onto another sound.
// Copying a sound takes two taps: the sound to copy, then the sound it goes onto.

import { isEmpty } from './pattern.js';
import { button, el } from './dom.js';

function drawRow(ctx, row, track, color) {
  const width = ctx.canvas.width / row.length;
  ctx.fillStyle = color;
  [...row].forEach((cell, step) => {
    if (cell === 'x') ctx.fillRect(step * width, track * 4, Math.max(1, width - 0.5), 3);
  });
}

// A tiny picture of a beat: one line of dots per sound, in the sound's colour.
// CSS keeps it 64 × 32; 9 to 12 rows draw a taller canvas into the same box (task 84).
function miniPattern(beat) {
  const canvas = el('canvas', 'mini');
  canvas.width = 64;
  canvas.height = beat.rows.length * 4;
  canvas.setAttribute('aria-hidden', 'true');
  const ctx = canvas.getContext('2d');
  const styles = getComputedStyle(document.documentElement);
  beat.rows.forEach((row, track) => drawRow(ctx, row, track, styles.getPropertyValue(`--c${track}`)));
  return canvas;
}

function slotButton(beat, slot) {
  const empty = isEmpty(beat);
  const node = button('copy-slot', `Copy to beat ${slot + 1}${empty ? ', empty' : ', its beat gets replaced'}`);
  node.dataset.slot = slot;
  node.append(el('span', 'num', String(slot + 1)), empty ? el('span', 'lbl', 'Empty') : miniPattern(beat));
  return node;
}

function soundButton(sound, track) {
  const node = button('copy-sound', sound.label);
  node.dataset.track = track;
  node.setAttribute('aria-pressed', 'false');
  node.append(el('span', 'ico', sound.emoji), el('span', 'lbl', sound.label));
  node.firstChild.setAttribute('aria-hidden', 'true');
  node.style.setProperty('--color', `var(--c${track})`);
  return node;
}

export function createCopySheet({ root, slotsBox, soundsBox, rowTitle, slots, current, sounds, onCopyBeat, onCopyRow, onToggle }) {
  let from = -1;

  function showSlots() {
    const others = slots().map((beat, slot) => ({ beat, slot })).filter(({ slot }) => slot !== current());
    slotsBox.replaceChildren(...others.map(({ beat, slot }) => slotButton(beat, slot)));
  }

  function pick(track) {
    from = track;
    const name = sounds()[track]?.label;
    rowTitle.textContent = track < 0 ? 'Copy a sound' : `👉 Now tap where ${name} goes`;
    rowTitle.classList.toggle('now', track >= 0);
    soundsBox.classList.toggle('picking', track >= 0);
    soundsBox.querySelectorAll('.copy-sound').forEach((node) => {
      node.setAttribute('aria-pressed', String(Number(node.dataset.track) === track));
    });
  }

  function close() {
    if (root.hidden) return;
    root.hidden = true;
    onToggle(false);
  }

  function onSlot(event) {
    const node = event.target.closest('.copy-slot');
    if (!node) return;
    close();
    onCopyBeat(Number(node.dataset.slot));
  }

  function onSound(event) {
    const node = event.target.closest('.copy-sound');
    if (!node) return;
    const track = Number(node.dataset.track);
    if (from < 0 || from === track) return pick(from === track ? -1 : track);
    close();
    onCopyRow(from, track);
  }

  slotsBox.addEventListener('click', onSlot);
  soundsBox.addEventListener('click', onSound);
  root.addEventListener('click', (event) => { if (event.target === root) close(); });

  return {
    open() {
      showSlots();
      soundsBox.replaceChildren(...sounds().map((sound, track) => soundButton(sound, track)));
      pick(-1);
      root.hidden = false;
      onToggle(true);
      slotsBox.querySelector('button')?.focus({ preventScroll: true });
    },
    close,
    get isOpen() {
      return !root.hidden;
    },
  };
}
