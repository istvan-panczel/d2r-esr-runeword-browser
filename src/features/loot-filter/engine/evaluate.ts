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
 * - A stat the item or player lacks is one entry of value 0 (verified in game for item stats, 2026-10: a hide rule
 *   with `item_demondamage_percent < 1` hid the magic items without demon damage).
 * - `{ethereal}` expands to `Ethereal` for ethereal items and to an empty string otherwise.
 * - `hideUnmatchedItems` hides an on-ground item no rule applied to (`hiddenBy` stays null).
 * - `show` (plugin 1.8.2, the guide): after a rule with `"show": true` applies, later rules cannot hide the item, by
 *   `hide`, `hideIfOtherConditionsFail` or `hideUnmatchedItems`; their colours, names, sounds and chat lines still apply.
 *   Where the guide is silent: a later `hide` rule whose hide is blocked applies like a rule without `hide` and the rules
 *   after it still run; its `chatMessageWhenHidden` does not print (the item is not hidden); a blocked
 *   `hideIfOtherConditionsFail` rule is skipped. A rule whose own and style's actions together both show and hide is an
 *   error ("A rule cannot both show and hide"), so the plugin switches it off (`switchedOff`).
 * - An item without a normal/exceptional/elite family (rings, amulets, charms, jewels, arrows, ESR mythical bases;
 *   `baseTier: null`) matches no `baseTier` condition, and `{baseTier}` expands to an empty string for it. The plugin's
 *   tier for such items is unknown (its `debug_log` line prints `tier %d` per item).
 *
 * - A rule with a wrong-shaped known key (the parser kept it in `passthrough` with an error, e.g. `"sockets": "2"`)
 *   is switched off: the guide says "a rule with an error is switched off and logged", and the plugin's message for
 *   such a value is an error. Unknown keys do not switch a rule off (the plugin logs "unknown setting, ignored").
 * - `"activeInLevels": 4` (a single number) is not wrong-shaped: the parser reads it as `[4]` with a warning, because the
 *   rule works in game (Sully, 2026-11). Whether the plugin reads it as `[4]` or ignores the key (active at every level)
 *   is not checked; the test reads it as `[4]`.
 *
 * Verified in game (2026-11-01, plugin 1.5.3): a stat check or `{stat:ID}` without `param` reads only the entry with
 * param 0, not any entry (`OMITTED_PARAM` = 'layerZero'): `{stat:188}` showed 0 on an item whose only skill tab entry
 * is Fire Skills (Sorceress, param 8), while `{stat:188,8}` showed 4. An entry without param has param 0. ID may also
 * be an itemstatcost name.
 *
 * `formula` (plugin 1.8.2, the guide): ANDed with the other conditions (an "other condition" for
 * `hideIfOtherConditionsFail`, assumed); a syntax error switches the rule off (`switchedOff`: it never runs, nor hides).
 * Every other guess is in `FORMULA_ASSUMPTIONS` (engine/formula.ts).
 *
 * Stat values (the guide, plugin 1.8.2): every stat reads the number the tooltip prints (+40 Life reads 40, per-level
 * stats at the character's level, item_howl / item_fear the percent, charges the skill level). The test compares the
 * values as entered, so the Test tab asks for the tooltip numbers (`STAT_SCALES` in statScale.ts lists the scaled stats).
 *
 * Unidentified items (the guide, "Stat values"): "a rule that checks any item stat skips an unidentified item: none of
 * its actions run and it cannot hide it"; gold, armorclass, quantity, durability, maxdurability and item_numsockets
 * still work (`STATS_WHILE_UNIDENTIFIED`). Such a rule is `skipped` with `unidentified: true`.
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
import { statLayerKind } from '../../game-data/engine/statLayers.ts';
import { effectiveActions } from './actions.ts';
import { ACTION_KEYS, CONDITION_KEYS } from './parse.ts';
import { evaluateFormula, formulaReferences, formulaSkillKey, parseFormula, type FormulaContext, type FormulaNode } from './formula.ts';
import { DEFAULT_QUALITY_COLORS } from './colors.ts';
import { isBrokenItem, itemNameColor } from './nameColor.ts';
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
  /** The colour code the base item's name starts in (lootfilter.json `items[].nameColor`), for `nameColor`. */
  readonly baseNameColor?: string;
  /** The colour code the unique's or set item's name starts in (lootfilter.json `uniques[].nameColor`). */
  readonly uniqueNameColor?: string;
  /** A quest item (misc.txt / weapons.txt `quest`): the game names it in the quest colour. */
  readonly isQuest?: boolean;
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
  /** skills.txt `skill` → id keyed by `formulaSkillKey`, for formula skill names; absent = no skill name resolves. */
  readonly skillIds?: ReadonlyMap<string, number>;
  readonly language?: Language;
}

