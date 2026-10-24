// Video effects on Watch: a color filter (a WebGL shader) and stickers a kid places and moves.
// ✅ Use it plays the original through the effect into a canvas and records that, with the
// video's own sound, into a new video. The original is always kept, so effects never stack.

import { startRecorder } from './recorder.js';
import { button, el } from './dom.js';

export const FILTERS = [
  { id: 'none', label: 'None' },
  { id: 'gray', label: 'Gray' },
  { id: 'rainbow', label: 'Rainbow' },
  { id: 'neon', label: 'Neon' },
  { id: 'mirror', label: 'Mirror' },
  { id: 'comic', label: 'Comic' },
];

// Drawn for this app on a 100 × 100 box: [fill, SVG path] parts, inked and edged in white.
export const STICKERS = [
  { id: 'star', label: 'Star', parts: [['#FFD24D', 'M50 7 L61.2 37.6 L93.7 38.8 L68.1 58.9 L77 90.2 L50 72 L23 90.2 L31.9 58.9 L6.3 38.8 L38.8 37.6 Z']] },
  {
    id: 'heart',
    label: 'Heart',
    parts: [
      ['#FF4F8B', 'M50 88 C22 68 6 52 6 33 C6 19 17 9 30 9 C39 9 46 14 50 22 C54 14 61 9 70 9 C83 9 94 19 94 33 C94 52 78 68 50 88 Z'],
      ['#FFFFFF', 'M20 32 C20 25 25 20 31 20 C28 23 26 27 25 32 Z'],
    ],
  },
  {
    id: 'shades',
    label: 'Shades',
    parts: [
      ['#2A2140', 'M4 34 H96 V42 H92 V46 C92 58 84 66 73 66 C62 66 54 58 54 46 V44 H46 V46 C46 58 38 66 27 66 C16 66 8 58 8 46 V42 H4 Z'],
      ['#FFFFFF', 'M14 46 H24 L17 56 Z M60 46 H70 L63 56 Z'],
    ],
  },
  {
    id: 'crown',
    label: 'Crown',
    parts: [
      ['#FFC83D', 'M10 80 L14 30 L32 50 L50 18 L68 50 L86 30 L90 80 Z'],
      ['#FF9A4D', 'M10 80 H90 V92 H10 Z'],
      ['#FF4F8B', 'M43 64 A7 7 0 1 0 57 64 A7 7 0 1 0 43 64 Z'],
    ],
  },
  { id: 'zap', label: 'Zap', parts: [['#FFE14D', 'M60 4 L16 58 H44 L34 96 L84 38 H56 Z']] },
  {
    id: 'note',
    label: 'Note',
    parts: [['#6CC8FF', 'M36 20 L86 8 V68 C86 78 77 84 68 84 C59 84 53 79 53 72 C53 64 61 58 70 58 C73 58 76 59 78 60 V28 L44 36 V78 C44 88 35 94 26 94 C17 94 11 89 11 82 C11 74 19 68 28 68 C31 68 34 69 36 70 Z']],
  },
];

export const MAX_STICKERS = 8;
export const STICKER_SIZE = 0.28; // of the picture's shorter side
const INK = '#1A0B33';
const RING = 2 * Math.PI * 54;
const STOPPED = 'Stopped. Your video didn’t change.';
const FAILED = 'Couldn’t add the effect. Try again.';
const NUDGE = 0.02;
const REMOVE_SIZE = 48;
const KEY_MOVES = { ArrowLeft: [-NUDGE, 0], ArrowRight: [NUDGE, 0], ArrowUp: [0, -NUDGE], ArrowDown: [0, NUDGE] };

export const plain = () => ({ filter: 'none', stickers: [] });
const copy = (value) => JSON.parse(JSON.stringify(value));
export const sameSettings = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export const isPlain = (settings) => sameSettings(settings, plain());
export const clamp01 = (value) => Math.min(1, Math.max(0, value));

