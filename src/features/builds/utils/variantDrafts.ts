// Pure state of the build editor: one draft per variant, the reducer BuildForm dispatches to, and the
// conversions between drafts and the stored VariantData (see utils/buildVariants for the packing).

import type { Build } from '@/core/supabase';
import {
  asBuildData,
  type AlternativesMap,
  type BuildData,
  type CraftAnnotation,
  type EquipmentSlot,
  type ItemAlternative,
  type ItemRef,
  type VariantData,
  type WeaponSwapSlot,
} from '../buildData';
import type { StatKey, StatsDifficulty } from '../buildStats';
import { ALTERNATIVES_MAX_PER_SLOT, VARIANTS_MAX, type CharacterClass } from '../constants';
import type { BuildFormValues, DraftAlternative, GearSection, SectionDraft, StatsDraft, VariantDraft } from '../components/buildFormModel';
import { compactItems, compactNotes } from './buildSnapshot';
import { packVariants, unpackVariants, variantLabel } from './buildVariants';
import { charmTexts, newCharmEntry, toCharmEntries, type CharmEntry } from './charms';
import { compactCrafts } from './crafts';
import { hasSkillPoints, parseLevelText, type SkillPoints } from './skillTree';
import { fromStatsDraft, statsDraftValid, toStatsDraft } from './statsDraft';

let draftKeyCounter = 0;

/** A fresh ephemeral key for a variant or alternative draft (React keys only, never stored). */
export function newDraftKey(prefix: 'variant' | 'alt'): string {
  draftKeyCounter += 1;
  return `${prefix}-${String(draftKeyCounter)}`;
}

function emptySection<K extends string>(): SectionDraft<K> {
  return { items: {}, notes: {}, crafts: {}, alternatives: {} };
}

/** A variant with nothing in it. */
export function emptyVariantDraft(key: string, name = ''): VariantDraft {
  return {
    key,
    name,
    note: '',
    player: emptySection(),
    swap: emptySection(),
    merc: emptySection(),
    charms: [],
    ascendancy: null,
    skills: '',
    levelText: '',
    skillPoints: {},
    stats: null,
  };
}

// --- Conversions ---------------------------------------------------------------------------------------------------

function toSectionDraft<K extends string>(
  items: Partial<Record<K, ItemRef | null>> | undefined,
  notes: Partial<Record<K, string>> | undefined,
  crafts: Partial<Record<K, readonly CraftAnnotation[]>> | undefined,
  alternatives: AlternativesMap<K> | undefined
): SectionDraft<K> {
  const draftAlternatives: Partial<Record<K, readonly DraftAlternative[]>> = {};
  for (const slot of Object.keys(alternatives ?? {}) as K[]) {
    draftAlternatives[slot] = (alternatives?.[slot] ?? []).map((alternative) => ({
      key: newDraftKey('alt'),
      ref: alternative.ref,
      note: alternative.note ?? '',
      crafts: alternative.crafts ?? [],
    }));
  }
  return { items: { ...items }, notes: { ...notes }, crafts: { ...crafts }, alternatives: draftAlternatives };
}

/** The editable form of a stored variant. */
export function toVariantDraft(variant: VariantData): VariantDraft {
  return {
    key: newDraftKey('variant'),
    name: variant.variantName ?? '',
    note: variant.variantNote ?? '',
    player: toSectionDraft(variant.items, variant.itemNotes, variant.itemCrafts, variant.itemAlternatives),
    swap: toSectionDraft(variant.weaponSwap, variant.weaponSwapNotes, variant.weaponSwapCrafts, variant.weaponSwapAlternatives),
    merc: toSectionDraft(variant.mercenary, variant.mercenaryNotes, variant.mercenaryCrafts, variant.mercenaryAlternatives),
    charms: toCharmEntries(variant.charms ?? []),
    ascendancy: variant.ascendancy ?? null,
    skills: variant.skills ?? '',
    levelText: variant.level !== undefined ? String(variant.level) : '',
    skillPoints: variant.skillPoints ?? {},
    stats: toStatsDraft(variant.stats),
  };
}

