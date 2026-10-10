# SnowWall site

The public site for [SnowWall](https://snowwall.app), a macOS menu bar app that draws weather
over the desktop. Built from `src/` into `public/` by `build.mjs` (Node, no dependencies) and
served by Cloudflare at **snowwall.app**.

| Path | What | Used by |
|---|---|---|
| `/` | the home page, English | Marketing URL in App Store Connect |
| `/ru/`, `/de/`, `/ja/`, … | the home page in each of the app's 16 languages | hreflang alternates of `/` |
| `/press/` | press kit: facts, screenshots, icon, ZIP | links in press emails |
| `/support/` | answers and the support address | Support URL in App Store Connect (required, must be a web page) |
| `/privacy/` | privacy policy | the app's purchase window, Privacy Policy URL in App Store Connect |
| `/terms/` | terms of use | the app's purchase window |
| `404.html` | anything else | served by Cloudflare for unknown paths |
| `_headers` | security and cache headers | read by Cloudflare, not published as a page |

**The URLs are the point.** Each page is `name/index.html`, so it answers at `/name` and
`/name/`. The app builds its links as `https://snowwall.app/privacy` and
`https://snowwall.app/terms`; renaming or moving those pages breaks every copy of the app
already installed.

## Layout

```
build.mjs              the build: templates + i18n -> public/, hashed assets, sitemap, size report
i18n/<lang>.json      every string on the home page, per language (en.json is the source)
src/home.html          home page template ({{key}}, {{#list}}…{{/list}}, {{@asset}})
src/page.html          layout for support, privacy, terms and 404
src/pages/*.html       those pages' content (a <!--meta {...} --> line, then HTML)
src/css/               tokens.css (shared) + home.css / page.css
src/js/                ES modules: weather.js is the canvas engine, sections.js the sections
src/data/effects.json  gallery order, Free/Pro, optional loop videos per effect
src/assets/            content-hashed on build (icon, App Store badges, future videos)
src/static/            copied as is (_headers, robots.txt, favicon, icon.png, og/ images)
tools/serve.mjs        local preview that applies _headers, so the CSP is enforced
tools/og.html, og.mjs  re-renders the 1200×630 social images from the real engine
tools/check-i18n.mjs   checks every translation against en.json (keys, HTML, placeholders)
```

## Building and checking locally

```sh
node build.mjs                 # writes public/ and prints page weights and JS size
node tools/serve.mjs 8787      # http://localhost:8787/ with the _headers applied
```

Useful query strings on the home page: `?stats` (fps and ms/frame per canvas),
`?motion=reduced` (the Reduce Motion path: still frames and Play buttons).

## Switching on the 1.1 sections

Copy for 1.1 (Control Center pause, widgets, Spotlight actions, “describe a mood” presets,
Christmas free in December, live Pro preview) is already written in both languages and sits
in the page with `data-release="1.1" hidden`. When 1.1 is live on the App Store:

run `node build.mjs --release=1.1`, check it with `node tools/serve.mjs 8787`, and commit `public/`.

The blocks are in `src/home.html` (facts grid, Pro section, FAQ) and their strings under
`built.facts11`, `pro.release11` and `faq.items11` in `i18n/*.json`.

The Settings window mocks change with the release too. 1.1's window (sidebar with search, Look &
Motion with its live preview and section chips) sits between `<!--1.1-->` and `<!--/1.1-->`, and
1.0's between `<!--pre1.1-->` and `<!--/pre1.1-->`; the build keeps only the one for its release,
so the page never carries a hidden copy that a script could pick up. Their labels in `mock11` are
the app's own strings, copied from `Localizable.xcstrings`; the FAQ answer that names the window
switches to `faq.items[4].a11`, and the mocks' screen-reader labels to `mockLabel11`.

## Adding a language

All 16 languages the app ships in are on the site. `LANGUAGES` in `build.mjs` lists them; a language
is built once `i18n/<code>.json` exists, and the language menu, hreflang links, `og:locale` tags and
the sitemap follow on their own. After changing `en.json`, update every translation and run
`node tools/check-i18n.mjs`: it fails on a missing or extra key, changed HTML or placeholders, and
English left in place.

- Right to left: languages in `RTL` (`build.mjs`) get `dir="rtl"`. The CSS uses logical properties
  (`inset-inline-start`, `margin-inline-end`, `text-align: start`); keep it that way.
- Every language has its own social image (`src/static/og/og-<code>.png`) and Apple's own App Store
  badge (`src/assets/badge-mac-black-<code>.svg`, named by `badgeLang`), taken unchanged from the
  "Download on the Mac App Store" artwork at developer.apple.com/app-store/marketing/guidelines
  (black lockup, SVG). A language without one falls back to English. The build reads each badge's
  `viewBox` for the width it reserves at 48 px high.

## Adding effect videos

The gallery cards work with canvas posters alone. To add a short loop for a card, put
`name.mp4` (and optionally `name.webm`) in `src/assets/video/` and list them in
`src/data/effects.json`, e.g. `"video": { "mp4": "video/blizzard.mp4" }`. They play muted,
only while on screen, never under Reduce Motion; `media-src 'self'` already allows them.

## Social images

`src/static/og/og-<code>.png`, one per language, are rendered by the site's own engine with the
headline from `i18n/<code>.json` (`hero.title`). To redo one: `node tools/og.mjs`, open
`http://localhost:8790/tools/og.html?lang=<code>` (`?lang=pt-BR`, `?lang=zh-Hans`) in a browser on
a Mac, so the headline is set in the system font, wait until the page says `saved`, and commit the
PNG. `meta.ogAlt` in each language quotes that headline; change both together.

## Cloudflare deployment

The site is deployed by **Cloudflare Workers Builds** (project `snowwall-site`), which serves the
committed `public/` folder as static assets, `_headers` included, with no build step. `public/`
is the build's output and is committed: after changing anything in `src/` or `i18n/`, run
`node build.mjs` and commit `public/` with the change. A push to `main` deploys; if that build
fails, the previous version stays live.

To switch on the 1.1 sections when 1.1 is in the App Store, build with `node build.mjs
--release=1.1` and commit the result.

There is nothing to install: `package.json` has no dependencies.

`_headers` only applies on Cloudflare (and in `tools/serve.mjs`); a plain static server
ignores it.
