import { describe, expect, it } from 'vitest';
import { spotlightOrder } from '@/lib/spotlight';

const tiers = (counts: Record<string, number>) =>
  Object.entries(counts).map(([key, n]) => ({ tier: { key }, sponsors: Array.from({ length: n }, (_, i) => `${key}-${i + 1}`) }));

const count = (order: string[]) => order.reduce<Record<string, number>>((acc, s) => ({ ...acc, [s]: (acc[s] ?? 0) + 1 }), {});

describe('projector sponsor rotation', () => {
  // The real line-up: 1 Platinum, 3 Gold, 4 Silver, 3 Associate, 1 Community
  const order = spotlightOrder(tiers({ platinum: 1, gold: 3, silver: 4, associate: 3, community: 1 }));

  it('shows Platinum three times, Gold twice and everyone else once per cycle', () => {
    expect(order).toHaveLength(3 + 3 * 2 + 4 + 3 + 1);
    expect(count(order)).toEqual({
      'platinum-1': 3,
      'gold-1': 2,
      'gold-2': 2,
      'gold-3': 2,
      'silver-1': 1,
      'silver-2': 1,
      'silver-3': 1,
      'silver-4': 1,
      'associate-1': 1,
      'associate-2': 1,
      'associate-3': 1,
      'community-1': 1,
    });
  });

  it('starts with Platinum and never shows the same sponsor twice in a row, even across the loop', () => {
    expect(order[0]).toBe('platinum-1');
    for (let i = 0; i < order.length; i++) expect(order[i]).not.toBe(order[(i + 1) % order.length]);
  });

  it('copes with folders that are not a known tier, and with no sponsors', () => {
    expect(spotlightOrder(tiers({ 'media-partners': 2 }))).toEqual(['media-partners-1', 'media-partners-2']);
    expect(spotlightOrder([])).toEqual([]);
  });
});
