#!/usr/bin/env node
// Builds public/ from src/ and i18n/. Zero dependencies: Node 18+ standard library only.
//
//   node build.mjs                 production build
//   node build.mjs --release=1.1   also switches on blocks marked data-release="1.1"
//   RELEASE=1.1 node build.mjs     same, for a Cloudflare Pages environment variable
//
// What it does: copies src/static as is; content-hashes src/assets, the CSS bundles and the JS
// modules into public/assets/ (served immutable); renders the home page per language from
// src/home.html + i18n/<lang>.json, and the support/privacy/terms/404 pages from src/pages/
// into src/page.html; writes sitemap.xml; prints page weights.

import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, statSync, copyFileSync, existsSync } from 'node:fs';
import { join, dirname, extname, basename, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SRC = join(ROOT, 'src');
const DIST = join(ROOT, 'public');
const SITE = 'https://snowwall.app';
const APP_STORE = 'https://apps.apple.com/app/id6809149964';
// Every language the app ships in, in the order the language menu lists them. A language joins
// the site (its home page, the menu, sitemap) once i18n/<code>.json exists; only en and ru do now.
// No flags: a flag names a country, not a language, and several of these have no single country.
// The menu shows each language by its own name, the way Apple's own language pickers do.
const LANGUAGES = [
  { code: 'en', short: 'EN', name: 'English' },
  { code: 'ru', short: 'RU', name: 'Русский' },
  { code: 'ar', short: 'AR', name: 'العربية' },
  { code: 'de', short: 'DE', name: 'Deutsch' },
  { code: 'es', short: 'ES', name: 'Español' },
  { code: 'fr', short: 'FR', name: 'Français' },
  { code: 'hi', short: 'HI', name: 'हिन्दी' },
  { code: 'id', short: 'ID', name: 'Bahasa Indonesia' },
  { code: 'it', short: 'IT', name: 'Italiano' },
  { code: 'ja', short: 'JA', name: '日本語' },
  { code: 'ko', short: 'KO', name: '한국어' },
  { code: 'pt-BR', short: 'PT', name: 'Português (Brasil)' },
  { code: 'tr', short: 'TR', name: 'Türkçe' },
  { code: 'vi', short: 'VI', name: 'Tiếng Việt' },
  { code: 'zh-Hans', short: '简', name: '简体中文' },
  { code: 'zh-Hant', short: '繁', name: '繁體中文' },
].map(l => ({ ...l, path: l.code === 'en' ? '/' : `/${l.code.toLowerCase()}/` }));
const BUILT = LANGUAGES.filter(l => existsSync(join(ROOT, 'i18n', `${l.code}.json`)));
const LANGS = BUILT.map(l => l.code);
const releaseArg = process.argv.find(a => a.startsWith('--release='));
const RELEASE = parseFloat(releaseArg ? releaseArg.split('=')[1] : process.env.RELEASE || '1.0');

const read = p => readFileSync(p, 'utf8');
const write = (p, s) => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, s); };
const hash = buf => createHash('sha256').update(buf).digest('hex').slice(0, 10);
const walk = dir => readdirSync(dir).flatMap(f => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

// ---------- static files, copied as they are ----------
for (const f of walk(join(SRC, 'static'))) {
  const out = join(DIST, relative(join(SRC, 'static'), f));
  mkdirSync(dirname(out), { recursive: true });
  copyFileSync(f, out);
}

// ---------- hashed assets ----------
const assets = new Map();   // 'assets/x.svg' | 'css/home.css' | 'js/main.js' -> '/assets/x.<hash>.svg'
function emit(key, content, ext) {
  const name = `${basename(key, extname(key))}.${hash(content)}${ext || extname(key)}`;
  write(join(DIST, 'assets', name), content);
  assets.set(key, `/assets/${name}`);
  return `/assets/${name}`;
}
for (const f of walk(join(SRC, 'assets'))) emit(relative(SRC, f), readFileSync(f));

// CSS: tokens + page sheet, comments and whitespace stripped.
const minCss = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').replace(/\s*([{}:;,>])\s*/g, '$1').replace(/;}/g, '}').trim();
const tokens = read(join(SRC, 'css/tokens.css'));
for (const sheet of ['home', 'page']) emit(`css/${sheet}.css`, minCss(tokens + '\n' + read(join(SRC, `css/${sheet}.css`))));

