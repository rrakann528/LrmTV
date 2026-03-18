import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';

const BANNER_ZONE_ID = '11082246';

const AD_SRCDOC = (w: number, h: number) =>
  `<!DOCTYPE html><html><head><style>*{margin:0;padding:0;overflow:hidden}body{width:${w}px;height:${h}px;background:transparent;display:flex;align-items:center;justify-content:center}</style></head><body><script src="//acscdn.com/script/aclib.js"><\/script><script>window.onload=function(){try{aclib.runBanner({zoneId:'${BANNER_ZONE_ID}'});}catch(e){}}<\/script></body></html>`;

const COUNTDOWN = 5;

interface Props {
  onDone: () => void;
}

export default function InterstitialAd({ onDone }: Props) {
  const [seconds, setSeconds] = useState(COUNTDOWN);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/95"
      >
        {/* Header */}
        <div className="w-full max-w-sm px-4 mb-4 flex items-center justify-between">
          <span className="text-white/50 text-xs">إعلان</span>
          {seconds > 0 ? (
            <span className="text-white/60 text-sm font-mono">
              تخطي بعد {seconds}ث
            </span>
          ) : (
            <button
              onClick={onDone}
              className="text-xs text-white bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 hover:bg-white/20 transition-colors"
            >
              تخطي ←
            </button>
          )}
        </div>

        {/* Ad — 2 banners stacked for more visibility */}
        <div className="flex flex-col gap-3 items-center">
          <div className="rounded-xl overflow-hidden shadow-2xl">
            <iframe
              srcDoc={AD_SRCDOC(468, 60)}
              sandbox="allow-scripts allow-popups"
              scrolling="no"
              style={{ width: 320, height: 60, border: 0, display: 'block' }}
              title="ad-1"
            />
          </div>
          <div className="rounded-xl overflow-hidden shadow-2xl">
            <iframe
              srcDoc={AD_SRCDOC(468, 60)}
              sandbox="allow-scripts allow-popups"
              scrolling="no"
              style={{ width: 320, height: 60, border: 0, display: 'block' }}
              title="ad-2"
            />
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full max-w-sm px-4 mt-6">
          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              initial={{ width: '100%' }}
              animate={{ width: '0%' }}
              transition={{ duration: COUNTDOWN, ease: 'linear' }}
            />
          </div>
        </div>

        {/* Enter button (always visible after countdown) */}
        {seconds === 0 && (
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={onDone}
            className="mt-6 px-8 py-3 bg-primary text-primary-foreground rounded-2xl font-bold text-base shadow-xl shadow-primary/30 active:scale-95 transition-all"
          >
            دخول الغرفة
          </motion.button>
        )}
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
