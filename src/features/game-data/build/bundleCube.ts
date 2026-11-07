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
  GUIDE_FAMILY_SECTIONS,
  descriptionShape,
  fallbackFamily,
  fallbackPrefix,
  guideFamilyOf,
  hiddenReason,
  STOCKER_ITEM,
  secretNumber,
  type ExtraFamily,
} from './cube/cubeCatalog.ts';
import { CUBE_FAMILIES, groupFamily, type CubeFamily } from './cube/cubeFamilies.ts';
import type { CubeRow, CubeTables } from './cube/cubeRows.ts';
import { bonusLines, describeOutput, describeOutputLevel, distinct, formatInput, isHiddenMod, parseCubeCell } from './cube/cubeText.ts';
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
  item_randomize: 'Randomize counter',
  soul_counter: 'Souls remaining',
  stancedancecontrol: 'Stance dance control',
};

/** Stocker counters (`item_02` Decipherers in a Multi Stocker, `junk_09`, `xtal_03`, `rune_12`, `gem_r`) */
const STOCKER_STAT = /^(?:(?:item|junk|xtal|rune)_\d+|gem_[a-z])$/;

/**
 * A stat check (`op` / `param` stat / `value`) in words, or null when the row has none a player can read. Named
 * checks first (forging, merc-only, weapon mastery, the Kill Ledger), then "{stat} {op} {value}" for the rest.
 * `kill_check` (op 6, a recorded boss kill) is worded by the caller, which knows the boss names.
 * The ops, read from how ESR uses them: 3 and 15 "at least", 16 "at most", 17 "not equal", 18 "equal"
 * ("Unsocket" needs sockets ≥ 1, "Adds Socket(4)" sockets ≤ 3, tinkering points ≥ 2 before the recipe takes 2).
 */
export function statConditionText(op: number, stat: string, value: number): string | null {
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
  if (named !== null) return named;
  const symbol = STAT_OPS[op];
  if (symbol === undefined || stat === '') return null;
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
    } else {
      const text = statConditionText(condition.op, stat, condition.value);
      if (text !== null) conditions.push(text);
    }
  }
  return conditions;
}

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

/** The outputs a row gives (an item handed back unchanged, an output equal to an input, left out; as rowOutput) */
function givenOutputs(row: CubeRow): CubeRow['outputs'] {
  const kept = row.outputs.filter((output) => !row.inputs.includes(output.spec));
  return kept.length > 0 ? kept : row.outputs;
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

/** Group label: "Secret Recipe N", else the first row's description shape */
function groupLabel(family: CubeFamily, rows: readonly CubeRow[]): string {
  const first = rows[0]?.description ?? '';
  const secret = family.id === 'secret' ? secretNumber(first) : null;
  return secret === null ? descriptionShape(first) : `Secret Recipe ${String(secret)}`;
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
  for (const row of tables.cube) {
    const guide = guideFamilyOf(row);
    const reason = hiddenReason(row, guide !== undefined, row.inputs.some(isStocker));
    if (reason !== null) {
      hidden[reason]++;
      continue;
    }
    let family: CubeFamily | undefined = guide ?? EXTRA_FAMILIES.find((extra) => extra.match.test(row.description));
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
  ordered.forEach(({ family, rows: familyRows }, order) => {
    const raw = familyRows.length <= RAW_ROW_LIMIT;
    families.push({
      id: family.id,
      label: family.label,
      section: sectionOf.get(family.id) ?? 'other',
      order,
      rowCount: familyRows.length,
      raw,
    });
    const capTexts = family.id === DSTONE_FAMILY ? dstoneCapTexts(familyRows, ctx) : new Map<CubeRow, string>();
    for (const group of groupFamily(family, ctx.tables, familyRows, 'full')) {
      const id = groups.length;
      const conditions = group.rows.map((row) => conditionsOf(row, ctx, bosses));
      const shared = (conditions[0] ?? []).filter((condition) => conditions.every((list) => list.includes(condition)));
      const inputNames = raw ? [] : namedItems(group.rows, 'inputs', ctx, itemCodes);
      const outputNames = raw ? [] : namedItems(group.rows, 'outputs', ctx, itemCodes);
      groups.push({
        id,
        family: family.id,
        label: groupLabel(family, group.rows),
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
        rows.push({
          family: family.id,
          group: id,
          inputs: variant.inputs,
          output: variant.output,
          variants: count,
          ...(levels.length === 0 ? {} : { outputLevel: levels.join(' / ') }),
          ...(caps.length === 0 ? {} : { dstoneCaps: caps }),
          ...(enhanceTab === undefined ? {} : { enhanceTab }),
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
      sections: CUBE_SECTIONS.filter((section) => usedSections.has(section.id)).map((section) => ({ ...section })),
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
