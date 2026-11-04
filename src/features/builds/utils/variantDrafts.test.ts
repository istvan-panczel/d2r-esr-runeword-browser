import { describe, expect, it } from 'vitest';
import type { BuildData, CraftAnnotation, ItemRef, VariantData } from '../buildData';
import { ALTERNATIVES_MAX_PER_SLOT, VARIANTS_MAX } from '../constants';
import type { VariantDraft } from '../components/buildFormModel';
import {
  addAlternativeAction,
  addVariantAction,
  buildFormValuesFromBuild,
  draftLabel,
  draftLevelValid,
  draftsToBuildData,
  emptyVariantDraft,
  fromVariantDraft,
  initialVariantDrafts,
  nextVariantName,
  toVariantDraft,
  variantDraftsReducer,
  type SlotTarget,
  type VariantDraftAction,
} from './variantDrafts';

const item = (name: string): ItemRef => ({ type: 'freetext', name });
const forge: CraftAnnotation = { kind: 'forge', forge: 'rune', key: 'r19' };
const meld: CraftAnnotation = { kind: 'meld', material: 'grb', uses: 1 };
const HELMET: SlotTarget = { variant: 0, section: 'player', slot: 'helmet' };

// An old-shape build in the key order the form saved before variants.
const OLD_BUILD: BuildData = {
  items: { helmet: item('Shako'), armor: item('Enigma') },
  weaponSwap: { weapon2: item('CTA') },
  mercenary: { weapon: item('Infinity') },
  itemNotes: { helmet: 'Ber socketed' },
  weaponSwapNotes: { weapon2: 'Any base' },
  mercenaryNotes: { weapon: 'Eth' },
  itemCrafts: { armor: [forge] },
  weaponSwapCrafts: { weapon2: [meld] },
  mercenaryCrafts: { weapon: [forge] },
  charms: ['Annihilus', 'Torch'],
  ascendancy: 'Zealot',
  skills: '20 Blessed Hammer',
  level: 90,
  skillPoints: { pal_hammer: 20 },
};

const run = (state: readonly VariantDraft[], ...actions: VariantDraftAction[]) => actions.reduce(variantDraftsReducer, state);

/** One variant with a Shako main item (note + crafts) and the given alternatives on the helmet. */
function withHelmet(alternatives: readonly { ref: ItemRef | null; note?: string; crafts?: readonly CraftAnnotation[] }[] = []) {
  const draft = toVariantDraft({ items: { helmet: item('Shako') }, itemNotes: { helmet: 'main note' }, itemCrafts: { helmet: [forge] } });
  return [
    {
      ...draft,
      player: {
        ...draft.player,
        alternatives: {
          helmet: alternatives.map((alternative, index) => ({
            key: `k${String(index)}`,
            ref: alternative.ref,
            note: alternative.note ?? '',
            crafts: alternative.crafts ?? [],
          })),
        },
      },
    },
  ];
}

const helmetOf = (state: readonly VariantDraft[], variant = 0) => ({
  item: state[variant].player.items.helmet ?? null,
  note: state[variant].player.notes.helmet ?? '',
  crafts: state[variant].player.crafts.helmet ?? [],
  alternatives: (state[variant].player.alternatives.helmet ?? []).map(({ ref, note, crafts }) => ({ ref, note, crafts })),
});

