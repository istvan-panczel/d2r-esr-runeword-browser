import { describe, expect, it } from 'vitest';
import type { SetInfo } from '@/features/game-data/engine/schema';
import type { AlternativesMap, CraftAnnotation, EquipmentSlot, ItemRef, SetItemRef } from '../buildData';
import { freetextRef, setItemToRef } from './buildSnapshot';
import {
  displayedSection,
  sectionHasAlternatives,
  setPiecesIfWorn,
  shownAlternative,
  type DisplayedSectionInput,
} from './displayedSection';
import type { ItemDiff } from './itemDiff';
import { setPieceCounts } from './setBonuses';

function makeSet(id: string, itemNames: readonly string[]): SetInfo {
  return {
    id,
    name: `${id} set`,
    classCode: null,
    className: null,
    reqLevel: { min: 1, max: 1 },
    items: itemNames.map((name) => ({
      name,
      code: 'x',
      baseName: 'Base',
      category: 'Helm',
      level: 1,
      reqLevel: 1,
      lines: [`${name} stat`],
      partial: [{ pieces: 2, lines: [`${name} 2pc`] }],
    })),
    partial: [{ pieces: 2, lines: [`${id} 2 items`] }],
    full: [`${id} full`],
  };
}

const TARA = makeSet('Tara', ['Tara A', 'Tara B', 'Tara C']);

function setRef(index: number): SetItemRef {
  const item = TARA.items[index];
  if (item === undefined) throw new Error('fixture');
  return setItemToRef(item, TARA);
}

const unchanged = (ref: ItemRef): ItemDiff => ({ stored: ref, current: ref, status: 'unchanged' });
const missing = (ref: ItemRef): ItemDiff => ({ stored: ref, current: null, status: 'missing' });

const HELM = freetextRef('Shako');
const HELM_ALT_1 = freetextRef('Crown of Ages');
const HELM_ALT_2 = freetextRef('Andariel');
const ARMOR = freetextRef('Enigma');
const MAIN_CRAFTS: readonly CraftAnnotation[] = [{ kind: 'corruption', slot: 'helm', roll: 1 }];
const ALT_CRAFTS: readonly CraftAnnotation[] = [{ kind: 'meld', material: 'gem', uses: 2 }];

const ALTERNATIVES: AlternativesMap<EquipmentSlot> = {
  helmet: [{ ref: HELM_ALT_1, note: 'CoA note', crafts: ALT_CRAFTS }, { ref: HELM_ALT_2 }],
};

function input(picks: DisplayedSectionInput<EquipmentSlot>['picks']): DisplayedSectionInput<EquipmentSlot> {
  return {
    items: { helmet: HELM, armor: ARMOR },
    notes: { helmet: 'main note', armor: 'armor note' },
    crafts: { helmet: MAIN_CRAFTS },
    diffs: { helmet: unchanged(HELM), armor: unchanged(ARMOR) },
    alternatives: ALTERNATIVES,
    alternativeDiffs: { helmet: [missing(HELM_ALT_1), unchanged(HELM_ALT_2)] },
    picks,
  };
}

