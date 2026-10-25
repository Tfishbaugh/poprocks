// Four beat slots, one per kid, saved to localStorage on every change.
// Saves are `poprocks.v2` (task 84: a sound per row, and pitch). The first time, v1 is read and
// left as it was, so an old cached app still sees its own beats and can't wipe the new ones.

import { DEFAULT_SOUNDS, STARTERS, copyBeat, emptyBeat, isValidBeat } from './pattern.js';
import { isSound, kitById } from './sounds.js';

export const SLOT_COUNT = 4;
export const STORAGE_KEY = 'poprocks.v2';
export const OLD_KEY = 'poprocks.v1';

export function defaultState() {
  const slots = Array.from({ length: SLOT_COUNT }, () => emptyBeat());
  slots[0] = copyBeat(STARTERS[0]);
  return { slot: 0, slots };
}

function read(storage, key) {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function parse(raw) {
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isSlotIndex(value) {
  return Number.isInteger(value) && value >= 0 && value < SLOT_COUNT;
}

// A v1 beat names one kit: it gets that kit's sounds. A sound this app doesn't have gets the
// row's Party sound.
function upgrade(saved) {
  const ids = saved.sounds ?? kitById(saved.kit).sounds.map((sound) => sound.id);
  const sounds = saved.rows.map((_, i) => (isSound(ids[i]) ? ids[i] : DEFAULT_SOUNDS[i % DEFAULT_SOUNDS.length]));
  return copyBeat({ ...saved, sounds });
}

// Anything unreadable falls back to the defaults, one slot at a time.
export function loadState(storage) {
  const saved = parse(read(storage, STORAGE_KEY) ?? read(storage, OLD_KEY));
  const fallback = defaultState();
  if (!saved || !Array.isArray(saved.slots)) return fallback;
  const slots = fallback.slots.map((def, i) => (isValidBeat(saved.slots[i]) ? upgrade(saved.slots[i]) : def));
  return { slot: isSlotIndex(saved.slot) ? saved.slot : 0, slots };
}

export function saveState(storage, state) {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
