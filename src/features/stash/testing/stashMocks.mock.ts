/**
 * Hand-built stash data for the stash engine tests: items, sections, files and a stash.json bundle with only the parts
 * a test sets. Everything not given has its "not in the save" value (`emptyItem`), so a test states only what matters.
 */
import type { StashBundle } from '@/features/game-data/engine/schema';
import { emptyItem } from '../parser/parseItem';
import type { StashFile, StashItem, StashSection, StashTabType } from '../parser/types';

/** A complete (not compact) identified normal item of `code`, 1 × 1, at 0,0 of section 0, unless `fields` say otherwise. */
export function makeItem(code: string, fields: Partial<StashItem> = {}): StashItem {
  return {
    ...emptyItem({ section: fields.section ?? 0, index: fields.index ?? 0 }, 0),
    code,
    identified: true,
    quality: 'normal',
    level: 1,
    width: 1,
    height: 1,
    ...fields,
  };
}

/** A section (page `index + 1` for the normal tab type); its items are moved into it (`section` set to `index`). */
export function makeSection(index: number, items: StashItem[], tabType: StashTabType = 'normal'): StashSection {
  return {
    index,
    offset: 0,
    byteSize: 0,
    tabType,
    gold: 0,
    items: items.map((item, i) => ({ ...item, section: index, index: i })),
    chronicle: null,
  };
}

export function makeStash(sections: StashSection[]): StashFile {
  return { stashFormat: 2, version: 0x44520005, sections };
}

/** A stash.json with empty tables, a 16 × 13 grid and whatever `parts` give. */
export function makeBundle(parts: Partial<StashBundle> = {}): StashBundle {
  return {
    grid: { width: 16, height: 13 },
    stats: [],
    items: [],
    coupons: [],
    couponTiers: [],
    bases: [],
    uniques: [],
    setItems: [],
    sets: [],
    runewords: [],
    ...parts,
  };
}
