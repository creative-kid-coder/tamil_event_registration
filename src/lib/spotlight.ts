/**
 * The order sponsors take turns in on the projector screen.
 */

/** Turns per cycle for each tier; any other tier gets one. */
export const SCREEN_TURNS: Record<string, number> = { platinum: 3, gold: 2 };

/**
 * One full cycle: every sponsor at least once, a Platinum sponsor three times
 * and a Gold sponsor twice. Each sponsor's turns are spaced evenly through the
 * cycle, and each sponsor starts at its own point (in tier order, Platinum
 * first), so the turns interleave instead of bunching up or repeating back to
 * back, including where the cycle starts again.
 */
export function spotlightOrder<T>(tiers: { tier: { key: string }; sponsors: T[] }[]): T[] {
  const sponsors = tiers.flatMap(({ tier, sponsors }) => sponsors.map((sponsor) => ({ sponsor, turns: SCREEN_TURNS[tier.key] ?? 1 })));
  const cycle = sponsors.reduce((sum, s) => sum + s.turns, 0);
  const slots = sponsors.flatMap(({ sponsor, turns }, rank) => {
    const start = (rank + 0.5) / sponsors.length;
    return Array.from({ length: turns }, (_, turn) => ({ sponsor, rank, at: ((turn + start) * cycle) / turns }));
  });
  slots.sort((a, b) => a.at - b.at || a.rank - b.rank);
  return slots.map((slot) => slot.sponsor);
}
