// The sound kits. Most sounds are synthesized with Web Audio. Four short CC0 samples in sounds/
// (LICENSES lists each one) do what synthesis does badly: guitar, a crash cymbal and Hey!.
// In a kit, rows 1 to 4 are drums and 5 to 8 play notes; a kid can put any sound on any row (task 84).

export const KITS = [
  {
    id: 'party',
    emoji: '🎉',
    label: 'Party',
    sounds: [
      { id: 'kick', emoji: '🥁', label: 'Kick' },
      { id: 'snare', emoji: '💥', label: 'Snare' },
      { id: 'clap', emoji: '👏', label: 'Clap' },
      { id: 'hat', emoji: '✨', label: 'Hat' },
      { id: 'cowbell', emoji: '🔔', label: 'Bell' },
      { id: 'bass', emoji: '🐘', label: 'Bass' },
      { id: 'laser', emoji: '👾', label: 'Laser' },
      { id: 'boing', emoji: '🦘', label: 'Boing' },
    ],
    demo: ['x...x...', '....x...', '........', 'x.x.x.x.', '........', 'x..x....', '......x.', '.......x'],
  },
  {
    id: 'rock',
    emoji: '🎸',
    label: 'Rock',
    sounds: [
      { id: 'rock-kick', emoji: '🥁', label: 'Kick' },
      { id: 'rock-snare', emoji: '💥', label: 'Snare', gain: 0.8 },
      { id: 'tom', emoji: '🪘', label: 'Tom', gain: 0.25 },
      { id: 'crash', emoji: '💫', label: 'Crash', gain: 0.11 },
      { id: 'guitar', emoji: '🎸', label: 'Chord', gain: 0.2 },
      { id: 'chug', emoji: '🤘', label: 'Chug', gain: 2 },
      { id: 'rock-bass', emoji: '🐘', label: 'Bass' },
      { id: 'riff', emoji: '⚡', label: 'Riff', gain: 0.18 },
    ],
    demo: ['x.....x.', '....x...', '.......x', 'x.......', 'x.......', '..x.x...', 'x.....x.', '......x.'],
    starters: [
      { name: 'Stadium', bpm: 100, rows: [
        'x.....x.x.......', '....x.......x...', '................', 'x...............',
        'x.......x.......', '..x.x.x...x.x.x.', 'x.....x.x.....x.', '................'] },
      { name: 'Punk', bpm: 160, rows: [
        'x.......x.......', '....x.......x...', '................', 'x.x.x.x.x.x.x.x.',
        '................', 'x.x.x.x.x.x.x.x.', 'x.x.x.x.x.x.x.x.', '................'] },
      { name: 'Riff Rock', bpm: 110, rows: [
        'x.....x...x.....', '....x.......x...', '..............xx', 'x...............',
        '................', '................', 'x.....x...x.....', 'x..x..x.x..x.x..'] },
      { name: 'Big Finish', bpm: 90, rows: [
        'x.......x.......', '....x.......x...', '..........x.x.xx', 'x.......x.......',
        'x.......x.......', '................', 'x.......x.......', '....x.x.....x.x.'] },
    ],
  },
  {
    id: 'kpop',
    emoji: '💖',
    label: 'K-pop',
    sounds: [
      { id: 'kpop-kick', emoji: '🥁', label: 'Kick', gain: 1.8 },
      { id: 'kpop-clap', emoji: '👏', label: 'Clap', gain: 3.2 },
      { id: 'snap', emoji: '✌️', label: 'Snap', gain: 7 },
      { id: 'kpop-hat', emoji: '✨', label: 'Hat', gain: 1.2 },
      { id: '808', emoji: '🔊', label: '808', gain: 0.25 },
      { id: 'bell', emoji: '🔔', label: 'Bell', gain: 0.55 },
      { id: 'synth', emoji: '🎹', label: 'Chord', gain: 1.6 },
      { id: 'hey', emoji: '🙌', label: 'Hey!', gain: 0.35 },
    ],
    demo: ['x.....x.', '....x...', '..x.....', 'x.x.x.x.', 'x.....x.', '..x..x..', 'x...x...', '......x.'],
    starters: [
      { name: 'Idol', bpm: 120, rows: [
        'x...x...x...x...', '....x.......x...', '................', 'x.x.x.x.x.x.x.x.',
        'x.....x.x.......', '..x...x...x...x.', 'x..x..x.x..x..x.', '..............x.'] },
      { name: 'Trap Pop', bpm: 140, rows: [
        'x......x..x.....', '........x.......', '....x.......x...', 'x.xxx.x.x.xxx.xx',
        'x......x..x.....', '................', 'x.......x.......', '............x...'] },
      { name: 'Bubblegum', bpm: 110, rows: [
        'x...x...x...x...', '....x.......x...', '................', '..x...x...x...x.',
        'x.......x.......', 'x.x.x.x.x.x.x.x.', '....x.......x...', '...............x'] },
      { name: 'Finger Heart', bpm: 100, rows: [
        'x.......x.......', '................', '....x.......x...', 'x.x.x.x.x.x.x.x.',
        'x.......x.x.....', '..x...x...x...x.', 'x.......x.......', '................'] },
    ],
  },
];

