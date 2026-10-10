#!/usr/bin/env node
// Renders the social images. Serves the repo on 127.0.0.1:8790 and accepts the PNG that
// tools/og.html posts back, writing it to src/static/og/og-<lang>.png.
//
//   node tools/og.mjs
//   then open http://localhost:8790/tools/og.html?lang=en and ?lang=ru in a browser
//   (any Chromium or Safari on a Mac, so the headline is set in the system font).

import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.json': 'application/json; charset=utf-8', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml' };

createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'POST' && url.pathname === '/save') {
    const lang = url.searchParams.get('lang');
    if (!/^[a-z]{2}(-[A-Za-z]{2,4})?$/.test(lang)) { res.writeHead(400).end('bad lang'); return; }
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      const out = join(ROOT, 'src/static/og', `og-${lang}.png`);
      writeFileSync(out, Buffer.concat(chunks));
      console.log('wrote', out);
      res.writeHead(200).end(`saved og-${lang}.png (${Buffer.concat(chunks).length} bytes)`);
    });
    return;
  }
  const file = normalize(join(ROOT, url.pathname));
  if (!file.startsWith(ROOT) || !existsSync(file)) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' }).end(readFileSync(file));
}).listen(8790, '127.0.0.1', () => console.log('http://localhost:8790/tools/og.html?lang=en'));
