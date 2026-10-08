export const showStats = /[?&]stats/.test(location.search);
const engines = new Set();
let el = null;
export function track(engine) {
if (!showStats) return;
engines.add(engine);
if (!el) {
el = document.createElement('div');
el.className = 'stats';
el.setAttribute('aria-hidden', 'true');
document.body.append(el);
setInterval(render, 1000);
window.__sw = () => [...engines].map(e => e.report());
window.__swEngines = engines;   // for profiling from devtools: step()/draw() by hand
}
}
function render() {
const rows = [...engines].filter(e => e.raf || e.running).map(e => e.report().line);
el.textContent = rows.length ? rows.join('\n') : 'no canvas running';
}
