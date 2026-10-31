import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db';
import type { Affix, Runeword, SocketableBonuses } from '@/core/db';
import type { SetsBundle } from '@/features/game-data/engine/schema';
import type { BuildWithAuthor } from '../types';
import type { BuildData, ItemRef, MythicalItemRef, RunewordItemRef, SetItemRef, UniqueItemRef } from '../buildData';
import { buildExportPayload } from './buildExport';
import { compactItems, setItemToRef } from './buildSnapshot';
import { hasItemChoices, socketedOf, withBase, withSocketed } from './itemChoices';
import { diffRef, refSnapshotsEqual, resolveCurrentRef } from './itemDiff';
import { refreshBuildData } from './refreshBuildData';

const { loadGameDataFile } = vi.hoisted(() => ({ loadGameDataFile: vi.fn() }));
vi.mock('@/features/game-data/engine/browser/loadGameData', () => ({ loadGameDataFile }));

const SETS: SetsBundle = {
  sets: [
    {
      id: 'Tara',
      name: "Tara's Calling",
      classCode: null,
      className: null,
      reqLevel: { min: 20, max: 20 },
      items: [
        {
          name: "Tara's Helm",
          code: 'cap',
          baseName: 'Cap',
          category: 'Helm',
          level: 25,
          reqLevel: 20,
          lines: ['+20 Defense (current)'],
          partial: [],
        },
      ],
      partial: [],
      full: [],
    },
  ],
};

const affix = (rawText: string): Affix => ({ rawText, pattern: rawText, value: null, valueType: 'none' });
const COLUMNS: SocketableBonuses = { weaponsGloves: [], helmsBoots: [], armorShieldsBelts: [affix('+2 to All Skills (current)')] };

const SPIRIT: Runeword = {
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
  columnAffixes: COLUMNS,
  tierPointTotals: [],
};

const staleColumns = { weaponsGloves: [], helmsBoots: [], armorShieldsBelts: ['+2 to All Skills (STALE)'] };
const BASE = { code: 'kit', name: 'Kite Shield' } as const;
const FILLERS = ['Rainbow Facet', 'Ko Rune'] as const;

const storedRuneword: RunewordItemRef = {
  type: 'runeword',
  name: 'Spirit',
  variant: 1,
  snapshot: { sockets: 4, runes: SPIRIT.runes, gems: [], allowedItems: ['Any Shield'], columnAffixes: staleColumns, reqLevel: 25 },
  base: BASE,
  socketed: FILLERS,
};

const uniqueSnapshot = { name: 'Harlequin Crest', baseItem: 'Shako', category: 'Helm', reqLevel: 62 } as const;
const storedUnique: UniqueItemRef = {
  type: 'unique',
  id: 99999,
  snapshot: { ...uniqueSnapshot, properties: ['+2 to All Skills (STALE)'] },
  socketed: ['Ber Rune'],
};

const mythicalSnapshot = { name: "Tyrael's Might", baseItem: 'Sacred Armor', category: 'Body Armor', reqLevel: 84 } as const;
const storedMythical: MythicalItemRef = {
  type: 'mythical',
  id: 99999,
  snapshot: { ...mythicalSnapshot, properties: ['+2 to All Skills (STALE)'], specialProperties: [] },
  socketed: ['Perfect Ruby', 'Perfect Ruby', 'Perfect Ruby'],
};

const setBundleEntry = SETS.sets[0];
const helmEntry = setBundleEntry?.items[0];
if (setBundleEntry === undefined || helmEntry === undefined) throw new Error('fixture');
const freshSet = setItemToRef(helmEntry, setBundleEntry);
const storedSet: SetItemRef = {
  ...freshSet,
  snapshot: { ...freshSet.snapshot, properties: ['+20 Defense (STALE)'] },
  socketed: ['Shael Rune'],
};

beforeEach(async () => {
  loadGameDataFile.mockResolvedValue(SETS);
  await db.runewords.add(SPIRIT);
  await db.htmUniqueItems.add({
    ...uniqueSnapshot,
    baseItemCode: 'uap',
    page: 'armors',
    itemLevel: 69,
    properties: ['+2 to All Skills (current)'],
    isAncientCoupon: false,
    gambleItem: '',
    notes: '',
  });
  await db.mythicalUniques.add({
    ...mythicalSnapshot,
    baseItemLink: '',
    itemLevel: 85,
    properties: ['+2 to All Skills (current)'],
    specialProperties: [],
    notes: [],
    imageUrl: '',
  });
});

afterEach(async () => {
  loadGameDataFile.mockReset();
  await Promise.all([db.runewords.clear(), db.htmUniqueItems.clear(), db.mythicalUniques.clear()]);
});

