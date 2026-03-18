/*
 * AdBanner — sandboxed banner ad.
 *
 * Uses src="/ad-banner.html" (same origin) so aclib can make XHR/fetch requests.
 * sandbox excludes allow-top-navigation → iframe cannot redirect the parent page.
 * window.open override in index.html blocks pop-under on the parent page.
 */

interface Props {
  bottom?: number;
  inline?: boolean;
}

function BannerIframe() {
  return (
    <iframe
      src="/ad-banner.html"
      sandbox="allow-scripts allow-popups allow-same-origin"
      scrolling="no"
      style={{ width: 468, height: 60, border: 0, display: 'block', flexShrink: 0 }}
      title="advertisement"
    />
  );
}

export default function AdBanner({ bottom = 0, inline = false }: Props) {
  const wrapStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(10,10,20,0.95)',
    overflow: 'hidden',
    height: 60,
    flexShrink: 0,
    ...(inline
      ? { width: '100%', borderBottom: '1px solid rgba(255,255,255,0.06)' }
      : {
          position: 'fixed',
          bottom,
          left: 0,
          right: 0,
          zIndex: 25,
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }),
  };

  return (
    <div style={wrapStyle}>
      <BannerIframe />
    </div>
  );
}
