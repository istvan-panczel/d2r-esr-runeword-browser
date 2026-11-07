// Decides which equipment slots a picker candidate belongs in, so the slot picker
// can hide e.g. helms from a ring slot. Deliberately generous: an unknown category
// or item type is allowed everywhere, freetext is always allowed, and the picker
// has a "Show all items" escape hatch. The mapping is documented in
// builds-feature-docs/FEATURE-BUILD-SHARING.md ("Slot filtering").

import type { EquipmentSlot, WeaponSwapSlot } from '../buildData';

/** Slot families: ring1/ring2 share "ring", weapon swap shares weapon/shield, merc uses the player slots. */
export type SlotGroup = 'helmet' | 'armor' | 'weapon' | 'shield' | 'gloves' | 'boots' | 'belt' | 'amulet' | 'ring';

export type PickerSlot = EquipmentSlot | WeaponSwapSlot;

export type SlotCandidate =
  | { readonly type: 'unique'; readonly category: string }
  | { readonly type: 'mythical'; readonly category: string; readonly baseItem: string }
  | { readonly type: 'runeword' | 'gemword'; readonly allowedItems: readonly string[] }
  | { readonly type: 'set'; readonly category: string }
  | { readonly type: 'freetext' };

const SLOT_GROUP: Record<PickerSlot, SlotGroup> = {
  helmet: 'helmet',
  armor: 'armor',
  weapon: 'weapon',
  shield: 'shield',
  gloves: 'gloves',
  boots: 'boots',
  belt: 'belt',
  amulet: 'amulet',
  ring1: 'ring',
  ring2: 'ring',
  weapon2: 'weapon',
  shield2: 'shield',
};

export function slotGroup(slot: PickerSlot): SlotGroup {
  return SLOT_GROUP[slot];
}

const ANY_ARMOR: readonly SlotGroup[] = ['helmet', 'armor', 'shield', 'gloves', 'boots', 'belt'];
/** One-handed / dual-wieldable weapons: main hand, or off hand for Barbarian/Assassin dual wield. */
const ONE_HAND: readonly SlotGroup[] = ['weapon', 'shield'];
/** Two-handed or missile weapons: main hand only. */
const TWO_HAND: readonly SlotGroup[] = ['weapon'];
/** Not equippable in any gear slot (charms and jewels go in the inventory / sockets). */
const NONE: readonly SlotGroup[] = [];

/**
 * Item type (unique category, set item category, runeword/gemword allowed item type) →
 * slot groups, keyed by lower-cased name. They share one table because several names
 * overlap ("Helm", "Body Armor", "Sword", ...). Set item categories are types.json
 * type names; their slots follow the type's `bodyLoc` (checked by slotFit.test.ts).
 */
const TYPE_SLOTS: Readonly<Partial<Record<string, readonly SlotGroup[]>>> = {
  // Helmets
  helm: ['helmet'],
  circlet: ['helmet'],
  pelt: ['helmet'],
  'primal helm': ['helmet'],
  'spirit crown': ['helmet'],
  // Body armour
  'body armor': ['armor'],
  // types.json name of body armour ("tors"), used by set item categories
  armor: ['armor'],
  cloak: ['armor'],
  robe: ['armor'],
  // Off hand
  shield: ['shield'],
  'any shield': ['shield'],
  'auric shields': ['shield'],
  'voodoo heads': ['shield'],
  grimoire: ['shield'],
  'bow quiver': ['shield'],
  'crossbow quiver': ['shield'],
  // "Paladin Item" (Exile) is a paladin shield; allow the weapon slot too in case it also covers paladin swords.
  'paladin item': ['shield', 'weapon'],
  // Other armour
  gloves: ['gloves'],
  boots: ['boots'],
  belt: ['belt'],
  'any armor': ANY_ARMOR,
  // Jewellery (class-specific rings/amulets are handled by the suffix rule below)
  amulet: ['amulet'],
  ring: ['ring'],
  // Class jewellery item types (set item categories): rings despite the names
  'barbaric knuckle': ['ring'],
  "sorcerer's band": ['ring'],
  'warlock sigil': ['ring'],
  // ... and amulets
  'holy pendant': ['amulet'],
  'druidic necklace': ['amulet'],
  "sorcerer's talisman": ['amulet'],
  'warlock pendant': ['amulet'],
  // Generic weapon types (runewords/gemwords)
  weapon: ONE_HAND,
  'melee weapon': ONE_HAND,
  'one-handed melee weapon': ONE_HAND,
  blunt: ONE_HAND,
  'thrown weapon': ONE_HAND,
  'two-handed melee weapon': TWO_HAND,
  'missile weapon': TWO_HAND,
  missile: TWO_HAND,
  // One-handed / dual-wieldable weapon classes
  axe: ONE_HAND,
  club: ONE_HAND,
  'druid club': ONE_HAND,
  hammer: ONE_HAND,
  mace: ONE_HAND,
  scepter: ONE_HAND,
  sword: ONE_HAND,
  'paladin sword': ONE_HAND,
  voidblade: ONE_HAND,
  'sorceress mana blade': ONE_HAND,
  knife: ONE_HAND,
  'necromancer dagger': ONE_HAND,
  'throwing axe': ONE_HAND,
  'throwing knife': ONE_HAND,
  javelin: ONE_HAND,
  'amazon javelin': ONE_HAND,
  'barbarian javs': ONE_HAND,
  shuriken: ONE_HAND,
  'hand to hand': ONE_HAND,
  'hand to hand 1': ONE_HAND,
  'hand to hand 2': ONE_HAND,
  knuckle: ONE_HAND,
  wand: ONE_HAND,
  // Two-handed / missile weapon classes, and orbs (sorceress main hand)
  orb: TWO_HAND,
  bow: TWO_HAND,
  'amazon bow': TWO_HAND,
  crossbow: TWO_HAND,
  polearm: TWO_HAND,
  'necromancer polearm': TWO_HAND,
  spear: TWO_HAND,
  'amazon spear': TWO_HAND,
  staff: TWO_HAND,
  // ESR 3.3 runewords.htm names this one base as an item type (bases.json m11: type staf, a two-handed staff)
  'mythical arcane staff': TWO_HAND,
  'assassin 2h katana': TWO_HAND,
  // Not gear
  charm: NONE,
  'small charm': NONE,
  'large charm': NONE,
  'grand charm': NONE,
  'odd charm': NONE,
  jewel: NONE,
};

