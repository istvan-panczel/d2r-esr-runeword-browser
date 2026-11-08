import { describe, expect, it } from 'vitest';
import type { ItemTextBundle, ItemTextStatDef } from '@/features/game-data/engine/schema';
import { itemTextContext } from '../../hooks/useItemText';
import type { StashStat } from '../../parser/types';
import { makeBundle, makeItem } from '../../testing/stashMocks.mock';
import { stashCatalog } from '../catalog';
import { createItemTextContext, renderItemText, statValues, type StatValue } from './itemText';

const catalog = stashCatalog(makeBundle());

describe('item text placeholder context (no itemtext.json)', () => {
  const ctx = createItemTextContext(null, catalog);

  it('has no names and no stat values', () => {
    expect(ctx.hasText).toBe(false);
    expect(ctx.names.magicPrefix(1)).toBeNull();
    expect(statValues(makeItem('cap', { stats: [{ id: 105, param: 0, value: 20 }] }), ctx)).toEqual([]);
  });

  it('writes the base lines and lists the socketed items', () => {
    const jewel = makeItem('jew');
    const groups = renderItemText(
      makeItem('cap', { defense: 12, durability: 5, maxDurability: 12, ethereal: true, sockets: 2, socketed: [jewel] }),
      ctx
    );
    expect(groups.base).toEqual(['Defense: 12', 'Durability: 5 of 12', 'Ethereal (Cannot be Repaired)', 'Socketed (2)']);
    expect(groups.socketed).toEqual([{ item: jewel, lines: [] }]);
    expect(renderItemText(makeItem('sbw', { maxDurability: 0 }), ctx).base).toEqual(['Indestructible']);
  });
});

