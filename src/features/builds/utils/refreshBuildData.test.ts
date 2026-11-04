import { afterEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db';
import type { BuildData, ItemRef } from '../buildData';
import { refreshBuildData } from './refreshBuildData';

afterEach(async () => {
  await db.htmUniqueItems.clear();
});

describe('refreshBuildData', () => {
  it('refreshes a unique snapshot from current local data', async () => {
    const id = await db.htmUniqueItems.add({
      name: 'Harlequin Crest',
      baseItem: 'Shako',
      baseItemCode: 'uap',
      page: 'armors',
      category: 'Helm',
      itemLevel: 69,
      reqLevel: 62,
      properties: ['+2 to All Skills (current)'],
      isAncientCoupon: false,
      gambleItem: '',
      notes: '',
    });

    const buildData: BuildData = {
      items: {
        helmet: {
          type: 'unique',
          id: id as number,
          snapshot: {
            name: 'Harlequin Crest',
            baseItem: 'Shako',
            category: 'Helm',
            reqLevel: 62,
            properties: ['+2 to All Skills (STALE)'],
          },
        },
      },
    };

    const refreshed = await refreshBuildData(buildData);
    const helmet = refreshed.items?.helmet;
    expect(helmet?.type).toBe('unique');
    if (helmet?.type === 'unique') {
      expect(helmet.snapshot.properties).toEqual(['+2 to All Skills (current)']);
    }
  });

  it('keeps the existing reference when the item no longer exists', async () => {
    const buildData: BuildData = {
      items: {
        helmet: {
          type: 'unique',
          id: 99999,
          snapshot: { name: 'Removed Item', baseItem: 'X', category: 'Helm', reqLevel: 1, properties: ['kept'] },
        },
      },
    };

    const refreshed = await refreshBuildData(buildData);
    const helmet = refreshed.items?.helmet;
    if (helmet?.type === 'unique') {
      expect(helmet.snapshot.properties).toEqual(['kept']);
    }
  });

  it('leaves freetext entries untouched', async () => {
    const buildData: BuildData = { items: { gloves: { type: 'freetext', name: 'GG rare gloves' } } };
    const refreshed = await refreshBuildData(buildData);
    expect(refreshed.items?.gloves).toEqual({ type: 'freetext', name: 'GG rare gloves' });
  });

  it('preserves per-item crafting notes through a snapshot refresh', async () => {
    const buildData: BuildData = {
      items: { gloves: { type: 'freetext', name: 'GG rare gloves' } },
      itemNotes: { gloves: 'Corrupt for +1 skills' },
      mercenaryNotes: { helmet: 'D-Stone until very fast attack speed' },
    };
    const refreshed = await refreshBuildData(buildData);
    expect(refreshed.itemNotes).toEqual({ gloves: 'Corrupt for +1 skills' });
    expect(refreshed.mercenaryNotes).toEqual({ helmet: 'D-Stone until very fast attack speed' });
  });

  it('leaves the per-slot crafting annotations untouched', async () => {
    const itemCrafts = {
      gloves: [
        { kind: 'forge', forge: 'rune', key: 'r19' },
        { kind: 'dstone', material: 'ppp', uses: 3 },
      ],
    } as const;
    const weaponSwapCrafts = { weapon2: [{ kind: 'corruption', slot: 'weapon', roll: 7 }] } as const;
    const mercenaryCrafts = { helmet: [{ kind: 'meld', material: 'grb', uses: 1 }] } as const;
    const buildData: BuildData = {
      items: { gloves: { type: 'freetext', name: 'GG rare gloves' } },
      itemCrafts,
      weaponSwapCrafts,
      mercenaryCrafts,
    };
    const refreshed = await refreshBuildData(buildData);
    expect(refreshed.itemCrafts).toBe(itemCrafts);
    expect(refreshed.weaponSwapCrafts).toBe(weaponSwapCrafts);
    expect(refreshed.mercenaryCrafts).toBe(mercenaryCrafts);
  });

  it('leaves the level and skill points untouched', async () => {
    const skillPoints = { 'Summon Goatman': 20, 'Demonic Mastery': 1 };
    const buildData: BuildData = { items: { gloves: { type: 'freetext', name: 'GG rare gloves' } }, level: 95, skillPoints };
    const refreshed = await refreshBuildData(buildData);
    expect(refreshed.level).toBe(95);
    expect(refreshed.skillPoints).toBe(skillPoints);
  });
});

describe('refreshBuildData with same-name variants', () => {
  it('keeps the saved variant instead of rewriting it to a same-name sibling', async () => {
    const shared = { name: "Lycander's Aim", baseItem: 'Ceremonial Bow', category: 'Amazon Bow', reqLevel: 42 } as const;
    const rest = { baseItemCode: 'am7', page: 'weapons', itemLevel: 50, gambleItem: '', notes: '' } as const;
    await db.htmUniqueItems.add({ ...shared, ...rest, properties: ['+(50 to 100) to Dexterity'], isAncientCoupon: false });
    await db.htmUniqueItems.add({ ...shared, ...rest, properties: ['-200% Target Defense'], isAncientCoupon: true });

    const refreshed = await refreshBuildData({
      items: { weapon: { type: 'unique', id: 987654, snapshot: { ...shared, properties: ['-200% Target Defense'] } } },
    });
    const weapon = refreshed.items?.weapon;
    expect(weapon?.type === 'unique' && weapon.snapshot.properties).toEqual(['-200% Target Defense']);
  });
});

describe('refreshBuildData with alternatives and variants', () => {
  const stale = (id: number) =>
    ({
      type: 'unique',
      id,
      snapshot: { name: 'Harlequin Crest', baseItem: 'Shako', category: 'Helm', reqLevel: 62, properties: ['STALE'] },
    }) as const;

  async function addShako(): Promise<number> {
    return (await db.htmUniqueItems.add({
      name: 'Harlequin Crest',
      baseItem: 'Shako',
      baseItemCode: 'uap',
      page: 'armors',
      category: 'Helm',
      itemLevel: 69,
      reqLevel: 62,
      properties: ['current'],
      isAncientCoupon: false,
      gambleItem: '',
      notes: '',
    })) as number;
  }

  const propertiesOf = (ref: ItemRef | null | undefined) => (ref?.type === 'unique' ? ref.snapshot.properties : undefined);

  it('refreshes alternatives in all three maps and keeps their note and crafts', async () => {
    const id = await addShako();
    const crafts = [{ kind: 'meld', material: 'grb', uses: 1 }] as const;
    const refreshed = await refreshBuildData({
      itemAlternatives: { helmet: [{ ref: stale(id), note: 'Budget', crafts }, { ref: { type: 'freetext', name: 'Circlet' } }] },
      weaponSwapAlternatives: { weapon2: [{ ref: stale(id) }] },
      mercenaryAlternatives: { helmet: [{ ref: stale(id) }] },
    });
    const [first, second] = refreshed.itemAlternatives?.helmet ?? [];
    expect(propertiesOf(first.ref)).toEqual(['current']);
    expect(first.note).toBe('Budget');
    expect(first.crafts).toBe(crafts);
    expect(second).toEqual({ ref: { type: 'freetext', name: 'Circlet' } });
    expect(propertiesOf(refreshed.weaponSwapAlternatives?.weapon2?.[0].ref)).toEqual(['current']);
    expect(propertiesOf(refreshed.mercenaryAlternatives?.helmet?.[0].ref)).toEqual(['current']);
  });

  it('keeps the stored ref of an alternative that no longer exists', async () => {
    const refreshed = await refreshBuildData({ itemAlternatives: { helmet: [{ ref: stale(99999), note: 'gone' }] } });
    expect(refreshed.itemAlternatives?.helmet).toEqual([{ ref: stale(99999), note: 'gone' }]);
  });

  it('refreshes the main items and alternatives of every extra variant', async () => {
    const id = await addShako();
    const buildData: BuildData = {
      items: { helmet: stale(id) },
      variants: [
        { items: { helmet: stale(id) }, variantName: 'Second', itemNotes: { helmet: 'note' } },
        { mercenaryAlternatives: { helmet: [{ ref: stale(id) }] }, skills: 'Zeal' },
      ],
    };
    const refreshed = await refreshBuildData(buildData);
    expect(propertiesOf(refreshed.items?.helmet)).toEqual(['current']);
    expect(refreshed.variants).toHaveLength(2);
    const [second, third] = refreshed.variants ?? [];
    expect(propertiesOf(second.items?.helmet)).toEqual(['current']);
    expect(second.variantName).toBe('Second');
    expect(second.itemNotes).toEqual({ helmet: 'note' });
    expect(propertiesOf(third.mercenaryAlternatives?.helmet?.[0].ref)).toEqual(['current']);
    expect(third.skills).toBe('Zeal');
  });

  it('adds no variants key to a build without variants', async () => {
    const refreshed = await refreshBuildData({ items: { gloves: { type: 'freetext', name: 'GG rare gloves' } } });
    expect(refreshed).not.toHaveProperty('variants');
    expect(refreshed).not.toHaveProperty('itemAlternatives');
  });
});
