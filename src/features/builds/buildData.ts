// Typed structure stored in builds.build_data (jsonb). Each equipment slot holds
// one of the item-reference variants below, or null/absent for an empty slot.
// See builds-feature-docs/FEATURE-BUILD-SHARING.md.

import type { ForgingKind } from '@/features/game-data/engine/schema';
import { asBuildStats, type BuildStats } from './buildStats';
import {
  ALTERNATIVES_MAX_PER_SLOT,
  LEVEL_MAX,
  SKILL_ID_MAX_LENGTH,
  SKILL_POINTS_MAX,
  SKILL_POINTS_MAX_ENTRIES,
  VARIANT_NAME_MAX_LENGTH,
  VARIANT_NOTE_MAX_LENGTH,
  VARIANTS_MAX,
} from './constants';

/** Per-column runeword/gemword bonuses, stored as rawText strings. */
export interface ColumnAffixesSnapshot {
  readonly weaponsGloves: readonly string[];
  readonly helmsBoots: readonly string[];
  readonly armorShieldsBelts: readonly string[];
}

/** Snapshot for unique and mythical unique items (same shape for both). */
export interface UniqueSnapshot {
  readonly name: string;
  readonly baseItem: string;
  readonly category: string;
  readonly reqLevel: number;
  readonly properties: readonly string[];
  /**
   * Mythicals only: the orange "special" property lines, shown before `properties`.
   * Absent on uniques and on mythical snapshots saved before this field existed, so
   * readers must treat it as optional (see itemDiff's legacy-snapshot handling).
   */
  readonly specialProperties?: readonly string[];
}

export interface RunewordSnapshot {
  readonly sockets: number;
  // Optional: only present for recipes the ESR site shows as a socket range, e.g. "(2-3 Socket)".
  // Absent on builds saved before 3.12 data, so readers must treat it as optional.
  readonly socketsMax?: number;
  readonly runes: readonly string[];
  readonly gems: readonly string[];
  readonly allowedItems: readonly string[];
  readonly columnAffixes: ColumnAffixesSnapshot;
  readonly reqLevel: number;
}

export interface GemwordSnapshot {
  readonly sockets: number;
  readonly gems: readonly string[];
  readonly allowedItems: readonly string[];
  readonly columnAffixes: ColumnAffixesSnapshot;
  readonly reqLevel: number;
}

/** One per-item set bonus group: active while `pieces` items of the set are worn. */
export interface SetBonusGroupSnapshot {
  readonly pieces: number;
  readonly lines: readonly string[];
}

/** Snapshot for a set item (from the sets.json game-data bundle). */
export interface SetItemSnapshot {
  readonly name: string;
  /** Display name of the set (hireling sets share it across difficulties; `setId` is unique). */
  readonly setName: string;
  /** sets.txt `index` of the set; groups equipped pieces for the set bonuses. */
  readonly setId: string;
  readonly baseItem: string;
  readonly category: string;
  readonly reqLevel: number;
  /** The item's own property lines. */
  readonly properties: readonly string[];
  /** The item's own partial bonuses (need N items of the set). */
  readonly partial: readonly SetBonusGroupSnapshot[];
}

/** The author's chosen base for a runeword (bases.json `code`); absent on builds saved before it existed */
export interface RunewordBaseChoice {
  readonly code: string;
  readonly name: string;
}

// `base` and `socketed` are AUTHOR CHOICES, not snapshots: the version diff ignores them,
// and a snapshot refresh (resolveCurrentRef / refreshBuildData) carries them over unchanged.

export interface UniqueItemRef {
  readonly type: 'unique';
  readonly id: number;
  readonly snapshot: UniqueSnapshot;
  /** Author-chosen socket fillers (rune / gem / crystal / jewel names, free text allowed), in socket order */
  readonly socketed?: readonly string[];
}

export interface MythicalItemRef {
  readonly type: 'mythical';
  readonly id: number;
  readonly snapshot: UniqueSnapshot;
  /** Author-chosen socket fillers (rune / gem / crystal / jewel names, free text allowed), in socket order */
  readonly socketed?: readonly string[];
}

