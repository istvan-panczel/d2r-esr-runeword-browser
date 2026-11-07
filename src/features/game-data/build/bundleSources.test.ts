import { describe, it, expect } from 'vitest';
import type { ItemSource } from '../engine/schema.ts';
import { buildSourcesBundle, type SourceTables } from './bundleSources.ts';
import { displayName } from './itemNames.ts';
import { readBossSetRules, readBossSetUniqueDrops } from './pluginUniques.ts';
import { parseTsv } from './tsv.ts';

const table = (rows: string[][]) => parseTsv(rows.map((row) => row.join('\t')).join('\n'));

const ITEM_COLUMNS = ['name', 'code', 'namestr', 'type', 'spawnable', 'normcode', 'ubercode', 'ultracode', 'GheedMin', 'GheedMax'];
const monsterIds = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6'];

const tables: SourceTables = {
  weapons: table([
    ITEM_COLUMNS,
    ['Hand Axe', 'hax', 'hax', 'axe', '1', 'hax', '9ha', '7ha', '', ''],
    ['Hatchet', '9ha', '9ha', 'axe', '1', 'hax', '9ha', '7ha', '', ''],
    ['Mythical Wand', 'm04', 'm04', 'wand', '1', '', '', '', '', ''],
    ['Death Blade', 'dd1', 'dd1', 'swor', '0', '', '', '', '', ''],
  ]),
  armor: table([ITEM_COLUMNS]),
  misc: table([
    ITEM_COLUMNS,
    ['Small Charm', 'cm1', 'cm1', 'scha', '1', '', '', '', '', ''],
    ['Coupon nor Armor 1', '01c', '01c', 'cpn1', '1', '', '', '', '', ''],
    ['Coupon Wild Card', '99j', '99j', 'cpn1', '1', '', '', '', '', ''],
    ['Material', 'mat', 'mat', 'body', '1', '', '', '', '', ''],
    ['Orb', 'orb', 'orb', 'cube', '1', '', '', '', '', ''],
    ['Hammer', 'hh2', 'hh2', 'dstn', '1', '', '', '', '', ''],
    ['Donut', 'sdo', 'sdo', 'cube', '1', '', '', '', '0', '1'],
    ['Healing Potion', 'hp1', 'hp1', 'hpot', '1', '', '', '', '', ''],
    ['Mana Potion', 'mp1', 'mp1', 'mpot', '1', '', '', '', '', '2'],
    ['Unused', 'zzz', 'zzz', 'misc', '1', '', '', '', '', ''],
    ['Big Ruby', 'grb', 'grb', 'gemr', '1', '', '', '', '', ''],
    ['Essence', 'ess', 'ess', 'ques', '1', '', '', '', '', ''],
  ]),
  uniqueitems: table([
    ['index', 'disabled', 'spawnable', 'rarity', 'lvl', 'code'],
    ['Pelta', '', '1', '0', '10', 'hax'],
    ['Basher', '', '1', '1', '4', 'hax'],
    ['Mephisto', '', '1', '3', '100', 'm04'],
    ['Frost', '', '1', '1', '100', 'dd1'],
    ['Anni', '', '1', '0', '99', 'cm1'],
    ['Torch', '', '', '1', '75', 'cm1'],
    ['Lost', '', '', '0', '1', 'cm1'],
    ['Gone', '1', '1', '1', '1', 'hax'],
    // Same display names as Pelta / Basher: merged into the first entry
    ['Pelta LoD', '', '1', '1', '10', '9ha'],
    ['Basher Old', '', '', '0', '1', 'hax'],
    ['', '', '1', '1', '1', 'hax'],
  ]),
  setitems: table([
    ['index', 'disabled', 'spawnable', 'lvl', 'item'],
    ['Set Axe', '', '1', '10', 'hax'],
  ]),
  cubemain: table([
    ['description', 'enabled', 'input 1', 'input 2', 'output', 'output b'],
    ['Coupon', '1', '"01c,qty=3"', '', 'Pelta', ''],
    ['Reroll', '1', 'Basher', 'gpr', 'Basher', ''],
    ['Disabled', '0', 'gpr', '', 'Anni', ''],
    ['Hammer', '1', 'mat', '', '"hh2,qty=2"', ''],
    ['Gem upgrade', '1', 'gpr', '99j', 'grb', ''],
    ['Potion', '1', 'hp1', '', 'sdo', ''],
  ]),
  treasureclassex: table([
    ['Treasure Class', 'Item1', 'Item2', 'Item3'],
    ['Lich TC', 'Frost', '', ''],
    ['ROP (H)', 'Anni', 'Set Axe', ''],
    ['Materials', 'mat', 'weap96', ''],
    ['Act Junk', 'Materials', '', ''],
    ['Hammer TC', 'hh2', '', ''],
    ['Orb Tier 1', 'orb', '', ''],
    ['EGM Boss', 'Orb Tier 1', '', ''],
    ['Uber Lucion Unique', 'ess', '', ''],
  ]),
  monstats: table([
    ['Id', 'NameStr', 'TreasureClass', 'TreasureClass(H)'],
    ['lich', 'TheLichKing', 'Lich TC', ''],
    ['diabloclone', 'Diablo', '', 'ROP (H)'],
    // Uber Lucion's loot dummy reuses Diablo's name string
    ['extralucionloot', 'Diablo', '', 'Uber Lucion Unique'],
    ...monsterIds.map((id) => [id, id, 'Act Junk', '']),
    ...monsterIds.map((id) => [`map${id}`, `map${id}`, '', 'EGM Boss']),
  ]),
  superuniques: table([
    ['Superunique', 'Name', 'TC', 'TC(H)'],
    ['Bloodwitch', 'Bloodwitch the Wild', 'Hammer TC', ''],
  ]),
  gamble: table([
    ['name', 'code'],
    ['Hatchet', '9ha'],
  ]),
};