// The samples and who made them. All are CC0 from Freesound; LICENSES has each file's source.
export const SAMPLES = { chord: 'deleted_user_5959249', riff: 'gusgus26', crash: 'JoMungus', hey: 'khenshom' };

export function kitById(id) {
  return KITS.find((kit) => kit.id === id) ?? KITS[0];
}

// ---- Mix and match (task 84): each row names its own sound ----

const ALL = new Map(KITS.flatMap((kit) => kit.sounds.map((sound) => [sound.id, { ...sound, kit: kit.id }])));

export const isSound = (id) => ALL.has(id);

// A sound with its kit's id. An unknown id is Party's Kick (slots.js replaces those on loading).
export function soundById(id) {
  return ALL.get(id) ?? ALL.get(KITS[0].sounds[0].id);
}

const kitIds = (kit) => kit.sounds.map((sound) => sound.id);

// The kit every row's sound comes from, or null for a mix (the Sounds button shows 🎨 Mix).
export function kitOf(ids) {
  const kit = soundById(ids[0]).kit;
  return ids.every((id) => soundById(id).kit === kit) ? kitById(kit) : null;
}

// 🎲's starter beats: a kit's own when the first 8 rows are exactly that kit (row 4 is a crash
// in Rock), otherwise pattern.js's STARTERS. Party has none of its own.
export function kitStarters(ids) {
  const kit = KITS.find((one) => kitIds(one).every((id, i) => ids[i] === id));
  return kit?.starters;
}

// ---- One key, one chord loop ----

// E minor. The chord moves every 8 steps through Em, C, G and D (semitones above E), so a
// 1-bar beat hears 2 chords and a 2-bar beat the whole loop. Tuned sounds play its notes.
const CHORDS = [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]];
const CHORD_STEPS = 8;
const E1 = 41.2;

export function chordAt(step) {
  return CHORDS[Math.floor(step / CHORD_STEPS) % CHORDS.length];
}

// `semis` moved by whole octaves into [low, low + 12), so each sound stays in its own range.
export function fit(semis, low) {
  return low + ((((semis - low) % 12) + 12) % 12);
}

// ---- The key slider (task 84): a note moved `lift` steps along E minor stays in the key ----

const SCALE = [0, 2, 3, 5, 7, 8, 10];
// A power chord adds the fifth, which is C# above F#, so power chords step over F#.
const POWER = [0, 3, 5, 7, 8, 10];
const mod = (n, m) => ((n % m) + m) % m;

