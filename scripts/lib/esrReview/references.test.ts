import { describe, expect, it } from 'vitest';
import { citationsIn, isReferenceCandidate, referencesCheck } from './references.ts';

describe('isReferenceCandidate', () => {
  it('takes root docs pages, D2RLoader configs and patches, and listed files', () => {
    expect(isReferenceCandidate('docs/endgame_maps.htm')).toBe(true);
    expect(isReferenceCandidate('d2rloader/config/celestialrayone.whirlwind.toml')).toBe(true);
    expect(isReferenceCandidate('d2rloader/patches/no-run-penalties.json')).toBe(true);
    expect(isReferenceCandidate('Eastern_Sun_Resurrected.mpq/data/hd/global/excel/desecratedzones.json')).toBe(true);
    expect(isReferenceCandidate('docs/deDE/endgame_maps.htm')).toBe(false);
    expect(isReferenceCandidate('docs/images/map.png')).toBe(false);
    expect(isReferenceCandidate('d2rloader/metadata.json')).toBe(false);
  });
});

describe('citationsIn', () => {
  it('finds the content files naming a path by its file name', () => {
    const files = [
      { path: 'content/modifiers/modifiers.md', text: 'Source: `ESR/d2rloader/config/celestialrayone.bleed.toml`.' },
      { path: 'content/guide/notes/endgame-bosses.md', text: "href: 'docs:endgame_maps.htm#t5'" },
    ];
    const citations = citationsIn(['d2rloader/config/celestialrayone.bleed.toml', 'docs/endgame_maps.htm', 'docs/sets.htm'], files);
    expect(Object.fromEntries(citations)).toEqual({
      'd2rloader/config/celestialrayone.bleed.toml': ['content/modifiers/modifiers.md'],
      'docs/endgame_maps.htm': ['content/guide/notes/endgame-bosses.md'],
    });
  });
});

describe('referencesCheck', () => {
  it('is ok when nothing the app follows changed', () => {
    expect(referencesCheck(['docs/prefixes.htm'], new Map()).status).toBe('ok');
  });

  it('is a finding for a page with hand-kept app data', () => {
    const check = referencesCheck(['docs/endgame_maps.htm'], new Map());
    expect(check.status).toBe('finding');
    expect(check.details[0]).toMatch(/^docs\/endgame_maps\.htm: \[hand-kept\] .*mapBosses\.ts/);
  });

  it('is a finding for a launcher config a note cites, listing at most five notes', () => {
    const notes = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((name) => `content/guide/notes/${name}.md`);
    const path = 'd2rloader/patches/auto-collect-corpse.json';
    const check = referencesCheck([path], new Map([[path, notes]]));
    expect(check.status).toBe('finding');
    expect(check.details[0]).toBe(`${path}: cited by ${notes.slice(0, 5).join(', ')} +2 more`);
  });

  it('is info for generated, tested and runtime files, even when the guide links a generated page', () => {
    const check = referencesCheck(
      ['docs/runewords.htm', 'docs/quality_affixes.htm', 'd2rloader/config/celestialrayone.superior-affixes.toml'],
      new Map([['docs/runewords.htm', ['content/guide/notes/runewords-gemwords.md']]])
    );
    expect(check.status).toBe('info');
    expect(check.details).toHaveLength(3);
  });
});