// "Rainbow", "Stickers" or "Rainbow + stickers": what the toast and the progress line call it.
export function effectLabel({ filter, stickers }) {
  const name = filter === 'none' ? '' : FILTERS.find(({ id }) => id === filter).label;
  if (!stickers.length) return name;
  return name ? `${name} + stickers` : 'Stickers';
}

// A new sticker lands near the middle, each one a little lower-right so none hides another.
export function addSticker(stickers, id) {
  if (stickers.length >= MAX_STICKERS) return stickers;
  const shift = (stickers.length % 4) * 0.06;
  return [...stickers, { id, x: 0.5 + shift, y: 0.5 + shift }];
}

export function moveSticker(stickers, index, x, y) {
  return stickers.map((sticker, i) => (i === index ? { ...sticker, x: clamp01(x), y: clamp01(y) } : sticker));
}

// Where a sticker sits on a w × h picture, in percent of it (for the drag handles).
export function stickerBox({ x, y }, w, h) {
  const size = STICKER_SIZE * Math.min(w, h);
  const width = (size / w) * 100;
  const height = (size / h) * 100;
  return { left: x * 100 - width / 2, top: y * 100 - height / 2, width, height };
}

// The rectangle a w × h picture fills inside a box, letterboxed like object-fit: contain.
export function fitRect(w, h, boxW, boxH) {
  const scale = Math.min(boxW / w, boxH / h);
  const width = w * scale;
  const height = h * scale;
  return { left: (boxW - width) / 2, top: (boxH - height) / 2, width, height };
}

export function clock(seconds) {
  const secs = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')} left`;
}

// ---- The shader ----

const VERTEX = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = vec2(a_pos.x + 1.0, 1.0 - a_pos.y) * 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

// Modes follow FILTERS. Rainbow and Neon drift slowly with the video's time and never flash.
const FRAGMENT = `
precision mediump float;
uniform sampler2D u_frame;
uniform vec2 u_px;
uniform float u_time;
uniform int u_mode;
varying vec2 v_uv;

float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
float lumaAt(vec2 uv) { return luma(texture2D(u_frame, uv).rgb); }
vec3 hue(float h) { return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }

float edge(vec2 uv) {
  float x = lumaAt(uv + vec2(u_px.x, 0.0)) - lumaAt(uv - vec2(u_px.x, 0.0));
  float y = lumaAt(uv + vec2(0.0, u_px.y)) - lumaAt(uv - vec2(0.0, u_px.y));
  return length(vec2(x, y));
}

void main() {
  vec2 uv = v_uv;
  if (u_mode == 4) uv.x = 0.5 - abs(uv.x - 0.5);
  vec3 c = texture2D(u_frame, uv).rgb;
  float l = luma(c);
  if (u_mode == 1) c = vec3(l);
  if (u_mode == 2) c = mix(c, hue(uv.x * 0.6 + uv.y * 0.4 + u_time) * (0.35 + l), 0.6);
  if (u_mode == 3) c = hue(uv.y * 0.8 + u_time) * smoothstep(0.04, 0.2, edge(uv)) * 1.6 + c * 0.12;
  if (u_mode == 5) c = floor(clamp(mix(vec3(l), c, 1.7), 0.0, 1.0) * 4.0 + 0.5) / 4.0 * (1.0 - smoothstep(0.1, 0.25, edge(uv)));
  gl_FragColor = vec4(c, 1.0);
}`;

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return shader;
}

function linkProgram(gl) {
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT));
  gl.linkProgram(program);
  return gl.getProgramParameter(program, gl.LINK_STATUS) ? program : null;
}

function setUpQuad(gl, program) {
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const pos = gl.getAttribLocation(program, 'a_pos');
  gl.enableVertexAttribArray(pos);
  gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
}

// Draws a video frame through the chosen filter. Null where WebGL or the shader isn't there.
export function createFilter(canvas) {
  const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true, alpha: false });
  const program = gl && linkProgram(gl);
  if (!program) return null;
  setUpQuad(gl, program);
  const at = (name) => gl.getUniformLocation(program, name);
  const uniforms = { px: at('u_px'), time: at('u_time'), mode: at('u_mode') };
  return (frame, mode, time) => {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, frame);
    gl.uniform2f(uniforms.px, 2 / canvas.width, 2 / canvas.height);
    gl.uniform1f(uniforms.time, time);
    gl.uniform1i(uniforms.mode, mode);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };
}

