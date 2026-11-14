import { describe, expect, it } from 'vitest';
import { buildPatchNotesIndex, ownerNoteReport, publishedReportPath, publishedReportVersion } from './patchNotesIndex.ts';

describe('ownerNoteReport', () => {
  it('recognises both report names, case-insensitive', () => {
    expect(ownerNoteReport('ESR-3.3.04-unique-runeword-changes.pdf')).toEqual({ version: '3.3.04', kind: 'items', ext: 'pdf' });
    expect(ownerNoteReport('esr-3.3-changelog-check.html')).toEqual({ version: '3.3', kind: 'check', ext: 'html' });
    expect(ownerNoteReport('esr-3.3-uniques-runewords-changes.md')).toBeNull();
    expect(ownerNoteReport('esr-3.3.04-mod-author-questions.md')).toBeNull();
  });
});

describe('publishedReportPath', () => {
  it('is flat under reports/ and reads back its version', () => {
    const path = publishedReportPath('3.3.04', 'check', 'pdf');
    expect(path).toBe('reports/3.3.04-patch-note-check.pdf');
    expect(publishedReportVersion(path)).toBe('3.3.04');
    expect(publishedReportVersion('index.json')).toBeNull();
  });
});

describe('buildPatchNotesIndex', () => {
  const base = {
    tagDates: new Map([['3.3.04', '2026-11-11']]),
    previousDates: new Map([
      ['3.3', '2026-11-07'],
      ['3.3.04', '2000-01-01'],
    ]),
    sourceUrlBase: 'https://example.test/patchnotes/',
  };

  it('sorts newest first, takes tag dates over remembered ones and drops the title line', () => {
    const { index, warnings } = buildPatchNotesIndex({
      ...base,
      notes: new Map([
        ['3.3', '**Eastern Sun Resurrected 3.3**\n**Items**\n\n* A'],
        ['3.3.04', '* B'],
        ['3.2.24', '* C'],
      ]),
      reportFiles: ['reports/3.3.04-item-changes.html', 'reports/3.3.04-item-changes.pdf', 'reports/3.3-patch-note-check.html'],
    });
    expect(warnings).toEqual([]);
    expect(index.releases.map((release) => [release.version, release.date])).toEqual([
      ['3.3.04', '2026-11-11'],
      ['3.3', '2026-11-07'],
      ['3.2.24', null],
    ]);
    expect(index.releases[1].blocks[0]).toEqual({ type: 'heading', text: 'Items' });
    expect(index.releases[0].reports).toEqual([
      { kind: 'items', html: 'reports/3.3.04-item-changes.html', pdf: 'reports/3.3.04-item-changes.pdf' },
    ]);
    expect(index.releases[1].reports).toEqual([{ kind: 'check', html: 'reports/3.3-patch-note-check.html', pdf: null }]);
    expect(index.releases[0].sourceUrl).toBe('https://example.test/patchnotes/3.3.04.md');
  });

  it('keeps a release that has reports but no notes, and warns about a PDF without its HTML', () => {
    const { index, warnings } = buildPatchNotesIndex({
      ...base,
      notes: new Map(),
      reportFiles: ['reports/3.3.05-item-changes.html', 'reports/3.3.05-patch-note-check.pdf'],
    });
    expect(index.releases.map((release) => release.version)).toEqual(['3.3.05']);
    expect(index.releases[0].blocks).toEqual([]);
    expect(warnings).toEqual([
      '3.3.05: reports but no patchnotes/3.3.05.md',
      'reports/3.3.05-patch-note-check.pdf: not listed (a PDF without its HTML, or an unknown file name)',
    ]);
  });
});