// A hand-built itemtext.json with the ESR 3.2.24 rows (ids, columns, strings) the cases need
const dgrp = (group: number, key: string) => ({ dgrp: group, dgrpfunc: 19, dgrpstrpos: key });
const STATS: Record<number, ItemTextStatDef> = {
  0: { stat: 'strength', descpriority: 67, descfunc: 19, descstrpos: 'ModStr1a', ...dgrp(1, 'Moditem2allattrib') },
  1: { stat: 'energy', descpriority: 61, descfunc: 19, descstrpos: 'ModStr1d', ...dgrp(1, 'Moditem2allattrib') },
  2: { stat: 'dexterity', descpriority: 65, descfunc: 19, descstrpos: 'ModStr1b', ...dgrp(1, 'Moditem2allattrib') },
  3: { stat: 'vitality', descpriority: 63, descfunc: 19, descstrpos: 'ModStr1c', ...dgrp(1, 'Moditem2allattrib') },
  7: { stat: 'maxhp', descpriority: 59, descfunc: 19, descstrpos: 'ModStr1u' },
  16: { stat: 'item_armor_percent', descpriority: 74, descfunc: 19, descstrpos: 'Modstr2v' },
  17: { stat: 'item_maxdamage_percent', descpriority: 129, descfunc: 19, descstrpos: 'ModStr2j' },
  18: { stat: 'item_mindamage_percent', descpriority: 130, descfunc: 19, descstrpos: 'ModStr2k' },
  21: { stat: 'mindamage', descpriority: 127, descfunc: 19, descstrpos: 'ModStr1g' },
  22: { stat: 'maxdamage', descpriority: 126, descfunc: 19, descstrpos: 'ModStr1f' },
  23: { stat: 'secondary_mindamage', descpriority: 124, descfunc: 19, descstrpos: 'ModStr1g' },
  24: { stat: 'secondary_maxdamage', descpriority: 123, descfunc: 19, descstrpos: 'ModStr1f' },
  31: { stat: 'armorclass', descpriority: 71, descfunc: 19, descstrpos: 'ModStr1i' },
  39: { stat: 'fireresist', descpriority: 36, descfunc: 19, descstrpos: 'ModStr1j', ...dgrp(2, 'strModAllResistances') },
  41: { stat: 'lightresist', descpriority: 38, descfunc: 19, descstrpos: 'ModStr1l', ...dgrp(2, 'strModAllResistances') },
  43: { stat: 'coldresist', descpriority: 40, descfunc: 19, descstrpos: 'ModStr1k', ...dgrp(2, 'strModAllResistances') },
  45: { stat: 'poisonresist', descpriority: 34, descfunc: 19, descstrpos: 'ModStr1n', ...dgrp(2, 'strModAllResistances') },
  48: { stat: 'firemindam', descpriority: 102, descfunc: 19, descstrpos: 'ModStr1p' },
  49: { stat: 'firemaxdam', descpriority: 101, descfunc: 19, descstrpos: 'ModStr1o' },
  54: { stat: 'coldmindam', descpriority: 96, descfunc: 19, descstrpos: 'ModStr1t' },
  55: { stat: 'coldmaxdam', descpriority: 95, descfunc: 19, descstrpos: 'ModStr1s' },
  56: { stat: 'coldlength' },
  52: { stat: 'magicmindam', descpriority: 104, descfunc: 19, descstrpos: 'strModMagicDamageMin', ...dgrp(15, 'strModMagicDamage') },
  53: { stat: 'magicmaxdam', descpriority: 103, descfunc: 19, descstrpos: 'strModMagicDamageMax', ...dgrp(15, 'strModMagicDamage') },
  57: { stat: 'poisonmindam', descpriority: 92, descfunc: 19, descstrpos: 'ModStr4i' },
  58: { stat: 'poisonmaxdam', descpriority: 91, descfunc: 19, descstrpos: 'ModStr4h' },
  59: { stat: 'poisonlength' },
  83: { stat: 'item_addclassskills', descpriority: 150, descfunc: 13, descstrpos: 'ModStr3a' },
  97: { stat: 'item_nonclassskill' },
  105: { stat: 'item_fastercastrate', descpriority: 142, descfunc: 19, descstrpos: 'ModStr4v' },
  107: { stat: 'item_singleskill', descpriority: 81, descfunc: 27, descstrpos: 'ItemModifierClassSkill' },
  188: { stat: 'item_addskill_tab', descpriority: 151, descfunc: 14, descstrpos: 'StrSklTabItem1' },
  198: { stat: 'item_skillonhit', descpriority: 160, descfunc: 15, descstrpos: 'ItemExpansiveChanc1' },
  204: { stat: 'item_charged_skill', descpriority: 1, descfunc: 24, descstrpos: 'ModStre10d' },
  216: {
    stat: 'item_hp_perlevel',
    op: 2,
    opParam: 3,
    descpriority: 57,
    descfunc: 19,
    descstrpos: 'ModStr1u',
    descstr2: 'increaseswithplaylevelX',
  },
  214: {
    stat: 'item_armor_perlevel',
    op: 4,
    opParam: 3,
    descpriority: 72,
    descfunc: 19,
    descstrpos: 'ModStr1i',
    descstr2: 'increaseswithplaylevelX',
  },
  215: {
    stat: 'item_armorpercent_perlevel',
    op: 5,
    opParam: 3,
    descpriority: 73,
    descfunc: 19,
    descstrpos: 'Modstr2v',
    descstr2: 'increaseswithplaylevelX',
  },
  218: {
    stat: 'item_maxdamage_perlevel',
    op: 4,
    opParam: 3,
    descpriority: 125,
    descfunc: 19,
    descstrpos: 'ModStr1f',
    descstr2: 'increaseswithplaylevelX',
  },
  219: {
    stat: 'item_maxdamage_percent_perlevel',
    op: 5,
    opParam: 3,
    descpriority: 128,
    descfunc: 19,
    descstrpos: 'ModStr2j',
    descstr2: 'increaseswithplaylevelX',
  },
  302: { stat: 'kill_display', op: 2, descpriority: 10, descfunc: 3, descstrpos: 'killtracker' },
  375: { stat: 'item_mythicaldesc', descpriority: 330, descfunc: 23, descstrpos: 'mythicalitemdesc' },
};

