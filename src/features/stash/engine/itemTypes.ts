/**
 * Item type search words for the stash pages: a search word that names an item type ("belt", "helmet", "rings") matches
 * every item whose base type is that type or descends from it (types.json ancestors), whatever the base is called (Sash,
 * Mithril Coil, …). The type names are ESR's itemtypes.txt names; a few everyday words map onto them.
 */
import type { ItemTypeInfo } from '@/features/game-data/engine/schema';

export interface ItemTypeIndex {
  /** By type code: display name and ancestors (the type itself included) */
  readonly byCode: ReadonlyMap<string, { readonly name: string; readonly ancestors: readonly string[] }>;
  /** Normalised type name → the type codes with that name */
  readonly byWord: ReadonlyMap<string, readonly string[]>;
}

/**
 * Everyday words for ESR type names. "shield" means every shield (paladin, necromancer and warlock ones too), so it is
 * "Any Shield" rather than the plain "Shield" type.
 */
const TYPE_ALIASES: Readonly<Partial<Record<string, string>>> = {
  helmet: 'helm',
  armour: 'armor',
  'body armor': 'armor',
  shield: 'any shield',
  dagger: 'knife',
  claw: 'hand to hand',
  katar: 'hand to hand',
};

/** Lower case, inner whitespace collapsed, a plural "s" dropped ("Rings" → "ring", "Boots" → "boot") */
export function normaliseTypeWord(word: string): string {
  const text = word.trim().toLowerCase().replace(/\s+/g, ' ');
  return text.length > 3 && text.endsWith('s') && !text.endsWith('ss') ? text.slice(0, -1) : text;
}

export function buildItemTypeIndex(types: readonly Pick<ItemTypeInfo, 'code' | 'name' | 'ancestors'>[]): ItemTypeIndex {
  const byCode = new Map(types.map((type) => [type.code, { name: type.name, ancestors: type.ancestors }]));
  const byWord = new Map<string, string[]>();
  for (const type of types) {
    const word = normaliseTypeWord(type.name);
    byWord.set(word, [...(byWord.get(word) ?? []), type.code]);
  }
  return { byCode, byWord };
}

/** The type codes a search term names ("belts" → [belt]), or null when it names no type. */
export function typeCodesOfTerm(term: string, index: ItemTypeIndex): readonly string[] | null {
  const text = term.trim().toLowerCase().replace(/\s+/g, ' ');
  const word = normaliseTypeWord(TYPE_ALIASES[text] ?? TYPE_ALIASES[normaliseTypeWord(text)] ?? text);
  return index.byWord.get(word) ?? null;
}

/** The base type and its ancestors, e.g. belt → [belt, armo, merc]; [] for an unknown type */
export function typeAncestors(type: string, index: ItemTypeIndex): readonly string[] {
  return index.byCode.get(type)?.ancestors ?? [];
}
