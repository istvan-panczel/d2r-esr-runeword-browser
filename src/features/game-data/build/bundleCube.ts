/**
 * cube.json: every enabled cubemain.txt recipe a player can do, grouped into families (the guide's `::recipes`
 * families first, then cube/cubeCatalog.ts, then a fallback by description prefix), without the bookkeeping rows
 * (stockers, blockers, dead rows) and without the corruption / anointment / Vessel tier rows enhance.json covers.
 *
 * Per family the merged rows of the guide (cube/cubeFamilies.ts `groupFamily`, uncapped, with the number of rows
 * each stands for); small families also keep every row with its parsed cells (`recipes`). D-stoning rows carry the
 * total their D-stoning stops at (cube/dstoneCaps.ts); the sanctification outcome row links to the Enhance page.
 */
import type {
  CubeBundle,
  CubeFamilyInfo,
  CubeGroup,
  CubeHiddenCounts,
  CubeInputKind,
  CubeMergedRow,
  CubeQuality,
  CubeRecipe,
  CubeRecipeInput,
  CubeRecipeOutput,
  MaterialEnhanceTab,
} from '../engine/schema.ts';
import { CUBE_QUALITIES } from '../engine/schema.ts';
import {
  CUBE_SECTIONS,
  EXTRA_FAMILIES,
  FAMILY_NOTES,
  GUIDE_FAMILY_SECTIONS,
  STOCKER_FAMILIES,
  cubePageFamily,
  descriptionShape,
  fallbackFamily,
  fallbackPrefix,
  guideFamilyOf,
  hiddenReason,
  pointsText,
  STOCKER_ITEM,
  secretNumber,
  type ExtraFamily,
} from './cube/cubeCatalog.ts';
import { CUBE_FAMILIES, groupFamily, returnedOutputs, type CubeFamily, type FamilyGroup } from './cube/cubeFamilies.ts';
import { STOCKER_STAT, type CubeRow, type CubeTables } from './cube/cubeRows.ts';
import {
  bonusLines,
  describeOutput,
  describeOutputLevel,
  distinct,
  formatInput,
  isHiddenMod,
  joinOptions,
  parseCubeCell,
} from './cube/cubeText.ts';
import { dstoneCap, isCapMod } from './cube/dstoneCaps.ts';
import type { TsvTable } from './tsv.ts';
import { cubeCellKeys, withoutCount, type CubeIconToken } from '../engine/cubeIcons.ts';

/** Families with at most this many rows keep every row (`recipes`); larger ones only their merged rows */
export const RAW_ROW_LIMIT = 40;

export interface CubeContext {
  tables: CubeTables;
  /** Item type codes (itemtypes.txt), to tell item types from items and unique names */
  typeCodes: ReadonlySet<string>;
  /** itemstatcost.txt row (stat id) → `Stat` name, for the readable conditions */
  statNames: ReadonlyMap<number, string>;
  /** setitems.txt `index` names, to tell a named set output from a unique one (the quality filter); omitted: none */
  setNames?: ReadonlySet<string>;
  /** uniqueitems.txt `index` names; omitted: every named output that is not an item or type counts as unique */
  uniqueNames?: ReadonlySet<string>;
  /** itemstatcost ids a property sets, for the D-stoning cap stats; omitted: a cap mod raises its row's condition stat */
  statIdsOf?: (property: string) => readonly number[];
}

/** The family whose merged rows get their D-stoning cap */
const DSTONE_FAMILY = 'dstoning';

export interface CubeBuildResult {
  bundle: CubeBundle;
  /** Rows per fallback family (`other:*`), for the build report */
  fallback: { id: string; rows: number }[];
  warnings: string[];
}

const CLASS_NAMES: Readonly<Partial<Record<string, string>>> = {
  ama: 'Amazon',
  ass: 'Assassin',
  bar: 'Barbarian',
  dru: 'Druid',
  nec: 'Necromancer',
  pal: 'Paladin',
  sor: 'Sorceress',
  war: 'Warlock',
};

const SPECIAL_OUTPUTS = new Set(['useitem', 'usetype', 'cloneitem']);

/** The boss each `kill_check` value stands for, from the Kill Ledger boss rows ("Kill Ledger Rathma" → 99) */
function killCheckNames(rows: readonly CubeRow[], killCheck: number | null): Map<number, string> {
  const names = new Map<number, string>();
  if (killCheck === null) return names;
  for (const row of rows) {
    const boss = /^Kill Ledger (?!Tier )(.+)$/.exec(row.description)?.[1];
    if (boss === undefined || row.condition?.param !== killCheck || names.has(row.condition.value)) continue;
    names.set(row.condition.value, boss);
  }
  return names;
}

/** cubemain `op` → comparison of the `param` stat with `value` (the ops the cube conditions use; others unknown) */
export const STAT_OPS: Readonly<Partial<Record<number, string>>> = { 3: '≥', 15: '≥', 16: '≤', 17: '≠', 18: '=' };