const STRINGS: Record<string, string> = {
  ItemExpansiveChanc1: '%d%% Chance to Cast Level %d %s on Striking',
  ItemModifierClassSkill: '%+d to %s %s',
  ModStr1a: '%+d to Strength',
  ModStr1b: '%+d to Dexterity',
  ModStr1c: '%+d to Vitality',
  ModStr1d: '%+d to Energy',
  ModStr1f: '%+d to Maximum Damage to Attacks',
  ModStr1g: '%+d to Minimum Damage to Attacks',
  ModStr1i: '%+d Defense',
  ModStr1j: 'Fire Resist %+d%%',
  ModStr1k: 'Cold Resist %+d%%',
  ModStr1l: 'Lightning Resist %+d%%',
  ModStr1n: 'Poison Resist %+d%%',
  ModStr1o: '%+d to Maximum Fire Damage to Attacks',
  ModStr1p: '%+d to Minimum Fire Damage to Attacks',
  ModStr1s: '%+d to Maximum Cold Damage to Attacks',
  ModStr1t: '%+d to Minimum Cold Damage to Attacks',
  ModStr1u: '%+d to Life',
  ModStr2j: '%+d%% Enhanced Maximum Damage',
  ModStr2k: '%+d%% Enhanced Minimum Damage',
  ModStr3a: '%+d to Amazon Skill Levels',
  ModStr4h: '%+d to Maximum Poison Damage to Attacks',
  ModStr4i: '%+d to Minimum Poison Damage to Attacks',
  ModStr4v: '%+d%% Faster Cast Rate',
  ModStre10d: 'Level %d %s (%d/%d Charges)',
  Moditem2allattrib: '%+d to All Attributes',
  Modstr2v: '%+d%% Enhanced Defense',
  StrSklTabItem1: '%+d to Javelin and Spear Skills',
  increaseswithplaylevelX: '(Based on Character Level)',
  killtracker: 'Kills:',
  mythicalitemdesc: '.%1%0',
  strModAllResistances: 'All Resists %+d',
  strModColdDamageRange: 'Adds %d-%d Cold Damage to Attacks',
  strModEnhancedDamage: '%+d%% Enhanced Damage',
  strModFireDamageRange: 'Adds %d-%d Fire Damage to Attacks',
  strModMinDamageRange: 'Adds %d-%d Damage to Attacks',
  strModPoisonDamageRange: 'Adds %d-%d Poison Damage to Attacks over %d seconds',
  strModMagicDamage: '%+d Magic Damage to Attacks',
  strModMagicDamageMin: '%+d Minimum Magic Damage to Attacks',
  strModMagicDamageMax: '%+d Maximum Magic Damage to Attacks',
  strModMagicDamageRange: 'Adds %d-%d Magic Damage to Attacks',
};

const cls = (name: string, tabs: [string, string, string]) => ({
  name,
  allSkills: `%+d to ${name} Skill Levels`,
  tabs,
  only: `(${name} Only)`,
});

const BUNDLE: ItemTextBundle = {
  stats: Array.from({ length: 400 }, (_, id) => STATS[id] ?? null),
  strings: STRINGS,
  skills: [
    { id: 9, name: 'Critical Strike', cls: 0 },
    { id: 36, name: 'Fire Bolt', cls: 1 },
    { id: 54, name: 'Teleport', cls: 1 },
    { id: 1555, name: 'Long Shot' },
    { id: 1557, name: 'Delirium Proc' },
  ],
  classes: [
    cls('Amazon', ['%+d to Bow and Crossbow Skills', '%+d to Passive and Magic Skills', '%+d to Javelin and Spear Skills']),
    cls('Sorceress', ['%+d to Fire Skills', '%+d to Lightning Skills', '%+d to Cold Skills']),
  ],
  monsters: [null, null, 'gain elemental\nIf your resists are equal,'],
  monTypes: [],
  magicPrefixes: [null, 'Shimmering'],
  magicSuffixes: [null, 'of the Fox'],
  autoAffixes: [null],
  rareNames: [null, 'Bite', 'Beast'],
  lowQuality: ['Crude', 'Cracked'],
  superior: 'Superior',
  setBonusPieces: { '7': [3, 5] },
  bases: {
    cap: { lvl: 3, gem: 1 },
    lsd: { d1: [3, 19], str: 55, dex: 39, lvl: 12 },
    gix: { d2: [10, 40], str: 80 },
    r01: { lvl: 11 },
    r02: { lvl: 13 },
    jav: { d1: [6, 14], dt: [6, 22], dex: 20 },
  },
  socketables: {
    // a rune: +ED in weapons, +strength in helms (gem apply type 1), +dexterity in shields
    r01: [
      [
        [17, 0, 15],
        [18, 0, 15],
      ],
      [[0, 0, 7]],
      [[2, 0, 4]],
    ],
    r02: [[[105, 0, 10]], [[105, 0, 10]], [[105, 0, 10]]],
  },
  levels: { uniques: [40, 0, 40], setItems: [3], magicPrefixes: [0, 20], magicSuffixes: [0, 0, 30], autoAffixes: [] },
};

