import type { SponsorTier } from '@/config/sponsors';
import { AwardIcon, GemIcon, HeartIcon, MedalIcon, StarIcon } from './icons';

/** Each tier's icon; any other folder gets the award ribbon. */
export const TIER_ICON: Record<string, (p: { className?: string }) => React.ReactNode> = {
  platinum: GemIcon,
  gold: StarIcon,
  silver: MedalIcon,
  associate: AwardIcon,
  community: HeartIcon,
};

const SIZES = {
  // Compact on phones (the bottom bar), a little larger from tablet width up.
  bar: {
    pill: 'gap-1 py-0.5 pr-2.5 pl-0.5 text-[10px] tracking-[0.06em] sm:gap-2 sm:py-1 sm:pr-4 sm:pl-1 sm:text-[13px] sm:tracking-[0.08em]',
    disc: 'h-5 w-5 sm:h-7 sm:w-7',
    icon: 'h-3 w-3 sm:h-4 sm:w-4',
  },
  md: { pill: 'gap-1.5 py-1 pr-3.5 pl-1 text-xs tracking-[0.08em]', disc: 'h-7 w-7', icon: 'h-4 w-4' },
  // The projector screen: sized with the screen.
  screen: { pill: 'gap-[0.6vw] py-[0.4vw] pr-[1.4vw] pl-[0.4vw] text-[1.1vw] tracking-[0.1em]', disc: 'h-[2.6vw] w-[2.6vw]', icon: 'h-[1.4vw] w-[1.4vw]' },
};

/** "Platinum", "Gold" …: a small ribbon in the tier's metal, glowing in its colour. */
export function TierBadge({ tier, size = 'md' }: { tier: SponsorTier; size?: keyof typeof SIZES }) {
  const Icon = TIER_ICON[tier.key] ?? AwardIcon;
  const s = SIZES[size];
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full font-bold whitespace-nowrap uppercase ring-1 ring-black/10 ${s.pill}`}
      style={{
        // A wash of white keeps the darker metal stops readable under the text.
        background: `linear-gradient(rgb(255 255 255 / 0.3), rgb(255 255 255 / 0.3)), ${tier.metal}`,
        color: tier.ink,
        boxShadow: `0 2px 12px -4px ${tier.glow}`,
      }}
    >
      <span className={`flex shrink-0 items-center justify-center rounded-full bg-white/85 ${s.disc}`}>
        <Icon className={s.icon} />
      </span>
      {tier.label.replace(/\s*sponsors?$/i, '')}
    </span>
  );
}