// JS: ES modules, hashed leaves-first so each importer points at its dependencies' hashed names.
// Light minification only: whole-line comments and indentation go; code is untouched.
const minJs = s => s.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('//')).join('\n') + '\n';
const jsDir = join(SRC, 'js');
const importRe = /(import\s[^'"]*?from\s*|import\s*)(['"])\.\/([\w-]+\.js)\2/g;
const deps = f => [...read(join(jsDir, f)).matchAll(importRe)].map(m => m[3]);
const done = new Set();
function buildModule(f, stack = []) {
  if (done.has(f)) return;
  if (stack.includes(f)) throw new Error(`import cycle: ${[...stack, f].join(' -> ')}`);
  for (const d of deps(f)) buildModule(d, [...stack, f]);
  const src = read(join(jsDir, f)).replace(importRe, (_, a, q, dep) => `${a}${q}./${basename(assets.get(`js/${dep}`))}${q}`);
  emit(`js/${f}`, minJs(src));
  done.add(f);
}
buildModule('main.js');
emit('js/theme-init.js', minJs(read(join(jsDir, 'theme-init.js'))));
const modulepreload = [...done].filter(f => f !== 'main.js').map(f => `<link rel="modulepreload" href="${assets.get(`js/${f}`)}">`).join('\n');

// ---------- templating ----------
// {{key.path}} inserts a value, {{#list}}…{{/list}} repeats for each item ({{.field}} or {{.}}),
// {{@src/path}} is a hashed asset URL. A missing key is an error, not an empty string.
function render(tpl, data, where) {
  tpl = tpl.replace(/{{#([\w.]+)}}([\s\S]*?){{\/\1}}/g, (_, key, body) => {
    const list = get(data, key);
    if (!Array.isArray(list)) throw new Error(`${where}: {{#${key}}} is not a list`);
    return list.map(item => body.replace(/{{\.(\w*)}}/g, (_, f) => {
      const v = f ? item[f] : item;
      if (v === undefined) throw new Error(`${where}: missing .${f} in ${key}`);
      return v;
    })).join('');
  });
  tpl = tpl.replace(/{{([\w.]+)}}/g, (_, key) => {
    const v = get(data, key);
    if (v === undefined || v === null || typeof v === 'object') throw new Error(`${where}: missing {{${key}}}`);
    return String(v);
  });
  tpl = tpl.replace(/{{@([^}]+)}}/g, (_, p) => {
    const url = assets.get(p);
    if (!url) throw new Error(`${where}: unknown asset ${p}`);
    return url;
  });
  // data-release blocks: shown once the build's release reaches theirs
  tpl = tpl.replace(/(data-release="([\d.]+)")\s+hidden/g, (m, attr, rel) => parseFloat(rel) <= RELEASE ? attr : m);
  return tpl;
}

// Small line icons for the facts grid (stroke = currentColor).
const ICONS = {
  metal: '<path d="M4 18 12 4l8 14H4Z"/><path d="M8.5 18 12 11.5 15.5 18"/>',
  battery: '<rect x="3" y="7" width="16" height="10" rx="2.5"/><path d="M21 10.5v3"/><path d="M6.5 10v4"/><path d="M9.5 10v4"/>',
  gauge: '<path d="M4.5 17a8 8 0 1 1 15 0"/><path d="m12 13 3.5-4"/><circle cx="12" cy="13" r="1"/>',
  displays: '<rect x="2.5" y="5" width="12" height="9" rx="1.5"/><rect x="9.5" y="9" width="12" height="9" rx="1.5"/>',
  motion: '<path d="M4 12h3l2-5 3 10 2-5h6"/>',
  shortcuts: '<rect x="4" y="4" width="10" height="10" rx="3"/><rect x="10" y="10" width="10" height="10" rx="3"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17"/><path d="M12 3.5c2.5 2.6 3.6 5.4 3.6 8.5s-1.1 5.9-3.6 8.5c-2.5-2.6-3.6-5.4-3.6-8.5S9.5 6.1 12 3.5Z"/>',
  control: '<rect x="4" y="4" width="16" height="16" rx="5"/><path d="M10 9v6"/><path d="M14 9v6"/>',
  widget: '<rect x="3.5" y="3.5" width="7.5" height="7.5" rx="2"/><rect x="13" y="3.5" width="7.5" height="7.5" rx="2"/><rect x="3.5" y="13" width="17" height="7.5" rx="2"/>',
  search: '<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5 5"/>',
  sparkles: '<path d="M12 3.5 13.8 9l5.7 1.8-5.7 1.9L12 18.5l-1.8-5.8L4.5 10.8 10.2 9 12 3.5Z"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
const CHECK = '<svg class="yes" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m4.5 10.5 3.5 3.5 7.5-8"/></svg>';
const TAB_IDS = ['general', 'effects', 'appearance', 'physics', 'interaction', 'presets'];
const effectData = JSON.parse(read(join(SRC, 'data/effects.json'))).effects;

// ---------- header menus: language and colour scheme ----------
const svg16 = (body, cls = '') => `<svg${cls ? ` class="${cls}"` : ''} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
// The language pill's mark: a globe, as in Apple's own language menus.
const GLOBE = svg16('<circle cx="8" cy="8" r="6.25"/><path d="M1.75 8h12.5M8 1.75c1.8 1.7 2.7 3.8 2.7 6.25S9.8 12.55 8 14.25M8 1.75C6.2 3.45 5.3 5.55 5.3 8s.9 4.55 2.7 6.25"/>', 'globe');
const THEME_ICONS = {
  auto: '<circle cx="8" cy="8" r="5.75"/><path d="M8 2.25a5.75 5.75 0 0 0 0 11.5Z" fill="currentColor"/>',
  light: '<circle cx="8" cy="8" r="2.75"/><path d="M8 1.5v1.25M8 13.25v1.25M1.5 8h1.25M13.25 8h1.25M3.4 3.4l.9.9M11.7 11.7l.9.9M3.4 12.6l.9-.9M11.7 4.3l.9-.9"/>',
  dark: '<path d="M13.25 9.6A5.5 5.5 0 0 1 6.4 2.75a5.5 5.5 0 1 0 6.85 6.85Z"/>',
};
const CHEVRON = svg16('<path d="m5 6.5 3 3 3-3"/>', 'chev');
const TICK = svg16('<path d="m3.5 8.5 3 3 6-7"/>', 'tick');

// `here` is the current language code; `hrefs` maps each built language to its page for this URL.
function headerMenus(ui, here, hrefs) {
  const cur = BUILT.find(l => l.code === here);
  const langItems = BUILT.map(l => `<li><a class="menu-item" tabindex="-1" href="${hrefs[l.code]}" hreflang="${l.code}" lang="${l.code}"${l.code === here ? ' aria-current="page"' : ''}><span class="label">${l.name}</span>${TICK}</a></li>`).join('');
  const modes = ['auto', 'light', 'dark'];
  const themeIcon = m => svg16(THEME_ICONS[m], 'ico');
  return `<div class="menu-wrap lang-menu">
      <button class="chip menu-btn" type="button" aria-expanded="false" aria-controls="lang-list"><span class="vh">${ui.language}: ${cur.name}</span> ${GLOBE}<span aria-hidden="true">${cur.short}</span>${CHEVRON}</button>
      <ul class="menu" id="lang-list" aria-label="${ui.language}">${langItems}</ul>
    </div>
    <div class="menu-wrap theme-menu" data-theme-menu>
      <button class="chip menu-btn" type="button" aria-haspopup="menu" aria-expanded="false" aria-controls="theme-list"><span class="vh">${ui.theme.label}:</span> ${modes.map(m => `<span class="tv tv-${m}">${themeIcon(m)}<span class="tvl">${ui.theme[m]}</span></span>`).join('')}${CHEVRON}</button>
      <div class="menu" id="theme-list" role="menu" aria-label="${ui.theme.label}">${modes.map(m => `<button class="menu-item" type="button" role="menuitemradio" aria-checked="${m === 'auto'}" tabindex="-1" data-value="${m}">${themeIcon(m)}<span class="label">${ui.theme[m]}</span>${TICK}</button>`).join('')}</div>
    </div>`;
}
const homeHrefs = Object.fromEntries(BUILT.map(l => [l.code, l.path]));

function homeData(t) {
  const url = SITE + t.path;
  const cell = v => v === true ? `${CHECK}<span class="vh">${t.ui.included}</span>`
    : v === false ? `<span class="no" aria-hidden="true">—</span><span class="vh">${t.ui.notIncluded}</span>` : v;
  const video = v => {
    if (!v) return '';
    const src = Object.entries(v).map(([type, p]) => `<source src="${assets.get('assets/' + p) || fail('video ' + p)}" type="video/${type}">`).join('');
    return `<video muted loop playsinline preload="none" aria-hidden="true">${src}</video>`;
  };
  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'SnowWall',
    url,
    inLanguage: t.lang,
    description: t.jsonld.description,
    image: `${SITE}/icon.png`,
    operatingSystem: 'macOS 26 or later',
    applicationCategory: 'DesktopEnhancementApplication',
    installUrl: APP_STORE,
    offers: [
      { '@type': 'Offer', price: '0', priceCurrency: 'USD', availability: 'https://schema.org/InStock', url: APP_STORE },
      ...(t.jsonld.proOffer ? [{ '@type': 'Offer', name: t.jsonld.proOffer.name, description: 'One-time in-app purchase', price: t.jsonld.proOffer.price, priceCurrency: t.jsonld.proOffer.priceCurrency, url: APP_STORE }] : []),
    ],
  };
  return {
    ...t,
    site: SITE, url, appStore: APP_STORE, modulepreload,
    menus: headerMenus(t.ui, t.lang, homeHrefs),
    jsonld: JSON.stringify(jsonld).replace(/</g, '\\u003c'),
    hero: { ...t.hero, titleHtml: t.hero.title.split(' ').map(w => `<span class="w">${w}</span>`).join(' ') },
    mock: { ...t.mock, tabs: t.mock.tabs.map((name, i) => ({ name, cls: `t-${TAB_IDS[i]}${TAB_IDS[i] === 'appearance' ? ' on' : ''}` })) },
    effects: effectData.map(e => ({
      id: e.id, name: t.effects[e.id].name, desc: t.effects[e.id].desc,
      tier: e.tier, tierLabel: t.tiers[e.tier], pressed: e.id === 'snow' ? 'true' : 'false', video: video(e.video),
    })),
    built: { ...t.built, facts: t.built.facts.map(f => ({ ...f, icon: icon(f.icon) })), facts11: t.built.facts11.map(f => ({ ...f, icon: icon(f.icon) })) },
    pro: { ...t.pro, rows: t.pro.rows.map(r => ({ label: r.label, note: r.note ? `<span class="note">${r.note}</span>` : '', free: cell(r.free), pro: cell(r.pro) })) },
  };
}
function fail(msg) { throw new Error(msg); }

const pages = [];   // [path, file, html]
const homeTpl = read(join(SRC, 'home.html'));
for (const lang of LANGS) {
  const t = JSON.parse(read(join(ROOT, 'i18n', `${lang}.json`)));
  const html = render(homeTpl, homeData(t), `home/${lang}`);
  const out = lang === 'en' ? 'index.html' : `${lang}/index.html`;
  write(join(DIST, out), html);
  pages.push([t.path, out, html]);
}

const pageTpl = read(join(SRC, 'page.html'));
// Support, privacy, terms and the press kit are English only: their language menu offers the other home pages.
const enUi = JSON.parse(read(join(ROOT, 'i18n', 'en.json'))).ui;
for (const f of readdirSync(join(SRC, 'pages'))) {
  const raw = read(join(SRC, 'pages', f));
  const m = raw.match(/^<!--meta (\{.*?\}) -->\n/);
  if (!m) throw new Error(`${f}: missing <!--meta {...} --> header`);
  const meta = JSON.parse(m[1]);
  const current = Object.fromEntries(['home', 'support', 'privacy', 'terms', 'press'].map(k => [k, k === meta.nav ? ' aria-current="page"' : '']));
  const data = {
    title: meta.title,
    metaDescription: meta.description ? `<meta name="description" content="${meta.description}">` : '',
    robots: meta.robots ? `<meta name="robots" content="${meta.robots}">` : '',
    canonical: meta.robots ? '' : `<link rel="canonical" href="${SITE}${meta.path}">`,
    content: raw.slice(m[0].length).replace(/{{/g, '&#123;&#123;'),
    current,
    menus: headerMenus(enUi, 'en', { ...homeHrefs, en: meta.robots ? '/' : meta.path }),
  };
  const html = render(pageTpl, data, `pages/${f}`);
  const out = meta.path.endsWith('/') ? `${meta.path.slice(1)}index.html` : meta.path.slice(1);
  write(join(DIST, out), html);
  pages.push([meta.path, out, html, meta.robots]);
}

// ---------- sitemap ----------
const today = new Date().toISOString().slice(0, 10);
const alt = `<xhtml:link rel="alternate" hreflang="en" href="${SITE}/"/><xhtml:link rel="alternate" hreflang="ru" href="${SITE}/ru/"/><xhtml:link rel="alternate" hreflang="x-default" href="${SITE}/"/>`;
const urls = pages.filter(p => !p[3]).map(([path]) =>
  `  <url><loc>${SITE}${path}</loc><lastmod>${today}</lastmod>${path === '/' || path === '/ru/' ? alt : ''}</url>`);
write(join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`);

// ---------- report ----------
const size = p => { const b = readFileSync(join(DIST, p.replace(/^\//, ''))); return [b.length, gzipSync(b, { level: 9 }).length]; };
const kb = n => `${(n / 1024).toFixed(1)} KB`;
const js = [...assets].filter(([k]) => k.startsWith('js/')).map(([, u]) => size(u));
const jsGz = js.reduce((a, [, g]) => a + g, 0), jsRaw = js.reduce((a, [r]) => a + r, 0);
console.log(`release ${RELEASE.toFixed(1)} · ${pages.length} pages · ${assets.size} hashed assets`);
console.log(`JS total: ${kb(jsRaw)} raw, ${kb(jsGz)} gzip (budget 60 KB gzip)`);
for (const [path, file] of pages) {
  const html = read(join(DIST, file));
  const refs = [...html.matchAll(/(?:href|src)="(\/assets\/[^"]+)"/g)].map(m => m[1]);
  const lazy = new Set([...html.matchAll(/<img[^>]+src="(\/assets\/[^"]+)"[^>]*loading="lazy"/g)].map(m => m[1]));
  const first = [...new Set(refs)].filter(u => !lazy.has(u));
  const [hr, hg] = size(file);
  const tot = first.reduce((a, u) => { const [r, g] = size(u); return [a[0] + r, a[1] + g]; }, [hr, hg]);
  console.log(`${path.padEnd(12)} html ${kb(hg).padStart(8)} gz · first load ${kb(tot[1]).padStart(8)} gz (${kb(tot[0])} raw, ${first.length + 1} files)`);
}
if (jsGz > 60 * 1024) { console.error('JS over budget'); process.exit(1); }
