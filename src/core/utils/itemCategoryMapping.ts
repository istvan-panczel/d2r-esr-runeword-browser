export type BonusCategory = 'weaponsGloves' | 'helmsBoots' | 'armorShieldsBelts';

/** The three bonus columns in the order the ESR pages show them. */
export const BONUS_CATEGORIES: readonly BonusCategory[] = ['weaponsGloves', 'helmsBoots', 'armorShieldsBelts'];

// Keywords to match item types to bonus columns (case-insensitive, first category wins).
// Matches the gems.htm column headers (ESR 3.3):
//   Col 1: "Weapon (except Orb, Staff, Wand) / Gloves / Missile / Mythical Arcane Staff"
//   Col 2: "Helm / Boots / Staff / Wand / Orb / Amulet / Ring / Charm"
//   Col 3: "Any Shield / Body Armor / Belt"
const CATEGORY_KEYWORDS: Record<BonusCategory, readonly string[]> = {
  weaponsGloves: [
    'weapon',
    'glove',
    'missile',
    'hammer',
    'polearm',
    'spear',
    'katana',
    'blade',
    'sword',
    'axe',
    'mace',
    'claw',
    'dagger',
    'bow',
    'crossbow',
    'javelin',
    'scepter',
    'club',
    'knife',
    'shuriken',
    'blunt',
    'hand to hand',
    'knuckle',
  ],
  helmsBoots: ['helm', 'boot', 'circlet', 'cap', 'mask', 'crown', 'staff', 'orb', 'wand', 'charm', 'pelt', 'amulet', 'ring'],
  armorShieldsBelts: ['armor', 'shield', 'belt', 'plate', 'paladin item'],
};

// Item types whose keyword match would pick the wrong column (lower-cased exact names)
const CATEGORY_OVERRIDES: Readonly<Partial<Record<string, BonusCategory>>> = {
  // A staff, but gems.htm lists it with the weapons
  'mythical arcane staff': 'weaponsGloves',
  // The Barbarian ring type, not the Knuckle weapon
  'barbaric knuckle': 'helmsBoots',
};

// Short labels of the gems.htm columns: the socketable tooltips / cards, and the fallback when dynamic labels can't be
// generated. Weapons = all but staves, wands and orbs (the Mythical Arcane Staff counts as a weapon)
export const CATEGORY_LABELS: Record<BonusCategory, string> = {
  weaponsGloves: 'Weapons/Gloves',
  helmsBoots: 'Helms/Boots/Staves/Wands/Orbs/Jewelry/Charms',
  armorShieldsBelts: 'Shields/Body Armor/Belts',
};

/**
 * Determines which bonus category an item type belongs to.
 */
export function getItemCategory(itemType: string): BonusCategory | null {
  const lowerItem = itemType.toLowerCase();
  const override = CATEGORY_OVERRIDES[lowerItem.trim()];
  if (override) return override;

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS) as [BonusCategory, readonly string[]][]) {
    if (keywords.some((keyword) => lowerItem.includes(keyword))) {
      return category;
    }
  }

  return null;
}

/**
 * Gets all relevant bonus categories for a list of allowed item types.
 * Returns unique categories in a consistent order.
 */
export function getRelevantCategories(allowedItems: readonly string[]): BonusCategory[] {
  const categories = new Set<BonusCategory>();

  for (const item of allowedItems) {
    const category = getItemCategory(item);
    if (category) {
      categories.add(category);
    }
  }

  // Return in consistent order
  return BONUS_CATEGORIES.filter((cat) => categories.has(cat));
}

/**
 * Generates a dynamic label for a category based on which allowed items map to it.
 * E.g., for Machine (Weapon, Charm) → weaponsGloves: "Weapon", helmsBoots: "Charm"
 * Falls back to CATEGORY_LABELS if no items match.
 */
export function getCategoryLabel(allowedItems: readonly string[], category: BonusCategory): string {
  const matchingItems = allowedItems.filter((item) => getItemCategory(item) === category);
  return matchingItems.length > 0 ? matchingItems.join('/') : CATEGORY_LABELS[category];
}
