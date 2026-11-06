import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ModifiersBundle } from '@/features/game-data/engine/schema';
import { parseModifierContent, parseOpenQuestions } from './modifierContent';
import {
  buildModifiersView,
  DEFAULT_MODIFIERS_STATE,
  encodeModifiersState,
  entryExamples,
  exampleItemUrl,
  filterModifiers,
  groupFacts,
  matchesSearch,
  modifierPageUrl,
  readModifiersState,
  recordKeyLabel,
  statDisplayText,
  usageSummary,
} from './modifiersView';

const ROOT = process.cwd();
const bundle = JSON.parse(readFileSync(resolve(ROOT, 'public/game-data/modifiers.json'), 'utf8')) as ModifiersBundle;
const { blocks } = parseModifierContent(readFileSync(resolve(ROOT, 'content/modifiers/modifiers.md'), 'utf8'));
const questions = parseOpenQuestions(readFileSync(resolve(ROOT, 'content/modifiers/open-questions.md'), 'utf8'));
const view = buildModifiersView(bundle, blocks, questions);

describe('buildModifiersView', () => {
  it('makes one entry per content block and per unclaimed kind, every kind in exactly one entry', () => {
    const kindsShown = view.entries.flatMap((entry) => entry.kinds.map((kind) => kind.key));
    expect(kindsShown.sort()).toEqual(bundle.kinds.map((kind) => kind.key).sort());
    expect(view.entries.filter((entry) => entry.content !== null)).toHaveLength(blocks.length);
    expect(view.entryOfKind.get('resist-cold')).toBe('resists');
    expect(view.entryOfKind.get('deadly-strike')).toBe('deadly-strike');
  });

  it('orders by category, hand-written and key entries first, and marks them featured', () => {
    const first = view.entries[0];
    expect(first?.category).toBe('offense');
    expect(first?.featured).toBe(true);
    const featured = view.entries.filter((entry) => entry.featured);
    expect(featured.length).toBeGreaterThanOrEqual(blocks.length);
    expect(view.byKey.get('replenish-life')?.featured).toBe(true);
    expect(view.byKey.get('replenish-life')?.content).toBeNull();
  });

  it('collects the quoted and listed facts and the calculators of a card', () => {
    const leech = view.byKey.get('life-leech');
    expect(leech?.facts.map((fact) => fact.key)).toContain('difficulty.LifeStealDivisor');
    expect(leech?.facts.map((fact) => fact.key)).toContain('leech.precision');
    expect(leech?.calculators).toEqual(['leech']);
    expect(view.byKey.get('crushing-blow')?.calculators).toEqual(['crushing-blow']);
    expect(view.byKey.get('magic-find')?.calculators).toEqual(['magic-find']);
    expect(view.byKey.get('attack-rating')?.calculators).toEqual(['hit-chance']);
    expect(leech?.content?.questions.length).toBeGreaterThan(0);
  });

  it('flags ESR-only and changed entries and gives stat-name kinds a readable title', () => {
    expect(view.byKey.get('critical-damage')?.esrOnly).toBe(true);
    expect(view.byKey.get('deadly-strike')?.esrOnly).toBe(false);
    // Only stats without any display text keep their stat name
    for (const entry of view.entries)
      if (entry.stats.some((stat) => stat.text !== undefined)) expect(entry.title, entry.key).not.toMatch(/^(to|[a-z0-9_]+)$/);
  });

  it('reports unknown content keys and kinds', () => {
    const broken = buildModifiersView(bundle, [{ ...blocks[0], key: 'nope' }] as typeof blocks);
    expect(broken.problems).toEqual(['content nope has no CONTENT_KINDS entry']);
  });
});

describe('search', () => {
  it('needs every word or quoted phrase, in titles, texts or item lines', () => {
    const entry = view.byKey.get('crushing-blow');
    if (entry === undefined) throw new Error('no crushing-blow entry');
    expect(matchesSearch(entry, 'crushing current life')).toBe(true);
    expect(matchesSearch(entry, '"current life"')).toBe(true);
    expect(matchesSearch(entry, 'crushing zzz')).toBe(false);
    expect(matchesSearch(entry, '')).toBe(true);
  });

  it('filters by view and category and counts the pills and the extra matches in All', () => {
    const key = filterModifiers(view, { category: 'all', search: '', view: 'key' });
    const all = filterModifiers(view, { category: 'all', search: '', view: 'all' });
    expect(all.entries).toHaveLength(view.entries.length);
    expect(key.entries.every((entry) => entry.featured)).toBe(true);
    expect(key.moreInAll).toBe(view.entries.length - key.entries.length);
    expect(all.moreInAll).toBe(0);
    const offense = filterModifiers(view, { category: 'offense', search: '', view: 'key' });
    expect(offense.entries.every((entry) => entry.category === 'offense')).toBe(true);
    expect(offense.counts.offense).toBe(offense.entries.length);
    expect(offense.counts.all).toBe(key.entries.length);
    const leech = filterModifiers(view, { category: 'all', search: 'leech', view: 'key' });
    expect(leech.entries.map((entry) => entry.key)).toEqual(expect.arrayContaining(['life-leech', 'mana-leech']));
  });
});

