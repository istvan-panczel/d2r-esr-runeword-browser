export type BonusCategory = 'weaponsGloves' | 'helmsBoots' | 'armorShieldsBelts';

// Keywords to match item types to categories (case-insensitive)
const CATEGORY_KEYWORDS: Record<BonusCategory, readonly string[]> = {
  weaponsGloves: [
    'weapon',
    'glove',
    'staff',
    'missile',
    'orb',
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
    'wand',
    'scepter',
  ],
  helmsBoots: ['helm', 'boot', 'circlet', 'cap', 'mask', 'crown'],
  armorShieldsBelts: ['armor', 'shield', 'belt', 'plate'],
};

// Display labels for each category
export const CATEGORY_LABELS: Record<BonusCategory, string> = {
  weaponsGloves: 'Weapons/Gloves',
  helmsBoots: 'Helms/Boots',
  armorShieldsBelts: 'Armor/Shields/Belts',
};

/**
 * Determines which bonus category an item type belongs to.
 */
function getItemCategory(itemType: string): BonusCategory | null {
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