/** Readable names of the stats the listed rows check, for the generic "{name} {op} {value}" wording */
const STAT_LABELS: Readonly<Partial<Record<string, string>>> = {
  item_numsockets: 'Sockets',
  item_levelreq: 'Added level requirement',
  item_tinkerflag2: 'Tinkering points',
  item_corrupted: 'Corruptions',
  item_fastercastrate: 'Faster cast rate',
  item_fasterattackrate: 'Faster attack rate',
  item_fasterblockrate: 'Faster block rate',
  item_fastermovevelocity: 'Faster run/walk',
  item_randomize: 'Use counter',
  soul_counter: 'Souls remaining',
};

/** The hidden random roll some pools read (`item_randomize` ≤ N picks a band of 0 … 511): shown as odds instead */
const ROLL_STAT = 'item_randomize';

/** `op 28`: no stat; the vanilla quest and portal recipes (Horadric Staff, Khalim's Will, Cow Portal, Pandemonium) */
const GAME_CHECK_OP = 28;
export const GAME_CHECK_TEXT = 'Game rules of the original recipe apply (quest state, act or difficulty)';

/**
 * A stat check (`op` / `param` stat / `value`) in words, or null when the row has none a player can read. Named
 * checks first (forging, merc-only, weapon mastery, the Kill Ledger), then "{stat} {op} {value}" for the rest.
 * `kill_check` (op 6, a recorded boss kill) is worded by the caller, which knows the boss names.
 * The ops, read from how ESR uses them: 3 and 15 "at least", 16 "at most", 17 "not equal", 18 "equal"
 * ("Unsocket" needs sockets ≥ 1, "Adds Socket(4)" sockets ≤ 3, tinkering points ≥ 2 before the recipe takes 2).
 */
export function statConditionText(op: number, stat: string, value: number, counterName?: (stat: string) => string | null): string | null {
  const flag = (unset: string, set: string) => (op === 18 ? (value === 0 ? unset : set) : op === 17 && value === 0 ? set : null);
  let named: string | null = null;
  if (stat === 'item_craftflag') named = flag('No forging mod', 'Has a forging mod');
  else if (stat === 'item_craftflag2') named = flag('No jewel forging', 'Has a jewel forging');
  else if (stat === 'item_mercflag') named = flag('Not merc-only', 'Merc-only item');
  else if (stat === 'weaponmastery') named = flag('No weapon mastery token applied', 'Weapon mastery token applied');
  else if (stat === 'item_upgraded' && value === 1) named = op === 17 ? 'Not upgraded yet' : op === 18 ? 'Already upgraded' : null;
  else if (stat === 'item_levelreq' && op === 18 && value === 0) named = 'Only items without an added level requirement';
  else if (stat === 'kill_base' && op === 3) named = `Kill count ≥ ${formatValue(value)}`;
  else if (stat === 'soul_counter' && op === 18 && value === 0) named = 'No souls remaining';
  else if (stat === 'item_sanctification_dummy' && op === 16 && value === 0) named = 'Not marked for sanctification';
  else if (stat === 'stancedancecontrol' && op === 18 && value === 0) named = 'Not applied to this stone yet';
  else if (stat === ROLL_STAT && op === 18 && value === 0) named = 'Not used yet';
  else if (stat === ROLL_STAT && op === 16) named = `Random roll ≤ ${formatValue(value)} (of 0 to 511)`;
  if (named !== null) return named;
  const symbol = STAT_OPS[op];
  if (symbol === undefined || stat === '') return null;
  // A stocker counter: "Stored Devil's Food Points ≥ 25"; its capacity check (≤ 65,000) is no condition a player meets
  const counter = STOCKER_STAT.test(stat) ? (counterName?.(stat) ?? null) : null;
  if (counter !== null) return op === 16 ? null : `Stored ${pointsText(2, counter).replace(/^2 /, '')} ${symbol} ${formatValue(value)}`;
  const label = STAT_LABELS[stat] ?? (STOCKER_STAT.test(stat) ? `Stocker count ${stat}` : statLabel(stat));
  return `${label} ${symbol} ${formatValue(value)}`;
}

