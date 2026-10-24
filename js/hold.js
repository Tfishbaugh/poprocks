// Press and hold a square (task 84). A press that stays put for HOLD_MS pops the square and
// becomes a hold: the page doesn't scroll under it, and the click that ends it doesn't toggle it.
// A finger that moves more than SLOP first is a scroll, and nothing happens.
//
// Each hook gets a note, { pad, track, step }, or null off the squares:
// - onHold(note): the square just popped (held notes turn an empty square into a note here);
// - onMove(note, event): the held finger moved (held notes stretch along the row here);
// - onLift(note, { moved }): the finger came up; `moved` says it slid off the square it held,
//   so main.js opens the note panel only when it didn't;
// - onCancel(note): the browser took the touch away.

export const HOLD_MS = 250;
export const SLOP = 10;

export function noteOf(pad) {
  return pad ? { pad, track: Number(pad.dataset.track), step: Number(pad.dataset.step) } : null;
}

export function padUnder(event) {
  return document.elementFromPoint(event.clientX, event.clientY)?.closest('.pad') ?? null;
}

export function createHold(root, { onHold = () => {}, onMove = () => {}, onLift = () => {}, onCancel = () => {} }) {
  let press = null;
  let swallow = false;

  function end() {
    clearTimeout(press?.timer);
    press?.pad.classList.remove('held');
    press = null;
  }

  function hold() {
    press.held = true;
    press.pad.classList.add('held');
    navigator.vibrate?.(15);
    onHold(noteOf(press.pad));
  }

  function onDown(event) {
    swallow = false;
    const pad = event.target.closest('.pad');
    if (press || !pad || !event.isPrimary || event.button > 0) return;
    press = { pad, id: event.pointerId, x: event.clientX, y: event.clientY, held: false, moved: false };
    press.timer = setTimeout(hold, HOLD_MS);
  }

  function onPointerMove(event) {
    if (event.pointerId !== press?.id) return;
    if (!press.held && Math.hypot(event.clientX - press.x, event.clientY - press.y) > SLOP) return end();
    if (!press.held) return;
    const pad = padUnder(event);
    press.moved ||= pad !== press.pad;
    onMove(noteOf(pad), event);
  }

  function onUp(event) {
    if (event.pointerId !== press?.id) return;
    const { pad, held, moved } = press;
    end();
    if (!held) return;
    swallow = true;
    onLift(noteOf(pad), { moved });
  }

  function onPointerCancel(event) {
    if (event.pointerId !== press?.id) return;
    const { pad, held } = press;
    end();
    if (held) onCancel(noteOf(pad));
  }

  // A hold's own click never toggles the square. If the browser sends none, the next press resets it.
  function onClick(event) {
    if (!swallow) return;
    swallow = false;
    event.stopImmediatePropagation();
    event.preventDefault();
  }

  root.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onPointerCancel);
  root.addEventListener('click', onClick, true);
  // Once held, a finger's slide belongs to the hold, not a scroll; a long press opens no menu.
  root.addEventListener('touchmove', (event) => { if (press?.held) event.preventDefault(); }, { passive: false });
  root.addEventListener('contextmenu', (event) => { if (press) event.preventDefault(); });

  return {
    get holding() {
      return Boolean(press?.held);
    },
  };
}