describe('conversions', () => {
  it('toVariantDraft keeps every field and gives the variant and its alternatives keys', () => {
    const draft = toVariantDraft({
      ...OLD_BUILD,
      itemAlternatives: { helmet: [{ ref: item('Circlet'), note: 'Budget', crafts: [meld] }, { ref: item('Cap') }] },
      variantName: 'Endgame',
      variantNote: 'After Ber',
    });
    expect(draft.key).toMatch(/^variant-/);
    expect(draft.name).toBe('Endgame');
    expect(draft.note).toBe('After Ber');
    expect(draft.player.items).toEqual(OLD_BUILD.items);
    expect(draft.swap.notes).toEqual(OLD_BUILD.weaponSwapNotes);
    expect(draft.merc.crafts).toEqual(OLD_BUILD.mercenaryCrafts);
    expect(draft.player.alternatives.helmet?.map(({ key: _key, ...rest }) => rest)).toEqual([
      { ref: item('Circlet'), note: 'Budget', crafts: [meld] },
      { ref: item('Cap'), note: '', crafts: [] },
    ]);
    expect(new Set(draft.player.alternatives.helmet?.map((alternative) => alternative.key)).size).toBe(2);
    expect(draft.charms.map((charm) => charm.text)).toEqual(['Annihilus', 'Torch']);
    expect(draft.levelText).toBe('90');
    expect(draft.ascendancy).toBe('Zealot');
    expect(draft.skillPoints).toEqual({ pal_hammer: 20 });
  });

  it('toVariantDraft of an empty variant is blank', () => {
    const draft = toVariantDraft({});
    expect(draft).toEqual({ ...emptyVariantDraft(draft.key), name: '', note: '' });
  });

  it('initialVariantDrafts gives at least one draft and at most VARIANTS_MAX', () => {
    expect(initialVariantDrafts([])).toHaveLength(1);
    expect(initialVariantDrafts(Array.from({ length: VARIANTS_MAX + 3 }, () => ({})))).toHaveLength(VARIANTS_MAX);
  });

  it('fromVariantDraft compacts slots, notes, crafts, charms and text like the old form', () => {
    const draft: VariantDraft = {
      ...emptyVariantDraft('x', '  MF  '),
      note: '   ',
      player: {
        items: { helmet: item('Shako'), armor: null },
        notes: { helmet: '  socketed  ', armor: '' },
        crafts: { helmet: [], armor: [forge] },
        alternatives: {},
      },
      charms: [
        { id: 'a', text: ' Torch ' },
        { id: 'b', text: '  ' },
      ],
      skills: '  ',
      levelText: ' 85 ',
    };
    expect(fromVariantDraft(draft)).toEqual({
      items: { helmet: item('Shako') },
      itemNotes: { helmet: 'socketed' },
      itemCrafts: { armor: [forge] },
      charms: ['Torch'],
      level: 85,
      variantName: 'MF',
    });
  });

  it('fromVariantDraft drops unpicked alternatives, trims their notes and drops empty crafts and lists', () => {
    const [draft] = withHelmet([
      { ref: null, note: 'picking' },
      { ref: item('Circlet'), note: '  budget ' },
      { ref: item('Cap'), crafts: [meld] },
    ]);
    const withEmptyList: VariantDraft = {
      ...draft,
      merc: { ...draft.merc, alternatives: { helmet: [{ key: 'z', ref: null, note: '', crafts: [] }] } },
    };
    const data = fromVariantDraft(withEmptyList);
    expect(data.itemAlternatives).toEqual({
      helmet: [
        { ref: item('Circlet'), note: 'budget' },
        { ref: item('Cap'), crafts: [meld] },
      ],
    });
    expect(data).not.toHaveProperty('mercenaryAlternatives');
    expect(data).not.toHaveProperty('weaponSwapAlternatives');
  });

  it('an invalid level is dropped (the form blocks saving it)', () => {
    expect(fromVariantDraft({ ...emptyVariantDraft('x'), levelText: 'abc' })).toEqual({});
    expect(draftLevelValid({ ...emptyVariantDraft('x'), levelText: 'abc' })).toBe(false);
    expect(draftLevelValid({ ...emptyVariantDraft('x'), levelText: ' ' })).toBe(true);
    expect(draftLevelValid({ ...emptyVariantDraft('x'), levelText: '0' })).toBe(false);
    expect(draftLevelValid({ ...emptyVariantDraft('x'), levelText: '99' })).toBe(true);
  });

  it('buildFormValuesFromBuild maps the row and unpacks the variants', () => {
    const values = buildFormValuesFromBuild({
      name: 'Hammerdin',
      description: null,
      class: 'Paladin',
      build_data: { ...OLD_BUILD, variants: [{ skills: 'Zeal', variantName: 'Melee' }] },
    });
    expect(values.name).toBe('Hammerdin');
    expect(values.description).toBe('');
    expect(values.characterClass).toBe('Paladin');
    expect(values.variants).toEqual([OLD_BUILD, { skills: 'Zeal', variantName: 'Melee' }]);
  });

  it('buildFormValuesFromBuild of garbage build_data gives one empty variant', () => {
    const values = buildFormValuesFromBuild({ name: 'x', description: 'd', class: 'Amazon', build_data: null });
    expect(values.variants).toEqual([{}]);
    expect(values.description).toBe('d');
  });

  it('an unchanged old-shape build round-trips byte for byte', () => {
    const values = buildFormValuesFromBuild({ name: 'x', description: '', class: 'Paladin', build_data: OLD_BUILD });
    const saved = draftsToBuildData(initialVariantDrafts(values.variants));
    expect(JSON.stringify(saved)).toBe(JSON.stringify(OLD_BUILD));
  });

  it('an empty create form saves {} and a renamed Default single variant saves without the name', () => {
    expect(draftsToBuildData(initialVariantDrafts([{}]))).toEqual({});
    expect(draftsToBuildData([{ ...emptyVariantDraft('x', 'Default'), skills: 'a' }])).toEqual({ skills: 'a' });
  });

  it('a multi-variant build round-trips', () => {
    const build: BuildData = {
      ...OLD_BUILD,
      itemAlternatives: { helmet: [{ ref: item('Circlet'), note: 'Budget', crafts: [meld] }] },
      variantName: 'Endgame',
      variants: [
        { items: { armor: item('Fortitude') }, variantName: 'Starter', variantNote: 'Early' },
        { skills: 'x', variantName: 'MF' },
      ],
    };
    const values = buildFormValuesFromBuild({ name: 'x', description: '', class: 'Paladin', build_data: build });
    expect(draftsToBuildData(initialVariantDrafts(values.variants))).toEqual(build);
  });

  it('a blank name on a multi-variant build saves as its positional fallback; a single variant saves none', () => {
    const drafts = [emptyVariantDraft('a'), emptyVariantDraft('b', 'MF'), emptyVariantDraft('c', '  ')];
    const saved = draftsToBuildData(drafts);
    expect(saved.variantName).toBe('Default');
    expect(saved.variants?.map((variant) => variant.variantName)).toEqual(['MF', 'Variant 3']);
    expect(draftsToBuildData([{ ...emptyVariantDraft('a'), skills: 'a' }])).toEqual({ skills: 'a' });
  });

  it('draftLabel and nextVariantName use the fallback labels', () => {
    const drafts = [emptyVariantDraft('a'), emptyVariantDraft('b', '  '), emptyVariantDraft('c', 'Variant 4')];
    expect(drafts.map(draftLabel)).toEqual(['Default', 'Variant 2', 'Variant 4']);
    expect(nextVariantName(drafts)).toBe('Variant 5');
    expect(nextVariantName([emptyVariantDraft('a')])).toBe('Variant 2');
  });
});

