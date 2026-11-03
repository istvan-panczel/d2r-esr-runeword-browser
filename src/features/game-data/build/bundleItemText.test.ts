import { describe, expect, it } from 'vitest';
import { buildItemTextBundle, RARE_PREFIX_KEYS, RARE_SUFFIX_KEYS, statStringKeys } from './bundleItemText.ts';
import { throwableTypes } from './itemTextBases.ts';
import { TEST_STRINGS, testTables } from './stats/testContext.mock.ts';
import { parseTsv } from './tsv.ts';

const tsv = (rows: string[][]) => parseTsv(rows.map((row) => row.join('\t')).join('\n'), 'test', { keepExpansionRows: true });

const STAT_HEADER = ['Stat', 'Save Bits', 'op', 'op param', 'descpriority', 'descfunc', 'descval', 'descstrpos', 'descstrneg', 'descstr2'];
const DGRP_HEADER = ['dgrp', 'dgrpfunc', 'dgrpstrpos', 'dgrpstrneg', 'dgrpval', 'dgrpstr2'];

const BASES = {
  itemtypes: tsv([
    ['ItemType', 'Code', 'Equiv1', 'Equiv2', 'Throwable'],
    ['Weapon', 'weap', '', '', '0'],
    ['Throwing Weapon', 'thro', 'weap', '', '1'],
    ['Combo Weapon', 'comb', 'thro', '', '1'],
    ['Throwing Knife', 'tkni', 'comb', '', '1'],
    ['Sword', 'swor', 'weap', '', '0'],
    ['Wand', 'wand', 'weap', '', '0'],
  ]),
  weapons: tsv([
    [
      'code',
      'type',
      'mindam',
      'maxdam',
      '1or2handed',
      '2handed',
      '2handmindam',
      '2handmaxdam',
      'minmisdam',
      'maxmisdam',
      'reqstr',
      'reqdex',
      'levelreq',
      'gemapplytype',
    ],
    ['ssd', 'swor', '2', '7', '0', '0', '', '', '', '', '', '', '', '0'],
    ['bsd', 'swor', '7', '14', '1', '0', '13', '30', '', '', '47', '', '', '0'],
    ['2hs', 'swor', '', '', '0', '1', '8', '17', '', '', '35', '27', '', '0'],
    ['tkf', 'tkni', '2', '3', '0', '0', '', '', '4', '9', '', '21', '', '0'],
    // ESR fills maxmisdam on some wands: not throwable, so no throw damage
    ['wnd', 'wand', '2', '4', '0', '0', '', '', '', '63', '', '', '', '1'],
  ]),
  armor: tsv([
    ['code', 'reqstr', 'levelreq', 'gemapplytype'],
    ['cap', '', '', '1'],
    ['uap', '50', '62', '1'],
  ]),
  misc: tsv([
    ['code', 'levelreq', 'gemapplytype'],
    ['r01', '11', '0'],
    ['elx', '', '0'],
  ]),
  gems: tsv([
    [
      'name',
      'code',
      ...['weapon', 'helm', 'shield'].flatMap((column) =>
        [1, 2, 3].flatMap((i) => ['Code', 'Param', 'Min', 'Max'].map((part) => `${column}Mod${String(i)}${part}`))
      ),
    ],
    [
      'El Rune',
      'r01',
      'str',
      '',
      '5',
      '5',
      'hit-skill',
      'Fire Bolt',
      '10',
      '3',
      '',
      '',
      '',
      '',
      'dex',
      '',
      '2',
      '2',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      'each',
      '',
      '1',
      '1',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
    ],
  ]),
  uniqueitems: tsv([
    ['index', 'lvl req'],
    ['A', '5'],
    ['B', ''],
  ]),
};

