# SnowWall site

The public pages for [SnowWall](https://snowwall.app), a macOS menu bar app that draws weather
over the desktop. Served by Cloudflare Pages at **snowwall.app** from the `public/` folder.
Plain HTML and one stylesheet: there is nothing to build.

| Path | What | Used by |
|---|---|---|
| `/` | what SnowWall is | Marketing URL in App Store Connect |
| `/support/` | answers and the support address | Support URL in App Store Connect (required, must be a web page) |
| `/privacy/` | privacy policy | the app's purchase window, Privacy Policy URL in App Store Connect |
| `/terms/` | terms of use | the app's purchase window |
| `404.html` | anything else | served by Pages for unknown paths |
| `_headers` | security and cache headers | read by Pages, not published as a page |

**The layout is the point.** Each page is `name/index.html`, so it answers at `/name` and
`/name/`. The app builds its links as `https://snowwall.app/privacy` and
`https://snowwall.app/terms`; renaming or moving those two folders breaks every copy of the
app already installed.

## Cloudflare Pages settings

1. **Workers & Pages → Create → Pages → Connect to Git**, repository `Ramiz69/SnowWall-site`.
2. **Project name:** `snowwall`.
3. **Production branch:** `main`.
4. **Build settings:** Framework preset *None*, build command empty, build output directory
   `public`.
5. **Custom domains → Set up a domain → `snowwall.app`**. The domain is registered with
   Cloudflare, so the DNS records are added automatically.

Every push to `main` redeploys; other branches get preview URLs.

## Checking locally

```sh
python3 -m http.server 8787 --directory public
```

`_headers` only applies on Cloudflare; the local server ignores it.
