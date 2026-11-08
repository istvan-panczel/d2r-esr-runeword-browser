import { describe, expect, it } from 'vitest';
import type { DraftReviewRow } from '@/features/character/engine/buildDraft';
import type { ItemRef } from '../buildData';
import { isReviewRowOpen, openReviewRows, reviewRowSlotLabel } from './saveImportReview';
import { emptyVariantDraft, variantDraftsReducer } from './variantDrafts';

const custom: ItemRef = { type: 'freetext', name: 'Spirit Hand (Demonhide Gloves)' };
const row: DraftReviewRow = {
  id: 'merc:gloves',
  severity: 'fix',
  section: 'merc',
  slot: 'gloves',
  name: 'Spirit Hand',
  base: 'Demonhide Gloves',
  kindLabel: 'Rare',
  stats: [],
  message: null,
  ref: custom,
};
const target = { variant: 0, section: 'merc', slot: 'gloves' } as const;

function draftWith(ref: ItemRef | null) {
  const empty = emptyVariantDraft('variant-1');
  return { ...empty, merc: { ...empty.merc, items: { gloves: ref } } };
}

describe('saveImportReview', () => {
  it('labels a row by section and slot', () => {
    expect(reviewRowSlotLabel(row)).toBe('Mercenary · Gloves');
    expect(reviewRowSlotLabel({ section: 'swap', slot: 'weapon2' })).toBe('Weapon Swap · Weapon');
  });

  it('keeps a row open while the slot holds the imported item', () => {
    expect(isReviewRowOpen(row, draftWith(custom))).toBe(true);
  });

  it('resolves a row when the slot is replaced or cleared through the reducer', () => {
    const replaced = variantDraftsReducer([draftWith(custom)], { ...target, type: 'setSlot', ref: { type: 'freetext', name: 'Other' } });
    expect(openReviewRows([row], replaced[0], new Set())).toEqual([]);
    const cleared = variantDraftsReducer([draftWith(custom)], { ...target, type: 'setSlot', ref: null });
    expect(openReviewRows([row], cleared[0], new Set())).toEqual([]);
  });

  it('drops a dismissed row (Keep as custom) and every row of a deleted variant', () => {
    expect(openReviewRows([row], draftWith(custom), new Set(['merc:gloves']))).toEqual([]);
    expect(openReviewRows([row], undefined, new Set())).toEqual([]);
  });
});
