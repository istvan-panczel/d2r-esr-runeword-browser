import { describe, it, expect } from 'vitest';
import { diffCounts, failedTestFiles, formatChange, formatSummary, parsePorcelain, shortCommit, staleIconsNote } from './updateSummary.ts';

describe('updateSummary', () => {
  it('formats changes', () => {
    expect(formatChange('3.2.10', '3.2.11')).toBe('3.2.10 → 3.2.11');
    expect(formatChange('3.2.10', '3.2.10')).toBe('3.2.10 (unchanged)');
    expect(shortCommit('10b540e9614d')).toBe('10b540e');
    expect(shortCommit(null)).toBe('(none)');
  });

  it('lists only changed counts with signed deltas', () => {
    expect(diffCounts({ bases: 653, types: 188, gone: 1 }, { bases: 660, types: 188, runewords: 2 })).toEqual([
      'bases: 653 → 660 (+7)',
      'gone: 1 → (removed)',
      'runewords: (new) 2',
    ]);
    expect(diffCounts({ affixes: 10 }, { affixes: 8 })).toEqual(['affixes: 10 → 8 (-2)']);
  });

  it('parses porcelain output', () => {
    expect(parsePorcelain(' M public/game-data/bases.json\n?? public/game-data/new.json\n')).toEqual([
      'public/game-data/bases.json',
      'public/game-data/new.json',
    ]);
  });

  it('formats the summary', () => {
    const before = { esrVersion: '3.2.10', esrTag: '3.2.10', esrCommit: 'aaaaaaaaa', counts: { bases: 1 }, warnings: [] };
    const after = { esrVersion: '3.2.11', esrTag: null, esrCommit: 'bbbbbbbbb', counts: { bases: 2 }, warnings: ['w1'] };
    const lines = formatSummary({
      before,
      after,
      steps: [
        { name: 'generate', ok: true },
        { name: 'tests', ok: false },
      ],
      changedFiles: [],
    });
    expect(lines).toEqual([
      'ESR version: 3.2.10 → 3.2.11',
      'ESR tag:     3.2.10 → (none)',
      'ESR commit:  aaaaaaa → bbbbbbb',
      '',
      'Changed counts:',
      '  bases: 1 → 2 (+1)',
      '  warnings: 0 → 1 (+1)',
      '',
      'Generator warnings (1):',
      '  - w1',
      '',
      'Steps:',
      '  OK   generate',
      '  FAIL tests',
      '',
      'Changed files: none (the generated files under public/ are up to date)',
    ]);
  });

  it('prints step details and notes', () => {
    const lines = formatSummary({
      before: null,
      after: null,
      steps: [{ name: 'tests', ok: false, note: '2 failing files', details: ['src/a.test.ts', 'src/b.test.ts'] }],
      changedFiles: ['public/sitemap.xml'],
      notes: ['do this'],
    });
    expect(lines.slice(lines.indexOf('Steps:'))).toEqual([
      'Steps:',
      '  FAIL tests (2 failing files)',
      '         src/a.test.ts',
      '         src/b.test.ts',
      '',
      'Notes:',
      '  - do this',
      '',
      'Changed files:',
      '  public/sitemap.xml',
    ]);
  });

  it('lists the failing test files of a Vitest JSON report relative to the root', () => {
    const report = {
      testResults: [
        { name: '/repo/src/z.test.ts', status: 'failed' },
        { name: '/repo/src/ok.test.ts', status: 'passed' },
        { name: '/repo/scripts/a.test.ts', status: 'failed' },
        { name: '/elsewhere/x.test.ts', status: 'failed' },
      ],
    };
    expect(failedTestFiles(report, '/repo')).toEqual(['/elsewhere/x.test.ts', 'scripts/a.test.ts', 'src/z.test.ts']);
    expect(failedTestFiles({}, '/repo')).toEqual([]);
  });

  it('flags icons.json left at the old ESR version', () => {
    const manifest = { esrVersion: '3.2.25', esrTag: '3.2.25', esrCommit: 'c', counts: {}, warnings: [] };
    expect(staleIconsNote({ esrVersion: '3.2.25', esrTag: '3.2.25' }, manifest, '/v')).toBeNull();
    expect(staleIconsNote(null, manifest, '/v')).toBeNull();
    const note = staleIconsNote({ esrVersion: '3.2.24', esrTag: '3.2.24' }, manifest, '/v');
    expect(note).toContain('icons.json still says ESR 3.2.24');
    expect(note).toContain('npm run game-data:icons');
    expect(note).toContain('D2R_VANILLA_ART_DIR');
  });
});
