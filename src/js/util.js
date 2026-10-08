// Run `fn` once, the first time `el` comes within `margin` of the viewport.
export function whenNear(el, fn, margin = '400px') {
  if (!el) return;
  const io = new IntersectionObserver(entries => {
    if (entries.some(e => e.isIntersecting)) { io.disconnect(); fn(); }
  }, { rootMargin: `${margin} 0px` });
  io.observe(el);
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const lang = document.documentElement.lang || 'en';
