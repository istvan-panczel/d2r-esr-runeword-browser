/**
 * The "test item" engine: runs a loot filter's rules against one item the way the ESR loot filter plugin
 * does, as described in the author's "ESR Loot Filter Guide" (builds-feature-docs/loot-filter/ESR-LOOT-FILTER-GUIDE.md).
 *
 * Assumptions where the guide is silent (verify in game):
 * - `activeInLevels` is a precondition: a rule inactive at the current level is skipped and never hides,
 *   not even with `hideIfOtherConditionsFail`.
 * - The `hideIfOtherConditionsFail` gate is `itemCodes`, `excludeItemCodes`, `itemTypes`, `excludeItemTypes`
 *   and `location` (the guide's "codes, types and location"); every other condition is an "other condition".
 * - A hidden item keeps no label colours, border, icon, droplight, chat lines or sounds from earlier rules;
 *   its only chat line is the hiding rule's `chatMessageWhenHidden`. The name is still computed.
 * - The hiding rule's other actions (sound, chatMessage, name, colours) do not apply.
 * - `replaceName`, `namePrefix` and `nameSuffix` are each "later wins" on their own, not as one name.
 * - `notify: true` prints the drop line unless the rule's effective actions (style included) have a chatMessage.
 * - `{name}` in every text, the drop line included, is the game's name, not the filter's changed name.
 * - A stat check without `param` holds when any entry of that stat satisfies it; an entry without param has param 0.
 *   A stat the item or player lacks is one entry of value 0 (verified in game for item stats, 2026-10: a hide rule
 *   with `item_demondamage_percent < 1` hid the magic items without demon damage).
 * - `{stat:ID}` without PARAM shows the first entry of that stat; ID may also be an itemstatcost name.
 * - `{ethereal}` expands to `Ethereal` for ethereal items and to an empty string otherwise.
 * - `hideUnmatchedItems` hides an on-ground item no rule applied to (`hiddenBy` stays null).
 * - An item without a normal/exceptional/elite family (rings, amulets, charms, jewels, arrows, ESR mythical bases;
 *   `baseTier: null`) matches no `baseTier` condition, and `{baseTier}` expands to an empty string for it. The plugin's
 *   tier for such items is unknown (its `debug_log` line prints `tier %d` per item).
 */

import type {
  Droplight,
  FilterText,
  ItemLocation,
  LabelBorder,
  LabelColor,
  Language,
  LootFilter,
  LootFilterRule,
  MinimapIcon,
  NamedMatch,
  NumberMatch,
  QualityName,
  RgbaColor,
  RuleActions,
  StatCheck,
} from './types.ts';
import { BASE_TIERS, DEFAULT_LABEL_BACKGROUND_ALPHA, DIFFICULTIES, QUALITIES } from './types.ts';
import { effectiveActions } from './actions.ts';
import { DEFAULT_QUALITY_COLORS } from './colors.ts';
import { isNamedList, isNumberList, namedToNumber } from './match.ts';
import { resolveText } from './text.ts';

export interface ItemStatEntry {
  readonly stat: number;
  readonly param?: number;
  readonly value: number;
}

export interface TestItem {
  readonly code: string;
  /** The item's type and all of its parent types (itemtypes.txt codes). */
  readonly typeAncestors: readonly string[];
  /** 1 (inferior) to 9 (tempered). */
  readonly quality: number;
  /** 0 (normal) to 2 (elite); null for items without a tier family (rings, charms, jewels, mythical bases…). */
  readonly baseTier: number | null;
  readonly itemLevel: number;
  readonly sockets: number;
  readonly maxSockets: number;
  readonly isFullySocketed: boolean;
  readonly isEthereal: boolean;
  readonly isIdentified: boolean;
  readonly isRuneword: boolean;
  readonly uniqueOrSetId: number | null;
  readonly stats: readonly ItemStatEntry[];
  /** The game's own name. */
  readonly name: string;
  readonly location: ItemLocation;
}

