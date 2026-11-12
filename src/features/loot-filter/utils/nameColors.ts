/**
 * The colour label previews draw text without a colour code in: the game's colour for the name of the items a rule
 * matches (`engine/nameColor.ts`), and for a style the colour most of its rules give the name.
 *
 * A rule names no single item, so its conditions are read as far as they go: its `uniqueOrSetIds`, else the item codes
 * (or, without them, the items of its item types) through the game data, its `quality`, `isEthereal` and a `sockets`
 * range without 0. A base's unique and set rows give the name colour at those qualities when they share one (the Ores
 * `ÿc7Ore`, the ascendancy stones `ÿc@…`). When the rule leaves something open that changes the colour (a weapon of any
 * quality), its items have no one colour.
 */
import type { LootFilterItem, LootFilterUniqueOrSet } from '@/features/game-data/engine/schema';
import { isNamedList, isNumberList, namedToNumber } from '../engine/match';
import { itemNameColor, qualityColorCode, sameLabelColor } from '../engine/nameColor';
import { splitColorRuns } from '../engine/text';
import {
  QUALITIES,
  type LootFilter,
  type LootFilterRule,
  type NamedMatch,
  type NumberMatch,
  type QualityColors,
  type QualityName,
} from '../engine/types';
import { effectiveActions, PREVIEW_ITEM_NAME, previewLabelText } from './effectiveActions';
import { EMPTY_LOOKUP, type LootFilterLookup } from './lookup';

/** Every quality number, inferior (1) to tempered (9). */
const ALL_QUALITIES: readonly number[] = QUALITIES.map((_, index) => index + 1);
const NORMAL = 2;

/** The quality numbers (1 = inferior … 9 = tempered) a `quality` condition allows; unknown names and numbers allow none. */
function allowedQualities(match: NamedMatch<QualityName>): number[] {
  const toNumber = (value: string | number) => namedToNumber(value, QUALITIES, 1);
  let numbers: (number | undefined)[];
  if (typeof match === 'string' || typeof match === 'number') numbers = [toNumber(match)];
  else if (isNamedList(match)) numbers = match.map(toNumber);
  else {
    const min = match.min === undefined ? 1 : toNumber(match.min);
    const max = match.max === undefined ? QUALITIES.length : toNumber(match.max);
    numbers = min === undefined || max === undefined ? [] : ALL_QUALITIES.filter((number) => number >= min && number <= max);
  }
  return numbers.filter((number): number is number => number !== undefined && ALL_QUALITIES.includes(number));
}

/** Groups colour codes the label draws alike (`sameLabelColor`); the first code of a group names it. */
class ColorTally {
  private readonly buckets: { code: string | undefined; count: number }[] = [];

  add(code: string | undefined, count = 1): void {
    const bucket = this.buckets.find((entry) =>
      entry.code === undefined || code === undefined ? entry.code === code : sameLabelColor(entry.code, code)
    );
    if (bucket === undefined) this.buckets.push({ code, count });
    else bucket.count += count;
  }

  /** The code with the most votes, ties to the one counted first; undefined when "no colour" wins or nothing was counted. */
  winner(): string | undefined {
    let best: { code: string | undefined; count: number } | undefined;
    for (const bucket of this.buckets) if (best === undefined || bucket.count > best.count) best = bucket;
    return best?.code;
  }
}

/**
 * The colour code the game names an item of the quality in when its label has none, when every quality the condition
 * allows has the same one (`qualityColors` included); else undefined (it depends on the item).
 */
export function qualityNameColor(quality: NamedMatch<QualityName> | undefined, qualityColors?: QualityColors): string | undefined {
  if (quality === undefined) return undefined;
  const codes = allowedQualities(quality).map((number) => qualityColorCode(number, qualityColors));
  const first = codes[0];
  return first !== undefined && codes.every((code) => code !== undefined && sameLabelColor(first, code)) ? first : undefined;
}

/** What a rule's conditions tell about the look of its items, beside which items they are. */
interface RuleLook {
  /** The qualities the rule allows; undefined: any. */
  readonly qualities: readonly number[] | undefined;
  readonly ethereal: boolean;
  /** The `sockets` condition leaves out 0. */
  readonly socketed: boolean;
}

function allowsZero(match: NumberMatch): boolean {
  if (typeof match === 'number') return match === 0;
  if (isNumberList(match)) return match.includes(0);
  return (match.min === undefined || match.min <= 0) && (match.max === undefined || match.max >= 0);
}

function ruleLook(rule: LootFilterRule): RuleLook {
  return {
    qualities: rule.quality === undefined ? undefined : allowedQualities(rule.quality),
    ethereal: rule.isEthereal === true,
    socketed: rule.sockets !== undefined && !allowsZero(rule.sockets),
  };
}

