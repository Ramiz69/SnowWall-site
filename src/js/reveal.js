// Entrances: elements marked .reveal fade (and, with motion, rise 16px) the first time they
// come into view, staggered 60 ms within their group. Under Reduce Motion the CSS keeps it to
// opacity. Elements already on screen at load are shown at once.
//
// The same observer is the fallback for the scroll-linked steps in section 2 when the
// browser has no `animation-timeline`.
export function initReveal() {
  const els = [...document.querySelectorAll('.reveal')];
  const scrollTimeline = CSS.supports('animation-timeline: view()');
  if (!scrollTimeline) els.push(...document.querySelectorAll('.settle-steps li'));
  if (!('IntersectionObserver' in window)) { els.forEach(el => el.classList.add('in')); return; }
  const io = new IntersectionObserver(entries => {
    const batch = entries.filter(e => e.isIntersecting).map(e => e.target);
    batch.forEach((el, i) => {
      el.style.transitionDelay = `${Math.min(i, 8) * 60}ms`;
      el.classList.add('in');
      io.unobserve(el);
    });
  }, { rootMargin: '0px 0px -8% 0px' });
  els.forEach(el => io.observe(el));
}