const ctx = createItemTextContext(BUNDLE, catalog);
const s = (id: number, value: number, param = 0): StashStat => ({ id, param, value });
const lines = (...stats: StashStat[]) => renderItemText(makeItem('cap', { stats }), ctx).stats;
const values = (...stats: StashStat[]) => statValues(makeItem('amu', { stats }), ctx);
const value = (list: readonly StatValue[], key: string) => list.find((entry) => entry.key === key);

describe('item text names', () => {
  it('reads the name tables by the ids a save stores', () => {
    expect(ctx.hasText).toBe(true);
    expect(ctx.names.magicPrefix(1)).toBe('Shimmering');
    expect(ctx.names.magicPrefix(0)).toBeNull();
    expect(ctx.names.magicSuffix(1)).toBe('of the Fox');
    expect(ctx.names.magicSuffix(9)).toBeNull();
    expect(ctx.names.rareName(2)).toBe('Beast');
    expect(ctx.names.lowQuality(1)).toBe('Cracked');
    expect(ctx.names.superior).toBe('Superior');
  });

  it('gives one context per bundle and catalog (stable across renders)', () => {
    expect(itemTextContext(BUNDLE, catalog)).toBe(itemTextContext(BUNDLE, catalog));
    expect(itemTextContext(BUNDLE, stashCatalog(makeBundle({ sets: [] })))).not.toBe(itemTextContext(BUNDLE, catalog));
  });
});

describe('renderItemText from saved stats', () => {
  it('renders plain values unshifted, sorted by descpriority, with dgrp sets collapsed when equal', () => {
    expect(lines(s(7, 52), s(105, 20), s(0, 5))).toEqual(['+20% Faster Cast Rate', '+5 to Strength', '+52 to Life']);
    expect(lines(s(39, 19), s(41, 19), s(43, 19), s(45, 19))).toEqual(['All Resists +19']);
    expect(lines(s(39, 21), s(41, 21), s(43, 21), s(45, 49))).toEqual([
      'Cold Resist +21%',
      'Lightning Resist +21%',
      'Fire Resist +21%',
      'Poison Resist +49%',
    ]);
  });

  it('merges damage pairs and enhanced damage; cold without its duration, poison as totals', () => {
    expect(lines(s(48, 20), s(49, 45))).toEqual(['Adds 20-45 Fire Damage to Attacks']);
    expect(lines(s(54, 15), s(55, 40), s(56, 150))).toEqual(['Adds 15-40 Cold Damage to Attacks']);
    expect(lines(s(57, 307), s(58, 614), s(59, 50))).toEqual(['Adds 60-120 Poison Damage to Attacks over 2 seconds']);
    expect(lines(s(17, 100), s(18, 100))).toEqual(['+100% Enhanced Damage']);
  });

  it('folds the secondary (two-hand) damage into min / max damage, once per stat list', () => {
    // a list with both stores one property twice
    expect(lines(s(21, 10), s(23, 10))).toEqual(['+10 to Minimum Damage to Attacks']);
    // a two-hander stores it as secondary only
    expect(lines(s(23, 10), s(24, 20))).toEqual(['+10 to Minimum Damage to Attacks', '+20 to Maximum Damage to Attacks']);
  });

  it('unpacks event skills, charges, skill tabs, class skills and single skills', () => {
    // event: param skill << 6 | level, value = chance
    expect(lines(s(198, 10, (36 << 6) | 5))).toEqual(['10% Chance to Cast Level 5 Fire Bolt on Striking']);
    // charges: value = max << 8 | charges
    expect(lines(s(204, (10 << 8) | 8, (54 << 6) | 3))).toEqual(['Level 3 Teleport (8/10 Charges)']);
    // tab: class << 3 | tab (Sorceress Fire = 8)
    expect(lines(s(188, 2, (1 << 3) | 0))).toEqual(['+2 to Fire Skills (Sorceress Only)']);
    expect(lines(s(83, 1, 1))).toEqual(['+1 to Sorceress Skill Levels']);
    expect(lines(s(107, 3, 9))).toEqual(['+3 to Critical Strike (Amazon Only)']);
    // random class skills keep other bits above the 16-bit layer
    expect(lines(s(107, 2, 0x277c0000 | 36))).toEqual(['+2 to Fire Bolt (Sorceress Only)']);
    // event and charged params use all their bits: skill ids above 1023
    expect(lines(s(198, 5, (1555 << 6) | 20))).toEqual(['5% Chance to Cast Level 20 Long Shot on Striking']);
    expect(lines(s(204, (5 << 8) | 5, (1557 << 6) | 1))).toEqual(['Level 1 Delirium Proc (5/5 Charges)']);
  });

  it('writes per-level stats as fractions, hides descfunc 0 stats, keeps multi-line texts and unknown stats visible', () => {
    expect(lines(s(216, 20))).toEqual(['+2.5 to Life (Based on Character Level)']);
    expect(lines(s(97, 3, 36))).toEqual([]);
    expect(lines(s(375, 1, 2))).toEqual(['If your resists are equal,', 'gain elemental']);
    expect(lines(s(399, 4, 2))).toEqual(['Unknown stat 399 (2): 4']);
  });

  it('groups own, runeword, set bonus and socketed lines; runes give their gems.txt column', () => {
    const jewel = makeItem('jew', { stats: [s(0, 5)] });
    const rune = makeItem('r01', { compact: true, quality: null });
    const item = makeItem('cap', {
      quality: 'set',
      setId: 7,
      defense: 10,
      stats: [s(16, 50), s(31, 5)],
      runewordStats: [s(105, 10)],
      setBonusStats: [[s(0, 1)], [s(2, 2)]],
      socketed: [jewel, rune],
    });
    const groups = renderItemText(item, ctx);
    expect(groups.base).toEqual(['Defense: 20', 'Required Level: 11']);
    expect(groups.stats).toEqual(['+50% Enhanced Defense', '+5 Defense']);
    expect(groups.runeword).toEqual(['+10% Faster Cast Rate']);
    expect(groups.setBonuses).toEqual([
      { pieces: 3, lines: ['+1 to Strength'] },
      { pieces: 5, lines: ['+2 to Dexterity'] },
    ]);
    expect(groups.socketed).toEqual([
      { item: jewel, lines: ['+5 to Strength'] },
      { item: rune, lines: ['+7 to Strength'] },
    ]);
    // the socketed entries are the item's own socketed objects
    expect(groups.socketed[0]?.item).toBe(item.socketed[0]);
    expect(renderItemText(makeItem('cap', { quality: 'set', setId: 3, setBonusStats: [[s(0, 1)]] }), ctx).setBonuses[0]?.pieces).toBe(2);
  });
});

