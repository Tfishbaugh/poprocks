// Every sound is synthesized with Web Audio: no sample files.

export const SOUNDS = [
  { id: 'kick', emoji: '🥁', label: 'Kick' },
  { id: 'snare', emoji: '💥', label: 'Snare' },
  { id: 'clap', emoji: '👏', label: 'Clap' },
  { id: 'hat', emoji: '✨', label: 'Hat' },
  { id: 'cowbell', emoji: '🔔', label: 'Bell' },
  { id: 'bass', emoji: '🐘', label: 'Bass' },
  { id: 'laser', emoji: '👾', label: 'Laser' },
  { id: 'boing', emoji: '🦘', label: 'Boing' },
];

// The bass follows a little riff, so any pattern sounds like a tune (semitones above A1).
const BASS_RIFF = [0, 0, 12, 0, 3, 3, 7, 5, 0, 0, 12, 0, 7, 5, 3, 2];
const A1 = 55;

function envelope(v, time, peak, decay) {
  const gain = v.ctx.createGain();
  gain.gain.setValueAtTime(peak, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + decay);
  gain.connect(v.out);
  return gain;
}

function filter(v, type, frequency, dest, q = 1) {
  const node = v.ctx.createBiquadFilter();
  node.type = type;
  node.frequency.value = frequency;
  node.Q.value = q;
  node.connect(dest);
  return node;
}

function tone(v, type, frequency, time, length, dest) {
  const osc = v.ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, time);
  osc.connect(dest);
  osc.start(time);
  osc.stop(time + length);
  return osc;
}

function noise(v, time, length, dest) {
  const src = v.ctx.createBufferSource();
  src.buffer = v.noise;
  src.connect(dest);
  src.start(time);
  src.stop(time + length);
}

function kick(v, t) {
  const osc = tone(v, 'sine', 160, t, 0.5, envelope(v, t, 1, 0.45));
  osc.frequency.exponentialRampToValueAtTime(42, t + 0.14);
  noise(v, t, 0.01, filter(v, 'lowpass', 3000, envelope(v, t, 0.3, 0.01)));
}

function snare(v, t) {
  noise(v, t, 0.22, filter(v, 'highpass', 1200, envelope(v, t, 0.7, 0.2)));
  tone(v, 'triangle', 190, t, 0.12, envelope(v, t, 0.5, 0.1));
}

function clap(v, t) {
  const gain = v.ctx.createGain();
  gain.connect(v.out);
  [0, 0.012, 0.024].forEach((offset) => {
    gain.gain.setValueAtTime(0.9, t + offset);
    gain.gain.exponentialRampToValueAtTime(0.15, t + offset + 0.01);
  });
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
  noise(v, t, 0.24, filter(v, 'bandpass', 1300, gain, 0.8));
}

function hat(v, t) {
  noise(v, t, 0.06, filter(v, 'highpass', 7000, envelope(v, t, 0.4, 0.05)));
}

function cowbell(v, t) {
  const band = filter(v, 'bandpass', 800, envelope(v, t, 0.5, 0.35), 1.2);
  tone(v, 'square', 540, t, 0.36, band);
  tone(v, 'square', 800, t, 0.36, band);
}

function bass(v, t, step) {
  const low = filter(v, 'lowpass', 1400, envelope(v, t, 0.6, 0.28), 4);
  low.frequency.setValueAtTime(1400, t);
  low.frequency.exponentialRampToValueAtTime(220, t + 0.2);
  tone(v, 'sawtooth', A1 * 2 ** (BASS_RIFF[step % BASS_RIFF.length] / 12), t, 0.3, low);
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

const VOICES = { kick, snare, clap, hat, cowbell, bass, laser, boing };

function makeNoise(ctx) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  return buffer;
}

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

export function createEngine() {
  const AudioCtx = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  const ctx = new AudioCtx({ latencyHint: 'interactive' });
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.knee.value = 6;
  comp.ratio.value = 4;
  comp.attack.value = 0.003;
  comp.release.value = 0.15;
  const output = ctx.createGain();
  output.gain.value = 1.2;
  comp.connect(output);
  output.connect(ctx.destination);
  const v = { ctx, out: comp, noise: makeNoise(ctx) };

  return {
    ctx,
    output,
    play(id, time = ctx.currentTime, step = 0) {
      VOICES[id](v, Math.max(time, ctx.currentTime), step);
    },
    blip(time, frequency) {
      tone(v, 'sine', frequency, time, 0.2, envelope(v, time, 0.5, 0.18));
    },
    resume() {
      return ctx.state === 'running' ? Promise.resolve() : ctx.resume();
    },
  };
}
