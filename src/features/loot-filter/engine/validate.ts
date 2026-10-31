/**
 * Semantic checks on the typed model (shape errors are reported by the parser, not here).
 * Reference checks (item codes, stats, areas, sounds…) run only when a reference is given and the
 * relevant set is non-empty, and they are warnings: the game data may lag behind the mod.
 */
import { decodeTabLayer, MAX_STAT_PARAM, skillTabLayer, statLayerKind, type StatLayerKind } from '../../game-data/engine/statLayers.ts';
import { effectiveActions } from './actions.ts';
import { OMITTED_PARAM } from './evaluate.ts';
import { isNamedList, isNumberList, namedToNumber } from './match.ts';
import { CONDITION_KEYS, EFFECT_KEYS, ruleFilePaths } from './parse.ts';
import { statQuirk, type StatQuirk } from './statQuirks.ts';
import {
  BASE_TIERS,
  DIFFICULTIES,
  QUALITIES,
  STAT_OPS,
  type Diagnostic,
  type DiagnosticSeverity,
  type LabelColor,
  type LootFilter,
  type LootFilterReference,
  type LootFilterRule,
  type NamedMatch,
  type NamedValue,
  type NumberMatch,
  type RuleActions,
  type StatCheck,
} from './types.ts';

/** Sound file extensions the plugin plays from the filter's `sounds` folder. */
export const SOUND_FILE_EXTENSIONS = ['.wav', '.mp3', '.flac'] as const;

/** Actions that only show on a ground item (label, minimap icon, droplight). */
const GROUND_ONLY_ACTIONS = ['labelBackground', 'labelBorder', 'icon', 'droplight'] as const;

interface Owner {
  readonly path: string;
  readonly rule?: number;
  readonly style?: string;
}

type Report = (severity: DiagnosticSeverity, key: string, message: string) => void;

function reporter(diagnostics: Diagnostic[], owner: Owner): Report {
  return (severity, key, message) => {
    diagnostics.push({
      severity,
      message,
      path: [owner.path, key].filter((part) => part !== '').join('/'),
      ...(owner.rule === undefined ? {} : { rule: owner.rule }),
      ...(owner.style === undefined ? {} : { style: owner.style }),
    });
  };
}

// ---------------------------------------------------------------------------
// Value checks
// ---------------------------------------------------------------------------

function checkNumberMatch(report: Report, key: string, match: NumberMatch | undefined, min: number, max: number): void {
  if (match === undefined) return;
  const range = `${String(min)} to ${String(max)}`;
  if (typeof match === 'number') {
    if (match < min || match > max) report('warning', key, `"${key}" ${String(match)} is outside ${range}`);
    return;
  }
  if (isNumberList(match)) {
    match.forEach((value, index) => {
      if (value < min || value > max) report('warning', `${key}/${String(index)}`, `"${key}" ${String(value)} is outside ${range}`);
    });
    return;
  }
  for (const bound of ['min', 'max'] as const) {
    const value = match[bound];
    if (value !== undefined && (value < min || value > max)) {
      report('warning', `${key}/${bound}`, `"${key}" ${bound} ${String(value)} is outside ${range}`);
    }
  }
  if (match.min !== undefined && match.max !== undefined && match.min > match.max) {
    report('warning', key, `"${key}" min ${String(match.min)} is greater than max ${String(match.max)}; nothing matches`);
  }
}

/** Checks a named match; `offset` is the number of the first name (quality 1, the others 0). */
function checkNamedMatch<N extends string>(
  report: Report,
  key: string,
  match: NamedMatch<N> | undefined,
  names: readonly N[],
  offset: number,
  what: string
): void {
  if (match === undefined) return;
  const toNumber = (value: NamedValue<N>, path: string): number | undefined => {
    if (typeof value === 'number') {
      if (Number.isInteger(value) && value >= offset && value < offset + names.length) return value;
      report('error', path, `Unknown ${what} ${String(value)} (${String(offset)} to ${String(offset + names.length - 1)})`);
      return undefined;
    }
    const number = namedToNumber(value, names, offset);
    if (number === undefined) report('error', path, `Unknown ${what} "${value}" (${names.join(', ')})`);
    return number;
  };
  if (typeof match === 'number' || typeof match === 'string') {
    toNumber(match, key);
    return;
  }
  if (isNamedList(match)) {
    match.forEach((value, index) => toNumber(value, `${key}/${String(index)}`));
    return;
  }
  const low = match.min === undefined ? undefined : toNumber(match.min, `${key}/min`);
  const high = match.max === undefined ? undefined : toNumber(match.max, `${key}/max`);
  if (low !== undefined && high !== undefined && low > high) {
    report('warning', key, `"${key}" min is above max; nothing matches`);
  }
}

