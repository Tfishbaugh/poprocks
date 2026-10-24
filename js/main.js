import {
  SOUNDS, audioSupported, createEngine, kitById, kitStarters, setAudioSession, useKit,
} from './sounds.js';
import { createScheduler } from './scheduler.js';
import {
  BAR, BPM_MAX, BPM_MIN, BPM_STEP, MAX_STEPS, canDouble, clear, copyBeat, copyRow, createHistory, double, isEmpty,
  isOn, longer, shorter, stepCount, surprise, toggle, withBpm, withKit,
} from './pattern.js';
import { SLOT_COUNT, loadState, saveState } from './slots.js';
import { createGrid } from './grid.js';
import { createStrip } from './strip.js';
import { createCopySheet } from './copy.js';
import { createKitPicker, labelGrid } from './kits.js';
import {
  MAX_SECONDS, NO_VIDEO_NOTE, cameraError, canRecord, createMix, openCamera, pickFormat, startRecorder, stopStream,
} from './recorder.js';
import { fileName, saveVideo } from './save.js';
import { initTour, startTour, tourOnce } from './tour.js';
import { createEffects } from './effects.js';
import { createHoldPlayer } from './holds.js';
import { createStretch } from './stretch.js';

const $ = (id) => document.getElementById(id);
const SCREENS = ['start', 'beats', 'record', 'watch'];
const BACK = { record: () => onRecordClose(), watch: () => backToBeats() };
const FOCUS = { start: 'start-btn', beats: 'play', record: 'rec-close', watch: 'watch-save' };
const RING = 2 * Math.PI * 54;
const FOLLOW_PAUSE_MS = 8000;

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
let holdPlayer = null;
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
let pointerType = '';
let fingerDown = false;
let shownKit = '';
let kitSession = null;

const beat = () => state.slots[state.slot];
const undoStack = () => histories[state.slot];

// ---- Screens and messages ----

function show(name) {
  if (name !== 'watch') $('playback').pause();
  SCREENS.forEach((id) => { $(id).hidden = id !== name; });
  screen = name;
  syncHistory(name);
  $(FOCUS[name]).focus({ preventScroll: true });
}

// Record and Watch get one history entry, so Back (Android's gesture, a browser's button)
// returns to Beats instead of closing the app and losing the video.
function syncHistory(name) {
  const ours = history.state?.poprocks;
  if (BACK[name] && ours) return history.replaceState({ poprocks: name }, '');
  if (BACK[name]) return history.pushState({ poprocks: name }, '');
  if (ours) history.back();
}

