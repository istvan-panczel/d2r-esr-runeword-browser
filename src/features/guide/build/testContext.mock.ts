/** Tiny inline fixtures for the guide build tests (a few txt rows, strings and game-data entries). */
import type { GlossaryEntry } from '../engine/schema.ts';
import { createGuideContext, type DocsIndex, type GameDataInputs, type GuideContext } from './context.ts';
import type { CubeMod } from '../../game-data/build/cube/cubeRows.ts';
import { buildEsrGuideTables, type EsrGuideTables } from './esrGuideSources.ts';

/** Tab-separated rows with CRLF line ends, like the txt files. */
export function tsv(rows: string[][]): string {
  return rows.map((row) => row.join('\t')).join('\r\n');
}

const CUBE_HEADER = [
  'description',
  'enabled',
  'class',
  'numinputs',
  'input 1',
  'input 2',
  'input 3',
  'output',
  'mod 1',
  'mod 1 min',
  'mod 1 max',
  'output b',
  'output c',
  '*eol',
];

export const CUBEMAIN = tsv([
  CUBE_HEADER,
  [
    '[SECRET01] Unique Ring: Crafted Ring + P-Gem',
    '1',
    '',
    '3',
    '"rin,crf"',
    '"gem5,qty=2"',
    '01a',
    '"rin,uni"',
    '',
    '',
    '',
    '01a',
    '',
    '0',
  ],
  [
    '[SECRET01] Unique Ring: Crafted Ring + P-Gem',
    '1',
    '',
    '3',
    '"ring,crf"',
    '"gem5,qty=2"',
    '01a',
    '"usetype,uni"',
    '',
    '',
    '',
    '01a',
    '',
    '0',
  ],
  ['[SECRET02] Socket(1): Magic Ring', '1', '', '2', '"ring,mag,nos"', 'jew', '', 'usetype,mod,sock=1', '', '', '', '', '', '0'],
  ["Adventurer's Pack", '1', 'ama', '1', 'ag8', '', '', '"c11,nor"', 'sock', '1', '1', 'Kill Ledger', '', '0'],
  ["Adventurer's Pack", '1', 'sor', '1', 'ag8', '', '', '"c11,nor"', 'sock', '1', '1', 'Kill Ledger', '', '0'],
  ['[SECRET03] Disabled', '0', '', '1', 'jew', '', '', 'jew', '', '', '', '', '', '0'],
  // A bonus is shown; markers (tinkerflag2) are not
  ['[SECRET04] Ring Xp', '1', '', '2', '"ring,nru"', '04a', '', 'useitem', 'addxp', '25', '25', '04a', '', '0'],
  ['[SECRET04] Ring Xp Remove', '1', '', '2', 'ring', 'wms', '', 'useitem', 'tinkerflag2', '-1', '-1', '', '', '0'],
  // One bonus per organ would split the recipe past MAX_GROUP_ROWS: shown without bonuses, merged as before
  ['[SECRET05] Tinkering hp', '1', '', '3', '"ring,nru"', '"hrt,qty=3"', '05a', 'useitem', 'hp', '5', '5', '05a', '', '0'],
  ['[SECRET05] Tinkering mana', '1', '', '3', '"ring,nru"', '"sol,qty=3"', '05a', 'useitem', 'mana', '5', '5', '05a', '', '0'],
  ['[SECRET05] Tinkering fire', '1', '', '3', '"ring,nru"', 'fng', '05a', 'useitem', 'dmg-fire', '5', '10', '05a', '', '0'],
  ['[SECRET05] Tinkering light', '1', '', '3', '"ring,nru"', 'hrn', '05a', 'useitem', 'dmg-ltng', '5', '10', '05a', '', '0'],
]);