describe('variant actions', () => {
  const base: readonly VariantDraft[] = [toVariantDraft({ ...OLD_BUILD, variantName: 'A' })];

  it('addVariant copies a variant deeply, with a new key, the given name and new charm ids', () => {
    const state = run(base, addVariantAction('Copy', 0));
    expect(state).toHaveLength(2);
    const [source, copy] = state;
    expect(copy.key).not.toBe(source.key);
    expect(copy.name).toBe('Copy');
    expect(copy.charms.map((charm) => charm.text)).toEqual(source.charms.map((charm) => charm.text));
    for (const [index, charm] of copy.charms.entries()) expect(charm.id).not.toBe(source.charms[index].id);
    expect(copy.player).toEqual(source.player);
    expect(copy.player).not.toBe(source.player);
    expect(copy.player.items.helmet).not.toBe(source.player.items.helmet);
    expect(fromVariantDraft(copy)).toEqual({ ...fromVariantDraft(source), variantName: 'Copy' });
    // Editing the copy leaves the source alone.
    const edited = run(state, { type: 'setSlot', variant: 1, section: 'player', slot: 'helmet', ref: item('Crown') });
    expect(edited[0].player.items.helmet).toEqual(item('Shako'));
  });

  it('addVariant copies alternatives under new keys', () => {
    const state = run(withHelmet([{ ref: item('Circlet') }, { ref: null }]), addVariantAction('Copy', 0));
    const sourceKeys = (state[0].player.alternatives.helmet ?? []).map((alternative) => alternative.key);
    const copyKeys = (state[1].player.alternatives.helmet ?? []).map((alternative) => alternative.key);
    expect(copyKeys).toHaveLength(2);
    for (const key of copyKeys) expect(sourceKeys).not.toContain(key);
    expect(new Set(copyKeys).size).toBe(2);
    expect(helmetOf(state, 1)).toEqual(helmetOf(state, 0));
  });

  it('addVariant names the unnamed variants with their current labels, so a move keeps them', () => {
    const state = run([emptyVariantDraft('a')], addVariantAction('Budget', 'empty'));
    expect(state.map((draft) => draft.name)).toEqual(['Default', 'Budget']);
    const movedState = run(state, { type: 'moveVariant', from: 0, to: 1 });
    expect(movedState.map(draftLabel)).toEqual(['Budget', 'Default']);
    const packed = draftsToBuildData(movedState);
    expect(packed.variantName).toBe('Budget');
    expect(packed.variants?.map((variant) => variant.variantName)).toEqual(['Default']);
  });

  it('addVariant names a blank new variant with nextVariantName and leaves named drafts alone', () => {
    const state = run(base, addVariantAction('  ', 'empty'), addVariantAction('', 0));
    expect(state.map((draft) => draft.name)).toEqual(['A', 'Variant 2', 'Variant 3']);
    expect(state[0]).toBe(base[0]);
    // A blank in the middle keeps its label when the next variant is added.
    const cleared = run(state, { type: 'renameVariant', variant: 1, name: ' ' }, addVariantAction('D', 'empty'));
    expect(cleared.map((draft) => draft.name)).toEqual(['A', 'Variant 2', 'Variant 3', 'D']);
  });

  it('addVariant from Empty starts blank', () => {
    const state = run(base, addVariantAction('Fresh', 'empty'));
    expect(fromVariantDraft(state[1])).toEqual({ variantName: 'Fresh' });
  });

  it('addVariant stops at VARIANTS_MAX and ignores an unknown source', () => {
    const full = run(base, ...Array.from({ length: VARIANTS_MAX + 2 }, () => addVariantAction('x', 'empty')));
    expect(full).toHaveLength(VARIANTS_MAX);
    expect(run(full, addVariantAction('y', 0))).toBe(full);
    expect(run(base, addVariantAction('z', 5))).toBe(base);
  });

  it('renameVariant and setVariantNote edit one variant', () => {
    const state = run(
      base,
      addVariantAction('B', 'empty'),
      { type: 'renameVariant', variant: 1, name: 'Bee' },
      { type: 'setVariantNote', variant: 1, note: 'n' }
    );
    expect(state.map((draft) => draft.name)).toEqual(['A', 'Bee']);
    expect(state[1].note).toBe('n');
    expect(run(base, { type: 'renameVariant', variant: 3, name: 'x' })).toBe(base);
  });

  it('moveVariant reorders, and out of range or same index is a no-op', () => {
    const state = run(base, addVariantAction('B', 'empty'), addVariantAction('C', 'empty'));
    const movedState = run(state, { type: 'moveVariant', from: 2, to: 0 });
    expect(movedState.map((draft) => draft.name)).toEqual(['C', 'A', 'B']);
    expect(run(state, { type: 'moveVariant', from: 0, to: 3 })).toBe(state);
    expect(run(state, { type: 'moveVariant', from: -1, to: 0 })).toBe(state);
    expect(run(state, { type: 'moveVariant', from: 1, to: 1 })).toBe(state);
    // The moved first variant becomes the stored top level.
    const packed = draftsToBuildData(movedState);
    expect(packed.variantName).toBe('C');
    expect(packed.variants?.map((variant) => variant.variantName)).toEqual(['A', 'B']);
  });

  it('deleteVariant removes one, never the last', () => {
    const state = run(base, addVariantAction('B', 'empty'));
    expect(run(state, { type: 'deleteVariant', variant: 0 }).map((draft) => draft.name)).toEqual(['B']);
    expect(run(base, { type: 'deleteVariant', variant: 0 })).toBe(base);
    expect(run(state, { type: 'deleteVariant', variant: 2 })).toBe(state);
  });

  it('the per-variant setters edit only their variant', () => {
    const state = run(
      base,
      addVariantAction('B', 'empty'),
      { type: 'setCharms', variant: 1, charms: [{ id: 'c', text: 'Gheed' }] },
      { type: 'setAscendancy', variant: 1, ascendancy: 'Templar' },
      { type: 'setSkills', variant: 1, skills: 'Zeal' },
      { type: 'setLevelText', variant: 1, levelText: '75' },
      { type: 'setSkillPoints', variant: 1, skillPoints: { zeal: 1 } }
    );
    expect(fromVariantDraft(state[1])).toEqual({
      charms: ['Gheed'],
      ascendancy: 'Templar',
      skills: 'Zeal',
      level: 75,
      skillPoints: { zeal: 1 },
      variantName: 'B',
    });
    expect(state[0]).toBe(base[0]);
  });
});

