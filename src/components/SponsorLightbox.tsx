'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { SponsorTier } from '@/config/sponsors';
import type { Sponsor } from '@/lib/sponsors';
import { AwardIcon, ChevronRightIcon, ExternalIcon, XIcon, ZoomInIcon } from './icons';
import { TIER_ICON } from './TierBadge';

/** A sponsor along with the tier it's in. */
export type ShownSponsor = Sponsor & { tier: SponsorTier };

function Medal({ tier, className = 'h-11 w-11', iconClass = 'h-5 w-5' }: { tier: SponsorTier; className?: string; iconClass?: string }) {
  const Icon = TIER_ICON[tier.key] ?? AwardIcon;
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full shadow-sm ring-1 ring-black/10 ${className}`}
      style={{ background: tier.metal, color: tier.ink }}
    >
      <Icon className={iconClass} />
    </span>
  );
}

/**
 * Full-screen view of one sponsor's image, at its own shape and as large as
 * the screen allows. Tap the image to zoom in (drag to look around a flyer),
 * tap again to fit. Close (✕) at the top; ‹ › or swipe to move between sponsors.
 */
export function SponsorLightbox({ items, index, onIndex, onClose }: { items: ShownSponsor[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const item = items[index];
  const many = items.length > 1;
  /** Width of the zoomed image in px, or null when it fits the screen. */
  const [zoom, setZoom] = useState<number | null>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const image = useRef<HTMLImageElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const touchX = useRef<number | null>(null);

  const go = (step: number) => {
    setZoom(null);
    onIndex((index + step + items.length) % items.length);
  };
  const toggleZoom = () => {
    if (zoom) return setZoom(null);
    const el = image.current;
    if (!el) return;
    const fitted = el.clientWidth;
    // About 2.5× (enough to read a flyer's small print), but not far past the image's own resolution.
    setZoom(Math.round(Math.max(fitted * 1.6, Math.min(fitted * 2.5, el.naturalWidth * 1.25))));
  };

  // Start a zoomed view at the top centre of the image.
  useLayoutEffect(() => {
    const s = scroller.current;
    if (zoom && s) {
      s.scrollLeft = (s.scrollWidth - s.clientWidth) / 2;
      s.scrollTop = 0;
    }
  }, [zoom]);

  // Latest handlers for the key listener, which is set up once.
  const keys = useRef({ go, onClose, zoom, setZoom });
  useEffect(() => {
    keys.current = { go, onClose, zoom, setZoom };
  });

  useEffect(() => {
    closeButton.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      const k = keys.current;
      if (e.key === 'Escape') {
        if (k.zoom) k.setZoom(null);
        else k.onClose();
      } else if (e.key === 'ArrowLeft') k.go(-1);
      else if (e.key === 'ArrowRight') k.go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  const round = 'flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white ring-1 ring-white/20 transition';
  const arrow = `${round} bg-white/12 hover:bg-white/25`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="lightbox-name"
      className="animate-fade fixed inset-0 z-50 flex flex-col"
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current === null || !many || zoom) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (Math.abs(dx) > 50) go(dx > 0 ? -1 : 1);
      }}
    >
      {/* Backdrop: tap anywhere outside the image to close. */}
      <div aria-hidden="true" className="absolute inset-0 bg-[#0b0d12]/90 backdrop-blur-md" onClick={onClose} />

      <div className="relative flex items-center justify-between gap-3 px-4 pt-[calc(1rem+env(safe-area-inset-top))] sm:px-6">
        <span className="flex min-w-0 items-center gap-2.5 rounded-full bg-white/10 py-1.5 pr-4 pl-1.5 text-sm font-semibold text-white ring-1 ring-white/15">
          <Medal tier={item.tier} className="h-8 w-8" iconClass="h-4 w-4" />
          <span className="truncate">{item.tier.label.replace(/s$/, '')}</span>
        </span>
        <button ref={closeButton} type="button" onClick={onClose} aria-label="Close" className={`${round} bg-white/20 hover:bg-white/30`}>
          <XIcon className="h-6 w-6" />
        </button>
      </div>

      {zoom ? (
        <div ref={scroller} className="relative min-h-0 flex-1 overflow-auto overscroll-contain px-4 py-4">
          <button type="button" onClick={toggleZoom} aria-label="Fit to screen" className="mx-auto block cursor-zoom-out" style={{ width: zoom }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- plain files from public/ */}
            <img src={item.src} alt={`${item.name}, zoomed in`} className="block h-auto w-full rounded-xl bg-white" />
          </button>
        </div>
      ) : (
        <div className="pointer-events-none relative flex min-h-0 flex-1 items-center justify-center gap-4 px-4 py-3 sm:px-6">
          {many && (
            <button type="button" onClick={() => go(-1)} aria-label="Previous sponsor" className={`${arrow} pointer-events-auto hidden sm:flex`}>
              <ChevronRightIcon className="h-6 w-6 rotate-180" />
            </button>
          )}

          <figure key={index} className="lightbox-zoom pointer-events-auto flex min-w-0 flex-col items-center">
            <button
              type="button"
              onClick={toggleZoom}
              aria-label="Zoom in"
              className="cursor-zoom-in rounded-[22px] p-[3px] shadow-2xl"
              style={{ background: item.tier.metal }}
            >
              <span className="block rounded-[19px] bg-white p-1.5 sm:p-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- plain files from public/ */}
                <img
                  ref={image}
                  src={item.src}
                  alt={`${item.name}`}
                  className="block h-auto max-h-[calc(100dvh-20rem)] w-auto max-w-[calc(100vw-3rem)] rounded-[14px] object-contain sm:max-h-[calc(100dvh-17rem)] sm:max-w-[min(60rem,calc(100vw-12rem))]"
                />
              </span>
            </button>
            <figcaption className="mt-4 text-center text-white">
              <h2 id="lightbox-name" className="text-2xl font-semibold tracking-tight">
                {item.name}
              </h2>
              {item.tagline && <p className="mx-auto mt-1 max-w-xl text-white/75">{item.tagline}</p>}
              {item.url && (
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="btn btn-primary mt-3 px-5">
                  Visit website <ExternalIcon className="h-4 w-4" />
                </a>
              )}
              <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-white/60">
                <ZoomInIcon className="h-3.5 w-3.5" /> Tap the image to zoom in
              </p>
            </figcaption>
          </figure>

          {many && (
            <button type="button" onClick={() => go(1)} aria-label="Next sponsor" className={`${arrow} pointer-events-auto hidden sm:flex`}>
              <ChevronRightIcon className="h-6 w-6" />
            </button>
          )}
        </div>
      )}

      <div className="relative flex items-center justify-center gap-5 px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-white">
        {zoom ? (
          <button type="button" onClick={toggleZoom} className="btn bg-white/15 text-white ring-1 ring-white/20 hover:bg-white/25">
            Fit to screen
          </button>
        ) : (
          many && (
            <>
              <button type="button" onClick={() => go(-1)} aria-label="Previous sponsor" className={`${arrow} sm:hidden`}>
                <ChevronRightIcon className="h-6 w-6 rotate-180" />
              </button>
              <span className="text-sm text-white/70 tabular-nums">
                {index + 1} / {items.length}
              </span>
              <button type="button" onClick={() => go(1)} aria-label="Next sponsor" className={`${arrow} sm:hidden`}>
                <ChevronRightIcon className="h-6 w-6" />
              </button>
            </>
          )
        )}
      </div>
    </div>
  );
}
