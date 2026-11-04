import { describe, expect, it } from 'vitest';
import { finding, formatMarkdown, formatText, ok, skipped, info } from './report.ts';
import { commitsCheck, coverageCheck, featureCommits, warningClass, warningClassesInSource } from './selfCheck.ts';

describe('self-check', () => {
  const covered = {
    bundleFiles: ['manifest.json', 'tiers.json'],
    unknownSections: [],
    countKeys: ['tierCodes', 'skills'],
    warnings: ['bases: x'],
    sourceWarningClasses: [],
  };

  it('is ok when everything is known', () => {
    expect(coverageCheck(covered).status).toBe('ok');
  });

  it('names every unknown bundle file, section, count key and warning class', () => {
    const check = coverageCheck({
      bundleFiles: ['tiers.json', 'quests.json'],
      unknownSections: ['tiers.json extra'],
      countKeys: ['tierCodes', 'questsTotal'],
      warnings: ['quests: no act', 'quests: other', 'no prefix here'],
      sourceWarningClasses: [{ file: 'src/features/game-data/build/bundleMonsters.ts', cls: 'monsters' }],
    });
    expect(check.status).toBe('finding');
    expect(check.details).toEqual([
      'bundle file quests.json',
      'bundle section tiers.json extra',
      'manifest count questsTotal',
      'warning class "quests" (manifest)',
      'warning class "(no class prefix)" (manifest)',
      'warning class "monsters" (src/features/game-data/build/bundleMonsters.ts)',
    ]);
  });

  it('reads warning classes from warnings and generator sources', () => {
    expect(warningClass('lootfilter skills: unknown skill')).toBe('lootfilter skills');
    expect(warningClass('Bases: capitalised')).toBeNull();
    const source = "warnings.push(`stash: ${x} has no row`);\nconst label = 'note: plain text';\nwarn(`affix stats: ${y}`);";
    expect(warningClassesInSource(source)).toEqual(['stash', 'affix stats']);
  });

  it('keeps the feat and fix commits', () => {
    const log = 'abc1234\tfeat(stash): all items\nbcd2345\tchore: format\ncde3456\tfix!: parser\n';
    expect(featureCommits(log)).toEqual([
      { hash: 'abc1234', subject: 'feat(stash): all items' },
      { hash: 'cde3456', subject: 'fix!: parser' },
    ]);
    expect(commitsCheck('9328db2', []).status).toBe('ok');
    expect(commitsCheck('9328db2', featureCommits(log)).details).toEqual(['abc1234 feat(stash): all items', 'cde3456 fix!: parser']);
  });
});

describe('report', () => {
  const report = {
    generatedAt: '2026-11-04T00:00:00.000Z',
    context: ['App: HEAD x'],
    checks: [
      ok('a.ok', 'A', 'Fine.'),
      skipped('d.skip', 'D', 'Offline.'),
      finding('b.find', 'B', 'Broke.', 'players lose X', ['detail']),
      info('c.info', 'C', 'Note.'),
    ],
  };

  it('puts findings first, then info, ok and skipped', () => {
    const markdown = formatMarkdown(report);
    const order = ['## Findings', '## Info', '## OK', '## Skipped'].map((heading) => markdown.indexOf(heading));
    expect(order).toEqual([...order].sort((x, y) => x - y));
    expect(markdown).toContain('### B (`b.find`)\n\nBroke. Why it matters: players lose X\n\n    detail');
    expect(markdown).toContain('- 1 findings · 1 info · 1 ok · 1 skipped');
  });

  it('prints one block per check as text', () => {
    expect(formatText(report)).toContain('[FINDING] B (b.find): Broke. Why it matters: players lose X\n    detail');
  });
});
