import type { BuildData, CraftAnnotation, EquipmentSlot, ItemRef, VariantData, WeaponSwapSlot } from '../buildData';
import type { StatKey, StatsDifficulty, StatsSource } from '../buildStats';
import type { CharacterClass } from '../constants';
import type { CharmEntry } from '../utils/charms';
import type { SkillPoints } from '../utils/skillTree';

export interface BuildFormValues {
  readonly name: string;
  readonly description: string;
  readonly characterClass: CharacterClass | '';
  /** The build's variants in order (at least one; see unpackVariants). */
  readonly variants: readonly VariantData[];
}

export const EMPTY_BUILD_FORM: BuildFormValues = {
  name: '',
  description: '',
  characterClass: '',
  variants: [{}],
};

export interface BuildFormSubmit {
  readonly name: string;
  readonly description: string;
  readonly characterClass: CharacterClass;
  readonly buildData: BuildData;
  /** The 0-based index of the variant shown when saving (the order is the saved one), so the page can open it. */
  readonly activeVariant: number;
}

/** An alternative item while editing: the ref is null until one is picked (dropped on submit). */
export interface DraftAlternative {
  /** Ephemeral React key, never stored. */
  readonly key: string;
  readonly ref: ItemRef | null;
  readonly note: string;
  readonly crafts: readonly CraftAnnotation[];
}

/** One gear section of a variant while editing: the main items with their slot-keyed notes, crafts and alternatives. */
export interface SectionDraft<K extends string> {
  readonly items: Partial<Record<K, ItemRef | null>>;
  readonly notes: Partial<Record<K, string>>;
  readonly crafts: Partial<Record<K, readonly CraftAnnotation[]>>;
  readonly alternatives: Partial<Record<K, readonly DraftAlternative[]>>;
}

export type GearSection = 'player' | 'swap' | 'merc';

/** The DOM id of an editable slot cell, so the import panel can scroll to it. */
export function slotAnchorId(section: GearSection, slot: EquipmentSlot | WeaponSwapSlot): string {
  return `build-slot-${section}-${slot}`;
}

/** One variant while editing (see utils/variantDrafts for the reducer and the conversions). */
export interface VariantDraft {
  /** Ephemeral React key, never stored. */
  readonly key: string;
  /** Raw name text; blank → the fallback label (variantLabel). */
  readonly name: string;
  readonly note: string;
  readonly player: SectionDraft<EquipmentSlot>;
  readonly swap: SectionDraft<WeaponSwapSlot>;
  readonly merc: SectionDraft<EquipmentSlot>;
  readonly charms: readonly CharmEntry[];
  readonly ascendancy: string | null;
  readonly skills: string;
  /** The level input's raw text ('' = unset); parsed on submit. */
  readonly levelText: string;
  readonly skillPoints: SkillPoints;
  /** The character stats block; null = none (see utils/statsDraft for the conversions). */
  readonly stats: StatsDraft | null;
}

/** The character stats block while editing: raw input text per stat, parsed on submit. */
export interface StatsDraft {
  readonly source: StatsSource;
  /** Save-derived numbers the author changed (sticky: set by the reducer on the first change). */
  readonly edited: boolean;
  readonly difficulty: StatsDifficulty;
  readonly buffed: boolean;
  /** Provenance of save-derived stats, kept as loaded (never edited in the form) */
  readonly character?: string;
  readonly savedAt?: number;
  readonly esrVersion?: string;
  /** Save-derived: the skill whose attack rating `values.ar` is (kept as loaded) */
  readonly arSkill?: string;
  /** Save-derived: whether the character's name is stored with the stats (the author can leave it out) */
  readonly showCharacter: boolean;
  /** Raw input text per stat; blank or absent = not stated */
  readonly values: Readonly<Partial<Record<StatKey, string>>>;
}
