'use client';

import { useEffect, useRef, useState } from 'react';
import { XIcon } from './icons';

/** Full-screen camera with a viewfinder. Calls onResult once with the decoded text, then stops. */
export function QrScanner({ onResult, onClose }: { onResult: (text: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  useEffect(() => {
    let stopped = false;
    let scanner: { stop(): void; destroy(): void } | null = null;

    (async () => {
      const { default: QrScannerLib } = await import('qr-scanner');
      if (stopped || !videoRef.current) return;
      const instance = new QrScannerLib(
        videoRef.current,
        (result) => {
          if (stopped) return;
          stopped = true;
          instance.stop();
          if (navigator.vibrate) navigator.vibrate(80);
          onResultRef.current(result.data);
        },
        { preferredCamera: 'environment', returnDetailedScanResult: true, maxScansPerSecond: 15 },
      );
      scanner = instance;
      try {
        await instance.start();
        setReady(true);
      } catch {
        setError('Could not open the camera. Allow camera access for this site, or search by name or mobile instead.');
      }
    })();

    return () => {
      stopped = true;
      scanner?.stop();
      scanner?.destroy();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black" role="dialog" aria-modal="true" aria-label="Scan QR code">
      <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" muted playsInline />

      {/* Dimmed surround with a clear square viewfinder */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="relative aspect-square w-[min(72vw,340px)] rounded-[28px] shadow-[0_0_0_100vmax_rgb(0_0_0/0.55)]">
          {(['top-0 left-0 border-t-4 border-l-4 rounded-tl-[28px]', 'top-0 right-0 border-t-4 border-r-4 rounded-tr-[28px]',
            'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-[28px]', 'bottom-0 right-0 border-b-4 border-r-4 rounded-br-[28px]'] as const).map((pos) => (
            <span key={pos} className={`absolute h-12 w-12 border-white ${pos}`} />
          ))}
          {ready && <span className="absolute inset-x-6 top-1/2 h-0.5 animate-pulse rounded-full bg-white/80" />}
        </div>
      </div>

      <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <span className="rounded-full bg-black/40 px-3 py-1.5 text-sm font-medium text-white backdrop-blur">Scan QR code</span>
        <button
          onClick={onClose}
          className="rounded-full bg-white/15 p-3 text-white backdrop-blur transition hover:bg-white/25"
          aria-label="Close scanner"
        >
          <XIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="absolute inset-x-0 bottom-0 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center">
        {error ? (
          <p className="mx-auto max-w-sm rounded-2xl bg-danger p-4 text-white">{error}</p>
        ) : (
          <p className="text-sm text-white/80">Point the camera at the guest&apos;s QR code</p>
        )}
      </div>
    </div>
  );
}
