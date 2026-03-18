import { useEffect, useRef, useState } from 'react';

const VAST_TAG = 'https://youradexchange.com/video/select.php?r=11081990';
const SKIP_AFTER = 5;
const MIN_SHOW_MS = 3000;

interface Props { onDone: () => void; }

function parseVastVideoUrl(xml: string): string | null {
  try {
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    const files = Array.from(doc.querySelectorAll('MediaFile'));
    const mp4 = files.find(f => (f.getAttribute('type') || '').includes('mp4')) || files[0];
    return mp4?.textContent?.trim() || null;
  } catch {
    return null;
  }
}

async function fetchVast(): Promise<string | null> {
  // Try direct fetch first (most VAST servers allow CORS)
  try {
    const r = await fetch(VAST_TAG, { signal: AbortSignal.timeout(6000) });
    const xml = await r.text();
    const url = parseVastVideoUrl(xml);
    if (url) return url;
  } catch { /* fall through */ }

  // Fallback: try via our proxy
  try {
    const r = await fetch(`/api/proxy/vast?url=${encodeURIComponent(VAST_TAG)}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (r.ok) {
      const xml = await r.text();
      return parseVastVideoUrl(xml);
    }
  } catch { /* fall through */ }

  return null;
}

export default function PreRollAd({ onDone }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [skip, setSkip] = useState(false);
  const [countdown, setCountdown] = useState(SKIP_AFTER);
  const done = useRef(false);
  const shownAt = useRef(Date.now());

  const finish = () => {
    if (done.current) return;
    // Ensure minimum display time even on instant failure
    const elapsed = Date.now() - shownAt.current;
    const wait = Math.max(0, MIN_SHOW_MS - elapsed);
    setTimeout(() => {
      if (!done.current) { done.current = true; onDone(); }
    }, wait);
  };

  useEffect(() => {
    shownAt.current = Date.now();
    fetchVast().then(url => {
      setLoading(false);
      if (url) setSrc(url);
      else finish();
    });
  }, []);

  useEffect(() => {
    if (!src) return;
    const t = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(t); setSkip(true); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [src]);

  return (
    <div
      style={{
        position: 'absolute', inset: 0, zIndex: 60,
        background: '#000', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      {loading ? (
        <div style={{ color: '#444', fontSize: 13 }}>جاري تحميل الإعلان…</div>
      ) : src ? (
        <>
          <video
            src={src}
            autoPlay
            playsInline
            onEnded={finish}
            onError={finish}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
          <div style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(0,0,0,0.6)', color: '#aaa', fontSize: 11, padding: '3px 8px', borderRadius: 4 }}>
            إعلان
          </div>
          <div style={{ position: 'absolute', bottom: 16, right: 16 }}>
            {skip ? (
              <button
                onClick={finish}
                style={{ background: 'rgba(0,0,0,0.85)', color: '#fff', border: '1px solid rgba(255,255,255,0.4)', padding: '8px 18px', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}
              >
                تخطي الإعلان ▶
              </button>
            ) : (
              <div style={{ background: 'rgba(0,0,0,0.7)', color: '#ccc', padding: '6px 14px', borderRadius: 4, fontSize: 12 }}>
                تخطي بعد {countdown}s
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