/**
 * Mythical uniques are grouped by coarse section headers rather than item types, so
 * the jewellery/charm cases are refined from the base item (see mythicalSlots).
 */
const MYTHICAL_CATEGORY_SLOTS: Readonly<Partial<Record<string, readonly SlotGroup[]>>> = {
  'mythical unique weapons': ONE_HAND,
  'mythical unique armor': ANY_ARMOR,
  'mythical unique jewelry': ['amulet', 'ring'],
};

/** Mythical section headers that are known but carry no slot information (all slots allowed). */
const MYTHICAL_UNTYPED_CATEGORIES: ReadonlySet<string> = new Set(['dedicated drops mythical uniques']);

/**
 * Slot groups for one item type / unique category, or undefined when the type is
 * unknown (callers treat unknown as "fits everywhere"). An empty array means the
 * type is known not to be gear (charms, jewels).
 */
export function typeSlots(type: string): readonly SlotGroup[] | undefined {
  const key = type.trim().toLowerCase();
  const exact = TYPE_SLOTS[key];
  if (exact !== undefined) return exact;
  // Class-specific and LoD jewellery: "Ama Ring", "LoD Amulet", "Sor Amulet", ...
  if (key.endsWith(' ring')) return ['ring'];
  if (key.endsWith(' amulet')) return ['amulet'];
  if (key.endsWith(' charm')) return NONE;
  return undefined;
}

/** Slot groups for a mythical unique, or undefined when unknown (fits everywhere). */
export function mythicalSlots(category: string, baseItem: string): readonly SlotGroup[] | undefined {
  // The base item is the precise signal for jewellery, charms and jewels ("Amulet", "Ring", "Large Charm", "Jewel").
  const base = baseItem
    .trim()
    .replace(/^mythical\s+/i, '')
    .toLowerCase();
  if (base === 'amulet' || base === 'ring' || base === 'jewel' || base.endsWith(' charm')) return typeSlots(base);
  const key = category.trim().toLowerCase();
  return MYTHICAL_CATEGORY_SLOTS[key];
}

/** Whether a mythical category is one the mapping knows (mapped or deliberately untyped). */
export function isKnownMythicalCategory(category: string): boolean {
  const key = category.trim().toLowerCase();
  return key in MYTHICAL_CATEGORY_SLOTS || MYTHICAL_UNTYPED_CATEGORIES.has(key);
}

const fits = (groups: readonly SlotGroup[] | undefined, group: SlotGroup) => groups === undefined || groups.includes(group);

/**
 * Whether a picker candidate belongs in an equipment slot. Generous by design:
 * freetext and unknown categories/types always fit; a runeword/gemword fits when
 * any of its allowed item types fits (excluded item types are ignored).
 */
export function itemFitsSlot(slot: PickerSlot, candidate: SlotCandidate): boolean {
  const group = SLOT_GROUP[slot];
  switch (candidate.type) {
    case 'freetext':
      return true;
    case 'unique':
    case 'set':
      return fits(typeSlots(candidate.category), group);
    case 'mythical':
      return fits(mythicalSlots(candidate.category, candidate.baseItem), group);
    case 'runeword':
    case 'gemword':
      // No allowed types listed: nothing to go on, so allow.
      if (candidate.allowedItems.length === 0) return true;
      return candidate.allowedItems.some((type) => fits(typeSlots(type), group));
  }
}
