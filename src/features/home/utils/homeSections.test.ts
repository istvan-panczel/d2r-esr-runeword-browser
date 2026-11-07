import { describe, expect, it } from 'vitest';
import { getAllNavItems, NAV_ENTRIES } from '@/core/navigation/navConfig';
import { getHomeSections } from './homeSections';

function linkPaths(enabled: boolean): string[] {
  return getHomeSections(enabled).flatMap((section) => section.links.map((link) => link.to));
}

describe('getHomeSections', () => {
  it('links every NAV_ENTRIES page exactly once', () => {
    const paths = linkPaths(true);
    for (const item of getAllNavItems()) {
      expect(
        paths.filter((path) => path === item.to),
        item.label
      ).toHaveLength(1);
    }
  });

  it('has one card per nav entry, in nav order, each with a description and links', () => {
    const sections = getHomeSections(true);
    expect(sections.map((s) => s.title)).toEqual(NAV_ENTRIES.map((e) => (e.kind === 'group' ? e.label : e.item.label)));
    for (const section of sections) {
      expect(section.description.trim(), section.title).not.toBe('');
      expect(section.links.length, section.title).toBeGreaterThan(0);
    }
  });

  it('shows the guide card with its one overview link', () => {
    const guide = getHomeSections(true).find((s) => s.key === 'guide');
    expect(guide?.links.map((l) => [l.label, l.to])).toEqual([['Guide', '/guide']]);
  });

  it('drops Builds without Supabase', () => {
    expect(linkPaths(false)).not.toContain('/builds');
    expect(linkPaths(true)).toContain('/builds');
  });
});
