import { SOUNDS, audioSupported, createEngine, setAudioSession } from './sounds.js';
import { createScheduler } from './scheduler.js';
import {
  BPM_MAX, BPM_MIN, BPM_STEP, clear, createHistory, isEmpty, isOn, surprise, toggle, withBpm,
} from './pattern.js';
import { SLOT_COUNT, loadState, saveState } from './slots.js';
import { createGrid } from './grid.js';
import {
  MAX_SECONDS, NO_VIDEO_NOTE, cameraError, canRecord, createMix, openCamera, pickFormat, startRecorder, stopStream,
} from './recorder.js';
import { fileName, saveVideo } from './save.js';

const $ = (id) => document.getElementById(id);
const SCREENS = ['start', 'beats', 'record', 'watch'];
const FOCUS = { start: 'start-btn', beats: 'play', record: 'rec-close', watch: 'watch-save' };
const RING = 2 * Math.PI * 54;

function localStore() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const storage = localStore();
const state = loadState(storage);
const histories = Array.from({ length: SLOT_COUNT }, () => createHistory());
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const coarsePointer = matchMedia('(pointer: coarse)');
const format = pickFormat();
const queue = [];

let screen = 'start';
let engine = null;
let scheduler = null;
let frame = 0;
let lastTouch = 0;
let camera = null;
let mix = null;
let recorder = null;
let recordStart = 0;
let recordTimer = 0;
let countdown = [];
let micOn = true;
let lastVideo = null;
let deleted = null;
let toastState = null;

const beat = () => state.slots[state.slot];
const history = () => histories[state.slot];

// ---- Screens and messages ----

function show(name) {
  if (name !== 'watch') $('playback').pause();
  SCREENS.forEach((id) => { $(id).hidden = id !== name; });
  screen = name;
  $(FOCUS[name]).focus({ preventScroll: true });
}

function setButton(id, icon, label) {
  $(id).querySelector('.ico').textContent = icon;
  $(id).querySelector('.lbl').textContent = label;
}

function toast(message, { action = '', ms = 3000, onAction = null, onEnd = null, slot = -1 } = {}) {
  closeToast();
  $('toast-msg').textContent = message;
  $('toast-action').textContent = action;
  $('toast-action').hidden = !action;
  $('toast').hidden = false;
  toastState = { onAction, onEnd, slot, timer: setTimeout(closeToast, ms) };
}

function closeToast() {
  if (!toastState) return;
  const { onEnd, timer } = toastState;
  toastState = null;
  clearTimeout(timer);
  $('toast').hidden = true;
  onEnd?.();
}

function onToastAction() {
  const action = toastState?.onAction;
  if (toastState) toastState.onEnd = null;
  closeToast();
  action?.();
}

// ---- Beats ----

function render() {
  const { bpm } = beat();
  grid.render(beat());
  $('bpm').querySelector('.num').textContent = bpm;
  $('slower').disabled = bpm <= BPM_MIN;
  $('faster').disabled = bpm >= BPM_MAX;
  $('clear').disabled = isEmpty(beat());
  $('undo').disabled = !history().canUndo;
  document.querySelectorAll('.slot').forEach((button) => {
    button.setAttribute('aria-pressed', String(Number(button.dataset.slot) === state.slot));
  });
  scheduler?.setBpm(bpm);
}

function setBeat(next) {
  state.slots[state.slot] = next;
  saveState(storage, state);
  render();
}

function commit(next) {
  history().push(beat());
  setBeat(next);
}

function onToggle(track, step) {
  commit(toggle(beat(), track, step));
  if (!scheduler?.playing && isOn(beat(), track, step)) engine?.play(SOUNDS[track].id);
}

function onSound(track) {
  engine?.play(SOUNDS[track].id);
}

function changeTempo(delta) {
  const next = withBpm(beat(), beat().bpm + delta);
  if (next.bpm !== beat().bpm) commit(next);
}

function undo() {
  setBeat(history().undo(beat()));
}

// Clear's Undo brings back exactly the cleared beat, even after another tap.
function onClear() {
  const before = beat();
  if (isEmpty(before)) return;
  commit(clear(before));
  toast('Beat cleared.', { action: 'Undo', ms: 6000, onAction: () => commit(before), slot: state.slot });
}

function onSlot(event) {
  const button = event.target.closest('.slot');
  if (!button) return;
  if (toastState && toastState.slot >= 0) closeToast();
  state.slot = Number(button.dataset.slot);
  saveState(storage, state);
  render();
}

function onMore() {
  const open = $('bar').classList.toggle('more-open');
  $('more').setAttribute('aria-expanded', String(open));
}

// ---- Playing ----

function onStep(step, time) {
  SOUNDS.forEach((sound, track) => {
    if (isOn(beat(), track, step)) engine.play(sound.id, time, step);
  });
  queue.push({ step, time });
}

function audibleTime() {
  const stamp = engine.ctx.getOutputTimestamp?.();
  return stamp?.contextTime > 0 ? stamp.contextTime : engine.ctx.currentTime;
}