export const MISC = tsv([
  ['name', 'code', 'namestr', 'TMogMin', 'GheedMin', 'GheedMax', 'GheedMagicMin', 'GheedMagicMax', 'CharsiMin', 'CharsiMax', 'type'],
  ['Ring', 'rin', 'rin', '1', '0', '0', '0', '0', '0', '0', 'ring'],
  ['Jewel', 'jew', 'jew', '0', '0', '0', '1', '1', '0', '0', 'jewl'],
  ['Scroll 1', '01a', '01a', '0', '0', '0', '0', '0', '0', '0', 'scrl'],
  ["Starter's Pack", 'ag8', 'ag8', '0', '0', '0', '0', '0', '0', '0', 'misc'],
  ["Noob's Charm New", 'c11', 'cm8', '0', '0', '0', '0', '0', '0', '0', 'char'],
  ['Rerolling Orb', 't01', 't01', '0', '1', '1', '0', '0', '0', '0', 'cube'],
  ['El Rune', 'r51', 'r51', '0', '0', '0', '0', '0', '0', '0', 'rune'],
  ['Zod Rune', 'r83', 'r83', '0', '0', '0', '0', '0', '0', '0', 'rune'],
  ['Anvil Stone', 'qqq', 'qqq', '0', '0', '0', '0', '0', '0', '0', 'cube'],
]);

export const ARMOR = tsv([
  ['name', 'code', 'namestr', 'GheedMin', 'GheedMax', 'CharsiMin', 'CharsiMax'],
  ['Skull Cap', 'skp', 'skp', '1', '2', '0', '0'],
]);

export const WEAPONS = tsv([
  ['name', 'code', 'namestr', 'CharsiMin', 'CharsiMax'],
  ['Crystal Sword', 'crs', 'crs', '1', '1'],
  ['Mythical Death Blade Frostmourne', 'dd1', 'dd1', '0', '0'],
]);

export const ITEMTYPES = tsv([
  ['ItemType', 'Code', 'Equiv1'],
  ['Ring', 'ring', 'misc'],
  ['Perfect Gem', 'gem5', 'gem'],
]);

export const DIFFICULTYLEVELS = tsv([
  [
    'Name',
    'ResistPenalty',
    'DeathExpPenalty',
    'MonsterSkillBonus',
    'MonsterFreezeDivisor',
    'MonsterColdDivisor',
    'AiCurseDivisor',
    'LifeStealDivisor',
    'ManaStealDivisor',
    'PlayerDamagePercentVSPrimeEvil',
    'MercenaryDamagePercentVSBoss',
  ],
  ['Normal', '0', '0', '0', '1', '1', '1', '1', '1', '100', '50'],
  ['Nightmare', '-40', '5', '3', '2', '2', '2', '25', '15', '50', '35'],
  ['Hell', '-100', '10', '7', '4', '4', '4', '150', '75', '25', '25'],
]);

export const STRINGS = JSON.stringify([
  { Key: 'rin', enUS: 'Ring' },
  { Key: 'jew', enUS: 'Jewel' },
  { Key: '01a', enUS: 'ÿc4Ancient Scroll 1' },
  { Key: 'ag8', enUS: 'Starter Pack' },
  { Key: 'cm8', enUS: "Noob's Odd Charm" },
  { Key: 't01', enUS: 'Rerolling Orb' },
  { Key: 'skp', enUS: 'Skull Cap' },
  { Key: 'crs', enUS: 'Crystal Sword' },
  { Key: 'Kill Ledger', enUS: 'ÿc@Kill Ledger' },
]);

/** Stub labels per property code (`#` is the value); other codes render as "code(param) value" */
const STUB_LABELS: Readonly<Partial<Record<string, string>>> = {
  hp: '+# to Life',
  allskills: '+# to All Skills',
  ama: '+# to Amazon Skill Levels',
  sor: '+# to Sorceress Skill Levels',
  'mag%': '+#% Better Chance of Getting Magic Items',
  'att%': '+#% Bonus to Attack Rating',
  'mana%': 'Increase Maximum Mana +#%',
  'res-all': 'All Resists +#',
  levelreq: '+# Level Required',
  addxp: '+#% to Experience Gained',
  branded: 'Branded',
};

/**
 * Stand-in for the game-data stat renderer (one line per mod, "5" or "5 to 10"), so the guide tests do not need the
 * stat tables; it renders every mod it is given, hidden markers included, so a marker that leaks shows up. The real
 * renderer is checked against the ESR clone in cubeFamilies.test.ts.
 */
