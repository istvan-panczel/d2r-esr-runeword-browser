/**
 * Semantic checks on the typed model (shape errors are reported by the parser, not here).
 * Reference checks (item codes, stats, areas, sounds…) run only when a reference is given and the
 * relevant set is non-empty, and they are warnings: the game data may lag behind the mod.
 */
import { decodeTabLayer, MAX_STAT_PARAM, skillTabLayer, statLayerKind, type StatLayerKind } from '../../game-data/engine/statLayers.ts';
import { effectiveActions } from './actions.ts';
import { COLOR_CODES } from './colors.ts';
import { ruleNeedsIdentifiedItem } from './evaluate.ts';
import { FORMULA_QUOTE, formulaReferences, formulaSkillKey, parseFormula, type FormulaCall, type FormulaStatArg } from './formula.ts';
import { isNamedList, isNumberList, namedToNumber } from './match.ts';
import { CONDITION_KEYS, EFFECT_KEYS, ruleFilePaths } from './parse.ts';
import { isUntouchedLevelNumber } from './serialize.ts';
import { statQuirk, type StatQuirk } from './statQuirks.ts';
import { statScale, statScaleMessage } from './statScale.ts';
import { placeholderProblems, type PlaceholderContext } from './text.ts';
import {
  BASE_TIERS,
  DIFFICULTIES,
  QUALITIES,
  STAT_OPS,
  type Diagnostic,
  type DiagnosticSeverity,
  type FilterText,
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
export function mayHitQuirk(rule: LootFilterRule, quirk: StatQuirk, reference: LootFilterReference | undefined): boolean {
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

/**
 * Whether a check reads "the stat is there" (`>= 1`, `> 0`, `!= 0`), or a hide rule's exception of it (`< 1`, `<= 0`,
 * `== 0`).
 */
function isPresenceCheck(check: StatCheck): boolean {
  if (typeof check.value !== 'number') return false;
  const op = check.op ?? '>=';
  return (
    ((op === '>=' || op === '<') && check.value <= 1) ||
    ((op === '>' || op === '<=') && check.value <= 0) ||
    ((op === '==' || op === '!=') && check.value === 0)
  );
}

/** The highest skill level a charge can have (its param keeps the level in 6 bits). */
const MAX_CHARGE_LEVEL = 63;

/**
 * Whether an `item_charged_skill` check can hold: plugin 1.8.2 reads charges as the skill level (the guide, "Stat
 * values"), so `>=`, `>` or `==` a number above 63 never holds (plugin 1.5.3 read `max charges << 8 | charges left`).
 */
function isChargedValueCheck(check: StatCheck): boolean {
  if (typeof check.value !== 'number') return check.value[0] <= MAX_CHARGE_LEVEL;
  const op = check.op ?? '>=';
  return !((op === '>=' || op === '>' || op === '==') && check.value > MAX_CHARGE_LEVEL);
}

/** Verified in game (2026-11-01): without param the plugin reads only the param-0 entry (`OMITTED_PARAM` in evaluate.ts). */
const omittedParamMessage = (stat: string, noun: string): string =>
  `"${stat}" has one entry per ${noun}; without "param" the plugin reads only the entry with param 0 (verified in game), not any ${noun}. Pick a ${noun} to check one`;

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

/** The one list warning for `propertiesTabNumbers`. Verified in game (2026-11-01): the plugin reads class × 8 + tab. */
function propertiesTabMessage(params: readonly number[]): string {
  const low = Math.min(...params);
  const high = Math.max(...params);
  const none = params.filter((param) => decodeTabLayer(param) === undefined).length;
  // 0 to 2 (Amazon) are the same tab in both numberings
  const other = params.filter((param) => param >= 3 && decodeTabLayer(param) !== undefined).length;
  const range = low === high ? String(low) : `${String(low)}–${String(high)}`;
  const verb = (count: number) => (count === 1 ? 'matches' : 'match');
  const others = other === 0 ? '' : ` and ${String(other)} ${verb(other)} a different tab than their number suggests`;
  return `These skill tab params (${range}) look like properties.txt tab numbers (class × 3 + tab). The game itself numbers tabs class × 8 + tab (Assassin Martial Arts = 50, Warlock Demon Skills = 56), and so does the plugin (verified in game): ${String(none)} of these checks ${verb(none)} no tab${others}`;
}

/**
 * Param checks of one stat check: a param is a whole number from 0 (above 65535 it likely never matches); a layered
 * stat (skill, skill tab, class, event, charged; `STAT_LAYER_KINDS`) needs one, a tab param should decode (unless the
 * list's warning about properties.txt tab numbers covers it, `inTabList`), an event / charged param is
 * `skill << 6 | level`, and a charged value is `max << 8 | charges`.
 */
function checkStatParam(
  report: Report,
  path: string,
  check: StatCheck,
  reference: LootFilterReference | undefined,
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
    report('warning', path, omittedParamMessage(name, noun));
  } else if (kind === 'tab' && !inTabList && decodeTabLayer(param) === undefined) {
    const layer = skillTabLayer(param);
    const tabName = layer === undefined ? undefined : reference?.skillTabNames.get(layer);
    const hint =
      layer === undefined
        ? ''
        : `; as a properties.txt tab number (class × 3 + tab) ${String(param)} is ${tabName ?? 'a tab'}, which is param ${String(layer)}`;
    report(
      'warning',
      `${path}/param`,
      `"param" ${String(param)} names no skill tab: the plugin numbers tabs class × 8 + tab 0 to 2, as the game does (verified in game)${hint}`
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
      `Plugin 1.8.2 reads "item_charged_skill" as the skill level of the charges (the guide), at most ${String(MAX_CHARGE_LEVEL)}, so this check never holds: check ≥ 1 for "has the charges" or ≥ a level`
    );
  }
}

function checkStats(
  report: Report,
  key: string,
  checks: readonly StatCheck[] | undefined,
  reference: LootFilterReference | undefined,
  rule?: LootFilterRule
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
    // Every list: plugin 1.8.2 reads the tooltip number (the guide); a per-level stat reads it at the character's level,
    // so a check whose number matters depends on the level (a presence check is left alone, as before).
    const scale = statScale(check.stat);
    const scaleMessage = scale === undefined || isPresenceCheck(check) ? undefined : statScaleMessage(scale);
    if (scaleMessage !== undefined) report('warning', `${path}/value`, scaleMessage);
    checkStatParam(report, path, check, reference, tabNumbers.has(index));
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

// ---------------------------------------------------------------------------
// Formula (plugin 1.8.2; assumptions in engine/formula.ts)
// ---------------------------------------------------------------------------

/** "character 12" (1-based) of the formula. */
const at = (offset: number): string => `character ${String(offset + 1)}`;

/** The itemstatcost name of a formula's stat (by name, or by id through the reference). */
function formulaStatName(stat: FormulaStatArg, reference: LootFilterReference | undefined): string | undefined {
  return stat.kind === 'name' ? stat.name : reference?.statNamesById.get(stat.id);
}

/** Unknown stat names and ids (a case-only difference named), when the reference knows the stats. */
function checkFormulaStat(warn: (message: string) => void, call: FormulaCall, reference: LootFilterReference | undefined): void {
  const { stat } = call;
  if (!reference) return;
  if (stat.kind === 'id') {
    if (reference.statIds.size > 0 && !reference.statIds.has(stat.id)) warn(`Unknown stat id ${String(stat.id)} at ${at(stat.start)}`);
    return;
  }
  if (reference.statNames.size === 0 || reference.statNames.has(stat.name)) return;
  const lower = stat.name.toLowerCase();
  const other = [...reference.statNames].find((name) => name.toLowerCase() === lower);
  const hint = other === undefined ? '' : `; stat names are taken to be case-sensitive: "${other}"`;
  warn(`Unknown stat "${stat.name}" at ${at(stat.start)}${hint}. A name the mod's itemstatcost.txt lacks switches the rule off in game`);
}

/** The param of one call: its range, the layered stats' encodings, and skill names. */
function checkFormulaParam(warn: (message: string) => void, call: FormulaCall, reference: LootFilterReference | undefined): void {
  const name = formulaStatName(call.stat, reference);
  const kind = name === undefined ? undefined : statLayerKind(name);
  const { param } = call;
  if (param === undefined) {
    if (kind !== undefined && name !== undefined && (call.fn === 'stat' || call.fn === 'playerStat')) {
      const noun = LAYER_NOUNS[kind];
      warn(
        `${call.fn}('${name}') at ${at(call.nameStart)} is taken to read only the entry with param 0, but "${name}" has one entry per ${noun}: use statMax or statSum for any ${noun}, or add a param`
      );
    }
    return;
  }
  const where = `at ${at(param.start)}`;
  if (param.kind === 'number') {
    const { value } = param;
    if (param.quoted) warn(`The param ${String(value)} ${where} is in quotes; write a number param without them`);
    if (value > MAX_STAT_PARAM) {
      warn(
        `The param ${String(value)} ${where} is above ${String(MAX_STAT_PARAM)}: a stat's layer is assumed to be 16 bits in memory, so it likely reads 0`
      );
    } else if (kind === 'tab' && decodeTabLayer(value) === undefined) {
      warn(`The param ${String(value)} ${where} names no skill tab as the game numbers them (class × 8 + tab 0 to 2)`);
    } else if ((kind === 'event' || kind === 'charged') && (value < 64 || value % 64 === 0)) {
      warn(
        `The param ${String(value)} ${where} names ${value < 64 ? 'skill 0' : 'level 0'}: the param of "${name ?? ''}" is skill id × 64 + level; a skill name in quotes matches any level`
      );
    }
    return;
  }
  if (reference && reference.skillIds.size > 0 && !reference.skillIds.has(formulaSkillKey(param.name))) {
    const internal = reference.skillDisplayNames.get(formulaSkillKey(param.name));
    const hint =
      internal === undefined
        ? ' (formulas take the skills.txt skill column)'
        : `: that is the in-game name; formulas take the skills.txt name, ${internal.map((entry) => `'${entry}'`).join(' or ')}`;
    warn(`Unknown skill '${param.name}' ${where}${hint}. A skill the mod's skills.txt lacks switches the rule off in game`);
    return;
  }
  // A name the game data does not know gets its own warning; without the data only the layered stats are known.
  if (name === undefined || (kind === undefined && reference?.statNames.has(name) !== true)) return;
  // Chance-to-cast and charge stats: a skill name matches the skill at any level (the guide).
  if (kind !== 'skill' && kind !== 'event' && kind !== 'charged') {
    warn(`"${name}" has no skill param: the skill name '${param.name}' ${where} is taken to be read as the skill's id`);
  }
}

/**
 * The `formula` condition: a syntax error is an error (the plugin checks formulas when the filter loads and switches a
 * rule with a bad one off), every reference problem a warning, as for the stat lists (the game data may lag).
 */
function checkFormula(report: Report, rule: LootFilterRule, reference: LootFilterReference | undefined): void {
  const { formula } = rule;
  if (formula === undefined) return;
  const parsed = parseFormula(formula);
  if (!parsed.ok) {
    report(
      'error',
      'formula',
      `Formula: ${parsed.error.message} (${at(parsed.error.offset)}). The game switches a rule with a bad formula off when the filter loads`
    );
    return;
  }
  const warnings = new Set<string>();
  const warn = (message: string) => warnings.add(message);
  const calls = formulaReferences(parsed.ast);
  const doubleQuoted = calls.some((call) => call.stat.doubleQuoted || (call.param !== undefined && call.param.doubleQuoted));
  if (doubleQuoted) {
    warn(
      `Write names in single quotes (${FORMULA_QUOTE}): the plugin's log says "names go in single quotes", so double quotes most likely switch the rule off`
    );
  }
  for (const call of calls) {
    for (const arg of [call.stat, call.param]) {
      const name = arg?.kind === 'name' || arg?.kind === 'skill' ? arg.name : undefined;
      if (arg !== undefined && name !== undefined && name !== name.trim()) {
        warn(`The name '${name}' at ${at(arg.start)} has spaces around it; names are taken as written, so it likely matches nothing`);
      }
    }
    checkFormulaStat(warn, call, reference);
    if (call.stat.kind === 'id' && call.stat.quoted)
      warn(`The stat id ${String(call.stat.id)} at ${at(call.stat.start)} is in quotes; a row number needs none`);
    checkFormulaParam(warn, call, reference);
    // Item stats only: the plugin reads these as 0 on some items (verified for the stat lists with plugin 1.5.3).
    const quirk = call.fn === 'playerStat' ? undefined : statQuirk(call.stat.kind === 'id' ? call.stat.id : call.stat.name);
    if (quirk !== undefined && mayHitQuirk(rule, quirk, reference)) warn(quirk.message);
  }
  for (const message of warnings) report('warning', 'formula', message);
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

const SHOW_AND_HIDE_MESSAGE = 'A rule cannot both show and hide an item: the game switches the rule off';

/**
 * `show` and `hide` together (plugin 1.8.2: "a rule cannot both show and hide an item"). On a rule they are its own
 * actions with its style's under them; the error points at the rule's own `show`, else its `hide`, else `useStyle`.
 */
function checkShowAndHide(report: Report, own: RuleActions, effective: RuleActions = own): void {
  if (effective.show !== true || effective.hide !== true) return;
  const key = own.show === true ? 'show' : own.hide === true ? 'hide' : 'useStyle';
  report('error', key, own.show === true && own.hide === true ? SHOW_AND_HIDE_MESSAGE : `${SHOW_AND_HIDE_MESSAGE} (with its style)`);
}

const COLOR_CODE_CHARS: ReadonlySet<string> = new Set(COLOR_CODES.map((entry) => entry.code));

/** The `ÿc` codes of a text the game does not know, as written (`ÿc` alone at the end of the text included). */
function unknownColorCodes(text: string): string[] {
  return [...new Set([...text.matchAll(/ÿc(.?)/gsu)].filter((match) => !COLOR_CODE_CHARS.has(match[1])).map((match) => match[0]))];
}

/** Warnings for one text, every language of it: placeholders that print as written and colour codes the game lacks. */
function checkText(report: Report, key: string, text: FilterText | undefined, context: PlaceholderContext): void {
  if (text === undefined) return;
  const strings = typeof text === 'string' ? [text] : Object.values(text).filter((value) => typeof value === 'string');
  for (const problem of new Set(strings.flatMap((value) => placeholderProblems(value, context)))) report('warning', key, problem);
  for (const code of new Set(strings.flatMap(unknownColorCodes))) report('warning', key, `"${code}" is not a colour code the game knows`);
}

function checkActions(report: Report, actions: RuleActions, reference: LootFilterReference | undefined): void {
  checkColor(report, 'labelBackground', actions.labelBackground, [3, 4]);
  if (actions.labelBorder) {
    checkColor(report, 'labelBorder/color', actions.labelBorder.color, [3, 4]);
    const { width } = actions.labelBorder;
    if (!Number.isInteger(width) || width < 1 || width > 8)
      report('error', 'labelBorder/width', 'The border width must be a whole number from 1 to 8');
  }
  checkText(report, 'replaceName', actions.replaceName, 'names');
  checkText(report, 'namePrefix', actions.namePrefix, 'names');
  checkText(report, 'nameSuffix', actions.nameSuffix, 'names');
  checkText(report, 'chatMessage', actions.chatMessage, 'chat');
  checkText(report, 'chatMessageWhenHidden', actions.chatMessageWhenHidden, 'chat');
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

/**
 * True when a showing rule (its own `show` or its style's) has no condition but (at most) a location that includes
 * onGround: it protects every ground item from every later hide, so the filter hides nothing below it. A new
 * `{ "show": true }` rule is this until it gets its items. Passthrough keys leave the rule alone, as above.
 */
function showsEveryGroundItem(rule: LootFilterRule, filter: LootFilter): boolean {
  if (effectiveActions(rule, filter).show !== true) return false;
  if (rule.location !== undefined && !rule.location.includes('onGround')) return false;
  if (hasPassthrough(rule)) return false;
  return CONDITION_KEYS.every((key) => key === 'location' || rule[key] === undefined);
}

/** The warning of a showing rule without conditions above a hide rule; about the whole rule, so the items-first step keeps it. */
export const SHOWS_EVERY_ITEM_MESSAGE = 'Shows every item: no hide rule below it can hide anything. Pick the items this rule is for';

/** The warning of a rule with neither conditions nor actions (every new `{}` rule; the editor's items-first step hides it). */
export const EMPTY_RULE_MESSAGE = 'The rule has neither conditions nor actions';

function checkRule(
  report: Report,
  rule: LootFilterRule,
  filter: LootFilter,
  levelIds: ReadonlySet<number> | undefined,
  reference: LootFilterReference | undefined
): void {
  const hasConditions = CONDITION_KEYS.some((key) => rule[key] !== undefined);
  const hasEffects = EFFECT_KEYS.some((key) => rule[key] !== undefined);
  if (!hasConditions && !hasEffects) report('warning', '', EMPTY_RULE_MESSAGE);
  else if (!hasEffects) report('warning', '', 'The rule has conditions but no actions, so it does nothing');

  if (rule.useStyle !== undefined && (filter.styles === undefined || !Object.hasOwn(filter.styles, rule.useStyle))) {
    report('error', 'useStyle', `There is no style named "${rule.useStyle}"`);
  }
  checkHideIfFail(report, rule);
  checkHideOfUnidentified(report, rule, filter);
  checkShowAndHide(report, rule, effectiveActions(rule, filter));
  checkEmptyLists(report, rule);

  checkNamedMatch(report, 'quality', rule.quality, QUALITIES, 1, 'quality');
  checkNamedMatch(report, 'baseTier', rule.baseTier, BASE_TIERS, 0, 'base tier');
  checkNamedMatch(report, 'difficulty', rule.difficulty, DIFFICULTIES, 0, 'difficulty');
  checkNumberMatch(report, 'itemLevel', rule.itemLevel, 0, 999);
  checkNumberMatch(report, 'sockets', rule.sockets, 0, 99);
  checkNumberMatch(report, 'maxSockets', rule.maxSockets, 0, 99);

  // A level written as a single number (`"activeInLevels": 4`) has no list entry in the file to point at.
  const bareLevel = isUntouchedLevelNumber(rule);
  rule.activeInLevels?.forEach((id, index) => {
    const path = bareLevel ? 'activeInLevels' : `activeInLevels/${String(index)}`;
    if (!levelIds) report('error', path, `Level ${String(id)} does not exist: the filter has no "filterLevels"`);
    else if (!levelIds.has(id)) report('error', path, `There is no filter level with id ${String(id)}`);
  });

  for (const key of ['itemStats', 'itemStatsAnyOf'] as const) checkStats(report, key, rule[key], reference, rule);
  for (const key of ['playerStats', 'playerStatsAnyOf'] as const) checkStats(report, key, rule[key], reference);
  checkFormula(report, rule, reference);

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

/** Qualities that are never unidentified on the ground: a rule limited to them loses nothing to the unidentified skip. */
const ALWAYS_IDENTIFIED_QUALITIES: ReadonlySet<NamedValue<(typeof QUALITIES)[number]>> = new Set([
  'inferior',
  'normal',
  'superior',
  1,
  2,
  3,
]);

/** The number of `superior`, the highest quality that is never unidentified. */
const SUPERIOR_QUALITY = QUALITIES.indexOf('superior') + 1;

/**
 * The game skips a rule that reads an item stat on an unidentified item, so a hide on such a rule does not reach those
 * items (the guide: "none of its actions run and it cannot hide it"). Basic's "Except items with…" is exactly this rule.
 */
function checkHideOfUnidentified(report: Report, rule: LootFilterRule, filter: LootFilter): void {
  const actions = effectiveActions(rule, filter);
  if (actions.hide !== true && actions.hideIfOtherConditionsFail !== true) return;
  if (rule.isIdentified !== undefined || !ruleNeedsIdentifiedItem(rule)) return;
  const { quality } = rule;
  if (quality !== undefined && isNamedList(quality) && quality.every((entry) => ALWAYS_IDENTIFIED_QUALITIES.has(entry))) return;
  if (typeof quality === 'string' || typeof quality === 'number') if (ALWAYS_IDENTIFIED_QUALITIES.has(quality)) return;
  // A range up to superior (`{ "max": "superior" }`, Sully's level 4 hide of weapons and armour) holds only those qualities.
  if (quality !== undefined && !isNamedList(quality) && typeof quality === 'object' && quality.max !== undefined) {
    const max = namedToNumber(quality.max, QUALITIES, 1);
    if (max !== undefined && max <= SUPERIOR_QUALITY) return;
  }
  const key = rule.itemStats !== undefined ? 'itemStats' : rule.itemStatsAnyOf !== undefined ? 'itemStatsAnyOf' : 'formula';
  report('warning', key, 'Does not hide unidentified items: the game skips a rule that checks an item stat until the item is identified');
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

  checkText(top, 'notifications/dropFormat', filter.notifications?.dropFormat, 'dropFormat');
  checkText(top, 'notifications/levelChangeFormat', filter.notifications?.levelChangeFormat, 'levelChangeFormat');
  for (const [quality, value] of Object.entries(filter.qualityColors ?? {})) {
    if (!/^ÿc.$/su.test(value) || !COLOR_CODE_CHARS.has(value.slice(2))) {
      top('warning', `qualityColors/${quality}`, `"${value}" is not one colour code; the plugin ignores it`);
    }
  }

  for (const [name, style] of Object.entries(filter.styles ?? {})) {
    const report = reporter(diagnostics, { path: `styles/${name}`, style: name });
    if (style.useStyle !== undefined) report('error', 'useStyle', 'Styles hold actions only; a style cannot use another style');
    checkShowAndHide(report, style);
    checkActions(report, style, reference);
  }

  const disabledCount = filter.rules.filter((rule) => rule.disabled === true).length;
  const paths = ruleFilePaths(filter.rules);
  let enabledAfter = filter.rules.length - disabledCount;
  // Enabled rules that hide (by hide or hide-if-fail, their own or their style's), counted from the end.
  const hidesAfter: number[] = [];
  let hiding = 0;
  for (let index = filter.rules.length - 1; index >= 0; index -= 1) {
    hidesAfter[index] = hiding;
    const rule = filter.rules[index];
    const actions = effectiveActions(rule, filter);
    if (rule.disabled !== true && (actions.hide === true || actions.hideIfOtherConditionsFail === true)) hiding += 1;
  }
  filter.rules.forEach((rule, index) => {
    const report = reporter(diagnostics, { path: paths[index], rule: index });
    checkRule(report, rule, filter, levelIds, reference);
    if (rule.disabled === true) return;
    enabledAfter -= 1;
    if (enabledAfter > 0 && hidesEveryGroundItem(rule, filter)) {
      const later = enabledAfter === 1 ? 'the rule after it never runs' : `the ${String(enabledAfter)} rules after it never run`;
      report('warning', 'hide', `Hides every ground item; ${later} for ground items`);
    }
    if (hidesAfter[index] > 0 && showsEveryGroundItem(rule, filter)) report('warning', '', SHOWS_EVERY_ITEM_MESSAGE);
  });
  return diagnostics;
}