export interface RunewordItemRef {
  readonly type: 'runeword';
  readonly name: string;
  readonly variant: number;
  readonly snapshot: RunewordSnapshot;
  readonly base?: RunewordBaseChoice;
  /** Author-chosen fillers for the runeword's free (jewel) sockets, in socket order */
  readonly socketed?: readonly string[];
}

export interface GemwordItemRef {
  readonly type: 'gemword';
  readonly name: string;
  readonly variant: number;
  readonly snapshot: GemwordSnapshot;
}

/** A set item, identified by its name (set item names are unique across sets.json). */
export interface SetItemRef {
  readonly type: 'set';
  readonly name: string;
  readonly snapshot: SetItemSnapshot;
  /** Author-chosen socket fillers (rune / gem / crystal / jewel names, free text allowed), in socket order */
  readonly socketed?: readonly string[];
}

export interface FreetextItemRef {
  readonly type: 'freetext';
  readonly name: string;
}

export type ItemRef = UniqueItemRef | MythicalItemRef | RunewordItemRef | GemwordItemRef | SetItemRef | FreetextItemRef;

/** Item refs that can carry socket fillers (gemword sockets are the recipe; freetext has nothing to attach to). */
export type SocketableItemRef = UniqueItemRef | MythicalItemRef | RunewordItemRef | SetItemRef;

/** Most socket fillers stored on one item (the largest socket count in the game). */
export const SOCKETED_MAX_ENTRIES = 6;
/** Longest filler name / base code / base name accepted. */
export const ITEM_CHOICE_MAX_LENGTH = 100;

export function supportsSocketed(ref: ItemRef): ref is SocketableItemRef {
  return ref.type === 'unique' || ref.type === 'mythical' || ref.type === 'runeword' || ref.type === 'set';
}

export type EquipmentSlot = 'helmet' | 'armor' | 'weapon' | 'shield' | 'gloves' | 'boots' | 'belt' | 'amulet' | 'ring1' | 'ring2';
export type WeaponSwapSlot = 'weapon2' | 'shield2';

/**
 * A structured crafting annotation on an equipped item: ids into the game-data bundles, never
 * rendered text (the detail page renders the lines from the viewer's current bundles).
 * - corruption: enhance.json `corruptionOutcomes` (`slot` = the enhance slot id, e.g. `body`; `roll` 1-based)
 * - anointment: enhance.json `anointmentOutcomes` (`itemType` = the pool, an item type code since ESR 3.3; `roll` = the
 *   row's value). The ESR 3.2 shape `{ pool: <slot id>, roll }` (one pool per slot) is kept when loaded so the detail
 *   page can show it as outdated; new picks never write it.
 * - forge: crafting.json `forgings` (`forge` = the kind, `key` = the option key, e.g. rune / r19)
 * - dstone / meld: crafting.json `stacking` (`material` / `switchItem` item codes); `uses` = times applied
 */
export type CraftAnnotation =
  | { readonly kind: 'corruption'; readonly slot: string; readonly roll: number }
  | { readonly kind: 'anointment'; readonly itemType: string; readonly roll: number }
  /** ESR 3.2 anointment (per-slot pool): no longer resolves, shown as outdated */
  | { readonly kind: 'anointment'; readonly pool: string; readonly roll: number }
  | { readonly kind: 'forge'; readonly forge: ForgingKind; readonly key: string }
  | { readonly kind: 'dstone'; readonly material: string; readonly switchItem?: string; readonly uses: number }
  | { readonly kind: 'meld'; readonly material: string; readonly uses: number };

export type CraftAnnotationKind = CraftAnnotation['kind'];

/** Most crafting annotations stored per slot. */
export const CRAFTS_MAX_PER_SLOT = 8;
/** Most uses of one D-stoning / gem meld annotation. */
export const CRAFT_USES_MAX = 99;
/** Longest id string (slot, pool, key, material, switch item) accepted. */
export const CRAFT_ID_MAX_LENGTH = 100;

const FORGING_KINDS: readonly ForgingKind[] = ['skill', 'all', 'stat', 'rune', 'aura'];

