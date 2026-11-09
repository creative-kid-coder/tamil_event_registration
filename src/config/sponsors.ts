/**
 * The thank-you that leads the sponsor ticker along the bottom of every page.
 * The event name comes from EVENT_NAME, without its emoji.
 */
export const sponsorThanks = (eventName: string) =>
  `${eventName} இனிதே நடைபெற ஆதரவளித்த அனைத்து ஸ்பான்சர்களுக்கும் எங்களது நன்றிகள்!`;

/**
 * Sponsor tiers, in the order shown. Each has a folder of logos or flyers under
 * public/sponsors/<folder>/ — drop an image in and it appears in the ticker.
 * A folder that isn't listed here still shows, after these, in a neutral style.
 */
export interface SponsorTier {
  key: string;
  label: string;
  folder: string;
  /** Metallic gradient for the card frames and the tier medal. */
  metal: string;
  /** Icon and heading text colour, on the metal. */
  ink: string;
  /** Glow around the tier heading ribbon. */
  glow: string;
}

export const SPONSOR_TIERS: SponsorTier[] = [
  {
    key: 'platinum',
    label: 'Platinum sponsors',
    folder: 'platinum',
    metal: 'linear-gradient(135deg, #eef2ff 0%, #ffffff 22%, #c7d2fe 45%, #f8fafc 62%, #a5b4fc 100%)',
    ink: '#3730a3',
    glow: '#818cf8',
  },
  {
    key: 'gold',
    label: 'Gold sponsors',
    folder: 'gold',
    metal: 'linear-gradient(135deg, #fef3c7 0%, #fbbf24 30%, #fde68a 52%, #d97706 78%, #fcd34d 100%)',
    ink: '#92400e',
    glow: '#f59e0b',
  },
  {
    key: 'silver',
    label: 'Silver sponsors',
    folder: 'silver',
    metal: 'linear-gradient(135deg, #f8fafc 0%, #cbd5e1 35%, #f1f5f9 55%, #94a3b8 100%)',
    ink: '#334155',
    glow: '#94a3b8',
  },
  {
    key: 'associate',
    label: 'Associate sponsors',
    folder: 'associate',
    metal: 'linear-gradient(135deg, #fde7d7 0%, #e0915e 35%, #f6c9a8 55%, #a65a2e 100%)',
    ink: '#7c2d12',
    glow: '#e0915e',
  },
  {
    key: 'community',
    label: 'Community sponsors',
    folder: 'community',
    metal: 'linear-gradient(135deg, #fce7f3 0%, #f9a8d4 38%, #fbcfe8 58%, #c084fc 100%)',
    ink: '#9d174d',
    glow: '#ec4899',
  },
];

/** Style for a folder not listed above, e.g. public/sponsors/media-partners/. */
export const OTHER_TIER_STYLE = {
  metal: 'linear-gradient(135deg, #eef2ff 0%, #c7d2fe 40%, #e0e7ff 60%, #818cf8 100%)',
  ink: '#3730a3',
  glow: '#818cf8',
};
