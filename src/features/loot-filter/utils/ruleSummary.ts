/** One-line rule summaries for the rule list, and the text its search box matches. */
import type { FilterText, ItemLocation, LootFilterRule, StatCheck } from '../engine/types';
import { resolveText, splitColorRuns } from '../engine/text';
import type { LootFilterLookup } from './lookup';
import { BASE_TIER_SCALE, DIFFICULTY_SCALE, formatNamedMatch, formatNumberMatch, QUALITY_SCALE } from './matchValues';
import { exceptionOf, formatStatCheck, readsExceptions, ruleExceptions } from './statChecks';

/** How many names a list shows before "+N". */
const LIST_PREVIEW = 2;

/** The text without colour codes and line breaks (the language's text, else enUS). */
export function plainText(text: FilterText | undefined): string | undefined {
  const resolved = resolveText(text);
  if (resolved === undefined) return undefined;
  return splitColorRuns(resolved)
    .map((segment) => (segment.kind === 'text' ? segment.text : ' '))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

function preview(names: readonly string[]): string {
  const shown = names.slice(0, LIST_PREVIEW).join(', ');
  return names.length > LIST_PREVIEW ? `${shown} +${String(names.length - LIST_PREVIEW)}` : shown;
}

function flag(value: boolean | undefined, yes: string, no: string): string | undefined {
  if (value === undefined) return undefined;
  return value ? yes : no;
}

function statPart(label: string, checks: readonly StatCheck[] | undefined, lookup: LootFilterLookup): string | undefined {
  if (checks === undefined || checks.length === 0) return undefined;
  const first = formatStatCheck(checks[0], lookup);
  return checks.length === 1 ? `${label}${first}` : `${label}${first} +${String(checks.length - 1)}`;
}

/** `unless A ≥1 or B ≥1 +1`: a hide rule's exceptions (`joiner` " or " for itemStats, " and " for itemStatsAnyOf). */
function unlessPart(exceptions: readonly StatCheck[], joiner: string, lookup: LootFilterLookup): string | undefined {
  if (exceptions.length === 0) return undefined;
  const shown = exceptions
    .slice(0, LIST_PREVIEW)
    .map((check) => formatStatCheck(check, lookup))
    .join(joiner);
  return exceptions.length > LIST_PREVIEW ? `unless ${shown} +${String(exceptions.length - LIST_PREVIEW)}` : `unless ${shown}`;
}

/**
 * The item stat parts. On a hide rule a `<`, `<=` or `!=` check reads as an exception (`X < 1` → "unless X ≥1"): in
 * `itemStats` one is enough to keep the item, in `itemStatsAnyOf` (when every check there is one) all are needed.
 */
function itemStatParts(rule: LootFilterRule, lookup: LootFilterLookup, exceptions: boolean): (string | undefined)[] {
  if (!exceptions) return [statPart('', rule.itemStats, lookup), statPart('any of ', rule.itemStatsAnyOf, lookup)];
  const found = ruleExceptions(rule);
  const plain = (rule.itemStats ?? []).filter((check) => exceptionOf(check) === undefined);
  return [
    statPart('', plain, lookup),
    unlessPart(found.any, ' or ', lookup),
    found.all.length > 0 ? unlessPart(found.all, ' and ', lookup) : statPart('any of ', rule.itemStatsAnyOf, lookup),
  ];
}

function count(n: number, one: string, many: string): string {
  return `${String(n)} ${n === 1 ? one : many}`;
}

/**
 * The rule's conditions in a few words: items, types, uniques, then quality, tier, sockets…; `any item` without any.
 * `exceptions`: whether a `<`, `<=` or `!=` item stat check reads as "unless …" (`readsExceptions` of the rule's
 * effective actions; callers with the filter pass it so a style's `hide` counts, the default looks at the rule's own).
 */
export function ruleConditionSummary(rule: LootFilterRule, lookup: LootFilterLookup, exceptions = readsExceptions(rule)): string {
  const itemName = (code: string) => lookup.itemName(code) ?? code;
  const typeName = (code: string) => lookup.typeName(code) ?? code;
  const uniqueName = (id: number) => lookup.uniqueOrSetName(id) ?? `#${String(id)}`;
  const parts = [
    rule.itemCodes && rule.itemCodes.length > 0 ? preview(rule.itemCodes.map(itemName)) : undefined,
    rule.itemTypes && rule.itemTypes.length > 0 ? preview(rule.itemTypes.map(typeName)) : undefined,
    rule.uniqueOrSetIds && rule.uniqueOrSetIds.length > 0 ? preview(rule.uniqueOrSetIds.map(uniqueName)) : undefined,
    rule.excludeItemCodes && rule.excludeItemCodes.length > 0 ? `not ${preview(rule.excludeItemCodes.map(itemName))}` : undefined,
    rule.excludeItemTypes && rule.excludeItemTypes.length > 0 ? `not ${preview(rule.excludeItemTypes.map(typeName))}` : undefined,
    rule.excludeUniqueOrSetIds && rule.excludeUniqueOrSetIds.length > 0
      ? `not ${preview(rule.excludeUniqueOrSetIds.map(uniqueName))}`
      : undefined,
    rule.quality === undefined ? undefined : formatNamedMatch(rule.quality, QUALITY_SCALE),
    rule.baseTier === undefined ? undefined : `${formatNamedMatch(rule.baseTier, BASE_TIER_SCALE)} tier`,
    flag(rule.isEthereal, 'eth', 'not eth'),
    flag(rule.isRuneword, 'runeword', 'not runeword'),
    flag(rule.isIdentified, 'identified', 'unidentified'),
    flag(rule.isFullySocketed, 'fully socketed', 'not fully socketed'),
    rule.itemLevel === undefined ? undefined : `ilvl ${formatNumberMatch(rule.itemLevel)}`,
    rule.sockets === undefined ? undefined : `${formatNumberMatch(rule.sockets)} sockets`,
    rule.maxSockets === undefined ? undefined : `${formatNumberMatch(rule.maxSockets)} max sockets`,
    ...itemStatParts(rule, lookup, exceptions),
    statPart('character ', rule.playerStats, lookup),
    statPart('character any of ', rule.playerStatsAnyOf, lookup),
    rule.difficulty === undefined ? undefined : formatNamedMatch(rule.difficulty, DIFFICULTY_SCALE),
    rule.areas && rule.areas.length > 0
      ? rule.areas.length <= LIST_PREVIEW
        ? `in ${preview(rule.areas.map((id) => lookup.areaName(id) ?? `area ${String(id)}`))}`
        : `in ${count(rule.areas.length, 'area', 'areas')}`
      : undefined,
    rule.excludeAreas && rule.excludeAreas.length > 0 ? `not in ${count(rule.excludeAreas.length, 'area', 'areas')}` : undefined,
  ].filter((part) => part !== undefined && part !== '');
  return parts.length === 0 ? 'any item' : parts.join(' · ');
}

/** The rule's main action: `hide`, `→ style X`, `“Name”`, `prefix “…”`, a chat line; undefined when it has none of those. */
export function ruleActionHint(rule: LootFilterRule): string | undefined {
  if (rule.hide === true) return 'hide';
  const parts: string[] = [];
  if (rule.useStyle !== undefined) parts.push(`→ style ${rule.useStyle}`);
  const name = plainText(rule.replaceName);
  const prefix = plainText(rule.namePrefix);
  const suffix = plainText(rule.nameSuffix);
  if (name !== undefined && name !== '') parts.push(`“${name}”`);
  else if (prefix !== undefined && prefix !== '') parts.push(`prefix “${prefix}”`);
  else if (suffix !== undefined && suffix !== '') parts.push(`suffix “${suffix}”`);
  if (parts.length === 0) {
    const chat = plainText(rule.chatMessage);
    if (chat !== undefined && chat !== '') parts.push(`chat “${chat}”`);
    else if (rule.hideIfOtherConditionsFail === true) parts.push('hide if other conditions fail');
  }
  return parts.length === 0 ? undefined : parts.join(' · ');
}

/** `Zod Rune, Cham Rune +2 · unique · 3 sockets · → style Mythical` */
export function ruleSummary(rule: LootFilterRule, lookup: LootFilterLookup, exceptions = readsExceptions(rule)): string {
  const action = ruleActionHint(rule);
  const conditions = ruleConditionSummary(rule, lookup, exceptions);
  return action === undefined ? conditions : `${conditions} · ${action}`;
}

/**
 * Lowercase text the rule list's search box matches: codes, names, types, ids, stats with their param names (skill, tab,
 * class), comment, style, name changes, chat.
 */
export function ruleSearchText(rule: LootFilterRule, lookup: LootFilterLookup, summary = ruleSummary(rule, lookup)): string {
  const parts: (string | undefined)[] = [
    summary,
    rule.disabled === true ? 'disabled' : undefined,
    rule.comment,
    rule.useStyle,
    plainText(rule.replaceName),
    plainText(rule.namePrefix),
    plainText(rule.nameSuffix),
    plainText(rule.chatMessage),
    plainText(rule.chatMessageWhenHidden),
    ...[...(rule.itemCodes ?? []), ...(rule.excludeItemCodes ?? [])].flatMap((code) => [code, lookup.itemName(code)]),
    ...[...(rule.itemTypes ?? []), ...(rule.excludeItemTypes ?? [])].flatMap((code) => [code, lookup.typeName(code)]),
    ...[...(rule.uniqueOrSetIds ?? []), ...(rule.excludeUniqueOrSetIds ?? [])].flatMap((id) => [String(id), lookup.uniqueOrSetName(id)]),
    ...[...(rule.areas ?? []), ...(rule.excludeAreas ?? [])].map((id) => lookup.areaName(id)),
    ...[...(rule.itemStats ?? []), ...(rule.itemStatsAnyOf ?? []), ...(rule.playerStats ?? []), ...(rule.playerStatsAnyOf ?? [])].flatMap(
      (check) => [
        typeof check.stat === 'number' ? lookup.statName(check.stat) : check.stat,
        check.param === undefined ? undefined : lookup.statParamLabel(check.stat, check.param),
      ]
    ),
  ];
  return parts
    .filter((part) => part !== undefined && part !== '')
    .join(' ')
    .toLowerCase();
}

/** True when the rule's search text holds every whitespace-separated term of the query. */
export function ruleMatchesSearch(searchTextOfRule: string, query: string): boolean {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term !== '');
  return terms.every((term) => searchTextOfRule.includes(term));
}

// ---------------------------------------------------------------------------
// Row badges
// ---------------------------------------------------------------------------

const LOCATION_SHORT: Readonly<Record<ItemLocation, string>> = {
  onGround: 'ground',
  stored: 'stored',
  equipped: 'equipped',
  atVendor: 'vendor',
};

/** `L1,3` for a rule limited to filter levels 1 and 3; undefined when it is active at every level. */
export function levelsBadge(levels: readonly number[] | undefined): string | undefined {
  if (levels === undefined) return undefined;
  return levels.length === 0 ? 'no level' : `L${levels.join(',')}`;
}

/** The locations when they are not just the default (on the ground). */
export function locationBadge(location: readonly ItemLocation[] | undefined): string | undefined {
  if (location === undefined || location.length === 0) return undefined;
  if (location.length === 1 && location[0] === 'onGround') return undefined;
  return location.map((item) => LOCATION_SHORT[item]).join(', ');
}
