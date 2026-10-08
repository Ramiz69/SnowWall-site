const ORDER = ['auto', 'light', 'dark'];
export function initTheme() {
const btn = document.getElementById('theme');
if (!btn) return;
const root = document.documentElement;
const labels = (btn.dataset.labels || '').split('|');
const short = { auto: btn.textContent.trim(), light: btn.dataset.light, dark: btn.dataset.dark };
const paint = cur => {
const i = ORDER.indexOf(cur);
btn.textContent = short[cur] || cur;
if (labels[i]) btn.setAttribute('aria-label', labels[i]);
};
paint(root.dataset.theme || 'auto');
btn.addEventListener('click', () => {
const cur = root.dataset.theme || 'auto';
const next = ORDER[(ORDER.indexOf(cur) + 1) % ORDER.length];
if (next === 'auto') delete root.dataset.theme; else root.dataset.theme = next;
try { next === 'auto' ? localStorage.removeItem('sw-theme') : localStorage.setItem('sw-theme', next); } catch (e) { /* ignore */ }
paint(next);
document.dispatchEvent(new Event('sw:theme'));
});
}