export interface TestContext {
  readonly playerStats: readonly ItemStatEntry[];
  /** 0 (normal) to 2 (hell). */
  readonly difficulty: number;
  /** levels.txt Id */
  readonly area: number;
  readonly filterLevel: number;
  /** itemstatcost.txt name → id, for stat checks written with names. */
  readonly statIds: ReadonlyMap<string, number>;
  readonly language?: Language;
}

export interface RuleTrace {
  readonly index: number;
  /** `disabled`: the rule is switched off in the editor (written to `disabledRules`), so the game never sees it. */
  readonly outcome: 'applied' | 'skipped' | 'disabled' | 'hidden' | 'hiddenByOtherConditions';
  /** Condition keys that did not hold; empty when applied or disabled. */
  readonly failed: readonly string[];
  /** The style's actions with the rule's own on top; empty when skipped. */
  readonly actions: RuleActions;
}

export interface EvaluatedSound {
  readonly sound: string | number;
  readonly volume: number;
}

export interface EvaluationResult {
  readonly trace: readonly RuleTrace[];
  /** Some rule applied (or hid the item). */
  readonly matched: boolean;
  readonly hidden: boolean;
  readonly hiddenBy: number | null;
  /** Final label text with raw ÿc codes, placeholders expanded. */
  readonly name: string;
  readonly replaceName: string | undefined;
  readonly namePrefix: string | undefined;
  readonly nameSuffix: string | undefined;
  readonly labelBackground: RgbaColor | null;
  readonly labelBorder: LabelBorder | null;
  readonly chatMessages: readonly string[];
  readonly notified: boolean;
  readonly sounds: readonly EvaluatedSound[];
  readonly icon: MinimapIcon | null;
  readonly droplight: Droplight | null;
}

const DEFAULT_DROP_FORMAT = '{qualityColor}{name}';
const DEFAULT_LOCATIONS: readonly ItemLocation[] = ['onGround'];

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function qualityName(quality: number): QualityName | undefined {
  return QUALITIES[quality - 1];
}

function matchesNumber(match: NumberMatch, actual: number): boolean {
  if (typeof match === 'number') return match === actual;
  if (isNumberList(match)) return match.includes(actual);
  return (match.min === undefined || actual >= match.min) && (match.max === undefined || actual <= match.max);
}

function matchesNamed(match: NamedMatch<string>, actual: number, names: readonly string[], offset: number): boolean {
  if (typeof match === 'string' || typeof match === 'number') return namedToNumber(match, names, offset) === actual;
  if (isNamedList(match)) return match.some((value) => namedToNumber(value, names, offset) === actual);
  const min = match.min === undefined ? undefined : namedToNumber(match.min, names, offset);
  const max = match.max === undefined ? undefined : namedToNumber(match.max, names, offset);
  if (match.min !== undefined && min === undefined) return false;
  if (match.max !== undefined && max === undefined) return false;
  return (min === undefined || actual >= min) && (max === undefined || actual <= max);
}

/** A stat check's stat: an id, or an itemstatcost name (a numeric string is a name, which the validator flags). */
function resolveStatId(stat: string | number, statIds: ReadonlyMap<string, number>): number | undefined {
  return typeof stat === 'number' ? stat : statIds.get(stat);
}

/** A `{stat:ID}` placeholder's ID: digits are an id, anything else an itemstatcost name. */
function resolvePlaceholderStatId(stat: string, statIds: ReadonlyMap<string, number>): number | undefined {
  return /^\d+$/.test(stat) ? Number(stat) : statIds.get(stat);
}

/** The values a stat check compares: every entry of that stat (and param), or a single 0 when there is none. */
function statValues(entries: readonly ItemStatEntry[], stat: number, param: number | undefined): readonly number[] {
  const values = entries
    .filter((entry) => entry.stat === stat && (param === undefined || (entry.param ?? 0) === param))
    .map((entry) => entry.value);
  return values.length > 0 ? values : [0];
}

