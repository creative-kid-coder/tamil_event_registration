/**
 * Badge categories, in the order they are shown at the desk.
 *
 * EDIT `color` (and `textColor` if needed) so each tile matches the physical
 * badge colour you hand out. `short` is written to the "Badges Given" column,
 * so don't change it once check-in has started.
 */

export type BadgeKey =
  | 'adultVeg'
  | 'adultNonVeg'
  | 'yaVeg'
  | 'yaNonVeg'
  | 'juniorVeg'
  | 'juniorNonVeg'
  | 'kids';

export interface BadgeDef {
  key: BadgeKey;
  label: string;
  short: string;
  color: string;
  textColor: string;
  meal: 'veg' | 'nonveg' | 'none';
}

export const BADGES: BadgeDef[] = [
  { key: 'adultVeg', label: 'Adult Veg', short: 'AdultVeg', color: '#15803d', textColor: '#ffffff', meal: 'veg' },
  { key: 'adultNonVeg', label: 'Adult Non-Veg', short: 'AdultNV', color: '#b91c1c', textColor: '#ffffff', meal: 'nonveg' },
  { key: 'yaVeg', label: 'Young Adult Veg (11-16)', short: 'YAVeg', color: '#0f766e', textColor: '#ffffff', meal: 'veg' },
  { key: 'yaNonVeg', label: 'Young Adult Non-Veg (11-16)', short: 'YANV', color: '#c2410c', textColor: '#ffffff', meal: 'nonveg' },
  { key: 'juniorVeg', label: 'Junior Veg (6-10)', short: 'JunVeg', color: '#1d4ed8', textColor: '#ffffff', meal: 'veg' },
  { key: 'juniorNonVeg', label: 'Junior Non-Veg (6-10)', short: 'JunNV', color: '#7e22ce', textColor: '#ffffff', meal: 'nonveg' },
  { key: 'kids', label: 'Kids (up to 5)', short: 'Kids', color: '#db2777', textColor: '#ffffff', meal: 'none' },
];

export const BADGE_KEYS = BADGES.map((b) => b.key);
