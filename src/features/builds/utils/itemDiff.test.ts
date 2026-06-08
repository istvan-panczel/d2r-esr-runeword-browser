import { afterEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db';
import type { BuildData, ItemRef } from '../buildData';
import { computeBuildItemDiffs, diffRef, refSnapshotsEqual } from './itemDiff';

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
