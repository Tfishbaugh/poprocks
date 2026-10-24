// The long strip's helpers: ❮ ❯ move a screenful, the map shows where you are and where
// the beat is playing, and tapping or dragging the map jumps there. Upright screens scroll
// down, wide ones across; the map is a timeline either way.

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

  // A screenful, less the pinned sound names, so the next unseen step lands right after them.
  function page(direction) {
    const a = axis();
    onMove();
    wrap.scrollBy({ [a.key]: direction * (wrap[a.client] - namesSize()), behavior: smooth() ? 'smooth' : 'auto' });
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
