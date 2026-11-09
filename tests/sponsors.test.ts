import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { loadSponsors, nameFromFile } from '@/lib/sponsors';

const dir = mkdtempSync(path.join(tmpdir(), 'sponsors-test-'));
const root = path.join(dir, 'sponsors');
const detailsFile = path.join(dir, 'sponsors.json');

function files(folder: string, names: string[]) {
  mkdirSync(path.join(root, folder), { recursive: true });
  for (const name of names) writeFileSync(path.join(root, folder, name), 'x');
}

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('sponsor names from file names', () => {
  it.each([
    ['acme-foods.png', 'Acme Foods'],
    ['02-raja_textiles-ltd.jpg', 'Raja Textiles Ltd'],
    ['10 Spice World.webp', 'Spice World'],
    ['ABC Bank.svg', 'ABC Bank'],
    ['SuriyaCarFix.jpeg', 'Suriya Car Fix'],
    ['LifelineProtect.jpeg', 'Lifeline Protect'],
  ])('%s → %s', (file, name) => {
    expect(nameFromFile(file)).toBe(name);
  });
});

describe('loadSponsors', () => {
  files('platinum', ['10-zeta.png', '2-beta.png', '1-alpha.svg', 'notes.txt', '.DS_Store']);
  files('gold', ['acme.png', 'my logo.jpg']);
  files('media-partners', ['radio.png']);
  // silver, associate and community folders missing on purpose

  it('lists the logos in each tier folder in number order, skipping other files', () => {
    const tiers = loadSponsors({ root, detailsFile });
    expect(tiers.map((t) => t.tier.key)).toEqual(['platinum', 'gold', 'silver', 'associate', 'community', 'media-partners']);
    expect(tiers[0].sponsors.map((s) => s.file)).toEqual(['1-alpha.svg', '2-beta.png', '10-zeta.png']);
    expect(tiers[2].sponsors).toEqual([]);
    expect(tiers[1].sponsors[1].src).toBe('/sponsors/gold/my%20logo.jpg');
  });

  it('still shows a folder that is not a known tier, after the known ones', () => {
    const extra = loadSponsors({ root, detailsFile }).at(-1)!;
    expect(extra.tier).toMatchObject({ key: 'media-partners', label: 'Media Partners sponsors' });
    expect(extra.sponsors.map((s) => s.name)).toEqual(['Radio']);
  });

  it('uses the optional details file for names, taglines and safe website links', () => {
    writeFileSync(
      detailsFile,
      JSON.stringify({
        _how_to: 'ignored',
        'gold/acme.png': { name: 'Acme Foods UK', tagline: '  Fresh every day ', url: 'https://acme.example' },
        'platinum/1-alpha.svg': { url: 'javascript:alert(1)' },
      }),
    );
    const [platinum, gold] = loadSponsors({ root, detailsFile });
    expect(gold.sponsors[0]).toMatchObject({ name: 'Acme Foods UK', tagline: 'Fresh every day', url: 'https://acme.example' });
    expect(platinum.sponsors[0]).toMatchObject({ name: 'Alpha', tagline: null, url: null });
  });

  it('ignores a broken details file instead of breaking the page', () => {
    writeFileSync(detailsFile, '{ "gold/acme.png": { "name": ');
    const [, gold] = loadSponsors({ root, detailsFile });
    expect(gold.sponsors[0].name).toBe('Acme');
  });
});
