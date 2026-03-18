import { useEffect, useId } from 'react';

declare global {
  interface Window { aclib?: any; }
}

const BANNER_ZONE_ID = '11082246';

interface Props {
  bottom?: number;
  inline?: boolean;
}

export default function AdBar({ bottom = 0, inline = false }: Props) {
  const uid = useId().replace(/:/g, '');
  const containerId = `adbar-${uid}`;

  useEffect(() => {
    const run = () => {
      const el = document.getElementById(containerId);
      if (!el) return;
      try {
        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.text = `aclib.runBanner({ zoneId: '${BANNER_ZONE_ID}' });`;
        el.appendChild(script);
      } catch {}
    };

    if (window.aclib) {
      setTimeout(run, 0);
    } else {
      const t = setInterval(() => {
        if (window.aclib) { clearInterval(t); setTimeout(run, 0); }
      }, 300);
      return () => clearInterval(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerId]);

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