/**
 * An alternative item for a slot, besides the main item in `items` / `weaponSwap` / `mercenary`. A wrapped entry
 * (not extra keys on the ref) so rebuilding a ref (withAuthorChoices) never strips it; it carries its own note and
 * crafts, while the main item keeps the slot-keyed ones.
 */
export interface ItemAlternative {
  readonly ref: ItemRef;
  readonly note?: string;
  readonly crafts?: readonly CraftAnnotation[];
}

/** Slot → alternatives in display order (at most ALTERNATIVES_MAX_PER_SLOT each). */
export type AlternativesMap<K extends string> = Partial<Record<K, readonly ItemAlternative[]>>;

/** Everything one variant owns. The top level of build_data is the first variant. */
export interface VariantData {
  readonly items?: Partial<Record<EquipmentSlot, ItemRef | null>>;
  readonly weaponSwap?: Partial<Record<WeaponSwapSlot, ItemRef | null>>;
  readonly mercenary?: Partial<Record<EquipmentSlot, ItemRef | null>>;
  // Per-slot crafting/corruption notes (rune-forging, D-Stone, corruption, etc.).
  // Keyed by slot, parallel to the item maps above, so they survive snapshot refresh
  // on edit and persist when the item in a slot is swapped.
  readonly itemNotes?: Partial<Record<EquipmentSlot, string>>;
  readonly weaponSwapNotes?: Partial<Record<WeaponSwapSlot, string>>;
  readonly mercenaryNotes?: Partial<Record<EquipmentSlot, string>>;
  // Per-slot structured crafting annotations (forging, D-stoning, gem melding, corruption,
  // anointment), keyed by slot like the notes: they belong to the slot, survive the snapshot
  // refresh and stay when the item in the slot is swapped. Absent on older builds.
  readonly itemCrafts?: Partial<Record<EquipmentSlot, readonly CraftAnnotation[]>>;
  readonly weaponSwapCrafts?: Partial<Record<WeaponSwapSlot, readonly CraftAnnotation[]>>;
  readonly mercenaryCrafts?: Partial<Record<EquipmentSlot, readonly CraftAnnotation[]>>;
  readonly charms?: readonly string[];
  readonly ascendancy?: string | null;
  readonly skills?: string | null;
  // Optional character level (1..LEVEL_MAX) and structured skill tree allocation: skills.json skill
  // id → points spent. Absent on older builds. No point budget or prerequisite rules are enforced
  // (owner decision); ids outside the build's class tree are kept and shown as "other skills".
  readonly level?: number;
  readonly skillPoints?: Readonly<Record<string, number>>;
  // Alternative items per slot, parallel to the item maps. Absent on older builds. Old clients ignore them (and
  // `variants`) when viewing but drop them when saving: a stale tab editing such a build keeps only the main items.
  readonly itemAlternatives?: AlternativesMap<EquipmentSlot>;
  readonly weaponSwapAlternatives?: AlternativesMap<WeaponSwapSlot>;
  readonly mercenaryAlternatives?: AlternativesMap<EquipmentSlot>;
  /** Absent → "Default" (first variant) or "Variant N" (see variantLabel). Named so it can't be confused with builds.name. */
  readonly variantName?: string;
  readonly variantNote?: string;
  // Optional character stats (attributes, life, resistances, speeds …), computed from a save or typed by the author.
  // Absent on older builds; the last key, so builds saved without it keep their stored key order. See buildStats.ts.
  readonly stats?: BuildStats;
}

/**
 * The stored build_data: the top level is the first variant (what old clients render), `variants` holds the
 * second to last (at most VARIANTS_MAX - 1, one level deep: a `variants` key inside an entry is ignored).
 */