// ---- Sticker art ----

const SVG = 'http://www.w3.org/2000/svg';
let paths = null;

// Path2D needs a browser, so the shapes are made on first use.
function stickerPaths() {
  paths ??= Object.fromEntries(STICKERS.map(({ id, parts }) => [id, parts.map(([fill, d]) => [fill, new Path2D(d)])]));
  return paths;
}

function strokeParts(ctx, parts, color, width) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  parts.forEach(([, path]) => ctx.stroke(path));
}

function fillParts(ctx, parts) {
  parts.forEach(([fill, path]) => {
    ctx.fillStyle = fill;
    ctx.fill(path);
  });
}

function drawSticker(ctx, sticker, w, h) {
  const size = STICKER_SIZE * Math.min(w, h);
  const parts = stickerPaths()[sticker.id];
  ctx.save();
  ctx.translate(sticker.x * w - size / 2, sticker.y * h - size / 2);
  ctx.scale(size / 100, size / 100);
  ctx.lineJoin = 'round';
  strokeParts(ctx, parts, '#FFFFFF', 14);
  fillParts(ctx, parts);
  strokeParts(ctx, parts, INK, 4);
  ctx.restore();
}

function svgPath(d, attributes) {
  const path = document.createElementNS(SVG, 'path');
  path.setAttribute('d', d);
  Object.entries(attributes).forEach(([name, value]) => path.setAttribute(name, value));
  return path;
}

// The same art for the tray: a white edge under every part, so dark ones show on the chip.
function stickerIcon({ parts }) {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '-8 -8 116 116');
  svg.setAttribute('aria-hidden', 'true');
  svg.append(...iconEdges(parts), ...iconFills(parts));
  return svg;
}

function iconEdges(parts) {
  return parts.map(([, d]) => svgPath(d, { fill: 'none', stroke: '#FFFFFF', 'stroke-width': 14, 'stroke-linejoin': 'round' }));
}

function iconFills(parts) {
  return parts.map(([fill, d]) => svgPath(d, { fill, stroke: INK, 'stroke-width': 4, 'stroke-linejoin': 'round' }));
}

// ---- Sound ----

const sounds = new WeakMap();

// The video's own soundtrack (the beat and the voices), decoded once per video.
// A failed decode is forgotten, so the next try decodes again.
function soundOf(ctx, video) {
  if (sounds.has(video.blob)) return sounds.get(video.blob);
  const sound = video.blob.arrayBuffer().then((data) => ctx.decodeAudioData(data));
  sounds.set(video.blob, sound);
  sound.catch(() => sounds.delete(video.blob));
  return sound;
}

const once = (target, type) => new Promise((done) => target.addEventListener(type, done, { once: true }));

// Always a real seek: the looping preview may be mid-seek, and 'loadeddata' only comes once.
async function rewind(video) {
  video.pause();
  if (!video.readyState) await once(video, 'loadedmetadata');
  const seeked = once(video, 'seeked');
  video.currentTime = 0;
  await seeked;
}

// ---- The Effects screen ----

const $ = (id) => document.getElementById(id);

function choice(className, label, icon) {
  const node = button(className);
  node.append(icon, el('span', 'lbl', label));
  return node;
}

function swatch(id) {
  const node = document.createElement('span');
  node.className = `swatch sw-${id}`;
  node.setAttribute('aria-hidden', 'true');
  return node;
}

export function effectsSupported(format, env = globalThis) {
  const canvas = env.HTMLCanvasElement?.prototype;
  return Boolean(format && canvas?.captureStream && env.AudioContext?.prototype?.createMediaStreamDestination);
}

