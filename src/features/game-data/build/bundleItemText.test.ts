import { describe, expect, it } from 'vitest';
import { buildItemTextBundle, RARE_PREFIX_KEYS, RARE_SUFFIX_KEYS, statStringKeys } from './bundleItemText.ts';
import { TEST_STRINGS, testTables } from './stats/testContext.mock.ts';
import { parseTsv } from './tsv.ts';

const tsv = (rows: string[][]) => parseTsv(rows.map((row) => row.join('\t')).join('\n'), 'test', { keepExpansionRows: true });

const STAT_HEADER = ['Stat', 'Save Bits', 'op', 'op param', 'descpriority', 'descfunc', 'descval', 'descstrpos', 'descstrneg', 'descstr2'];
const DGRP_HEADER = ['dgrp', 'dgrpfunc', 'dgrpstrpos', 'dgrpstrneg', 'dgrpval', 'dgrpstr2'];

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
    expect(bundle.stats).toHaveLength(6);
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
});
