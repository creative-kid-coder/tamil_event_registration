import { BADGES, type BadgeDef } from '@/config/badges';
import type { BadgeCounts } from '@/lib/registrations';

/** Food-label style marks: a dot for veg, a triangle for non-veg. */
function MealMark({ meal }: { meal: BadgeDef['meal'] }) {
  if (meal === 'none') return null;
  return (
    <span
      className="inline-flex h-5 w-5 items-center justify-center rounded-[5px] border-2 border-current/80 bg-white/15"
      title={meal === 'veg' ? 'Vegetarian' : 'Non-vegetarian'}
    >
      {meal === 'veg' ? (
        <span className="h-2 w-2 rounded-full bg-current" />
      ) : (
        <svg viewBox="0 0 10 10" className="h-2.5 w-2.5" aria-hidden="true">
          <path d="M5 1 9.5 9h-9z" fill="currentColor" />
        </svg>
      )}
    </span>
  );
}

export function BadgeGrid({ counts, compact = false }: { counts: BadgeCounts; compact?: boolean }) {
  const items = BADGES.filter((b) => counts[b.key] > 0);
  if (!items.length) return <p className="text-muted">No badges</p>;

  return (
    <div className={`grid grid-cols-1 ${compact ? 'gap-2' : 'gap-3 sm:grid-cols-2'}`}>
      {items.map((b) => (
        <div
          key={b.key}
          className={`relative flex items-center gap-4 overflow-hidden rounded-2xl px-4 shadow-sm ring-1 ring-black/5 ${compact ? 'py-2.5' : 'py-3.5'}`}
          style={{
            background: `linear-gradient(135deg, rgb(255 255 255 / 0.16), transparent 60%), ${b.color}`,
            color: b.textColor,
          }}
        >
          <span className={`font-semibold tracking-tight tabular-nums ${compact ? 'text-3xl' : 'text-5xl'}`}>
            {counts[b.key]}
          </span>
          <span className={`flex-1 font-medium leading-snug ${compact ? 'text-sm' : 'text-base'}`}>
            {/* Non-breaking hyphen keeps age ranges like "(11-16)" on one line */}
            {b.label.replace(/(\d)-(\d)/g, '$1‑$2')}
          </span>
          <MealMark meal={b.meal} />
        </div>
      ))}
    </div>
  );
}
