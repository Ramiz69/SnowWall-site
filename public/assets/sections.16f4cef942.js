import { Weather } from './weather.b80f0fd2b2.js';
import { motion } from './motion.fbf57fc8e4.js';
import { $, $$, whenNear, lang } from './util.0f60c0292c.js';
const playIn = root => $('.section-play', root);
export function initSettle() {
const stage = $('.settle-stage');
if (!stage) return;
whenNear(stage, () => {
new Weather({
host: stage, name: 'settle',
back: $('.layer.back', stage), front: $('.layer.front', stage),
rects: [$('.mock', stage)], playBtn: playIn(stage), density: .8,
}).start();
});
}
export function initGallery(hero) {
const section = $('.seasons');
if (!section) return;
const cards = $$('.card', section);
const note = $('.seasons-note', section);
let bg = null, current = 'snow';
whenNear(section, () => {
bg = new Weather({
host: section, name: 'seasons', back: $('.layer.back', section),
ground: false, density: .45, maxParts: 500, maxDpr: 1, playBtn: playIn(section), effect: current,
});
bg.start();
});
whenNear($('.cards', section), () => {
for (const card of cards) {
const poster = $('.poster', card);
const still = new Weather({ host: poster, back: $('canvas', poster), effect: card.dataset.effect, still: true, ground: false, pointer: false, tune: { size: 1.7, amount: 1.3 } });
requestAnimationFrame(() => still.resize());
}
}, '600px');
const videos = $$('video', section);
if (videos.length) {
const io = new IntersectionObserver(entries => {
for (const e of entries) {
const v = e.target;
if (e.isIntersecting && !motion.reduced) v.play().catch(() => {}); else v.pause();
}
}, { threshold: .25 });
videos.forEach(v => io.observe(v));
motion.subscribe(() => videos.forEach(v => motion.reduced ? v.pause() : null));
}
const select = (id, announce) => {
current = id;
for (const c of cards) c.setAttribute('aria-pressed', String(c.dataset.effect === id));
if (bg) bg.setEffect(id);
if (announce && note) {
const name = $(`.card[data-effect="${id}"] .card-name`, section)?.textContent || id;
note.textContent = note.dataset.template.replace('{name}', name);
}
};
const fromHero = hero?.onChange(id => select(id, false));
for (const card of cards) card.addEventListener('click', () => { select(card.dataset.effect, true); hero?.show(card.dataset.effect, { from: fromHero }); });
}
export function initAmbient() {
const section = $('.ambient');
if (!section) return;
const time = $('.clock-time', section), date = $('.clock-date', section);
const tf = new Intl.DateTimeFormat(lang, { hour: 'numeric', minute: '2-digit' });
const df = new Intl.DateTimeFormat(lang, { weekday: 'long', day: 'numeric', month: 'long' });
let timer = 0;
const tick = () => {
const now = new Date();
time.textContent = tf.format(now);
date.textContent = df.format(now);
timer = setTimeout(tick, 1000 - now.getMilliseconds() + 20);
};
new IntersectionObserver(([e]) => { clearTimeout(timer); if (e.isIntersecting) tick(); }).observe(section);
whenNear(section, () => {
new Weather({ host: section, name: 'ambient', back: $('.layer.back', section), playBtn: playIn(section), density: 1.1 }).start();
});
}
export function initTune() {
const view = $('.tune-view');
const form = $('.sliders');
if (!view || !form) return;
const nf1 = new Intl.NumberFormat(lang, { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const nf0 = new Intl.NumberFormat(lang);
const still = form.closest('.tune').dataset.still || '';
let w = null;
const read = () => {
const v = id => parseFloat(form.elements[id].value);
return { size: v('size') / 14, speed: v('speed') / 1.5, wind: v('wind'), amount: v('amount') / 1500 };
};
const label = input => {
const v = parseFloat(input.value), u = input.dataset.unit, out = form.querySelector(`output[for="${input.id}"]`);
let text;
if (input.name === 'wind') text = Math.abs(v) < .05 ? still : `${nf1.format(Math.abs(v))} ${v < 0 ? input.dataset.from : input.dataset.to}`;
else if (input.name === 'speed') text = `${nf1.format(v)}${u}`;
else if (u) text = `${nf0.format(v)} ${u}`;
else text = nf0.format(v);
out.textContent = text;
input.setAttribute('aria-valuetext', text);
const pct = (v - input.min) / (input.max - input.min) * 100;
input.style.setProperty('--v', `${pct}%`);
};
const update = () => { $$('input[type=range]', form).forEach(label); if (w) w.setTune(read()); };
form.addEventListener('input', update);
form.addEventListener('reset', () => setTimeout(update));
form.addEventListener('submit', e => e.preventDefault());
update();
whenNear(view, () => {
w = new Weather({ host: view, name: 'tune', back: $('.layer.back', view), playBtn: playIn(view), maxParts: 1200 });
w.setTune(read());
w.start();
});
}
export function initBehind() {
const section = $('.behind');
if (!section) return;
const desk = $('.desk', section), mock = $('.mock', desk), sw = $('.switch-btn', section);
let w = null, p = 0, ticking = false, visible = false, manual = false;
const apply = v => {
p = v;
section.style.setProperty('--p', v.toFixed(3));
section.classList.toggle('is-behind', v > .5);
sw.setAttribute('aria-checked', String(v > .5));
if (w) { w.occlusion = v; if (w.reduced()) w.draw(); }
};
const fromScroll = () => {
ticking = false;
if (motion.reduced) return;
const r = section.getBoundingClientRect(), span = r.height - innerHeight;
const raw = span > 0 ? -r.top / span : 0;
apply(Math.min(1, Math.max(0, (raw - .3) / .4)));     // the change happens in the middle 40%
};
const onScroll = () => { if (visible && !ticking) { ticking = true; requestAnimationFrame(fromScroll); } };
new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) onScroll(); }).observe(section);
addEventListener('scroll', onScroll, { passive: true });
motion.subscribe(() => { if (!motion.reduced) onScroll(); else apply(manual ? 1 : 0); });
sw.addEventListener('click', () => {
const toBehind = p <= .5;
if (motion.reduced) { manual = toBehind; apply(toBehind ? 1 : 0); return; }
const r = section.getBoundingClientRect(), span = r.height - innerHeight;
const y = scrollY + r.top + span * (toBehind ? .75 : .25);
scrollTo({ top: y, behavior: 'smooth' });
});
whenNear(section, () => {
w = new Weather({
host: desk, name: 'behind', back: $('.layer.back', desk), front: $('.layer.front', desk),
rects: [mock], occlude: mock, playBtn: playIn(section), density: .9,
});
w.occlusion = p;
w.start();
});
apply(0);
}