export interface BuildData extends VariantData {
  readonly variants?: readonly VariantData[];
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function isColumnAffixes(value: unknown): boolean {
  return isRecord(value) && isStringArray(value.weaponsGloves) && isStringArray(value.helmsBoots) && isStringArray(value.armorShieldsBelts);
}

function isUniqueSnapshot(s: UnknownRecord): boolean {
  return (
    typeof s.name === 'string' &&
    typeof s.baseItem === 'string' &&
    isStringArray(s.properties) &&
    (s.specialProperties === undefined || isStringArray(s.specialProperties))
  );
}

function isSetBonusGroup(value: unknown): boolean {
  return isRecord(value) && typeof value.pieces === 'number' && isStringArray(value.lines);
}

function isSetItemSnapshot(s: UnknownRecord): boolean {
  return (
    typeof s.name === 'string' &&
    typeof s.setName === 'string' &&
    typeof s.setId === 'string' &&
    typeof s.baseItem === 'string' &&
    typeof s.category === 'string' &&
    typeof s.reqLevel === 'number' &&
    isStringArray(s.properties) &&
    Array.isArray(s.partial) &&
    s.partial.every(isSetBonusGroup)
  );
}

function isSocketableSnapshot(s: UnknownRecord, recipeKey: 'runes' | 'gems'): boolean {
  return isStringArray(s[recipeKey]) && isColumnAffixes(s.columnAffixes);
}

/** Runtime check of the fields the display/lookup/diff code dereferences. */
export function isItemRef(value: unknown): value is ItemRef {
  if (!isRecord(value)) return false;
  if (value.type === 'freetext') return typeof value.name === 'string';
  const snapshot = value.snapshot;
  if (!isRecord(snapshot)) return false;
  switch (value.type) {
    case 'unique':
    case 'mythical':
      return typeof value.id === 'number' && isUniqueSnapshot(snapshot);
    case 'runeword':
    case 'gemword':
      return (
        typeof value.name === 'string' &&
        typeof value.variant === 'number' &&
        isSocketableSnapshot(snapshot, value.type === 'runeword' ? 'runes' : 'gems')
      );
    case 'set':
      return typeof value.name === 'string' && isSetItemSnapshot(snapshot);
    default:
      return false;
  }
}

const isChoiceText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.trim().length <= ITEM_CHOICE_MAX_LENGTH;

/** A stored runeword base choice, or undefined when absent or malformed. */
export function asRunewordBaseChoice(value: unknown): RunewordBaseChoice | undefined {
  if (!isRecord(value) || !isChoiceText(value.code) || !isChoiceText(value.name)) return undefined;
  return { code: value.code.trim(), name: value.name.trim() };
}

/**
 * Stored socket fillers, cleaned: trimmed, blank / non-string / over-long entries dropped, at most
 * SOCKETED_MAX_ENTRIES kept. Undefined when absent, not an array, or nothing valid is left.
 */
export function asSocketed(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const fillers = value
    .filter(isChoiceText)
    .map((entry) => entry.trim())
    .slice(0, SOCKETED_MAX_ENTRIES);
  return fillers.length > 0 ? fillers : undefined;
}

/**
 * Re-validates the optional author choices (`base`, `socketed`) of a ref that passed isItemRef:
 * malformed ones are dropped, never the item. Refs without them are returned as is, and the fields
 * are left alone on types that do not use them (unknown keys are ignored, as everywhere else).
 */
export function sanitizeItemRef(ref: ItemRef): ItemRef {
  if (!supportsSocketed(ref)) return ref;
  const raw = ref as unknown as UnknownRecord;
  const choiceKeys = ref.type === 'runeword' ? ['base', 'socketed'] : ['socketed'];
  if (!choiceKeys.some((key) => key in raw)) return ref;
  const rest = Object.fromEntries(Object.entries(raw).filter(([key]) => !choiceKeys.includes(key)));
  const base = ref.type === 'runeword' ? asRunewordBaseChoice(raw.base) : undefined;
  const socketed = asSocketed(raw.socketed);
  return {
    ...rest,
    ...(base !== undefined ? { base } : {}),
    ...(socketed !== undefined ? { socketed } : {}),
  } as unknown as ItemRef;
}

function itemSection(value: unknown): Record<string, ItemRef> | undefined {
  const section = filterEntries(value, isItemRef);
  if (section === undefined) return undefined;
  return Object.fromEntries(Object.entries(section).map(([slot, ref]) => [slot, sanitizeItemRef(ref)]));
}

/** Keeps only the entries of a jsonb object whose value passes `isValid`; undefined if not an object. */
function filterEntries<T>(value: unknown, isValid: (entry: unknown) => entry is T): Record<string, T> | undefined {
  if (!isRecord(value)) return undefined;
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, T] => isValid(entry[1])));
}