export function along(ladder, semis, lift) {
  if (!lift) return semis;
  const index = ladder.indexOf(mod(semis, 12)) + lift;
  return (Math.floor(semis / 12) + Math.floor(index / ladder.length)) * 12 + ladder[mod(index, ladder.length)];
}

export const lifted = (semis, lift) => along(SCALE, semis, lift);

// One of the chord's notes at this step (0 root, 1 third, 2 fifth), in [low, low + 12),
// then moved by the key slider.
export function chordNote(step, index, low, lift = 0) {
  return lifted(fit(chordAt(step)[index], low), lift);
}

// A power chord's root: the chord's root, moved along the roots whose fifth stays in E minor.
export function powerRoot(step, lift = 0) {
  return along(POWER, fit(chordAt(step)[0], -4), lift);
}

const pitch = (octave, semis) => E1 * 2 ** (octave - 1 + semis / 12);
const rate = (semis) => 2 ** (semis / 12);

// ---- Held notes (task 84) ----

// A held note fades out over FADE when it ends. Held notes play again at every chord change
// (8 steps), so none rings past 2 s even at 60 BPM: CAP ends one anyway if the scheduler stalls.
export const FADE = 0.08;
export const CAP = 3;
// How loud a held note rings on, against its first hit. Chug's fuzz is a full-scale square wave,
// so it rings much lower to sit with the others (tests/e2e/holds.spec.js checks the balance).
const SUSTAIN = 0.15;
const SUSTAINS = new Map([['chug', 0.03]]);

function fadeOut(param, time) {
  param.setValueAtTime(1, time);
  param.linearRampToValueAtTime(0, time + FADE);
}

// Older Safari throws on a second stop(); the first one stands then.
function stopAt(source, time) {
  try {
    source.stop(time);
  } catch {
    // Already stopping by itself at the cap.
  }
}

// ---- Building blocks ----

// The bass follows a little riff, so any pattern sounds like a tune (semitones above A1).
const BASS_RIFF = [0, 0, 12, 0, 3, 3, 7, 5, 0, 0, 12, 0, 7, 5, 3, 2];
const A1 = 55;

function envelope(v, time, peak, decay) {
  const gain = v.ctx.createGain();
  gain.gain.setValueAtTime(peak, time);
  fall(v, gain.gain, peak, time, decay);
  gain.connect(v.out);
  return gain;
}

// A short note dies away. A held one settles to a steady level, and the engine's gate ends it.
function fall(v, param, peak, time, decay) {
  if (v.sustain) return param.setTargetAtTime(peak * v.sustain, time, decay / 3);
  param.exponentialRampToValueAtTime(0.001, time + decay);
}

function filter(v, type, frequency, dest, q = 1) {
  const node = v.ctx.createBiquadFilter();
  node.type = type;
  node.frequency.value = frequency;
  node.Q.value = q;
  node.connect(dest);
  return node;
}

function sweep(param, from, to, time, length) {
  param.setValueAtTime(from, time);
  param.exponentialRampToValueAtTime(to, time + length);
}

function tone(v, type, frequency, time, length, dest) {
  const osc = v.ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, time);
  osc.connect(dest);
  osc.start(time);
  osc.stop(time + (v.cap ?? length));
  v.sources?.push(osc);
  return osc;
}

function noise(v, time, length, dest) {
  const src = v.ctx.createBufferSource();
  src.buffer = v.noise;
  src.connect(dest);
  src.start(time);
  src.stop(time + length);
}

function drive(v, curve, dest) {
  const shaper = v.ctx.createWaveShaper();
  shaper.curve = curve;
  shaper.connect(dest);
  return shaper;
}

// A new hit in the same group fades out the last one, like a hand on a ringing string.
function choke(v, group, time) {
  v.chokes[group]?.gain.setTargetAtTime(0, time, 0.015);
  const gain = v.ctx.createGain();
  gain.connect(v.out);
  v.chokes[group] = gain;
  return gain;
}

