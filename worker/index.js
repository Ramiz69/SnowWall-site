// Serves the static site from public/, and answers byte-range requests for video.
// Workers static assets reply to `Range` with the whole file (200). Safari and every WebKit
// view open a video with a range probe and never start playback without a 206, so the
// videos on the home and press pages only played in Chrome.
export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);
    const url = new URL(request.url);
    if (!url.pathname.endsWith('.mp4') || response.status !== 200) return response;

    const headers = new Headers(response.headers);
    headers.set('Accept-Ranges', 'bytes');
    const range = parseRange(request.headers.get('Range'));
    if (!range || request.method !== 'GET') {
      return new Response(response.body, { status: 200, headers });
    }

    const body = await response.arrayBuffer();
    const size = body.byteLength;
    let { start, end } = range;
    if (start === null) { start = Math.max(0, size - end); end = size - 1; }  // bytes=-N: the last N
    else if (end === null || end >= size) end = size - 1;
    if (start >= size || start > end) {
      headers.set('Content-Range', `bytes */${size}`);
      headers.delete('Content-Length');
      return new Response(null, { status: 416, headers });
    }
    headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
    headers.set('Content-Length', String(end - start + 1));
    return new Response(body.slice(start, end + 1), { status: 206, headers });
  },
};

/** A single `bytes=a-b`, `bytes=a-` or `bytes=-n`; anything else (several ranges, other units) gets the whole file. */
function parseRange(value) {
  const m = /^bytes=(\d*)-(\d*)$/.exec((value || '').trim());
  if (!m || (m[1] === '' && m[2] === '')) return null;
  return { start: m[1] === '' ? null : Number(m[1]), end: m[2] === '' ? null : Number(m[2]) };
}