/** What the rule's formula gave: its value, or why it was not evaluated. */
export type FormulaOutcome =
  | { readonly status: 'value'; readonly value: number }
  /** The item is unidentified and the formula reads an item stat: the plugin skips the whole rule. */
  | { readonly status: 'unidentified' }
  /** A syntax error, or a stat or skill name the loaded game data lacks: the plugin switches the rule off when the filter loads. */
  | { readonly status: 'error'; readonly message: string; readonly offset: number };

export interface RuleTrace {
  readonly index: number;
  /**
   * `disabled`: the rule is switched off in the editor (written to `disabledRules`), so the game never sees it.
   * `wrongShape`: a known key of the rule has the wrong shape (`wrongShapedKeys`), so the plugin most likely switches
   * the rule off (not verified).
   * `switchedOff`: the rule has an error the plugin reports when the filter loads (`reason`), so it never runs.
   */
  readonly outcome: 'applied' | 'skipped' | 'disabled' | 'wrongShape' | 'switchedOff' | 'hidden' | 'hiddenByOtherConditions';
  /** `switchedOff` only: why. */
  readonly reason?: string;
  /** The rule would have hidden the item, but the `show` rule at this index protects it. */
  readonly hideBlockedBy?: number;
  /** `skipped` only: the item is unidentified and the rule checks an item stat, so the plugin skips the rule. */
  readonly unidentified?: true;
  /**
   * Condition keys that did not hold; empty when applied or disabled. For `wrongShape`, the ones of the rest of the
   * rule (so the trace can tell whether the rule would have matched).
   */
  readonly failed: readonly string[];
  /** The style's actions with the rule's own on top; empty when skipped. */
  readonly actions: RuleActions;
  /** `wrongShape` only: the wrong-shaped keys. */
  readonly wrongShaped?: readonly string[];
  /** The rule's formula, when it has one. */
  readonly formula?: FormulaOutcome;
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
  /** The first applied rule with `show: true`: no later rule can hide the item. */
  readonly shownBy: number | null;
  /** Final label text with raw ÿc codes, placeholders expanded. */
  readonly name: string;
  /**
   * The colour code the game names the item in (`itemNameColor`, with the filter's `qualityColors`): label text
   * without a colour code is drawn in it.
   */
  readonly nameColor: string;
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
/** The `switchedOff` reason of a rule that both shows and hides (the plugin: "a rule cannot both show and hide an item"). */
export const SHOW_AND_HIDE =
  'it both shows and hides the item (its own actions and its style together), which the plugin reports as an error';
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

/**
 * How the plugin reads a stat check without `param`: every entry of the stat (`anyLayer`: any skill, skill tab or class
 * of a layered stat) or only the entry with param 0 (`layerZero`).
 */
export type OmittedParamMode = 'anyLayer' | 'layerZero';

/** Verified in game (2026-11-01): a check without param reads only the param-0 entry (see the header). */
export const OMITTED_PARAM: OmittedParamMode = 'layerZero';

/** `OMITTED_PARAM` in plain words, for the Test tab's verified notes. */
export const OMITTED_PARAM_RULE =
  'A stat check (or {stat:ID}) without param reads only the entry with param 0: for a skill, skill tab or class stat that is one skill, tab or class, not any of them; an entry without param has param 0.';

/** The param a check compares: its own; without one every entry (`anyLayer`, undefined) or the param-0 entry (`layerZero`). */
export function checkedLayer(param: number | undefined, mode: OmittedParamMode = OMITTED_PARAM): number | undefined {
  if (param !== undefined) return param;
  return mode === 'layerZero' ? 0 : undefined;
}

/** The values a stat check compares: every entry of that stat (and param), or a single 0 when there is none. */
function statValues(entries: readonly ItemStatEntry[], stat: number, checkParam: number | undefined): readonly number[] {
  const param = checkedLayer(checkParam);
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

/** The formula context of one item; layered stats are known by their itemstatcost name. */
function formulaContext(item: TestItem, context: TestContext): FormulaContext {
  const names = new Map([...context.statIds].map(([name, id]) => [id, name]));
  return {
    itemStats: item.stats,
    playerStats: context.playerStats,
    statIds: context.statIds,
    skillIds: context.skillIds ?? new Map(),
    paramKind: (stat) => {
      const kind = statLayerKind(names.get(stat) ?? '');
      if (kind === 'skill') return 'skill';
      return kind === 'event' || kind === 'charged' ? 'skillLevel' : 'other';
    },
  };
}

/**
 * The item stats an unidentified item still has (the guide: "every item carries them"), by name with their
 * itemstatcost.txt rows (the same in ESR 3.2 and 3.3), so a check by name or id is known before the game data loads; a
 * rule that checks any other item stat skips an unidentified item.
 */
const STAT_ROWS_WHILE_UNIDENTIFIED: Readonly<Record<string, number>> = {
  gold: 14,
  armorclass: 31,
  quantity: 70,
  durability: 72,
  maxdurability: 73,
  item_numsockets: 194,
};
export const STATS_WHILE_UNIDENTIFIED: readonly string[] = Object.keys(STAT_ROWS_WHILE_UNIDENTIFIED);

/** Whether a checked stat (a name or an id) is one an unidentified item does not carry. */
function needsIdentified(stat: string | number, statIds: ReadonlyMap<string, number>): boolean {
  if (typeof stat === 'string') return !STATS_WHILE_UNIDENTIFIED.includes(stat);
  return !STATS_WHILE_UNIDENTIFIED.some((name) => (statIds.get(name) ?? STAT_ROWS_WHILE_UNIDENTIFIED[name]) === stat);
}

/** Whether a formula reads an item stat an unidentified item lacks (`stat`, `statMax`, `statSum`; not `playerStat`). */
function formulaReadsItemStat(ast: FormulaNode, statIds: ReadonlyMap<string, number>): boolean {
  return formulaReferences(ast).some(
    (call) => call.fn !== 'playerStat' && needsIdentified(call.stat.kind === 'name' ? call.stat.name : call.stat.id, statIds)
  );
}

/** Whether the rule's item stat lists check a stat an unidentified item lacks (its player stat lists do not count). */
function statListsReadItemStat(rule: LootFilterRule, statIds: ReadonlyMap<string, number>): boolean {
  return [...(rule.itemStats ?? []), ...(rule.itemStatsAnyOf ?? [])].some((check) => needsIdentified(check.stat, statIds));
}

/** Whether the game skips the rule on an unidentified item: its stat lists or its formula read an item stat that item lacks. */
export function ruleNeedsIdentifiedItem(rule: LootFilterRule, statIds: ReadonlyMap<string, number> = new Map()): boolean {
  if (statListsReadItemStat(rule, statIds)) return true;
  if (rule.formula === undefined) return false;
  const parsed = parseFormula(rule.formula);
  return parsed.ok && formulaReadsItemStat(parsed.ast, statIds);
}

/**
 * A stat or skill name the loaded game data does not know: the guide says "a bad name … switches the rule off", as the
 * validator warns. Nothing is checked while the data is not loaded (an empty map).
 */
function unknownFormulaName(ast: FormulaNode, context: TestContext): { readonly message: string; readonly offset: number } | undefined {
  for (const call of formulaReferences(ast)) {
    if (call.stat.kind === 'name' && context.statIds.size > 0 && !context.statIds.has(call.stat.name)) {
      return { message: `Unknown stat '${call.stat.name}'`, offset: call.stat.start };
    }
    const { param } = call;
    const skillIds = context.skillIds;
    if (param?.kind === 'skill' && skillIds !== undefined && skillIds.size > 0 && !skillIds.has(formulaSkillKey(param.name))) {
      return { message: `Unknown skill '${param.name}'`, offset: param.start };
    }
  }
  return undefined;
}

/** The rule's formula outcome (undefined without a formula); `formulaContext` is built on first use. */
function formulaOutcome(
  formula: string | undefined,
  item: TestItem,
  formulaContextOf: () => FormulaContext,
  context: TestContext
): FormulaOutcome | undefined {
  if (formula === undefined) return undefined;
  const parsed = parseFormula(formula);
  if (!parsed.ok) return { status: 'error', ...parsed.error };
  const unknown = unknownFormulaName(parsed.ast, context);
  if (unknown !== undefined) return { status: 'error', ...unknown };
  if (!item.isIdentified && formulaReadsItemStat(parsed.ast, context.statIds)) return { status: 'unidentified' };
  return { status: 'value', value: evaluateFormula(parsed.ast, formulaContextOf()) };
}

function formulaHolds(outcome: FormulaOutcome | undefined): boolean {
  return outcome === undefined || outcome.status !== 'value' || outcome.value !== 0;
}

/** Returns the keys of the rule's conditions that do not hold, in a stable order. */
function failedConditions(rule: LootFilterRule, item: TestItem, context: TestContext, formula?: FormulaOutcome): readonly string[] {
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
  check('formula', rule.formula, () => formulaHolds(formula));
  check('location', rule.location ?? DEFAULT_LOCATIONS, (locations) => locations.includes(item.location));
  check('difficulty', rule.difficulty, (difficulty) => matchesNamed(difficulty, context.difficulty, DIFFICULTIES, 0));
  check('areas', rule.areas, (areas) => areas.includes(context.area));
  check('excludeAreas', rule.excludeAreas, (areas) => !areas.includes(context.area));
  check('activeInLevels', rule.activeInLevels, (levels) => levels.includes(context.filterLevel));
  return failed;
}

/** Every known key but `comment`: the guide says the plugin ignores it ("notes for the author"), whatever its shape. */
const KNOWN_RULE_KEYS: ReadonlySet<string> = new Set<string>([...CONDITION_KEYS, ...ACTION_KEYS].filter((key) => key !== 'comment'));

/**
 * The rule's known keys (conditions and actions) whose file value had the wrong shape: the parser keeps them in
 * `passthrough` with an error. Unknown keys sit there too but are not returned (the plugin ignores them), nor is a
 * wrong-shaped `comment` (ignored too).
 */
export function wrongShapedKeys(rule: LootFilterRule): readonly string[] {
  return Object.keys(rule.passthrough ?? {}).filter((key) => KNOWN_RULE_KEYS.has(key));
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
  const layer = checkedLayer(param);
  const entry = entries.find((candidate) => candidate.stat === id && (layer === undefined || (candidate.param ?? 0) === layer));
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
  let shownBy: number | null = null;
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
  let builtFormulaContext: FormulaContext | undefined;
  const sharedFormulaContext = (): FormulaContext => (builtFormulaContext ??= formulaContext(item, context));

  for (const [index, rule] of filter.rules.entries()) {
    if (rule.disabled === true) {
      trace.push({ index, outcome: 'disabled', failed: [], actions: {} });
      continue;
    }
    const formula = formulaOutcome(rule.formula, item, sharedFormulaContext, context);
    /** The trace entry's formula outcome, when the rule has one. */
    const formulaTrace = formula === undefined ? {} : { formula };
    if (formula?.status === 'error') {
      // The plugin switches a rule with a formula error (syntax or an unknown name) off when the filter loads.
      trace.push({ index, outcome: 'switchedOff', failed: [], actions: {}, reason: 'its formula has an error', ...formulaTrace });
      continue;
    }
    const failed = failedConditions(rule, item, context, formula);
    const wrongShaped = wrongShapedKeys(rule);
    if (wrongShaped.length > 0) {
      trace.push({ index, outcome: 'wrongShape', failed, actions: {}, wrongShaped, ...formulaTrace });
      continue;
    }
    const actions = effectiveActions(rule, filter);
    if (actions.show === true && actions.hide === true) {
      trace.push({ index, outcome: 'switchedOff', failed, actions: {}, reason: SHOW_AND_HIDE, ...formulaTrace });
      continue;
    }
    // A rule switched off when the filter loads is that whatever the item; the unidentified skip is per item.
    if (formula?.status === 'unidentified' || (!item.isIdentified && statListsReadItemStat(rule, context.statIds))) {
      trace.push({ index, outcome: 'skipped', failed: [], actions: {}, unidentified: true, ...formulaTrace });
      continue;
    }
    if (failed.length > 0) {
      const gateHolds = failed.every((key) => !GATE_KEYS.has(key)) && !failed.includes('activeInLevels');
      if (actions.hideIfOtherConditionsFail === true && gateHolds && shownBy !== null) {
        trace.push({ index, outcome: 'skipped', failed, actions: {}, hideBlockedBy: shownBy });
        continue;
      }
      if (actions.hideIfOtherConditionsFail === true && gateHolds) {
        trace.push({ index, outcome: 'hiddenByOtherConditions', failed, actions, ...formulaTrace });
        hiddenBy = index;
        if (actions.chatMessageWhenHidden !== undefined) hiddenMessage = text(actions.chatMessageWhenHidden);
        break;
      }
      trace.push({ index, outcome: 'skipped', failed, actions: {}, ...formulaTrace });
      continue;
    }

    matched = true;
    if (actions.hide === true && shownBy === null) {
      trace.push({ index, outcome: 'hidden', failed, actions, ...formulaTrace });
      hiddenBy = index;
      if (actions.chatMessageWhenHidden !== undefined) hiddenMessage = text(actions.chatMessageWhenHidden);
      break;
    }

    trace.push({
      index,
      outcome: 'applied',
      failed,
      actions,
      ...formulaTrace,
      ...(actions.hide === true && shownBy !== null ? { hideBlockedBy: shownBy } : {}),
    });
    if (actions.show === true) shownBy ??= index;
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
  const nameColor = itemNameColor({ ...item, isBroken: isBrokenItem(item.stats) }, filter.qualityColors);

  const hiddenUnmatched =
    !matched && hiddenBy === null && shownBy === null && filter.hideUnmatchedItems === true && item.location === 'onGround';
  const hidden = hiddenBy !== null || hiddenUnmatched;

  if (hidden) {
    return {
      trace,
      matched: matched || hiddenBy !== null,
      hidden,
      hiddenBy,
      shownBy,
      name,
      nameColor,
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
    shownBy,
    name,
    nameColor,
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
