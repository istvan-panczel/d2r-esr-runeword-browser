import type { GemType, GemQuality, CrystalType, CrystalQuality } from '@/core/db';

// Gem constants
export const GEM_TYPES: readonly GemType[] = ['Amethyst', 'Sapphire', 'Emerald', 'Ruby', 'Diamond', 'Topaz', 'Skull', 'Obsidian'];

export const GEM_QUALITIES: readonly GemQuality[] = ['Chipped', 'Flawed', 'Standard', 'Flawless', 'Blemished', 'Perfect'];

// LoD rune constants - Official runes in sequential order (El = 1, Zod = 33)
export const LOD_RUNE_NAMES: readonly string[] = [
  'El',
  'Eld',
  'Tir',
  'Nef',
  'Eth',
  'Ith',
  'Tal',
  'Ral',
  'Ort',
  'Thul',
  'Amn',
  'Sol',
  'Shael',
  'Dol',
  'Hel',
  'Io',
  'Lum',
  'Ko',
  'Fal',
  'Lem',
  'Pul',
  'Um',
  'Mal',
  'Ist',
  'Gul',
  'Vex',
  'Ohm',
  'Lo',
  'Sur',
  'Ber',
  'Jah',
  'Cham',
  'Zod',
];

// LoD rune tier labels
export const LOD_TIER_LABELS: Record<number, string> = {
  1: 'Low', // El-Dol (order 1-14)
  2: 'Mid', // Hel-Gul (order 15-25)
  3: 'High', // Vex-Zod (order 26-33)
};

// ESR rune constants - Colors mapped to tier numbers
export const ESR_COLOR_TO_TIER: Record<string, number> = {
  WHITE: 1,
  RED: 2,
  YELLOW: 3,
  ORANGE: 4,
  GREEN: 5,
  GOLD: 6,
  PURPLE: 7,
};

// Crystal constants
export const CRYSTAL_TYPES: readonly CrystalType[] = [
  'Shadow Quartz',
  'Frozen Soul',
  'Bleeding Stone',
  'Burning Sulphur',
  'Dark Azurite',
  'Bitter Peridot',
  'Pulsing Opal',
  'Enigmatic Cinnabar',
  'Tomb Jade',
  'Solid Mercury',
  'Storm Amber',
  'Tainted Tourmaline',
];

export const CRYSTAL_QUALITIES: readonly CrystalQuality[] = ['Chipped', 'Flawed', 'Standard'];
