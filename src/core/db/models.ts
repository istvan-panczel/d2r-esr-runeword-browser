// Shared types for socketable items

export interface Affix {
  readonly rawText: string;
  readonly pattern: string;
  readonly value: number | readonly [number, number] | null;
  readonly valueType: 'flat' | 'percent' | 'range' | 'none';
}

export interface AffixPattern {
  readonly pattern: string;
  readonly valueType: 'flat' | 'percent' | 'range' | 'none';
}

export interface SocketableBonuses {
  readonly weaponsGloves: readonly Affix[];
  readonly helmsBoots: readonly Affix[];
  readonly armorShieldsBelts: readonly Affix[];
}

// Gem types

export type GemType = 'Amethyst' | 'Sapphire' | 'Emerald' | 'Ruby' | 'Diamond' | 'Topaz' | 'Skull' | 'Obsidian';
export type GemQuality = 'Chipped' | 'Flawed' | 'Standard' | 'Flawless' | 'Blemished' | 'Perfect';

export interface Gem {
  readonly name: string;
  readonly type: GemType;
  readonly quality: GemQuality;
  readonly color: string;
  readonly reqLevel: number;
  readonly bonuses: SocketableBonuses;
}

// ESR Rune types

export interface EsrRune {
  readonly name: string;
  readonly order: number; // Order in which rune appears in source file (1-based)
  readonly tier: number;
  readonly color: string;
  readonly reqLevel: number;
  readonly points?: number; // Rune points from "(X points)" suffix in HTML
  readonly bonuses: SocketableBonuses;
}

// LoD Rune types

export interface LodRune {
  readonly name: string;
  readonly order: number;
  readonly tier: number; // 1=Low (El-Dol), 2=Mid (Hel-Gul), 3=High (Vex-Zod)
  readonly reqLevel: number;
  readonly points?: number; // Rune points from "(X points)" suffix in HTML
  readonly bonuses: SocketableBonuses;
}

// Kanji Rune types

export interface KanjiRune {
  readonly name: string;
  readonly reqLevel: number;
  readonly bonuses: SocketableBonuses;
}

// Crystal types

export type CrystalType =
  | 'Shadow Quartz'
  | 'Frozen Soul'
  | 'Bleeding Stone'
  | 'Burning Sulphur'
  | 'Dark Azurite'
  | 'Bitter Peridot'
  | 'Pulsing Opal'
  | 'Enigmatic Cinnabar'
  | 'Tomb Jade'
  | 'Solid Mercury'
  | 'Storm Amber'
  | 'Tainted Tourmaline';

export type CrystalQuality = 'Chipped' | 'Flawed' | 'Standard';

export interface Crystal {
  readonly name: string;
  readonly type: CrystalType;
  readonly quality: CrystalQuality;
  readonly color: string;
  readonly reqLevel: number;
  readonly bonuses: SocketableBonuses;
}

// Runeword types

export type RuneCategory = 'esrRunes' | 'lodRunes';

export interface TierPointTotal {
  readonly tier: number;
  readonly category: RuneCategory;
  readonly totalPoints: number;
}

export interface Runeword {
  readonly name: string;
  readonly variant: number; // 1, 2, 3... for multi-variant runewords
  readonly sockets: number;
  readonly runes: readonly string[];
  readonly allowedItems: readonly string[];
  readonly excludedItems: readonly string[]; // Items excluded from this variant
  readonly affixes: readonly Affix[];
  readonly tierPointTotals: readonly TierPointTotal[]; // Pre-calculated tier point totals
}

// Metadata

export interface Metadata {
  readonly key: string;
  readonly value: string;
}