function build(strings: ReadonlyMap<string, string> = TEST_STRINGS) {
  return buildItemTextBundle(
    {
      itemstatcost: tsv([
        [...STAT_HEADER, ...DGRP_HEADER],
        ['strength', '14', '', '', '67', '19', '', 'ModStr1a', 'ModStr1a', '', '1', '19', 'Moditem2allattrib', 'Moditem2allattrib'],
        ['hitpoints', '', '', '', '', '', '', 'ModStr1u', '', '', '', '', '', ''],
        ['item_maxdamage_perlevel', '12', '4', '3', '125', '19', '', 'ModStr1f', '', 'increaseswithplaylevelX', '', '', '', ''],
        ['item_mythicaldesc', '12', '', '', '330', '23', '', 'mythicalitemdesc', '', '', '', '', '', ''],
        ['item_missingdesc', '7', '', '', '1', '19', '', 'NoSuchKey', '', '', '', '', '', ''],
        ['coldlength', '16', '', '', '', '', '', '', '', '', '', '', '', ''],
        ['dexterity', '14', '', '', '65', '19', '', 'ModStr1b', '', '', '', '', '', ''],
        ['item_skillonhit', '16', '', '', '160', '15', '', 'ItemExpansiveChanc1', '', '', '', '', '', ''],
        ['fireresist', '12', '', '', '36', '19', '', 'ModStr1j', '', '', '', '', '', ''],
      ]),
      magicprefix: tsv([
        ['Name', 'version'],
        ['ModStr1a', '0'],
        ['', '0'],
        ['Sturdy', '0'],
        ['null', '0'],
      ]),
      magicsuffix: tsv([['Name'], ['of the Fox']]),
      automagic: tsv([['Name'], ['Fine']]),
      setitems: tsv([
        ['index', 'aprop1a', 'aprop1b', 'aprop2a', 'aprop2b', 'aprop3a', 'aprop3b', 'aprop4a', 'aprop4b', 'aprop5a', 'aprop5b'],
        ['Plain', 'str', '', 'dex', '', '', '', '', '', '', ''],
        ['Gapped', '', '', 'str', '', '', '', 'dex', '', '', ''],
      ]),
      statTables: testTables(),
      skillIds: [0],
      bases: BASES,
      mods: [
        { code: 'mythicaldesc', param: '2' },
        { code: 'mythicaldesc', param: 'skeleton1' },
        { code: 'str', param: null },
      ],
    },
    strings
  );
}