function dueStep() {
  const now = audibleTime();
  let step = -1;
  while (queue.length && queue[0].time <= now) step = queue.shift().step;
  return step;
}

// Turned grids scroll; keep the playing row in view unless a finger just moved it.
function follow(step) {
  if (screen !== 'beats' || !grid.turned() || Date.now() - lastTouch < 2000) return;
  const wrap = $('grid-wrap');
  const box = wrap.getBoundingClientRect();
  const row = grid.rowOf(step).getBoundingClientRect();
  const top = box.top + wrap.querySelector('.sound').offsetHeight;
  if (row.top >= top && row.bottom <= box.bottom) return;
  wrap.scrollBy({ top: row.top - top, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
}

function draw() {
  const step = dueStep();
  if (step >= 0) grid.setNow(step);
  if (step >= 0) follow(step);
  if (recorder) drawRing();
  frame = requestAnimationFrame(draw);
}

function startPlaying() {
  if (scheduler.playing) return;
  engine.resume();
  scheduler.setBpm(beat().bpm);
  scheduler.start();
  frame = requestAnimationFrame(draw);
  setButton('play', '■', 'Stop');
  $('play').classList.add('playing');
}

function stopPlaying() {
  if (!scheduler?.playing) return;
  scheduler.stop();
  queue.length = 0;
  cancelAnimationFrame(frame);
  grid.setNow(-1);
  setButton('play', '▶\uFE0E', 'Play');
  $('play').classList.remove('playing');
}

function togglePlay() {
  if (scheduler.playing) return stopPlaying();
  startPlaying();
}

function onStart() {
  if (!audioSupported()) return showStartNote('This browser can’t play sounds. Try Safari or Chrome.');
  engine ??= createEngine();
  scheduler ??= createScheduler({ now: () => engine.ctx.currentTime, onStep, bpm: beat().bpm });
  setAudioSession('playback');
  engine.resume();
  show('beats');
}

function showStartNote(text) {
  $('start-note').textContent = text;
  $('start-note').hidden = false;
}

// ---- Recording ----

// `code` is the browser's error name, small under the message, for a grown-up to report.
function recordMessage(text, retry, code = '') {
  $('rec-msg').textContent = text;
  $('rec-code').textContent = code;
  $('rec-code').hidden = !code;
  $('rec-retry').hidden = !retry;
  $('rec-card').hidden = false;
}

function onMakeVideo() {
  stopPlaying();
  closeToast();
  show('record');
  if (!canRecord()) return recordMessage(NO_VIDEO_NOTE, false);
  openRecordCamera();
}

async function openRecordCamera() {
  recordMessage('Allow the camera to film yourself.', false);
  // iOS can't record in the 'playback' session the beat screen uses, so switch first.
  setAudioSession('play-and-record');
  let stream;
  try {
    stream = await openCamera();
  } catch (error) {
    setAudioSession('playback');
    return recordMessage(cameraError(error), true, error?.name);
  }
  if (screen !== 'record' || document.hidden) return stopStream(stream);
  stopStream(camera);
  camera = stream;
  engine.resume();
  $('preview').srcObject = camera;
  $('preview').play().catch(() => {});
  $('rec-card').hidden = true;
  $('rec-btn').disabled = false;
  setMic(micOn);
}

function closeCamera() {
  stopStream(camera);
  camera = null;
  $('preview').srcObject = null;
  $('rec-btn').disabled = true;
  setAudioSession('playback');
}

function setMic(on) {
  micOn = on;
  mix?.setMic(on);
  camera?.getAudioTracks().forEach((track) => { track.enabled = on; });
  setButton('mic', on ? '🎤' : '🔇', on ? 'Mic on' : 'Mic off');
}

function cancelCountdown() {
  countdown.forEach(clearTimeout);
  countdown = [];
  $('countdown').textContent = '';
  setButton('rec-btn', '', 'Record');
}

function showCount(n) {
  $('countdown').textContent = n;
  engine.blip(engine.ctx.currentTime, n === 1 ? 880 : 440);
}

function startCountdown() {
  setButton('rec-btn', '✕', 'Cancel');
  countdown = [3, 2, 1].map((n, i) => setTimeout(() => showCount(n), i * 1000));
  countdown.push(setTimeout(beginRecording, 3000));
}

function onRecordButton() {
  if (recorder) return stopRecording();
  if (countdown.length) return cancelCountdown();
  startCountdown();
}

function beginRecording() {
  cancelCountdown();
  try {
    mix = createMix(engine, camera);
    mix.setMic(micOn);
    recorder = startRecorder(mix.stream, format, onRecorded);
  } catch {
    mix?.close();
    mix = null;
    return recordMessage('Filming didn’t start. Try again.', false);
  }
  $('rec-card').hidden = true;
  recordStart = performance.now();
  recordTimer = setTimeout(stopRecording, MAX_SECONDS * 1000);
  scheduler.setBpm(beat().bpm);
  scheduler.start();
  frame = requestAnimationFrame(draw);
  setButton('rec-btn', '', 'Stop');
  $('rec-btn').classList.add('recording');
  $('rec-time').hidden = false;
}

function drawRing() {
  const left = Math.max(0, MAX_SECONDS - (performance.now() - recordStart) / 1000);
  $('ring-left').style.strokeDashoffset = String(RING * (1 - left / MAX_SECONDS));
  const secs = Math.ceil(left);
  $('rec-time').textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')} left`;
}

// Stopping keeps the clip: onRecorded runs when the recorder hands over the file.
function stopRecording() {
  if (!recorder) return;
  clearTimeout(recordTimer);
  if (recorder.state !== 'inactive') recorder.stop();
  recorder = null;
  stopPlaying();
  $('rec-btn').disabled = true;
  $('rec-btn').classList.remove('recording');
  $('rec-time').hidden = true;
  $('ring-left').style.strokeDashoffset = '0';
  setButton('rec-btn', '', 'Record');
}

function onRecorded(blob) {
  stopRecording();
  mix?.close();
  mix = null;
  closeCamera();
  if (!blob.size) return backToBeats('Oops, no video was made. Try again!');
  forget(lastVideo);
  forgetDeleted();
  lastVideo = { blob, url: URL.createObjectURL(blob), format };
  setHasVideo(true);
  showWatch();
}

function onRecordClose() {
  cancelCountdown();
  if (recorder) return stopRecording();
  closeCamera();
  show('beats');
}

function onHide() {
  cancelCountdown();
  if (recorder) return stopRecording();
  stopPlaying();
  if (screen !== 'record' || !canRecord()) return;
  closeCamera();
  recordMessage('The camera turned off. Tap to turn it back on.', true);
}

// ---- Watching and saving ----

function forget(video) {
  if (video) URL.revokeObjectURL(video.url);
}

function forgetDeleted() {
  forget(deleted);
  deleted = null;
}

// On phones 🎬 My video sits under More, so More gets a dot while a video waits there.
function setHasVideo(on) {
  $('last-video').hidden = !on;
  $('more').classList.toggle('has-video', on);
}

function showWatch() {
  $('playback').src = lastVideo.url;
  $('watch-note').textContent = lastVideo.format.note;
  $('watch-note').hidden = !lastVideo.format.note;
  show('watch');
}

function backToBeats(message) {
  show('beats');
  if (message) toast(message);
}

function onDelete() {
  deleted = lastVideo;
  lastVideo = null;
  $('playback').removeAttribute('src');
  $('playback').load();
  setHasVideo(false);
  backToBeats();
  toast('Video deleted.', { action: 'Undo', ms: 10_000, onAction: undoDelete, onEnd: forgetDeleted });
}

function undoDelete() {
  if (!deleted) return;
  lastVideo = deleted;
  deleted = null;
  setHasVideo(true);
  showWatch();
}

async function onSave() {
  $('playback').pause();
  const file = new File([lastVideo.blob], fileName(new Date(), lastVideo.format.ext), { type: lastVideo.format.type });
  try {
    const result = await saveVideo(file, { coarse: coarsePointer.matches });
    if (result === 'downloaded') toast('Saved to Downloads ✓');
    if (result === 'shared') toast('Done ✓');
  } catch {
    toast('Couldn’t save. Try again.');
  }
}

// ---- Keys, lifecycle, wiring ----

function onKeydown(event) {
  if (event.key !== ' ' || event.target !== document.body || screen !== 'beats') return;
  event.preventDefault();
  togglePlay();
}

// iOS suspends audio after calls or locking; the next touch wakes it.
function wakeAudio() {
  if (engine && engine.ctx.state !== 'running') engine.resume();
}

const grid = createGrid($('grid'), { onToggle, onSound });

const CLICKS = {
  'start-btn': onStart,
  play: () => togglePlay(),
  slower: () => changeTempo(-BPM_STEP),
  faster: () => changeTempo(BPM_STEP),
  surprise: () => commit(surprise(beat())),
  clear: onClear,
  undo,
  more: onMore,
  'last-video': () => showWatch(),
  'make-video': onMakeVideo,
  'rec-close': onRecordClose,
  'rec-retry': () => openRecordCamera(),
  'rec-btn': onRecordButton,
  mic: () => setMic(!micOn),
  'watch-back': () => backToBeats(),
  'watch-delete': onDelete,
  'watch-again': onMakeVideo,
  'watch-save': onSave,
  'toast-action': onToastAction,
};

Object.entries(CLICKS).forEach(([id, handler]) => $(id).addEventListener('click', handler));
$('slots').addEventListener('click', onSlot);
$('grid-wrap').addEventListener('pointerdown', () => { lastTouch = Date.now(); }, { passive: true });
$('grid-wrap').addEventListener('wheel', () => { lastTouch = Date.now(); }, { passive: true });
document.addEventListener('keydown', onKeydown);
document.addEventListener('pointerdown', wakeAudio, { passive: true });
document.addEventListener('visibilitychange', () => { if (document.hidden) onHide(); });
window.addEventListener('pagehide', onHide);
$('ring-left').style.strokeDasharray = String(RING);
render();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