const isString = (value: unknown): value is string => typeof value === 'string';

const isCraftId = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= CRAFT_ID_MAX_LENGTH;
const isPositiveInt = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value > 0;
const isUses = (value: unknown): value is number => isPositiveInt(value) && value <= CRAFT_USES_MAX;
const isForgingKind = (value: unknown): value is ForgingKind => FORGING_KINDS.some((kind) => kind === value);

/** A stored crafting annotation rebuilt with only its known fields, or undefined when malformed. */
export function asCraftAnnotation(value: unknown): CraftAnnotation | undefined {
  if (!isRecord(value)) return undefined;
  switch (value.kind) {
    case 'corruption':
      return isCraftId(value.slot) && isPositiveInt(value.roll) ? { kind: 'corruption', slot: value.slot, roll: value.roll } : undefined;
    case 'anointment':
      if (!isPositiveInt(value.roll)) return undefined;
      if (isCraftId(value.itemType)) return { kind: 'anointment', itemType: value.itemType, roll: value.roll };
      return isCraftId(value.pool) ? { kind: 'anointment', pool: value.pool, roll: value.roll } : undefined;
    case 'forge':
      return isForgingKind(value.forge) && isCraftId(value.key) ? { kind: 'forge', forge: value.forge, key: value.key } : undefined;
    case 'dstone':
      if (!isCraftId(value.material) || !isUses(value.uses)) return undefined;
      if (value.switchItem !== undefined && !isCraftId(value.switchItem)) return undefined;
      return {
        kind: 'dstone',
        material: value.material,
        ...(value.switchItem !== undefined ? { switchItem: value.switchItem } : {}),
        uses: value.uses,
      };
    case 'meld':
      return isCraftId(value.material) && isUses(value.uses) ? { kind: 'meld', material: value.material, uses: value.uses } : undefined;
    default:
      return undefined;
  }
}

/** A slot's stored crafting list, cleaned: malformed entries dropped, at most CRAFTS_MAX_PER_SLOT kept; undefined when nothing is left. */
export function asCraftList(value: unknown): readonly CraftAnnotation[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const crafts = value
    .map(asCraftAnnotation)
    .filter((craft): craft is CraftAnnotation => craft !== undefined)
    .slice(0, CRAFTS_MAX_PER_SLOT);
  return crafts.length > 0 ? crafts : undefined;
}

function craftSection(value: unknown): Record<string, readonly CraftAnnotation[]> | undefined {
  if (!isRecord(value)) return undefined;
  const entries = Object.entries(value).flatMap(([slot, list]) => {
    const crafts = asCraftList(list);
    return crafts === undefined ? [] : [[slot, crafts] as const];
  });
  return Object.fromEntries(entries);
}

/** A stored character level, or undefined unless an integer in 1..LEVEL_MAX. */
export function asLevel(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= LEVEL_MAX ? value : undefined;
}

const isSkillPoints = (value: unknown): value is number => isPositiveInt(value) && value <= SKILL_POINTS_MAX;

/**
 * A stored skill point allocation, cleaned: entries kept when the key is a non-empty id of at most
 * SKILL_ID_MAX_LENGTH characters and the value a positive integer up to SKILL_POINTS_MAX; at most
 * SKILL_POINTS_MAX_ENTRIES kept. Undefined when absent, not an object, or nothing valid is left.
 */
