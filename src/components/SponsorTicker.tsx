'use client';

import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { SponsorTier } from '@/config/sponsors';
import type { Sponsor } from '@/lib/sponsors';
import { Diya } from './EventName';
import { PauseIcon, PlayIcon } from './icons';
import { type ShownSponsor, SponsorLightbox } from './SponsorLightbox';
import { TierBadge } from './TierBadge';

interface TierGroup {
  tier: SponsorTier;
  sponsors: Sponsor[];
}

/** Scroll speed in px a second: a slow, steady drift. */
const SPEED = 40;

/**
 * Pages without the bar: the check-in desk and admin pages (staff need the
 * whole screen, without movement), the demo video, and the projector screen,
 * which shows the sponsors itself. Sign-in keeps it.
 */
const NO_TICKER = ['/desk', '/admin', '/demo', '/screen'];

/**
 * Every sponsor gets the same white tile, whatever the shape of their image, so
 * a portrait flyer counts as much as a wide logo; tiles are larger for higher
 * tiers (all 8:5). Any other folder gets the Community size.
 */
const TILE: Record<string, string> = {
  platinum: 'h-[60px] w-[96px] sm:h-[76px] sm:w-[122px]',
  gold: 'h-[54px] w-[86px] sm:h-[68px] sm:w-[109px]',
  silver: 'h-[48px] w-[77px] sm:h-[60px] sm:w-[96px]',
  associate: 'h-[48px] w-[77px] sm:h-[60px] sm:w-[96px]',
  community: 'h-[42px] w-[67px] sm:h-[52px] sm:w-[83px]',
};

/**
 * The sponsors, fixed along the bottom of the guest pages: the Tamil thank-you
 * as a heading, then one row that drifts slowly past, fading out at both ends —
 * tier by tier (Platinum first), each tier's badge followed by its sponsors.
 * Tap one to see it large. It pauses on hover, while keyboard focus is in it,
 * and with its pause button; with reduced motion it stands still and scrolls
 * sideways by hand.
 *
 * Where the thank-you takes more than one line (phones), it shrinks to a
 * one-line version while the page is scrolled, and comes back in full at the
 * top and at the end of the page.
 */
export function SponsorTicker({ tiers, thanks, thanksShort }: { tiers: TierGroup[]; thanks: string; thanksShort: string }) {
  const pathname = usePathname();
  const all: ShownSponsor[] = tiers.flatMap(({ tier, sponsors }) => sponsors.map((s) => ({ ...s, tier })));
  const hidden = all.length === 0 || NO_TICKER.some((path) => pathname === path || pathname.startsWith(`${path}/`));

  const [open, setOpen] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [seconds, setSeconds] = useState(40);
  const [scrolled, setScrolled] = useState(false);
  /** Natural heights of the full and the one-line thank-you. */
  const [heads, setHeads] = useState<{ full: number; slim: number } | null>(null);
  const bar = useRef<HTMLElement>(null);
  const full = useRef<HTMLParagraphElement>(null);
  const slim = useRef<HTMLParagraphElement>(null);
  const row = useRef<HTMLDivElement>(null);
  const run = useRef<HTMLUListElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  // A steady speed however many sponsors there are: time for one pass = its length / speed.
  useEffect(() => {
    const el = run.current;
    if (hidden || !el) return;
    const measure = () => setSeconds(Math.max(15, Math.round(el.offsetWidth / SPEED)));
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(el);
    return () => watch.disconnect();
  }, [hidden]);

  // Measure both versions of the thank-you, and publish the bar's full height as
  // --ticker-h, which pages use to leave room for it. It's the height with the
  // full thank-you even while it's shrunk, so the page never changes length as
  // the bar shrinks and grows.
  useEffect(() => {
    const els = [bar.current, full.current, slim.current, row.current];
    if (hidden || els.some((el) => !el)) return;
    const [barEl, fullEl, slimEl, rowEl] = els as HTMLElement[];
    const root = document.documentElement;
    const measure = () => {
      const f = fullEl.offsetHeight;
      const s = slimEl.offsetHeight;
      setHeads((prev) => (prev && prev.full === f && prev.slim === s ? prev : { full: f, slim: s }));
      const safeArea = parseFloat(getComputedStyle(barEl).paddingBottom) || 0;
      root.style.setProperty('--ticker-h', `${f + rowEl.offsetHeight + safeArea}px`);
    };
    measure();
    const watch = new ResizeObserver(measure);
    for (const el of [fullEl, slimEl, rowEl]) watch.observe(el);
    return () => {
      watch.disconnect();
      root.style.removeProperty('--ticker-h');
    };
  }, [hidden]);

  // Scrolled = away from both the top and the end of the page.
  useEffect(() => {
    if (hidden) return;
    let frame = 0;
    const check = () => {
      frame = 0;
      const y = window.scrollY;
      const end = document.documentElement.scrollHeight - window.innerHeight;
      setScrolled(y > 32 && y < end - 32);
    };
    const onChange = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };
    check();
    window.addEventListener('scroll', onChange, { passive: true });
    window.addEventListener('resize', onChange);
    return () => {
      window.removeEventListener('scroll', onChange);
      window.removeEventListener('resize', onChange);
      cancelAnimationFrame(frame);
    };
  }, [hidden]);

  if (hidden) return null;

  const shrunk = scrolled && heads !== null && heads.full > heads.slim + 4;
  const openSponsor = (index: number, el: HTMLElement) => {
    opener.current = el;
    setOpen(index);
  };
  const close = () => {
    setOpen(null);
    opener.current?.focus();
  };
  const heading = 'px-4 pt-2 text-center text-[13px] leading-[1.5] font-bold sm:px-6 sm:pt-3 sm:text-[15px] lg:text-base xl:text-[17px]';

  return (
    <>
      <aside ref={bar} aria-labelledby="sponsor-thanks" className="sponsor-ticker fixed inset-x-0 bottom-0 z-30">
        <div
          className="relative overflow-hidden transition-[height] duration-300 ease-out"
          style={heads ? { height: shrunk ? heads.slim : heads.full } : undefined}
        >
          <p ref={full} id="sponsor-thanks" lang="ta" className={`${heading} text-balance transition-opacity duration-300 ${shrunk ? 'opacity-0' : ''}`}>
            <Diya className="mr-1 inline-block h-[1.6em] w-[1.6em] align-[-0.45em]" />
            <span className="thanks-text">{thanks}</span>
          </p>
          <p
            ref={slim}
            aria-hidden="true"
            lang="ta"
            className={`${heading} absolute inset-x-0 top-0 truncate transition-opacity duration-300 ${shrunk ? '' : 'opacity-0'}`}
          >
            <Diya className="mr-1 inline-block h-[1.6em] w-[1.6em] align-[-0.45em]" />
            <span className="thanks-text">{thanksShort}</span>
          </p>
        </div>

        <div ref={row} className="flex h-16 items-center sm:h-[84px]">
          <div className="ticker-viewport h-full min-w-0 flex-1 overflow-hidden">
            <div
              className="ticker-track flex h-full w-max"
              data-paused={paused || open !== null ? '' : undefined}
              style={{ animationDuration: `${seconds}s` }}
            >
              <TickerRun runRef={run} tiers={tiers} onOpen={openSponsor} />
              {/* A second copy follows on, so the loop is seamless. */}
              <TickerRun tiers={tiers} onOpen={openSponsor} copy />
            </div>
          </div>

          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? 'Play the sponsors' : 'Pause the sponsors'}
            className="ticker-toggle mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-muted shadow-sm transition hover:text-ink focus-visible:outline-2 focus-visible:outline-brand sm:mr-4"
          >
            {paused ? <PlayIcon className="h-4 w-4" /> : <PauseIcon className="h-4 w-4" />}
          </button>
        </div>
      </aside>
      {open !== null && <SponsorLightbox items={all} index={open} onIndex={setOpen} onClose={close} />}
    </>
  );
}