function onBack() {
  if (copySheet.isOpen) return copySheet.close();
  if ($('kits').open) return $('kits').close();
  if (screen === 'watch' && effects.back()) return; // Effects closes first (task 80)
  BACK[screen]?.();
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

function renderTools(current) {
  const steps = stepCount(current);
  $('bpm').querySelector('.num').textContent = current.bpm;
  $('slower').disabled = current.bpm <= BPM_MIN;
  $('faster').disabled = current.bpm >= BPM_MAX;
  $('clear').disabled = isEmpty(current);
  $('undo').disabled = !undoStack().canUndo;
  $('double').disabled = !canDouble(current);
  $('shorter').disabled = steps <= BAR;
  $('longer').disabled = steps >= MAX_STEPS;
  $('longer-tool').disabled = steps >= MAX_STEPS;
}

function render() {
  const current = beat();
  showKit(beatKit());
  grid.render(current);
  renderTools(current);
  document.querySelectorAll('.slot').forEach((button) => {
    button.setAttribute('aria-pressed', String(Number(button.dataset.slot) === state.slot));
  });
  scheduler?.setBpm(current.bpm);
  scheduler?.setSteps(stepCount(current));
  $('strip-map').style.setProperty('--pages', stepCount(current) / BAR);
  strip.update();
}

function setBeat(next) {
  state.slots[state.slot] = next;
  saveState(storage, state);
  render();
}

function commit(next) {
  undoStack().push(beat());
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
  setBeat(undoStack().undo(beat()));
}

// A toast whose Undo brings back exactly `before`, even after another tap.
function withUndo(message, before, ms = 6000) {
  toast(message, { action: 'Undo', ms, onAction: () => commit(before), slot: state.slot });
}

function onClear() {
  const before = beat();
  if (isEmpty(before)) return;
  commit(clear(before));
  withUndo('Beat cleared.', before);
}

function onSlot(event) {
  const button = event.target.closest('.slot');
  if (!button) return;
  if (toastState && toastState.slot >= 0) closeToast();
  state.slot = Number(button.dataset.slot);
  saveState(storage, state);
  render();
}

const isMoreOpen = () => $('bar').classList.contains('more-open');

function setMore(open) {
  $('bar').classList.toggle('more-open', open);
  $('more').setAttribute('aria-expanded', String(open));
}

// The tools close on a tap anywhere else, as a kid expects of a pop-up.
function closeMoreOutside(event) {
  if (isMoreOpen() && !event.target.closest('#tools, #more')) setMore(false);
}

// ---- Sound kits (task 80, lane B) ----

const beatKit = () => kitById(beat().kit);

// Every row plays, and the grid shows, the sounds of the beat's own kit.
function showKit(kit) {
  if (kit.id === shownKit) return;
  shownKit = kit.id;
  useKit(kit.id);
  labelGrid($('grid'), kit.sounds);
  setButton('sounds', kit.emoji, kit.label);
  setButton('sounds-tool', kit.emoji, 'Sounds');
  $('sounds').setAttribute('aria-label', `Sounds: ${kit.label}`);
  $('sounds-tool').setAttribute('aria-label', `Sounds: ${kit.label}`);
}

// One visit to the picker is one Undo, however many kits a kid tries on the way.
function openKits() {
  setMore(false);
  kitSession = { before: beatKit().id, pushed: false };
  kitPicker.open(beatKit().id);
  history.pushState({ poprocks: 'kits' }, '');
}

// While the beat plays, the beat itself is the preview.
function onPickKit(id) {
  if (id === beatKit().id) return;
  if (!kitSession.pushed) undoStack().push(beat());
  kitSession.pushed = true;
  setBeat(withKit(beat(), id));
  engine.load();
  if (!scheduler.playing) engine.preview(id);
}

function onKitsClosed() {
  if (history.state?.poprocks === 'kits') history.back();
  const { before, pushed } = kitSession;
  kitSession = null;
  if (!pushed) return;
  if (before === beatKit().id) return undo();
  const { emoji, label } = beatKit();
  const onAction = () => commit(withKit(beat(), before));
  toast(`${emoji} ${label} sounds`, { action: 'Undo', ms: 6000, onAction, slot: state.slot });
}

// ---- Longer beats and copy (task 80, lane A) ----

function touchGrid() {
  lastTouch = Date.now();
}

function fingerUp() {
  if (!fingerDown) return;
  fingerDown = false;
  touchGrid();
}

// ➕ adds 16 steps (a copy of the last 16) and scrolls to them, so the kid sees what happened.
function onLonger() {
  const steps = stepCount(beat());
  if (steps >= MAX_STEPS) return;
  commit(longer(beat()));
  touchGrid();
  strip.showStep(grid.stepPad(steps));
  $('sr-status').textContent = `Your beat is now ${steps + BAR} steps long.`;
}

function onShorter() {
  const before = beat();
  if (stepCount(before) <= BAR) return;
  commit(shorter(before));
  strip.showStep(grid.stepPad(stepCount(beat()) - 1));
  withUndo('Made shorter.', before);
}

function onDouble() {
  const before = beat();
  if (!canDouble(before)) return;
  commit(double(before));
  withUndo('Doubled.', before);
}

// The copy lands on the other number, and so does the kid: that number's old beat is its Undo.
function onCopyBeat(target) {
  const copy = copyBeat(beat());
  if (toastState && toastState.slot >= 0) closeToast();
  state.slot = target;
  const before = beat();
  commit(copy);
  withUndo(`Copied! Now on beat ${target + 1}.`, before, 10_000);
}

function onCopyRow(from, to) {
  const before = beat();
  commit(copyRow(before, from, to));
  withUndo(`Copied ${SOUNDS[from].label} onto ${SOUNDS[to].label}.`, before);
}

// The sheet gets a history entry so Back closes it; the beat screen behind it is inert.
function onCopySheet(open) {
  $('beats').inert = open;
  if (open) return history.pushState({ poprocks: 'sheet' }, '');
  if (history.state?.poprocks === 'sheet') history.back();
  $('copy').focus({ preventScroll: true });
}

// ---- Playing ----

// Held notes ring or roll, and end on the audio clock (task 84: js/holds.js).
function onStep(step, time) {
  SOUNDS.forEach((sound, track) => holdPlayer.step(beat().rows[track], track, sound.id, step, time));
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

// How far to scroll so [start, end] shows inside [min, max]; 0 if it already does.
function nudge(start, end, min, max) {
  return start < min || end > max ? start - min : 0;
}

// When the steps don't all fit, keep the playing step in view. Never while a finger is on the
// grid, and not for 8 s after one moved it (or until the next Play).
// Steps run down a turned grid and across a wide one; the sticky sound names cover the first bit.
function follow(step) {
  if (screen !== 'beats' || fingerDown || Date.now() - lastTouch < FOLLOW_PAUSE_MS) return;
  const wrap = $('grid-wrap');
  const view = wrap.getBoundingClientRect();
  const pad = grid.stepPad(step).getBoundingClientRect();
  const names = wrap.querySelector('.sound').getBoundingClientRect();
  const turned = grid.turned();
  const top = turned ? nudge(pad.top, pad.bottom, names.bottom, view.top + wrap.clientHeight) : 0;
  const left = turned ? 0 : nudge(pad.left, pad.right, names.right, view.left + wrap.clientWidth);
  if (!top && !left) return;
  wrap.scrollBy({ top, left, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
}

function showPlaying(step) {
  grid.setNow(step);
  strip.setPlay(step, stepCount(beat()));
  follow(step);
}

function draw() {
  const step = dueStep();
  if (step >= 0) showPlaying(step);
  if (recorder) drawRing();
  frame = requestAnimationFrame(draw);
}

function startPlaying() {
  if (scheduler.playing) return;
  engine.resume();
  lastTouch = 0;
  scheduler.setBpm(beat().bpm);
  scheduler.setSteps(stepCount(beat()));
  scheduler.start();
  frame = requestAnimationFrame(draw);
  setButton('play', '■', 'Stop');
  $('play').classList.add('playing');
}

function stopPlaying() {
  if (!scheduler?.playing) return;
  scheduler.stop();
  holdPlayer.releaseAll(engine.ctx.currentTime);
  queue.length = 0;
  cancelAnimationFrame(frame);
  grid.setNow(-1);
  strip.setPlay(-1, 1);
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
  holdPlayer ??= createHoldPlayer(engine);
  engine.load();
  scheduler ??= createScheduler({ now: () => engine.ctx.currentTime, onStep, bpm: beat().bpm });
  setAudioSession('playback');
  engine.resume();
  show('beats');
  tourOnce('beats');
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
  $('rec-btn').focus({ preventScroll: true });
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
  $('mic').setAttribute('aria-pressed', String(on));
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
  // An error card already offers a retry; keep its error name for the grown-up.
  if (screen !== 'record' || !canRecord() || !$('rec-retry').hidden) return;
  closeCamera();
  recordMessage('The camera turned off. Tap to turn it back on.', true);
}

// ---- Watching and saving ----

// A video made with an effect keeps its original, so both go together.
function forget(video) {
  if (video) URL.revokeObjectURL(video.url);
  if (video?.original) URL.revokeObjectURL(video.original.url);
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
  $('playback').play().catch(() => {});
  $('watch-note').textContent = lastVideo.format.note;
  $('watch-note').hidden = !lastVideo.format.note;
  show('watch');
  tourOnce('watch');
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

// ---- Effects (task 80): a made video takes the original's place, with Undo ----

// A made copy is let go once nothing can bring it back; an original stays with its copies.
function dropCopy(video) {
  if (video.original && video !== lastVideo) URL.revokeObjectURL(video.url);
}

function useVideo(next, message) {
  const before = lastVideo;
  lastVideo = next;
  showWatch();
  const undoVideo = () => {
    lastVideo = before;
    dropCopy(next);
    showWatch();
  };
  toast(message, { action: 'Undo', ms: 10_000, onAction: undoVideo, onEnd: () => dropCopy(before) });
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
  if (event.key === 'Escape' && isMoreOpen()) return setMore(false);
  if (event.key === 'Escape') return onBack();
  if (event.key !== ' ' || event.target !== document.body || screen !== 'beats') return;
  event.preventDefault();
  togglePlay();
}

// A mouse click never leaves focus on a button, so on a laptop Space keeps meaning Play.
// Touch is left alone: its taps don't set keyboard focus anyway.
function keepFocusOffButtons(event) {
  if (pointerType !== 'mouse' || !event.target.closest('button')) return;
  event.preventDefault();
  document.activeElement?.blur();
}

// iOS suspends audio after calls or locking; the next touch wakes it.
function wakeAudio() {
  if (engine && engine.ctx.state !== 'running') engine.resume();
}

const grid = createGrid($('grid'), { onToggle, onSound });
// Held notes (task 84): Shift+→ and Shift+← stretch the focused note, one ↩ a press.
createStretch({
  root: $('grid'),
  turned: () => grid.turned(),
  beat,
  commit,
  announce: (text) => { $('sr-status').textContent = text; },
});
const kitPicker = createKitPicker($('kits'), { onPick: onPickKit, onClose: onKitsClosed });
const effects = createEffects({ audio: () => engine.ctx, format, onMade: useVideo, toast });
const strip = createStrip({
  wrap: $('grid-wrap'),
  map: $('strip-map'),
  view: $('strip-view'),
  dot: $('strip-dot'),
  back: $('strip-back'),
  next: $('strip-next'),
  turned: () => grid.turned(),
  onMove: touchGrid,
  smooth: () => !reducedMotion.matches,
});
const copySheet = createCopySheet({
  root: $('copy-sheet'),
  slotsBox: $('copy-slots'),
  soundsBox: $('copy-sounds'),
  rowTitle: $('copy-row-title'),
  slots: () => state.slots,
  current: () => state.slot,
  sounds: () => SOUNDS,
  onCopyBeat,
  onCopyRow,
  onToggle: onCopySheet,
});

const CLICKS = {
  'start-btn': onStart,
  play: () => togglePlay(),
  slower: () => changeTempo(-BPM_STEP),
  faster: () => changeTempo(BPM_STEP),
  surprise: () => commit(surprise(beat(), Math.random, kitStarters(beat().kit))),
  clear: onClear,
  undo,
  more: () => setMore(!isMoreOpen()),
  'last-video': () => showWatch(),
  help: () => { setMore(false); startTour('beats'); },
  'make-video': onMakeVideo,
  'rec-close': onRecordClose,
  'rec-retry': () => openRecordCamera(),
  'rec-btn': onRecordButton,
  mic: () => setMic(!micOn),
  'watch-back': () => backToBeats(),
  'watch-delete': onDelete,
  'watch-again': onMakeVideo,
  'watch-save': onSave,
  // An effect's Undo toast would swap the video under the open Effects, so it ends here.
  'watch-fx': () => { closeToast(); effects.open(lastVideo); },
  'toast-action': onToastAction,
  sounds: openKits,
  'sounds-tool': openKits,
  longer: onLonger,
  'longer-tool': onLonger,
  shorter: onShorter,
  double: onDouble,
  copy: () => copySheet.open(),
  'copy-close': () => copySheet.close(),
};

initTour(storage); // before the popstate and keydown listeners below, so the tour hears Back and Escape first
Object.entries(CLICKS).forEach(([id, handler]) => $(id).addEventListener('click', handler));
$('slots').addEventListener('click', onSlot);
// A touch pan sends pointercancel while the finger stays down, so touches end on touchend.
$('grid-wrap').addEventListener('pointerdown', () => { fingerDown = true; touchGrid(); }, { passive: true });
$('grid-wrap').addEventListener('wheel', touchGrid, { passive: true });
window.addEventListener('pointerup', fingerUp, { passive: true });
window.addEventListener('touchend', fingerUp, { passive: true });
window.addEventListener('touchcancel', fingerUp, { passive: true });
document.addEventListener('keydown', onKeydown);
document.addEventListener('pointerdown', wakeAudio, { passive: true });
document.addEventListener('pointerdown', closeMoreOutside, { passive: true });
document.addEventListener('pointerdown', (event) => { pointerType = event.pointerType; }, { passive: true });
document.addEventListener('mousedown', keepFocusOffButtons);
document.addEventListener('visibilitychange', () => { if (document.hidden) onHide(); });
window.addEventListener('pagehide', onHide);
window.addEventListener('popstate', onBack);
$('ring-left').style.strokeDasharray = String(RING);
render();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