function compare(op: StatCheck['op'], actual: number, value: StatCheck['value']): boolean {
  if (op === 'between') {
    if (typeof value === 'number') return false;
    return actual >= value[0] && actual <= value[1];
  }
  if (typeof value !== 'number') return false;
  switch (op) {
    case '==':
      return actual === value;
    case '!=':
      return actual !== value;
    case '>':
      return actual > value;
    case '<':
      return actual < value;
    case '<=':
      return actual <= value;
    case '>=':
    case undefined:
      return actual >= value;
  }
}

function statCheckHolds(check: StatCheck, entries: readonly ItemStatEntry[], statIds: ReadonlyMap<string, number>): boolean {
  const id = resolveStatId(check.stat, statIds);
  if (id === undefined) return false;
  return statValues(entries, id, check.param).some((actual) => compare(check.op, actual, check.value));
}

function withAlpha(color: LabelColor): RgbaColor {
  return color.length === 4 ? color : [color[0], color[1], color[2], DEFAULT_LABEL_BACKGROUND_ALPHA];
}

// ---------------------------------------------------------------------------
// Conditions
// ---------------------------------------------------------------------------

type ConditionKey = keyof LootFilterRule;

/** Keys that decide whether `hideIfOtherConditionsFail` may hide the item. */
const GATE_KEYS: ReadonlySet<string> = new Set(['itemCodes', 'excludeItemCodes', 'itemTypes', 'excludeItemTypes', 'location']);

/** Returns the keys of the rule's conditions that do not hold, in a stable order. */
function failedConditions(rule: LootFilterRule, item: TestItem, context: TestContext): readonly string[] {
  const failed: ConditionKey[] = [];
  /** Records `key` when the rule sets it (`value` is defined) and `holds` says it does not hold. */
  const check = <T>(key: ConditionKey, value: T | undefined, holds: (value: T) => boolean): void => {
    if (value !== undefined && !holds(value)) failed.push(key);
  };
  const { statIds, playerStats } = context;
  const hasType = (types: readonly string[]): boolean => types.some((type) => item.typeAncestors.includes(type));
  const { uniqueOrSetId } = item;

  check('itemCodes', rule.itemCodes, (codes) => codes.includes(item.code));
  check('excludeItemCodes', rule.excludeItemCodes, (codes) => !codes.includes(item.code));
  check('itemTypes', rule.itemTypes, hasType);
  check('excludeItemTypes', rule.excludeItemTypes, (types) => !hasType(types));
  check('quality', rule.quality, (quality) => matchesNamed(quality, item.quality, QUALITIES, 1));
  const { baseTier } = item;
  check('baseTier', rule.baseTier, (tier) => baseTier !== null && matchesNamed(tier, baseTier, BASE_TIERS, 0));
  check('itemLevel', rule.itemLevel, (level) => matchesNumber(level, item.itemLevel));
  check('sockets', rule.sockets, (sockets) => matchesNumber(sockets, item.sockets));
  check('maxSockets', rule.maxSockets, (sockets) => matchesNumber(sockets, item.maxSockets));
  check('isFullySocketed', rule.isFullySocketed, (wanted) => wanted === item.isFullySocketed);
  check('isEthereal', rule.isEthereal, (wanted) => wanted === item.isEthereal);
  check('isIdentified', rule.isIdentified, (wanted) => wanted === item.isIdentified);
  check('isRuneword', rule.isRuneword, (wanted) => wanted === item.isRuneword);
  check('uniqueOrSetIds', rule.uniqueOrSetIds, (ids) => uniqueOrSetId !== null && ids.includes(uniqueOrSetId));
  check('excludeUniqueOrSetIds', rule.excludeUniqueOrSetIds, (ids) => uniqueOrSetId === null || !ids.includes(uniqueOrSetId));
  check('itemStats', rule.itemStats, (checks) => checks.every((stat) => statCheckHolds(stat, item.stats, statIds)));
  check('itemStatsAnyOf', rule.itemStatsAnyOf, (checks) => checks.some((stat) => statCheckHolds(stat, item.stats, statIds)));
  check('playerStats', rule.playerStats, (checks) => checks.every((stat) => statCheckHolds(stat, playerStats, statIds)));
  check('playerStatsAnyOf', rule.playerStatsAnyOf, (checks) => checks.some((stat) => statCheckHolds(stat, playerStats, statIds)));
  check('location', rule.location ?? DEFAULT_LOCATIONS, (locations) => locations.includes(item.location));
  check('difficulty', rule.difficulty, (difficulty) => matchesNamed(difficulty, context.difficulty, DIFFICULTIES, 0));
  check('areas', rule.areas, (areas) => areas.includes(context.area));
  check('excludeAreas', rule.excludeAreas, (areas) => !areas.includes(context.area));
  check('activeInLevels', rule.activeInLevels, (levels) => levels.includes(context.filterLevel));
  return failed;
}

