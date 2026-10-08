import { Weather } from './weather.b80f0fd2b2.js';
import { $, $$ } from './util.0f60c0292c.js';
export function initHero() {
const host = $('.hero');
if (!host) return null;
const w = new Weather({
host, name: 'hero',
back: $('.layer.back', host), front: $('.layer.front', host),
text: $$('.headline .w', host),
avoid: $$('.badge', host),
playBtn: $('#hero-play'),
});
w.start();
const radios = $$('.switcher [role=radio]', host);
const note = $('.now-showing', host);
const listeners = new Set();
function show(id, { from } = {}) {
w.setEffect(id);
host.dataset.fx = id;
let match = null;
for (const b of radios) {
const on = b.dataset.effect === id;
if (on) match = b;
b.setAttribute('aria-checked', String(on));
b.tabIndex = on ? 0 : -1;
}
if (!match && radios[0]) radios[0].tabIndex = 0;
if (note) {
const card = document.querySelector(`.card[data-effect="${id}"] .card-name`);
note.textContent = !match && card ? note.dataset.template.replace('{name}', card.textContent) : '';
}
for (const fn of listeners) if (fn !== from) fn(id);
}
radios.forEach((b, i) => {
b.addEventListener('click', () => show(b.dataset.effect));
b.addEventListener('keydown', e => {
const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
if (!d) return;
e.preventDefault();
const next = radios[(i + d + radios.length) % radios.length];
show(next.dataset.effect);
next.focus();
});
});
return { weather: w, show, onChange(fn) { listeners.add(fn); return fn; } };
}
