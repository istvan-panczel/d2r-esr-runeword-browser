/**
 * The current data that public user data (builds, favourites, loot filters) references, as lookup sets: the game-data
 * bundles in public/game-data/ and the names parsed from the official HTM pages (the clone's docs/). Pure: the caller
 * reads the files and parses the pages.
 */
import type {
  BasesBundle,
  CraftingBundle,
  EnhanceBundle,
  LootFilterDataBundle,
  SetsBundle,
  SkillsBundle,
  TypesBundle,
} from '../../../src/features/game-data/engine/schema.ts';
import { buildLootFilterReference } from '../../../src/features/loot-filter/engine/reference.ts';
import type { LootFilterReference } from '../../../src/features/loot-filter/engine/types.ts';

/** A runeword or gemword row of the HTM pages: `variant` is its 1-based place among the rows with that name. */
export interface HtmRecipe {
  readonly name: string;
  readonly variant: number;
  readonly sockets?: number;
  readonly runes?: readonly string[];
  readonly gems: readonly string[];
}

/** What the HTM parsers yield, reduced to the fields user data references. */
export interface HtmNames {
  readonly runewords: readonly HtmRecipe[];
  readonly gemwords: readonly HtmRecipe[];
  readonly uniques: readonly { readonly name: string; readonly baseItemCode: string }[];
  readonly mythicals: readonly { readonly name: string }[];
  readonly ascendancies: readonly string[];
}

export interface GameDataBundles {
  readonly bases: Pick<BasesBundle, 'bases'>;
  readonly sets: SetsBundle;
  readonly skills: Pick<SkillsBundle, 'classes'>;
  readonly crafting: Pick<CraftingBundle, 'forgings' | 'stacking'>;
  readonly enhance: Pick<EnhanceBundle, 'corruptionOutcomes' | 'anointmentOutcomes'>;
  readonly lootfilter: LootFilterDataBundle;
  readonly types: TypesBundle;
  /** itemtext.json `skills`: the skills items carry (lootfilter.json lists the class trees and the skill pickers' ids) */
  readonly itemTextSkills: readonly { readonly id: number }[];
}

export interface HtmLookups {
  /** `name:variant` → the recipe */
  readonly runewords: ReadonlyMap<string, HtmRecipe>;
  readonly gemwords: ReadonlyMap<string, HtmRecipe>;
  /** name → number of variants */
  readonly runewordVariants: ReadonlyMap<string, number>;
  readonly gemwordVariants: ReadonlyMap<string, number>;
  /** unique name → its base item codes */
  readonly uniques: ReadonlyMap<string, ReadonlySet<string>>;
  readonly mythicals: ReadonlySet<string>;
  readonly ascendancies: ReadonlySet<string>;
}

export interface CurrentData {
  /** null when the HTM pages could not be read: the HTM-derived references are then counted as unchecked */
  readonly htm: HtmLookups | null;
  readonly setItems: ReadonlySet<string>;
  /** skills.json skill ids (builds `skillPoints` keys) */
  readonly skillIds: ReadonlySet<string>;
  /** skills.json class names (builds `class`) */
  readonly classes: ReadonlySet<string>;
  readonly baseCodes: ReadonlySet<string>;
  /** Craft annotation keys, built like the builds' craftLookups (src/features/builds/utils/crafts.ts) */
  readonly forgings: ReadonlySet<string>;
  readonly stacking: ReadonlySet<string>;
  readonly corruption: ReadonlySet<string>;
  readonly anointment: ReadonlySet<string>;
  /** skills.txt row ids the bundles know (lootfilter.json + itemtext.json skills): the skill layers of filter stat checks */
  readonly lootFilterSkillIds: ReadonlySet<number>;
  readonly lootFilterReference: LootFilterReference;
}

export const recipeKey = (name: string, variant: number): string => `${name}:${String(variant)}`;
export const forgeKey = (kind: string, key: string): string => `${kind}:${key}`;
export const stackingKey = (kind: string, material: string, switchItem: string | undefined): string =>
  `${kind}:${material}:${switchItem ?? ''}`;
export const rollKey = (slot: string, roll: number): string => `${slot}:${String(roll)}`;

function variantCounts(recipes: readonly HtmRecipe[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const recipe of recipes) counts.set(recipe.name, Math.max(counts.get(recipe.name) ?? 0, recipe.variant));
  return counts;
}

export function buildHtmLookups(names: HtmNames): HtmLookups {
  const uniques = new Map<string, Set<string>>();
  for (const unique of names.uniques) {
    const codes = uniques.get(unique.name) ?? new Set<string>();
    codes.add(unique.baseItemCode);
    uniques.set(unique.name, codes);
  }
  return {
    runewords: new Map(names.runewords.map((recipe) => [recipeKey(recipe.name, recipe.variant), recipe])),
    gemwords: new Map(names.gemwords.map((recipe) => [recipeKey(recipe.name, recipe.variant), recipe])),
    runewordVariants: variantCounts(names.runewords),
    gemwordVariants: variantCounts(names.gemwords),
    uniques,
    mythicals: new Set(names.mythicals.map((item) => item.name)),
    ascendancies: new Set(names.ascendancies),
  };
}

export function buildCurrentData(bundles: GameDataBundles, htm: HtmNames | null): CurrentData {
  return {
    htm: htm === null ? null : buildHtmLookups(htm),
    setItems: new Set(bundles.sets.sets.flatMap((set) => set.items.map((item) => item.name))),
    skillIds: new Set(bundles.skills.classes.flatMap((cls) => cls.tabs.flatMap((tab) => tab.skills.map((skill) => skill.id)))),
    classes: new Set(bundles.skills.classes.map((cls) => cls.name)),
    baseCodes: new Set(bundles.bases.bases.map((base) => base.code)),
    forgings: new Set(bundles.crafting.forgings.map((option) => forgeKey(option.kind, option.key))),
    stacking: new Set(bundles.crafting.stacking.map((option) => stackingKey(option.kind, option.material.code, option.switchItem?.code))),
    corruption: new Set(bundles.enhance.corruptionOutcomes.map((outcome) => rollKey(outcome.slot, outcome.roll))),
    anointment: new Set(bundles.enhance.anointmentOutcomes.map((outcome) => rollKey(outcome.pool, outcome.roll))),
    lootFilterSkillIds: new Set([...(bundles.lootfilter.skills ?? []), ...bundles.itemTextSkills].map((skill) => skill.id)),
    lootFilterReference: buildLootFilterReference(bundles.lootfilter, bundles.types),
  };
}