/**
 * The name colour of the unique (or set) rows on a base: their shared colour code, `''` when they share having none,
 * `MIXED` when they differ; undefined when the base has no such row.
 */
type RowsColor = string | typeof MIXED | undefined;
const MIXED = Symbol('mixed');

/** What decides an item's name colour beside the rule's look; items alike share a `key`. */
interface ItemProfile {
  readonly key: string;
  readonly typeAncestors: readonly string[];
  readonly baseNameColor?: string;
  readonly isQuest: boolean;
  /**
   * The qualities the item comes in when the rule does not say: normal only when a type of it says so (itemtypes.txt
   * `Normal`) or none of its types rolls magic or rare; unique and/or set only for a base that is not spawnable and
   * has such rows (a shadow base); undefined: any.
   */
  readonly qualities?: readonly number[];
  /** The name colour of the base's unique rows (quality 7) and set rows (quality 5). */
  readonly uniqueColor?: RowsColor;
  readonly setColor?: RowsColor;
}

/** An item the rule tells nothing about (no codes, unknown codes, no game data). */
const ANY_ITEM: ItemProfile = { key: '', typeAncestors: [], isQuest: false };
const UNIQUE = 7;
const SET = 5;

/** Per game data: each item's type ancestors and profile, and the type-expansion counts already made. */
interface LookupCache {
  readonly profiles: ReadonlyMap<string, ItemProfile>;
  readonly typeCounts: Map<string, ReadonlyMap<ItemProfile, number>>;
}

const caches = new WeakMap<LootFilterLookup, LookupCache>();

function typeAncestorsOfItem(item: LootFilterItem, lookup: LootFilterLookup): readonly string[] {
  const codes = [item.type, item.type2].filter((code): code is string => code !== undefined && code !== '');
  return [...new Set(codes.flatMap((code) => lookup.itemType(code)?.ancestors ?? [code]))];
}

/** Per base code, the name colour its rows share (`RowsColor`). */
function rowsColors(rows: readonly LootFilterUniqueOrSet[]): Map<string, RowsColor> {
  const colors = new Map<string, RowsColor>();
  for (const row of rows) {
    const color = row.nameColor ?? '';
    const known = colors.get(row.code);
    colors.set(row.code, known === undefined || known === color ? color : MIXED);
  }
  return colors;
}

const rowsKey = (color: RowsColor) => (color === undefined ? '-' : color === MIXED ? '*' : color);

function lookupCache(lookup: LootFilterLookup): LookupCache {
  const cached = caches.get(lookup);
  if (cached !== undefined) return cached;
  const uniqueColors = rowsColors(lookup.uniques);
  const setColors = rowsColors(lookup.sets);
  const byKey = new Map<string, ItemProfile>();
  const profiles = new Map<string, ItemProfile>();
  for (const item of lookup.items) {
    const typeAncestors = typeAncestorsOfItem(item, lookup);
    const info = typeAncestors.map((code) => lookup.itemType(code));
    // itemtypes.txt `Normal` (runes, gems, potions, keys…), or no type that rolls magic or rare (the quest type `ques`)
    const known = info.length > 0 && info.every((type) => type !== undefined);
    const normalOnly = info.some((type) => type?.normal === true) || (known && !info.some((type) => type.magic || type.rare));
    const isQuest = item.quest === true;
    const uniqueColor = uniqueColors.get(item.code);
    const setColor = setColors.get(item.code);
    const named = [...(setColor === undefined ? [] : [SET]), ...(uniqueColor === undefined ? [] : [UNIQUE])];
    const qualities = !item.spawnable && named.length > 0 ? named : normalOnly ? [NORMAL] : undefined;
    // Items alike name in the same colour: the colour only reads these fields and the rune/potion/gold types
    const special = ['rune', 'rpot', 'hpot', 'mpot', 'gold'].filter((code) => typeAncestors.includes(code)).join(',');
    const key = [item.nameColor ?? '', String(isQuest), special, qualities?.join(',') ?? '', rowsKey(uniqueColor), rowsKey(setColor)].join(
      '|'
    );
    let profile = byKey.get(key);
    if (profile === undefined) {
      profile = {
        key,
        typeAncestors,
        ...(item.nameColor === undefined ? {} : { baseNameColor: item.nameColor }),
        isQuest,
        ...(qualities === undefined ? {} : { qualities }),
        ...(uniqueColor === undefined ? {} : { uniqueColor }),
        ...(setColor === undefined ? {} : { setColor }),
      };
      byKey.set(key, profile);
    }
    profiles.set(item.code, profile);
  }
  const cache: LookupCache = { profiles, typeCounts: new Map() };
  caches.set(lookup, cache);
  return cache;
}

