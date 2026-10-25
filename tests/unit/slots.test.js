import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OLD_KEY, SLOT_COUNT, STORAGE_KEY, defaultState, loadState, saveState } from '../../js/slots.js';
import { DEFAULT_SOUNDS, STARTERS, emptyBeat, isEmpty, toggle, withBpm, withLift, withSound } from '../../js/pattern.js';
import { kitById } from '../../js/sounds.js';

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
  assert.deepEqual(Object.keys(loaded.slots[0]).sort(), ['bpm', 'pitch', 'rows', 'sounds']);
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

test('a 64-step beat with its own sounds and lifts saves and loads', () => {
  const storage = memoryStorage();
  const state = defaultState();
  state.slots[2] = withLift(withSound(toggle(emptyBeat(140, 64), 5, 60), 5, 'riff'), 5, 60, -3);
  saveState(storage, state);
  assert.deepEqual(loadState(storage).slots[2], state.slots[2]);
});

test('a saved beat with a broken length falls back for that slot only', () => {
  const state = defaultState();
  const raw = JSON.stringify({ ...state, slots: [state.slots[0], { bpm: 100, rows: emptyBeat(100, 20).rows }, state.slots[2], state.slots[3]] });
  const loaded = loadState(memoryStorage({ [STORAGE_KEY]: raw }));
  assert.deepEqual(loaded.slots[1], emptyBeat());
  assert.deepEqual(loaded.slots[0], state.slots[0]);
});

// ---- Saves move to poprocks.v2 (task 84) ----

const v1 = (slots) => JSON.stringify({ slot: 0, slots });
const ids = (id) => kitById(id).sounds.map((sound) => sound.id);
const oldBeat = (kit) => ({ bpm: 100, rows: emptyBeat().rows.map((r, i) => (i === 1 ? 'x'.repeat(16) : r)), kit });

test('v1 beats load once from the old key, each kit as its 8 sounds', () => {
  const storage = memoryStorage({ [OLD_KEY]: v1([oldBeat('rock'), oldBeat('kpop'), oldBeat('party'), { bpm: 90, rows: emptyBeat().rows }]) });
  const loaded = loadState(storage);
  assert.deepEqual(loaded.slots.map((beat) => beat.sounds), [ids('rock'), ids('kpop'), ids('party'), ids('party')]);
  assert.equal(loaded.slots[0].rows[1], 'x'.repeat(16));
  assert.deepEqual(loaded.slots[0].pitch, emptyBeat().pitch, 'old notes play as written');
});

test('an unknown kit or sound gets that row’s Party sound', () => {
  const unknown = { ...oldBeat('disco') };
  const odd = { ...oldBeat(undefined), sounds: [...ids('rock').slice(0, 7), 'theremin'] };
  const loaded = loadState(memoryStorage({ [STORAGE_KEY]: v1([unknown, odd]) }));
  assert.deepEqual(loaded.slots[0].sounds, DEFAULT_SOUNDS);
  assert.deepEqual(loaded.slots[1].sounds, [...ids('rock').slice(0, 7), 'boing']);
});

test('saving writes v2 and leaves v1 for an old cached app; v2 wins when both are there', () => {
  const old = v1([oldBeat('rock')]);
  const storage = memoryStorage({ [OLD_KEY]: old });
  const state = loadState(storage);
  state.slots[0] = withSound(state.slots[0], 0, 'hey');
  saveState(storage, state);
  assert.equal(STORAGE_KEY, 'poprocks.v2');
  assert.equal(storage.data.get(OLD_KEY), old);
  assert.equal(loadState(storage).slots[0].sounds[0], 'hey');
});

test('a beat of 12 rows saves and loads', () => {
  const storage = memoryStorage();
  const state = defaultState();
  const base = emptyBeat();
  state.slots[1] = { ...base, rows: [...base.rows, ...base.rows.slice(0, 4)], sounds: [...base.sounds, 'riff', 'hey', 'bell', 'tom'], pitch: [...base.pitch, ...base.pitch.slice(0, 4)] };
  saveState(storage, state);
  assert.deepEqual(loadState(storage).slots[1], state.slots[1]);
});