function checkColor(report: Report, key: string, color: LabelColor | undefined, lengths: readonly number[]): void {
  if (color === undefined) return;
  if (!lengths.includes(color.length)) {
    report('error', key, `"${key}" needs ${lengths.join(' or ')} numbers, not ${String(color.length)}`);
  }
  color.forEach((component, index) => {
    if (!Number.isInteger(component) || component < 0 || component > 255) {
      report('error', `${key}/${String(index)}`, `Colour component ${String(component)} is not a whole number from 0 to 255`);
    }
  });
}

/**
 * Whether the rule's item codes and types can match an item the quirk affects (of one of its `affects` types). Without
 * item data, or with an item code the data lacks, it can.
 */
function mayHitQuirk(rule: LootFilterRule, quirk: StatQuirk, reference: LootFilterReference | undefined): boolean {
  if (!reference || reference.itemCodeTypes.size === 0) return true;
  const { itemCodes, itemTypes, excludeItemCodes, excludeItemTypes } = rule;
  if (itemCodes?.some((code) => !reference.itemCodeTypes.has(code)) === true) return true;
  for (const [code, types] of reference.itemCodeTypes) {
    if (!quirk.affects.some((type) => types.has(type))) continue;
    if (itemCodes !== undefined && itemCodes.length > 0 && !itemCodes.includes(code)) continue;
    if (itemTypes !== undefined && itemTypes.length > 0 && !itemTypes.some((type) => types.has(type))) continue;
    if (excludeItemCodes?.includes(code) === true || excludeItemTypes?.some((type) => types.has(type)) === true) continue;
    return true;
  }
  return false;
}

/** What one entry of a layered stat is per, for the param warnings. */
const LAYER_NOUNS: Readonly<Record<StatLayerKind, string>> = {
  tab: 'skill tab',
  class: 'class',
  skill: 'skill',
  event: 'skill and level',
  charged: 'skill and level',
};

/** The ops a hide rule's exception is written with (see `exceptionOf` in utils/statChecks.ts). */
const EXCEPTION_OPS: readonly string[] = ['<', '<=', '!='];

/**
 * Whether a check reads "the stat is there" (`>= 1`, `> 0`), or a hide rule's exception of it (`< 1`, `<= 0`): with
 * those, a check without param on a stat with several entries still is the opposite of its exception.
 */
function isPresenceCheck(check: StatCheck): boolean {
  if (typeof check.value !== 'number') return false;
  const op = check.op ?? '>=';
  return ((op === '>=' || op === '<') && check.value <= 1) || ((op === '>' || op === '<=') && check.value <= 0);
}

/**
 * Whether an `item_charged_skill` value reads sensibly (it is `max charges << 8 | charges left`): a presence check
 * (or its exception), or `>=` / `<` a multiple of 256 (at least / fewer than N max charges).
 */
function isChargedValueCheck(check: StatCheck): boolean {
  if (typeof check.value !== 'number') return true;
  const op = check.op ?? '>=';
  return isPresenceCheck(check) || ((op === '>=' || op === '<') && check.value % 256 === 0);
}

const omittedParamMessage = (stat: string, noun: string): string =>
  OMITTED_PARAM === 'anyLayer'
    ? `"${stat}" has one entry per ${noun}; without "param" this check is taken to hold when any ${noun} passes (not verified in game: the plugin may read only param 0). Pick a ${noun} to check one`
    : `"${stat}" has one entry per ${noun}; without "param" the plugin reads only the entry with param 0. Pick a ${noun} to check one`;