// A sample, `semis` higher or lower. Until it has loaded (or if it can't), the row stays quiet.
function sample(v, name, time, semis = 0) {
  const loaded = v.samples[name];
  if (!loaded) return;
  const src = v.ctx.createBufferSource();
  src.buffer = loaded.buffer;
  src.playbackRate.value = rate(semis);
  src.connect(choke(v, name, time));
  src.start(time, loaded.offset);
  v.sources?.push(src);
  if (v.cap) src.stop(time + v.cap);
}

// ---- Party ----

function kick(v, t) {
  const osc = tone(v, 'sine', 160, t, 0.5, envelope(v, t, 1, 0.45));
  osc.frequency.exponentialRampToValueAtTime(42, t + 0.14);
  noise(v, t, 0.01, filter(v, 'lowpass', 3000, envelope(v, t, 0.3, 0.01)));
}

function snare(v, t) {
  noise(v, t, 0.22, filter(v, 'highpass', 1200, envelope(v, t, 0.7, 0.2)));
  tone(v, 'triangle', 190, t, 0.12, envelope(v, t, 0.5, 0.1));
}

function handClap(v, t, frequency, length) {
  const gain = v.ctx.createGain();
  gain.connect(v.out);
  [0, 0.012, 0.024].forEach((offset) => {
    gain.gain.setValueAtTime(0.9, t + offset);
    gain.gain.exponentialRampToValueAtTime(0.15, t + offset + 0.01);
  });
  gain.gain.exponentialRampToValueAtTime(0.001, t + length);
  noise(v, t, length + 0.02, filter(v, 'bandpass', frequency, gain, 0.8));
}

const clap = (v, t) => handClap(v, t, 1300, 0.22);

function hat(v, t) {
  noise(v, t, 0.06, filter(v, 'highpass', 7000, envelope(v, t, 0.4, 0.05)));
}

function cowbell(v, t) {
  const band = filter(v, 'bandpass', 800, envelope(v, t, 0.5, 0.35), 1.2);
  tone(v, 'square', 540, t, 0.36, band);
  tone(v, 'square', 800, t, 0.36, band);
}

// The riff's notes are in E minor; A is 5 semitones above E.
export const bassNote = (step, lift = 0) => lifted(5 + BASS_RIFF[step % BASS_RIFF.length], lift) - 5;

function bass(v, t, step, lift) {
  const low = filter(v, 'lowpass', 1400, envelope(v, t, 0.6, 0.28), 4);
  sweep(low.frequency, 1400, 220, t, 0.2);
  tone(v, 'sawtooth', A1 * 2 ** (bassNote(step, lift) / 12), t, 0.3, low);
}

function laser(v, t) {
  const osc = tone(v, 'square', 1800, t, 0.26, envelope(v, t, 0.22, 0.25));
  osc.frequency.exponentialRampToValueAtTime(110, t + 0.22);
}

function boing(v, t) {
  const osc = tone(v, 'sine', 150, t, 0.46, envelope(v, t, 0.6, 0.45));
  osc.frequency.exponentialRampToValueAtTime(420, t + 0.08);
  osc.frequency.exponentialRampToValueAtTime(240, t + 0.4);
  const depth = v.ctx.createGain();
  depth.gain.setValueAtTime(60, t);
  depth.gain.exponentialRampToValueAtTime(1, t + 0.4);
  depth.connect(osc.frequency);
  tone(v, 'sine', 22, t, 0.46, depth);
}

// ---- Rock ----

function rockKick(v, t) {
  const osc = tone(v, 'sine', 140, t, 0.5, envelope(v, t, 1, 0.42));
  osc.frequency.exponentialRampToValueAtTime(48, t + 0.09);
  noise(v, t, 0.02, filter(v, 'lowpass', 5000, envelope(v, t, 0.6, 0.02)));
}

