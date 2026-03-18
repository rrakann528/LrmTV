import { useEffect, useRef } from 'react';

declare global {
  interface Window { aclib?: any; }
}

const BANNER_ZONE_ID = '11081914';

interface Props {
  bottom?: number;
  inline?: boolean;
}

export default function AdBar({ bottom = 0, inline = false }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current || !ref.current) return;
    loaded.current = true;

    const inject = () => {
      if (!ref.current) return;
      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.text = `aclib.runBanner({ zoneId: '${BANNER_ZONE_ID}' });`;
      ref.current.appendChild(script);
    };

    if (window.aclib) {
      inject();
    } else {
      const t = setInterval(() => {
        if (window.aclib) { clearInterval(t); inject(); }
      }, 300);
      return () => clearInterval(t);
    }
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
        height: 36,
      }}>
        <div ref={ref} style={{ width: 300, height: 36 }} />
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
      height: 36,
      overflow: 'hidden',
    }}>
      <div ref={ref} style={{ width: 300, height: 36 }} />
    </div>
  );
}