/** The form's drafts for its initial values (at least one, at most VARIANTS_MAX). */
export function initialVariantDrafts(variants: readonly VariantData[]): readonly VariantDraft[] {
  const list = variants.length > 0 ? variants.slice(0, VARIANTS_MAX) : [{}];
  return list.map(toVariantDraft);
}

/** Alternatives with a picked item, notes trimmed (blank dropped), empty crafts and empty lists dropped. */
function compactAlternatives<K extends string>(alternatives: Partial<Record<K, readonly DraftAlternative[]>>): AlternativesMap<K> {
  const result: Partial<Record<K, readonly ItemAlternative[]>> = {};
  for (const slot of Object.keys(alternatives) as K[]) {
    const list = (alternatives[slot] ?? []).flatMap((alternative): ItemAlternative[] => {
      if (alternative.ref === null) return [];
      const note = alternative.note.trim();
      return [
        {
          ref: alternative.ref,
          ...(note.length > 0 ? { note } : {}),
          ...(alternative.crafts.length > 0 ? { crafts: alternative.crafts } : {}),
        },
      ];
    });
    if (list.length > 0) result[slot] = list;
  }
  return result;
}

const nonEmpty = (map: object): boolean => Object.keys(map).length > 0;

/**
 * The stored form of a draft: empty slots, blank notes, empty crafts and blank charms dropped, text trimmed, the
 * level parsed. The first 14 keys keep the order the form saved before variants, so an unchanged build saves the same;
 * `stats` comes last for the same reason (a build saved before it existed keeps its key order).
 */
export function fromVariantDraft(draft: VariantDraft): VariantData {
  const items = compactItems(draft.player.items);
  const weaponSwap = compactItems(draft.swap.items);
  const mercenary = compactItems(draft.merc.items);
  const itemNotes = compactNotes(draft.player.notes);
  const weaponSwapNotes = compactNotes(draft.swap.notes);
  const mercenaryNotes = compactNotes(draft.merc.notes);
  const itemCrafts = compactCrafts(draft.player.crafts);
  const weaponSwapCrafts = compactCrafts(draft.swap.crafts);
  const mercenaryCrafts = compactCrafts(draft.merc.crafts);
  const itemAlternatives = compactAlternatives(draft.player.alternatives);
  const weaponSwapAlternatives = compactAlternatives(draft.swap.alternatives);
  const mercenaryAlternatives = compactAlternatives(draft.merc.alternatives);
  const charms = charmTexts(draft.charms);
  const skills = draft.skills.trim();
  const level = parseLevelText(draft.levelText);
  const variantName = draft.name.trim();
  const variantNote = draft.note.trim();
  const stats = fromStatsDraft(draft.stats);
  return {
    ...(nonEmpty(items) ? { items } : {}),
    ...(nonEmpty(weaponSwap) ? { weaponSwap } : {}),
    ...(nonEmpty(mercenary) ? { mercenary } : {}),
    ...(nonEmpty(itemNotes) ? { itemNotes } : {}),
    ...(nonEmpty(weaponSwapNotes) ? { weaponSwapNotes } : {}),
    ...(nonEmpty(mercenaryNotes) ? { mercenaryNotes } : {}),
    ...(nonEmpty(itemCrafts) ? { itemCrafts } : {}),
    ...(nonEmpty(weaponSwapCrafts) ? { weaponSwapCrafts } : {}),
    ...(nonEmpty(mercenaryCrafts) ? { mercenaryCrafts } : {}),
    ...(charms.length > 0 ? { charms } : {}),
    ...(draft.ascendancy !== null ? { ascendancy: draft.ascendancy } : {}),
    ...(skills.length > 0 ? { skills } : {}),
    ...(level !== undefined ? { level } : {}),
    ...(hasSkillPoints(draft.skillPoints) ? { skillPoints: draft.skillPoints } : {}),
    ...(nonEmpty(itemAlternatives) ? { itemAlternatives } : {}),
    ...(nonEmpty(weaponSwapAlternatives) ? { weaponSwapAlternatives } : {}),
    ...(nonEmpty(mercenaryAlternatives) ? { mercenaryAlternatives } : {}),
    ...(variantName.length > 0 ? { variantName } : {}),
    ...(variantNote.length > 0 ? { variantNote } : {}),
    ...(stats !== undefined ? { stats } : {}),
  };
}