function rockSnare(v, t) {
  noise(v, t, 0.3, filter(v, 'highpass', 900, envelope(v, t, 0.9, 0.28)));
  const body = tone(v, 'triangle', 230, t, 0.16, envelope(v, t, 0.7, 0.14));
  body.frequency.exponentialRampToValueAtTime(170, t + 0.1);
}

function tom(v, t) {
  const osc = tone(v, 'sine', 180, t, 0.5, envelope(v, t, 1, 0.45));
  osc.frequency.exponentialRampToValueAtTime(100, t + 0.35);
  noise(v, t, 0.03, filter(v, 'lowpass', 3000, envelope(v, t, 0.3, 0.03)));
}

const crash = (v, t) => sample(v, 'crash', t);

// The sample is an E2 power chord, moved to the chord's root.
const guitar = (v, t, step, lift) => sample(v, 'chord', t, powerRoot(step, lift));

// A palm-muted power chord: root and fifth, distorted, cut short.
function chug(v, t, step, lift) {
  const root = pitch(2, powerRoot(step, lift));
  const fuzz = drive(v, v.fuzz, filter(v, 'lowpass', 1800, envelope(v, t, 1, 0.13), 1.5));
  tone(v, 'sawtooth', root, t, 0.15, fuzz);
  tone(v, 'sawtooth', root * 1.5, t, 0.15, fuzz);
}

function rockBass(v, t, step, lift) {
  const low = filter(v, 'lowpass', 1000, envelope(v, t, 0.7, 0.3), 3);
  sweep(low.frequency, 1000, 260, t, 0.22);
  tone(v, 'sawtooth', pitch(1, chordNote(step, 0, -2, lift)), t, 0.32, low);
}

// Which chord note the riff plays on each step: root, root, fifth, root, third, fifth, third, fifth.
// The sample is an E3, so notes stay within a fifth of it.
const RIFF = [0, 0, 2, 0, 1, 2, 1, 2];
const riff = (v, t, step, lift) => sample(v, 'riff', t, chordNote(step, RIFF[step % RIFF.length], -5, lift));

// ---- K-pop ----

function kpopKick(v, t) {
  const osc = tone(v, 'sine', 220, t, 0.32, envelope(v, t, 1, 0.28));
  osc.frequency.exponentialRampToValueAtTime(52, t + 0.05);
  tone(v, 'square', 1500, t, 0.008, envelope(v, t, 0.25, 0.006));
}

const kpopClap = (v, t) => handClap(v, t, 1900, 0.3);

function snap(v, t) {
  noise(v, t, 0.06, filter(v, 'bandpass', 2800, envelope(v, t, 1, 0.05), 3));
  noise(v, t, 0.012, filter(v, 'highpass', 7000, envelope(v, t, 0.5, 0.01)));
}

function kpopHat(v, t) {
  noise(v, t, 0.04, filter(v, 'highpass', 9000, envelope(v, t, 0.5, 0.035)));
}

function eight08(v, t, step, lift) {
  const root = pitch(1, chordNote(step, 0, -2, lift));
  const osc = tone(v, 'sine', root * 1.5, t, 0.9, drive(v, v.warm, envelope(v, t, 0.8, 0.85)));
  osc.frequency.exponentialRampToValueAtTime(root, t + 0.04);
}

// A rolling arpeggio of the chord, as a glassy FM bell.
const ARPEGGIO = [0, 1, 2, 1];

function bell(v, t, step, lift) {
  const frequency = pitch(5, chordNote(step, ARPEGGIO[step % ARPEGGIO.length], -5, lift));
  const carrier = tone(v, 'sine', frequency, t, 0.9, envelope(v, t, 0.4, 0.8));
  const depth = v.ctx.createGain();
  sweep(depth.gain, frequency * 2, 1, t, 0.5);
  depth.connect(carrier.frequency);
  tone(v, 'sine', frequency * 3.5, t, 0.9, depth);
}

