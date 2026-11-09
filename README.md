# SnowWall site

The public site for [SnowWall](https://snowwall.app), a macOS menu bar app that draws weather
over the desktop. Built from `src/` into `public/` by `build.mjs` (Node, no dependencies) and
served by Cloudflare at **snowwall.app**.

| Path | What | Used by |
|---|---|---|
| `/` | the home page, English | Marketing URL in App Store Connect |
| `/ru/`, `/uk/`, `/de/`, `/ja/`, … | the home page in each of the app's 16 languages, plus Ukrainian | hreflang alternates of `/` |
| `/press/` | press kit: facts, screenshots, icon, ZIP | links in press emails |
| `/black-friday/`, `/ru/black-friday/`, … | the Black Friday 2026 offer (Pro about a third off, 27 Nov to 1 Dec), in all 17 site languages | deal lists and press, which want the old and new price and the dates on our own page |
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

## Release sections

SnowWall 1.2 is in the App Store (9 November 2026), and the build's default release is 1.2 (1.1 shipped on 13 October 2026):
`node build.mjs` shows every block marked `data-release="1.1"` and the 1.1 Settings window
mocks. `node build.mjs --release=1.0` still renders the page as it was for 1.0.

Blocks for a future release are written in every language and marked `data-release="<version>"
hidden`; markup that replaces something goes between `<!--<version>-->` and `<!--/<version>-->`,
with what it replaces between `<!--pre<version>-->` and `<!--/pre<version>-->` (the build handles
1.1; add the next version's markers to `render()` in `build.mjs` when it comes). On release day
raise the default in `build.mjs`, build, check with `node tools/serve.mjs 8787`, and commit `public/`.

The 1.1 Settings window mocks (sidebar with search, Look & Motion with its live preview and
section chips) take their labels in `mock11` from the app's `Localizable.xcstrings`; the FAQ answer
that names the window uses `faq.items[4].a11`, and the mocks' screen-reader labels `mockLabel11`.

SnowWall 1.2 is prepared the same way and shows with `RELEASE=1.2 node build.mjs`: the Your Emoji
card (`"release": "1.2"` in `src/data/effects.json` keeps it out of earlier builds; the canvas
draws the app's default emoji), the counts that include it (`seasons.lede12`, the Pro row's
`label12`/`note12`, `faq.items[0].a12`), the release note `pro.release12`, and in the press kit
the frost screenshot and "New in 1.2".

## Black Friday page

`src/black-friday.html`, with its strings under `blackFriday` in every `i18n/<lang>.json` (checked by
`tools/check-i18n.mjs` like the rest). The build renders it per language at `<home path>black-friday/`,
lists the versions as hreflang alternates of each other (in the page and in the sitemap), and links its
App Store badges with the campaign `site-blackfriday`. "All {count} effects" is filled from the release:
11 in 1.1, 12 in 1.2 (the app's own count, Hearts included); Your Emoji is a `data-release="1.2" hidden`
span. The home page's Pro section links to the page between `<!--sale-->` markers, kept only by builds
up to `SALE.lastDay` in `build.mjs`: rebuild and push after 1 December and the link is gone.

## Adding a language

All 16 languages the app ships in are on the site, and Ukrainian, which the app adds in 1.2. The
"16 languages" fact on the home page (`built.facts`, icon `globe`) and the press kit's count switch
to 17 in the 1.2 build (`title12`/`body12`, and `<!--1.2-->`/`<!--pre1.2-->` markers, which `render()`
now handles for any version). `LANGUAGES` in `build.mjs` lists them; a language
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

`wrangler.jsonc` is the deploy configuration. The only code is `worker/index.js`, and it runs
only for `.mp4` paths: static assets answer a `Range` request with the whole file, and
Safari won't play a video without a `206`. Test it locally with `npx wrangler dev`.


There is nothing to install: `package.json` has no dependencies.

`_headers` only applies on Cloudflare (and in `tools/serve.mjs`); a plain static server
ignores it.