/**
 * The build_data the form saves. With more than one variant a blank name is saved as its fallback label, so a stored
 * name never depends on the variant's position (a later reorder keeps every label).
 */
export function draftsToBuildData(drafts: readonly VariantDraft[]): BuildData {
  const named = drafts.length > 1 ? withFallbackNames(drafts) : drafts;
  return packVariants(named.map(fromVariantDraft));
}

/** The edit form's initial values for a stored build. */
export function buildFormValuesFromBuild(
  build: Pick<Build, 'name' | 'description' | 'class'> & { readonly build_data: unknown }
): BuildFormValues {
  return {
    name: build.name,
    description: build.description ?? '',
    characterClass: build.class as CharacterClass,
    variants: unpackVariants(asBuildData(build.build_data)),
  };
}

/** The tab label of a draft: its trimmed name, else the fallback (variantLabel). */
export function draftLabel(draft: VariantDraft, index: number): string {
  const name = draft.name.trim();
  return name.length > 0 ? name : variantLabel({}, index);
}

/** Whether the draft's level text is blank or a valid level. */
export function draftLevelValid(draft: VariantDraft): boolean {
  return draft.levelText.trim() === '' || parseLevelText(draft.levelText) !== undefined;
}

/** Whether the draft's stats block is absent or holds only valid numbers. */
export function draftStatsValid(draft: VariantDraft): boolean {
  return statsDraftValid(draft.stats);
}

/** The drafts with every blank name set to its current fallback label (the same array when all are named). */
function withFallbackNames(drafts: readonly VariantDraft[]): readonly VariantDraft[] {
  if (drafts.every((draft) => draft.name.trim().length > 0)) return drafts;
  return drafts.map((draft, index) => (draft.name.trim().length > 0 ? draft : { ...draft, name: draftLabel(draft, index) }));
}

/** The suggested name of a new variant: "Variant N" for the first N from count + 1 that no tab is labelled with. */
export function nextVariantName(drafts: readonly VariantDraft[]): string {
  const labels = new Set(drafts.map(draftLabel));
  let n = drafts.length + 1;
  while (labels.has(`Variant ${String(n)}`)) n += 1;
  return `Variant ${String(n)}`;
}

// --- Reducer -------------------------------------------------------------------------------------------------------

/** One slot of one gear section of one variant. */
export interface SlotTarget {
  readonly variant: number;
  readonly section: GearSection;
  readonly slot: EquipmentSlot | WeaponSwapSlot;
}

export type AlternativePatch = Partial<Pick<DraftAlternative, 'ref' | 'note' | 'crafts'>>;

export type VariantDraftAction =
  | { readonly type: 'addVariant'; readonly key: string; readonly name: string; readonly from: number | 'empty' }
  | { readonly type: 'renameVariant'; readonly variant: number; readonly name: string }
  | { readonly type: 'setVariantNote'; readonly variant: number; readonly note: string }
  | { readonly type: 'moveVariant'; readonly from: number; readonly to: number }
  | { readonly type: 'deleteVariant'; readonly variant: number }
  | (SlotTarget & { readonly type: 'setSlot'; readonly ref: ItemRef | null })
  | (SlotTarget & { readonly type: 'setSlotNote'; readonly text: string })
  | (SlotTarget & { readonly type: 'setSlotCrafts'; readonly crafts: readonly CraftAnnotation[] })
  | (SlotTarget & { readonly type: 'addAlternative'; readonly key: string })
  | (SlotTarget & { readonly type: 'setAlternative'; readonly position: number; readonly patch: AlternativePatch })
  | (SlotTarget & { readonly type: 'removeAlternative'; readonly position: number })
  | (SlotTarget & { readonly type: 'moveAlternative'; readonly from: number; readonly to: number })
  | (SlotTarget & { readonly type: 'promoteAlternative'; readonly position: number })
  | { readonly type: 'setCharms'; readonly variant: number; readonly charms: readonly CharmEntry[] }
  | { readonly type: 'setAscendancy'; readonly variant: number; readonly ascendancy: string | null }
  | { readonly type: 'setSkills'; readonly variant: number; readonly skills: string }
  | { readonly type: 'setLevelText'; readonly variant: number; readonly levelText: string }
  | { readonly type: 'setSkillPoints'; readonly variant: number; readonly skillPoints: SkillPoints }
  /** Replaces the whole stats block: a hand-made empty one, one computed from a save, or null to clear it */
  | { readonly type: 'setStats'; readonly variant: number; readonly stats: StatsDraft | null }
  | { readonly type: 'setStatValue'; readonly variant: number; readonly key: StatKey; readonly text: string }
  | { readonly type: 'setStatsDifficulty'; readonly variant: number; readonly difficulty: StatsDifficulty }
  | { readonly type: 'setStatsBuffed'; readonly variant: number; readonly buffed: boolean }
  /**
   * Stats read from a save file for the variant with this draft key: by key, because the file is read asynchronously and
   * the variant may have moved or been deleted meanwhile (then, or when it has stats by now, nothing happens)
   */
  | { readonly type: 'setStatsFromSave'; readonly variantKey: string; readonly stats: StatsDraft }
  /** Whether the character's name is stored with save-derived stats (not a change of the numbers) */
  | { readonly type: 'setStatsShowCharacter'; readonly variant: number; readonly show: boolean };

