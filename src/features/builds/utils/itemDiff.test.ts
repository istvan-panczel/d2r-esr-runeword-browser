import { afterEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db';
import type { BuildData, ItemRef } from '../buildData';
import { computeBuildItemDiffs, computeVariantItemDiffs, diffRef, refSnapshotsEqual } from './itemDiff';

afterEach(async () => {
  await db.htmUniqueItems.clear();
});

function uniqueRef(id: number, properties: readonly string[]): ItemRef {
  return {
    type: 'unique',
    id,
    snapshot: { name: 'Harlequin Crest', baseItem: 'Shako', category: 'Helm', reqLevel: 62, properties },
  };
}

describe('refSnapshotsEqual', () => {
  it('is true for identical snapshots regardless of object key order', () => {
    const a: ItemRef = {
      type: 'unique',
      id: 1,
      snapshot: { properties: ['x', 'y'], reqLevel: 10, category: 'Helm', baseItem: 'Shako', name: 'HC' },
    };
    const b: ItemRef = {
      type: 'unique',
      id: 1,
      snapshot: { name: 'HC', baseItem: 'Shako', category: 'Helm', reqLevel: 10, properties: ['x', 'y'] },
    };
    expect(refSnapshotsEqual(a, b)).toBe(true);
  });

  it('is false when a property line changes', () => {
    expect(refSnapshotsEqual(uniqueRef(1, ['+2 skills']), uniqueRef(1, ['+3 skills']))).toBe(false);
  });

  it('is false when the property order changes (order is meaningful)', () => {
    expect(refSnapshotsEqual(uniqueRef(1, ['a', 'b']), uniqueRef(1, ['b', 'a']))).toBe(false);
  });

  it('is false across differing types', () => {
    const freetext: ItemRef = { type: 'freetext', name: 'HC' };
    expect(refSnapshotsEqual(uniqueRef(1, ['a']), freetext)).toBe(false);
  });
});

describe('refSnapshotsEqual with re-wrapped property text', () => {
  const SPLIT = [
    "Each cast lowers 12% the aimed target's and surrounding",
    'enemies elemental, magic, and physical resistances, but you',
    'lose 4% total resistances for 1 second. Maximum stacks: 25',
    '+2 to All Skills',
  ];
  const MERGED = [
    "Each cast lowers 12% the aimed target's and surrounding enemies elemental, magic, and physical resistances, but you lose 4% total resistances for 1 second. Maximum stacks: 25",
    '+2 to All Skills',
  ];

  it('treats split vs merged lines of the same text as unchanged', () => {
    expect(refSnapshotsEqual(uniqueRef(1, SPLIT), uniqueRef(1, MERGED))).toBe(true);
    expect(diffRef(uniqueRef(1, SPLIT), uniqueRef(1, MERGED)).status).toBe('unchanged');
  });

  it('still detects a changed number inside re-wrapped text', () => {
    const changed = [MERGED[0].replace('Maximum stacks: 25', 'Maximum stacks: 30'), MERGED[1]];
    expect(refSnapshotsEqual(uniqueRef(1, SPLIT), uniqueRef(1, changed))).toBe(false);
  });

  it('ignores whitespace-only differences', () => {
    expect(
      refSnapshotsEqual(
        uniqueRef(1, ['  +2 to   All Skills ', '+20%\tFaster Cast Rate']),
        uniqueRef(1, ['+2 to All Skills', '+20% Faster Cast Rate'])
      )
    ).toBe(true);
  });

  it('still detects a reordered text across lines', () => {
    expect(
      refSnapshotsEqual(uniqueRef(1, ['+2 to All Skills', 'Cannot Be Frozen']), uniqueRef(1, ['Cannot Be Frozen +2 to All Skills']))
    ).toBe(false);
  });

  it('compares runeword column affixes as text too', () => {
    const runeword = (weaponsGloves: readonly string[], reqLevel = 65): ItemRef => ({
      type: 'runeword',
      name: 'Enigma',
      variant: 1,
      snapshot: {
        sockets: 3,
        runes: ['Jah', 'Ith', 'Ber'],
        gems: [],
        allowedItems: ['Body Armor'],
        columnAffixes: { weaponsGloves, helmsBoots: [], armorShieldsBelts: ['+2 to All Skills'] },
        reqLevel,
      },
    });
    expect(
      refSnapshotsEqual(runeword(['Level 1 Teleport', 'Charge Every 5 Seconds']), runeword(['Level 1 Teleport Charge Every 5 Seconds']))
    ).toBe(true);
    expect(
      refSnapshotsEqual(runeword(['Level 1 Teleport', 'Charge Every 5 Seconds']), runeword(['Level 1 Teleport Charge Every 4 Seconds']))
    ).toBe(false);
    expect(refSnapshotsEqual(runeword(['x']), runeword(['x'], 66))).toBe(false);
  });
});

describe('refSnapshotsEqual for mythicals', () => {
  const REGULAR = ['+(3 to 5) to Fire Skills', '-(20 to 30)% to Enemy Fire Resistance'];

  function mythicalRef(properties: readonly string[], specialProperties?: readonly string[]): ItemRef {
    return {
      type: 'mythical',
      id: 1,
      snapshot: {
        name: "Tathamet's Awakening",
        baseItem: 'Mythical Diadem',
        category: 'Mythical Unique Armor',
        reqLevel: 90,
        properties,
        ...(specialProperties !== undefined && { specialProperties }),
      },
    };
  }

  it('treats a line moving from properties to specialProperties as unchanged', () => {
    const before = mythicalRef(['Elemental Novas count as attuned to all elements', ...REGULAR], ['Teleport casts Elemental Nova']);
    const after = mythicalRef(REGULAR, ['Teleport casts Elemental Nova', 'Elemental Novas count as attuned to all elements']);
    expect(refSnapshotsEqual(before, after)).toBe(true);
  });

  it('treats a legacy snapshot (no specialProperties, misfiled special-text tail) as unchanged', () => {
    // Old parser: the first orange segment went to specialProperties (not snapshotted),
    // its wrapped continuation lines landed at the start of properties.
    const legacy = mythicalRef([
      'Elemental Novas cast this way count as being attuned to all',
      "elements, but the level is based off Teleport's level",
      ...REGULAR,
    ]);
    const current = mythicalRef(REGULAR, [
      'Your Teleport now automatically casts Elemental Nova on use Elemental Novas cast this way count as being attuned to all elements,',
      "but the level is based off Teleport's level",
    ]);
    expect(refSnapshotsEqual(legacy, current)).toBe(true);
    expect(refSnapshotsEqual(current, legacy)).toBe(true);
    expect(refSnapshotsEqual(mythicalRef(REGULAR), current)).toBe(true);
  });

  it('still flags a legacy snapshot whose regular stats changed', () => {
    const current = mythicalRef(['+(3 to 5) to Fire Skills', '-(25 to 30)% to Enemy Fire Resistance'], ['Some special text']);
    expect(refSnapshotsEqual(mythicalRef(['special text', ...REGULAR]), current)).toBe(false);
    expect(refSnapshotsEqual(mythicalRef(REGULAR), current)).toBe(false);
  });

  it('flags a legacy snapshot that lost leading regular lines', () => {
    expect(refSnapshotsEqual(mythicalRef(REGULAR.slice(1)), mythicalRef(REGULAR, ['Special']))).toBe(false);
  });

  it('flags a changed special property when both snapshots record them', () => {
    expect(refSnapshotsEqual(mythicalRef(REGULAR, ['Maximum Stacks: 25']), mythicalRef(REGULAR, ['Maximum Stacks: 30']))).toBe(false);
  });
});

describe('diffRef', () => {
  it('classifies an equal snapshot as unchanged', () => {
    expect(diffRef(uniqueRef(1, ['a']), uniqueRef(1, ['a'])).status).toBe('unchanged');
  });

  it('classifies differing stats as changed', () => {
    expect(diffRef(uniqueRef(1, ['a']), uniqueRef(1, ['b'])).status).toBe('changed');
  });

  it('classifies a missing current item as missing', () => {
    const result = diffRef(uniqueRef(1, ['a']), null);
    expect(result.status).toBe('missing');
    expect(result.current).toBeNull();
  });

  it('treats freetext as always unchanged', () => {
    const freetext: ItemRef = { type: 'freetext', name: 'GG rare' };
    expect(diffRef(freetext, null).status).toBe('unchanged');
  });
});

describe('computeBuildItemDiffs', () => {
  async function addUnique(properties: readonly string[]): Promise<number> {
    const id = await db.htmUniqueItems.add({
      name: 'Harlequin Crest',
      baseItem: 'Shako',
      baseItemCode: 'uap',
      page: 'armors',
      category: 'Helm',
      itemLevel: 69,
      reqLevel: 62,
      properties: [...properties],
      isAncientCoupon: false,
      gambleItem: '',
      notes: '',
    });
    return id as number;
  }

  it('flags an item whose current stats differ from the saved snapshot', async () => {
    const id = await addUnique(['+2 to All Skills (current)']);
    const buildData: BuildData = { items: { helmet: uniqueRef(id, ['+2 to All Skills (STALE)']) } };

    const diffs = await computeBuildItemDiffs(buildData);
    const helmet = diffs.items.helmet;
    expect(helmet?.status).toBe('changed');
    if (helmet?.current?.type === 'unique') {
      expect(helmet.current.snapshot.properties).toEqual(['+2 to All Skills (current)']);
    }
  });

  it('marks a referenced item missing when it no longer exists locally', async () => {
    const buildData: BuildData = { items: { helmet: uniqueRef(99999, ['kept']) } };

    const diffs = await computeBuildItemDiffs(buildData);
    expect(diffs.items.helmet?.status).toBe('missing');
    expect(diffs.items.helmet?.current).toBeNull();
  });

  it('resolves a unique by name even when the stored id is stale (post re-parse)', async () => {
    // The item exists locally under a freshly-assigned id; the build kept an old id.
    // Resolution by stable name must still find it, so it diffs instead of going missing.
    await addUnique(['+2 to All Skills (current)']);
    const buildData: BuildData = { items: { helmet: uniqueRef(987654, ['+2 to All Skills (current)']) } };

    const diffs = await computeBuildItemDiffs(buildData);
    expect(diffs.items.helmet?.status).toBe('unchanged');
  });

  it('reports no change when the snapshot matches current data', async () => {
    const id = await addUnique(['+2 to All Skills (current)']);
    const buildData: BuildData = { items: { helmet: uniqueRef(id, ['+2 to All Skills (current)']) } };

    const diffs = await computeBuildItemDiffs(buildData);
    expect(diffs.items.helmet?.status).toBe('unchanged');
  });

  it('leaves freetext entries unchanged across all sections', async () => {
    const buildData: BuildData = {
      items: { gloves: { type: 'freetext', name: 'GG rare gloves' } },
      mercenary: { helmet: { type: 'freetext', name: 'Andariel base' } },
    };

    const diffs = await computeBuildItemDiffs(buildData);
    expect(diffs.items.gloves?.status).toBe('unchanged');
    expect(diffs.mercenary.helmet?.status).toBe('unchanged');
  });
});

describe('computeBuildItemDiffs with same-name variants', () => {
  const NORMAL = ['+(150 to 200)% Enhanced Damage', '+(50 to 100) to Dexterity'];
  const COUPON = ['+100% Enhanced Damage', '-200% Target Defense', '+(1 to 5) To Broadhead'];

  async function addAim(properties: readonly string[], isAncientCoupon: boolean): Promise<void> {
    await db.htmUniqueItems.add({
      name: "Lycander's Aim",
      baseItem: 'Ceremonial Bow',
      baseItemCode: 'am7',
      page: 'weapons',
      category: 'Amazon Bow',
      itemLevel: 50,
      reqLevel: 42,
      properties: [...properties],
      isAncientCoupon,
      gambleItem: '',
      notes: '',
    });
  }

  function aimRef(properties: readonly string[]): ItemRef {
    return {
      type: 'unique',
      id: 987654,
      snapshot: { name: "Lycander's Aim", baseItem: 'Ceremonial Bow', category: 'Amazon Bow', reqLevel: 42, properties },
    };
  }

  it('reports the saved (second) variant as unchanged instead of diffing it against the first', async () => {
    await addAim(NORMAL, false);
    await addAim(COUPON, true);

    const diffs = await computeBuildItemDiffs({ items: { weapon: aimRef(COUPON) } });
    expect(diffs.items.weapon?.status).toBe('unchanged');
  });

  it('still flags a real upstream change to the saved variant', async () => {
    await addAim(NORMAL, false);
    await addAim([...COUPON.slice(0, 2), '+(2 to 6) To Broadhead'], true);

    const diffs = await computeBuildItemDiffs({ items: { weapon: aimRef(COUPON) } });
    const weapon = diffs.items.weapon;
    expect(weapon?.status).toBe('changed');
    if (weapon?.current?.type === 'unique') expect(weapon.current.snapshot.properties).toContain('+(2 to 6) To Broadhead');
  });
});

describe('computeVariantItemDiffs', () => {
  const gone: ItemRef = {
    type: 'unique',
    id: 99999,
    snapshot: { name: 'Removed Item', baseItem: 'X', category: 'Helm', reqLevel: 1, properties: ['kept'] },
  };

  async function addShako(properties: readonly string[]): Promise<number> {
    const id = await db.htmUniqueItems.add({
      name: 'Harlequin Crest',
      baseItem: 'Shako',
      baseItemCode: 'uap',
      page: 'armors',
      category: 'Helm',
      itemLevel: 69,
      reqLevel: 62,
      properties: [...properties],
      isAncientCoupon: false,
      gambleItem: '',
      notes: '',
    });
    return id as number;
  }

  it('diffs the main items like computeBuildItemDiffs and every alternative, index-aligned', async () => {
    const id = await addShako(['current']);
    const freetext: ItemRef = { type: 'freetext', name: 'Circlet' };
    const diffs = await computeVariantItemDiffs({
      items: { helmet: uniqueRef(id, ['current']) },
      itemAlternatives: { helmet: [{ ref: uniqueRef(id, ['STALE']) }, { ref: gone }, { ref: freetext }] },
      weaponSwapAlternatives: { weapon2: [{ ref: uniqueRef(id, ['current']) }] },
      mercenaryAlternatives: { helmet: [{ ref: gone, note: 'n' }] },
    });
    expect(diffs.items.helmet?.status).toBe('unchanged');
    expect(diffs.alternatives.items.helmet?.map((diff) => diff.status)).toEqual(['changed', 'missing', 'unchanged']);
    expect(diffs.alternatives.items.helmet?.[1].stored).toBe(gone);
    expect(diffs.alternatives.weaponSwap.weapon2?.map((diff) => diff.status)).toEqual(['unchanged']);
    expect(diffs.alternatives.mercenary.helmet?.map((diff) => diff.status)).toEqual(['missing']);
  });

  it('returns empty alternative maps for a variant without alternatives', async () => {
    const diffs = await computeVariantItemDiffs({
      items: { gloves: { type: 'freetext', name: 'GG rare gloves' } },
      itemAlternatives: { ring1: [] },
    });
    expect(diffs.items.gloves?.status).toBe('unchanged');
    expect(diffs.alternatives).toEqual({ items: {}, weaponSwap: {}, mercenary: {} });
  });
});