describe('statValues', () => {
  it('sums own, runeword and socketed jewel stats into one entry per key (not runes, not set bonuses)', () => {
    const item = makeItem('cap', {
      stats: [s(105, 10), s(105, 5)],
      runewordStats: [s(105, 20)],
      setBonusStats: [[s(105, 40)]],
      socketed: [makeItem('jew', { stats: [s(105, 15)] }), makeItem('r01', { compact: true, quality: null })],
    });
    const list = statValues(item, ctx);
    expect(list.filter((entry) => entry.key === 's105')).toEqual([
      {
        key: 's105',
        statKey: 's105',
        statId: 105,
        param: null,
        label: '+#% Faster Cast Rate',
        statLabel: '+#% Faster Cast Rate',
        paramLabel: null,
        value: 50,
      },
    ]);
  });

  it('keys named params by stat and param, with a shared param-free statLabel', () => {
    const list = values(s(107, 3, 9), s(107, 1, 36), s(83, 2, 1), s(188, 2, 8));
    expect(value(list, 's107.9')).toMatchObject({
      statKey: 's107',
      param: 9,
      label: '+# to Critical Strike (Amazon Only)',
      statLabel: '+# to [Skill] ([Class] Only)',
      paramLabel: 'Critical Strike',
      value: 3,
    });
    expect(value(list, 's107.36')?.statLabel).toBe(value(list, 's107.9')?.statLabel);
    expect(value(list, 's83.1')).toMatchObject({ label: '+# to Sorceress Skill Levels', paramLabel: 'Sorceress', value: 2 });
    expect(value(list, 's188.8')).toMatchObject({
      label: '+# to Fire Skills (Sorceress Only)',
      statLabel: '+# to [Skill Tab] ([Class] Only)',
      paramLabel: 'Fire Skills',
    });
  });

  it('gives event skills and charges the skill level as value, keyed by skill', () => {
    const list = values(s(198, 10, (36 << 6) | 5), s(198, 25, (36 << 6) | 7), s(204, (10 << 8) | 8, (54 << 6) | 3));
    expect(value(list, 's198.36')).toMatchObject({
      label: 'Chance to Cast Level # Fire Bolt on Striking',
      statLabel: 'Chance to Cast Level # [Skill] on Striking',
      value: 7,
    });
    expect(value(list, 's204.54')).toMatchObject({ label: 'Level # Teleport (Charges)', value: 3 });
    const high = values(s(198, 5, (1555 << 6) | 20), s(204, (5 << 8) | 5, (1557 << 6) | 1));
    expect(value(high, 's198.1555')).toMatchObject({ param: 1555, paramLabel: 'Long Shot', value: 20 });
    expect(value(high, 's204.1557')).toMatchObject({ param: 1557, paramLabel: 'Delirium Proc', value: 1 });
  });

  it("adds a socketed jewel's max damage to a two-hander's secondary max damage, also in g.dmg-phys", () => {
    const item = makeItem('cap', { stats: [s(23, 10), s(24, 20)], socketed: [makeItem('jew', { stats: [s(22, 5)] })] });
    const list = statValues(item, ctx);
    expect(value(list, 's21')?.value).toBe(10);
    expect(value(list, 's22')?.value).toBe(25);
    expect(value(list, 's23')).toBeUndefined();
    expect(value(list, 'g.dmg-phys')).toMatchObject({ label: 'Adds #-# Damage to Attacks', value: 25, range: { min: 10, max: 25 } });
  });

  it('has no dgrp entry that repeats a damage range (magic damage: g.dmg-magic only)', () => {
    const list = values(s(52, 5), s(53, 9));
    expect(list.map((entry) => entry.key)).toEqual(['s52', 's53', 'g.dmg-magic']);
    expect(value(list, 'g.dmg-magic')).toMatchObject({ label: 'Adds #-# Magic Damage to Attacks', range: { min: 5, max: 9 } });
  });

  it('adds group entries when every member is there: dgrp sets (smallest value), damage ranges, enhanced damage', () => {
    const list = values(
      s(39, 30),
      s(41, 20),
      s(43, 25),
      s(45, 40),
      s(48, 10),
      s(49, 20),
      s(57, 256),
      s(58, 512),
      s(59, 50),
      s(17, 30),
      s(18, 30)
    );
    expect(value(list, 'g.allres')).toMatchObject({ statId: null, label: 'All Resists +#', value: 20 });
    expect(value(list, 's39')?.value).toBe(30);
    expect(value(list, 'g.dmg-fire')).toMatchObject({ label: 'Adds #-# Fire Damage to Attacks', value: 20, range: { min: 10, max: 20 } });
    expect(value(list, 'g.dmg-pois')).toMatchObject({
      label: 'Adds #-# Poison Damage to Attacks',
      value: 100,
      range: { min: 50, max: 100 },
    });
    expect(value(list, 'g.ed')).toMatchObject({ label: '+#% Enhanced Damage', value: 30 });
    expect(value(values(s(39, 30), s(41, 20)), 'g.allres')).toBeUndefined();
    expect(value(values(s(0, 5), s(1, 5), s(2, 5), s(3, 4)), 'g.allattr')?.value).toBe(4);
  });

  it('marks per-level values (label without the descstr2), skips hidden and text-only stats, keeps keys URL-safe', () => {
    expect(values(s(216, 20), s(97, 3, 36), s(375, 1, 2), s(56, 100))).toEqual([
      {
        key: 's216',
        statKey: 's216',
        statId: 216,
        param: null,
        label: '+# to Life',
        statLabel: '+# to Life',
        paramLabel: null,
        value: 2.5,
        perLevel: true,
      },
    ]);
    const all = values(s(107, 3, 9), s(198, 10, (36 << 6) | 5), s(39, 1), s(41, 1), s(43, 1), s(45, 1), s(48, 1), s(49, 2));
    for (const entry of all) expect(entry.key).toMatch(/^[A-Za-z0-9.-]+$/);
  });
});