/** An addVariant action with a fresh key (the new variant is appended, so it lands at the old length). */
export function addVariantAction(name: string, from: number | 'empty'): VariantDraftAction {
  return { type: 'addVariant', key: newDraftKey('variant'), name, from };
}

/** An addAlternative action with a fresh key, so the caller can expand the new row. */
export function addAlternativeAction(target: SlotTarget): VariantDraftAction & { readonly key: string } {
  return { ...target, type: 'addAlternative', key: newDraftKey('alt') };
}

interface SlotState {
  readonly item: ItemRef | null;
  readonly note: string;
  readonly crafts: readonly CraftAnnotation[];
  readonly alternatives: readonly DraftAlternative[];
}

type AnySection = SectionDraft<string>;

function sectionOf(draft: VariantDraft, section: GearSection): AnySection {
  return draft[section];
}

function withSection(draft: VariantDraft, section: GearSection, next: AnySection): VariantDraft {
  switch (section) {
    case 'player':
      return { ...draft, player: next };
    case 'swap':
      return { ...draft, swap: next };
    case 'merc':
      return { ...draft, merc: next };
  }
}

function readSlot(section: AnySection, slot: string): SlotState {
  return {
    item: section.items[slot] ?? null,
    note: section.notes[slot] ?? '',
    crafts: section.crafts[slot] ?? [],
    alternatives: section.alternatives[slot] ?? [],
  };
}

function writeSlot(section: AnySection, slot: string, state: SlotState): AnySection {
  return {
    items: { ...section.items, [slot]: state.item },
    notes: { ...section.notes, [slot]: state.note },
    crafts: { ...section.crafts, [slot]: state.crafts },
    alternatives: { ...section.alternatives, [slot]: state.alternatives },
  };
}

const inRange = (index: number, length: number): boolean => Number.isInteger(index) && index >= 0 && index < length;

function moved<T>(list: readonly T[], from: number, to: number): readonly T[] | null {
  if (from === to || !inRange(from, list.length) || !inRange(to, list.length)) return null;
  const next = [...list];
  const [entry] = next.splice(from, 1);
  next.splice(to, 0, entry);
  return next;
}

function updateVariant(
  state: readonly VariantDraft[],
  index: number,
  update: (draft: VariantDraft) => VariantDraft
): readonly VariantDraft[] {
  if (!inRange(index, state.length)) return state;
  return state.map((draft, position) => (position === index ? update(draft) : draft));
}

/** Applies `update` to one slot; a null result leaves the state unchanged (the same array). */
function updateSlot(
  state: readonly VariantDraft[],
  target: SlotTarget,
  update: (slot: SlotState) => SlotState | null
): readonly VariantDraft[] {
  const draft = inRange(target.variant, state.length) ? state[target.variant] : undefined;
  if (draft === undefined) return state;
  const section = sectionOf(draft, target.section);
  const next = update(readSlot(section, target.slot));
  if (next === null) return state;
  return updateVariant(state, target.variant, () => withSection(draft, target.section, writeSlot(section, target.slot, next)));
}

