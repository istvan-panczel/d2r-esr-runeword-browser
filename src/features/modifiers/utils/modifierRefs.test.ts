import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ModifiersBundle } from '@/features/game-data/engine/schema';
import { serializeBundle } from '@/features/game-data/build/writeBundle';
import { MODIFIERS_ROUTE, MODIFIERS_URL_PARAMS } from './modifierRoutes';
import { decodeModifierRef, encodeModifierRef } from './modifierRefData';
import {
  buildModifierRefIndex,
  canonicalLine,
  findModifierRef,
  KIND_PARAM,
  modifierRefUrl,
  parseLineNumber,
  PEEK_FACT_KEYS,
  ROUTE,
  type ModifierRefsData,
} from './modifierRefs';
import { buildModifierRefsData, modifierSearchNames, statKeys } from './modifierRefsBuild';
import { buildModifiersView } from './modifiersView';
import { parseModifierContent } from './modifierContent';

const root = resolve(__dirname, '../../../..');
const bundle = JSON.parse(readFileSync(resolve(root, 'public/game-data/modifiers.json'), 'utf-8')) as ModifiersBundle;
const markdown = readFileSync(resolve(root, 'content/modifiers/modifiers.md'), 'utf-8');
const committedText = readFileSync(resolve(root, 'src/features/modifiers/data/modifierRefs.json'), 'utf-8');
const committed = JSON.parse(committedText) as ModifierRefsData;
const index = buildModifierRefIndex(committed);

describe('data/modifierRefs.json', () => {
  const built = buildModifierRefsData(bundle, markdown);

  it('is in sync with modifiers.json and content/modifiers/modifiers.md (else: npm run modifiers:refs)', () => {
    expect(built.problems).toEqual([]);
    expect(committedText).toBe(serializeBundle(built.data));
  });

  it('leaves only the tied group line out', () => {
    expect(built.conflicts).toEqual([
      '#% to all speeds: ias (1), frw (1), fhr (1), fbr (1), fcr (1)',
      '#% to spell damage: elemental-mastery (4), spell-damage (2)',
      '#% total all resists: resists (4), physical-resist (1)',
    ]);
    expect(committed.templates.some(([key]) => key === '#% to all speeds')).toBe(false);
  });

  it('has an entry for every hand-written explanation and key kind, keyed like the page', () => {
    const view = buildModifiersView(bundle, parseModifierContent(markdown).blocks);
    const featured = view.entries.filter((entry) => entry.featured).map((entry) => entry.key);
    expect(committed.entries.map((entry) => entry.key).sort()).toEqual([...featured].sort());
    for (const entry of committed.entries) expect(view.byKey.get(entry.key)?.title).toBe(entry.title);
    expect(committed.entries.filter((entry) => entry.summary === null).map((entry) => entry.key)).toEqual([
      'replenish-life',
      'attribute-percent',
    ]);
  });

  it('carries the facts the peek reads and stays small', () => {
    expect(committed.facts.map((fact) => fact.key)).toEqual(PEEK_FACT_KEYS);
    // ~34 KB raw / 9 KB gzip, of which the home search names ~12 KB raw
    expect(committedText.length).toBeLessThan(40_000);
  });

  it('copies the route and param of modifierRoutes.ts', () => {
    expect(ROUTE).toBe(MODIFIERS_ROUTE);
    expect(KIND_PARAM).toBe(MODIFIERS_URL_PARAMS.KIND);
  });
});

describe('canonicalLine / parseLineNumber', () => {
  it.each([
    ['+20% Deadly Strike', '#% deadly strike', ['+20']],
    ['Fire Resist +(20 to 30)%', 'fire resist #%', ['+(20 to 30)']],
    ['-(5 to 8)% to Enemy Cold Resist', '#% to enemy cold resist', ['-(5 to 8)']],
    ['Damage Reduced by 10-12***', 'damage reduced by #', ['10-12']],
    ['+0.5 to Strength (Based on Character Level)', '# to strength (based on character level)', ['+0.5']],
    ['ÿc3Cannot  Be Frozen', 'cannot be frozen', []],
  ])('%s', (line, key, numbers) => {
    expect(canonicalLine(line)).toEqual({ key, numbers });
  });

  it.each([
    ['+20', [20, 20]],
    ['(10 to 20)', [10, 20]],
    ['+(10 to 20)', [10, 20]],
    ['-(5 to 8)', [-5, -8]],
    ['(-5 to -8)', [-5, -8]],
    ['10-12', [10, 12]],
    ['1.5', [1.5, 1.5]],
  ])('%s', (text, value) => {
    expect(parseLineNumber(text)).toEqual(value);
  });
});