describe('buildItemTextBundle', () => {
  it('keeps the display columns of the saved stats only, without blank or default columns', () => {
    const { bundle } = build();
    expect(bundle.stats).toHaveLength(9);
    expect(bundle.stats[0]).toEqual({
      stat: 'strength',
      descpriority: 67,
      descfunc: 19,
      descstrpos: 'ModStr1a',
      dgrp: 1,
      dgrpfunc: 19,
      dgrpstrpos: 'Moditem2allattrib',
    });
    expect(bundle.stats[1]).toBeNull();
    expect(bundle.stats[2]).toEqual({
      stat: 'item_maxdamage_perlevel',
      op: 4,
      opParam: 3,
      descpriority: 125,
      descfunc: 19,
      descstrpos: 'ModStr1f',
      descstr2: 'increaseswithplaylevelX',
    });
    // hidden stats keep their name (renderLines pairs coldlength with the cold damage)
    expect(bundle.stats[5]).toEqual({ stat: 'coldlength' });
  });

  it('carries the strings the stat descriptions and renderLines read, and warns about missing keys', () => {
    const { bundle, warnings } = build();
    const keys = bundle.stats.flatMap((def) => (def === null ? [] : statStringKeys(def)));
    for (const key of keys.filter((entry) => entry !== 'NoSuchKey')) expect(bundle.strings[key], key).toBe(TEST_STRINGS.get(key));
    expect(bundle.strings.strModFireDamageRange).toBe('Adds %d-%d Fire Damage to Attacks');
    expect(bundle.strings.strModEnhancedDamage).toBe('%+d%% Enhanced Damage');
    // the unsaved stat's string is not needed
    expect(bundle.strings.ModStr1u).toBeUndefined();
    expect(warnings).toContain('itemtext: string "NoSuchKey" (stat description) not found');
  });

  it('lists the class skills and the given skill ids, and the class strings', () => {
    const { bundle } = build();
    expect(bundle.skills).toEqual([
      { id: 0, name: 'Attack' },
      { id: 1, name: 'Critical Strike', cls: 0 },
      { id: 2, name: 'Fire Bolt', cls: 1 },
      { id: 3, name: 'Teleport', cls: 1 },
    ]);
    expect(bundle.classes.map((cls) => cls.name)).toEqual(['Amazon', 'Sorceress']);
    expect(bundle.classes[1]).toMatchObject({ allSkills: '%+d to Sorceress Skill Levels', only: '(Sorceress Only)' });
  });

  it('keeps the monster texts a descfunc 23 property names by id, and warns about names', () => {
    const { bundle, warnings } = build();
    expect(bundle.monsters).toEqual([null, null, 'second line\nFirst line']);
    expect(warnings).toContain('itemtext: property "mythicaldesc skeleton1" names a monster by name, not by id');
    expect(bundle.monTypes).toEqual([null, 'Undead']);
  });

  it('names magic affixes by 1-based id like affixes.json (string, else the raw name; blank and "null" are null)', () => {
    const { bundle } = build();
    expect(bundle.magicPrefixes).toEqual([null, '%+d to Strength', null, 'Sturdy', null]);
    expect(bundle.magicSuffixes).toEqual([null, 'of the Fox']);
    expect(bundle.autoAffixes).toEqual([null, 'Fine']);
  });

  it('writes the vanilla rare name table: suffixes 1-155, prefixes 156-201', () => {
    expect(RARE_SUFFIX_KEYS).toHaveLength(155);
    expect(RARE_PREFIX_KEYS).toHaveLength(46);
    const strings = new Map([...[...RARE_SUFFIX_KEYS, ...RARE_PREFIX_KEYS].map((key) => [key, key.toUpperCase()] as const)]);
    const { bundle, warnings } = build(new Map([...TEST_STRINGS, ...strings, ['Hiquality', 'Superior'], ['Cracked', 'Cracked']]));
    expect(bundle.rareNames).toHaveLength(202);
    expect(bundle.rareNames[0]).toBeNull();
    expect([bundle.rareNames[1], bundle.rareNames[155], bundle.rareNames[156], bundle.rareNames[201]]).toEqual([
      'BITE',
      'FLANGE',
      'BEAST',
      'CORRUPTION',
    ]);
    expect(warnings.filter((warning) => warning.includes('rare name'))).toEqual([]);
    expect(bundle.superior).toBe('Superior');
    expect(bundle.lowQuality).toEqual(['Crude', 'Cracked', 'Damaged', 'Low Quality']);
    expect(build().warnings).toContain('itemtext: rare name "bite" not found');
  });

  it('lists set bonus pieces only for set items whose bonus groups are not 2, 3, 4…', () => {
    expect(build().bundle.setBonusPieces).toEqual({ '1': [3, 5] });
  });

  it('writes the base damage, requirements and gem apply types as the tooltip shows them', () => {
    const { bases } = build().bundle;
    expect(bases.ssd).toEqual({ d1: [2, 7] });
    expect(bases.bsd).toEqual({ d1: [7, 14], d2: [13, 30], str: 47 });
    // two-handed only: no one-hand line
    expect(bases['2hs']).toEqual({ d2: [8, 17], str: 35, dex: 27 });
    expect(bases.tkf).toEqual({ d1: [2, 3], dt: [4, 9], dex: 21 });
    expect(bases.wnd).toEqual({ d1: [2, 4], gem: 1 });
    expect([...throwableTypes(BASES.itemtypes)].sort()).toEqual(['comb', 'thro', 'tkni']);
    expect(bases.uap).toEqual({ str: 50, lvl: 62, gem: 1 });
    expect(bases.r01).toEqual({ lvl: 11 });
    expect(bases.elx).toBeUndefined();
  });

  it('writes the socket fillers per gems.txt column as saved stats, property groups resolved', () => {
    const { bundle, warnings } = build();
    // weapon: str 5 + hit-skill Fire Bolt (skill 2) 10% level 3 → param skill << 6 | level, value = chance
    // helm: dex 2; shield: the "each" group = str 3 + fire resist 10
    expect(bundle.socketables.r01).toEqual([
      [
        [0, 0, 5],
        [7, (2 << 6) | 3, 10],
      ],
      [[6, 0, 2]],
      [
        [0, 0, 3],
        [8, 0, 10],
      ],
    ]);
    expect(warnings.filter((warning) => warning.includes('gems'))).toEqual([]);
  });

  it('lists the required levels by the ids a save stores', () => {
    const { levels } = build().bundle;
    expect(levels.uniques).toEqual([5, 0]);
    // 1-based affix ids; the mock tables have no levelreq column
    expect(levels.magicPrefixes).toEqual([0, 0, 0, 0, 0]);
  });
});