// ---------------------------------------------------------------------------
// Placeholders
// ---------------------------------------------------------------------------

function qualityColor(item: TestItem, filter: LootFilter): string {
  const name = qualityName(item.quality);
  if (name === undefined) return '';
  return filter.qualityColors?.[name] ?? DEFAULT_QUALITY_COLORS[name];
}

function statPlaceholder(args: string, entries: readonly ItemStatEntry[], statIds: ReadonlyMap<string, number>): string | undefined {
  const comma = args.indexOf(',');
  const id = resolvePlaceholderStatId((comma < 0 ? args : args.slice(0, comma)).trim(), statIds);
  if (id === undefined) return undefined;
  const rawParam = comma < 0 ? '' : args.slice(comma + 1).trim();
  const param = rawParam === '' ? undefined : Number(rawParam);
  if (param !== undefined && Number.isNaN(param)) return undefined;
  const entry = entries.find((candidate) => candidate.stat === id && (param === undefined || (candidate.param ?? 0) === param));
  return String(entry?.value ?? 0);
}

/** Expands the guide's placeholders in one text; unknown ones (and `{string:KEY}`) are left as they are. */
export function expandPlaceholders(text: string, item: TestItem, context: TestContext, filter: LootFilter): string {
  return text.replace(/\{([A-Za-z]+)(?::([^{}]*))?\}/g, (whole: string, key: string, args: string | undefined) => {
    if (args !== undefined) {
      if (key === 'stat') return statPlaceholder(args, item.stats, context.statIds) ?? whole;
      if (key === 'playerStat') return statPlaceholder(args, context.playerStats, context.statIds) ?? whole;
      return whole;
    }
    switch (key) {
      case 'name':
      case 'link':
        return item.name;
      case 'code':
        return item.code;
      case 'quality':
        return qualityName(item.quality) ?? String(item.quality);
      case 'baseTier':
        return item.baseTier === null ? '' : (BASE_TIERS[item.baseTier] ?? String(item.baseTier));
      case 'itemLevel':
        return String(item.itemLevel);
      case 'sockets':
        return String(item.sockets);
      case 'maxSockets':
        return String(item.maxSockets);
      case 'ethereal':
        return item.isEthereal ? 'Ethereal' : '';
      case 'uniqueOrSetId':
        return item.uniqueOrSetId === null ? '' : String(item.uniqueOrSetId);
      case 'qualityColor':
        return qualityColor(item, filter);
      default:
        return whole;
    }
  });
}

// ---------------------------------------------------------------------------
// The evaluator
// ---------------------------------------------------------------------------