describe('statKeys', () => {
  it('places the value of fixed strings by descval and adds descstr2', () => {
    expect(statKeys({ descfunc: 1, descval: 1 }, 'Life on Striking')).toEqual([
      'life on striking',
      '# life on striking',
      '#% life on striking',
    ]);
    expect(statKeys({ descfunc: 12, descval: 2 }, 'Freezes target')).toEqual(['freezes target', 'freezes target #', 'freezes target #%']);
    expect(statKeys({ descfunc: 19, text2: '(Based on Character Level)' }, '%+d%% Deadly Strike')).toEqual([
      '#% deadly strike',
      '#% deadly strike (based on character level)',
    ]);
  });

  it('turns the class and skill tab names of descfunc 13 / 14 into wildcards', () => {
    expect(statKeys({ descfunc: 13 }, '%+d to Amazon Skill Levels')).toEqual(['# to ¤ skill levels', '# to ¤ skills']);
    expect(statKeys({ descfunc: 14 }, '%+d to Javelin and Spear Skills')).toEqual(['# to ¤ skills (¤ only)']);
  });
});

describe('findModifierRef: real lines (HTM pages and game-data bundles, ESR 3.2.24)', () => {
  it.each([
    // runewords / uniques / gemword pools
    ['+20% Deadly Strike', 'deadly-strike', [20, 20]],
    ['+(10 to 20)% Deadly Strike', 'deadly-strike', [10, 20]],
    ['+15% Chance of Crushing Blow', 'crushing-blow', [15, 15]],
    ['25% Chance of Crushing Blow', 'crushing-blow', [25, 25]],
    ['+8% Physical Damage Leeched as Life', 'life-leech', [8, 8]],
    ['+5% Physical Damage Leeched as Mana', 'mana-leech', [5, 5]],
    ['+30% Faster Cast Rate', 'fcr', [30, 30]],
    ['+(20 to 30)% Increased Attack Speed', 'ias', [20, 30]],
    ['-15% to Enemy Fire Resist', 'enemy-resist', [-15, -15]],
    ['-(5 to 10)% to Enemy Elemental And Poison Resists', 'enemy-resist', [-5, -10]],
    ['Cannot Be Frozen', 'cannot-be-frozen', undefined],
    ['Cannot be Frozen', 'cannot-be-frozen', undefined],
    ['Half Freeze Duration', 'cannot-be-frozen', undefined],
    ['All Resists +(20 to 30)', 'resists', [20, 30]],
    ['Fire Resist +30%', 'resists', [30, 30]],
    ['+10% to Maximum Cold Resist', 'max-resists', [10, 10]],
    ['+(15 to 20)% to Spell Damage', 'elemental-mastery', [15, 20]],
    ['+25% to Magic Spell Damage', 'spell-damage', [25, 25]],
    ['+(150 to 200)% Enhanced Damage', 'enhanced-damage', [150, 200]],
    ['+(40 to 60)% Better Chance of Getting Magic Items', 'magic-find', [40, 60]],
    ['+100% Extra Gold from Monsters', 'gold-find', [100, 100]],
    ['Damage Reduced by 10', 'damage-reduced', [10, 10]],
    ['Physical Resist: 15%', 'physical-resist', [15, 15]],
    ['Magic Damage Reduced by (5 to 9)', 'magic-damage-reduced', [5, 9]],
    ['+15% Dodge Chance', 'dodge', [15, 15]],
    ['Elemental Absorb 10%', 'absorb', [10, 10]],
    ['+10 Fire Absorb', 'absorb', [10, 10]],
    ['+2 to All Skills', 'skills', [2, 2]],
    ['+2 to Druid Skill Levels', 'skills', [2, 2]],
    ['+1 to Warlock Skills', 'skills', [1, 1]],
    ['+1 to Summoning Skills (Necromancer Only)', 'skills', [1, 1]],
    ['+3 Life on Striking', 'on-striking', [3, 3]],
    ['+(10 to 20) Life after each Kill', 'after-kill', [10, 20]],
    ['Freezes target +5', 'freeze', [5, 5]],
    ['Freezes target', 'freeze', undefined],
    ['Slows Target by 25%', 'slow', [25, 25]],
    ['Knockback', 'knockback', undefined],
    ['Ignore Target’s Defense', 'target-defense', undefined],
    ['-25% Target Defense', 'target-defense', [-25, -25]],
    ['+(10 to 15)% Reanimate as: Ignis Fatuus', 'reanimate', [10, 15]],
    ['25% Reanimate as: Aura Bearing Soldier', 'reanimate', [25, 25]],
    ['Requirements -20%', 'requirements', [-20, -20]],
    ['Replenish Life +10', 'replenish-life', [10, 10]],
    ['20% Bonus to Strength', 'attribute-percent', [20, 20]],
    ['+25% to Summon Life', 'summon-stats', [25, 25]],
    ['+(1 to 2) to Non-Unique Summons Limit', 'summon-stats', [1, 2]],
  ])('%s → %s', (line, key, value) => {
    expect(findModifierRef(line, index)).toEqual({ key, ...(value === undefined ? {} : { value }) });
  });

  it('marks per-level lines', () => {
    expect(findModifierRef('+3% Better Chance of Getting Magic Items (Based on Character Level)', index)).toEqual({
      key: 'magic-find',
      value: [3, 3],
      perLevel: true,
    });
  });

  it.each([
    // prose (mythicals, uniques, ascendancies)
    'Gain 3% Maximum Damage for every 1% Physical Damage Leeched as Life',
    'You have a 1% chance to crit for 1% more total attack damage for every 1% deadly strike over 100%',
    'Gain 5% Dodge Chance per 200% Faster Run/Walk or 40% Base Run/Walk Speed',
    'Gain 1% to All Maximum Resists per 100% Cold Resist',
    'Reduce the poison resist of nearby enemies by up to 50%',
    'Every melee attack grants you 1% life steal and damage reduced by 1',
    // skill lines are the skill peek's
    '+3 to Fire Ball (Sorceress Only)',
    '10% Chance to Cast Level 5 Static Field on Striking',
    'Level 15 Fanaticism Aura When Equipped',
    'Level 3 Teleport (20/20 Charges)',
    // stats without an explanation, and the tied group line
    '+20 to Strength',
    '+(100 to 150)% Enhanced Defense',
    '+20% to All Speeds',
    '',
  ])('%s → no link', (line) => {
    expect(findModifierRef(line, index)).toBeNull();
  });
});

