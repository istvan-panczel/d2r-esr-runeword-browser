import type { BuildData, CraftAnnotation, EquipmentSlot, ItemRef, VariantData, WeaponSwapSlot } from '../buildData';
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
}
