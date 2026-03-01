export type BonusCategory = 'weaponsGloves' | 'helmsBoots' | 'armorShieldsBelts';

// Keywords to match item types to bonus columns (case-insensitive).
// Matches runewords.htm column headers:
//   Col 4: "Weapons / Gloves"
//   Col 5: "Helms / Boots / Staves / Orbs / Wands" (also used by Charms)
//   Col 6: "Armor / Shields / Belts"
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
  ],
  helmsBoots: ['helm', 'boot', 'circlet', 'cap', 'mask', 'crown', 'staff', 'orb', 'wand', 'charm', 'pelt'],
  armorShieldsBelts: ['armor', 'shield', 'belt', 'plate', 'paladin item'],
};

// Fallback display labels for each category (used when dynamic labels can't be generated)
export const CATEGORY_LABELS: Record<BonusCategory, string> = {
  weaponsGloves: 'Weapons/Gloves',
  helmsBoots: 'Helms/Boots/Staves/Orbs/Wands',
  armorShieldsBelts: 'Armor/Shields/Belts',
};

/**
 * Determines which bonus category an item type belongs to.
 */
export function getItemCategory(itemType: string): BonusCategory | null {
  const lowerItem = itemType.toLowerCase();

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
  const order: BonusCategory[] = ['weaponsGloves', 'helmsBoots', 'armorShieldsBelts'];
  return order.filter((cat) => categories.has(cat));
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