/** How many items of each profile the rule's item types hold, item codes and types it excludes left out. */
function typeProfileCounts(rule: LootFilterRule, lookup: LootFilterLookup, cache: LookupCache): ReadonlyMap<ItemProfile, number> {
  const types = rule.itemTypes ?? [];
  const excludedTypes = rule.excludeItemTypes ?? [];
  const excludedCodes = rule.excludeItemCodes ?? [];
  const key = JSON.stringify([types, excludedTypes, excludedCodes]);
  const known = cache.typeCounts.get(key);
  if (known !== undefined) return known;
  const counts = new Map<ItemProfile, number>();
  for (const item of lookup.items) {
    if (excludedCodes.includes(item.code)) continue;
    const ancestors = typeAncestorsOfItem(item, lookup);
    if (!types.some((type) => ancestors.includes(type)) || excludedTypes.some((type) => ancestors.includes(type))) continue;
    const profile = cache.profiles.get(item.code) ?? ANY_ITEM;
    counts.set(profile, (counts.get(profile) ?? 0) + 1);
  }
  cache.typeCounts.set(key, counts);
  return counts;
}

/** The colour an item of the profile has at one quality; undefined when its unique (or set) rows differ in colour. */
function qualityColor(
  profile: ItemProfile,
  quality: number,
  look: RuleLook,
  qualityColors: QualityColors | undefined,
  named: RowsColor = quality === UNIQUE ? profile.uniqueColor : quality === SET ? profile.setColor : undefined
): string | undefined {
  if (named === MIXED) return undefined;
  return itemNameColor(
    {
      quality,
      typeAncestors: profile.typeAncestors,
      isEthereal: look.ethereal,
      sockets: look.socketed ? 1 : 0,
      ...(profile.baseNameColor === undefined ? {} : { baseNameColor: profile.baseNameColor }),
      ...(named === undefined || named === '' ? {} : { uniqueNameColor: named }),
      isQuest: profile.isQuest,
    },
    qualityColors
  );
}

/** The one colour of a list of colours (codes drawn alike count as one), else undefined. */
function single(codes: readonly (string | undefined)[]): string | undefined {
  const first = codes.at(0);
  return first !== undefined && codes.every((code) => code !== undefined && sameLabelColor(first, code)) ? first : undefined;
}

/** The one colour the profile's items have under the rule's look, else undefined (it depends on the quality). */
function profileColor(profile: ItemProfile, look: RuleLook, qualityColors: QualityColors | undefined): string | undefined {
  const qualities = look.qualities ?? profile.qualities ?? ALL_QUALITIES;
  return single(qualities.map((quality) => qualityColor(profile, quality, look, qualityColors)));
}

/**
 * The votes of a rule's `uniqueOrSetIds`: per id the colour of its unique row (quality unique) and its set row
 * (quality set), the qualities the rule allows; the evaluator matches the id against either table (the item's quality
 * tells which), so an id both tables have counts both rows. An id without a row casts no vote.
 */
function uniqueOrSetVotes(
  rule: LootFilterRule,
  look: RuleLook,
  lookup: LootFilterLookup,
  cache: LookupCache,
  qualityColors: QualityColors | undefined
): (string | undefined)[] {
  const allows = (quality: number) => look.qualities === undefined || look.qualities.includes(quality);
  const votes: (string | undefined)[] = [];
  for (const id of rule.uniqueOrSetIds ?? []) {
    const colors: (string | undefined)[] = [];
    for (const [kind, quality] of [
      ['unique', UNIQUE],
      ['set', SET],
    ] as const) {
      const row = lookup.uniqueOrSet(id, kind);
      if (row === undefined || !allows(quality)) continue;
      const profile = cache.profiles.get(row.code) ?? ANY_ITEM;
      colors.push(qualityColor(profile, quality, look, qualityColors, row.nameColor ?? ''));
    }
    if (colors.length > 0) votes.push(single(colors));
  }
  return votes;
}

/**
 * The colour code the game names the rule's items in (`itemNameColor`), as far as its conditions tell: its unique and
 * set ids, else its item codes through the game data, else the items of its item types, with its quality, ethereal and
 * sockets conditions. When the
 * items differ, the colour most of them have (ties to the first listed); undefined when most have no one colour (a
 * weapon of any quality) or nothing is known. Without the game data the codes tell nothing; the quality still does.
 */