const strings = new Map([
  ['TheLichKing', 'The Lich King'],
  ['Diablo', 'Diablo'],
  ['Pelta', 'Pelta Lunata'],
  ['Pelta LoD', 'Pelta Lunata'],
  ['Basher Old', 'Basher'],
  ['Set Axe', 'Basher'],
  ['01c', '(Buckler, Pelta Lunata)\nAncient Coupon'],
  ['Bloodwitch the Wild', 'Bloodwitch the Wild'],
]);

const PLUGIN = `[boss_set_unique_drop]
enabled = true
[[boss_set_unique_drop.rule]]
monsters = [704, 705, 709]
unique = "Torch"
`;

const { bundle, miscLabels } = buildSourcesBundle(tables, strings, PLUGIN);
const texts = (name: string) => bundle.items.find((item: ItemSource) => item.name === name)?.labels.map((label) => label.text);

describe('buildSourcesBundle', () => {
  it('merges entries sharing kind and name: first code, label union in precedence order, Unknown dropped', () => {
    const pelta = bundle.items.filter((item) => item.name === 'Pelta Lunata');
    expect(pelta).toHaveLength(1);
    expect(pelta[0]?.code).toBe('hax');
    expect(pelta[0]?.labels.map((entry) => entry.text)).toEqual(['Cube: Ancient Coupon', 'Drops (random)', 'Gamble']);
    // "Basher Old" alone would be Unknown; Basher is a random drop + gamble (base family in gamble.txt), its cube reroll ignored
    expect(bundle.items.filter((item) => item.name === 'Basher' && item.item === 'unique')).toHaveLength(1);
    expect(texts('Basher')).toEqual(['Drops (random)', 'Gamble']);
  });

  it('keeps entries sharing a name across kinds separate', () => {
    expect(bundle.items.filter((item) => item.name === 'Basher').map((item) => item.item)).toEqual(['unique', 'set']);
  });

  it('labels level ≥ 100 uniques as endgame-map drops', () => {
    expect(texts('Mephisto')).toEqual(['Drops in Endgame Maps']);
  });

  it('labels uniques named in a few monsters’ treasure classes as boss drops, bypassing rarity', () => {
    expect(texts('Frost')).toEqual(['Drops from The Lich King']);
    expect(texts('Anni')).toEqual(['Drops from Diablo Clone']);
    expect(texts('Essence')).toEqual(['Drops from Uber Lucion (players 8)']);
  });

  it('labels plugin uniques and falls back to Unknown', () => {
    expect(texts('Torch')).toEqual(['Boss drop (launcher plugin)']);
    expect(texts('Lost')).toEqual(['Unknown']);
  });

  it('skips disabled and unnamed unique rows', () => {
    expect(texts('Gone')).toBeUndefined();
    expect(bundle.items.filter((item) => item.item === 'unique')).toHaveLength(7);
  });

  it('labels set items as random drops plus their named treasure classes', () => {
    expect(bundle.items.find((item) => item.item === 'set')).toEqual({
      name: 'Basher',
      code: 'hax',
      item: 'set',
      labels: [
        { kind: 'boss', text: 'Drops from Diablo Clone' },
        { kind: 'drop', text: 'Drops (random)' },
      ],
    });
  });

  it('labels misc by monster count: boss (≤ 5, superuniques included), maps (map monsters only), drop', () => {
    expect(texts('Hammer')).toEqual(['Cube', 'Drops from Bloodwitch the Wild']);
    expect(texts('Orb')).toEqual(['Drops in Endgame Maps']);
    expect(texts('Material')).toEqual(['Drops (random)']);
  });

  it('labels vendors and does not treat the Wild Card as an Ancient Coupon', () => {
    expect(texts('Donut')).toEqual(['Cube', 'Buy: Gheed']);
    expect(texts('Big Ruby')).toEqual(['Cube']);
  });

  it('keeps only misc referenced by the cube, a vendor or a treasure class, without potions', () => {
    // cm1 is only a unique base here; hp1 is a potion; zzz is referenced nowhere
    expect(bundle.items.filter((item) => item.item === 'misc').map((item) => item.code)).toEqual([
      '01c',
      '99j',
      'mat',
      'orb',
      'hh2',
      'sdo',
      'grb',
      'ess',
    ]);
    expect(texts('Ancient Coupon (Buckler, Pelta Lunata)')).toEqual(['Unknown']);
  });

  it('computes the labels of any misc code for the materials bundle, potions included', () => {
    expect(miscLabels('mp1').map((entry) => entry.text)).toEqual(['Buy: Gheed']);
    expect(miscLabels('sdo').map((entry) => entry.text)).toEqual(['Cube', 'Buy: Gheed']);
    expect(miscLabels('hp1').map((entry) => entry.text)).toEqual(['Unknown']);
  });
});