describe('modifier reference attribute and URL', () => {
  it('round-trips and rejects anything else', () => {
    const ref = { key: 'life-leech', value: [5, 8] as const, perLevel: true as const };
    expect(decodeModifierRef(encodeModifierRef(ref))).toEqual(ref);
    expect(decodeModifierRef(encodeModifierRef({ key: 'knockback' }))).toEqual({ key: 'knockback' });
    expect(decodeModifierRef(undefined)).toBeNull();
    expect(decodeModifierRef('{')).toBeNull();
    expect(decodeModifierRef('{"key":""}')).toBeNull();
    expect(decodeModifierRef('{"key":"x","value":[1]}')).toBeNull();
    expect(decodeModifierRef('{"key":"x","perLevel":1}')).toBeNull();
  });

  it('links the focused entry', () => {
    expect(modifierRefUrl('life-leech')).toBe('/modifiers?kind=life-leech');
  });
});

describe('modifierSearchNames', () => {
  it('lists modifier kinds without bookkeeping-only kinds or stat-name titles', () => {
    const stat = (id: number, technical?: true) => ({ id, ...(technical === undefined ? {} : { technical }) });
    const kind = (key: string, title: string, stats: number[], generated?: true) => ({
      key,
      title,
      stats,
      ...(generated === undefined ? {} : { generated }),
    });
    const names = modifierSearchNames({
      stats: [stat(1), stat(2, true), stat(3)],
      kinds: [kind('deadly-strike', 'Deadly Strike', [1]), kind('stat-cap', 'Cap', [2], true), kind('stat-x', 'item_x', [3], true)],
    } as unknown as Parameters<typeof modifierSearchNames>[0]);
    expect(names).toEqual([['Deadly Strike', 'deadly-strike']]);
  });

  it('gives the home search the kind titles from modifierRefs.json', () => {
    expect(committed.searchNames.length).toBeGreaterThan(200);
    expect(committed.searchNames).toContainEqual(['Fire Resist', 'resist-fire']);
  });
});