/** A copy of the section with new alternative keys (two drafts never share a React key). */
function withNewAlternativeKeys<K extends string>(section: SectionDraft<K>): SectionDraft<K> {
  const alternatives: Partial<Record<K, readonly DraftAlternative[]>> = {};
  for (const slot of Object.keys(section.alternatives) as K[]) {
    alternatives[slot] = (section.alternatives[slot] ?? []).map((alternative) => ({ ...alternative, key: newDraftKey('alt') }));
  }
  return { ...section, alternatives };
}

/** A deep copy of `source` under a new key and name, with new charm ids and alternative keys. */
function copyDraft(source: VariantDraft, key: string, name: string): VariantDraft {
  const copy = structuredClone(source);
  return {
    ...copy,
    key,
    name,
    player: withNewAlternativeKeys(copy.player),
    swap: withNewAlternativeKeys(copy.swap),
    merc: withNewAlternativeKeys(copy.merc),
    charms: copy.charms.map((charm) => newCharmEntry(charm.text)),
  };
}

/** Clearing the main item promotes the first alternative with an item (with its note and crafts); without one the slot empties. */
function clearMain(slot: SlotState): SlotState {
  const promotedAt = slot.alternatives.findIndex((alternative) => alternative.ref !== null);
  if (promotedAt === -1) return { item: null, note: '', crafts: [], alternatives: [] };
  const promoted = slot.alternatives[promotedAt];
  return {
    item: promoted.ref,
    note: promoted.note,
    crafts: promoted.crafts,
    alternatives: slot.alternatives.filter((_, position) => position !== promotedAt),
  };
}

/** Swaps the alternative at `position` with the main item, notes and crafts included. Null when it has no item. */
function promote(slot: SlotState, position: number): SlotState | null {
  const alternative = inRange(position, slot.alternatives.length) ? slot.alternatives[position] : undefined;
  if (alternative === undefined || alternative.ref === null) return null;
  const { item } = slot;
  const alternatives =
    item === null
      ? slot.alternatives.filter((_, index) => index !== position)
      : slot.alternatives.map((entry, index) =>
          index === position ? { key: entry.key, ref: item, note: slot.note, crafts: slot.crafts } : entry
        );
  return { item: alternative.ref, note: alternative.note, crafts: alternative.crafts, alternatives };
}

/**
 * Applies a change to a variant's stats block; no block, or a change that changes nothing, leaves the state unchanged.
 * A change to save-derived stats marks them edited (sticky: changing a number back keeps the mark).
 */
function updateStats(
  state: readonly VariantDraft[],
  index: number,
  patch: (stats: StatsDraft) => Partial<Pick<StatsDraft, 'values' | 'difficulty' | 'buffed'>> | null
): readonly VariantDraft[] {
  const stats = inRange(index, state.length) ? state[index].stats : null;
  if (stats === null) return state;
  const change = patch(stats);
  if (change === null) return state;
  const next: StatsDraft = { ...stats, ...change, edited: stats.edited || stats.source === 'save' };
  return updateVariant(state, index, (draft) => ({ ...draft, stats: next }));
}

function patchAlternative(alternative: DraftAlternative, patch: AlternativePatch): DraftAlternative {
  // Clearing an alternative's item clears its note and crafts, like the main item.
  if (patch.ref === null) return { ...alternative, ...patch, note: '', crafts: [] };
  return { ...alternative, ...patch };
}