export function evaluateFilter(filter: LootFilter, item: TestItem, context: TestContext): EvaluationResult {
  const { language } = context;
  const text = (value: FilterText): string => expandPlaceholders(resolveText(value, language) ?? '', item, context, filter);

  const trace: RuleTrace[] = [];
  let matched = false;
  let hiddenBy: number | null = null;
  let hiddenMessage: string | undefined;
  let replaceName: FilterText | undefined;
  let namePrefix: FilterText | undefined;
  let nameSuffix: FilterText | undefined;
  let labelBackground: LabelColor | undefined;
  let labelBorder: LabelBorder | undefined;
  let icon: MinimapIcon | undefined;
  let droplight: Droplight | undefined;
  let notified = false;
  const chatMessages: string[] = [];
  const sounds: EvaluatedSound[] = [];

  for (const [index, rule] of filter.rules.entries()) {
    if (rule.disabled === true) {
      trace.push({ index, outcome: 'disabled', failed: [], actions: {} });
      continue;
    }
    const failed = failedConditions(rule, item, context);
    if (failed.length > 0) {
      const actions = effectiveActions(rule, filter);
      const gateHolds = failed.every((key) => !GATE_KEYS.has(key)) && !failed.includes('activeInLevels');
      if (actions.hideIfOtherConditionsFail === true && gateHolds) {
        trace.push({ index, outcome: 'hiddenByOtherConditions', failed, actions });
        hiddenBy = index;
        if (actions.chatMessageWhenHidden !== undefined) hiddenMessage = text(actions.chatMessageWhenHidden);
        break;
      }
      trace.push({ index, outcome: 'skipped', failed, actions: {} });
      continue;
    }

    const actions = effectiveActions(rule, filter);
    matched = true;
    if (actions.hide === true) {
      trace.push({ index, outcome: 'hidden', failed, actions });
      hiddenBy = index;
      if (actions.chatMessageWhenHidden !== undefined) hiddenMessage = text(actions.chatMessageWhenHidden);
      break;
    }

    trace.push({ index, outcome: 'applied', failed, actions });
    replaceName = actions.replaceName ?? replaceName;
    namePrefix = actions.namePrefix ?? namePrefix;
    nameSuffix = actions.nameSuffix ?? nameSuffix;
    labelBackground = actions.labelBackground ?? labelBackground;
    labelBorder = actions.labelBorder ?? labelBorder;
    icon = actions.icon ?? icon;
    droplight = actions.droplight ?? droplight;
    if (actions.chatMessage !== undefined) {
      chatMessages.push(text(actions.chatMessage));
    } else if (actions.notify === true) {
      chatMessages.push(text(filter.notifications?.dropFormat ?? DEFAULT_DROP_FORMAT));
    }
    if (actions.notify === true) notified = true;
    if (actions.sound !== undefined) {
      sounds.push({ sound: actions.sound, volume: actions.soundVolume ?? filter.soundVolume ?? 100 });
    }
  }

  const resolvedReplace = replaceName === undefined ? undefined : text(replaceName);
  const resolvedPrefix = namePrefix === undefined ? undefined : text(namePrefix);
  const resolvedSuffix = nameSuffix === undefined ? undefined : text(nameSuffix);
  const name = `${resolvedPrefix ?? ''}${resolvedReplace ?? item.name}${resolvedSuffix ?? ''}`;

  const hiddenUnmatched = !matched && hiddenBy === null && filter.hideUnmatchedItems === true && item.location === 'onGround';
  const hidden = hiddenBy !== null || hiddenUnmatched;

  if (hidden) {
    return {
      trace,
      matched: matched || hiddenBy !== null,
      hidden,
      hiddenBy,
      name,
      replaceName: resolvedReplace,
      namePrefix: resolvedPrefix,
      nameSuffix: resolvedSuffix,
      labelBackground: null,
      labelBorder: null,
      chatMessages: hiddenMessage === undefined ? [] : [hiddenMessage],
      notified: false,
      sounds: [],
      icon: null,
      droplight: null,
    };
  }

  return {
    trace,
    matched,
    hidden,
    hiddenBy,
    name,
    replaceName: resolvedReplace,
    namePrefix: resolvedPrefix,
    nameSuffix: resolvedSuffix,
    labelBackground: labelBackground === undefined ? null : withAlpha(labelBackground),
    labelBorder: labelBorder ?? null,
    chatMessages,
    notified,
    sounds,
    icon: icon ?? null,
    droplight: droplight ?? null,
  };
}
