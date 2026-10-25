// The how-to tour: it lights one control at a time, with a card beside it saying what it does.
// The Beats tour runs on first open and the Watch tip on the first video; ❓ replays the tour.
// Steps find their control by id or data-tour name and skip any that isn't on screen, so
// controls that come and go (a kit button, an effects button a browser can't run) never break it.

import { el } from './dom.js';

export const TOUR_KEY = 'poprocks.tour';
const GAP = 16;
const RING = 8;

// Held notes (task 84 PR 3): a slide stretches a note. It has its own tour too, so kids who saw
// PR 2's new steps still see it once.
const STRETCH = { name: 'stretch', find: '#grid .pad', pic: '👇➡️', text: 'Hold a note, slide it longer' };

// Task 84: a row's name opens its sounds, a held note gets the key slider, and a slide stretches it.
const MIX = [
  { name: 'names', find: '#grid .sound', pic: '🎹▾', text: 'Tap a name to change sounds' },
  { name: 'hold', find: '#grid .pad.tuned', pic: '👇↕', text: 'Hold a note: higher or lower' },
  STRETCH,
];

export const TOURS = {
  beats: [
    { name: 'pads', find: '#grid .pad', pic: '👆', text: 'Tap squares to make a beat' },
    { name: 'play', find: '#play', pic: '▶️', text: 'Tap Play to hear it' },
    { name: 'video', find: '#make-video', pic: '🎥', text: 'Film a music video' },
    { name: 'slots', find: '#slots', pic: '1️⃣2️⃣3️⃣4️⃣', text: 'Keep 4 beats. Pick a number!' },
    { name: 'sounds', find: '#sounds, [data-tour="sounds"]', folded: '#sounds-tool', pic: '🎉🎸💖', text: 'Pick new sounds' },
    ...MIX,
    { name: 'longer', find: '#longer, [data-tour="longer"]', folded: '#longer-tool', pic: '➕', text: 'Make it longer' },
  ],
  // Task 84's new steps, once, for kids who already did the tour above (it covers them).
  mix: MIX,
  holds: [STRETCH],
  watch: [
    { name: 'effects', find: '#watch-fx, [data-tour="effects"]', pic: '🪄', text: 'Add magic effects' },
    { name: 'save', find: '#watch-save', pic: '💾', text: 'Save it to keep it!' },
  ],
};

// A tour that has another's steps marks that one seen too.
const COVERS = { beats: ['mix', 'holds'], mix: ['holds'] };

const shown = new Set();
let storage = null;
let ui = null;
let steps = [];
let index = 0;
let opener = null;
let entry = 0;
let ownPop = false;

const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

// Bad or missing saved data reads as "nothing seen yet".
export function readSeen(store) {
  try {
    const list = JSON.parse(store?.getItem(TOUR_KEY) ?? '[]');
    return new Set(Array.isArray(list) ? list : []);
  } catch {
    return new Set();
  }
}

function markSeen(name) {
  shown.add(name);
  try {
    storage?.setItem(TOUR_KEY, JSON.stringify([...readSeen(storage).add(name)]));
  } catch {
    // Private mode: it still won't show again until the page reloads.
  }
}

// The card's four places around the lit box, in the order they're tried, with the room left over.
function places(box, card, view) {
  const left = clamp(box.left + box.width / 2 - card.width / 2, GAP, view.width - card.width - GAP);
  const top = clamp(box.top + box.height / 2 - card.height / 2, GAP, view.height - card.height - GAP);
  return [
    { room: view.height - box.bottom - card.height, left, top: box.bottom + GAP },
    { room: box.top - card.height, left, top: box.top - GAP - card.height },
    { room: view.width - box.right - card.width, left: box.right + GAP, top },
    { room: box.left - card.width, left: box.left - GAP - card.width, top },
  ];
}

// The card goes below, above or beside the lit box, never over it; on a screen too small
// for any of those, it takes the side with the most room.
export function placeCard(box, card, view) {
  const all = places(box, card, view);
  const pick = all.find((place) => place.room >= 2 * GAP) ?? all.reduce((a, b) => (b.room > a.room ? b : a));
  return {
    left: clamp(pick.left, GAP, view.width - card.width - GAP),
    top: clamp(pick.top, GAP, view.height - card.height - GAP),
  };
}

function build() {
  const root = el('div', 'tour');
  const spot = el('div', 'tour-spot');
  const card = el('div', 'tour-card');
  const pic = el('p', 'tour-pic');
  const text = el('p', 'tour-text');
  const dots = el('p', 'tour-dots');
  const skip = el('button', 'btn tour-skip', 'Skip');
  const next = el('button', 'btn btn-play tour-next');
  const buttons = el('div', 'tour-buttons');
  root.hidden = true;
  text.id = 'tour-text';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');
  card.setAttribute('aria-labelledby', 'tour-text');
  pic.setAttribute('aria-hidden', 'true');
  dots.setAttribute('role', 'img');
  skip.type = 'button';
  next.type = 'button';
  next.append(el('span', 'lbl'));
  buttons.append(skip, next);
  card.append(pic, text, dots, buttons);
  root.append(spot, card);
  document.body.append(root);
  skip.addEventListener('click', close);
  next.addEventListener('click', advance);
  spot.addEventListener('click', advance);
  return { root, spot, card, pic, text, dots, skip, next };
}

