// The beat grid: a name button and 16 to 64 pads for each of 8 to 12 rows, in one long strip.
// Wide screens put the rows across; upright screens turn it (CSS sets --turned).
// Each row plays its own sound (task 84), so its name and its pads' names come from the beat.

import { BAR, isOn, liftAt, stepCount, trackCount } from './pattern.js';
import { TUNED, soundById } from './sounds.js';
import { liftMark, liftWords } from './note.js';
import { el } from './dom.js';

const MOVES = { ArrowRight: [0, 1], ArrowLeft: [0, -1], ArrowDown: [1, 0], ArrowUp: [-1, 0] };
// Shift+↑ and Shift+↓ move a note higher or lower, in either orientation (the key slider's keys).
const LIFTS = { ArrowUp: 1, ArrowDown: -1 };

function place(node, track, step) {
  node.style.setProperty('--r', track + 1);
  node.style.setProperty('--c', step + 2);
  node.style.setProperty('--tr', step + 2);
  node.style.setProperty('--tc', track + 1);
  node.style.setProperty('--color', `var(--c${track})`);
}

function hidden(node) {
  node.setAttribute('aria-hidden', 'true');
  return node;
}

// A row's name: a tap opens "Sound for row N" (main.js); the ▾ says it opens something.
function nameButton(track) {
  const button = el('button', 'sound');
  button.type = 'button';
  button.dataset.track = track;
  button.setAttribute('aria-haspopup', 'dialog');
  button.append(hidden(el('span', 'ico')), el('span', 'lbl'), hidden(el('span', 'pick', '▾')));
  place(button, track, -1);
  return button;
}

function pad(track, step) {
  const button = el('button', step % 8 < 4 ? 'pad' : 'pad alt');
  button.classList.toggle('bar-start', step > 0 && step % BAR === 0);
  button.type = 'button';
  button.dataset.track = track;
  button.dataset.step = step;
  button.tabIndex = track === 0 && step === 0 ? 0 : -1;
  button.setAttribute('aria-pressed', 'false');
  place(button, track, step);
  return button;
}

function trackPads(track, steps) {
  return Array.from({ length: steps }, (_, step) => pad(track, step));
}

// "Bass, step 5", and ", 2 higher" when the key slider moved it.
export function padLabel(sound, step, lift) {
  return `${sound.label}, step ${step + 1}${lift ? `, ${liftWords(lift)}` : ''}`;
}

function clamp(value, max) {
  return Math.min(max, Math.max(0, value));
}

export function createGrid(root, { onToggle, onSound, onLift }) {
  let names = [];
  let pads = [];
  let length = 0;
  let nowStep = -1;

  // A new length or number of rows means new pads; CSS sizes the strip from --steps, --pages and --tracks.
  function build(tracks, steps) {
    names = Array.from({ length: tracks }, (_, track) => nameButton(track));
    pads = names.map((_, track) => trackPads(track, steps));
    root.replaceChildren(...names.flatMap((name, track) => [name, ...pads[track]]));
    root.style.setProperty('--steps', steps);
    root.style.setProperty('--pages', steps / BAR);
    root.style.setProperty('--tracks', tracks);
    length = steps;
    nowStep = -1;
  }

  const turned = () => getComputedStyle(root).getPropertyValue('--turned').trim() === '1';

  function focusPad(track, step) {
    const target = pads[clamp(track, pads.length - 1)][clamp(step, length - 1)];
    root.querySelector('.pad[tabindex="0"]').tabIndex = -1;
    target.tabIndex = 0;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function onKey(event) {
    const { track, step } = event.target.dataset;
    const move = MOVES[event.key];
    if (!move || step === undefined) return;
    event.preventDefault();
    if (event.shiftKey && LIFTS[event.key]) return onLift(Number(track), Number(step), LIFTS[event.key]);
    const [dTrack, dStep] = turned() ? [move[1], move[0]] : move;
    focusPad(Number(track) + dTrack, Number(step) + dStep);
  }

  function onClick(event) {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.classList.contains('sound')) return onSound(Number(button.dataset.track));
    onToggle(Number(button.dataset.track), Number(button.dataset.step));
  }

  function renderName(track, sound) {
    const name = names[track];
    name.querySelector('.ico').textContent = sound.emoji;
    name.querySelector('.lbl').textContent = sound.label;
    name.setAttribute('aria-label', `${sound.label} sound`);
  }

  function renderTrack(beat, track) {
    const sound = soundById(beat.sounds[track]);
    const tuned = TUNED.has(sound.id);
    renderName(track, sound);
    pads[track].forEach((button, step) => {
      const on = isOn(beat, track, step);
      const lift = on ? liftAt(beat, track, step) : 0;
      button.setAttribute('aria-pressed', String(on));
      button.setAttribute('aria-label', padLabel(sound, step, lift));
      button.classList.toggle('on', on);
      button.classList.toggle('tuned', tuned);
      button.dataset.lift = liftMark(lift);
    });
  }

  function markStep(step, on) {
    if (step < 0 || step >= length) return;
    pads.forEach((row) => row[step].classList.toggle('now', on));
  }

  root.addEventListener('keydown', onKey);
  root.addEventListener('click', onClick);

  return {
    render(beat) {
      if (stepCount(beat) !== length || trackCount(beat) !== pads.length) build(trackCount(beat), stepCount(beat));
      pads.forEach((_, track) => renderTrack(beat, track));
    },
    setNow(step) {
      markStep(nowStep, false);
      markStep(step, true);
      nowStep = step;
    },
    turned,
    stepPad(step) {
      return pads[0][Math.min(step, length - 1)];
    },
    nameButton(track) {
      return names[track];
    },
  };
}
