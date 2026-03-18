import { useEffect, useId } from 'react';

declare global {
  interface Window { aclib?: any; }
}

const BANNER_ZONE_ID = '11082246';

interface Props {
  bottom?: number;
  inline?: boolean;
}

function runAd(containerId: string) {
  const el = document.getElementById(containerId);
  if (!el || !window.aclib) return;
  try {
    const result = window.aclib.runBanner({ zoneId: BANNER_ZONE_ID, el });
    if (result && typeof result.then === 'function') result.catch(() => {});
  } catch {}
}

export default function AdBar({ bottom = 0, inline = false }: Props) {
  const uid = useId().replace(/[^a-z0-9]/gi, '');
  const containerId = `adbar-${uid}`;

  useEffect(() => {
    if (window.aclib) {
      setTimeout(() => runAd(containerId), 0);
    } else {
      const t = setInterval(() => {
        if (window.aclib) { clearInterval(t); setTimeout(() => runAd(containerId), 0); }
      }, 300);
      return () => clearInterval(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (inline) {
    return (
      <div style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(10,10,20,0.95)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        overflow: 'hidden',
        height: 60,
      }}>
        <div id={containerId} style={{ width: 468, height: 60 }} />
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      bottom,
      left: 0,
      right: 0,
      zIndex: 25,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(10,10,20,0.95)',
      borderTop: '1px solid rgba(255,255,255,0.06)',
      height: 60,
      overflow: 'hidden',
    }}>
      <div id={containerId} style={{ width: 468, height: 60 }} />
    </div>
  );
}
