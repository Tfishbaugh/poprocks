// The long strip's helpers: ❮ ❯ move a screenful, the map shows where you are and where
// the beat is playing, and tapping or dragging the map jumps there. Upright screens scroll
// down, wide ones across; the map is a timeline either way.

const NEAR = 20;

const AXES = {
  across: { pos: 'scrollLeft', size: 'scrollWidth', client: 'clientWidth', key: 'left', names: 'width' },
  down: { pos: 'scrollTop', size: 'scrollHeight', client: 'clientHeight', key: 'top', names: 'height' },
};

export function createStrip({ wrap, map, view, dot, back, next, turned, onMove, smooth }) {
  let dragging = false;
  let queued = false;

  const axis = () => AXES[turned() ? 'down' : 'across'];
  const namesSize = () => wrap.querySelector('.sound')?.getBoundingClientRect()[axis().names] ?? 0;

  function update() {
    queued = false;
    const a = axis();
    const total = Math.max(1, wrap[a.size]);
    const shown = wrap[a.client];
    const pos = wrap[a.pos];
    view.style.left = `${(pos / total) * 100}%`;
    view.style.width = `${Math.min(1, shown / total) * 100}%`;
    back.disabled = pos <= 1;
    next.disabled = pos + shown >= total - 1;
  }

  function queueUpdate() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  }

  // How far each 16-step section starts past the pinned sound names (negative: already passed).
  function barOffsets() {
    const a = axis();
    const edge = wrap.getBoundingClientRect()[a.key] + namesSize(); // where the pinned names end
    const starts = wrap.querySelectorAll('.pad[data-track="0"]:is([data-step="0"], .bar-start)');
    return [...starts].map((pad) => pad.getBoundingClientRect()[a.key] - edge);
  }

  // The next (or previous) section start when it's within a screenful, so pads never sit half
  // under the names; otherwise a screenful, which lands right after them.
  function page(direction) {
    const a = axis();
    const screen = wrap[a.client] - namesSize();
    const offsets = barOffsets();
    // A start within half a pad of the names is the one on screen now, not the next one.
    const target = direction > 0 ? offsets.find((d) => d > NEAR) : offsets.filter((d) => d < -NEAR).pop();
    const jump = target !== undefined && Math.abs(target) <= screen + 1 ? target : direction * screen;
    const to = Math.max(0, wrap[a.pos] + jump);
    onMove();
    // Near the start means the start, padding and all.
    wrap.scrollTo({ [a.key]: to <= NEAR ? 0 : to, behavior: smooth() ? 'smooth' : 'auto' });
  }

  function jumpTo(event) {
    const box = map.getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
    const a = axis();
    onMove();
    wrap.scrollTo({ [a.key]: fraction * wrap[a.size] - wrap[a.client] / 2 });
  }

  function onDown(event) {
    dragging = true;
    map.setPointerCapture?.(event.pointerId);
    jumpTo(event);
  }

  function onDrag(event) {
    if (dragging) jumpTo(event);
  }

  back.addEventListener('click', () => page(-1));
  next.addEventListener('click', () => page(1));
  map.addEventListener('pointerdown', onDown);
  map.addEventListener('pointermove', onDrag);
  map.addEventListener('pointerup', () => { dragging = false; });
  map.addEventListener('pointercancel', () => { dragging = false; });
  wrap.addEventListener('scroll', queueUpdate, { passive: true });
  // Re-measure when the screen appears, turns, or the strip gets longer or shorter.
  const sizes = new ResizeObserver(queueUpdate);
  sizes.observe(wrap);
  sizes.observe(wrap.firstElementChild);

  return {
    update: queueUpdate,
    // Where the beat is playing, as a dot on the map (-1 hides it).
    setPlay(step, steps) {
      dot.hidden = step < 0;
      dot.style.left = `${((step + 0.5) / steps) * 100}%`;
    },
    // Scrolls so this pad's step comes first after the pinned names.
    showStep(pad) {
      const a = axis();
      const offset = pad.getBoundingClientRect()[a.key] - wrap.getBoundingClientRect()[a.key] - namesSize();
      wrap.scrollBy({ [a.key]: offset, behavior: smooth() ? 'smooth' : 'auto' });
    },
  };
}
