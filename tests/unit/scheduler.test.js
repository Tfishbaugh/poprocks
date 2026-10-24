import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INTERVAL_MS, LOOKAHEAD, START_DELAY, createScheduler, stepDuration } from '../../js/scheduler.js';

const EPS = 1e-9;

// A fake audio clock and timer: the test moves time and calls tick() itself.
function rig(bpm = 120) {
  const clock = { t: 0 };
  const steps = [];
  const timers = { setInterval: () => 1, clearInterval: () => {} };
  const scheduler = createScheduler({ now: () => clock.t, onStep: (step, time) => steps.push({ step, time }), bpm, timers });
  const run = (seconds, interval = INTERVAL_MS / 1000) => {
    const end = clock.t + seconds;
    while (clock.t < end) {
      clock.t += interval;
      scheduler.tick();
    }
  };
  return { clock, steps, scheduler, run };
}

test('step times are exact from 60 to 180 BPM', () => {
  for (let bpm = 60; bpm <= 180; bpm += 10) {
    const { steps, scheduler, run } = rig(bpm);
    scheduler.start();
    run(4);
    steps.forEach(({ step, time }, n) => {
      assert.equal(step, n % 16);
      assert.ok(Math.abs(time - (START_DELAY + n * stepDuration(bpm))) < EPS, `${bpm} BPM step ${n}`);
    });
    assert.ok(steps.length >= 4 / stepDuration(bpm) - 1, `${bpm} BPM queued ${steps.length}`);
  }
});

test('a 16th note at 120 BPM lasts 125 ms', () => {
  assert.equal(stepDuration(120), 0.125);
});

test('each step is queued once, even with uneven timer ticks', () => {
  const { clock, steps, scheduler } = rig(140);
  scheduler.start();
  const jitter = [0.003, 0.05, 0.02, 0.09, 0.001, 0.07, 0.04];
  for (let i = 0; i < 400; i += 1) {
    clock.t += jitter[i % jitter.length];
    scheduler.tick();
  }
  steps.forEach(({ time }, n) => {
    assert.ok(Math.abs(time - (START_DELAY + n * stepDuration(140))) < EPS);
  });
  const times = steps.map(({ time }) => time);
  assert.equal(new Set(times).size, times.length);
});

test('notes are always queued ahead of the clock, never behind it', () => {
  const { clock, scheduler } = rig(180);
  const late = [];
  const timers = { setInterval: () => 1, clearInterval: () => {} };
  const watched = createScheduler({
    now: () => clock.t,
    onStep: (_, time) => { if (time < clock.t) late.push(time); },
    bpm: 180,
    timers,
  });
  watched.start();
  for (let i = 0; i < 500; i += 1) {
    clock.t += 0.025;
    watched.tick();
  }
  assert.deepEqual(late, []);
  scheduler.stop();
});

test('a tempo change mid-beat keeps queued notes and starts at the next step', () => {
  const { steps, scheduler, run } = rig(100);
  scheduler.start();
  run(1);
  const before = steps.length;
  const last = steps[before - 1];
  scheduler.setBpm(150);
  run(1);
  const after = steps.slice(before);
  assert.ok(after.length > 0);
  // The first new step lands one old step after the last queued one, then the new spacing applies.
  assert.ok(Math.abs(after[0].time - (last.time + stepDuration(100))) < EPS);
  after.forEach(({ time }, i) => {
    assert.ok(Math.abs(time - (after[0].time + i * stepDuration(150))) < EPS);
  });
  assert.equal(after[0].step, (last.step + 1) % 16);
});

test('no drift over 10,000 steps', () => {
  const { steps, scheduler, run } = rig(173);
  scheduler.start();
  run(10_000 * stepDuration(173) + 1, 0.025);
  assert.ok(steps.length >= 10_000);
  const n = 9_999;
  assert.ok(Math.abs(steps[n].time - (START_DELAY + n * stepDuration(173))) < 1e-9);
  assert.equal(steps[n].step, n % 16);
});

test('after a stall it restarts from now instead of playing a burst of late notes', () => {
  const { clock, steps, scheduler, run } = rig(120);
  scheduler.start();
  run(0.5);
  const before = steps.length;
  clock.t += 2; // the tab was busy for 2 seconds
  scheduler.tick();
  const after = steps.slice(before);
  after.forEach(({ time }) => assert.ok(time >= clock.t));
  assert.ok(after.length <= Math.ceil(LOOKAHEAD / stepDuration(120)) + 1);
});

test('start and stop', () => {
  const { scheduler } = rig();
  assert.equal(scheduler.playing, false);
  scheduler.start();
  assert.equal(scheduler.playing, true);
  scheduler.stop();
  assert.equal(scheduler.playing, false);
});

test('a beat made longer mid-play carries on into the new steps', () => {
  const { steps, scheduler, run } = rig(120);
  scheduler.start();
  run(1); // 8 steps queued at 120 BPM (plus lookahead)
  const before = steps.length;
  scheduler.setSteps(32);
  run(4);
  const last = steps[before - 1].step;
  steps.slice(before).forEach(({ step }, i) => assert.equal(step, (last + 1 + i) % 32));
});

test('a beat made shorter mid-play wraps to the start', () => {
  const { steps, scheduler, run } = rig(120);
  scheduler.setSteps(64);
  scheduler.start();
  run(5); // well past step 16
  scheduler.setSteps(16);
  const before = steps.length;
  run(2);
  steps.slice(before).forEach(({ step }) => assert.ok(step < 16));
});

test('a 64-step beat loops back to step 1 exactly', () => {
  const { steps, scheduler, run } = rig(150);
  scheduler.setSteps(64);
  scheduler.start();
  run(64 * stepDuration(150) * 2 + 0.5);
  assert.equal(steps[63].step, 63);
  assert.equal(steps[64].step, 0);
  assert.ok(Math.abs(steps[64].time - (START_DELAY + 64 * stepDuration(150))) < EPS);
});
