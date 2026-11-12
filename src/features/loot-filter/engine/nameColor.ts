/**
 * The colour the game names an item in on its ground label (and wherever text without a colour code follows the name):
 * what a label preview draws uncoloured text in.
 *
 * Verified: the ESR loot filter guide (p. 10): `qualityColors` recolours names by quality, "Only a quality's plain color
 * changes. Runes, quest items, socketed or ethereal gray and broken red keep their own colors." `TooltipStyle` in
 * `_profilehd.json` names the label colours (`COLOR_CODES` = to M). ESR names many items in colour in its string tables
 * (`ÿc4No Rune`; the bundle's `nameColor`).
 *
 * Inferred, not sourced (verify in game):
 * - Precedence: the name's own colour code, the quest colour, the rune colour, the potion and gold colours, broken red,
 *   socketed gray, ethereal gray, the quality colour.
 * - The base name's own code shows on white items (inferior, normal, superior) only: a magic, rare or crafted item is
 *   named by its affixes first, a unique or set item by its own name (which may have a code: the Ores `ÿc7Ore`).
 * - Socketed and ethereal gray apply to white items only; an ethereal unique stays gold.
 * - Broken (durability 0 of a maximum above 0, not indestructible) is red whatever the quality.
 * - Only the `quest` column makes a name quest gold: Key of Terror `pk1`, the organs and the mastery tokens (type `ques`
 *   or others, without the flag and without a colour code) are plain white names.
 *
 * Approximations of the previews (one default colour per label):
 * - Text without a code BEFORE `{name}` is drawn in the name's colour too; the game probably draws it in the
 *   type or quality colour and only the name in its own code.
 * - The name's colour is the code in effect at its end (`nameColorCode`), carried across the line break of a
 *   multi-line name (`ÿc4(I -> El)\nAncient Decal`); whether the game carries a code across lines is not checked.
 */
import { colorCodeRgb, DEFAULT_QUALITY_COLORS } from './colors.ts';
import { QUALITIES, type QualityColors, type QualityName } from './types.ts';

/** Label colour codes of the `TooltipStyle` entries the name colour picks from (see `COLOR_CODES`). */
export const LABEL_COLORS = {
  default: '=',
  quest: '>',
  rune: 'J',
  socketed: 'K',
  ethereal: 'I',
  healthPotion: 'E',
  manaPotion: 'F',
  rejuvPotion: 'G',
  gold: 'H',
  broken: '1',
} as const;

/** What decides an item's name colour; the Test tab's `TestItem` has every field. */
export interface NameColorItem {
  /** 1 (inferior) to 9 (tempered). */
  readonly quality: number;
  /** The item's type and its parent types (itemtypes.txt codes). */
  readonly typeAncestors: readonly string[];
  readonly isEthereal: boolean;
  readonly sockets: number;
  /** The colour code the base item's name ends in (lootfilter.json `items[].nameColor`). */
  readonly baseNameColor?: string;
  /** The colour code the unique's or set item's name ends in (lootfilter.json `uniques[].nameColor`). */
  readonly uniqueNameColor?: string;
  /** misc.txt / weapons.txt `quest` (lootfilter.json `items[].quest`). */
  readonly isQuest?: boolean;
  readonly isBroken?: boolean;
}

const WHITE_QUALITIES: ReadonlySet<number> = new Set([1, 2, 3]);
/** Qualities named by the unique's or set item's own name: set, unique. */
const NAMED_QUALITIES: ReadonlySet<number> = new Set([5, 7]);

/**
 * The colour code (the character after `ÿc`) the filter names a quality in: its `qualityColors` entry when that is one
 * colour code (the plugin ignores anything else), else the game's. Undefined for a number that names no quality.
 */
export function qualityColorCode(quality: number, qualityColors?: QualityColors): string | undefined {
  const name: QualityName | undefined = Number.isInteger(quality) && quality >= 1 ? QUALITIES.at(quality - 1) : undefined;
  if (name === undefined) return undefined;
  const override = qualityColors?.[name];
  if (override !== undefined && /^ÿc.$/su.test(override) && colorCodeRgb(override) !== undefined) return override.slice(2);
  return DEFAULT_QUALITY_COLORS[name].slice(2);
}

/** The colour code of an item type of its own (runes, potions, gold), else undefined. */
function typeColor(ancestors: readonly string[]): string | undefined {
  if (ancestors.includes('rune')) return LABEL_COLORS.rune;
  // A rejuvenation potion counts as a healing and a mana potion too: test it first
  if (ancestors.includes('rpot')) return LABEL_COLORS.rejuvPotion;
  if (ancestors.includes('hpot')) return LABEL_COLORS.healthPotion;
  if (ancestors.includes('mpot')) return LABEL_COLORS.manaPotion;
  if (ancestors.includes('gold')) return LABEL_COLORS.gold;
  return undefined;
}

/**
 * The colour code (the character after `ÿc`) the game names the item in on its label: the default colour of label text
 * without a colour code. See the header for the precedence and what is inferred.
 */
export function itemNameColor(item: NameColorItem, qualityColors?: QualityColors): string {
  const white = WHITE_QUALITIES.has(item.quality);
  const own = white ? item.baseNameColor : NAMED_QUALITIES.has(item.quality) ? item.uniqueNameColor : undefined;
  if (own !== undefined && own !== '') return own;
  if (item.isQuest === true) return LABEL_COLORS.quest;
  const ofType = typeColor(item.typeAncestors);
  if (ofType !== undefined) return ofType;
  if (item.isBroken === true) return LABEL_COLORS.broken;
  if (white && item.sockets > 0) return LABEL_COLORS.socketed;
  if (white && item.isEthereal) return LABEL_COLORS.ethereal;
  return qualityColorCode(item.quality, qualityColors) ?? LABEL_COLORS.default;
}

/** itemstatcost.txt rows of the durability stats (the same in every version of the game). */
export const DURABILITY_STAT = 72;
export const MAX_DURABILITY_STAT = 73;
export const INDESTRUCTIBLE_STAT = 152;

/** Broken: durability 0 of a maximum above 0, and not indestructible. Without the durability stats an item is not. */
export function isBrokenItem(stats: readonly { readonly stat: number; readonly value: number }[]): boolean {
  const value = (stat: number) => stats.find((entry) => entry.stat === stat)?.value;
  const durability = value(DURABILITY_STAT);
  const max = value(MAX_DURABILITY_STAT);
  return durability === 0 && max !== undefined && max > 0 && (value(INDESTRUCTIBLE_STAT) ?? 0) <= 0;
}

/** Two colour codes the label draws alike (gray `I` and `K`, white `=`, `E` to `H`): their RGB is the same. */
export function sameLabelColor(a: string, b: string): boolean {
  if (a === b) return true;
  const left = colorCodeRgb(a);
  const right = colorCodeRgb(b);
  return left !== undefined && right !== undefined && left.every((channel, index) => channel === right[index]);
}