describe('slot actions', () => {
  it('setSlot replaces the main item and keeps its note and crafts', () => {
    const state = run(withHelmet(), { ...HELMET, type: 'setSlot', ref: item('Crown') });
    expect(helmetOf(state)).toEqual({ item: item('Crown'), note: 'main note', crafts: [forge], alternatives: [] });
  });

  it('setSlot(null) without alternatives clears the note and crafts', () => {
    const state = run(withHelmet(), { ...HELMET, type: 'setSlot', ref: null });
    expect(helmetOf(state)).toEqual({ item: null, note: '', crafts: [], alternatives: [] });
    expect(fromVariantDraft(state[0])).toEqual({});
  });

  it('setSlot(null) promotes the first picked alternative with its note and crafts', () => {
    const state = run(withHelmet([{ ref: null }, { ref: item('Circlet'), note: 'alt', crafts: [meld] }, { ref: item('Cap') }]), {
      ...HELMET,
      type: 'setSlot',
      ref: null,
    });
    expect(helmetOf(state)).toEqual({
      item: item('Circlet'),
      note: 'alt',
      crafts: [meld],
      alternatives: [
        { ref: null, note: '', crafts: [] },
        { ref: item('Cap'), note: '', crafts: [] },
      ],
    });
  });

  it('setSlot(null) with only unpicked alternatives empties the slot', () => {
    const state = run(withHelmet([{ ref: null }]), { ...HELMET, type: 'setSlot', ref: null });
    expect(helmetOf(state)).toEqual({ item: null, note: '', crafts: [], alternatives: [] });
  });

  it('setSlotNote and setSlotCrafts edit the slot of the targeted section', () => {
    const state = run(
      withHelmet(),
      { variant: 0, section: 'merc', slot: 'helmet', type: 'setSlotNote', text: 'merc note' },
      { variant: 0, section: 'swap', slot: 'weapon2', type: 'setSlotCrafts', crafts: [meld] }
    );
    expect(state[0].merc.notes.helmet).toBe('merc note');
    expect(state[0].swap.crafts.weapon2).toEqual([meld]);
    expect(helmetOf(state).note).toBe('main note');
  });

  it('a slot action on an unknown variant is a no-op', () => {
    const state = withHelmet();
    expect(run(state, { ...HELMET, variant: 2, type: 'setSlotNote', text: 'x' })).toBe(state);
  });
});

