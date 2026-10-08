import { EFFECTS } from './effects.662733e831.js';
import { motion, pointer, onTheme } from './motion.fbf57fc8e4.js';
import { track } from './stats.c5ab680bf8.js';
const COL = 3;                 // settle heightmap column width, CSS px
const TAU = Math.PI * 2;
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export class Weather {
constructor(o) {
this.host = o.host;
this.back = o.back;
this.front = o.front || null;
this.bctx = this.back.getContext('2d');
this.fctx = this.front ? this.front.getContext('2d') : this.bctx;
this.textEls = o.text || [];
this.rectEls = o.rects || [];
this.avoidEls = o.avoid || [];
this.useGround = o.ground !== false;
this.usePointer = o.pointer !== false;
this.density = o.density ?? 1;
this.maxParts = o.maxParts ?? 1400;
this.maxDpr = o.maxDpr ?? 2;
this.name = o.name || 'canvas';
this.playBtn = o.playBtn || null;
this.still = !!o.still;
this.occlude = o.occlude || null;      // element whose box hides front particles by `occlusion`
this.occlusion = 0;
this.tune = { size: 1, speed: 1, wind: null, amount: 1, ...o.tune };
this.fxId = o.effect || 'snow';
this.fx = EFFECTS[this.fxId];
this.W = 0; this.H = 0; this.DPR = 1; this.quality = 1;
this.cols = 0; this.badges = []; this.occBox = null;
this.parts = []; this.splashes = []; this.landed = [];
this.time = 0; this.last = 0; this.raf = 0; this.onscreen = false; this.userPlay = false;
this.sprites = new Map(); this.C = {};
this.fpsFrames = 0; this.fpsAcc = 0; this.workAcc = 0; this.fps = 0; this.work = 0; this.slow = 0; this.good = 0;
this.frame = this.frame.bind(this);
this.readColors();
if (this.still) return;
track(this);
this.observe();
}
reduced() { return motion.reduced && !this.userPlay; }
observe() {
new IntersectionObserver(([e]) => {
this.onscreen = e.isIntersecting;
this.onscreen ? this.schedule() : this.stop();
}, { rootMargin: '80px 0px' }).observe(this.host);
document.addEventListener('visibilitychange', () => document.hidden ? this.stop() : this.schedule());
let rt = 0, lastW = 0, lastH = 0;
new ResizeObserver(([e]) => {
const { width, height } = e.contentRect;
if (Math.abs(width - lastW) < 1 && Math.abs(height - lastH) < 1) return;
lastW = width; lastH = height;
clearTimeout(rt); rt = setTimeout(() => this.resize(), 120);
}).observe(this.host);
motion.subscribe(() => this.applyMotion());
onTheme(() => { this.readColors(); if (this.reduced()) this.draw(); });
if (this.playBtn) this.playBtn.addEventListener('click', () => { this.userPlay = !this.userPlay; this.applyMotion(); });
}
start() {
const go = () => { this.resize(); this.applyMotion(); };
document.fonts ? document.fonts.ready.then(go) : go();
}
applyMotion() {
if (this.playBtn) {
this.playBtn.setAttribute('aria-pressed', String(this.userPlay));
this.playBtn.textContent = this.userPlay ? this.playBtn.dataset.pause : this.playBtn.dataset.play;
}
if (this.reduced()) this.staticFrame(); else this.schedule();
}
schedule() {
if (!this.raf && this.W && this.onscreen && !document.hidden && !this.reduced()) this.raf = requestAnimationFrame(this.frame);
}
stop() { if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0; this.last = 0; }
readColors() {
const cs = getComputedStyle(this.host);
const g = n => cs.getPropertyValue(n).trim();
this.C = { flake: g('--flake') || '255,255,255', halo: g('--halo') || '0,0,0', rain: g('--rain') || '176,202,236',
settle: g('--settle') || '#fff', shade: g('--settle-shade') || 'rgba(0,0,0,.2)', dark: g('--canvas-dark') === '1' };
this.sprites.clear();
for (const p of this.parts) p.img = this.spritesFor(p.fx)[p.si];
for (const l of this.landed) l.img = this.spritesFor(l.fx)[l.si];
}
spritesFor(id) {
let s = this.sprites.get(id);
if (!s) { s = makeSprites(EFFECTS[id], this.C); this.sprites.set(id, s); }
return s;
}
resize() {
const r = this.host.getBoundingClientRect();
this.W = Math.round(r.width); this.H = Math.round(r.height);
if (!this.W || !this.H) return;
this.DPR = Math.min(window.devicePixelRatio || 1, this.quality < .6 ? 1.5 : 2, this.maxDpr);
for (const c of [this.back, this.front]) if (c) { c.width = Math.round(this.W * this.DPR); c.height = Math.round(this.H * this.DPR); }
this.buildSurfaces(r);
this.seed();
if (this.still || this.reduced()) this.staticFrame(); else this.schedule();
}
buildSurfaces(hr) {
const { W, H } = this;
const cols = this.cols = Math.ceil(W / COL) + 1;
const surf = this.surf = new Float32Array(cols).fill(Infinity);
const seg = this.seg = new Int32Array(cols).fill(-1);
const cap = this.cap = new Float32Array(cols);
const hgt = this.hgt = new Float32Array(cols);
this.ground = new Float32Array(cols);
let base = 9;
if (this.textEls.length) {
let top = Infinity, bottom = -Infinity, fontPx = 64;
const boxes = this.textEls.map(el => { const r = el.getBoundingClientRect(); top = Math.min(top, r.top - hr.top); bottom = Math.max(bottom, r.bottom - hr.top); return r; });
top = Math.max(0, Math.floor(top)); bottom = Math.min(H, Math.ceil(bottom));
if (bottom > top) {
const off = document.createElement('canvas'); off.width = W; off.height = bottom - top;
const o = off.getContext('2d', { willReadFrequently: true });
o.fillStyle = '#000';
this.textEls.forEach((el, i) => {
const cs = getComputedStyle(el), r = boxes[i];
fontPx = parseFloat(cs.fontSize);
o.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
if ('letterSpacing' in o) o.letterSpacing = cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing;
const m = o.measureText(el.textContent);
const asc = m.fontBoundingBoxAscent || fontPx * .92;
o.save(); o.translate(r.left - hr.left, r.top - hr.top - top + asc);
o.scale(m.width ? r.width / m.width : 1, 1); o.fillText(el.textContent, 0, 0); o.restore();
});
const data = o.getImageData(0, 0, W, bottom - top).data, rowW = W * 4;
for (let c = 0; c < cols; c++) {
const x = Math.min(W - 1, c * COL + 1);
for (let y = 0; y < bottom - top; y++) if (data[y * rowW + x * 4 + 3] > 110) { surf[c] = top + y; break; }
}
}
base = clamp(fontPx * .1, 4, 12);
}
for (const el of this.rectEls) {
const r = el.getBoundingClientRect(), rad = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
const y = r.top - hr.top, l = r.left - hr.left + rad * .6, rr = r.right - hr.left - rad * .6;
for (let c = Math.max(0, Math.ceil(l / COL)); c < Math.min(cols, Math.floor(rr / COL)); c++) surf[c] = Math.min(surf[c], y);
}
let id = -1;
for (let c = 0; c < cols; c++) {
if (surf[c] === Infinity) continue;
if (c === 0 || seg[c - 1] < 0 || Math.abs(surf[c] - surf[c - 1]) > 4) id++;
seg[c] = id;
}
for (let c = 0; c < cols; c++) {
if (seg[c] < 0) continue;
const l = seg[c - 1] === seg[c] ? surf[c - 1] : surf[c], r = seg[c + 1] === seg[c] ? surf[c + 1] : surf[c];
const slope = Math.abs(r - l) / (2 * COL);
let e = 0; while (e < 4 && seg[c - e - 1] === seg[c] && seg[c + e + 1] === seg[c]) e++;
cap[c] = base * clamp(1 - slope * .9, 0, 1) * Math.min(1, (e + .6) / 3.5);
hgt[c] = this.fx.kind === 'flake' && this.fx.settle ? cap[c] * .5 : 0; // a dusting to start with
}
this.badges = this.avoidEls.map(el => {
const b = el.getBoundingClientRect();
return { l: b.left - hr.left - 12, t: b.top - hr.top - 12, r: b.right - hr.left + 12, b: b.bottom - hr.top + 12 };
});
if (this.occlude) {
const b = this.occlude.getBoundingClientRect();
this.occBox = { l: b.left - hr.left, t: b.top - hr.top, r: b.right - hr.left, b: b.bottom - hr.top };
}
this.groundCap = clamp(H * .035, 14, 30);
if (this.useGround && this.fx.kind === 'flake' && this.fx.settle)
for (let c = 0; c < cols; c++) this.ground[c] = this.groundCap * (.22 + .12 * Math.sin(c * .07) + .06 * Math.sin(c * .23));
}
target() {
const { W, H, fx } = this, area = W * H, small = !this.still && W < 700 ? .6 : 1;
let n;
if (fx.kind === 'flake') n = clamp(area / 1500, 160, 1100);
else if (fx.kind === 'rain') n = clamp(area / 1100, 200, 1300);
else if (fx.kind === 'glass') n = clamp(area / 2600, 90, 420);
else n = clamp(area / 9000, 36, 150);
return Math.min(this.maxParts, Math.round(n * fx.count * this.tune.amount * this.quality * small * this.density));
}
spawn(p, id, anywhere) {
const fx = EFFECTS[id], { W, H } = this, t = this.tune;
p.fx = id; p.kind = fx.kind; p.born = this.time; p.dying = 0; p.vx = 0;
p.x = rnd(-80, W + 80);
if (fx.kind === 'flake') {
const z = Math.pow(Math.random(), 1.5);
const tints = fx.tints ? fx.tints.length : 1, ti = (Math.random() * tints) | 0;
p.z = z; p.r = (.7 + z * z * 4) * (!this.still && W < 700 ? .85 : 1) * fx.size * t.size;
p.s = z > .94 ? 3 : z > .72 ? 2 : z > .38 ? 1 : 0;
if (!this.C.dark && p.s < 2) p.r *= 1.3;   // a little larger on the pale light-mode sky
if (p.s === 3) p.r *= 2.2;
else if (fx.sprite === 'star') p.r = Math.min(p.r, 6.5);
p.si = ti * 4 + p.s;
p.vy = (14 + z * 56 + rnd(0, 8)) * fx.speed * t.speed;
p.amp = rnd(5, 18) * (.4 + z); p.f = rnd(.35, 1.1); p.ph = rnd(0, TAU); p.tw = rnd(1.2, 3.6);
p.a = p.s === 3 ? .35 : (this.C.dark ? .3 + z * .65 : .5 + z * .5);
p.front = z > .38; p.settles = fx.settle && z > .38 && z < .94;
} else if (fx.kind === 'rain') {
const z = Math.pow(Math.random(), 1.3);
p.z = z; p.vy = (700 + z * 800 + rnd(0, 80)) * Math.sqrt(t.speed); p.len = (8 + z * 22) * t.size; p.w = (.6 + z * 1.1) * Math.sqrt(t.size);
p.a = (this.C.dark ? .18 : .3) + z * .5; p.front = z > .45; p.settles = z > .45 && z < .9;
p.b = z < .35 ? 0 : z < .7 ? 1 : 2; p.si = 0;
} else if (fx.kind === 'glass') {
const z = Math.pow(Math.random(), 2);
p.z = z; p.r = (1.2 + z * 6.5) * Math.sqrt(t.size); p.vy = 0; p.run = 0; p.y0 = 0;
p.a = .55 + z * .45; p.front = true; p.settles = false; p.si = 0;
p.x = rnd(0, W); p.y = rnd(0, H); p.grow = rnd(.05, .4);
return p;
} else {
const z = Math.random();
p.z = z; p.size = (9 + z * z * 18) * fx.size * t.size; p.vy = (26 + z * 38 + rnd(0, 10)) * fx.speed * t.speed;
p.amp = rnd(25, 60); p.f = rnd(.25, .7); p.ph = rnd(0, TAU);
p.rot = rnd(0, TAU); p.spin = rnd(-1.6, 1.6) * fx.spin; p.flip = rnd(0, TAU); p.flipV = rnd(1.2, 3.4) * fx.flip;
p.a = .55 + z * .45; p.si = (Math.random() * fx.tints.length) | 0; p.front = z > .3; p.settles = fx.settle && z > .3 && z < .85;
}
p.img = this.spritesFor(id)[p.si];
p.y = anywhere ? rnd(-20, H) : rnd(-60, -10) - (fx.kind === 'rain' ? rnd(0, 200) : 0);
return p;
}
seed() {
this.parts = []; this.splashes = []; this.landed = [];
const n = this.target();
for (let i = 0; i < n; i++) { const p = this.spawn({}, this.fxId, true); p.born = this.time - rnd(0, 1.2) - 9; this.parts.push(p); }
}
setEffect(id) {
if (id === this.fxId || !EFFECTS[id]) return;
this.fxId = id; this.fx = EFFECTS[id];
if (!this.W) return;
for (const p of this.parts) if (!p.dying) p.dying = this.time;
const n = this.target();
for (let i = 0; i < n; i++) { const p = this.spawn({}, id, true); p.born = this.time + rnd(0, .5); this.parts.push(p); }
if (this.reduced()) this.staticFrame();
}
setTune(t) {
Object.assign(this.tune, t);
if (this.reduced() && this.W) { this.seed(); this.staticFrame(); }
}
wind(t) {
const gust = 26 * Math.pow(Math.max(0, Math.sin(t * .21)), 8);
const natural = 6 + 10 * Math.sin(t * .11) + 13 * Math.sin(t * .037 + 1) + gust;
if (this.tune.wind !== null) return this.tune.wind * 36 + (natural - 6) * .2;
return natural * this.fx.wind;
}
covered(x, y) {
for (const b of this.badges) if (x > b.l && x < b.r && y > b.t && y < b.b) return true;
return false;
}
hiddenByWindow(x, y) {
const o = this.occBox;
return o && x > o.l && x < o.r && y > o.t && y < o.b;
}
deposit(c, amt) {
const s = this.seg[c], { cols, seg, hgt, cap } = this;
const add = (k, a) => { if (k >= 0 && k < cols && seg[k] === s) hgt[k] = Math.min(cap[k], hgt[k] + a); };
add(c, amt * .5); add(c - 1, amt * .25); add(c + 1, amt * .25);
}
depositGround(c, amt) {
const { cols, ground, groundCap } = this;
for (let k = -3; k <= 3; k++) { const j = c + k; if (j >= 0 && j < cols) ground[j] = Math.min(groundCap, ground[j] + amt * (4 - Math.abs(k)) / 16); }
}
step(dt) {
this.time += dt;
const { W, H, cols, seg, surf, hgt, ground, parts, time } = this;
const wv = this.wind(time);
const R = 130, R2 = R * R;
let px = -1e5, py = -1e5, pon = false;
if (this.usePointer && pointer.on) {
const r = this.host.getBoundingClientRect();
px = pointer.x - r.left; py = pointer.y - r.top; pon = px > 0 && px < W && py > 0 && py < H;
}
const canSettle = this.occlusion < .5;
let alive = 0;
for (let i = parts.length - 1; i >= 0; i--) {
const p = parts[i];
if (p.dying && time - p.dying > 1.1) { parts[i] = parts[parts.length - 1]; parts.pop(); continue; }
if (p.kind === 'glass') { if (this.stepBead(p, dt, i)) continue; if (!p.dying) alive++; continue; }
let dx;
if (p.kind === 'rain') dx = wv * (2 + p.z * 2) * dt;
else dx = (wv * (.35 + p.z * .8) + Math.sin(time * p.f + p.ph) * p.amp) * dt;
if (pon && p.front && p.kind !== 'rain') {
const ddx = p.x - px, ddy = p.y - py, d2 = ddx * ddx + ddy * ddy;
if (d2 < R2) { const d = Math.sqrt(d2) + .01, f = (1 - d / R) * 900 * dt; p.vx += ddx / d * f; p.y += ddy / d * f * .02; }
}
p.vx *= Math.pow(.03, dt);
p.x += dx + p.vx * dt;
const ny = p.y + p.vy * dt;
if (p.kind === 'petal') { p.rot += p.spin * dt; p.flip += p.flipV * dt; }
const c = (p.x / COL) | 0;
let hit = false;
if (!p.dying && c >= 0 && c < cols) {
if (p.settles && canSettle && seg[c] >= 0) {
const s = surf[c] - (p.kind === 'flake' ? hgt[c] : hgt[c] * .5);
if (p.y <= s && ny >= s) {
hit = true;
if (p.kind === 'flake') this.deposit(c, .7 + p.r * .35);
else if (p.kind === 'rain') { if (this.splashes.length < 140) this.splashes.push({ x: p.x, y: s, t: 0, z: p.z }); }
else if (Math.random() < .55 && this.landed.length < 160) this.landed.push({ x: p.x, y: s - 2, rot: p.rot, size: p.size * .8, fx: p.fx, si: p.si, img: p.img, t: 0, life: rnd(7, 13) });
else hit = false;
}
}
if (this.useGround && p.settles !== undefined && p.z > .3 && EFFECTS[p.fx].settle !== false) {
const gy = H - ground[c];
if (!hit && ny >= gy) {
hit = true;
if (p.kind === 'flake') this.depositGround(c, .5 + p.r * .25);
else if (p.kind === 'rain') { if (this.splashes.length < 140) this.splashes.push({ x: p.x, y: gy, t: 0, z: p.z }); }
else if (this.landed.length < 160) this.landed.push({ x: p.x, y: gy - 1, rot: rnd(0, TAU), size: p.size * .8, fx: p.fx, si: p.si, img: p.img, t: 0, life: rnd(8, 14) });
}
}
}
if (hit || ny > H + 30) {
if (p.dying) { parts[i] = parts[parts.length - 1]; parts.pop(); continue; }
this.spawn(p, p.fx, false);
} else p.y = ny;
if (p.x < -120) p.x += W + 240; else if (p.x > W + 120) p.x -= W + 240;
if (!p.dying) alive++;
}
const want = this.target();
if (alive < want) for (let k = 0; k < Math.min(20, want - alive); k++) parts.push(this.spawn({}, this.fxId, this.fx.kind === 'glass'));
else if (alive > want * 1.1) for (let k = 0, n = 0; k < parts.length && n < alive - want; k++) if (!parts[k].dying) { parts[k].dying = time; n++; }
const melt = this.fx.kind === 'flake' && this.fx.settle ? 0 : this.fx.kind === 'rain' ? 2.4 : 1.2;
for (let c = 0; c < cols - 1; c++) {
if (seg[c] >= 0 && seg[c] === seg[c + 1]) {
const d = hgt[c] - hgt[c + 1];
if (d > 1 || d < -1) { const m = d * .2; hgt[c] -= m; hgt[c + 1] += m; }
}
const g = ground[c] - ground[c + 1];
if (g > 1.5 || g < -1.5) { const m = g * .12; ground[c] -= m; ground[c + 1] += m; }
}
const meltNow = melt + (canSettle ? 0 : 3);
if (meltNow) for (let c = 0; c < cols; c++) { hgt[c] = Math.max(0, hgt[c] - meltNow * dt * .5); if (melt) ground[c] = Math.max(0, ground[c] - melt * dt); }
const sp = this.splashes, ld = this.landed;
for (let i = sp.length - 1; i >= 0; i--) if ((sp[i].t += dt) > .28) { sp[i] = sp[sp.length - 1]; sp.pop(); }
for (let i = ld.length - 1; i >= 0; i--) if ((ld[i].t += dt) > ld[i].life) { ld[i] = ld[ld.length - 1]; ld.pop(); }
}
stepBead(p, dt, i) {
const parts = this.parts;
if (!p.run) {
p.r = Math.min(7.5 * this.tune.size, p.r + p.grow * dt * .3);
if (!p.dying && p.r > 4.2 * this.tune.size && Math.random() < dt * .045 * this.tune.speed) { p.run = 1; p.y0 = p.y; p.vy = 10; p.wob = rnd(0, TAU); }
return false;
}
p.vy = Math.min(150 * this.tune.speed, p.vy + 90 * dt * this.tune.speed);
if (Math.random() < dt * 1.5) p.vy *= .35;          // drops stutter as they meet dry glass
p.y += p.vy * dt;
p.x += Math.sin(p.y * .05 + p.wob) * .15;
for (let k = parts.length - 1; k >= 0; k--) {
const q = parts[k];
if (q === p || q.run || q.kind !== 'glass' || q.dying) continue;
const dx = q.x - p.x, dy = q.y - p.y;
if (dy > -2 && dy < p.r + q.r && dx > -(p.r + q.r) && dx < p.r + q.r) { p.r = Math.min(9, Math.hypot(p.r, q.r)); q.dying = this.time; }
}
if (p.y - p.r > this.H) {
if (p.dying) { parts[i] = parts[parts.length - 1]; parts.pop(); return true; }
this.spawn(p, p.fx, true); p.r = 1; p.born = this.time;
}
return false;
}
alphaOf(p) {
let a = p.a * clamp((this.time - p.born) / .8, 0, 1);
if (p.dying) a *= clamp(1 - (this.time - p.dying) / 1.1, 0, 1);
return a;
}
drawFlakes(ctx, isFront) {
const occ = isFront && this.occBox ? this.occlusion : 0, t = this.time;
for (const p of this.parts) {
if (p.kind !== 'flake' || p.front !== isFront) continue;
let a = this.alphaOf(p); if (a <= .01) continue;
if (isFront && p.s !== 3 && this.badges.length && this.covered(p.x, p.y)) continue;
if (occ && this.hiddenByWindow(p.x, p.y)) { a *= 1 - occ; if (a <= .01) continue; }
if (EFFECTS[p.fx].twinkle) a *= .55 + .45 * Math.sin(t * p.tw + p.ph);
ctx.globalAlpha = a;
const d = p.r * 2.2;
ctx.drawImage(p.img, p.x - d / 2, p.y - d / 2, d, d);
}
ctx.globalAlpha = 1;
}
drawRain(ctx, isFront) {
const wv = this.wind(this.time), occ = isFront && this.occBox ? this.occlusion : 0;
ctx.lineCap = 'round';
for (let b = 0; b < 3; b++) {
const groups = new Map();
let w = 1;
for (const p of this.parts) {
if (p.kind !== 'rain' || p.front !== isFront || p.b !== b) continue;
if (isFront && this.badges.length && this.covered(p.x, p.y)) continue;
let a = this.alphaOf(p);
if (occ && this.hiddenByWindow(p.x, p.y)) a *= 1 - occ;
a = Math.round(a * 10) / 10; if (a <= 0) continue;
w = p.w;
let list = groups.get(a); if (!list) groups.set(a, list = []);
list.push(p);
}
for (const [a, list] of groups) {
ctx.strokeStyle = `rgba(${this.C.rain},${a})`;
ctx.lineWidth = w;
ctx.beginPath();
for (const p of list) { const k = p.len / p.vy, sx = wv * (2 + p.z * 2) * k; ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - sx, p.y - p.len); }
ctx.stroke();
}
}
if (isFront && this.splashes.length) {
ctx.strokeStyle = `rgba(${this.C.rain},.55)`; ctx.lineWidth = .9;
ctx.beginPath();
for (const s of this.splashes) {
const k = s.t / .28, r = 2 + k * (4 + s.z * 6);
ctx.moveTo(s.x - r, s.y - k * 3); ctx.quadraticCurveTo(s.x - r * .5, s.y - 5 * (1 - k) - 2, s.x - r * .2, s.y - k * 2);
ctx.moveTo(s.x + r, s.y - k * 3); ctx.quadraticCurveTo(s.x + r * .5, s.y - 5 * (1 - k) - 2, s.x + r * .2, s.y - k * 2);
}
ctx.stroke();
}
}
drawPetal(ctx, x, y, size, rot, sx, img, a) {
const c = Math.cos(rot), s = Math.sin(rot), D = this.DPR;
ctx.setTransform(D * c * sx, D * s * sx, -D * s, D * c, D * x, D * y);
ctx.globalAlpha = a;
ctx.drawImage(img, -size / 2, -size / 2, size, size);
}
drawPetals(ctx, isFront) {
const occ = isFront && this.occBox ? this.occlusion : 0;
for (const p of this.parts) {
if (p.kind !== 'petal' || p.front !== isFront) continue;
let a = this.alphaOf(p); if (a <= .01) continue;
if (isFront && this.badges.length && this.covered(p.x, p.y)) continue;
if (occ && this.hiddenByWindow(p.x, p.y)) { a *= 1 - occ; if (a <= .01) continue; }
const sx = Math.cos(p.flip);
this.drawPetal(ctx, p.x, p.y, p.size, p.rot, Math.abs(sx) < .12 ? .12 : sx, p.img, a * (.6 + .4 * Math.abs(sx)));
}
ctx.setTransform(this.DPR, 0, 0, this.DPR, 0, 0); ctx.globalAlpha = 1;
}
drawBeads(ctx) {
ctx.lineCap = 'round';
for (const p of this.parts) {
if (p.kind !== 'glass' || !p.run) continue;
const a = this.alphaOf(p) * .5; if (a <= .01) continue;
const g = ctx.createLinearGradient(0, p.y0, 0, p.y);
g.addColorStop(0, `rgba(${this.C.rain},0)`); g.addColorStop(1, `rgba(${this.C.rain},${a})`);
ctx.strokeStyle = g; ctx.lineWidth = Math.max(1, p.r * .55);
ctx.beginPath(); ctx.moveTo(p.x, p.y0); ctx.lineTo(p.x, p.y); ctx.stroke();
}
const img = this.spritesFor('glass')[0];
for (const p of this.parts) {
if (p.kind !== 'glass') continue;
const a = this.alphaOf(p); if (a <= .01) continue;
if (this.badges.length && this.covered(p.x, p.y)) continue;
ctx.globalAlpha = a;
const d = p.r * 2, h = p.run ? d * 1.25 : d;
ctx.drawImage(img, p.x - d / 2, p.y - h / 2, d, h);
}
ctx.globalAlpha = 1;
}
drawSettled(ctx) {
const { cols, seg, hgt, surf, ground, C, H, W, groundCap } = this;
const occA = this.occBox ? 1 - this.occlusion : 1;
ctx.fillStyle = C.settle; ctx.shadowColor = C.shade; ctx.shadowBlur = 6; ctx.shadowOffsetY = 1;
ctx.globalAlpha = occA;
ctx.beginPath();
let c = 0;
while (c < cols) {
if (seg[c] < 0 || hgt[c] < .3) { c++; continue; }
const start = c, s = seg[c];
while (c < cols && seg[c] === s && hgt[c] >= .3) c++;
const end = c - 1;
ctx.moveTo(start * COL, surf[start] + 1);
for (let k = start; k <= end; k++) ctx.lineTo(k * COL + COL / 2, surf[k] - hgt[k]);
ctx.lineTo(end * COL + COL, surf[end] + 1);
for (let k = end; k >= start; k--) ctx.lineTo(k * COL + COL / 2, surf[k] + .6);
ctx.closePath();
}
ctx.fill();
ctx.globalAlpha = 1;
if (this.useGround) {
let any = false; for (let k = 0; k < cols; k++) if (ground[k] > .4) { any = true; break; }
if (any) {
const g = ctx.createLinearGradient(0, H - groundCap, 0, H);
g.addColorStop(0, C.settle); g.addColorStop(1, C.dark ? '#cfdcf2' : '#e9f0fa');
ctx.fillStyle = g; ctx.shadowOffsetY = -1;
ctx.beginPath(); ctx.moveTo(0, H);
for (let k = 0; k < cols; k++) ctx.lineTo(k * COL, H - ground[k]);
ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
}
}
ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
}
drawLanded(ctx) {
for (const l of this.landed) {
const a = clamp(Math.min(l.t / .2, (l.life - l.t) / 1.5), 0, 1);
this.drawPetal(ctx, l.x, l.y, l.size, l.rot, 1, l.img, a * .95);
}
ctx.setTransform(this.DPR, 0, 0, this.DPR, 0, 0); ctx.globalAlpha = 1;
}
draw() {
const { bctx, fctx, W, H, DPR } = this;
if (!W) return;
for (const ctx of new Set([bctx, fctx])) { ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, W, H); }
this.drawFlakes(bctx, false); this.drawRain(bctx, false); this.drawPetals(bctx, false);
this.drawSettled(fctx); this.drawLanded(fctx);
this.drawBeads(fctx);
this.drawFlakes(fctx, true); this.drawRain(fctx, true); this.drawPetals(fctx, true);
}
frame(now) {
this.raf = 0;
const dt = Math.min(.05, this.last ? (now - this.last) / 1000 : 1 / 60);
this.last = now;
const t0 = performance.now();
this.step(dt); this.draw();
this.workAcc += performance.now() - t0;
this.fpsFrames++; this.fpsAcc += dt;
if (this.fpsAcc >= 1) {
this.fps = this.fpsFrames / this.fpsAcc; this.work = this.workAcc / this.fpsFrames;
const ms = 1000 / this.fps;
if (ms > 21 || this.work > 5) { if (++this.slow >= 2 && this.quality > .35) { this.quality *= .8; this.slow = 0; } this.good = 0; }
else if (ms < 15 && this.work < 3) { if (++this.good >= 4 && this.quality < 1) { this.quality = Math.min(1, this.quality * 1.1); this.good = 0; } this.slow = 0; }
this.fpsFrames = 0; this.fpsAcc = 0; this.workAcc = 0;
}
this.schedule();
}
staticFrame() {
this.stop();
if (!this.W) return;
const saved = this.time;
for (let i = 0; i < 240; i++) this.step(1 / 30);
for (const p of this.parts) p.born = this.time - 2;
this.parts = this.parts.filter(p => !p.dying);
this.draw();
this.time = saved + 8;
}
report() {
return { name: this.name, fps: Math.round(this.fps), work: +this.work.toFixed(2), particles: this.parts.length, quality: +this.quality.toFixed(2), dpr: this.DPR,
line: `${this.name}: ${this.fps.toFixed(0)} fps · ${this.work.toFixed(2)} ms/frame · ${this.parts.length} particles · q ${this.quality.toFixed(2)} · dpr ${this.DPR}` };
}
}
function canvas64() { const c = document.createElement('canvas'); c.width = c.height = 64; return [c, c.getContext('2d')]; }
function makeSprites(fx, C) {
if (fx.kind === 'flake') {
const out = [];
const specs = [[0, 1, .5, 1, .8, .3, 1, 0], [0, 1, .4, 1, .75, .25, 1, 0], [0, .95, .3, .8, .7, .25, 1, 0], [0, .55, .35, .4, .8, .12, 1, 0]];
for (const tint of fx.tints || [null]) {
const rgb = tint || C.flake;
specs.forEach((s, i) => {
const [c, x] = canvas64();
if (!C.dark && i < 3) { // cool halo so white flakes read on a pale sky; strongest on the far ones
const a = i === 0 ? .62 : i === 1 ? .46 : .26;
const h = x.createRadialGradient(32, 32, 6, 32, 32, 32);
h.addColorStop(0, `rgba(${C.halo},${a})`); h.addColorStop(.6, `rgba(${C.halo},${a * .6})`); h.addColorStop(1, `rgba(${C.halo},0)`);
x.fillStyle = h; x.fillRect(0, 0, 64, 64);
}
if (fx.sprite === 'star' && i < 3) {
glow(x, rgb, .45); star(x, rgb, 5, 31, 13);
} else if (fx.sprite === 'crystal' && (i === 1 || i === 2)) {
glow(x, rgb, .3); crystal(x, rgb);
} else {
const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
for (let k = 0; k < s.length; k += 2) g.addColorStop(s[k], `rgba(${rgb},${s[k + 1]})`);
x.fillStyle = g; x.beginPath(); x.arc(32, 32, 32, 0, TAU); x.fill();
if (fx.sprite === 'sparkle' && (i === 1 || i === 2)) glint(x, rgb);
}
out.push(c);
});
}
return out;
}
if (fx.kind === 'petal') return fx.tints.map(([light, deep]) => {
const [c, x] = canvas64();
if (fx.shape === 'confetti') {
x.fillStyle = light; roundRect(x, 12, 22, 40, 20, 3); x.fill();
x.fillStyle = 'rgba(255,255,255,.25)'; x.fillRect(12, 22, 40, 5);
return c;
}
const g = x.createRadialGradient(32, 54, 2, 32, 30, 34);
g.addColorStop(0, deep); g.addColorStop(1, light);
x.fillStyle = g; x.beginPath();
if (fx.shape === 'leaf') {
x.moveTo(32, 60); x.bezierCurveTo(8, 44, 10, 16, 32, 4); x.bezierCurveTo(54, 16, 56, 44, 32, 60);
} else {
x.moveTo(32, 60); x.bezierCurveTo(14, 48, 7, 26, 19, 9);
x.quadraticCurveTo(26, 3, 32, 11); x.quadraticCurveTo(38, 3, 45, 9);
x.bezierCurveTo(57, 26, 50, 48, 32, 60);
}
x.closePath(); x.fill();
x.strokeStyle = fx.shape === 'leaf' ? 'rgba(120,50,10,.35)' : 'rgba(200,90,130,.25)'; x.lineWidth = 1.2;
x.beginPath(); x.moveTo(32, 58); x.lineTo(32, fx.shape === 'leaf' ? 10 : 22); x.stroke();
return c;
});
if (fx.kind === 'glass') {
const [c, x] = canvas64();
const body = x.createRadialGradient(28, 26, 4, 32, 32, 31);
body.addColorStop(0, `rgba(${C.rain},.05)`); body.addColorStop(.8, `rgba(${C.rain},.22)`); body.addColorStop(1, `rgba(${C.rain},.5)`);
x.fillStyle = body; x.beginPath(); x.arc(32, 32, 30, 0, TAU); x.fill();
x.strokeStyle = C.dark ? 'rgba(0,0,0,.45)' : 'rgba(20,40,70,.4)'; x.lineWidth = 2.5;
x.beginPath(); x.arc(32, 32, 29, Math.PI * 1.05, Math.PI * 1.95); x.stroke();
x.fillStyle = 'rgba(255,255,255,.9)'; x.beginPath(); x.ellipse(40, 42, 6, 4, -.6, 0, TAU); x.fill();
return [c];
}
return [];
}
function glow(x, rgb, a) {
const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
x.fillStyle = g; x.fillRect(0, 0, 64, 64);
}
function star(x, rgb, n, R, r) {
x.fillStyle = `rgb(${rgb})`; x.beginPath();
for (let k = 0; k < n * 2; k++) { const a = -Math.PI / 2 + k * Math.PI / n, d = k % 2 ? r : R; x.lineTo(32 + Math.cos(a) * d, 32 + Math.sin(a) * d); }
x.closePath(); x.fill();
}
function crystal(x, rgb) {
x.strokeStyle = `rgb(${rgb})`; x.lineWidth = 3.4; x.lineCap = 'round';
x.beginPath();
for (let k = 0; k < 6; k++) {
const a = k * Math.PI / 3, c = Math.cos(a), s = Math.sin(a);
x.moveTo(32, 32); x.lineTo(32 + c * 27, 32 + s * 27);
for (const [d, l] of [[13, 8], [20, 6]]) {
const bx = 32 + c * d, by = 32 + s * d;
for (const sg of [-1, 1]) { const b = a + sg * Math.PI / 3; x.moveTo(bx, by); x.lineTo(bx + Math.cos(b) * l, by + Math.sin(b) * l); }
}
}
x.stroke();
}
function glint(x, rgb) {
x.strokeStyle = `rgba(${rgb},.85)`; x.lineWidth = 1.6; x.lineCap = 'round';
x.beginPath(); x.moveTo(32, 2); x.lineTo(32, 62); x.moveTo(2, 32); x.lineTo(62, 32); x.stroke();
}
function roundRect(x, l, t, w, h, r) {
x.beginPath(); x.moveTo(l + r, t); x.arcTo(l + w, t, l + w, t + h, r); x.arcTo(l + w, t + h, l, t + h, r);
x.arcTo(l, t + h, l, t, r); x.arcTo(l, t, l + w, t, r); x.closePath();
}