describe('URL state', () => {
  it('reads and writes kind, category, search and view, leaving defaults out', () => {
    const state = readModifiersState(new URLSearchParams('kind=resist-fire&category=defense&search=fire&view=all'), view);
    expect(state).toEqual({ kind: 'resists', category: 'defense', search: 'fire', view: 'all' });
    expect(encodeModifiersState(state).toString()).toBe('kind=resists&category=defense&search=fire&view=all');
    expect(encodeModifiersState(DEFAULT_MODIFIERS_STATE).toString()).toBe('');
  });

  it('drops unknown kinds and categories', () => {
    expect(readModifiersState(new URLSearchParams('kind=nope&category=nope&view=x'), view)).toEqual(DEFAULT_MODIFIERS_STATE);
  });

  it('links one modifier', () => {
    expect(modifierPageUrl('deadly-strike')).toBe('/modifiers?kind=deadly-strike');
  });
});

describe('display helpers', () => {
  it('writes the stat format codes as readers see them', () => {
    expect(statDisplayText('%+d%% Chance of Crushing Blow')).toBe('+N% Chance of Crushing Blow');
    expect(statDisplayText('ÿc3%0%% Reanimate as: %1')).toBe('N% Reanimate as: X');
    expect(statDisplayText('Adds %d-%d\\nDamage')).toBe('Adds N-N / Damage');
  });

  it('links example items to their focused page', () => {
    const mythicals = new Set(['bul-kathos']);
    expect(exampleItemUrl('unique', 'Shako', mythicals)).toBe('/uniques?name=Shako');
    expect(exampleItemUrl('unique', 'Bul-Kathos', mythicals)).toBe('/mythicals?name=Bul-Kathos');
    expect(exampleItemUrl('set', "Achilles' Girdle", mythicals)).toBe('/game-data/sets?name=Achilles%27+Girdle');
    expect(exampleItemUrl('runeword', 'Boar', mythicals)).toBe('/runewords?name=Boar');
    expect(exampleItemUrl('gemword', 'Holy', mythicals)).toBe('/gemwords?name=Holy');
    expect(exampleItemUrl('socketable', 'Chipped Emerald', mythicals)).toBe('/socketables?name=Chipped+Emerald');
    expect(exampleItemUrl('prefix', 'Bloodlust', mythicals)).toBe('/game-data/affixes?search=%22Bloodlust%22');
    expect(exampleItemUrl('cube', 'Odd recipe', mythicals)).toBeNull();
  });

  it('merges example items round-robin without repeats', () => {
    expect(
      entryExamples(
        [
          {
            examples: [
              ['runeword', 'A'],
              ['unique', 'B'],
            ],
          },
          {
            examples: [
              ['runeword', 'A'],
              ['set', 'C'],
            ],
          },
        ],
        3
      )
    ).toEqual([
      { kind: 'runeword', name: 'A' },
      { kind: 'unique', name: 'B' },
      { kind: 'set', name: 'C' },
    ]);
  });

  it('skips nameless example items', () => {
    expect(
      entryExamples([
        {
          examples: [
            ['automagic', ''],
            ['suffix', ' '],
            ['prefix', 'Bloodlust'],
          ],
        },
      ])
    ).toEqual([{ kind: 'prefix', name: 'Bloodlust' }]);
  });

  it('summarises usage largest first', () => {
    expect(usageSummary({ unique: 3, runeword: 10, set: 0 })).toEqual([
      { kind: 'runeword', label: 'Runeword', count: 10 },
      { kind: 'unique', label: 'Unique', count: 3 },
    ]);
  });

  it('groups facts by shape and labels record fields', () => {
    const groups = groupFacts(
      bundle.facts.filter((fact) => ['difficulty.LifeStealDivisor', 'crushingBlow.share', 'resist.floor'].includes(fact.key))
    );
    expect(groups.perDifficulty.map((fact) => fact.key)).toEqual(['difficulty.LifeStealDivisor']);
    expect(groups.records.map((fact) => fact.key)).toEqual(['crushingBlow.share']);
    expect(groups.scalars.map((fact) => fact.key)).toEqual(['resist.floor']);
    expect(recordKeyLabel('super_unique')).toBe('Superunique');
    expect(recordKeyLabel('104')).toBe('×104');
    expect(recordKeyLabel('pivotRatio')).toBe('Pivot ratio');
    expect(recordKeyLabel('Amazon')).toBe('Amazon');
  });
});