/** "below 3" / "3 or more" for an exception's op and value (what fails it, what passes it). */
function exceptionWords(check: StatCheck): readonly [fails: string, passes: string] {
  const value = typeof check.value === 'number' ? String(check.value) : '';
  switch (check.op) {
    case '<=':
      return [`at most ${value}`, `more than ${value}`];
    case '!=':
      return [`not ${value}`, value];
    default:
      return [`below ${value}`, `${value} or more`];
  }
}

/** The stat's itemstatcost name (by name, or by id through the reference) and its layer kind. */
function layerOf(check: StatCheck, reference: LootFilterReference | undefined): { name: string; kind: StatLayerKind } | undefined {
  const name = typeof check.stat === 'number' ? reference?.statNamesById.get(check.stat) : check.stat;
  const kind = name === undefined ? undefined : statLayerKind(name);
  return name === undefined || kind === undefined ? undefined : { name, kind };
}

/** properties.txt numbers the 24 skill tabs 0 to 23 (`class × 3 + tab`). */
const MAX_PROPERTIES_TAB = 23;

/**
 * The skill tab params of a list that look like properties.txt tab numbers (`class × 3 + tab`, 0 to 23) where the game
 * stores `class << 3 | tab`: several tab params up to 23, at least one of which names no tab. Their indexes, so the
 * per-check warning leaves them to the one list warning.
 */
function propertiesTabNumbers(checks: readonly StatCheck[], reference: LootFilterReference | undefined): Set<number> {
  const indexes = checks.flatMap((check, index) =>
    layerOf(check, reference)?.kind === 'tab' && check.param !== undefined && check.param <= MAX_PROPERTIES_TAB ? [index] : []
  );
  const undecodable = indexes.some((index) => decodeTabLayer(checks[index].param ?? 0) === undefined);
  return new Set(indexes.length >= 2 && undecodable ? indexes : []);
}

/** The one list warning for `propertiesTabNumbers`. Not confirmed in game: the plugin may read params either way. */
function propertiesTabMessage(params: readonly number[]): string {
  const low = Math.min(...params);
  const high = Math.max(...params);
  const none = params.filter((param) => decodeTabLayer(param) === undefined).length;
  // 0 to 2 (Amazon) are the same tab in both numberings
  const other = params.filter((param) => param >= 3 && decodeTabLayer(param) !== undefined).length;
  const range = low === high ? String(low) : `${String(low)}–${String(high)}`;
  const verb = (count: number) => (count === 1 ? 'matches' : 'match');
  const others = other === 0 ? '' : ` and ${String(other)} ${verb(other)} a different tab than their number suggests`;
  return `These skill tab params (${range}) look like properties.txt tab numbers (class × 3 + tab). The game itself numbers tabs class × 8 + tab (Assassin Martial Arts = 50, Warlock Demon Skills = 56), and the tab names shown for these params follow that; if the plugin reads params that way, ${String(none)} of these checks ${verb(none)} no tab${others}. Not confirmed in game yet`;
}

/**
 * Param checks of one stat check: a param is a whole number from 0 (above 65535 it likely never matches); a layered
 * stat (skill, skill tab, class, event, charged; `STAT_LAYER_KINDS`) needs one, a tab param should decode (unless the
 * list's warning about properties.txt tab numbers covers it, `inTabList`), an event / charged param is
 * `skill << 6 | level`, and a charged value is `max << 8 | charges`.
 * `exception`: the check is a hide rule's exception (`<`, `<=`, `!=` in an item stat list of a rule that hides).
 */