const DETUNE = [0.993, 1, 1.007];

function supersaw(v, frequency, t, dest) {
  DETUNE.forEach((detune) => tone(v, 'sawtooth', frequency * detune, t, 0.4, dest));
}

// The whole chord on three detuned saws a note: the big K-pop synth.
// Moved by the key slider, each note of the chord steps along E minor, so it stays in the key.
function synth(v, t, step, lift) {
  const low = filter(v, 'lowpass', 4000, envelope(v, t, 0.12, 0.36), 0.8);
  sweep(low.frequency, 4000, 1200, t, 0.3);
  chordAt(step).forEach((semis) => supersaw(v, pitch(4, lifted(fit(semis, -5), lift)), t, low));
}

const hey = (v, t) => sample(v, 'hey', t);

const VOICES = {
  kick, snare, clap, hat, cowbell, bass, laser, boing,
  'rock-kick': rockKick, 'rock-snare': rockSnare, tom, crash, guitar, chug, 'rock-bass': rockBass, riff,
  'kpop-kick': kpopKick, 'kpop-clap': kpopClap, snap, 'kpop-hat': kpopHat, 808: eight08, bell, synth, hey,
};

// The sounds that play notes of the chord loop (task 84): the key slider moves them, and held
// notes ring for their length. Every other sound is a drum or an effect.
export const TUNED = new Set(['guitar', 'synth', 'chug', 'bass', 'rock-bass', '808', 'riff', 'bell']);

// Each sound's level, so every kit is about as loud as Party (tests/e2e/kits.spec.js checks it).
const GAINS = new Map(KITS.flatMap((kit) => kit.sounds).map(({ id, gain = 1 }) => [id, gain]));

// ---- The engine ----

function makeNoise(ctx) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  return buffer;
}

const curve = (shape) => Float32Array.from({ length: 4097 }, (_, i) => shape(i / 2048 - 1));
const tanhCurve = (k) => curve((x) => Math.tanh(k * x) / Math.tanh(k));

// Up to 0.8 the signal passes untouched; louder peaks bend smoothly and never pass 0.95.
function softClip(x) {
  const size = Math.abs(x);
  if (size <= 0.8) return x;
  return Math.sign(x) * (0.8 + 0.19 * Math.tanh((size - 0.8) / 0.19));
}

function setParams(node, values) {
  Object.entries(values).forEach(([name, value]) => { node[name].value = value; });
  return node;
}

// Glue compressor, then a limiter, then a soft clip: the beat can't distort however many rows play.
function createBus(ctx) {
  const comp = setParams(ctx.createDynamicsCompressor(), { threshold: -16, knee: 6, ratio: 4, attack: 0.003, release: 0.15 });
  const makeup = setParams(ctx.createGain(), { gain: 1.2 });
  const limiter = setParams(ctx.createDynamicsCompressor(), { threshold: -3, knee: 0, ratio: 20, attack: 0.002, release: 0.1 });
  const clip = ctx.createWaveShaper();
  clip.curve = curve(softClip);
  comp.connect(makeup);
  makeup.connect(limiter);
  limiter.connect(clip);
  clip.connect(ctx.destination);
  return { input: comp, output: clip };
}

// MP3s start with a little padding; each sample starts at its first sound instead.
function firstSound(buffer) {
  const start = buffer.getChannelData(0).findIndex((x) => Math.abs(x) > 0.01);
  return Math.max(0, start) / buffer.sampleRate;
}

async function loadSample(ctx, name) {
  const response = await fetch(new URL(`../sounds/${name}.mp3`, import.meta.url));
  if (!response.ok) throw new Error(`${name}.mp3: ${response.status}`);
  const buffer = await ctx.decodeAudioData(await response.arrayBuffer());
  return { buffer, offset: firstSound(buffer) };
}

const DEMO_STEP = 0.12;

function rowNotes(row, id) {
  return [...row].flatMap((cell, step) => (cell === 'x' ? [{ id, step }] : []));
}

