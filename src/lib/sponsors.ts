/**
 * Sponsors for the ticker along the bottom of every page: every image in public/sponsors/<tier>/, in
 * file-name order (prefix with 01-, 02- … to choose the order). The display
 * name comes from the file name ("acme-foods.png" → "Acme Foods") unless
 * data/sponsors.json gives one, along with an optional tagline and website.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { OTHER_TIER_STYLE, SPONSOR_TIERS, type SponsorTier } from '@/config/sponsors';

export interface Sponsor {
  file: string;
  /** Public URL of the logo. */
  src: string;
  name: string;
  tagline: string | null;
  url: string | null;
}

const IMAGE = /\.(png|jpe?g|svg|webp|gif|avif)$/i;

/** "02-acme_foods-ltd.png" → "Acme Foods Ltd"; "SuriyaCarFix.jpeg" → "Suriya Car Fix" */
export function nameFromFile(file: string): string {
  return file
    .replace(/\.[^.]+$/, '')
    .replace(/^\d+[-_. ]*/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ');
}

const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);
/** Only real web links (never javascript: and the like). */
const webLink = (value: unknown) => {
  const url = text(value);
  return url && /^https?:\/\//i.test(url) ? url : null;
};

type Details = Record<string, { name?: unknown; tagline?: unknown; url?: unknown }>;

function readDetails(file: string): Details {
  if (!existsSync(file)) return {};
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as Details;
  } catch (error) {
    // A typo in the details file shouldn't take the page down; names fall back to the file names.
    console.error(`${file} is not valid JSON, so it was ignored:`, error);
    return {};
  }
}

export function loadSponsors({
  root = path.join(process.cwd(), 'public', 'sponsors'),
  detailsFile = path.join(process.cwd(), 'data', 'sponsors.json'),
} = {}): { tier: SponsorTier; sponsors: Sponsor[] }[] {
  const details = readDetails(detailsFile);
  // Folders that aren't a known tier still show (after the known ones), so a new folder is never silently ignored.
  const known = new Set(SPONSOR_TIERS.map((t) => t.folder));
  const others: SponsorTier[] = existsSync(root)
    ? readdirSync(root, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && !known.has(entry.name))
        .map((entry) => entry.name)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
        .map((folder) => ({ key: folder, folder, label: `${nameFromFile(folder)} sponsors`, ...OTHER_TIER_STYLE }))
    : [];

  return [...SPONSOR_TIERS, ...others].map((tier) => {
    const dir = path.join(root, tier.folder);
    const files = existsSync(dir)
      ? readdirSync(dir)
          .filter((file) => IMAGE.test(file))
          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
      : [];
    return {
      tier,
      sponsors: files.map((file) => {
        const d = details[`${tier.folder}/${file}`] ?? {};
        return {
          file,
          src: `/sponsors/${tier.folder}/${encodeURIComponent(file)}`,
          name: text(d.name) ?? nameFromFile(file),
          tagline: text(d.tagline),
          url: webLink(d.url),
        };
      }),
    };
  });
}
