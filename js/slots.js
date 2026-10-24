// Four beat slots, one per kid, saved to localStorage on every change.

import { STARTERS, copyBeat, emptyBeat, isValidBeat } from './pattern.js';

export const SLOT_COUNT = 4;
export const STORAGE_KEY = 'poprocks.v1';

export function defaultState() {
  const slots = Array.from({ length: SLOT_COUNT }, () => emptyBeat());
  slots[0] = copyBeat(STARTERS[0]);
  return { slot: 0, slots };
}

function readRaw(storage) {
  try {
    return storage?.getItem(STORAGE_KEY) ?? null;
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

// Anything unreadable falls back to the defaults, one slot at a time.
export function loadState(storage) {
  const saved = parse(readRaw(storage));
  const fallback = defaultState();
  if (!saved || !Array.isArray(saved.slots)) return fallback;
  const slots = fallback.slots.map((def, i) => (isValidBeat(saved.slots[i]) ? copyBeat(saved.slots[i]) : def));
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
