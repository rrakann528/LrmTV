import { Router } from 'express';

const router = Router();

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Range, Origin, Accept',
};

function buildRequestHeaders(req: import('express').Request, _targetUrl: string, _referer: string): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    Accept: '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'identity',
  };
  if (req.headers.range) headers['Range'] = req.headers.range as string;
  return headers;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/proxy/detect?url=<encoded>
//
// Probes a URL to determine the stream/media type:
//   hls | dash | mp4 | webm | unknown
// ─────────────────────────────────────────────────────────────────────────────
router.get('/proxy/detect', async (req, res) => {
  const rawUrl = req.query.url as string | undefined;
  if (!rawUrl) { res.status(400).json({ error: 'Missing url param' }); return; }

  let targetUrl: string;
  try { targetUrl = decodeURIComponent(rawUrl); new URL(targetUrl); }
  catch { res.status(400).json({ error: 'Invalid url' }); return; }

  const lower = targetUrl.toLowerCase();

  if (lower.includes('.mpd') || lower.includes('/manifest.mpd') || lower.includes('dash')) {
    res.json({ type: 'dash' }); return;
  }
  if (lower.includes('.m3u8') || lower.includes('m3u8') || lower.includes('hls')) {
    res.json({ type: 'hls' }); return;
  }
  if (lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.mkv') || lower.endsWith('.avi')) {
    res.json({ type: 'mp4' }); return;
  }

  try {
    const headers = buildRequestHeaders(req, targetUrl, '');
    const probeRes = await fetch(targetUrl, { method: 'HEAD', headers, redirect: 'follow', signal: AbortSignal.timeout(6000) });
    const ct = (probeRes.headers.get('content-type') ?? '').toLowerCase();
    if (ct.includes('mpegurl') || ct.includes('m3u8')) { res.json({ type: 'hls'  }); return; }
    if (ct.includes('dash') || ct.includes('mpd'))     { res.json({ type: 'dash' }); return; }
    if (ct.includes('mp4') || ct.includes('mpeg4'))    { res.json({ type: 'mp4'  }); return; }
    if (ct.includes('webm'))                           { res.json({ type: 'webm' }); return; }

    const getRes = await fetch(targetUrl, { headers, redirect: 'follow', signal: AbortSignal.timeout(6000) });
    const buf = Buffer.from(await getRes.arrayBuffer().catch(() => new ArrayBuffer(0)));
    if (buf.length >= 7 && buf.toString('utf8', 0, 7) === '#EXTM3U') { res.json({ type: 'hls' }); return; }
    if (buf.length >= 8 && buf.toString('ascii', 4, 8) === 'ftyp')   { res.json({ type: 'mp4' }); return; }
    res.json({ type: 'unknown', contentType: ct });
  } catch (err) {
    res.json({ type: 'unknown', error: String(err) });
  }
});

router.options('/proxy/detect', (_req, res) => { res.set(CORS_HEADERS).sendStatus(204); });

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/proxy/manifest?url=<encoded>
//
// Fetches an HLS manifest server-side (bypasses mixed-content & CORS),
// rewrites all relative segment/playlist URIs to absolute URLs, then
// rewrites those absolute URLs to go through /api/proxy/segment so the
// browser never needs to make a direct HTTP request to the upstream CDN.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/proxy/manifest', async (req, res) => {
  const rawUrl = req.query.url as string | undefined;
  if (!rawUrl) { res.status(400).send('Missing url'); return; }

  let targetUrl: string;
  try { targetUrl = decodeURIComponent(rawUrl); new URL(targetUrl); }
  catch { res.status(400).send('Invalid url'); return; }

  try {
    const headers = buildRequestHeaders(req, targetUrl, '');
    const upstream = await fetch(targetUrl, { headers, redirect: 'follow', signal: AbortSignal.timeout(10000) });
    if (!upstream.ok) { res.status(upstream.status).send('Upstream error'); return; }

    const text = await upstream.text();

    // Base directory of the manifest URL (for resolving relative URIs)
    const baseDir = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);

    const rewritten = text.split('\n').map(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return line;

      // Make the URI absolute
      const absolute = trimmed.startsWith('http')
        ? trimmed
        : new URL(trimmed, baseDir).href;

      // Route through our segment proxy (handles HTTP→HTTPS and CORS)
      return `/api/proxy/segment?url=${encodeURIComponent(absolute)}`;
    }).join('\n');

    res.set({
      ...CORS_HEADERS,
      'Content-Type': 'application/vnd.apple.mpegurl',
      'Cache-Control': 'no-cache, no-store',
    }).send(rewritten);
  } catch {
    res.status(502).send('Manifest proxy error');
  }
});

router.options('/proxy/manifest', (_req, res) => { res.set(CORS_HEADERS).sendStatus(204); });

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/proxy/segment?url=<encoded>
//
// Streams a single TS segment (or sub-playlist) from the upstream CDN to
// the browser.  Used by /api/proxy/manifest to serve HTTP content over HTTPS.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/proxy/segment', async (req, res) => {
  const rawUrl = req.query.url as string | undefined;
  if (!rawUrl) { res.status(400).send('Missing url'); return; }

  let targetUrl: string;
  try { targetUrl = decodeURIComponent(rawUrl); new URL(targetUrl); }
  catch { res.status(400).send('Invalid url'); return; }

  // Sub-playlists (.m3u8) must also be rewritten
  const isPlaylist = targetUrl.toLowerCase().includes('.m3u8') || targetUrl.toLowerCase().includes('m3u8');

  try {
    const headers = buildRequestHeaders(req, targetUrl, '');
    const upstream = await fetch(targetUrl, { headers, redirect: 'follow', signal: AbortSignal.timeout(20000) });
    if (!upstream.ok) { res.status(upstream.status).send('Upstream error'); return; }

    if (isPlaylist) {
      // Rewrite sub-playlist the same way as the main manifest
      const text = await upstream.text();
      const baseDir = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
      const rewritten = text.split('\n').map(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return line;
        const absolute = trimmed.startsWith('http') ? trimmed : new URL(trimmed, baseDir).href;
        return `/api/proxy/segment?url=${encodeURIComponent(absolute)}`;
      }).join('\n');
      res.set({ ...CORS_HEADERS, 'Content-Type': 'application/vnd.apple.mpegurl', 'Cache-Control': 'no-cache' }).send(rewritten);
      return;
    }

    const contentType = upstream.headers.get('content-type') ?? 'video/mp2t';
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.set({
      ...CORS_HEADERS,
      'Content-Type': contentType,
      'Content-Length': String(buf.length),
      'Cache-Control': 'max-age=30',
    }).send(buf);
  } catch {
    res.status(502).send('Segment proxy error');
  }
});

router.options('/proxy/segment', (_req, res) => { res.set(CORS_HEADERS).sendStatus(204); });

export default router;
