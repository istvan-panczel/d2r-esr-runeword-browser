import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';
import type { Runeword } from '@/core/db';
import { parseRunewordsHtml } from '@/features/data-sync/parsers/runewordsParser';
import type { BaseItem, BasesBundle, TxtRunewordsBundle, TypesBundle } from '@/features/game-data/engine/schema';
import { allGearBases, baseSummary, basesForSlot, rowsForBase, runewordBaseCandidates, typeNameMap } from './runewordBases';
import { runewordJewelSockets } from './sockets';

function makeBase(overrides: Partial<BaseItem> & Pick<BaseItem, 'code' | 'name'>): BaseItem {
  return {
    kind: 'armor',
    type: 'shie',
    type2: null,
    ancestors: ['shie', 'shld', 'armo'],
    tier: 'normal',
    family: [overrides.code, '', ''],
    qlvl: 1,
    reqLvl: 0,
    reqStr: 0,
    reqDex: 0,
    gemSockets: 4,
    socketCaps: [4, 4, 4],
    dmg1: null,
    dmg2: null,
    throwDmg: null,
    speed: 0,
    strBonus: 0,
    dexBonus: 0,
    def: null,
    block: null,
    durability: 0,
    indestructible: false,
    magicLvl: 0,
    autoGroup: null,
    cls: null,
    inv: [2, 2],
    ...overrides,
  };
}

function makeRuneword(overrides: Partial<Runeword> = {}): Runeword {
  return {
    name: 'Spirit',
    variant: 1,
    sockets: 4,
    reqLevel: 25,
    sortKey: 0,
    isLod: false,
    runes: ['Tal Rune', 'Thul Rune', 'Ort Rune', 'Amn Rune'],
    gems: [],
    ingredients: ['Tal Rune', 'Thul Rune', 'Ort Rune', 'Amn Rune'],
    allowedItems: ['Any Shield'],
    excludedItems: [],
    affixes: [],
    columnAffixes: { weaponsGloves: [], helmsBoots: [], armorShieldsBelts: [] },
    tierPointTotals: [],
    ...overrides,
  };
}

const TYPES: TypesBundle = {
  types: [
    { code: 'shie', name: 'Shield', parents: ['shld'], ancestors: ['shie', 'shld', 'armo'] },
    { code: 'ashd', name: 'Auric Shields', parents: ['shld'], ancestors: ['ashd', 'shld', 'armo'] },
    { code: 'shld', name: 'Any Shield', parents: ['armo'], ancestors: ['shld', 'armo'] },
    { code: 'helm', name: 'Helm', parents: ['armo'], ancestors: ['helm', 'armo'] },
  ].map((type) => ({
    ...type,
    sockets: [4, 4, 4] as [number, number, number],
    thresholds: [25, 40] as [number, number],
    cls: null,
    ui: null,
    rwCats: [],
    magic: true,
    rare: true,
    normal: true,
    bodyLoc: null,
  })),
  classes: [],
};

const monarch = makeBase({ code: 'uit', name: 'Monarch', tier: 'elite', reqStr: 156, reqLvl: 54 });
const buckler = makeBase({ code: 'buc', name: 'Buckler', socketCaps: [1, 1, 1] });
const kiteShield = makeBase({ code: 'kit', name: 'Kite Shield', socketCaps: [3, 4, 4] });
const sacredTarge = makeBase({ code: 'pa9', name: 'Sacred Targe', type: 'ashd', ancestors: ['ashd', 'shld', 'armo'], tier: 'elite' });
const shako = makeBase({ code: 'uap', name: 'Shako', type: 'helm', ancestors: ['helm', 'armo'], tier: 'elite' });
const key = makeBase({ code: 'key', name: 'Key', kind: 'misc', type: 'key', ancestors: ['key'] });
const BASES: BasesBundle = { bases: [shako, monarch, buckler, kiteShield, sacredTarge, key] };

const row = (sockets: number, jewels: number, itypes = ['shld']) => ({
  ingredients: ['Tal', 'Thul', 'Ort', 'Amn'],
  codes: ['r07', 'r10', 'r09', 'r11'],
  jewels,
  sockets,
  itypes,
  etypes: [],
  reqLvl: 25,
  text: [],
});
const RUNEWORDS: TxtRunewordsBundle = { runewords: [{ key: 'Runeword100', name: 'Spirit', rows: [row(4, 0)] }] };
const bundles = { bases: BASES, types: TYPES, runewords: RUNEWORDS };

describe('runewordBaseCandidates', () => {
  it('lists the bases that fit the matched rows and can have their sockets, sorted by type, tier, name', () => {
    const result = runewordBaseCandidates(makeRuneword(), bundles);
    expect(result.unmatched).toBe(false);
    expect(result.rows).toHaveLength(1);
    // Buckler (1 socket max), Shako (wrong type) and the Key (misc) are out.
    expect(result.candidates.map((base) => base.name)).toEqual(['Sacred Targe', 'Kite Shield', 'Monarch']);
  });

  it('keeps only the rows within the HTM socket range', () => {
    const txt: TxtRunewordsBundle = { runewords: [{ key: 'Runeword100', name: 'Spirit', rows: [row(4, 0), row(5, 1), row(6, 2)] }] };
    const result = runewordBaseCandidates(makeRuneword({ socketsMax: 5 }), { ...bundles, runewords: txt });
    expect(result.rows.map((entry) => entry.sockets)).toEqual([4, 5]);
  });

  it('offers every weapon / armour base when the recipe is not matched', () => {
    const result = runewordBaseCandidates(makeRuneword({ name: 'Homebrew' }), bundles);
    expect(result.unmatched).toBe(true);
    expect(result.rows).toEqual([]);
    expect(result.candidates).toEqual(allGearBases(bundles));
    expect(result.candidates.map((base) => base.name)).not.toContain('Key');
  });
});

