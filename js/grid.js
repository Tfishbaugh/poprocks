// The beat grid: one sound button and 16 to 64 pads per sound, in one long strip.
// Wide screens put sounds in rows; upright screens turn it (CSS sets --turned).

import { SOUNDS } from './sounds.js';
import { BAR, isOn, stepCount } from './pattern.js';
import { el } from './dom.js';
import { showHold } from './holds.js';

const MOVES = { ArrowRight: [0, 1], ArrowLeft: [0, -1], ArrowDown: [1, 0], ArrowUp: [-1, 0] };

function place(node, track, step) {
  node.style.setProperty('--r', track + 1);
  node.style.setProperty('--c', step + 2);
  node.style.setProperty('--tr', step + 2);
  node.style.setProperty('--tc', track + 1);
  node.style.setProperty('--color', `var(--c${track})`);
}

function soundButton(sound, track) {
  const button = el('button', 'sound');
  button.type = 'button';
  button.dataset.track = track;
  button.setAttribute('aria-label', `${sound.label} sound`);
  button.append(el('span', 'ico', sound.emoji), el('span', 'lbl', sound.label));
  button.firstChild.setAttribute('aria-hidden', 'true');
  place(button, track, -1);
  return button;
}

function pad(sound, track, step) {
  const button = el('button', step % 8 < 4 ? 'pad' : 'pad alt');
  button.classList.toggle('bar-start', step > 0 && step % BAR === 0);
  button.type = 'button';
  button.dataset.track = track;
  button.dataset.step = step;
  button.tabIndex = track === 0 && step === 0 ? 0 : -1;
  button.setAttribute('aria-pressed', 'false');
  button.setAttribute('aria-label', `${sound.label}, step ${step + 1}`);
  place(button, track, step);
  return button;
}

function trackPads(sound, track, steps) {
  return Array.from({ length: steps }, (_, step) => pad(sound, track, step));
}

function gridChildren(pads) {
  return SOUNDS.flatMap((sound, track) => [soundButton(sound, track), ...pads[track]]);
}

function clamp(value, max) {
  return Math.min(max, Math.max(0, value));
}

export function createGrid(root, { onToggle, onSound }) {
  let pads = [];
  let length = 0;
  let nowStep = -1;

  // A new length means new pads; CSS sizes the strip from --steps and --pages.
  function build(steps) {
    pads = SOUNDS.map((sound, track) => trackPads(sound, track, steps));
    root.replaceChildren(...gridChildren(pads));
    root.style.setProperty('--steps', steps);
    root.style.setProperty('--pages', steps / BAR);
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
    const move = MOVES[event.key];
    const { track, step } = event.target.dataset;
    if (!move || step === undefined) return;
    event.preventDefault();
    const [dTrack, dStep] = turned() ? [move[1], move[0]] : move;
    focusPad(Number(track) + dTrack, Number(step) + dStep);
  }

  function onClick(event) {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.classList.contains('sound')) return onSound(Number(button.dataset.track));
    onToggle(Number(button.dataset.track), Number(button.dataset.step));
  }

  function renderTrack(beat, track) {
    pads[track].forEach((button, step) => {
      const on = isOn(beat, track, step);
      button.setAttribute('aria-pressed', String(on));
      button.classList.toggle('on', on);
      showHold(button, beat.rows[track], step); // held notes (task 84)
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
      if (stepCount(beat) !== length) build(stepCount(beat));
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
  };
}
