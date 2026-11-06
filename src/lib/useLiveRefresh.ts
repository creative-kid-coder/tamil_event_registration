'use client';

import { useEffect, useRef } from 'react';

/**
 * Calls `load` every `ms` while the page is on screen, and straight away when
 * the user comes back to it. Phones rarely send a window "focus" event when you
 * unlock the screen or switch back from another app, so this listens for page
 * visibility too. Polling pauses while the page is hidden, to save battery.
 */
export function useLiveRefresh(load: () => unknown, ms: number) {
  const latest = useRef(load);
  useEffect(() => {
    latest.current = load;
  });

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    let lastRun = 0;
    const run = () => {
      // Coming back to the page can fire several of these events at once.
      if (Date.now() - lastRun < 1000) return;
      lastRun = Date.now();
      latest.current();
    };
    const start = () => {
      clearInterval(timer);
      timer = setInterval(run, ms);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        run();
        start();
      } else {
        clearInterval(timer);
      }
    };

    start();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', run);
    window.addEventListener('online', run);
    window.addEventListener('pageshow', run); // back/forward cache restore (iOS Safari)
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', run);
      window.removeEventListener('online', run);
      window.removeEventListener('pageshow', run);
    };
  }, [ms]);
}
