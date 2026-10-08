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