const isShown = (node) => node.getClientRects().length > 0;

// On a phone on its side some controls fold under More; their step points at More instead.
// A folded control keeps its own display while the closed tray hides it.
function foldedUnderMore(step) {
  const control = step.folded && document.querySelector(step.folded);
  const more = document.getElementById('more');
  if (!control || !more || !isShown(more)) return null;
  return getComputedStyle(control).display === 'none' ? null : more;
}

const findTarget = (step) => [...document.querySelectorAll(step.find)].find(isShown) ?? foldedUnderMore(step);
const isOpen = () => Boolean(ui && !ui.root.hidden);

function inflate(rect) {
  return {
    left: rect.left - RING,
    top: rect.top - RING,
    right: rect.right + RING,
    bottom: rect.bottom + RING,
    width: rect.width + 2 * RING,
    height: rect.height + 2 * RING,
  };
}

function setBox(node, box) {
  node.style.left = `${box.left}px`;
  node.style.top = `${box.top}px`;
  node.style.width = `${box.width}px`;
  node.style.height = `${box.height}px`;
}

function dot(current) {
  return el('span', current ? 'tour-dot now' : 'tour-dot');
}

function fillCard(step) {
  const last = index === steps.length - 1;
  ui.root.dataset.step = step.name;
  ui.pic.textContent = step.pic;
  ui.text.textContent = step.text;
  ui.dots.replaceChildren(...steps.map((_, i) => dot(i === index)));
  ui.dots.setAttribute('aria-label', `Step ${index + 1} of ${steps.length}`);
  ui.next.firstChild.textContent = last ? 'Got it!' : 'Next →';
  ui.skip.hidden = last;
}

// Draws the current step; a control that has gone (the screen turned, say) moves it on.
function render() {
  const target = findTarget(steps[index]);
  if (!target) return advance();
  target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  fillCard(steps[index]);
  if (target.id === 'more') ui.text.textContent += ': tap More';
  const box = inflate(target.getBoundingClientRect());
  const view = { width: ui.root.clientWidth, height: ui.root.clientHeight };
  const at = placeCard(box, { width: ui.card.offsetWidth, height: ui.card.offsetHeight }, view);
  setBox(ui.spot, box);
  ui.card.style.left = `${at.left}px`;
  ui.card.style.top = `${at.top}px`;
  ui.next.focus({ preventScroll: true });
}

function advance() {
  index += 1;
  if (index >= steps.length) return close();
  render();
}

// Back (a phone's gesture, a browser's button) acts as Skip, so the tour gets its own history entry.
export function startTour(name) {
  if (isOpen()) return;
  steps = TOURS[name].filter(findTarget);
  if (!steps.length) return;
  ui ??= build();
  [name, ...(COVERS[name] ?? [])].forEach(markSeen);
  index = 0;
  opener = document.activeElement;
  entry = Date.now();
  history.pushState({ ...history.state, poprocksTour: entry }, '');
  ui.root.hidden = false;
  render();
}

export function tourOnce(name) {
  if (shown.has(name) || readSeen(storage).has(name)) return;
  startTour(name);
}

function close() {
  if (!isOpen()) return;
  ui.root.hidden = true;
  if (history.state?.poprocksTour === entry) {
    ownPop = true;
    history.back();
  }
  const back = opener?.isConnected && isShown(opener) ? opener : document.getElementById('more');
  if (back && isShown(back)) back.focus({ preventScroll: true });
}

// The tour's own Back, or the one that closes it, never reaches the screens underneath.
function onPop(event) {
  if (!ownPop && !isOpen()) return;
  event.stopImmediatePropagation();
  if (!ownPop) return close();
  ownPop = false;
}

function cycleFocus(backwards) {
  const buttons = [ui.skip, ui.next].filter(isShown);
  const at = buttons.indexOf(document.activeElement);
  buttons.at((at + (backwards ? -1 : 1)) % buttons.length).focus();
}

// Escape skips, Tab stays on the card, and keys meant for the beat (Space plays) wait.
function onKey(event) {
  if (!isOpen()) return;
  const onCard = ui.card.contains(event.target);
  if (event.key !== 'Escape' && event.key !== 'Tab' && onCard) return;
  event.preventDefault();
  event.stopPropagation();
  if (event.key === 'Escape') return close();
  if (event.key === 'Tab') cycleFocus(event.shiftKey);
}

// Call once, before the app's own popstate and keydown listeners, so the tour hears them first.
export function initTour(store) {
  storage = store;
  window.addEventListener('popstate', onPop, true);
  document.addEventListener('keydown', onKey, true);
  window.addEventListener('resize', () => { if (isOpen()) render(); });
}
