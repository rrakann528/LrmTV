import { useEffect } from 'react';
import { createPortal } from 'react-dom';

const ZONE_ID      = '11083266';
const AUTO_NAV_MS  = 10_000; // fallback: navigate after 10 s if user ignores the ad

function suppressAclibErrors() {
  const onErr = (e: ErrorEvent)            => { e.preventDefault(); };
  const onRej = (e: PromiseRejectionEvent) => { e.preventDefault(); };
  window.addEventListener('error', onErr);
  window.addEventListener('unhandledrejection', onRej);
  setTimeout(() => {
    window.removeEventListener('error', onErr);
    window.removeEventListener('unhandledrejection', onRej);
  }, AUTO_NAV_MS + 2000);
}

function runInterstitial(onDone: () => void) {
  suppressAclibErrors();

  const ua = navigator.userAgent;
  (window as any).isIos     ??= /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
  (window as any).isSafari  ??= /^((?!chrome|android).)*safari/i.test(ua);
  (window as any).isAndroid ??= /android/i.test(ua);

  const fire = () => {
    try {
      (window as any).aclib?.runInterstitial({
        zoneId: ZONE_ID,
        onClose: onDone, // navigate as soon as Adcash closes the ad
      });
    } catch (_) {}
  };

  if ((window as any).aclib) { fire(); return; }

  if (!document.getElementById('aclib-script')) {
    const s = document.createElement('script');
    s.id      = 'aclib-script';
    s.src     = '//acscdn.com/script/aclib.js';
    s.onload  = fire;
    s.onerror = () => {};
    document.head.appendChild(s);
  } else {
    let n = 0;
    const t = setInterval(() => {
      if ((window as any).aclib || ++n > 20) { clearInterval(t); fire(); }
    }, 100);
  }
}

interface Props { onDone: () => void; }

export default function InterstitialAd({ onDone }: Props) {
  useEffect(() => {
    try { runInterstitial(onDone); } catch (_) {}

    // Fallback: navigate after AUTO_NAV_MS even if ad is never shown or no onClose fires
    const fallback = setTimeout(onDone, AUTO_NAV_MS);
    return () => clearTimeout(fallback);
  }, [onDone]);

  // Render nothing — Adcash draws its own full-screen overlay
  return createPortal(null, document.body);
}