describe('socket fillers, damage and requirements', () => {
  const rune = (code: string) => makeItem(code, { compact: true, quality: null });

  it("gives a rune's gems.txt column by the parent's gem apply type, on runeword items too, and sums it", () => {
    const sword = makeItem('lsd', { runewordId: 1, runewordStats: [s(105, 20)], socketed: [rune('r01'), rune('r02')] });
    const groups = renderItemText(sword, ctx);
    expect(groups.socketed.map((entry) => entry.lines)).toEqual([['+15% Enhanced Damage'], ['+10% Faster Cast Rate']]);
    const list = statValues(sword, ctx);
    expect(value(list, 's105')?.value).toBe(30);
    expect(value(list, 'g.ed')?.value).toBe(15);
    // helm column (cap: gem apply type 1), weapon column for a code without a type
    expect(statValues(makeItem('cap', { socketed: [rune('r01')] }), ctx).find((entry) => entry.key === 's0')?.value).toBe(7);
    expect(renderItemText(makeItem('amu', { socketed: [rune('r01')] }), ctx).socketed[0]?.lines).toEqual(['+15% Enhanced Damage']);
  });

  it('writes weapon damage with ethereal, enhanced damage and + damage, in tooltip order with the requirements', () => {
    const sword = makeItem('lsd', { stats: [s(17, 100), s(18, 50), s(21, 2), s(22, 5)], maxDurability: 44, durability: 40 });
    expect(renderItemText(sword, ctx).base).toEqual([
      'One-Hand Damage: 6 to 43',
      'Durability: 40 of 44',
      'Required Dexterity: 39',
      'Required Strength: 55',
      'Required Level: 12',
    ]);
    // ethereal: base ×1.5, requirements −10
    expect(renderItemText(makeItem('lsd', { ethereal: true }), ctx).base).toEqual([
      'One-Hand Damage: 4 to 28',
      'Required Dexterity: 29',
      'Required Strength: 45',
      'Required Level: 12',
      'Ethereal (Cannot be Repaired)',
    ]);
    // two-hand only, a socketed jewel's + max damage on a two-hander's secondary damage, requirements −20%
    const giant = makeItem('gix', { stats: [s(24, 10), s(91, -20)], socketed: [makeItem('jew', { stats: [s(22, 5)] })] });
    expect(renderItemText(giant, ctx).base).toEqual(['Two-Hand Damage: 10 to 55', 'Required Strength: 64']);
    const list = statValues(giant, ctx);
    expect(value(list, 'b.dmg2')).toMatchObject({ label: 'Two-Hand Damage: # to #', value: 55, range: { min: 10, max: 55 } });
    expect(value(list, 'b.reqstr')).toMatchObject({ label: 'Required Strength: #', value: 64 });
    // throwing weapons: Throw Damage above One-Hand Damage, as in D2's tooltip
    expect(renderItemText(makeItem('jav'), ctx).base).toEqual([
      'Throw Damage: 6 to 22',
      'One-Hand Damage: 6 to 14',
      'Required Dexterity: 20',
    ]);
    // a max below the min reads min + 1
    expect(renderItemText(makeItem('lsd', { stats: [s(21, 30)] }), ctx).base[0]).toBe('One-Hand Damage: 33 to 34');
  });

  it('takes the highest required level of the base, unique, affixes and sockets, plus crafted and + level stats', () => {
    const level = (item: Parameters<typeof makeItem>[1]) => value(statValues(makeItem('cap', item), ctx), 'b.reqlvl')?.value;
    expect(level({})).toBe(3);
    expect(level({ quality: 'unique', uniqueId: 2 })).toBe(40);
    expect(level({ quality: 'magic', prefixIds: [1], suffixIds: [2] })).toBe(30);
    expect(level({ socketed: [rune('r02')] })).toBe(13);
    expect(level({ stats: [s(92, 5)] })).toBe(8);
    // unique / set item ids are 0-based rows: id 0 is a real row
    expect(level({ quality: 'unique', uniqueId: 0 })).toBe(40);
    expect(value(statValues(makeItem('amu', { quality: 'set', setId: 0 }), ctx), 'b.reqlvl')?.value).toBe(3);
    // crafted: the affix level + 10 + 3 per affix, then the sockets
    expect(level({ quality: 'crafted', prefixIds: [1, 0, 0], suffixIds: [0, 0, 0] })).toBe(33);
    expect(level({ quality: 'crafted', prefixIds: [1, 0, 0], suffixIds: [0, 0, 0], socketed: [rune('r02')] })).toBe(33);
    expect(
      value(
        statValues(
          makeItem('amu', {
            quality: 'crafted',
            prefixIds: [1, 0, 0],
            suffixIds: [0, 0, 0],
            socketed: [makeItem('jew', { level: 1, quality: 'magic', prefixIds: [1] })],
          }),
          ctx
        ),
        'b.reqlvl'
      )?.value
    ).toBe(33);
    // a socketed jewel's + required level counts once, on the jewel
    const jewel = makeItem('jew', { stats: [s(92, 5)], quality: 'magic', prefixIds: [1] });
    expect(level({ socketed: [jewel] })).toBe(25);
    expect(level({ stats: [s(92, 2)], socketed: [jewel] })).toBe(25);
    expect(level({ stats: [s(92, 30)], socketed: [jewel] })).toBe(33);
    expect(value(statValues(makeItem('cap', { defense: 10, stats: [s(31, 5)] }), ctx), 'b.def')?.value).toBe(15);
  });
});