/**
 * One pass of the sponsors, tier by tier: the tier's badge, its sponsors' tiles,
 * then a thin divider before the next tier.
 */
function TickerRun({
  tiers,
  onOpen,
  copy = false,
  runRef,
}: {
  tiers: TierGroup[];
  onOpen: (index: number, el: HTMLElement) => void;
  copy?: boolean;
  runRef?: React.Ref<HTMLUListElement>;
}) {
  let index = 0; // position in the flat list the enlarged view steps through
  return (
    // The copy is only for the eye: screen readers and the Tab key get the first one.
    // Every tier ends with a divider and the run ends with the same gap as between
    // tiers, so the join between the two copies looks like any other tier change.
    <ul ref={runRef} aria-hidden={copy || undefined} className={`flex h-full shrink-0 items-center gap-5 pr-5 sm:gap-8 sm:pr-8 ${copy ? 'ticker-copy' : ''}`}>
      {tiers.map(({ tier, sponsors }) => (
        <li key={tier.key} className="flex shrink-0 items-center gap-4 sm:gap-6">
          <TierBadge tier={tier} size="bar" />
          <ul aria-label={tier.label} className="flex items-center gap-4 sm:gap-7">
            {sponsors.map((sponsor) => {
              const i = index++;
              return (
                <li key={sponsor.file} className="shrink-0">
                  <button
                    type="button"
                    tabIndex={copy ? -1 : undefined}
                    onClick={(e) => onOpen(i, e.currentTarget)}
                    aria-label={`${sponsor.name}: view larger`}
                    title={sponsor.name}
                    className={`relative block cursor-zoom-in overflow-hidden rounded-lg bg-white transition duration-300 hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand ${TILE[tier.key] ?? TILE.community}`}
                    style={{ boxShadow: `0 0 0 1.5px ${tier.glow}99, 0 6px 14px -8px ${tier.glow}` }}
                  >
                    <Image
                      src={sponsor.src}
                      alt=""
                      fill
                      sizes="(min-width: 640px) 122px, 96px"
                      loading="eager"
                      unoptimized={sponsor.src.toLowerCase().endsWith('.svg')}
                      className="object-contain p-1"
                    />
                  </button>
                </li>
              );
            })}
          </ul>
          <span aria-hidden="true" className="h-10 w-px shrink-0 bg-line sm:h-12" />
        </li>
      ))}
    </ul>
  );
}