export function stubRenderMods(mods: readonly CubeMod[]): string[] {
  return mods.map((mod) => {
    const value = mod.min === mod.max ? String(mod.max) : `${String(mod.min)} to ${String(mod.max)}`;
    const label = STUB_LABELS[mod.mod];
    return label === undefined ? `${mod.mod}${mod.param === '' ? '' : `(${mod.param})`} ${value}` : label.replace('#', value);
  });
}

export function fixtureEsr(): EsrGuideTables {
  return buildEsrGuideTables(
    {
      tables: { cubemain: CUBEMAIN, misc: MISC, armor: ARMOR, weapons: WEAPONS, itemtypes: ITEMTYPES, difficultylevels: DIFFICULTYLEVELS },
      strings: [{ name: 'item-names.json', text: STRINGS }],
    },
    stubRenderMods
  );
}

export const GLOSSARY: GlossaryEntry[] = [
  { term: 'Stocker', definition: 'Holds many copies of one material.', note: null },
  { term: 'Cube', definition: 'The Horadric Cube.', note: null },
];

export function fixtureGameData(): GameDataInputs {
  return {
    runewords: { runewords: [{ key: 'Runeword1', name: 'Enigma', rows: [] }] },
    bases: { bases: [{ code: 'crs', name: 'Crystal Sword' }] },
    types: {
      types: [
        { code: 'swor', name: 'Sword', ancestors: ['swor', 'mele', 'weap'] },
        { code: 'rune', name: 'Rune', ancestors: ['rune', 'sock', 'misc'] },
        { code: 'cube', name: 'Cube Ingredient', ancestors: ['cube', 'misc'] },
      ],
      classes: [],
    },
    sources: {
      items: [
        { name: 'Annihilus', code: 'cm1', item: 'unique', labels: [{ kind: 'boss', text: 'Drops from Diablo Clone' }] },
        { name: "Artemis' Wrath", code: 'amc', item: 'unique', labels: [] },
        { name: 'Frostmourne', code: 'dd1', item: 'unique', labels: [] },
        { name: 'Pelta Lunata', code: 'buc', item: 'unique', labels: [] },
        { name: 'El Rune', code: 'r51', item: 'misc', labels: [] },
        { name: 'Zod Rune', code: 'r83', item: 'misc', labels: [] },
        { name: 'Anvil Stone', code: 'qqq', item: 'misc', labels: [] },
        { name: 'Worldstone Shard', code: 'amu', item: 'set', labels: [{ kind: 'drop', text: 'Drops (random)' }] },
        { name: 'Worldstone Shard', code: 'xa1', item: 'misc', labels: [{ kind: 'boss', text: 'Drops from Baal' }] },
      ],
    },
    modifiers: {
      kinds: [
        { key: 'deadly-strike', title: 'Deadly Strike', category: 'offense', stats: [141], items: 1 },
        { key: 'life-leech', title: 'Life Leech', category: 'offense', stats: [60], items: 1 },
      ],
      facts: [
        { key: 'castRate.cap', label: 'FCR cap', value: 500, origin: 'esr-config', source: { file: 'x', key: 'y' } },
        { key: 'difficulty.ResistPenalty', label: 'Resist', value: [1, -80, -150], origin: 'game-files', source: { file: 'x', key: 'y' } },
        {
          key: 'crushingBlow.share',
          label: 'CB',
          value: { monster: 12.5, unique: 6.25 },
          origin: 'esr-config',
          source: { file: 'x', key: 'y' },
        },
        { key: 'bleed.enabled', label: 'Bleed', value: true, origin: 'esr-config', source: { file: 'x', key: 'y' } },
      ],
    },
  } as unknown as GameDataInputs;
}

export const DOCS: DocsIndex = new Map([['Eastern Sun Resurrected Cube Recipes.html', new Set(['special', 'sec'])]]);

export function fixtureContext(overrides: Partial<{ esr: EsrGuideTables | null; docs: DocsIndex | null }> = {}): GuideContext {
  return createGuideContext({
    gameData: fixtureGameData(),
    glossary: GLOSSARY,
    esr: overrides.esr === undefined ? fixtureEsr() : overrides.esr,
    docs: overrides.docs === undefined ? DOCS : overrides.docs,
  });
}
