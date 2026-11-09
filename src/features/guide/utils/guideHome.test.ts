import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { APP_PAGES } from '../build/links';
import { OFFICIAL_SITE, officialDocsUrl } from '../engine/linkSchemes';
import type { GuideBundle } from '../engine/schema';
import { makeNote } from '../engine/testNote.mock';
import { OFFICIAL_REFERENCES, START_CARDS, officialReferenceHref, startCardHref, visibleStartCards, type StartCard } from './guideHome';

const ROOT = resolve(__dirname, '../../../..');
const GUIDE_FILE = resolve(ROOT, 'public/guide/guide.json');
const ESR_DOCS = resolve(ROOT, process.env.ESR_SOURCE_DIR ?? '../Eastern_Sun_Resurrected', 'docs');

describe('START_CARDS', () => {
  it('has unique ids and 3–4 cards', () => {
    expect(new Set(START_CARDS.map((card) => card.id)).size).toBe(START_CARDS.length);
    expect(START_CARDS.length).toBeGreaterThanOrEqual(3);
    expect(START_CARDS.length).toBeLessThanOrEqual(4);
  });

  it('points page cards at app routes', () => {
    for (const card of START_CARDS) {
      if (card.target.kind === 'page') expect(APP_PAGES).toContain(card.target.path);
    }
  });

  it.skipIf(!existsSync(GUIDE_FILE))('points note cards at notes of the committed bundle', () => {
    const bundle = JSON.parse(readFileSync(GUIDE_FILE, 'utf-8')) as GuideBundle;
    const slugs = new Set(bundle.notes.map((note) => note.slug));
    for (const card of START_CARDS) {
      if (card.target.kind === 'note') expect(slugs, card.id).toContain(card.target.slug);
    }
    expect(visibleStartCards(bundle)).toHaveLength(START_CARDS.length);
  });
});

describe('startCardHref', () => {
  it('maps notes to /guide/<slug> and keeps page paths', () => {
    expect(startCardHref({ kind: 'note', slug: 'cube-basics' })).toBe('/guide/cube-basics');
    expect(startCardHref({ kind: 'page', path: '/best-base' })).toBe('/best-base');
  });
});

describe('visibleStartCards', () => {
  const cards: StartCard[] = [
    { id: 'found-item', question: 'a', description: '', target: { kind: 'note', slug: 'present' } },
    { id: 'cube', question: 'b', description: '', target: { kind: 'note', slug: 'missing' } },
    { id: 'best-base', question: 'c', description: '', target: { kind: 'page', path: '/best-base' } },
  ];

  it('drops cards whose note is not in the bundle and keeps page cards', () => {
    const visible = visibleStartCards({ notes: [makeNote({ slug: 'present' })] }, cards);
    expect(visible.map((card) => card.id)).toEqual(['found-item', 'best-base']);
  });
});

describe('OFFICIAL_REFERENCES', () => {
  it('lists each docs file once', () => {
    expect(new Set(OFFICIAL_REFERENCES.map((reference) => reference.file)).size).toBe(OFFICIAL_REFERENCES.length);
  });

  it('builds hrefs like docs: links (official site, encoded file name)', () => {
    for (const reference of OFFICIAL_REFERENCES) {
      const href = officialReferenceHref(reference);
      expect(href.startsWith(OFFICIAL_SITE)).toBe(true);
      expect(href).toBe(officialDocsUrl(reference.file));
      expect(href).not.toContain(' ');
    }
    expect(officialDocsUrl('Eastern Sun Resurrected Cube Recipes.html', 'for')).toBe(
      'https://easternsunresurrected.com/Eastern%20Sun%20Resurrected%20Cube%20Recipes.html#for'
    );
  });

  it.skipIf(!existsSync(ESR_DOCS))("names files that exist in the ESR clone's docs/", () => {
    for (const reference of OFFICIAL_REFERENCES) expect(existsSync(resolve(ESR_DOCS, reference.file)), reference.file).toBe(true);
  });
});