function checkStatParam(
  report: Report,
  path: string,
  check: StatCheck,
  reference: LootFilterReference | undefined,
  exception: boolean,
  inTabList: boolean
): void {
  const { param } = check;
  if (param !== undefined && (!Number.isInteger(param) || param < 0)) {
    report('error', `${path}/param`, `"param" ${String(param)} is not a whole number from 0`);
    return;
  }
  if (param !== undefined && param > MAX_STAT_PARAM) {
    report(
      'warning',
      `${path}/param`,
      `"param" ${String(param)} is above ${String(MAX_STAT_PARAM)}: a stat's layer is assumed to be 16 bits in memory, so this check likely never matches`
    );
    return;
  }
  const layered = layerOf(check, reference);
  if (layered === undefined) return;
  const { name, kind } = layered;
  const noun = LAYER_NOUNS[kind];
  if (param === undefined) {
    const [fails, passes] = exceptionWords(check);
    const note =
      OMITTED_PARAM === 'anyLayer' && exception && !isPresenceCheck(check)
        ? `. An exception without param is not the opposite check when the item has several entries: an item hides as soon as one ${noun} is ${fails}, even if another ${noun} has ${passes}`
        : '';
    report('warning', path, `${omittedParamMessage(name, noun)}${note}`);
  } else if (kind === 'tab' && !inTabList && decodeTabLayer(param) === undefined) {
    const layer = skillTabLayer(param);
    const tabName = layer === undefined ? undefined : reference?.skillTabNames.get(layer);
    const hint =
      layer === undefined
        ? ''
        : `; as a properties.txt tab number (class × 3 + tab) ${String(param)} is ${tabName ?? 'a tab'}, which the game numbers ${String(layer)}. Not confirmed in game yet`;
    report(
      'warning',
      `${path}/param`,
      `"param" ${String(param)} names no skill tab as the game numbers them (class × 8 + tab 0 to 2)${hint}`
    );
  } else if (kind === 'event' || kind === 'charged') {
    if (param < 64) {
      report(
        'warning',
        `${path}/param`,
        `"param" ${String(param)} names skill 0: the param is skill id × 64 + level (skill 472 level 25 = 30233)`
      );
    } else if (param % 64 === 0) {
      report('warning', `${path}/param`, `"param" ${String(param)} names level 0: the param is skill id × 64 + level`);
    }
  }
  if (kind === 'charged' && !isChargedValueCheck(check)) {
    report(
      'warning',
      `${path}/value`,
      'The value of "item_charged_skill" is max charges × 256 + charges left (5/5 charges = 1285): check ≥ 1 for "has the charges" or ≥ a multiple of 256 (≥ 1280 = at least 5 max charges)'
    );
  }
}

function checkStats(
  report: Report,
  key: string,
  checks: readonly StatCheck[] | undefined,
  reference: LootFilterReference | undefined,
  rule?: LootFilterRule,
  exceptions = false
): void {
  const tabNumbers = propertiesTabNumbers(checks ?? [], reference);
  if (tabNumbers.size > 0) {
    report('warning', key, propertiesTabMessage([...tabNumbers].map((index) => checks?.[index]?.param ?? 0)));
  }
  checks?.forEach((check, index) => {
    const path = `${key}/${String(index)}`;
    if (check.op !== undefined && !(STAT_OPS as readonly string[]).includes(check.op)) {
      report('error', `${path}/op`, `Unknown op "${check.op}" (${STAT_OPS.join(' ')})`);
    }
    const isPair = typeof check.value !== 'number';
    if (check.op === 'between' && !isPair) report('error', `${path}/value`, '"between" needs "value": [low, high]');
    if (check.op !== 'between' && isPair)
      report('error', `${path}/value`, `A [low, high] value needs "op": "between", not "${check.op ?? '>='}"`);
    if (isPair && check.value[0] > check.value[1]) report('warning', `${path}/value`, 'The low end is above the high end; nothing matches');
    if (check.stat === '') {
      report('error', `${path}/stat`, 'Pick a stat');
      return;
    }
    // Item stat lists only (`rule` given): the plugin reads these stats as 0 on some items.
    const quirk = rule === undefined ? undefined : statQuirk(check.stat);
    if (quirk !== undefined && rule !== undefined && mayHitQuirk(rule, quirk, reference)) report('warning', `${path}/stat`, quirk.message);
    checkStatParam(
      report,
      path,
      check,
      reference,
      exceptions && check.op !== undefined && EXCEPTION_OPS.includes(check.op),
      tabNumbers.has(index)
    );
    if (!reference) return;
    if (typeof check.stat === 'number') {
      if (reference.statIds.size > 0 && !reference.statIds.has(check.stat)) {
        report('warning', `${path}/stat`, `Unknown stat id ${String(check.stat)}`);
      }
    } else if (reference.statNames.size > 0 && !reference.statNames.has(check.stat)) {
      const hint = /^\d+$/.test(check.stat) ? '; write a stat id as a number, without quotes' : '';
      report('warning', `${path}/stat`, `Unknown stat "${check.stat}"${hint}`);
    }
  });
}

