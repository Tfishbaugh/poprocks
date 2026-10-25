// Runs in the page, like audio-lab.js: held notes (task 84) rendered offline through the real
// engine and the real hold player, step by step as the scheduler plays them.

import { render } from './audio-lab.js';
import { createHoldPlayer } from '../../js/holds.js';

const RATE = 44100;
export const START = 0.05;

function playRow(engine, row, id, stepTime) {
  const player = createHoldPlayer(engine);
  [...row].forEach((_, step) => player.step(row, 0, id, step, START + step * stepTime));
  player.releaseAll(START + row.length * stepTime); // the loop's end
}

function slice(data, from, to) {
  return data.subarray(Math.round(from * RATE), Math.round(to * RATE));
}

const db = (x) => 20 * Math.log10(Math.max(x, 1e-6));
const rms = (part) => Math.sqrt(part.reduce((sum, x) => sum + x * x, 0) / part.length);
const peak = (part) => part.reduce((max, x) => Math.max(max, Math.abs(x)), 0);

// One row of one sound played once at `bpm`; returns each window's [rms, peak] in dBFS.
export async function levels(id, row, bpm, windows) {
  const stepTime = 60 / bpm / 4;
  const data = await render((engine) => playRow(engine, row, id, stepTime), START + row.length * stepTime + 0.6);
  return windows.map(([from, to]) => [db(rms(slice(data, from, to))), db(peak(slice(data, from, to)))]);
}

// How long one row of one sound lasts at `bpm`: from its first step to the end of its last
// 10 ms slice above `floor` dBFS.
export async function lasts(id, row, bpm, floor = -40) {
  const stepTime = 60 / bpm / 4;
  const data = await render((engine) => playRow(engine, row, id, stepTime), START + row.length * stepTime + 2);
  const size = Math.round(RATE * 0.01);
  const loud = (i) => db(rms(data.subarray(i * size, (i + 1) * size))) > floor;
  const slices = Array.from({ length: Math.floor(data.length / size) }, (_, i) => i);
  const last = slices.filter(loud).at(-1) ?? 0;
  return (last + 1) * 0.01 - START;
}

// A sound's one-shot hit, as the kits are balanced on (sounds.js GAINS): its level over `seconds`.
export async function hitLevel(id, seconds = 0.4) {
  const data = await render((engine) => engine.play(id, START, 0), START + seconds + 0.1);
  return db(rms(slice(data, START, START + seconds)));
}