const demoNotes = (kit) => kit.demo.flatMap((row, track) => rowNotes(row, kit.sounds[track].id));

// iOS: 'playback' makes the beat play with the mute switch on.
export function setAudioSession(type) {
  try {
    if (navigator.audioSession) navigator.audioSession.type = type;
  } catch {
    // Older Safari has no audio session API; nothing to do.
  }
}

export function audioSupported() {
  return Boolean(globalThis.AudioContext ?? globalThis.webkitAudioContext);
}

function newContext() {
  const AudioCtx = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  return new AudioCtx({ latencyHint: 'interactive' });
}

// `ctx` is for tests, which render sounds offline.
export function createEngine(ctx = newContext()) {
  const bus = createBus(ctx);
  const v = { ctx, noise: makeNoise(ctx), fuzz: tanhCurve(5), warm: tanhCurve(1.5), samples: {}, chokes: {} };
  let demo = null;
  let loading = null;

  function hit(id, time, step, dest, lift = 0, held = {}) {
    const trim = setParams(ctx.createGain(), { gain: GAINS.get(id) });
    trim.connect(dest);
    VOICES[id]({ ...v, ...held, out: trim }, Math.max(time, ctx.currentTime), step, lift);
  }

  function fetchSamples() {
    const missing = Object.keys(SAMPLES).filter((name) => !v.samples[name]);
    const store = (name) => loadSample(ctx, name).then((loaded) => { v.samples[name] = loaded; }, () => {});
    return Promise.all(missing.map(store));
  }

  return {
    ctx,
    output: bus.output,
    // `lift`: how far the key slider moved the note (tuned sounds only; task 84).
    play(id, time = ctx.currentTime, step = 0, lift = 0, dest = bus.input) {
      hit(id, time, step, dest, lift);
    },
    // A held note (task 84): it rings until release(time) fades it out on the audio clock,
    // or until CAP if that never comes.
    hold(id, time = ctx.currentTime, step = 0, lift = 0, dest = bus.input) {
      const start = Math.max(time, ctx.currentTime);
      const gate = ctx.createGain();
      const sources = [];
      gate.connect(dest);
      fadeOut(gate.gain, start + CAP);
      hit(id, start, step, gate, lift, { sustain: SUSTAINS.get(id) ?? SUSTAIN, cap: CAP + FADE, sources });
      return {
        release(off) {
          const end = Math.max(off, ctx.currentTime);
          if (end >= start + CAP) return;
          gate.gain.cancelScheduledValues(end);
          fadeOut(gate.gain, end);
          sources.forEach((source) => stopAt(source, end + FADE));
        },
      };
    },
    // A way into the mix for sounds that may be cut short together: `dest` for play and hold.
    channel() {
      const gain = ctx.createGain();
      gain.connect(bus.input);
      return gain;
    },
    // A short groove in a kit's sounds. Starting another fades this one out.
    preview(kitId) {
      demo?.gain.setTargetAtTime(0, ctx.currentTime, 0.02);
      demo = setParams(ctx.createGain(), { gain: 1 });
      demo.connect(bus.input);
      const start = ctx.currentTime + 0.05;
      demoNotes(kitById(kitId)).forEach(({ id, step }) => hit(id, start + step * DEMO_STEP, step, demo));
    },
    // Fetches the samples that aren't loaded yet; one that fails is tried again next time.
    load() {
      loading ??= fetchSamples().finally(() => { loading = null; });
      return loading;
    },
    get loaded() {
      return Object.keys(v.samples);
    },
    blip(time, frequency) {
      tone({ ...v, out: bus.input }, 'sine', frequency, time, 0.2, envelope({ ...v, out: bus.input }, time, 0.5, 0.18));
    },
    resume() {
      return ctx.state === 'running' ? Promise.resolve() : ctx.resume();
    },
  };
}
