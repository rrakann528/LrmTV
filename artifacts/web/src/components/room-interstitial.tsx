/*
 * RoomInterstitial — full-screen Adcash interstitial between home and room.
 *
 * • Loads /ad-interstitial.html (same origin) in a full-screen iframe.
 * • Our React layer sits on TOP with a countdown + skip button (z-index higher).
 * • After 5 s the skip button appears; after 3 more s it auto-navigates.
 * • sandbox excludes allow-top-navigation → iframe cannot hijack parent navigation.
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';

const COUNTDOWN = 5;

interface Props {
  onDone: () => void;
}

export default function RoomInterstitial({ onDone }: Props) {
  const [seconds, setSeconds] = useState(COUNTDOWN);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  /* Auto-navigate 3 s after countdown hits 0 */
  useEffect(() => {
    if (seconds !== 0) return;
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [seconds, onDone]);

  return createPortal(
    <div className="fixed inset-0 z-[9999]">

      {/* Full-screen Adcash interstitial iframe */}
      <iframe
        src="/ad-interstitial.html"
        sandbox="allow-scripts allow-popups allow-same-origin"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
        title="ad"
      />

      {/* Countdown / skip button — above the iframe */}
      <div className="absolute top-0 inset-x-0 z-10 flex justify-end p-4">
        {seconds > 0 ? (
          <div className="bg-black/75 backdrop-blur text-white text-sm px-4 py-2 rounded-full font-mono border border-white/20 select-none">
            تخطي بعد {seconds}ث
          </div>
        ) : (
          <AnimatePresence>
            <motion.button
              key="skip"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={onDone}
              className="bg-white text-black font-bold text-sm px-5 py-2 rounded-full shadow-xl active:scale-95 transition-all"
            >
              تخطي ← دخول الغرفة
            </motion.button>
          </AnimatePresence>
        )}
      </div>

      {/* Progress bar */}
      <div className="absolute bottom-0 inset-x-0 z-10 h-1 bg-white/20">
        <motion.div
          className="h-full bg-white"
          initial={{ width: '100%' }}
          animate={{ width: '0%' }}
          transition={{ duration: COUNTDOWN, ease: 'linear' }}
        />
      </div>
    </div>,
    document.body
  );
}