describe('rowsForBase / baseSummary', () => {
  it('narrows rows to the ones a base can hold', () => {
    const rows = [row(4, 0), row(5, 1), row(6, 2)];
    expect(rowsForBase(rows, monarch).map((entry) => entry.sockets)).toEqual([4]);
    expect(rowsForBase(rows, shako)).toEqual([]);
  });

  it('summarises a base with its type, max sockets and non-zero requirements', () => {
    const typeNames = typeNameMap(TYPES);
    expect(baseSummary(monarch, typeNames)).toBe('Monarch · Shield · 4 sockets · Req Str 156 · Req Lvl 54');
    expect(baseSummary(buckler, typeNames)).toBe('Buckler · Shield · 1 socket');
  });
});

// Spot checks against the real ESR data: the parsed runewords fixture and the committed bundles.
describe('runewordBaseCandidates on the committed game data', () => {
  const gameData = <T>(file: string): T => JSON.parse(readFileSync(resolve(__dirname, '../../../../public/game-data', file), 'utf-8')) as T;
  const real = {
    bases: gameData<BasesBundle>('bases.json'),
    types: gameData<TypesBundle>('types.json'),
    runewords: gameData<TxtRunewordsBundle>('runewords.json'),
  };
  const runewords = parseRunewordsHtml(readFileSync(resolve(__dirname, '../../../../test-fixtures/runewords.htm'), 'utf-8'));
  const find = (name: string, allowed: string) => {
    const match = runewords.find((entry) => entry.name === name && entry.allowedItems.includes(allowed));
    if (match === undefined) throw new Error(`${name} (${allowed}) not in the fixture`);
    return {
      runeword: match,
      result: runewordBaseCandidates(
        match,
        real,
        runewords.filter((entry) => entry.name === name)
      ),
    };
  };
  const typeNames = typeNameMap(real.types);
  const typesOf = (bases: readonly BaseItem[]) => new Set(bases.map((base) => typeNames.get(base.type) ?? base.type));

  it('matches every fixture runeword to the game files', () => {
    const unmatched = runewords.filter(
      (entry) =>
        runewordBaseCandidates(
          entry,
          real,
          runewords.filter((other) => other.name === entry.name)
        ).unmatched
    );
    expect(unmatched.map((entry) => `${entry.name} v${String(entry.variant)}`)).toEqual([]);
  });

  it('Spirit (shield) offers 4-socket shields (Kite Shield, not Buckler)', () => {
    const { result } = find('Spirit', 'Any Shield');
    const names = result.candidates.map((base) => base.name);
    expect(names).toContain('Kite Shield');
    expect(names).not.toContain('Buckler');
    expect(result.candidates.every((base) => Math.max(...base.socketCaps) >= 4)).toBe(true);
    expect(result.candidates.every((base) => base.ancestors.includes('shld') || base.ancestors.includes('swor'))).toBe(true);
  });

  it('basesForSlot narrows Spirit (Sword / Any Shield) to what belongs in the slot', () => {
    const { result } = find('Spirit', 'Any Shield');
    const shield = basesForSlot(result.candidates, 'shield', typeNames).map((base) => base.name);
    const weapon = basesForSlot(result.candidates, 'weapon', typeNames).map((base) => base.name);
    // Shields stay; one-handed swords stay too (off-hand dual wield); two-handed katanas go.
    expect(shield).toContain('Kite Shield');
    expect(shield).not.toContain('Ninja To');
    // The weapon slot keeps every sword and drops the shields.
    expect(weapon).toContain('Ninja To');
    expect(weapon).not.toContain('Kite Shield');
    // No sword or shield belongs on a ring.
    expect(basesForSlot(result.candidates, 'ring1', typeNames)).toEqual([]);
  });

  it('Enigma and Insight (body armour) offer body armours only', () => {
    for (const { result } of [find('Enigma', 'Body Armor'), find('Insight', 'Body Armor')]) {
      expect(result.candidates.length).toBeGreaterThan(0);
      expect(result.candidates.every((base) => base.ancestors.includes('tors'))).toBe(true);
    }
  });

  it('counts the free jewel sockets of a recipe with optional jewels', () => {
    const moonlight = runewords.filter((entry) => entry.name === 'Moonlight' && entry.socketsMax !== undefined);
    for (const runeword of moonlight) {
      const { rows } = runewordBaseCandidates(
        runeword,
        real,
        runewords.filter((entry) => entry.name === 'Moonlight')
      );
      expect(runewordJewelSockets(runeword, rows)).toBe((runeword.socketsMax ?? runeword.sockets) - runeword.sockets);
    }
    expect(typesOf(find('Spirit', 'Any Shield').result.candidates).size).toBeGreaterThan(1);
  });
});
