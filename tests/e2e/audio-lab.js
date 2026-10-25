// Runs in the page: kits.spec.js imports it with page.evaluate. It renders sounds offline
// through the app's real engine (samples, limiter and all) and measures them.

import { KITS, createEngine } from '../../js/sounds.js';

const RATE = 44100;

async function render(play, seconds = 1.5) {
  const ctx = new OfflineAudioContext(1, Math.round(RATE * seconds), RATE);
  const engine = createEngine(ctx);
  await engine.load();
  play(engine);
  return (await ctx.startRendering()).getChannelData(0);
}

// The loudness filter of ITU-R BS.1770 (a high shelf and a low cut), close enough for tests.
async function kWeighted(data) {
  const ctx = new OfflineAudioContext(1, data.length, RATE);
  const buffer = ctx.createBuffer(1, data.length, RATE);
  buffer.copyToChannel(data, 0);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const shelf = Object.assign(ctx.createBiquadFilter(), { type: 'highshelf' });
  shelf.frequency.value = 1681;
  shelf.gain.value = 4;
  const low = Object.assign(ctx.createBiquadFilter(), { type: 'highpass' });
  low.frequency.value = 38;
  low.Q.value = 0.5;
  src.connect(shelf).connect(low).connect(ctx.destination);
  src.start();
  return (await ctx.startRendering()).getChannelData(0);
}

function prefixSquares(data) {
  const sums = new Float64Array(data.length + 1);
  for (let i = 0; i < data.length; i += 1) sums[i + 1] = sums[i] + data[i] * data[i];
  return sums;
}

// The loudest `seconds` of sound, in LUFS (with 0.4 s, BS.1770's "momentary loudness").
function momentary(data, seconds) {
  const sums = prefixSquares(data);
  const size = Math.round(RATE * seconds);
  let best = 1e-12;
  for (let start = 0; start + size <= data.length; start += RATE / 50) {
    best = Math.max(best, (sums[start + size] - sums[start]) / size);
  }
  return -0.691 + 10 * Math.log10(best);
}

function peak(data) {
  return data.reduce((max, x) => Math.max(max, Math.abs(x)), 0);
}

export async function loudness(id, step = 0, seconds = 0.4) {
  return momentary(await kWeighted(await render((engine) => engine.play(id, 0, step))), seconds);
}

const kitById = (id) => KITS.find((kit) => kit.id === id);

function playRow(engine, row, id, stepTime) {
  [...row].forEach((cell, step) => { if (cell === 'x') engine.play(id, step * stepTime, step); });
}

// A whole beat (rows as in pattern.js) played once in a kit, or with a sound id per row (a mix).
function renderBeat(kit, rows, bpm) {
  const ids = Array.isArray(kit) ? kit : kitById(kit).sounds.map((sound) => sound.id);
  const stepTime = 60 / bpm / 4;
  const play = (engine) => rows.forEach((row, track) => playRow(engine, row, ids[track], stepTime));
  return render(play, rows[0].length * stepTime + 0.5);
}

// Its loudness over the whole beat.
export async function beatLoudness(kitId, rows, bpm) {
  return momentary(await kWeighted(await renderBeat(kitId, rows, bpm)), (rows[0].length * 15) / bpm);
}

export async function peakOfBeat(kitId, rows, bpm) {
  return peak(await renderBeat(kitId, rows, bpm));
}

// Every sound of a kit hitting at once: the loudest moment a beat can have.
export async function peakOfAll(kitId, step) {
  const { sounds } = kitById(kitId);
  return peak(await render((engine) => sounds.forEach((sound) => engine.play(sound.id, 0, step))));
}

export async function samplesLoaded() {
  const ctx = new OfflineAudioContext(1, RATE, RATE);
  const engine = createEngine(ctx);
  await engine.load();
  return engine.loaded.sort();
}

// ---- Pitch (YIN) ----

function difference(data, start, size, lag) {
  let sum = 0;
  for (let i = 0; i < size; i += 1) {
    const d = data[start + i] - data[start + i + lag];
    sum += d * d;
  }
  return sum;
}

function normalized(diffs) {
  let total = 0;
  return diffs.map((d, lag) => {
    total += d;
    return lag === 0 ? 1 : (d * lag) / total;
  });
}

function firstDip(curve, threshold) {
  let lag = Math.floor(RATE / 1500);
  while (lag < curve.length - 1 && !(curve[lag] < threshold && curve[lag] <= curve[lag + 1])) lag += 1;
  return lag;
}

// The pitch at `at` seconds, in Hz (30 Hz to 1.5 kHz).
function yin(data, at) {
  const start = Math.round(at * RATE);
  const diffs = Array.from({ length: Math.ceil(RATE / 30) }, (_, lag) => difference(data, start, 4096, lag));
  const curve = normalized(diffs);
  const lag = firstDip(curve, 0.3);
  const [a, b, c] = [curve[lag - 1], curve[lag], curve[lag + 1]];
  return RATE / (lag + (a - c) / (2 * (a - 2 * b + c)));
}

// `lift`: how far the key slider moved the note (task 84).
export async function pitchOf(id, step, at = 0.15, lift = 0) {
  return yin(await render((engine) => engine.play(id, 0, step, lift), 0.6), at);
}
