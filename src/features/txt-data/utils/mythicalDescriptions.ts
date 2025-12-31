/**
 * Mythical item descriptions
 * These special descriptions are referenced by monster hcIdx in monstats.txt
 * but the actual text is in the game's localization files, not txt files.
 * This is a manual mapping of the description texts.
 */

export interface MythicalDescription {
  readonly id: number;
  readonly key: string;
  readonly lines: readonly string[];
}

/**
 * Mapping of monster hcIdx to mythical description text
 * Add new entries as they are discovered/needed
 */
export const MYTHICAL_DESCRIPTIONS: ReadonlyMap<number, MythicalDescription> = new Map([
  // Ancient Totem of Scosglen
  [
    1074,
    {
      id: 1074,
      key: 'scosglenresonancedesc',
      lines: [
        'Every 5 attacks, you gain Resonance with a specific element, empowering the element and making Flameburst, Twister, or Frozen Blast fire three times more projectiles, respectively',
        'Elemental spells now synergize across all elements',
      ],
    },
  ],
  // Add more mythical descriptions here as needed
  // Format:
  // [hcIdx, { id: hcIdx, key: 'localization_key', lines: ['description line 1', 'description line 2'] }],
]);

/**
 * Special property codes that display as yellow/special text
 * These are boolean flags that trigger special item descriptions
 */
export const SPECIAL_DESCRIPTION_PROPERTIES: ReadonlyMap<string, string> = new Map([
  ['druid-summons-pounce', 'If you have at least 1000 dexterity, your Wolves can use Pounce'],
  // Add more special description properties here as needed
]);

/**
 * Get mythical description by monster hcIdx
 */
export function getMythicalDescription(hcIdx: number): MythicalDescription | undefined {
  return MYTHICAL_DESCRIPTIONS.get(hcIdx);
}

/**
 * Get special description for a property code
 */
export function getSpecialDescription(code: string): string | undefined {
  return SPECIAL_DESCRIPTION_PROPERTIES.get(code);
}

/**
 * Check if a property is a mythical description property (uses hcIdx lookup)
 */
export function isMythicalDescProperty(code: string): boolean {
  return (
    code === 'mythicaldescnoflag' || code === 'mythicaldesc' || code === 'mythicaldescmanaflag' || code === 'mythicaldescascendancyflag'
  );
}

/**
 * Check if a property is a special description property (direct code lookup)
 */
export function isSpecialDescProperty(code: string): boolean {
  return SPECIAL_DESCRIPTION_PROPERTIES.has(code);
}