export function ruleItemColor(rule: LootFilterRule, filter: LootFilter, lookup: LootFilterLookup = EMPTY_LOOKUP): string | undefined {
  const look = ruleLook(rule);
  const cache = lookupCache(lookup);
  const tally = new ColorTally();
  const colors = new Map<ItemProfile, string | undefined>();
  const colorOf = (profile: ItemProfile) => {
    if (!colors.has(profile)) colors.set(profile, profileColor(profile, look, filter.qualityColors));
    return colors.get(profile);
  };
  const codes = rule.itemCodes ?? [];
  const idVotes = uniqueOrSetVotes(rule, look, lookup, cache, filter.qualityColors);
  if (idVotes.length > 0) {
    for (const vote of idVotes) tally.add(vote);
  } else if (codes.length > 0) {
    for (const code of codes) tally.add(colorOf(cache.profiles.get(code) ?? ANY_ITEM));
  } else if ((rule.itemTypes ?? []).length > 0 && lookup.items.length > 0) {
    const counts = typeProfileCounts(rule, lookup, cache);
    for (const [profile, count] of counts) tally.add(colorOf(profile), count);
    if (counts.size === 0) tally.add(colorOf(ANY_ITEM));
  } else if (rule.itemTypes !== undefined && rule.itemTypes.length > 0) {
    // Without the game data the types tell what they are themselves (a rune is orange)
    tally.add(colorOf({ ...ANY_ITEM, key: 'types', typeAncestors: rule.itemTypes }));
  } else {
    tally.add(colorOf(ANY_ITEM));
  }
  return tally.winner();
}

/**
 * The colour a rule draws the name in on its label: the colour code in effect where the sample name stands (the first
 * visible text when the label has no `{name}`), and for text without one the rule's item colour (`ruleItemColor`, else
 * its quality's). Undefined when the label is hidden or nothing tells.
 */
export function ruleLabelNameColor(rule: LootFilterRule, filter: LootFilter, lookup: LootFilterLookup = EMPTY_LOOKUP): string | undefined {
  const actions = effectiveActions(rule, filter);
  if (actions.hide === true) return undefined;
  const visible = splitColorRuns(previewLabelText(actions)).filter((segment) => segment.kind === 'text' && segment.text.trim() !== '');
  const segment = visible.find((entry) => entry.kind === 'text' && entry.text.includes(PREVIEW_ITEM_NAME)) ?? visible.at(0);
  if (segment?.kind !== 'text') return undefined;
  return segment.color ?? ruleItemColor(rule, filter, lookup) ?? qualityNameColor(rule.quality, filter.qualityColors);
}

/**
 * Per style, the colour its preview draws text without a colour code in: the one most of the rules pulling the style
 * in draw the name in (`ruleLabelNameColor`; ties go to the earlier rule). Styles rarely colour the name themselves:
 * the rules rename the item (`ÿc1Ber Rune`) or match items the game colours (unique gold, runes orange). A style no
 * rule tells about has no entry. Computed once for the whole filter.
 */
export function styleNameColors(filter: LootFilter, lookup: LootFilterLookup = EMPTY_LOOKUP): ReadonlyMap<string, string> {
  const tallies = new Map<string, ColorTally>();
  for (const rule of filter.rules) {
    // A disabled rule (the editor's `disabled`, written to `disabledRules`) never reaches the game
    if (rule.useStyle === undefined || rule.disabled === true) continue;
    const color = ruleLabelNameColor(rule, filter, lookup);
    if (color === undefined) continue;
    let tally = tallies.get(rule.useStyle);
    if (tally === undefined) {
      tally = new ColorTally();
      tallies.set(rule.useStyle, tally);
    }
    tally.add(color);
  }
  const colors = new Map<string, string>();
  for (const [name, tally] of tallies) {
    const winner = tally.winner();
    if (winner !== undefined) colors.set(name, winner);
  }
  return colors;
}

/**
 * The colour a rule's label preview draws text without a colour code in: the colour the game names its items in
 * (`ruleItemColor`, else its quality's); only when the rule tells nothing, the colour its style's rules usually give
 * the name (`styleColors`, from `styleNameColors`), so the preview matches the style picker. Undefined: plain white.
 */
export function rulePreviewColor(
  rule: LootFilterRule,
  filter: LootFilter,
  lookup: LootFilterLookup = EMPTY_LOOKUP,
  styleColors: ReadonlyMap<string, string> = styleNameColors(filter, lookup)
): string | undefined {
  return (
    ruleItemColor(rule, filter, lookup) ??
    qualityNameColor(rule.quality, filter.qualityColors) ??
    (rule.useStyle === undefined ? undefined : styleColors.get(rule.useStyle))
  );
}
