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
  readonly reqLevel: number; // Highest required level among all runes and gems
  readonly sortKey: number; // Pre-calculated sort key: ESR/Kanji (0-9999) or LoD (10000+) + reqLevel
  readonly runes: readonly string[];
  readonly gems: readonly string[]; // Gem names in the recipe (e.g. ["Perfect Topaz", "Perfect Topaz"])
  readonly ingredients: readonly string[]; // All items in original order (runes + gems interleaved)
  readonly allowedItems: readonly string[];
  readonly excludedItems: readonly string[]; // Items excluded from this variant
  readonly affixes: readonly Affix[]; // Runeword bonuses from first non-empty column (backward compat)
  readonly columnAffixes: SocketableBonuses; // Per-column runeword bonuses (weapon/helm/armor)
  readonly tierPointTotals: readonly TierPointTotal[]; // Pre-calculated tier point totals
  readonly jewelInfo?: string; // Optional jewel info for Kanji runewords, e.g. "(0-3) Jewels"
}

// HTM Unique Items

export type HtmUniqueItemPage = 'weapons' | 'armors' | 'other';

export interface HtmUniqueItem {
  readonly id?: number; // Auto-increment primary key
  readonly name: string;
  readonly baseItem: string;
  readonly baseItemCode: string;
  readonly page: HtmUniqueItemPage;
  readonly category: string;
  readonly itemLevel: number;
  readonly reqLevel: number;
  readonly properties: readonly string[];
  readonly isAncientCoupon: boolean;
  readonly gambleItem: string;
}

// Mythical Unique Items

export interface MythicalUnique {
  readonly id?: number;
  readonly name: string;
  readonly baseItem: string;
  readonly baseItemLink: string;
  readonly category: string;
  readonly itemLevel: number;
  readonly reqLevel: number;
  readonly properties: readonly string[];
  readonly specialProperties: readonly string[];
  readonly notes: readonly string[];
  readonly imageUrl: string;
}

// Metadata

export interface Metadata {
  readonly key: string;
  readonly value: string;
}
