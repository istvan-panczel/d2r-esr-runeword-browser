interface ItemTypeCategory {
  readonly label: string;
  readonly itemTypes: readonly string[];
}

const ITEM_TYPE_CATEGORIES: readonly ItemTypeCategory[] = [
  {
    label: 'Weapons',
    itemTypes: [
      '2H Swing Weapon',
      'Axe',
      'Blunt',
      'Club',
      'Hammer',
      'Hand to Hand',
      'Knife',
      'Mace',
      'Melee Weapon',
      'Polearm',
      'Scepter',
      'Spear',
      'Staff',
      'Sword',
      'Wand',
      'Weapon',
    ],
  },
  {
    label: 'Missile',
    itemTypes: ['Crossbow', 'Missile', 'Missile Weapon'],
  },
  {
    label: 'Armor',
    itemTypes: ['Any Armor', 'Any Shield', 'Belt', 'Body Armor', 'Boots', 'Gloves', 'Helm'],
  },
  {
    label: 'Class-Specific',
    itemTypes: ['Assassin 2H Katana', 'Orb', 'Paladin Item', 'Paladin Sword', 'Pelt', 'Shuriken', 'Sorceress Mana Blade'],
  },
  {
    label: 'Other',
    itemTypes: ['Charm'],
  },
];

const KNOWN_ITEM_TYPES = new Set(ITEM_TYPE_CATEGORIES.flatMap((c) => c.itemTypes));

interface GroupedItemTypes {
  readonly label: string;
  readonly itemTypes: readonly string[];
}

export function groupItemTypesByCategory(availableTypes: readonly string[]): GroupedItemTypes[] {
  const availableSet = new Set(availableTypes);
  const groups: GroupedItemTypes[] = [];

  for (const category of ITEM_TYPE_CATEGORIES) {
    const matching = category.itemTypes.filter((t) => availableSet.has(t));
    if (matching.length > 0) {
      groups.push({ label: category.label, itemTypes: matching });
    }
  }

  const uncategorized = availableTypes.filter((t) => !KNOWN_ITEM_TYPES.has(t));
  if (uncategorized.length > 0) {
    groups.push({ label: 'New', itemTypes: uncategorized });
  }

  return groups;
}