// `audio()` gives the app's AudioContext, `onMade(video, message)` takes the new video,
// and `toast(message)` tells the kid when something didn't work.
export function createEffects({ audio, format, onMade, toast }) {
  const watch = $('watch');
  const playback = $('playback');
  const view = $('fx-view');
  const paint2d = view.getContext('2d');
  const glCanvas = document.createElement('canvas');
  const filter = effectsSupported(format) ? createFilter(glCanvas) : null;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const filterButtons = FILTERS.map(({ id, label }) => choice('fx-item', label, swatch(id)));
  const stickerButtons = STICKERS.map((sticker) => choice('fx-item', sticker.label, stickerIcon(sticker)));

  let mode = 'watch';
  let current = null;
  let base = null;
  let settings = plain();
  let selected = -1;
  let frame = 0;
  let job = null;
  let drag = null;
  let skipPop = false;

  // Watch, choosing (fx) and making each show their own buttons, marked with data-mode.
  function setMode(next) {
    mode = next;
    watch.querySelectorAll('[data-mode]').forEach((el) => { el.hidden = !el.dataset.mode.split(' ').includes(next); });
    $('watch-fx').hidden ||= !filter;
    watch.classList.toggle('fx', next === 'fx');
    watch.classList.toggle('making', next === 'making');
    Object.assign(playback, { controls: next === 'watch', loop: next === 'fx', muted: next === 'making' });
    layout();
  }

  // The canvas lies exactly over the picture inside the video element.
  function layout() {
    if (mode === 'watch') return;
    const box = playback.getBoundingClientRect();
    const fit = fitRect(view.width, view.height, box.width, box.height);
    $('fx-stage').style.left = `${box.left + fit.left}px`;
    $('fx-stage').style.top = `${box.top + fit.top}px`;
    $('fx-stage').style.width = `${fit.width}px`;
    $('fx-stage').style.height = `${fit.height}px`;
    renderHandles();
  }

  function fitCanvas(video) {
    const { videoWidth: w, videoHeight: h } = video;
    if (view.width === w && view.height === h) return;
    [view, glCanvas].forEach((canvas) => Object.assign(canvas, { width: w, height: h }));
    layout();
  }

  function paint(video) {
    if (video.readyState < 2 || !video.videoWidth) return;
    fitCanvas(video);
    const time = reducedMotion.matches ? 0 : video.currentTime * 0.05;
    filter(video, FILTERS.findIndex(({ id }) => id === settings.filter), time);
    paint2d.drawImage(glCanvas, 0, 0);
    settings.stickers.forEach((sticker) => drawSticker(paint2d, sticker, view.width, view.height));
  }

  function loop() {
    paint(playback);
    if (job) drawRing();
    frame = requestAnimationFrame(loop);
  }

  // ---- Choosing ----

  function markFilter() {
    filterButtons.forEach((node, i) => node.setAttribute('aria-pressed', String(FILTERS[i].id === settings.filter)));
  }

  function limitStickers() {
    stickerButtons.forEach((node) => { node.disabled = settings.stickers.length >= MAX_STICKERS; });
  }

  function renderChoices() {
    markFilter();
    limitStickers();
    renderHandles();
  }

  // See-through buttons over the drawn stickers: they take the drags, taps and keys.
  function handle(sticker, index) {
    const node = el('button', index === selected ? 'fx-sticker selected' : 'fx-sticker');
    node.type = 'button';
    node.dataset.index = index;
    node.setAttribute('aria-label', `${STICKERS.find(({ id }) => id === sticker.id).label} sticker`);
    const box = stickerBox(sticker, view.width, view.height);
    Object.entries(box).forEach(([key, value]) => { node.style[key] = `${value}%`; });
    return node;
  }

  // ✕ sits on the chosen sticker's top-right corner, kept inside the picture.
  function renderHandles() {
    $('fx-handles').replaceChildren(...settings.stickers.map(handle));
    const chosen = settings.stickers[selected];
    $('fx-remove').hidden = !chosen;
    if (!chosen) return;
    const box = stickerBox(chosen, view.width, view.height);
    const { clientWidth: w, clientHeight: h } = $('fx-stage');
    const half = REMOVE_SIZE / 2;
    $('fx-remove').style.left = `${Math.min(w - half, Math.max(half, ((box.left + box.width) / 100) * w))}px`;
    $('fx-remove').style.top = `${Math.min(h - half, Math.max(half, (box.top / 100) * h))}px`;
  }

  function choose(next, focus = -1) {
    settings = next;
    renderChoices();
    if (focus >= 0) $('fx-handles').children[focus]?.focus({ preventScroll: true });
  }

  function onFilter(event) {
    const index = filterButtons.indexOf(event.target.closest('button'));
    if (index >= 0) choose({ ...settings, filter: FILTERS[index].id });
  }

  function onAddSticker(event) {
    const index = stickerButtons.indexOf(event.target.closest('button'));
    if (index < 0) return;
    const stickers = addSticker(settings.stickers, STICKERS[index].id);
    selected = stickers.length - 1;
    choose({ ...settings, stickers });
  }

  function removeSelected() {
    const stickers = settings.stickers.filter((_, i) => i !== selected);
    selected = -1;
    choose({ ...settings, stickers });
    $('fx-use').focus({ preventScroll: true });
  }

  // ---- Moving stickers: a finger or mouse drags; arrow keys nudge; Delete removes ----

  function onPointerDown(event) {
    if (event.target.closest('#fx-remove')) return;
    const node = event.target.closest('.fx-sticker');
    selected = node ? Number(node.dataset.index) : -1;
    renderChoices();
    if (!node) return;
    event.preventDefault();
    const { x, y } = settings.stickers[selected];
    drag = { id: event.pointerId, startX: event.clientX, startY: event.clientY, x, y };
    $('fx-stage').setPointerCapture(event.pointerId);
  }

  function onPointerMove(event) {
    if (drag?.id !== event.pointerId) return;
    const box = $('fx-stage').getBoundingClientRect();
    const x = drag.x + (event.clientX - drag.startX) / box.width;
    const y = drag.y + (event.clientY - drag.startY) / box.height;
    choose({ ...settings, stickers: moveSticker(settings.stickers, selected, x, y) });
  }

  function onPointerUp(event) {
    if (drag?.id !== event.pointerId) return;
    drag = null;
    $('fx-handles').children[selected]?.focus({ preventScroll: true });
  }

  function onStickerKey(event) {
    const node = event.target.closest('.fx-sticker');
    if (!node) return;
    selected = Number(node.dataset.index);
    if (event.key === 'Delete' || event.key === 'Backspace') return removeSelected();
    const move = KEY_MOVES[event.key];
    if (!move) return;
    event.preventDefault();
    const { x, y } = settings.stickers[selected];
    choose({ ...settings, stickers: moveSticker(settings.stickers, selected, x + move[0], y + move[1]) }, selected);
  }

  // ---- Opening and closing ----

  function showVideo(video) {
    if (playback.src !== video.url) playback.src = video.url;
    playback.play().catch(() => {});
  }

  function open(video) {
    if (!filter || !video) return;
    current = video;
    base = video.original ?? video;
    // A draft left by ✕, Back or Escape comes back, so closing never loses a kid's choices.
    settings = copy(video.draft ?? video.effect ?? plain());
    selected = -1;
    soundOf(audio(), base).catch(() => {});
    setMode('fx');
    showVideo(base);
    renderChoices();
    history.pushState({ poprocks: 'fx' }, '');
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(loop);
    filterButtons[FILTERS.findIndex(({ id }) => id === settings.filter)].focus({ preventScroll: true });
  }

  // Leaving takes the Effects entry back off the history, and ignores the Back that makes.
  function leave() {
    cancelAnimationFrame(frame);
    setMode('watch');
    if (history.state?.poprocks !== 'fx') return;
    skipPop = true;
    history.back();
  }

  function close() {
    current.draft = copy(settings);
    leave();
    showVideo(current);
    $('watch-fx').focus({ preventScroll: true });
  }

  function use() {
    current.draft = undefined;
    if (sameSettings(settings, current.effect ?? plain())) return close();
    if (!isPlain(settings)) return make();
    leave();
    onMade(base, 'Back to the original ✓');
  }

  // ---- Making the new video ----

  function drawRing() {
    const left = job.length - (job.ctx.currentTime - job.start);
    $('fx-ring-left').style.strokeDashoffset = String(RING * (1 - Math.max(0, left) / job.length));
    $('fx-time').textContent = clock(left);
  }

  async function make() {
    selected = -1;
    renderHandles();
    setMode('making');
    $('fx-status').textContent = `Adding ${effectLabel(settings)}…`;
    $('fx-time').textContent = '';
    $('fx-stop').focus({ preventScroll: true });
    try {
      const sound = await soundOf(audio(), base);
      if (mode === 'making') await rewind(playback);
      if (mode === 'making') await record(sound);
    } catch {
      stopMaking(FAILED);
    }
  }

  // The video plays muted while its decoded sound plays into the recording and the speaker.
  async function record(sound) {
    const ctx = audio();
    const dest = ctx.createMediaStreamDestination();
    const source = ctx.createBufferSource();
    source.buffer = sound;
    paint(playback);
    const tracks = [...view.captureStream(30).getVideoTracks(), ...dest.stream.getAudioTracks()];
    const made = { ctx, source, tracks, settings: copy(settings), length: sound.duration, start: ctx.currentTime };
    job = made;
    made.recorder = startRecorder(new MediaStream(tracks), format, (blob) => onRecorded(made, blob));
    source.connect(dest);
    source.connect(ctx.destination);
    source.addEventListener('ended', () => finish(made));
    await playback.play();
    if (made.cancelled) return;
    made.start = ctx.currentTime - playback.currentTime;
    made.started = true;
    source.start(0, playback.currentTime);
  }

  function finish(made) {
    if (made.recorder.state !== 'inactive') made.recorder.stop();
  }

  function teardown(made) {
    made.source.disconnect();
    made.tracks.forEach((track) => track.stop());
    if (job === made) job = null;
  }

  function onRecorded(made, blob) {
    teardown(made);
    if (made.cancelled) return;
    if (!blob.size) return stopMaking(FAILED);
    leave();
    const video = { blob, url: URL.createObjectURL(blob), format, original: base, effect: made.settings };
    onMade(video, `${effectLabel(made.settings)} added ✓`);
  }

  // A recorder that never started has no 'stop' to tidy up after it, so that's done here.
  function cancelJob() {
    if (!job) return;
    job.cancelled = true;
    if (job.started) job.source.stop();
    if (job.recorder) return finish(job);
    teardown(job);
  }

  // Stopping throws the half-made video away: the one the kid had stays as it was.
  function stopMaking(message) {
    cancelJob();
    if (mode !== 'making') return;
    setMode('fx');
    showVideo(base);
    renderChoices();
    toast(message);
  }

  function exit() {
    if (mode === 'making') stopMaking(STOPPED);
    close();
  }

  // Back and Escape on Watch come here first: true means Effects handled it.
  function back() {
    if (skipPop) {
      skipPop = false;
      return true;
    }
    if (mode === 'watch') return false;
    exit();
    return true;
  }

  $('fx-filters').append(...filterButtons);
  $('fx-sticker-row').append(...stickerButtons);
  $('fx-filters').addEventListener('click', onFilter);
  $('fx-sticker-row').addEventListener('click', onAddSticker);
  $('fx-remove').addEventListener('click', removeSelected);
  $('fx-close').addEventListener('click', () => close());
  $('fx-use').addEventListener('click', use);
  $('fx-stop').addEventListener('click', () => stopMaking(STOPPED));
  $('fx-stage').addEventListener('pointerdown', onPointerDown);
  $('fx-stage').addEventListener('pointermove', onPointerMove);
  $('fx-stage').addEventListener('pointerup', onPointerUp);
  $('fx-stage').addEventListener('pointercancel', onPointerUp);
  $('fx-handles').addEventListener('keydown', onStickerKey);
  $('fx-ring-left').style.strokeDasharray = String(RING);
  window.addEventListener('resize', layout);
  document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'making') stopMaking(STOPPED); });
  setMode('watch');

  return { open, back };
}
