import { describe, expect, it } from 'vitest';
import type { PatchNoteRelease } from '../engine/schema';
import { formatReleaseDate, groupReleases, releasePath, releaseViews, reportOf, resolveView } from './patchNotesView';

const release = (version: string, kinds: ('items' | 'check')[] = []): PatchNoteRelease => ({
  version,
  date: null,
  sourceUrl: '',
  blocks: [],
  reports: kinds.map((kind) => ({ kind, html: `reports/${version}-${kind}.html`, pdf: null })),
});

describe('patch notes view', () => {
  it('offers the notes and each report, and falls back to the notes', () => {
    const r = release('3.3.02', ['check']);
    expect(releaseViews(r)).toEqual(['notes', 'check']);
    expect(resolveView(r, 'check')).toBe('check');
    expect(resolveView(r, 'items')).toBe('notes');
    expect(resolveView(r, null)).toBe('notes');
    expect(reportOf(r, 'check')?.html).toBe('reports/3.3.02-check.html');
    expect(reportOf(r, 'notes')).toBeNull();
  });

  it('builds release paths', () => {
    expect(releasePath('3.3.04')).toBe('/patch-notes/3.3.04');
    expect(releasePath('3.3.04', 'items')).toBe('/patch-notes/3.3.04?view=items');
  });

  it('groups releases by their first two version parts in order', () => {
    const groups = groupReleases([release('3.3.04'), release('3.3'), release('3.2.24'), release('3.2.04')]);
    expect(groups.map((group) => [group.line, group.releases.map((r) => r.version)])).toEqual([
      ['3.3', ['3.3.04', '3.3']],
      ['3.2', ['3.2.24', '3.2.04']],
    ]);
  });

  it('formats dates', () => {
    expect(formatReleaseDate('2026-11-09')).toBe('9 Nov 2026');
    expect(formatReleaseDate(null)).toBeNull();
  });
});
