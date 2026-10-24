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
