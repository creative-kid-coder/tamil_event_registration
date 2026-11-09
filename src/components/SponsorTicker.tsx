'use client';

import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { SponsorTier } from '@/config/sponsors';
import type { Sponsor } from '@/lib/sponsors';
import { Diya } from './EventName';
import { AwardIcon, PauseIcon, PlayIcon } from './icons';
import { type ShownSponsor, SponsorLightbox, TIER_ICON } from './SponsorLightbox';

interface TierGroup {
  tier: SponsorTier;
  sponsors: Sponsor[];
}

/** Scroll speed in px a second: a slow, steady drift. */
const SPEED = 40;

/**
 * The sponsors, fixed along the bottom of every page: the Tamil thank-you as a
 * heading, then one row that drifts slowly past, fading out at both ends —
 * tier by tier (Platinum first), each tier's badge followed by its sponsor
 * images at an even height. Tap one to see it large. It
 * pauses on hover, while keyboard focus is in it, and with its pause button;
 * with reduced motion it stands still and scrolls sideways by hand.
 */
export function SponsorTicker({ tiers, thanks }: { tiers: TierGroup[]; thanks: string }) {
  const pathname = usePathname();
  const all: ShownSponsor[] = tiers.flatMap(({ tier, sponsors }) => sponsors.map((s) => ({ ...s, tier })));
  // Not over the demo video.
  const hidden = all.length === 0 || pathname.startsWith('/demo');
  const [open, setOpen] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [seconds, setSeconds] = useState(40);
  const bar = useRef<HTMLElement>(null);
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

  // The thank-you wraps onto more lines on narrow screens, so the bar's height
  // varies: publish it as --ticker-h, which pages use to leave room for it.
  useEffect(() => {
    const el = bar.current;
    if (hidden || !el) return;
    const root = document.documentElement;
    const publish = () => root.style.setProperty('--ticker-h', `${el.offsetHeight}px`);
    publish();
    const watch = new ResizeObserver(publish);
    watch.observe(el);
    return () => {
      watch.disconnect();
      root.style.removeProperty('--ticker-h');
    };
  }, [hidden]);

  if (hidden) return null;

  const openSponsor = (index: number, el: HTMLElement) => {
    opener.current = el;
    setOpen(index);
  };
  const close = () => {
    setOpen(null);
    opener.current?.focus();
  };

  return (
    <>
      <aside ref={bar} aria-labelledby="sponsor-thanks" className="sponsor-ticker fixed inset-x-0 bottom-0 z-30">
        <p
          id="sponsor-thanks"
          lang="ta"
          className="px-4 pt-2 text-center text-[13px] leading-[1.5] font-bold text-balance sm:px-6 sm:pt-3 sm:text-[15px] lg:text-base xl:text-[17px]"
        >
          <Diya className="mr-1 inline-block h-[1.6em] w-[1.6em] align-[-0.45em]" />
          <span className="thanks-text">{thanks}</span>
        </p>

        <div className="flex h-16 items-center sm:h-[84px]">
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
 * One pass of the sponsors, tier by tier: the tier's badge, its sponsor images
 * (bare, all the same height), then a thin divider before the next tier.
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
    <ul ref={runRef} aria-hidden={copy || undefined} className={`flex h-full shrink-0 items-center gap-6 pr-6 sm:gap-10 sm:pr-10 ${copy ? 'ticker-copy' : ''}`}>
      {tiers.map(({ tier, sponsors }) => (
        <li key={tier.key} className="flex shrink-0 items-center gap-6 sm:gap-10">
          <TierBadge tier={tier} />
          <ul aria-label={tier.label} className="flex items-center gap-8 sm:gap-14">
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
                    className="block cursor-zoom-in rounded-lg transition duration-300 hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
                  >
                    <Image
                      src={sponsor.src}
                      alt=""
                      width={0}
                      height={0}
                      sizes="(min-width: 640px) 160px, 128px"
                      loading="eager"
                      unoptimized={sponsor.src.toLowerCase().endsWith('.svg')}
                      className="h-[50px] w-auto max-w-[110px] rounded-md object-contain sm:h-[64px] sm:max-w-[140px]"
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

/** "Platinum", "Gold" …: a small ribbon in the tier's metal that starts each tier's group. */
function TierBadge({ tier }: { tier: SponsorTier }) {
  const Icon = TIER_ICON[tier.key] ?? AwardIcon;
  return (
    <span
      className="flex shrink-0 items-center gap-1.5 rounded-full py-1 pr-3 pl-1 text-[11px] font-bold tracking-[0.08em] whitespace-nowrap uppercase ring-1 ring-black/10 sm:gap-2 sm:pr-4 sm:text-[13px]"
      style={{
        // A wash of white keeps the darker metal stops readable under the text.
        background: `linear-gradient(rgb(255 255 255 / 0.3), rgb(255 255 255 / 0.3)), ${tier.metal}`,
        color: tier.ink,
        boxShadow: `0 2px 12px -4px ${tier.glow}`,
      }}
    >
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/85 sm:h-7 sm:w-7">
        <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
      </span>
      {tier.label.replace(/\s*sponsors?$/i, '')}
    </span>
  );
}
