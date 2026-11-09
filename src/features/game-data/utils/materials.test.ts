import { describe, expect, it } from 'vitest';
import type { MaterialItem, MaterialsBundle } from '../engine/schema';
import {
  buildMaterialsTree,
  cubeFamilyHref,
  encodeMaterialsState,
  enhanceHref,
  filterMaterialsTree,
  itemGuideNotes,
  levelText,
  readMaterialsState,
  type MaterialsState,
} from './materials';

function item(code: string, name: string, group: string, block: string, extra: Partial<MaterialItem> = {}): MaterialItem {
  return {
    code,
    name,
    group,
    block,
    level: 0,
    levelreq: 0,
    stackable: false,
    spawnable: true,
    sources: [],
    usedIn: [],
    madeBy: [],
    ...extra,
  };
}

const bundle: MaterialsBundle = {
  groups: [
    {
      code: 'sock',
      label: 'Socket Fillers',
      blocks: [
        { code: 'gem', label: 'Gem' },
        { code: 'rune', label: 'Rune' },
      ],
    },
    { code: 'body', label: 'Body Parts (Organs)', blocks: [{ code: 'body', label: 'Body Part' }] },
    { code: 'empty', label: 'Empty', blocks: [{ code: 'empty', label: 'Empty' }] },
  ],
  families: [
    { id: 'gem-upgrade', label: 'Gem upgrades' },
    { id: 'tinkering', label: 'Tinkering with organs' },
  ],
  items: [
    item('gpr', 'Perfect Ruby', 'sock', 'gem', {
      grade: 'Perfect',
      madeBy: [{ family: 'gem-upgrade', recipes: 1 }],
      sources: [{ kind: 'drop', text: 'Drops (random)' }],
    }),
    item('r01', 'El Rune', 'sock', 'rune', { level: 11, levelreq: 11 }),
    item('hrt', 'Heart', 'body', 'body', {
      usedIn: [{ family: 'tinkering', recipes: 2 }],
      enhance: [{ tab: 'anointment', slot: 'charm', label: 'Unique charm anointment' }],
    }),
  ],
};

const labels = new Map(bundle.families.map((family) => [family.id, family.label]));
const familyLabel = (id: string) => labels.get(id) ?? id;
const tree = buildMaterialsTree(bundle);
const state = (patch: Partial<MaterialsState>): MaterialsState => ({ search: '', group: null, name: null, ...patch });
const shownCodes = (patch: Partial<MaterialsState>) =>
  filterMaterialsTree(tree, state(patch), familyLabel).flatMap((view) =>
    view.blocks.flatMap((block) => block.items.map((entry) => entry.code))
  );

describe('materials URL state', () => {
  it('reads search, group and name; an unknown group shows all', () => {
    expect(readMaterialsState(new URLSearchParams('search=ruby&group=sock&name=El%20Rune'), bundle)).toEqual({
      search: 'ruby',
      group: 'sock',
      name: 'El Rune',
    });
    expect(readMaterialsState(new URLSearchParams('group=nope&name=%20'), bundle)).toEqual({ search: '', group: null, name: null });
  });

  it('encodes only the set values', () => {
    expect(encodeMaterialsState(state({ search: ' heart ', group: 'body' })).toString()).toBe('group=body&search=heart');
    expect(encodeMaterialsState(state({})).toString()).toBe('');
  });
});

describe('materials tree and search', () => {
  it('builds groups and blocks in bundle order, without empty ones', () => {
    expect(tree.map((view) => [view.group.code, view.blocks.map((block) => block.code)])).toEqual([
      ['sock', ['gem', 'rune']],
      ['body', ['body']],
    ]);
  });

  it('keeps a whole group or block whose label matches, else filters items by their texts', () => {
    expect(shownCodes({ search: 'socket' })).toEqual(['gpr', 'r01']);
    expect(shownCodes({ search: 'rune' })).toEqual(['r01']);
    expect(shownCodes({ search: 'gem upgrades' })).toEqual(['gpr']); // a family that makes it
    expect(shownCodes({ search: 'tinkering' })).toEqual(['hrt']); // a family that uses it
    expect(shownCodes({ search: 'anointment' })).toEqual(['hrt']); // an Enhance role
    expect(shownCodes({ search: 'drops perfect' })).toEqual(['gpr']);
    expect(shownCodes({ search: '"el rune" heart' })).toEqual([]);
  });

  it('filters by group, and the exact name ignores the other filters', () => {
    expect(shownCodes({ group: 'body' })).toEqual(['hrt']);
    expect(shownCodes({ group: 'body', search: 'ruby', name: 'el  rune' })).toEqual(['r01']);
  });
});

describe('materials links', () => {
  it('links cube families and Enhance tabs', () => {
    expect(cubeFamilyHref('other:anya-s-gift')).toBe('/cube-recipes?family=other%3Aanya-s-gift');
    expect(enhanceHref({ tab: 'anointment', slot: 'charm', label: 'x' })).toBe('/enhance?tab=anointment&slot=charm');
    expect(enhanceHref({ tab: 'vessel', label: 'x' })).toBe('/enhance?tab=vessel');
  });

  it('joins the guide notes of the item and of the family making most of it, known notes only', () => {
    const index = { itemNotes: { gpr: ['gems', 'gone'] }, familyNotes: { 'gem-upgrade': ['gems-crystals', 'gems'] } };
    const known = new Set(['gems', 'gems-crystals']);
    expect(itemGuideNotes(bundle.items[0] as MaterialItem, index, known)).toEqual(['gems', 'gems-crystals']);
    expect(itemGuideNotes(bundle.items[1] as MaterialItem, index, known)).toEqual([]);
    expect(itemGuideNotes(bundle.items[0] as MaterialItem, null, known)).toEqual([]);
  });

  it('formats the levels, leaving out zeros', () => {
    expect(levelText({ level: 11, levelreq: 11 })).toBe('lvl 11 · req 11');
    expect(levelText({ level: 96, levelreq: 0 })).toBe('lvl 96');
    expect(levelText({ level: 0, levelreq: 0 })).toBe('');
  });
});
