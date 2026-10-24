import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SLOT_COUNT, STORAGE_KEY, defaultState, loadState, saveState } from '../../js/slots.js';
import { STARTERS, emptyBeat, isEmpty, toggle, withBpm } from '../../js/pattern.js';

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    data,
  };
}

test('a first visit gets a starter beat in slot 1 and empty slots 2 to 4', () => {
  const state = loadState(memoryStorage());
  assert.equal(state.slot, 0);
  assert.equal(state.slots.length, SLOT_COUNT);
  assert.deepEqual(state.slots[0].rows, STARTERS[0].rows);
  state.slots.slice(1).forEach((beat) => assert.ok(isEmpty(beat)));
});

test('all 4 slots save and load', () => {
  const storage = memoryStorage();
  const state = defaultState();
  state.slots = state.slots.map((_, i) => withBpm(toggle(emptyBeat(), i, i * 3), 80 + i * 20));
  state.slot = 3;
  assert.equal(saveState(storage, state), true);
  const loaded = loadState(storage);
  assert.deepEqual(loaded, state);
});

test('slots are independent', () => {
  const storage = memoryStorage();
  const state = defaultState();
  state.slots[1] = toggle(state.slots[1], 4, 4);
  saveState(storage, state);
  const loaded = loadState(storage);
  assert.ok(isEmpty(loaded.slots[2]));
  assert.ok(!isEmpty(loaded.slots[1]));
  assert.deepEqual(loaded.slots[0].rows, STARTERS[0].rows);
});

test('corrupt storage falls back safely', () => {
  const cases = ['not json', '{', 'null', '42', '"text"', '[]', '{"slots": "nope"}', '{"slot": 2}'];
  cases.forEach((raw) => {
    const state = loadState(memoryStorage({ [STORAGE_KEY]: raw }));
    assert.deepEqual(state, defaultState(), raw);
  });
});

test('one bad slot falls back without losing the good ones', () => {
  const good = toggle(emptyBeat(120), 1, 1);
  const raw = JSON.stringify({ slot: 1, slots: [{ bpm: 'x' }, good, null, { bpm: 100, rows: ['xx'] }] });
  const state = loadState(memoryStorage({ [STORAGE_KEY]: raw }));
  assert.equal(state.slot, 1);
  assert.deepEqual(state.slots[1], good);
  assert.deepEqual(state.slots[0].rows, STARTERS[0].rows);
  assert.ok(isEmpty(state.slots[2]));
  assert.ok(isEmpty(state.slots[3]));
});

test('a bad slot number falls back to slot 1', () => {
  [-1, 4, 1.5, '2', null].forEach((slot) => {
    const raw = JSON.stringify({ ...defaultState(), slot });
    assert.equal(loadState(memoryStorage({ [STORAGE_KEY]: raw })).slot, 0, String(slot));
  });
});

test('extra fields in storage are dropped', () => {
  const state = defaultState();
  state.slots[0] = { ...state.slots[0], evil: '<script>' };
  const loaded = loadState(memoryStorage({ [STORAGE_KEY]: JSON.stringify(state) }));
  assert.deepEqual(Object.keys(loaded.slots[0]).sort(), ['bpm', 'rows']);
});

test('storage that throws (private mode, blocked) never breaks the app', () => {
  const throwing = {
    getItem() { throw new Error('SecurityError'); },
    setItem() { throw new Error('QuotaExceededError'); },
  };
  assert.deepEqual(loadState(throwing), defaultState());
  assert.equal(saveState(throwing, defaultState()), false);
  assert.deepEqual(loadState(null), defaultState());
  assert.equal(saveState(null, defaultState()), false);
});