function checkKnown<T extends string | number>(
  report: Report,
  key: string,
  values: readonly T[] | undefined,
  known: ReadonlySet<T> | undefined,
  what: string
): void {
  if (!values || !known || known.size === 0) return;
  values.forEach((value, index) => {
    if (!known.has(value)) report('warning', `${key}/${String(index)}`, `Unknown ${what} ${JSON.stringify(value)}`);
  });
}

function isSoundFile(name: string): boolean {
  const lower = name.toLowerCase();
  return SOUND_FILE_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

function checkSound(report: Report, sound: string | number | undefined, reference: LootFilterReference | undefined): void {
  if (sound === undefined || !reference) return;
  const row = typeof sound === 'number' ? sound : /^\d+$/.test(sound) ? Number(sound) : undefined;
  if (row !== undefined) {
    if (reference.soundRowCount > 0 && (!Number.isInteger(row) || row < 0 || row >= reference.soundRowCount)) {
      report('warning', 'sound', `sounds.txt has no row ${String(row)}`);
    }
    return;
  }
  if (typeof sound !== 'string' || isSoundFile(sound) || reference.soundNames.size === 0) return;
  if (!reference.soundNames.has(sound)) {
    report('warning', 'sound', `"${sound}" is neither a sounds.txt sound nor a .wav, .mp3 or .flac file`);
  }
}

function checkActions(report: Report, actions: RuleActions, reference: LootFilterReference | undefined): void {
  checkColor(report, 'labelBackground', actions.labelBackground, [3, 4]);
  if (actions.labelBorder) {
    checkColor(report, 'labelBorder/color', actions.labelBorder.color, [3, 4]);
    if (actions.labelBorder.width < 0) report('error', 'labelBorder/width', 'The border width cannot be negative');
  }
  if (actions.icon) {
    const { iconSize } = actions.icon;
    if (iconSize !== undefined && (iconSize < 4 || iconSize > 256))
      report('error', 'icon/iconSize', `"iconSize" ${String(iconSize)} is outside 4 to 256`);
    checkColor(report, 'icon/color', actions.icon.color, [3, 4]);
  }
  checkColor(report, 'droplight/color', actions.droplight?.color, [3]);
  if (actions.soundVolume !== undefined && (actions.soundVolume < 0 || actions.soundVolume > 100)) {
    report('error', 'soundVolume', `"soundVolume" ${String(actions.soundVolume)} is outside 0 to 100`);
  }
  checkSound(report, actions.sound, reference);
}

// ---------------------------------------------------------------------------
// Rules and the filter
// ---------------------------------------------------------------------------

// "Never matches" checks: conditions that contradict each other.

const NEVER = 'so the rule never matches';

/** True when `list` is non-empty and every entry is in `excluded`. */
function allExcluded<T>(list: readonly T[] | undefined, excluded: readonly T[] | undefined): boolean {
  return list !== undefined && excluded !== undefined && list.length > 0 && list.every((value) => excluded.includes(value));
}

/** A type's ancestors (itself included); a type the reference lacks counts as itself only. */
function typeAncestors(type: string, reference: LootFilterReference | undefined): ReadonlySet<string> {
  return reference?.typeAncestors.get(type) ?? new Set([type]);
}

/** The type ancestors of the listed codes the reference knows (an empty list when it knows none). */
function knownCodeTypes(codes: readonly string[], reference: LootFilterReference | undefined): ReadonlySet<string>[] {
  if (!reference) return [];
  return codes.flatMap((code) => {
    const types = reference.itemCodeTypes.get(code);
    return types ? [types] : [];
  });
}

function hasAny(types: ReadonlySet<string>, wanted: readonly string[]): boolean {
  return wanted.some((type) => types.has(type));
}

/** Whether a quality match lets `quality` (a number, 1 = inferior) through, like the evaluator. */
function qualityAllows(match: NamedMatch<string>, quality: number): boolean {
  const toNumber = (value: NamedValue<string>) => namedToNumber(value, QUALITIES, 1);
  if (typeof match === 'number' || typeof match === 'string') return toNumber(match) === quality;
  if (isNamedList(match)) return match.some((value) => toNumber(value) === quality);
  const min = match.min === undefined ? undefined : toNumber(match.min);
  const max = match.max === undefined ? undefined : toNumber(match.max);
  return (min === undefined || quality >= min) && (max === undefined || quality <= max);
}

function checkNeverMatches(report: Report, rule: LootFilterRule, reference: LootFilterReference | undefined): void {
  const { itemCodes, itemTypes, excludeItemTypes } = rule;
  if (itemCodes && itemTypes && itemCodes.length > 0 && itemTypes.length > 0) {
    const codeTypes = knownCodeTypes(itemCodes, reference);
    if (codeTypes.length > 0 && !codeTypes.some((types) => hasAny(types, itemTypes))) {
      report('warning', 'itemTypes', `None of the item codes is of the item types, ${NEVER}`);
    }
  }

  if (allExcluded(itemCodes, rule.excludeItemCodes))
    report('warning', 'excludeItemCodes', `Every item code is also an excepted item code, ${NEVER}`);
  if (allExcluded(rule.uniqueOrSetIds, rule.excludeUniqueOrSetIds))
    report('warning', 'excludeUniqueOrSetIds', `Every unique or set id is also an excepted id, ${NEVER}`);
  if (allExcluded(rule.areas, rule.excludeAreas)) report('warning', 'excludeAreas', `Every area is also an excepted area, ${NEVER}`);

  if (excludeItemTypes && excludeItemTypes.length > 0) {
    if (itemTypes && itemTypes.length > 0 && itemTypes.every((type) => hasAny(typeAncestors(type, reference), excludeItemTypes))) {
      report('warning', 'excludeItemTypes', `Every item type falls under an excepted item type, ${NEVER}`);
    }
    const codeTypes = knownCodeTypes(itemCodes ?? [], reference);
    if (codeTypes.length > 0 && codeTypes.every((types) => hasAny(types, excludeItemTypes))) {
      report('warning', 'excludeItemTypes', `Every item code is of an excepted item type, ${NEVER}`);
    }
  }

  // Unique and set qualities (7 and 5): uniqueOrSetIds match only those.
  if (rule.uniqueOrSetIds && rule.uniqueOrSetIds.length > 0 && rule.quality !== undefined) {
    const { quality } = rule;
    if (!qualityAllows(quality, 5) && !qualityAllows(quality, 7)) {
      report('warning', 'uniqueOrSetIds', `Unique or set ids need a unique or set item, but the quality allows neither, ${NEVER}`);
    }
  }
}

/** Conditions that only decide whether `hideIfOtherConditionsFail` looks at an item; every other one failing hides it. */
const HIDE_IF_FAIL_GATE: ReadonlySet<string> = new Set(['itemCodes', 'excludeItemCodes', 'itemTypes', 'excludeItemTypes', 'location']);

function hasPassthrough(rule: LootFilterRule): boolean {
  return rule.passthrough !== undefined && Object.keys(rule.passthrough).length > 0;
}

/**
 * `hideIfOtherConditionsFail` hides every item that passes the gate (codes, types, location) and fails any other
 * condition. Without codes or types the gate lets every ground item in (the plugin warns the same); with `quality` it
 * hides the other qualities of those items. Rules with passthrough keys are left alone, as in the other checks.
 */
function checkHideIfFail(report: Report, rule: LootFilterRule): void {
  if (rule.hideIfOtherConditionsFail !== true || hasPassthrough(rule)) return;
  const others = CONDITION_KEYS.filter((key) => !HIDE_IF_FAIL_GATE.has(key) && rule[key] !== undefined);
  if (rule.itemCodes === undefined && rule.itemTypes === undefined) {
    report(
      'warning',
      'hideIfOtherConditionsFail',
      others.length > 0
        ? `Without "itemCodes" or "itemTypes", "hideIfOtherConditionsFail" hides every ground item that fails ${others.map((key) => `"${key}"`).join(', ')}`
        : '"hideIfOtherConditionsFail" needs "itemCodes" or "itemTypes" to say which items it hides'
    );
  }
  if (rule.quality !== undefined) {
    report(
      'warning',
      'hideIfOtherConditionsFail',
      '"hideIfOtherConditionsFail" with "quality" also hides every other quality of these items (uniques included): any other condition failing hides the item'
    );
  }
}

/** List conditions; an empty one makes the plugin log "the list is empty". */
const LIST_CONDITIONS = [
  'itemCodes',
  'excludeItemCodes',
  'itemTypes',
  'excludeItemTypes',
  'uniqueOrSetIds',
  'excludeUniqueOrSetIds',
  'itemStats',
  'itemStatsAnyOf',
  'playerStats',
  'playerStatsAnyOf',
  'location',
  'areas',
  'excludeAreas',
  'activeInLevels',
] as const satisfies readonly (keyof LootFilterRule)[];

function checkEmptyLists(report: Report, rule: LootFilterRule): void {
  for (const key of LIST_CONDITIONS) {
    if (rule[key]?.length === 0) {
      report(
        'warning',
        key,
        `"${key}" is an empty list: the game logs "the list is empty" and what it does then is not known; remove the key or add values`
      );
    }
  }
}

/**
 * True when a hiding rule has no condition but (at most) a location that includes onGround: it hides every ground
 * item. A rule with passthrough keys is left alone: a wrong-shaped condition sits there, and the plugin switches
 * such a rule off anyway.
 */
function hidesEveryGroundItem(rule: LootFilterRule, filter: LootFilter): boolean {
  if (effectiveActions(rule, filter).hide !== true) return false;
  if (rule.location !== undefined && !rule.location.includes('onGround')) return false;
  if (hasPassthrough(rule)) return false;
  return CONDITION_KEYS.every((key) => key === 'location' || rule[key] === undefined);
}

function checkRule(
  report: Report,
  rule: LootFilterRule,
  filter: LootFilter,
  levelIds: ReadonlySet<number> | undefined,
  reference: LootFilterReference | undefined
): void {
  const hasConditions = CONDITION_KEYS.some((key) => rule[key] !== undefined);
  const hasEffects = EFFECT_KEYS.some((key) => rule[key] !== undefined);
  if (!hasConditions && !hasEffects) report('warning', '', 'The rule has neither conditions nor actions');
  else if (!hasEffects) report('warning', '', 'The rule has conditions but no actions, so it does nothing');

  if (rule.useStyle !== undefined && (filter.styles === undefined || !Object.hasOwn(filter.styles, rule.useStyle))) {
    report('error', 'useStyle', `There is no style named "${rule.useStyle}"`);
  }
  checkHideIfFail(report, rule);
  checkEmptyLists(report, rule);

  checkNamedMatch(report, 'quality', rule.quality, QUALITIES, 1, 'quality');
  checkNamedMatch(report, 'baseTier', rule.baseTier, BASE_TIERS, 0, 'base tier');
  checkNamedMatch(report, 'difficulty', rule.difficulty, DIFFICULTIES, 0, 'difficulty');
  checkNumberMatch(report, 'itemLevel', rule.itemLevel, 0, 999);
  checkNumberMatch(report, 'sockets', rule.sockets, 0, 99);
  checkNumberMatch(report, 'maxSockets', rule.maxSockets, 0, 99);

  rule.activeInLevels?.forEach((id, index) => {
    if (!levelIds)
      report('error', `activeInLevels/${String(index)}`, `Level ${String(id)} does not exist: the filter has no "filterLevels"`);
    else if (!levelIds.has(id)) report('error', `activeInLevels/${String(index)}`, `There is no filter level with id ${String(id)}`);
  });

  // A hide rule's `<`, `<=` and `!=` item stat checks are its exceptions (`readsExceptions` in utils/statChecks.ts).
  const ruleActions = effectiveActions(rule, filter);
  const exceptions = ruleActions.hide === true && ruleActions.hideIfOtherConditionsFail !== true;
  for (const key of ['itemStats', 'itemStatsAnyOf'] as const) checkStats(report, key, rule[key], reference, rule, exceptions);
  for (const key of ['playerStats', 'playerStatsAnyOf'] as const) checkStats(report, key, rule[key], reference);

  if (rule.location !== undefined && !rule.location.includes('onGround')) {
    const actions = effectiveActions(rule, filter);
    for (const key of GROUND_ONLY_ACTIONS) {
      if (actions[key] !== undefined)
        report('warning', key, `"${key}" shows on ground items only, but the rule's "location" leaves out onGround`);
    }
  }

  checkActions(report, rule, reference);
  checkNeverMatches(report, rule, reference);
  checkKnown(report, 'itemCodes', rule.itemCodes, reference?.itemCodes, 'item code');
  checkKnown(report, 'excludeItemCodes', rule.excludeItemCodes, reference?.itemCodes, 'item code');
  checkKnown(report, 'itemTypes', rule.itemTypes, reference?.itemTypes, 'item type');
  checkKnown(report, 'excludeItemTypes', rule.excludeItemTypes, reference?.itemTypes, 'item type');
  checkKnown(report, 'areas', rule.areas, reference?.areaIds, 'area id');
  checkKnown(report, 'excludeAreas', rule.excludeAreas, reference?.areaIds, 'area id');
  checkKnown(report, 'uniqueOrSetIds', rule.uniqueOrSetIds, reference?.uniqueOrSetIds, 'unique or set id');
  checkKnown(report, 'excludeUniqueOrSetIds', rule.excludeUniqueOrSetIds, reference?.uniqueOrSetIds, 'unique or set id');
}

/** Semantic diagnostics for a parsed (or edited) filter. */
export function validateLootFilter(filter: LootFilter, reference?: LootFilterReference): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const top = reporter(diagnostics, { path: '' });

  let levelIds: Set<number> | undefined;
  if (filter.filterLevels) {
    levelIds = new Set();
    for (const [index, level] of filter.filterLevels.entries()) {
      if (levelIds.has(level.id)) top('error', `filterLevels/${String(index)}/id`, `Level id ${String(level.id)} is used twice`);
      levelIds.add(level.id);
    }
  }
  if (filter.defaultLevel !== undefined && !levelIds?.has(filter.defaultLevel)) {
    top('error', 'defaultLevel', `"defaultLevel" ${String(filter.defaultLevel)} is not one of the filter levels`);
  }
  if (filter.soundVolume !== undefined && (filter.soundVolume < 0 || filter.soundVolume > 100)) {
    top('error', 'soundVolume', `"soundVolume" ${String(filter.soundVolume)} is outside 0 to 100`);
  }

  for (const [name, style] of Object.entries(filter.styles ?? {})) {
    const report = reporter(diagnostics, { path: `styles/${name}`, style: name });
    if (style.useStyle !== undefined) report('error', 'useStyle', 'Styles hold actions only; a style cannot use another style');
    checkActions(report, style, reference);
  }

  const disabledCount = filter.rules.filter((rule) => rule.disabled === true).length;
  const paths = ruleFilePaths(filter.rules);
  let enabledAfter = filter.rules.length - disabledCount;
  filter.rules.forEach((rule, index) => {
    const report = reporter(diagnostics, { path: paths[index], rule: index });
    checkRule(report, rule, filter, levelIds, reference);
    if (rule.disabled === true) return;
    enabledAfter -= 1;
    if (enabledAfter > 0 && hidesEveryGroundItem(rule, filter)) {
      const later = enabledAfter === 1 ? 'the rule after it never runs' : `the ${String(enabledAfter)} rules after it never run`;
      report('warning', 'hide', `Hides every ground item; ${later} for ground items`);
    }
  });
  return diagnostics;
}
