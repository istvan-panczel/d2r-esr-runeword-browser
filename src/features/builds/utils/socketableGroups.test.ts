import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';
import { parseRunewordsHtml } from '@/features/data-sync/parsers/runewordsParser';
import type { BasesBundle, TypesBundle } from '@/features/game-data/engine/schema';
import { typeNameMap } from './runewordBases';
import { socketableGroupsFor, socketableGroupsForBase, socketableGroupsForSlot } from './socketableGroups';

// The parsed ESR 3.3 runewords fixture and the committed bases / types bundles
const gameData = <T>(file: string): T => JSON.parse(readFileSync(resolve(__dirname, '../../../../public/game-data', file), 'utf-8')) as T;
const bases = gameData<BasesBundle>('bases.json').bases;
const typeNames = typeNameMap(gameData<TypesBundle>('types.json'));
const runewords = parseRunewordsHtml(readFileSync(resolve(__dirname, '../../../../test-fixtures/runewords.htm'), 'utf-8'));

function groupsOf(name: string) {
  const groups = runewords.find((runeword) => runeword.name === name && runeword.variant === 1)?.socketableBonuses;
  if (groups === undefined) throw new Error(`${name} not in the fixture`);
  return groups;
}

function base(name: string) {
  const found = bases.find((entry) => entry.name === name);
  if (found === undefined) throw new Error(`${name} not in bases.json`);
  return found;
}

const labelsFor = (name: string, baseName: string) =>
  socketableGroupsForBase(groupsOf(name), base(baseName), typeNames).map((index) => groupsOf(name)[index]?.label);

describe('socketableGroupsForBase', () => {
  it('picks the Boar group of a sword, a bow, a staff, a wand and an orb', () => {
    const weapons = 'Weapon (except Orb, Staff, Wand) / Missile / Mythical Arcane Staff';
    expect(labelsFor('Boar', 'Short Sword')).toEqual([weapons]);
    expect(labelsFor('Boar', 'Short Bow')).toEqual([weapons]);
    expect(labelsFor('Boar', 'Short Staff')).toEqual(['Staff / Wand / Orb']);
    expect(labelsFor('Boar', 'Wand')).toEqual(['Staff / Wand / Orb']);
    expect(labelsFor('Boar', 'Eagle Orb')).toEqual(['Staff / Wand / Orb']);
  });

  it('gives the Mythical Arcane Staff (a staff) the group that names it', () => {
    expect(labelsFor('Boar', 'Mythical Arcane Staff')).toEqual(['Weapon (except Orb, Staff, Wand) / Missile / Mythical Arcane Staff']);
  });

  it('picks the Stone group of a body armour ("Body Armor" is the site name of tors), a helm, gloves and a belt', () => {
    expect(labelsFor('Stone', 'Quilted Armor')).toEqual(['Any Shield / Body Armor / Belt']);
    expect(labelsFor('Stone', 'Buckler')).toEqual(['Any Shield / Body Armor / Belt']);
    expect(labelsFor('Stone', 'Sash')).toEqual(['Any Shield / Body Armor / Belt']);
    expect(labelsFor('Stone', 'Cap')).toEqual(['Helm / Boots']);
    expect(labelsFor('Stone', 'Leather Gloves')).toEqual(['Gloves']);
  });
});

describe('socketableGroupsForSlot', () => {
  it('narrows Stone by slot', () => {
    const labels = (slot: Parameters<typeof socketableGroupsForSlot>[1]) =>
      socketableGroupsForSlot(groupsOf('Stone'), slot).map((index) => groupsOf('Stone')[index]?.label);
    expect(labels('helmet')).toEqual(['Helm / Boots']);
    expect(labels('gloves')).toEqual(['Gloves']);
    expect(labels('armor')).toEqual(['Any Shield / Body Armor / Belt']);
  });

  it('keeps both Boar groups in a weapon slot (swords and staves both go there)', () => {
    expect(socketableGroupsForSlot(groupsOf('Boar'), 'weapon')).toEqual([0, 1]);
  });
});

describe('socketableGroupsFor', () => {
  it('prefers the chosen base, then the slot, else shows everything', () => {
    expect(socketableGroupsFor(groupsOf('Boar'), { slot: 'weapon', base: base('Short Staff'), typeNames })).toEqual([1]);
    expect(socketableGroupsFor(groupsOf('Boar'), { slot: 'weapon' })).toBeUndefined();
    expect(socketableGroupsFor(groupsOf('Stone'), { slot: 'boots' })).toEqual([1]);
  });

  it('shows everything for one unlabelled group or old cached rows without groups', () => {
    expect(socketableGroupsFor(groupsOf('Moonlight'), { slot: 'weapon' })).toBeUndefined();
    expect(socketableGroupsFor(undefined, { slot: 'weapon' })).toBeUndefined();
  });
});