describe('item text at a character level', () => {
  const atLevel = (characterLevel: number) => ({ characterLevel });

  it('shows a per-level stat at the level, in integer arithmetic, and the rate without one', () => {
    const item = makeItem('cap', { stats: [s(216, 5)] });
    expect(renderItemText(item, ctx).stats).toEqual(['+0.625 to Life (Based on Character Level)']);
    // 5 / 8 × 102 = 63.75: the game truncates
    expect(renderItemText(item, ctx, atLevel(102)).stats).toEqual(['+63 to Life (Based on Character Level)']);
    expect(renderItemText(item, ctx, atLevel(1)).stats).toEqual(['+0 to Life (Based on Character Level)']);
  });

  it('leaves op-2 stats that are not per character level alone (kill_display)', () => {
    const item = makeItem('cap', { stats: [s(302, 3)] });
    expect(renderItemText(item, ctx, atLevel(99)).stats).toEqual(renderItemText(item, ctx).stats);
  });

  it('adds per-level max damage to the damage line: enhanced % of the base, then flat', () => {
    // Thunder Star's numbers: 74 base max, +97 flat, stored rate 3 (24 / 8) at level 102
    const bases = { ...BUNDLE.bases, flail: { d1: [25, 74] as [number, number] } };
    const star = createItemTextContext({ ...BUNDLE, bases }, catalog);
    const item = makeItem('flail', { stats: [s(22, 97), s(219, 24)] });
    expect(renderItemText(item, star).base[0]).toBe('One-Hand Damage: 25 to 171');
    const leveled = renderItemText(item, star, atLevel(102));
    expect(leveled.base[0]).toBe('One-Hand Damage: 25 to 397');
    expect(leveled.stats).toContain('+306% Enhanced Maximum Damage (Based on Character Level)');
    // flat per level: 24 / 8 × 10 = 30
    expect(renderItemText(makeItem('flail', { stats: [s(218, 24)] }), star, atLevel(10)).base[0]).toBe('One-Hand Damage: 25 to 104');
  });

  it('adds per-level defense (percent of the base, then flat), and does nothing without a level', () => {
    const item = makeItem('cap', { defense: 100, stats: [s(215, 8), s(214, 16)] });
    expect(renderItemText(item, ctx).base[0]).toBe('Defense: 100');
    // 10% enhanced + 20 flat at level 10
    expect(renderItemText(item, ctx, atLevel(10)).base[0]).toBe('Defense: 130');
  });

  it('applies to runeword stats, set bonuses and socketed jewels too', () => {
    const jewel = makeItem('jew', { stats: [s(216, 8)] });
    const item = makeItem('cap', { runewordStats: [s(216, 16)], setBonusStats: [[s(216, 8)]], socketed: [jewel] });
    const text = renderItemText(item, ctx, atLevel(10));
    expect(text.runeword).toEqual(['+20 to Life (Based on Character Level)']);
    expect(text.setBonuses[0]?.lines).toEqual(['+10 to Life (Based on Character Level)']);
    expect(text.socketed[0]?.lines).toEqual(['+10 to Life (Based on Character Level)']);
  });
});