export function variantDraftsReducer(state: readonly VariantDraft[], action: VariantDraftAction): readonly VariantDraft[] {
  switch (action.type) {
    case 'addVariant': {
      if (state.length >= VARIANTS_MAX) return state;
      if (action.from !== 'empty' && !inRange(action.from, state.length)) return state;
      // Unnamed variants keep the label they had (the first stays "Default"), so a later move never relabels them.
      const named = withFallbackNames(state);
      const name = action.name.trim().length > 0 ? action.name : nextVariantName(named);
      const added = action.from === 'empty' ? emptyVariantDraft(action.key, name) : copyDraft(named[action.from], action.key, name);
      return [...named, added];
    }
    case 'renameVariant':
      return updateVariant(state, action.variant, (draft) => ({ ...draft, name: action.name }));
    case 'setVariantNote':
      return updateVariant(state, action.variant, (draft) => ({ ...draft, note: action.note }));
    case 'moveVariant':
      return moved(state, action.from, action.to) ?? state;
    case 'deleteVariant':
      if (state.length <= 1 || !inRange(action.variant, state.length)) return state;
      return state.filter((_, index) => index !== action.variant);
    case 'setSlot': {
      const { ref } = action;
      return updateSlot(state, action, (slot) => (ref === null ? clearMain(slot) : { ...slot, item: ref }));
    }
    case 'setSlotNote':
      return updateSlot(state, action, (slot) => ({ ...slot, note: action.text }));
    case 'setSlotCrafts':
      return updateSlot(state, action, (slot) => ({ ...slot, crafts: action.crafts }));
    case 'addAlternative':
      return updateSlot(state, action, (slot) =>
        slot.item === null || slot.alternatives.length >= ALTERNATIVES_MAX_PER_SLOT
          ? null
          : { ...slot, alternatives: [...slot.alternatives, { key: action.key, ref: null, note: '', crafts: [] }] }
      );
    case 'setAlternative':
      return updateSlot(state, action, (slot) =>
        inRange(action.position, slot.alternatives.length)
          ? {
              ...slot,
              alternatives: slot.alternatives.map((entry, index) =>
                index === action.position ? patchAlternative(entry, action.patch) : entry
              ),
            }
          : null
      );
    case 'removeAlternative':
      return updateSlot(state, action, (slot) =>
        inRange(action.position, slot.alternatives.length)
          ? { ...slot, alternatives: slot.alternatives.filter((_, index) => index !== action.position) }
          : null
      );
    case 'moveAlternative':
      return updateSlot(state, action, (slot) => {
        const alternatives = moved(slot.alternatives, action.from, action.to);
        return alternatives === null ? null : { ...slot, alternatives };
      });
    case 'promoteAlternative':
      return updateSlot(state, action, (slot) => promote(slot, action.position));
    case 'setCharms':
      return updateVariant(state, action.variant, (draft) => ({ ...draft, charms: action.charms }));
    case 'setAscendancy':
      return updateVariant(state, action.variant, (draft) => ({ ...draft, ascendancy: action.ascendancy }));
    case 'setSkills':
      return updateVariant(state, action.variant, (draft) => ({ ...draft, skills: action.skills }));
    case 'setLevelText':
      return updateVariant(state, action.variant, (draft) => ({ ...draft, levelText: action.levelText }));
    case 'setSkillPoints':
      return updateVariant(state, action.variant, (draft) => ({ ...draft, skillPoints: action.skillPoints }));
    case 'setStats':
      return updateVariant(state, action.variant, (draft) => ({ ...draft, stats: action.stats }));
    case 'setStatValue':
      return updateStats(state, action.variant, (stats) =>
        (stats.values[action.key] ?? '') === action.text ? null : { values: { ...stats.values, [action.key]: action.text } }
      );
    case 'setStatsDifficulty':
      return updateStats(state, action.variant, (stats) =>
        stats.difficulty === action.difficulty ? null : { difficulty: action.difficulty }
      );
    case 'setStatsBuffed':
      return updateStats(state, action.variant, (stats) => (stats.buffed === action.buffed ? null : { buffed: action.buffed }));
    case 'setStatsFromSave': {
      const index = state.findIndex((draft) => draft.key === action.variantKey);
      if (index < 0 || state[index].stats !== null) return state;
      return updateVariant(state, index, (draft) => ({ ...draft, stats: action.stats }));
    }
    case 'setStatsShowCharacter': {
      const stats = inRange(action.variant, state.length) ? state[action.variant].stats : null;
      if (stats === null || stats.showCharacter === action.show) return state;
      return updateVariant(state, action.variant, (draft) => ({ ...draft, stats: { ...stats, showCharacter: action.show } }));
    }
  }
}