describe('readBossSetUniqueDrops', () => {
  it('reads double- and single-quoted unique names', () => {
    expect([...readBossSetUniqueDrops(`unique = "Hellfire Torch"\n  unique = 'Say "Hi"'\n# unique = "Commented"`)]).toEqual([
      'Hellfire Torch',
      'Say "Hi"',
    ]);
  });

  it('returns nothing for a missing or disabled config', () => {
    expect(readBossSetUniqueDrops(null).size).toBe(0);
    expect(readBossSetUniqueDrops('enabled = false\nunique = "Hellfire Torch"').size).toBe(0);
  });
});

describe('readBossSetRules', () => {
  it('reads each rule block: its monsters (one line or several, comments allowed) and unique', () => {
    const toml = `[boss_set_unique_drop]
enabled = true
[[boss_set_unique_drop.rule]]
monsters = [704, 705, 709]
unique = "Hellfire Torch"

[[boss_set_unique_drop.rule]]
monsters = [
  976, # Talic
  977, 978, 978,
]
unique = 'Eternal Hourglass'

[[boss_set_unique_drop.rule]]
unique = "No monsters"
`;
    expect(readBossSetRules(toml)).toEqual([
      { monsters: [704, 705, 709], unique: 'Hellfire Torch' },
      { monsters: [976, 977, 978], unique: 'Eternal Hourglass' },
    ]);
  });

  it('returns nothing for a missing or disabled config', () => {
    expect(readBossSetRules(null)).toEqual([]);
    expect(readBossSetRules('enabled = false\n[[boss_set_unique_drop.rule]]\nmonsters = [1]\nunique = "X"')).toEqual([]);
  });
});

describe('displayName', () => {
  it('reads multi-line names bottom-up', () => {
    expect(displayName('(Buckler, Pelta Lunata)\nAncient Coupon')).toBe('Ancient Coupon (Buckler, Pelta Lunata)');
    expect(displayName(' Forging Hammer ')).toBe('Forging Hammer');
  });
});
