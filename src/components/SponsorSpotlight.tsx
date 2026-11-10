'use client';

import Image from 'next/image';
import { useRef, useState } from 'react';
import type { SponsorTier } from '@/config/sponsors';
import type { Sponsor } from '@/lib/sponsors';
import { Bi } from './Bi';
import { ZoomInIcon } from './icons';
import { type ShownSponsor, SponsorLightbox } from './SponsorLightbox';
import { TierBadge } from './TierBadge';

interface TierGroup {
  tier: SponsorTier;
  sponsors: Sponsor[];
}

/**
 * The home page's thanks to the top sponsors: Platinum large, Gold three to a
 * row, each on a white tile with its name. Tap one to see it large.
 */
export function SponsorSpotlight({ tiers }: { tiers: TierGroup[] }) {
  const all: ShownSponsor[] = tiers.flatMap(({ tier, sponsors }) => sponsors.map((s) => ({ ...s, tier })));
  const [open, setOpen] = useState<number | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  if (all.length === 0) return null;

  const close = () => {
    setOpen(null);
    opener.current?.focus();
  };

  let index = 0;
  return (
    <section aria-labelledby="spotlight-title" className="relative mt-10">
      <h2 id="spotlight-title" className="eyebrow text-center">
        <Bi en="Our sponsors" ta="ourSponsors" />
      </h2>

      <div className="mt-4 space-y-6">
        {tiers.map(({ tier, sponsors }) => {
          const large = tier.key === 'platinum';
          return (
            <div key={tier.key}>
              <div className="flex justify-center">
                <TierBadge tier={tier} />
              </div>
              <ul className={`mt-3 grid gap-3 ${large ? 'grid-cols-1' : 'grid-cols-3'}`}>
                {sponsors.map((sponsor) => {
                  const i = index++;
                  return (
                    <li key={sponsor.file} className="min-w-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          opener.current = e.currentTarget;
                          setOpen(i);
                        }}
                        aria-label={`${sponsor.name}: view larger`}
                        className="group block w-full cursor-zoom-in text-center"
                      >
                        <span
                          className={`relative block overflow-hidden bg-white transition duration-300 group-hover:-translate-y-0.5 ${large ? 'aspect-[4/3] rounded-3xl' : 'aspect-square rounded-2xl'}`}
                          style={{ boxShadow: `0 0 0 ${large ? 2.5 : 1.5}px ${tier.glow}99, 0 12px 28px -16px ${tier.glow}` }}
                        >
                          <Image
                            src={sponsor.src}
                            alt=""
                            fill
                            sizes={large ? '(min-width: 512px) 480px, 100vw' : '(min-width: 512px) 160px, 33vw'}
                            unoptimized={sponsor.src.toLowerCase().endsWith('.svg')}
                            className={`object-contain ${large ? 'p-3' : 'p-1.5'}`}
                          />
                          <span className="absolute right-2 bottom-2 flex h-7 w-7 items-center justify-center rounded-full bg-ink/60 text-white opacity-80 transition group-hover:opacity-100">
                            <ZoomInIcon className="h-4 w-4" />
                          </span>
                        </span>
                        <span className={`mt-2 block leading-snug font-semibold ${large ? 'text-lg' : 'line-clamp-2 text-sm'}`}>{sponsor.name}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      {open !== null && <SponsorLightbox items={all} index={open} onIndex={setOpen} onClose={close} />}
    </section>
  );
}