describe('alternative actions', () => {
  it('addAlternative appends an unpicked entry with the action key', () => {
    const action = addAlternativeAction(HELMET);
    const state = run(withHelmet(), action);
    expect(state[0].player.alternatives.helmet).toEqual([{ key: action.key, ref: null, note: '', crafts: [] }]);
  });

  it('addAlternative needs a main item and stops at ALTERNATIVES_MAX_PER_SLOT', () => {
    const empty = [emptyVariantDraft('x')];
    expect(run(empty, addAlternativeAction(HELMET))).toBe(empty);
    const full = run(withHelmet(), ...Array.from({ length: ALTERNATIVES_MAX_PER_SLOT + 2 }, () => addAlternativeAction(HELMET)));
    expect(full[0].player.alternatives.helmet).toHaveLength(ALTERNATIVES_MAX_PER_SLOT);
    expect(run(full, addAlternativeAction(HELMET))).toBe(full);
  });

  it('setAlternative patches one entry; clearing its item clears its note and crafts', () => {
    const state = run(
      withHelmet([{ ref: null }, { ref: item('Cap') }]),
      { ...HELMET, type: 'setAlternative', position: 0, patch: { ref: item('Circlet') } },
      { ...HELMET, type: 'setAlternative', position: 0, patch: { note: 'budget', crafts: [meld] } },
      { ...HELMET, type: 'setAlternative', position: 1, patch: { note: 'x', crafts: [forge] } }
    );
    expect(helmetOf(state).alternatives).toEqual([
      { ref: item('Circlet'), note: 'budget', crafts: [meld] },
      { ref: item('Cap'), note: 'x', crafts: [forge] },
    ]);
    const cleared = run(state, { ...HELMET, type: 'setAlternative', position: 1, patch: { ref: null } });
    expect(helmetOf(cleared).alternatives[1]).toEqual({ ref: null, note: '', crafts: [] });
    expect(run(state, { ...HELMET, type: 'setAlternative', position: 5, patch: { note: 'x' } })).toBe(state);
  });

  it('removeAlternative drops one entry', () => {
    const state = withHelmet([{ ref: item('A') }, { ref: item('B') }]);
    expect(helmetOf(run(state, { ...HELMET, type: 'removeAlternative', position: 0 })).alternatives.map((a) => a.ref)).toEqual([item('B')]);
    expect(run(state, { ...HELMET, type: 'removeAlternative', position: 2 })).toBe(state);
  });

  it('moveAlternative reorders within bounds only', () => {
    const state = withHelmet([{ ref: item('A') }, { ref: item('B') }, { ref: item('C') }]);
    const names = (next: readonly VariantDraft[]) => helmetOf(next).alternatives.map((alternative) => alternative.ref);
    expect(names(run(state, { ...HELMET, type: 'moveAlternative', from: 0, to: 2 }))).toEqual([item('B'), item('C'), item('A')]);
    expect(names(run(state, { ...HELMET, type: 'moveAlternative', from: 2, to: 1 }))).toEqual([item('A'), item('C'), item('B')]);
    expect(run(state, { ...HELMET, type: 'moveAlternative', from: 0, to: -1 })).toBe(state);
    expect(run(state, { ...HELMET, type: 'moveAlternative', from: 2, to: 3 })).toBe(state);
    expect(run(state, { ...HELMET, type: 'moveAlternative', from: 1, to: 1 })).toBe(state);
    // Keys move with their entries.
    const keys = run(state, { ...HELMET, type: 'moveAlternative', from: 0, to: 1 })[0].player.alternatives.helmet?.map((a) => a.key);
    expect(keys).toEqual(['k1', 'k0', 'k2']);
  });

  it('promoteAlternative swaps the main item with the alternative, note and crafts included', () => {
    const state = run(withHelmet([{ ref: item('Cap') }, { ref: item('Circlet'), note: 'alt', crafts: [meld] }]), {
      ...HELMET,
      type: 'promoteAlternative',
      position: 1,
    });
    expect(helmetOf(state)).toEqual({
      item: item('Circlet'),
      note: 'alt',
      crafts: [meld],
      alternatives: [
        { ref: item('Cap'), note: '', crafts: [] },
        { ref: item('Shako'), note: 'main note', crafts: [forge] },
      ],
    });
  });

  it('promoteAlternative ignores an unpicked or unknown entry', () => {
    const state = withHelmet([{ ref: null }]);
    expect(run(state, { ...HELMET, type: 'promoteAlternative', position: 0 })).toBe(state);
    expect(run(state, { ...HELMET, type: 'promoteAlternative', position: 1 })).toBe(state);
  });

  it('alternatives of every section are saved', () => {
    const swap: SlotTarget = { variant: 0, section: 'swap', slot: 'weapon2' };
    const merc: SlotTarget = { variant: 0, section: 'merc', slot: 'armor' };
    const swapAdd = addAlternativeAction(swap);
    const mercAdd = addAlternativeAction(merc);
    const state = run(
      [emptyVariantDraft('x')],
      { ...swap, type: 'setSlot', ref: item('CTA') },
      swapAdd,
      { ...swap, type: 'setAlternative', position: 0, patch: { ref: item('Spirit') } },
      { ...merc, type: 'setSlot', ref: item('Fortitude') },
      mercAdd,
      { ...merc, type: 'setAlternative', position: 0, patch: { ref: item('Treachery'), note: 'cheap' } }
    );
    const data: VariantData = fromVariantDraft(state[0]);
    expect(data.weaponSwapAlternatives).toEqual({ weapon2: [{ ref: item('Spirit') }] });
    expect(data.mercenaryAlternatives).toEqual({ armor: [{ ref: item('Treachery'), note: 'cheap' }] });
  });
});
