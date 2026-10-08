# SnowWall site

The public site for [SnowWall](https://snowwall.app), a macOS menu bar app that draws weather
over the desktop. Built from `src/` into `dist/` by `build.mjs` (Node, no dependencies) and
served by Cloudflare Pages at **snowwall.app**.

| Path | What | Used by |
|---|---|---|
| `/` | the home page, English | Marketing URL in App Store Connect |
| `/ru/` | the home page, Russian | hreflang alternate of `/` |
| `/support/` | answers and the support address | Support URL in App Store Connect (required, must be a web page) |
| `/privacy/` | privacy policy | the app's purchase window, Privacy Policy URL in App Store Connect |
| `/terms/` | terms of use | the app's purchase window |
| `404.html` | anything else | served by Pages for unknown paths |
| `_headers` | security and cache headers | read by Pages, not published as a page |

**The URLs are the point.** Each page is `name/index.html`, so it answers at `/name` and
`/name/`. The app builds its links as `https://snowwall.app/privacy` and
`https://snowwall.app/terms`; renaming or moving those pages breaks every copy of the app
already installed.

## Layout

```
build.mjs              the build: templates + i18n -> dist/, hashed assets, sitemap, size report
i18n/en.json, ru.json  every string on the home page, per language
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
```

## Building and checking locally

```sh
node build.mjs                 # writes dist/ and prints page weights and JS size
node tools/serve.mjs 8787      # http://localhost:8787/ with the _headers applied
```

Useful query strings on the home page: `?stats` (fps and ms/frame per canvas),
`?motion=reduced` (the Reduce Motion path: still frames and Play buttons).

## Switching on the 1.1 sections

Copy for 1.1 (Control Center pause, widgets, Spotlight actions, “describe a mood” presets,
Christmas free in December, live Pro preview) is already written in both languages and sits
in the page with `data-release="1.1" hidden`. When 1.1 is live on the App Store:

- either set the Pages environment variable `RELEASE` to `1.1` and redeploy,
- or run `node build.mjs --release=1.1` locally to look first.

The blocks are in `src/home.html` (facts grid, Pro section, FAQ) and their strings under
`built.facts11`, `pro.release11` and `faq.items11` in `i18n/*.json`.

## Adding effect videos

The gallery cards work with canvas posters alone. To add a short loop for a card, put
`name.mp4` (and optionally `name.webm`) in `src/assets/video/` and list them in
`src/data/effects.json`, e.g. `"video": { "mp4": "video/blizzard.mp4" }`. They play muted,
only while on screen, never under Reduce Motion; `media-src 'self'` already allows them.

## Social images

`src/static/og/og-en.png` and `og-ru.png` are rendered by the site's own engine. To redo
them: `node tools/og.mjs`, open `http://localhost:8790/tools/og.html?lang=en` and `?lang=ru`
in a browser on a Mac (so the headline is set in the system font), and commit the PNGs.

## Cloudflare Pages settings

The site now has a build step, so the existing project needs its build settings changed
**before this branch is merged to `main`** (otherwise the next deploy finds no `public/`
folder and publishes nothing useful):

1. **Workers & Pages → snowwall → Settings → Build → Build configuration**
   - **Framework preset:** None
   - **Build command:** `node build.mjs`
   - **Build output directory:** `dist`
   - **Root directory:** empty (the repository root)
2. **Settings → Variables and Secrets** (optional): `NODE_VERSION` = `22`. The repo also has a
   `.node-version` file with `22`, which the Pages build image reads; any Node 18+ works.
   Leave `RELEASE` unset until 1.1 ships.
3. Push the branch and open its **preview URL** (Pages builds every branch) to check the site
   and the response headers there, then merge to `main`.

There is nothing to install: `package.json` has no dependencies.

`_headers` only applies on Cloudflare (and in `tools/serve.mjs`); a plain static server
ignores it.