describe('refreshBuildData keeps the author choices', () => {
  it('carries base and socketed onto refreshed runeword, unique, mythical and set refs', async () => {
    const refreshed = await refreshBuildData({
      items: { helmet: storedUnique, armor: storedMythical },
      weaponSwap: { shield2: storedRuneword },
      mercenary: { helmet: storedSet },
    });

    const runeword = refreshed.weaponSwap?.shield2;
    expect(runeword?.type === 'runeword' && runeword.snapshot.columnAffixes.armorShieldsBelts).toEqual(['+2 to All Skills (current)']);
    expect(runeword?.type === 'runeword' && runeword.base).toEqual(BASE);
    expect(runeword && socketedOf(runeword)).toEqual(FILLERS);

    const unique = refreshed.items?.helmet;
    expect(unique?.type === 'unique' && unique.snapshot.properties).toEqual(['+2 to All Skills (current)']);
    expect(unique && socketedOf(unique)).toEqual(['Ber Rune']);

    const mythical = refreshed.items?.armor;
    expect(mythical?.type === 'mythical' && mythical.snapshot.properties).toEqual(['+2 to All Skills (current)']);
    expect(mythical && socketedOf(mythical)).toEqual(['Perfect Ruby', 'Perfect Ruby', 'Perfect Ruby']);

    const set = refreshed.mercenary?.helmet;
    expect(set?.type === 'set' && set.snapshot.properties).toEqual(['+20 Defense (current)']);
    expect(set && socketedOf(set)).toEqual(['Shael Rune']);
  });

  it('adds no choice fields to refs that had none', async () => {
    const { base: _base, socketed: _socketed, ...plain } = storedRuneword;
    const refreshed = await resolveCurrentRef(plain);
    expect(refreshed).not.toHaveProperty('base');
    expect(refreshed).not.toHaveProperty('socketed');
  });

  it('keeps the choices on a ref that no longer exists (refresh keeps the stored ref)', async () => {
    const gone: RunewordItemRef = { ...storedRuneword, name: 'Removed Runeword' };
    const refreshed = await refreshBuildData({ items: { shield: gone } });
    expect(refreshed.items?.shield).toBe(gone);
  });
});

describe('the version diff ignores the author choices', () => {
  it('treats refs differing only in base / socketed as equal', () => {
    const { base: _base, socketed: _socketed, ...plain } = storedRuneword;
    expect(refSnapshotsEqual(storedRuneword, plain)).toBe(true);
    expect(refSnapshotsEqual(storedUnique, { ...storedUnique, socketed: ['Jah Rune'] })).toBe(true);
    expect(diffRef(storedSet, { ...storedSet, socketed: undefined }).status).toBe('unchanged');
  });

  it('still reports a changed snapshot on a ref with choices', async () => {
    const current = await resolveCurrentRef(storedRuneword);
    expect(diffRef(storedRuneword, current).status).toBe('changed');
  });
});

describe('saving and exporting', () => {
  it('compactItems keeps base and socketed', () => {
    expect(compactItems({ shield: storedRuneword, helmet: storedUnique, gloves: null })).toEqual({
      shield: storedRuneword,
      helmet: storedUnique,
    });
  });

  it('exports the raw build_data unchanged', () => {
    const buildData: BuildData = { items: { shield: storedRuneword } };
    const build = { id: 'abcdefgh-1', name: 'Test', build_data: buildData } as unknown as BuildWithAuthor;
    expect(buildExportPayload(build, 'src', 'now').build.build_data).toBe(buildData);
  });
});

describe('withSocketed / withBase / hasItemChoices', () => {
  it('sets and clears the fields without leaving empty values', () => {
    const withFillers = withSocketed(storedUnique, ['Ist Rune']);
    expect(withFillers.socketed).toEqual(['Ist Rune']);
    expect(withSocketed(storedUnique, [])).not.toHaveProperty('socketed');
    expect(withBase(storedRuneword, undefined)).not.toHaveProperty('base');
    expect(withBase(storedRuneword, { code: 'xit', name: 'Dragon Shield' }).base).toEqual({ code: 'xit', name: 'Dragon Shield' });
  });

  it('detects refs carrying choices', () => {
    const freetext: ItemRef = { type: 'freetext', name: 'Rare circlet' };
    expect(hasItemChoices(storedRuneword)).toBe(true);
    expect(hasItemChoices(withSocketed(storedUnique, []))).toBe(false);
    expect(hasItemChoices(freetext)).toBe(false);
    expect(socketedOf(freetext)).toEqual([]);
  });
});