export function asSkillPoints(value: unknown): Readonly<Record<string, number>> | undefined {
  if (!isRecord(value)) return undefined;
  const entries = Object.entries(value)
    .filter((entry): entry is [string, number] => entry[0].length > 0 && entry[0].length <= SKILL_ID_MAX_LENGTH && isSkillPoints(entry[1]))
    .slice(0, SKILL_POINTS_MAX_ENTRIES);
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

const optionalString = (value: unknown): string | null | undefined => (typeof value === 'string' || value === null ? value : undefined);

/** A trimmed, non-blank string cut to `max` code points (an emoji is never split into a lone surrogate), or undefined. */
function cappedText(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = Array.from(value.trim()).slice(0, max).join('');
  return text.length > 0 ? text : undefined;
}

/** A stored alternative rebuilt with only its known fields, or undefined when its ref is malformed. */
export function asItemAlternative(value: unknown): ItemAlternative | undefined {
  if (!isRecord(value) || !isItemRef(value.ref)) return undefined;
  const note = typeof value.note === 'string' ? value.note.trim() : '';
  const crafts = asCraftList(value.crafts);
  return {
    ref: sanitizeItemRef(value.ref),
    ...(note.length > 0 ? { note } : {}),
    ...(crafts !== undefined ? { crafts } : {}),
  };
}

/**
 * A stored alternatives map, cleaned: malformed entries dropped, at most ALTERNATIVES_MAX_PER_SLOT kept per slot,
 * empty slots dropped. Slot keys are not validated (same as the item maps). Undefined when not an object.
 */
export function alternativesSection(value: unknown): Record<string, readonly ItemAlternative[]> | undefined {
  if (!isRecord(value)) return undefined;
  const entries = Object.entries(value).flatMap(([slot, list]) => {
    if (!Array.isArray(list)) return [];
    const alternatives = list
      .map(asItemAlternative)
      .filter((alternative): alternative is ItemAlternative => alternative !== undefined)
      .slice(0, ALTERNATIVES_MAX_PER_SLOT);
    return alternatives.length > 0 ? [[slot, alternatives] as const] : [];
  });
  return Object.fromEntries(entries);
}

/**
 * Defensive read of one variant (the top level of build_data, or an entry of `variants`). The column is
 * user-writable (any authenticated owner can PATCH arbitrary JSON through PostgREST), so every field is
 * validated: malformed item refs, notes and charms are dropped rather than crashing the detail/edit screens.
 * A malformed `base` / `socketed` drops just that field, a malformed crafting annotation just that entry,
 * a malformed level or skill point entry just that value, a malformed alternative just that alternative, a malformed
 * stats block or stat number (asBuildStats) just that block or number.
 */
export function asVariantData(value: unknown): VariantData {
  if (!isRecord(value)) return {};
  return {
    items: itemSection(value.items),
    weaponSwap: itemSection(value.weaponSwap),
    mercenary: itemSection(value.mercenary),
    itemNotes: filterEntries(value.itemNotes, isString),
    weaponSwapNotes: filterEntries(value.weaponSwapNotes, isString),
    mercenaryNotes: filterEntries(value.mercenaryNotes, isString),
    itemCrafts: craftSection(value.itemCrafts),
    weaponSwapCrafts: craftSection(value.weaponSwapCrafts),
    mercenaryCrafts: craftSection(value.mercenaryCrafts),
    charms: Array.isArray(value.charms) ? value.charms.filter(isString) : undefined,
    ascendancy: optionalString(value.ascendancy),
    skills: optionalString(value.skills),
    level: asLevel(value.level),
    skillPoints: asSkillPoints(value.skillPoints),
    itemAlternatives: alternativesSection(value.itemAlternatives),
    weaponSwapAlternatives: alternativesSection(value.weaponSwapAlternatives),
    mercenaryAlternatives: alternativesSection(value.mercenaryAlternatives),
    variantName: cappedText(value.variantName, VARIANT_NAME_MAX_LENGTH),
    variantNote: cappedText(value.variantNote, VARIANT_NOTE_MAX_LENGTH),
    stats: asBuildStats(value.stats),
  };
}

/** The stored extra variants: non-object entries dropped, at most VARIANTS_MAX - 1 kept; undefined when none. */
export function asVariantList(value: unknown): readonly VariantData[] | undefined {
  if (!Array.isArray(value)) return undefined;
  // asVariantData never reads `variants`, so nesting stays one level deep.
  const variants = value
    .filter(isRecord)
    .map(asVariantData)
    .slice(0, VARIANTS_MAX - 1);
  return variants.length > 0 ? variants : undefined;
}

/** Defensive read of the jsonb column into BuildData: the first variant at the top level plus `variants` (see asVariantData). */
export function asBuildData(value: unknown): BuildData {
  if (!isRecord(value)) return {};
  return { ...asVariantData(value), variants: asVariantList(value.variants) };
}
