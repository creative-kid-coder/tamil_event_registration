'use client';

import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Fragment, useEffect, useRef, useState } from 'react';
import type { SponsorTier } from '@/config/sponsors';
import type { Sponsor } from '@/lib/sponsors';
import { Diya } from './EventName';
import { AwardIcon, PauseIcon, PlayIcon } from './icons';
import { type ShownSponsor, SponsorLightbox, TIER_ICON } from './SponsorLightbox';

interface TierGroup {
  tier: SponsorTier;
  sponsors: Sponsor[];
}

/** Scroll speed in px a second: slow enough to read the names as they pass. */
const SPEED = 45;

/**
 * A rolling ticker of the sponsors, fixed along the bottom of every page: the
 * Tamil thank-you, then each tier's badge followed by its sponsors. Tap a
 * sponsor to see their image large. It pauses on hover, while keyboard focus
 * is in it, and with its pause button. With reduced motion it stands still
 * and scrolls sideways by hand instead.
 */
export function SponsorTicker({ tiers, thanks }: { tiers: TierGroup[]; thanks: string }) {
  const pathname = usePathname();
  const all: ShownSponsor[] = tiers.flatMap(({ tier, sponsors }) => sponsors.map((s) => ({ ...s, tier })));
  const [open, setOpen] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [seconds, setSeconds] = useState(60);
  const run = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  // A steady speed however many sponsors there are: time for one pass = its length / speed.
  useEffect(() => {
    const el = run.current;
    if (!el) return;
    const measure = () => setSeconds(Math.max(15, Math.round(el.offsetWidth / SPEED)));
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(el);
    return () => watch.disconnect();
  }, []);

  // Not over the demo video.
  if (all.length === 0 || pathname.startsWith('/demo')) return null;

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
      <aside aria-label="Our sponsors" className="sponsor-ticker fixed inset-x-0 bottom-0 z-30 text-white">
        <div aria-hidden="true" className="ticker-edge absolute inset-x-0 top-0 h-[2px]" />
        <div className="flex h-15 items-center">
          <div className="ticker-viewport h-full min-w-0 flex-1 overflow-hidden">
            <div
              className="ticker-track flex h-full w-max"
              data-paused={paused || open !== null ? '' : undefined}
              style={{ animationDuration: `${seconds}s` }}
            >
              <TickerRun runRef={run} tiers={tiers} thanks={thanks} onOpen={openSponsor} />
              {/* A second copy follows on, so the loop is seamless. */}
              <TickerRun tiers={tiers} thanks={thanks} onOpen={openSponsor} copy />
            </div>
          </div>
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? 'Play the sponsor ticker' : 'Pause the sponsor ticker'}
            className="ticker-toggle mr-1.5 ml-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/85 ring-1 ring-white/15 transition hover:bg-white/20 hover:text-white focus-visible:outline-2 focus-visible:outline-amber-300"
          >
            {paused ? <PlayIcon className="h-4 w-4" /> : <PauseIcon className="h-4 w-4" />}
          </button>
        </div>
      </aside>
      {open !== null && <SponsorLightbox items={all} index={open} onIndex={setOpen} onClose={close} />}
    </>
  );
}

function TickerRun({
  tiers,
  thanks,
  onOpen,
  copy = false,
  runRef,
}: {
  tiers: TierGroup[];
  thanks: string;
  onOpen: (index: number, el: HTMLElement) => void;
  copy?: boolean;
  runRef?: React.Ref<HTMLDivElement>;
}) {
  let index = 0;
  return (
    // The copy is only for the eye: screen readers and the Tab key get the first one.
    <div ref={runRef} aria-hidden={copy || undefined} className={`flex h-full shrink-0 items-center gap-5 pr-8 ${copy ? 'ticker-copy' : ''}`}>
      <span className="flex shrink-0 items-center gap-2 pl-3">
        <Diya className="h-9 w-9 shrink-0" />
        <span lang="ta" className="thanks-text text-[15px] leading-relaxed font-bold whitespace-nowrap">
          {thanks}
        </span>
      </span>
      {tiers.map(({ tier, sponsors }) => (
        <Fragment key={tier.key}>
          <TierBadge tier={tier} />
          {sponsors.map((sponsor) => {
            const i = index++;
            return (
              <button
                key={sponsor.file}
                type="button"
                tabIndex={copy ? -1 : undefined}
                onClick={(e) => onOpen(i, e.currentTarget)}
                aria-label={`${sponsor.name}: view larger`}
                className="flex shrink-0 cursor-zoom-in items-center gap-2.5 rounded-xl py-1 pr-2.5 pl-1 transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-amber-300"
              >
                <span
                  className="relative h-[46px] w-[37px] shrink-0 overflow-hidden rounded-md bg-white"
                  style={{ boxShadow: `0 0 0 2px ${tier.glow}, 0 0 12px -2px ${tier.glow}` }}
                >
                  <Image
                    src={sponsor.src}
                    alt=""
                    fill
                    sizes="40px"
                    loading="eager"
                    unoptimized={sponsor.src.toLowerCase().endsWith('.svg')}
                    className="object-contain p-0.5"
                  />
                </span>
                <span className="text-sm font-semibold whitespace-nowrap">{sponsor.name}</span>
              </button>
            );
          })}
        </Fragment>
      ))}
    </div>
  );
}

/** "Platinum", "Gold" …, on a little ribbon in the tier's metal, glowing in its colour. */
function TierBadge({ tier }: { tier: SponsorTier }) {
  const Icon = TIER_ICON[tier.key] ?? AwardIcon;
  return (
    <span
      className="ml-2 flex shrink-0 items-center gap-1.5 rounded-full py-1 pr-3 pl-1 text-[11px] font-bold tracking-[0.08em] whitespace-nowrap uppercase ring-1 ring-black/10"
      style={{
        // A wash of white keeps the darker metal stops readable under the text.
        background: `linear-gradient(rgb(255 255 255 / 0.3), rgb(255 255 255 / 0.3)), ${tier.metal}`,
        color: tier.ink,
        boxShadow: `0 0 16px -3px ${tier.glow}`,
      }}
    >
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/85">
        <Icon className="h-3.5 w-3.5" />
      </span>
      {tier.label.replace(/\s*sponsors?$/i, '')}
    </span>
  );
}
