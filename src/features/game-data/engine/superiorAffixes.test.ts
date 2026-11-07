import { describe, expect, it } from 'vitest';
import type { SuperiorAffixes, SuperiorColumn, SuperiorRow } from './schema';
import { base } from '../utils/testBases.mock';
import { formatSuperiorChance, stockColumnAllows, superiorRollsFor, superiorRollsForBase, superiorRowAllows } from './superiorAffixes';

// Real ESR 3.2.24 bases (bases.json kind / type / ancestors)
const amazonBow = base('am1', 'Stag Bow', 'abow', 'normal', ['am1', 'am6', 'amb'], 18, {
  kind: 'weapon',
  ancestors: ['abow', 'bow', 'amaz', 'miss', 'clas', 'weap'],
});
const crossbow = base('lxb', 'Light Crossbow', 'xbow', 'normal', ['lxb', '8lx', '6lx'], 6, {
  kind: 'weapon',
  ancestors: ['xbow', 'miss', 'weap'],
});
const paladinShield = base('pa1', 'Targe', 'ashd', 'normal', ['pa1', 'pa6', 'pab'], 3, {
  ancestors: ['ashd', 'shld', 'pala', 'armo', 'seco', 'clas'],
});
const circlet = base('ci0', 'Circlet', 'circ', 'normal', ['ci0', 'ci2', 'ci3'], 24, { ancestors: ['circ', 'helm', 'armo', 'merc'] });
const orb = base('ob1', 'Eagle Orb', 'orb', 'normal', ['ob1', 'ob6', 'obb'], 1, {
  kind: 'weapon',
  type2: '1hsw',
  ancestors: ['orb', '1hsw', 'weap', 'sorc', 'clas'],
});
const shield = base('buc', 'Buckler', 'shie', 'normal', ['buc', 'xuc', 'uuc'], 1, { ancestors: ['shie', 'shld', 'armo', 'seco'] });
const helm = base('cap', 'Cap', 'helm', 'normal', ['cap', 'xap', 'uap'], 1, { ancestors: ['helm', 'armo', 'merc'] });
const ring = base('rin', 'Ring', 'ring', 'normal', ['rin', 'rin', 'rin'], 1, { kind: 'misc', ancestors: ['ring', 'misc'] });

const row = (index: number, weight: number, extra: Partial<SuperiorRow> = {}): SuperiorRow => ({
  row: index,
  weight,
  mods: [],
  text: [`row ${String(index)}`],
  columns: [],
  itypes: [],
  etypes: [],
  ...extra,
});

const columnRow = (column: SuperiorColumn) => row(0, 100, { columns: [column] });

describe('stock item-class columns (own type only)', () => {
  it('puts an Amazon bow in the weapon column, not the bow column', () => {
    expect(stockColumnAllows('weapon', amazonBow)).toBe(true);
    expect(stockColumnAllows('bow', amazonBow)).toBe(false);
  });

  it('puts a crossbow in the bow column, not the weapon column', () => {
    expect(stockColumnAllows('bow', crossbow)).toBe(true);
    expect(stockColumnAllows('weapon', crossbow)).toBe(false);
  });

  it('puts a Paladin shield in the armor column, not the shield column (own type ashd, not shie)', () => {
    expect(stockColumnAllows('armor', paladinShield)).toBe(true);
    expect(stockColumnAllows('shield', paladinShield)).toBe(false);
    expect(stockColumnAllows('shield', shield)).toBe(true);
    expect(stockColumnAllows('armor', shield)).toBe(false);
  });

  it('puts a circlet and a helm in the armor column', () => {
    expect(stockColumnAllows('armor', circlet)).toBe(true);
    expect(stockColumnAllows('armor', helm)).toBe(true);
  });

  it('puts a sorceress orb in the weapon column, not the wand or staff column', () => {
    expect(stockColumnAllows('weapon', orb)).toBe(true);
    expect(stockColumnAllows('wand', orb)).toBe(false);
    expect(stockColumnAllows('staff', orb)).toBe(false);
  });

  it('never lets misc items roll a row', () => {
    for (const column of ['armor', 'weapon'] as const) expect(superiorRowAllows(columnRow(column), ring)).toBe(false);
    expect(superiorRowAllows(row(0, 100, { itypes: ['ring'] }), ring)).toBe(false);
  });
});