describe('displayedSection', () => {
  it('replaces the item, note, crafts and diff with the picked alternative', () => {
    const shown = displayedSection(input({ helmet: 0 }));
    expect(shown.items.helmet).toBe(HELM_ALT_1);
    expect(shown.notes?.helmet).toBe('CoA note');
    expect(shown.crafts?.helmet).toBe(ALT_CRAFTS);
    expect(shown.diffs?.helmet?.status).toBe('missing');
    expect(shown.shownIndex).toEqual({ helmet: 0 });
  });

  it('clears the main note and crafts when the alternative has none', () => {
    const shown = displayedSection(input({ helmet: 1 }));
    expect(shown.items.helmet).toBe(HELM_ALT_2);
    expect(shown.notes).toEqual({ armor: 'armor note' });
    expect(shown.crafts).toEqual({});
    expect(shown.diffs?.helmet).toEqual(unchanged(HELM_ALT_2));
  });

  it('shows the main entry for an absent or -1 pick', () => {
    for (const picks of [{}, { helmet: -1 }]) {
      const source = input(picks);
      const shown = displayedSection(source);
      expect(shown.items).toBe(source.items);
      expect(shown.notes).toBe(source.notes);
      expect(shown.crafts).toBe(source.crafts);
      expect(shown.diffs).toBe(source.diffs);
      expect(shown.shownIndex).toEqual({});
    }
  });

  it('falls back to the main entry for an out-of-range or non-integer pick', () => {
    for (const pick of [2, 9, -2, 0.5]) {
      const shown = displayedSection(input({ helmet: pick }));
      expect(shown.items.helmet).toBe(HELM);
      expect(shown.notes?.helmet).toBe('main note');
      expect(shown.shownIndex).toEqual({});
    }
    // A pick on a slot without alternatives is ignored too.
    expect(displayedSection(input({ armor: 0 })).items.armor).toBe(ARMOR);
  });

  it('leaves slots without alternatives untouched', () => {
    const shown = displayedSection(input({ helmet: 0 }));
    expect(shown.items.armor).toBe(ARMOR);
    expect(shown.notes?.armor).toBe('armor note');
    expect(shown.diffs?.armor).toEqual(unchanged(ARMOR));
  });

  it('keeps the diffs undefined while they are not ready', () => {
    const shown = displayedSection({ ...input({ helmet: 0 }), diffs: undefined, alternativeDiffs: undefined });
    expect(shown.diffs).toBeUndefined();
    expect(shown.items.helmet).toBe(HELM_ALT_1);
  });

  it('drops the diff when the alternative diffs lack the entry', () => {
    const shown = displayedSection({ ...input({ helmet: 0 }), alternativeDiffs: {} });
    expect(shown.diffs).toEqual({ armor: unchanged(ARMOR) });
  });

  it('makes the set piece counts follow the picks', () => {
    const source: DisplayedSectionInput<EquipmentSlot> = {
      items: { helmet: freetextRef('Rare helm'), armor: setRef(1) },
      notes: undefined,
      crafts: undefined,
      diffs: undefined,
      alternatives: { helmet: [{ ref: setRef(0) }], armor: [{ ref: freetextRef('Enigma') }] },
      alternativeDiffs: undefined,
      picks: {},
    };
    expect(Object.fromEntries(setPieceCounts(displayedSection(source).items))).toEqual({ Tara: 1 });
    expect(Object.fromEntries(setPieceCounts(displayedSection({ ...source, picks: { helmet: 0 } }).items))).toEqual({ Tara: 2 });
    expect(Object.fromEntries(setPieceCounts(displayedSection({ ...source, picks: { helmet: 0, armor: 0 } }).items))).toEqual({ Tara: 1 });
  });
});

describe('shownAlternative', () => {
  it('returns the valid index or -1', () => {
    expect(shownAlternative(ALTERNATIVES, 'helmet', 1)).toBe(1);
    expect(shownAlternative(ALTERNATIVES, 'helmet', undefined)).toBe(-1);
    expect(shownAlternative(ALTERNATIVES, 'helmet', 5)).toBe(-1);
    expect(shownAlternative(ALTERNATIVES, 'armor', 0)).toBe(-1);
    expect(shownAlternative(undefined, 'helmet', 0)).toBe(-1);
  });
});

describe('sectionHasAlternatives', () => {
  it('is true only with a non-empty list', () => {
    expect(sectionHasAlternatives(ALTERNATIVES)).toBe(true);
    expect(sectionHasAlternatives({ helmet: [] })).toBe(false);
    expect(sectionHasAlternatives({})).toBe(false);
    expect(sectionHasAlternatives(undefined)).toBe(false);
  });
});

describe('setPiecesIfWorn', () => {
  it('counts the set as if the item replaced the shown one', () => {
    const items = { helmet: setRef(0), armor: setRef(1), gloves: freetextRef('Rare gloves') };
    expect(setPiecesIfWorn(items, 'gloves', setRef(2))).toBe(3);
    // Replacing a piece of the same set keeps the count.
    expect(setPiecesIfWorn(items, 'helmet', setRef(2))).toBe(2);
    expect(setPiecesIfWorn(items, 'gloves', freetextRef('Other'))).toBeUndefined();
  });
});
