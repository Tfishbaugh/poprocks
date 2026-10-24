// Lookahead scheduler: a 25 ms timer queues steps 100 ms ahead on the audio clock.
// Step times come from an anchor, never from adding durations up, so they don't drift.

export const LOOKAHEAD = 0.1;
export const INTERVAL_MS = 25;
export const START_DELAY = 0.05;

export function stepDuration(bpm) {
  return 60 / bpm / 4;
}

export function createScheduler({ now, onStep, steps = 16, bpm = 100, timers = globalThis }) {
  let timer = null;
  let anchorTime = 0;
  let anchorCount = 0;
  let count = 0;

  const timeOf = (n) => anchorTime + (n - anchorCount) * stepDuration(bpm);

  function anchor(time) {
    anchorTime = time;
    anchorCount = count;
  }

  function tick() {
    const at = now();
    // After a stall (a busy or hidden tab) restart from now instead of playing a burst.
    if (timeOf(count) < at) anchor(at + START_DELAY);
    while (timeOf(count) < at + LOOKAHEAD) {
      onStep(count % steps, timeOf(count));
      count += 1;
    }
  }

  return {
    start() {
      if (timer !== null) return;
      count = 0;
      anchor(now() + START_DELAY);
      tick();
      timer = timers.setInterval(tick, INTERVAL_MS);
    },
    stop() {
      if (timer === null) return;
      timers.clearInterval(timer);
      timer = null;
    },
    // A new tempo starts at the next step that isn't queued yet.
    setBpm(next) {
      if (timer !== null) anchor(timeOf(count));
      bpm = next;
    },
    tick,
    get playing() {
      return timer !== null;
    },
  };
}