describe('itype / etype columns', () => {
  it('matches itypes through the Equiv ancestors: an Amazon bow counts as a bow, a crossbow does not', () => {
    const bowRow = row(0, 100, { itypes: ['bow'] });
    expect(superiorRowAllows(bowRow, amazonBow)).toBe(true);
    expect(superiorRowAllows(bowRow, crossbow)).toBe(false);
  });

  it('ignores the stock columns once an itype is set', () => {
    const helmOnly = row(0, 100, { columns: ['armor', 'weapon'], itypes: ['helm'] });
    expect(superiorRowAllows(helmOnly, circlet)).toBe(true);
    expect(superiorRowAllows(helmOnly, paladinShield)).toBe(false);
    expect(superiorRowAllows(helmOnly, amazonBow)).toBe(false);
  });

  it('excludes etypes whichever way the row includes items (ESR row 16: weap except staf, wand, orb, ndgr, dclb)', () => {
    const attackRating = row(16, 100, { itypes: ['weap'], etypes: ['staf', 'wand', 'orb', 'ndgr', 'dclb'] });
    expect(superiorRowAllows(attackRating, amazonBow)).toBe(true);
    expect(superiorRowAllows(attackRating, crossbow)).toBe(true);
    expect(superiorRowAllows(attackRating, orb)).toBe(false);
    const weaponColumnNoBows = row(0, 100, { columns: ['weapon'], etypes: ['bow'] });
    expect(superiorRowAllows(weaponColumnNoBows, amazonBow)).toBe(false);
    expect(superiorRowAllows(weaponColumnNoBows, orb)).toBe(true);
  });

  it('matches the ESR shield rows (tors, shld) on a Paladin shield but not on a circlet', () => {
    const maxResists = row(22, 1, { itypes: ['tors', 'shld'] });
    expect(superiorRowAllows(maxResists, paladinShield)).toBe(true);
    expect(superiorRowAllows(maxResists, circlet)).toBe(false);
  });
});

describe('weights and chances', () => {
  const rows = [
    row(0, 25, { itypes: ['armo'] }),
    row(1, 1, { itypes: ['weap', 'armo'] }),
    row(2, 100, { itypes: ['weap'], etypes: ['orb'] }),
    row(3, 0, { itypes: ['weap'] }),
    row(4, 74, { itypes: ['orb'] }),
  ];

  it('divides each weight by the summed weights of the rows the item may use', () => {
    const { rolls, total } = superiorRollsFor(rows, orb);
    expect(total).toBe(75);
    expect(rolls.map((roll) => [roll.row.row, roll.chance])).toEqual([
      [1, 1 / 75],
      [3, 0],
      [4, 74 / 75],
    ]);
    expect(superiorRollsFor(rows, amazonBow).total).toBe(101);
    expect(superiorRollsFor(rows, circlet).rolls.map((roll) => roll.chance)).toEqual([25 / 26, 1 / 26]);
  });

  it('limits throwing / nodurability items to rows 0-3 when the stock rule is on', () => {
    const superior: SuperiorAffixes = { enabled: true, weightSource: 'config', defaultWeight: 100, firstFourRowBases: ['ob1'], rows, pools: [] };
    expect(superiorRollsForBase(superior, orb).rolls.map((roll) => roll.row.row)).toEqual([1, 3]);
    expect(superiorRollsForBase({ ...superior, firstFourRowBases: undefined }, orb).rolls).toHaveLength(3);
  });

  it('returns no rolls for an item no row allows', () => {
    expect(superiorRollsFor(rows, ring)).toEqual({ rolls: [], total: 0 });
  });

  it('formats chances with 2 decimals below 1%', () => {
    expect(formatSuperiorChance(1 / 969)).toBe('0.10%');
    expect(formatSuperiorChance(100 / 969)).toBe('10.3%');
    expect(formatSuperiorChance(0.00001)).toBe('<0.01%');
    expect(formatSuperiorChance(0)).toBe('0%');
  });
});
