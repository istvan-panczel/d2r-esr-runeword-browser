import { afterEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db';
import type { Affix, Runeword, SocketableBonuses } from '@/core/db';
import type { ItemRef } from '../buildData';
import { itemRefKey, resolveFullItem } from './resolveItem';

afterEach(async () => {
  await Promise.all([db.htmUniqueItems.clear(), db.runewords.clear()]);
});

function affix(rawText: string): Affix {
  return { rawText, pattern: rawText, value: null, valueType: 'none' };
}

const columns: SocketableBonuses = {
  weaponsGloves: [affix('+1 weapon')],
  helmsBoots: [affix('+2 helm')],
  armorShieldsBelts: [affix('+3 armor')],
};

function makeRuneword(): Runeword {
  return {
    name: 'Enigma',
    variant: 1,
    sockets: 3,
    reqLevel: 65,
    sortKey: 0,
    runes: ['Jah', 'Ith', 'Ber'],
    gems: [],
    ingredients: ['Jah', 'Ith', 'Ber'],
    allowedItems: ['Body Armor'],
    excludedItems: [],
    affixes: [],
    columnAffixes: columns,
    tierPointTotals: [],
  };
}

const EMPTY_COLUMNS = { weaponsGloves: [], helmsBoots: [], armorShieldsBelts: [] };

describe('itemRefKey', () => {
  it('produces distinct, stable keys per ref type', () => {
    expect(itemRefKey({ type: 'unique', id: 42, snapshot: { name: '', baseItem: '', category: '', reqLevel: 0, properties: [] } })).toBe(
      'unique:42'
    );
    expect(
      itemRefKey({
        type: 'runeword',
        name: 'Enigma',
        variant: 1,
        snapshot: { sockets: 3, runes: [], gems: [], allowedItems: [], columnAffixes: EMPTY_COLUMNS, reqLevel: 65 },
      })
    ).toBe('runeword:Enigma:1');
    expect(itemRefKey({ type: 'freetext', name: 'GG rare' })).toBe('freetext:GG rare');
  });
});

describe('resolveFullItem', () => {
  it('resolves a unique by id', async () => {
    const id = await db.htmUniqueItems.add({
      name: 'Harlequin Crest',
      baseItem: 'Shako',
      baseItemCode: 'uap',
      page: 'armors',
      category: 'Helm',
      itemLevel: 69,
      reqLevel: 62,
      properties: ['+2 to All Skills'],
      isAncientCoupon: false,
      gambleItem: '',
    });
    const ref: ItemRef = {
      type: 'unique',
      id: id as number,
      snapshot: { name: 'Harlequin Crest', baseItem: 'Shako', category: 'Helm', reqLevel: 62, properties: ['+2 to All Skills'] },
    };

    const resolved = await resolveFullItem(ref);
    expect(resolved?.kind).toBe('unique');
    if (resolved?.kind === 'unique') {
      expect(resolved.item.name).toBe('Harlequin Crest');
      expect(resolved.item.baseItemCode).toBe('uap');
    }
  });

  it('resolves a runeword by name and variant', async () => {
    await db.runewords.add(makeRuneword());
    const ref: ItemRef = {
      type: 'runeword',
      name: 'Enigma',
      variant: 1,
      snapshot: {
        sockets: 3,
        runes: ['Jah', 'Ith', 'Ber'],
        gems: [],
        allowedItems: ['Body Armor'],
        columnAffixes: EMPTY_COLUMNS,
        reqLevel: 65,
      },
    };

    const resolved = await resolveFullItem(ref);
    expect(resolved?.kind).toBe('runeword');
    if (resolved?.kind === 'runeword') {
      expect(resolved.runeword.runes).toEqual(['Jah', 'Ith', 'Ber']);
    }
  });

  it('returns null when the item no longer exists locally', async () => {
    const ref: ItemRef = { type: 'unique', id: 99999, snapshot: { name: 'Gone', baseItem: '', category: '', reqLevel: 1, properties: [] } };
    expect(await resolveFullItem(ref)).toBeNull();
  });

  it('returns null for freetext refs', async () => {
    expect(await resolveFullItem({ type: 'freetext', name: 'GG rare gloves' })).toBeNull();
  });
});
