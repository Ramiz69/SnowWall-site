// One place that decides whether the page moves. `?motion=reduced` forces the
// Reduce Motion path for testing; theme-init.js mirrors the same rule as the `rm` class.
const mq = matchMedia('(prefers-reduced-motion: reduce)');
const forced = /[?&]motion=reduced/.test(location.search);
const subs = new Set();

export const motion = {
  get reduced() { return forced || mq.matches; },
  subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
};

mq.addEventListener('change', () => {
  document.documentElement.classList.toggle('rm', motion.reduced);
  for (const fn of subs) fn();
});

// Global pointer, in viewport coordinates. Touch is ignored: a finger is not a cursor.
export const pointer = { x: -1e5, y: -1e5, on: false };
addEventListener('pointermove', e => {
  if (e.pointerType === 'touch') return;
  pointer.x = e.clientX; pointer.y = e.clientY; pointer.on = true;
}, { passive: true });
document.addEventListener('pointerleave', () => { pointer.on = false; });
addEventListener('blur', () => { pointer.on = false; });

// Theme changes (toggle or system) are announced on the document.
export function onTheme(fn) {
  document.addEventListener('sw:theme', fn);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', fn);
}