/** `item_cannotbefrozen` → "Cannotbefrozen": the itemstatcost name without its `item_` prefix, sentence case */
function statLabel(stat: string): string {
  const words = stat.replace(/^item_/, '').replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function formatValue(value: number): string {
  return value.toLocaleString('en-US');
}

/**
 * The conditions a player can read: the class, the minimum difficulty, a recorded boss kill (`kill_check`) and the
 * stat checks (statConditionText).
 */
function conditionsOf(row: CubeRow, ctx: CubeContext, bosses: ReadonlyMap<number, string>): string[] {
  const conditions: string[] = [];
  const cls = CLASS_NAMES[row.cls];
  if (cls !== undefined) conditions.push(`${cls} only`);
  if (row.minDiff === 2) conditions.push('Hell only');
  else if (row.minDiff === 1) conditions.push('Nightmare or Hell');
  const condition = row.condition;
  if (condition !== null) {
    const stat = ctx.statNames.get(condition.param) ?? '';
    if (stat === 'kill_check') {
      const boss = bosses.get(condition.value);
      conditions.push(boss === undefined ? `Needs a recorded boss kill (#${String(condition.value)})` : `Needs a recorded ${boss} kill`);
    } else if (condition.op === GAME_CHECK_OP) {
      conditions.push(GAME_CHECK_TEXT);
    } else {
      const text = statConditionText(condition.op, stat, condition.value, ctx.tables.counterName);
      if (text !== null) conditions.push(text);
    }
  }
  return conditions;
}

/** The row's random roll threshold (`item_randomize` ≤ N), null when it has none */
function rollThreshold(row: CubeRow, ctx: CubeContext): number | null {
  const condition = row.condition;
  return condition !== null && condition.op === 16 && ctx.statNames.get(condition.param) === ROLL_STAT ? condition.value : null;
}

/** Odds pools have at most this many bands; more (map and coupon rerolls) are near-even pools the text already names */
const MAX_ODDS_BANDS = 4;

/**
 * The odds of a merged row whose rows all roll `item_randomize` (the game tries the rows in file order, each taking the
 * rolls up to its threshold): one line per threshold band, "50%: Ore Shards" (Secret Recipe 25: ≤ 254 / 407 / 511 of
 * 0 … 511). Only when the highest threshold is 2^n − 1 (the whole roll range) and there are 2 to MAX_ODDS_BANDS bands.
 */
export function rollOdds(rows: readonly CubeRow[], ctx: CubeContext): string[] | undefined {
  const thresholds = rows.map((row) => rollThreshold(row, ctx));
  if (thresholds.some((value) => value === null)) return undefined;
  const bands = [...new Set(thresholds as number[])].sort((a, b) => a - b);
  const top = bands.at(-1) ?? 0;
  const range = top + 1;
  if (bands.length < 2 || bands.length > MAX_ODDS_BANDS || (range & top) !== 0) return undefined;
  return bands.map((band, i) => {
    const chance = (band - (bands[i - 1] ?? -1)) / range;
    const outputs = rows
      .filter((_, index) => thresholds[index] === band)
      .flatMap((row) => givenOutputs(row).map((output) => describeOutput(output, ctx.tables, { bonus: false }).name));
    return `${String(Math.round(chance * 100))}%: ${joinOptions(outputs)}`;
  });
}

/**
 * The conditions of a merged row that its group does not show: those all its rows share (minus the group's), then
 * those only some rows have, marked "(some variants)". Random rolls are left out (`odds` shows them).
 */
function mergedConditions(lists: readonly (readonly string[])[], shared: readonly string[]): string[] {
  const own = lists.map((list) => list.filter((condition) => !shared.includes(condition) && !condition.startsWith('Random roll ')));
  const all = distinct(own.flat());
  const everywhere = all.filter((condition) => own.every((list) => list.includes(condition)));
  const partial = all.filter((condition) => !everywhere.includes(condition));
  // One value per variant (a gem colour's points, each sanctification roll): the row text already tells them apart
  return [...everywhere, ...(partial.length > MAX_PARTIAL_CONDITIONS ? [] : partial.map((condition) => `${condition} (some variants)`))];
}

/** A merged row lists at most this many conditions that only some of its variants have */
const MAX_PARTIAL_CONDITIONS = 3;

function inputKind(token: string, ctx: CubeContext, itemCodes: ReadonlySet<string>): CubeInputKind {
  if (token === 'any') return 'any';
  if (itemCodes.has(token)) return 'item';
  if (ctx.typeCodes.has(token)) return 'type';
  return 'unique';
}

function recipeInput(spec: string, ctx: CubeContext, itemCodes: ReadonlySet<string>): CubeRecipeInput {
  const cell = parseCubeCell(spec);
  return {
    text: formatInput(spec, ctx.tables),
    code: cell.token,
    qty: cell.qty,
    quals: cell.qualifiers.filter((part) => !part.startsWith('qty=')),
    kind: inputKind(cell.token, ctx, itemCodes),
  };
}

function recipeOutput(output: CubeRow['outputs'][number], ctx: CubeContext): CubeRecipeOutput {
  const { token } = parseCubeCell(output.spec);
  const { name, details } = describeOutput(output, ctx.tables, { bonus: false });
  const level = describeOutputLevel(output);
  return {
    text: name,
    code: SPECIAL_OUTPUTS.has(token) ? null : token,
    bonus: bonusLines(output.mods, ctx.tables),
    details,
    ...(level === undefined ? {} : { level }),
  };
}

/** Output quality qualifiers → the quality filter's values */
const QUALITY_QUALIFIERS: Readonly<Partial<Record<string, CubeQuality>>> = {
  uni: 'unique',
  set: 'set',
  rar: 'rare',
  mag: 'magic',
  crf: 'crafted',
};

/** The outputs a row gives (an item handed back unchanged, returnedOutputs, left out; as rowOutput) */
function givenOutputs(row: CubeRow): CubeRow['outputs'] {
  const returned = returnedOutputs(row);
  return row.outputs.filter((output) => !returned.includes(output));
}

/** The qualities of a row's outputs: quality qualifiers (`usetype,uni`) and named unique / set items */
function rowQualities(row: CubeRow, ctx: CubeContext, itemCodes: ReadonlySet<string>): Set<CubeQuality> {
  const qualities = new Set<CubeQuality>();
  for (const output of givenOutputs(row)) {
    const { token, qualifiers } = parseCubeCell(output.spec);
    for (const qualifier of qualifiers) {
      const quality = QUALITY_QUALIFIERS[qualifier];
      if (quality !== undefined) qualities.add(quality);
    }
    if (SPECIAL_OUTPUTS.has(token) || inputKind(token, ctx, itemCodes) !== 'unique') continue;
    if (ctx.setNames?.has(token) === true) qualities.add('set');
    else if (ctx.uniqueNames === undefined || ctx.uniqueNames.has(token)) qualities.add('unique');
  }
  return qualities;
}

/** Qualities in filter order */
function orderedQualities(qualities: ReadonlySet<CubeQuality>): CubeQuality[] {
  return CUBE_QUALITIES.filter((quality) => qualities.has(quality));
}

/** The item level of a row's outputs ("Item level 99"); several different levels joined with " / " */
function rowLevel(row: CubeRow): string | undefined {
  const levels = distinct(givenOutputs(row).flatMap((output) => describeOutputLevel(output) ?? []));
  return levels.length === 0 ? undefined : levels.join(' / ');
}

/** Display names of the unique/set name tokens of the rows' inputs or outputs (distinct, file order) */
function namedItems(rows: readonly CubeRow[], side: 'inputs' | 'outputs', ctx: CubeContext, itemCodes: ReadonlySet<string>): string[] {
  const names = new Set<string>();
  for (const row of rows) {
    for (const spec of side === 'inputs' ? row.inputs : row.outputs.map((output) => output.spec)) {
      const { token } = parseCubeCell(spec);
      if (SPECIAL_OUTPUTS.has(token) || inputKind(token, ctx, itemCodes) !== 'unique') continue;
      names.add(ctx.tables.nameOf(token));
    }
  }
  return [...names];
}

/**
 * The cap text of every D-stoning row of a family: rows with the same inputs and bonus stats are one D-stoning
 * (cube/dstoneCaps.ts applies them from zero); its cap reads like the bonus ("+120% Increased Attack Speed"). Rows of a
 * D-stoning without a cap condition, or with a counter condition (the elemental half points), get none.
 */
function dstoneCapTexts(rows: readonly CubeRow[], ctx: CubeContext): Map<CubeRow, string> {
  const bonusMods = (row: CubeRow) =>
    (row.outputs.at(0)?.mods ?? []).filter((mod) => !isCapMod(mod.mod) && mod.mod !== 'levelreq' && !isHiddenMod(mod.mod));
  const chains = new Map<string, CubeRow[]>();
  for (const row of rows) {
    const key = `${row.inputs.join('|')}|${bonusMods(row)
      .map((mod) => mod.mod)
      .sort()
      .join('+')}`;
    chains.set(key, [...(chains.get(key) ?? []), row]);
  }
  const texts = new Map<CubeRow, string>();
  for (const chain of chains.values()) {
    const result = dstoneCap(chain, bonusMods, ctx.statIdsOf ?? (() => []));
    if (result.kind !== 'capped') continue;
    const text = ctx.tables.renderMods(result.cap.mods).join(', ');
    if (text !== '') for (const row of chain) texts.set(row, text);
  }
  return texts;
}

/** The Enhance tab that lists a merged row's outcomes: the sanctification rows (`item_sanctification_dummy` = roll) */
function enhanceTabOf(rows: readonly CubeRow[], ctx: CubeContext): MaterialEnhanceTab | undefined {
  const isOutcome = (row: CubeRow) =>
    row.condition !== null && row.condition.op === 18 && ctx.statNames.get(row.condition.param) === 'item_sanctification_dummy';
  return rows.length > 0 && rows.every(isOutcome) ? 'sanctification' : undefined;
}

/** Families whose descriptions are dev labels that do not say what tells the groups apart: labelled by their ingredients */
const INGREDIENT_LABELS = new Set(['skill-forging', 'stat-forging', 'rune-forging-slots', 'tinkering']);

/** Grade and colour words of the descriptions ("P-Gem", "B-Ame", "perfect amethyst", "Thawing Potion") */
const LABEL_WORDS: readonly [RegExp, RegExp][] = [
  [/\b(?:amethyst|ame)\b/i, /Amethyst/],
  [/\b(?:topaz|top)\b/i, /Topaz/],
  [/\b(?:sapphire|sap)\b/i, /Sapphire/],
  [/\b(?:emerald|eme)\b/i, /Emerald/],
  [/\b(?:ruby|rub)\b/i, /Ruby/],
  [/\b(?:diamond|dia)\b/i, /Diamond/],
  [/\b(?:skull|sku)\b/i, /Skull/],
  [/\b(?:obsidian|obs)\b/i, /Obsidian/],
  [/\bC-Gems?\b|\bchipped\b/i, /Chipped/],
  [/\bL-Gems?\b|\bflawed\b/i, /Flawed/],
  [/\bF-Gems?\b|\bflawless\b/i, /Flawless/],
  [/\bB-Gems?\b|\bblemished\b/i, /Blemished/],
  [/\bP-Gems?\b|\bperfect\b/i, /Perfect/],
  [/\bthawing\b/i, /Thawing/],
  [/\bstamina\b/i, /Stamina/],
  [/\bantidote\b|\bantitode\b/i, /Antidote/],
];

/** True when the description names an ingredient (a gem colour or grade, a potion) none of the group's rows take */
export function labelDisagrees(label: string, inputs: readonly string[]): boolean {
  const text = inputs.join(' + ');
  return LABEL_WORDS.some(([said, taken]) => said.test(label) && !taken.test(text));
}

/** The ingredients every merged row of the group shares, in order ("Anvil Stone + Chipped Emerald"); the first row's when none */
function sharedIngredients(group: FamilyGroup): string {
  const rows = group.merged.map(({ variant }) => variant.inputs);
  const first = rows[0] ?? [];
  const shared = first.filter((input) => rows.every((inputs) => inputs.includes(input)));
  return (shared.length > 0 ? shared : first).join(' + ');
}

/**
 * The ingredients that tell a group apart from the family's other groups ("Chipped Emerald" for a skill forging):
 * those of its first merged row that not every group's first row takes; its shared ingredients when none.
 */
function distinctIngredients(group: FamilyGroup, groups: readonly FamilyGroup[]): string {
  const firsts = groups.map((other) => other.merged.at(0)?.variant.inputs ?? []);
  const own = group.merged.at(0)?.variant.inputs ?? [];
  const distinct = own.filter((input) => !firsts.every((inputs) => inputs.includes(input)));
  return distinct.length > 0 ? distinct.join(' + ') : sharedIngredients(group);
}

/**
 * Group label: "Secret Recipe N"; the family's own (class and legacy crafts, D-stoning slots, stockers); the
 * ingredients that tell the groups apart for INGREDIENT_LABELS families; the shared ingredients when the description
 * names an ingredient the rows do not take ("Belt Upgrade: Sash + Thawing Potion" takes a Stamina Potion); else the
 * first row's description shape.
 */
function groupLabel(family: CubeFamily, group: FamilyGroup, groups: readonly FamilyGroup[], tables: CubeTables): string {
  const first = group.rows[0]?.description ?? '';
  const secret = family.id === 'secret' ? secretNumber(first) : null;
  if (secret !== null) return `Secret Recipe ${String(secret)}`;
  if (family.groupLabel !== undefined) return family.groupLabel(group.rows, tables);
  if (INGREDIENT_LABELS.has(family.id)) return distinctIngredients(group, groups);
  const shape = descriptionShape(first);
  const inputs = group.merged.flatMap(({ variant }) => variant.inputs);
  return labelDisagrees(shape, inputs) ? sharedIngredients(group) : shape;
}

/** Fail-safe limits of the hidden "Too High Req Lvl" blockers: the reagent item type → the family its recipes are in */
const LIMIT_FAMILIES: Readonly<Partial<Record<string, string>>> = { dstn: 'dstoning', gem5: 'gem-meld' };

const LIMIT_TIERS: Readonly<Partial<Record<string, string>>> = {
  eli: 'elite',
  exc: 'exceptional',
  bas: 'normal tier',
  ring: 'rings',
  amul: 'amulets',
};

/**
 * "Does nothing once the item's added level requirement is at least 58 (elite), 79 (exceptional) or 99 (normal tier,
 * rings, amulets)": from the `void` blockers labelled "Too High Req Lvl" (`op 15` on `item_levelreq`), per family.
 */
export function failSafeNotes(rows: readonly CubeRow[], statNames: ReadonlyMap<number, string>): Map<string, string> {
  const limits = new Map<string, Map<number, string[]>>();
  for (const row of rows) {
    const condition = row.condition;
    if (!/Too High Req Lvl/.test(row.description) || !row.outputs.some((output) => output.spec === 'void') || condition === null) continue;
    if (condition.op !== 15 || statNames.get(condition.param) !== 'item_levelreq') continue;
    const family = LIMIT_FAMILIES[parseCubeCell(row.inputs[1] ?? '').token];
    const target = parseCubeCell(row.inputs[0] ?? '');
    const tier = [target.token, ...target.qualifiers].map((part) => LIMIT_TIERS[part]).find((found) => found !== undefined);
    if (family === undefined || tier === undefined) continue;
    const byValue = limits.get(family) ?? new Map<number, string[]>();
    const tiers = byValue.get(condition.value) ?? [];
    if (!tiers.includes(tier)) tiers.push(tier);
    byValue.set(condition.value, tiers);
    limits.set(family, byValue);
  }
  const notes = new Map<string, string>();
  for (const [family, byValue] of limits) {
    const parts = [...byValue].sort(([a], [b]) => a - b).map(([value, tiers]) => `${String(value)} (${tiers.join(', ')})`);
    const list = parts.length === 1 ? (parts[0] ?? '') : `${parts.slice(0, -1).join(', ')} or ${parts.at(-1) ?? ''}`;
    notes.set(family, `Fail-safe: does nothing once the item's added level requirement is at least ${list}.`);
  }
  return notes;
}

/** "Points per gem: Chipped 1, Flawed 3, …" from the Gem Can's storing rows (one gem of each grade) */
export function gemCanNote(rows: readonly CubeRow[], tables: Pick<CubeTables, 'nameOf'>): string | null {
  const points = new Map<string, number>();
  for (const row of rows) {
    if (row.description !== 'Gem Can Input' || row.inputs.length !== 2) continue;
    const gem = parseCubeCell(row.inputs[1] ?? '');
    const grade = /^(Chipped|Flawed|Flawless|Blemished|Perfect) /.exec(tables.nameOf(gem.token))?.[1] ?? 'Standard';
    const amount = row.outputs.flatMap((output) => output.mods).find((mod) => /^gem-[a-z]$/.test(mod.mod))?.max;
    if (gem.qty === 1 && amount !== undefined && !points.has(grade)) points.set(grade, amount);
  }
  if (points.size === 0) return null;
  const list = [...points].sort(([, a], [, b]) => a - b).map(([grade, amount]) => `${grade} ${String(amount)}`);
  return `A Gem Can counts its gems as points: ${list.join(', ')}.`;
}

export interface CubeAssignment {
  /** Family id → the family and its rows, in the order families first got a row */
  assigned: Map<string, { family: CubeFamily; rows: CubeRow[] }>;
  /** The fallback families, in first-row order */
  fallbacks: ExtraFamily[];
  hidden: CubeHiddenCounts;
}

const assignments = new WeakMap<object, CubeAssignment>();

/**
 * Every listed row assigned to the first family that matches it (the guide's, then the cube-only ones, then a fallback
 * by description prefix); hidden rows are counted by reason. Cached per table set (the guide asks once per block).
 */
export function assignCubeRows(tables: Pick<CubeTables, 'cube' | 'items' | 'nameOf'>): CubeAssignment {
  const cached = assignments.get(tables);
  if (cached !== undefined) return cached;
  const hidden: CubeHiddenCounts = { enhance: 0, traps: 0, old: 0, stockers: 0, dummy: 0 };
  const assigned = new Map<string, { family: CubeFamily; rows: CubeRow[] }>();
  const fallbacks = new Map<string, ExtraFamily>();
  const internal = new Map(tables.items.map((item) => [item.code, item.internalName]));
  const isStocker = (spec: string) => {
    const { token } = parseCubeCell(spec);
    return STOCKER_ITEM.test(tables.nameOf(token)) || STOCKER_ITEM.test(internal.get(token) ?? '');
  };
  const matches = (family: CubeFamily, row: CubeRow) => family.match.test(row.description) && (family.filter?.(row) ?? true);
  const secret = EXTRA_FAMILIES.find((extra) => extra.id === 'secret');
  for (const row of tables.cube) {
    const guide = guideFamilyOf(row);
    const stocker = STOCKER_FAMILIES.find((extra) => matches(extra, row));
    const reason = hiddenReason(row, guide !== undefined || stocker !== undefined, row.inputs.some(isStocker));
    if (reason !== null) {
      hidden[reason]++;
      continue;
    }
    // Every numbered secret recipe is in the secret family, also those a guide family lists (26, 27, 28, 40)
    const numbered = secretNumber(row.description) === null ? undefined : secret;
    let family: CubeFamily | undefined = numbered ?? guide ?? EXTRA_FAMILIES.find((extra) => matches(extra, row));
    if (family === undefined) {
      const prefix = fallbackPrefix(row.description);
      const fallback = fallbacks.get(prefix) ?? fallbackFamily(prefix);
      fallbacks.set(prefix, fallback);
      family = fallback;
    }
    const entry = assigned.get(family.id) ?? { family, rows: [] };
    entry.rows.push(row);
    assigned.set(family.id, entry);
  }
  const result = { assigned, fallbacks: [...fallbacks.values()], hidden };
  assignments.set(tables, result);
  return result;
}

export function buildCubeBundle(ctx: CubeContext): CubeBuildResult {
  const warnings: string[] = [];
  const sectionOf = new Map<string, string>();
  for (const family of CUBE_FAMILIES) {
    const section = GUIDE_FAMILY_SECTIONS[family.id];
    if (section === undefined) warnings.push(`cube: guide family "${family.id}" has no section`);
    sectionOf.set(family.id, section ?? 'other');
  }
  for (const family of EXTRA_FAMILIES) sectionOf.set(family.id, family.section);

  const { assigned, fallbacks, hidden } = assignCubeRows(ctx.tables);
  for (const fallback of fallbacks) sectionOf.set(fallback.id, fallback.section);

  // Display order: by section, then guide families, extra families and fallbacks in definition / first-row order
  const definitionOrder = [...CUBE_FAMILIES, ...EXTRA_FAMILIES, ...fallbacks].map((family) => family.id);
  const sectionOrder = new Map(CUBE_SECTIONS.map((section, i) => [section.id, i]));
  const ordered = [...assigned.values()].sort((a, b) => {
    const bySection = (sectionOrder.get(sectionOf.get(a.family.id) ?? '') ?? 0) - (sectionOrder.get(sectionOf.get(b.family.id) ?? '') ?? 0);
    return bySection !== 0 ? bySection : definitionOrder.indexOf(a.family.id) - definitionOrder.indexOf(b.family.id);
  });

  const itemCodes = new Set(ctx.tables.items.map((item) => item.code));
  const killCheck = [...ctx.statNames].find(([, name]) => name === 'kill_check')?.[0] ?? null;
  const bosses = killCheckNames(ctx.tables.cube, killCheck);
  const families: CubeFamilyInfo[] = [];
  const groups: CubeGroup[] = [];
  const rows: CubeMergedRow[] = [];
  const recipes: CubeRecipe[] = [];
  const familyNotes = new Map(Object.entries(FAMILY_NOTES).map(([id, notes]) => [id, [...(notes ?? [])]]));
  for (const [id, note] of failSafeNotes(ctx.tables.cube, ctx.statNames)) familyNotes.set(id, [...(familyNotes.get(id) ?? []), note]);
  const gemCan = gemCanNote(ctx.tables.cube, ctx.tables);
  if (gemCan !== null) familyNotes.set('gem-can-rerolls', [...(familyNotes.get('gem-can-rerolls') ?? []), gemCan]);
  ordered.forEach(({ family: assignedFamily, rows: familyRows }, order) => {
    const family = cubePageFamily(assignedFamily);
    const raw = familyRows.length <= RAW_ROW_LIMIT;
    const notes = familyNotes.get(family.id) ?? [];
    families.push({
      id: family.id,
      label: family.label,
      section: sectionOf.get(family.id) ?? 'other',
      order,
      rowCount: familyRows.length,
      raw,
      ...(notes.length === 0 ? {} : { notes }),
    });
    const capTexts = family.id === DSTONE_FAMILY ? dstoneCapTexts(familyRows, ctx) : new Map<CubeRow, string>();
    const familyGroups = groupFamily(family, ctx.tables, familyRows, 'full');
    for (const group of familyGroups) {
      const id = groups.length;
      const conditions = group.rows.map((row) => conditionsOf(row, ctx, bosses));
      const shared = (conditions[0] ?? []).filter((condition) => conditions.every((list) => list.includes(condition)));
      const inputNames = raw ? [] : namedItems(group.rows, 'inputs', ctx, itemCodes);
      const outputNames = raw ? [] : namedItems(group.rows, 'outputs', ctx, itemCodes);
      groups.push({
        id,
        family: family.id,
        label: groupLabel(family, group, familyGroups, ctx.tables),
        rowCount: group.rows.length,
        conditions: shared,
        ...(inputNames.length === 0 ? {} : { inputNames }),
        ...(outputNames.length === 0 ? {} : { outputNames }),
      });
      for (const { variant, count, indices } of group.merged) {
        const merged = indices.flatMap((index) => group.rows[index] ?? []);
        // Variants without a level do not count; a row whose variants disagree lists each level
        const levels = distinct(merged.flatMap((entry) => rowLevel(entry) ?? []));
        const qualities = new Set(merged.flatMap((entry) => [...rowQualities(entry, ctx, itemCodes)]));
        const caps = distinct(merged.flatMap((entry) => capTexts.get(entry) ?? []));
        const enhanceTab = enhanceTabOf(merged, ctx);
        // A D-stoning's cap condition is what its "Cap:" line totals
        const rowConditions = mergedConditions(
          indices.map((index) => {
            const row = group.rows.at(index);
            return row !== undefined && capTexts.has(row)
              ? conditionsOf({ ...row, condition: null }, ctx, bosses)
              : (conditions[index] ?? []);
          }),
          shared
        );
        const returned = distinct(merged.flatMap((entry) => returnedOutputs(entry).map((output) => formatInput(output.spec, ctx.tables))));
        const odds = rollOdds(merged, ctx);
        rows.push({
          family: family.id,
          group: id,
          inputs: variant.inputs,
          output: variant.output,
          variants: count,
          ...(levels.length === 0 ? {} : { outputLevel: levels.join(' / ') }),
          ...(caps.length === 0 ? {} : { dstoneCaps: caps }),
          ...(enhanceTab === undefined ? {} : { enhanceTab }),
          ...(rowConditions.length === 0 ? {} : { conditions: rowConditions }),
          ...(returned.length === 0 ? {} : { returned: joinOptions(returned) }),
          ...(odds === undefined ? {} : { odds }),
          qualities: orderedQualities(qualities),
        });
      }
      if (!raw) continue;
      group.rows.forEach((row, i) => {
        recipes.push({
          id: row.line,
          family: family.id,
          group: id,
          description: row.description,
          inputs: row.inputs.map((spec) => recipeInput(spec, ctx, itemCodes)),
          outputs: row.outputs.map((output) => recipeOutput(output, ctx)),
          conditions: conditions[i] ?? [],
          qualities: orderedQualities(rowQualities(row, ctx, itemCodes)),
        });
      });
    }
  });

  const usedSections = new Set(families.map((family) => family.section));
  const shown = [
    ...rows.flatMap((row) => [...row.inputs, row.output]),
    ...recipes.flatMap((recipe) => [...recipe.inputs.map((input) => input.text), ...recipe.outputs.map((output) => output.text)]),
  ];
  const listed = [...assigned.values()].flatMap((entry) => entry.rows);
  return {
    bundle: {
      sections: CUBE_SECTIONS.filter((section) => usedSections.has(section.id)).map(({ notes, guide, ...section }) => ({
        ...section,
        ...(notes === undefined ? {} : { notes: [...notes] }),
        ...(guide === undefined ? {} : { guide: [...guide] }),
      })),
      families,
      groups,
      rows,
      recipes,
      hidden: { ...hidden },
      icons: cubeIconMap(listed, shown, ctx, itemCodes),
    },
    fallback: fallbacks.map((family) => ({ id: family.id, rows: assigned.get(family.id)?.rows.length ?? 0 })),
    warnings,
  };
}

/**
 * The icon token of a cell token: an item code, an item type code, or a unique / set item name (by its display name);
 * null for `any`, the special outputs and other string keys (Red Portal …).
 */
function iconToken(token: string, ctx: CubeContext, itemCodes: ReadonlySet<string>): CubeIconToken | null {
  if (SPECIAL_OUTPUTS.has(token)) return null;
  const kind = inputKind(token, ctx, itemCodes);
  if (kind === 'item') return `i:${token}`;
  if (kind === 'type') return `t:${token}`;
  if (kind === 'any') return null;
  if (ctx.setNames?.has(token) === true) return `s:${ctx.tables.nameOf(token)}`;
  if (ctx.uniqueNames === undefined || ctx.uniqueNames.has(token)) return `u:${ctx.tables.nameOf(token)}`;
  return null;
}

/**
 * cube.json `icons`: the cell texts of the listed rows (inputs as formatInput writes them, outputs by their name) →
 * their icon token, kept only for the keys the shown texts (`shown`: merged rows and raw recipes) are looked up by.
 * The first row naming a text wins, except that an item replaces an item type ("Ring" is the base and the type).
 */
export function cubeIconMap(
  rows: readonly CubeRow[],
  shown: readonly string[],
  ctx: CubeContext,
  itemCodes: ReadonlySet<string>
): Record<string, string> {
  const tokens = new Map<string, CubeIconToken>();
  const add = (text: string, token: CubeIconToken | null) => {
    if (token === null) return;
    const key = withoutCount(text);
    const existing = tokens.get(key);
    if (existing === undefined || (existing.startsWith('t:') && token.startsWith('i:'))) tokens.set(key, token);
  };
  for (const row of rows) {
    for (const spec of row.inputs) add(formatInput(spec, ctx.tables), iconToken(parseCubeCell(spec).token, ctx, itemCodes));
    for (const output of row.outputs) {
      add(describeOutput(output, ctx.tables, { bonus: false }).name, iconToken(parseCubeCell(output.spec).token, ctx, itemCodes));
    }
  }
  const wanted = new Set(shown.flatMap(cubeCellKeys));
  return Object.fromEntries([...tokens].filter(([key]) => wanted.has(key)).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

/** Item type codes of itemtypes.txt */
export function itemTypeCodes(itemtypes: TsvTable): Set<string> {
  return new Set(itemtypes.rows.map((row) => row.str('Code')).filter((code) => code !== ''));
}
