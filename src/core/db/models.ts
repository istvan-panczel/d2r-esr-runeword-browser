// Shared types for socketable items

export interface Affix {
  readonly rawText: string;
  readonly pattern: string;
  readonly value: number | readonly [number, number] | null;
  readonly valueType: 'flat' | 'percent' | 'range' | 'none';
}

export interface SocketableBonuses {
  readonly weaponsGloves: readonly Affix[];
  readonly helmsBoots: readonly Affix[];
  readonly armorShieldsBelts: readonly Affix[];
}

/** A random bonus pool of a recipe, e.g. "1-2 of the following:" followed by the candidate affixes. */
export interface BonusPool {
  readonly label: string;
  readonly affixes: readonly Affix[];
}

/** One item type of a socketable bonus group label, e.g. "Weapon" with `except: ['Orb', 'Staff', 'Wand']`. */
export interface SocketableBonusGroupType {
  readonly name: string;
  /** Item types excluded from this one only ("Weapon (except Orb, Staff, Wand)"); [] when none */
  readonly except: readonly string[];
}

/**
 * The combined bonuses of a recipe's runes / gems for some of its bases, as the ESR 3.3+ runewords.htm and
 * gemwords.htm list them in their "Socketable Bonuses" column. A row has either one unlabelled group (`label` '',
 * `itemTypes` []: applies to every allowed base) or one group per item-type label, e.g.
 * "Weapon (except Orb, Staff, Wand) / Missile / Mythical Arcane Staff" and "Staff / Wand / Orb".
 */
export interface SocketableBonusGroup {
  /** The label as the site shows it; '' for the single group that applies to every allowed base */
  readonly label: string;
  /** The label's item types, each with its own exceptions; [] for the unlabelled group */
  readonly itemTypes: readonly SocketableBonusGroupType[];
  readonly affixes: readonly Affix[];
}

export interface ColumnBonusPools {
  readonly weaponsGloves: readonly BonusPool[];
  readonly helmsBoots: readonly BonusPool[];
  readonly armorShieldsBelts: readonly BonusPool[];
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
  readonly sockets: number; // Base/minimum socket count (= listed runes/gems + required jewels)
  readonly socketsMax?: number; // Only set when the source shows a range, e.g. "(2-3 Socket)" for recipes taking optional jewels
  readonly reqLevel: number; // Highest required level among all runes and gems
  readonly sortKey: number; // Pre-calculated sort key (= reqLevel); legacy cached rows: LoD = 10000 + reqLevel
  readonly isLod: boolean; // Has a LoD-exclusive rune (shared runes like Ko alone do not count); absent on old cached rows
  readonly runes: readonly string[];
  readonly gems: readonly string[]; // Gem names in the recipe (e.g. ["Perfect Topaz", "Perfect Topaz"])
  readonly ingredients: readonly string[]; // All items in original order (runes + gems interleaved)
  readonly allowedItems: readonly string[];
  readonly excludedItems: readonly string[]; // Items excluded from this variant
  readonly affixes: readonly Affix[]; // Runeword bonuses from first non-empty column (backward compat)
  readonly columnAffixes: SocketableBonuses; // Per-column runeword bonuses (weapon/helm/armor)
  readonly tierPointTotals: readonly TierPointTotal[]; // Pre-calculated tier point totals
  readonly jewelInfo?: string; // Jewels: "(0-3) Jewels" / "(1-3) Jewels" (with socketsMax) or required "(2) Jewels" (fixed sockets)
  readonly socketableBonuses?: readonly SocketableBonusGroup[]; // The site's rune/gem bonuses per item-type group (ESR 3.3+); undefined for old cached data
}

// Gemword types

export interface Gemword {
  readonly name: string;
  readonly variant: number; // 1, 2, 3... for multi-variant gemwords
  readonly sockets: number;
  readonly reqLevel: number; // Highest required level among the recipe's gems
  readonly sortKey: number; // Pre-calculated sort key (= reqLevel, gems have no tier points)
  readonly gems: readonly string[]; // Gem names in the recipe
  readonly ingredients: readonly string[]; // Same as gems, kept for model symmetry with Runeword
  readonly allowedItems: readonly string[];
  readonly affixes: readonly Affix[]; // Gemword bonuses from first non-empty column (backward compat)
  readonly columnAffixes: SocketableBonuses; // Per-column gemword bonuses (weapon/helm/armor)
  readonly columnBonusPools?: ColumnBonusPools; // Per-column random bonus pools (ESR 3.2+); undefined for old cached data
  readonly jewelInfo?: string; // Optional jewel requirement, e.g. "Jewel" (America, Canada, China)
  readonly socketableBonuses?: readonly SocketableBonusGroup[]; // The site's gem bonuses per item-type group (ESR 3.3+); undefined for old cached data
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
  readonly notes: string; // "Notes" column (ESR 3.12+), e.g. "Blessed Edge Variant"; empty for most items
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

// Ascendancy types

export interface AscendancyTier {
  readonly tier: number; // 1-5
  readonly bonuses: readonly string[];
}

export interface Ascendancy {
  readonly name: string; // PK, e.g. "Battlemage"
  readonly imageUrl: string; // Relative URL, e.g. "./images/ascendancies/battlemage.png"
  readonly tiers: readonly AscendancyTier[];
  readonly footnotes: readonly string[];
  /**
   * The Tier 1 Challenge recipe that makes this ascendancy's stone, one input per line as the page lists them:
   * ["Orb of Creation", "2 Blemished Sapphire", "2 Blemished Obsidian"]. Empty when the page has no recipe for it;
   * undefined in data cached before it existed.
   */
  readonly unlockInputs?: readonly string[];
}

/** One Input → Output row of a challenge table on ascendancies.htm, one entry per visual line of each cell. */
export interface AscendancyRecipe {
  readonly inputs: readonly string[]; // e.g. ["Ascendancy Stone", "Maple Leaf"]
  readonly outputs: readonly string[]; // e.g. ["Ascendancy Stone", "Upgraded to Tier 3"]
}

/** A "Tier N Challenge" section of ascendancies.htm: how to unlock (tier 1) or upgrade the Ascendancy Stone. */
export interface AscendancyChallenge {
  readonly tier: number; // PK, 1-5
  /** Plain-text paragraphs (emphasis dropped, hard-wrapped lines re-joined) */
  readonly description: readonly string[];
  /** Tier 1 lists one recipe per ascendancy, the later tiers one each */
  readonly recipes: readonly AscendancyRecipe[];
}

// Metadata

export interface Metadata {
  readonly key: string;
  readonly value: string;
}
