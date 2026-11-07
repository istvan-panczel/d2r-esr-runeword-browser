/**
 * enhance.json: corruption, anointment, sanctification and Vessel of Souls outcomes from cubemain.txt.
 *
 * Corruption, anointment and sanctification use a two-step trick: cubing the item with the reagent adds a hidden dummy stat with a
 * random roll (`op=16` "dummy is 0", output `useitem` with `<x>_dummy min..max`); cubing the item alone then matches
 * one outcome row per roll value (`op=18` "dummy equals N"), which adds the marker, clears the dummy and adds the bonus.
 * Rows whose output is `void` are blockers ("already corrupted", traps). Everything is derived from row data; the
 * descriptions are only read for anointment labels ("(of Abyss)") and the vessel cap counts ("max 2 trap").
 */
import {
  ENHANCE_QUALITIES,
  type AnointmentOutcome,
  type AnointmentSlot,
  type CorruptionBrickResult,
  type CorruptionOutcome,
  type CorruptionSlot,
  type EnhanceBonus,
  type EnhanceBundle,
  type EnhanceMod,
  type EnhanceQuality,
  type SanctificationBonus,
  type SanctificationOutcome,
  type VesselMaterial,
  type VesselRecipe,
  type VesselTier,
  type VesselTransform,
} from '../engine/schema.ts';
import type { ModsRenderer } from './bundleRunewords.ts';
import type { TsvRow, TsvTable } from './tsv.ts';

export interface EnhanceTables {
  cubemain: TsvTable;
  /** For the Vessel's starting souls (`soul-counter` property of its unique row) */
  uniqueitems: TsvTable;
}

export interface EnhanceContext {
  /** Display name of an item code, item type code or string key (unique names); falls back to the token */
  nameOf: (token: string) => string;
  /** True when item type `code` is `parent` or one of its descendants */
  isA: (code: string, parent: string) => boolean;
  /** itemstatcost ids a property sets (for joining the Vessel cap rows); [] when unknown */
  statIdsOf: (property: string) => number[];
  renderMods: ModsRenderer;
}

export interface EnhanceBuildResult {
  bundle: EnhanceBundle;
  warnings: string[];
}

/** Properties that only mark or count (never a bonus): the markers, dummies, vessel counters and flags. */
const HIDDEN_MODS = new Set([
  'corrupted',
  'corrupted_dummy',
  'anointed',
  'anointed_dummy',
  'sanctified',
  'sanctified-dummy',
  'soul-counter',
  'mythicaldesc',
  'unusable-item',
  'tinkerflag2',
  'craftflag',
  'craftflag2',
  'item-upgraded',
]);

const CORRUPT_DUMMY = 'corrupted_dummy';
const ANOINT_DUMMY = 'anointed_dummy';
const SANCTIFY_DUMMY = 'sanctified-dummy';
const SOUL_COUNTER = 'soul-counter';

/** Equipment slots by cubemain item type, in display order */
const SLOTS: readonly { typeCode: string; slot: string; label: string }[] = [
  { typeCode: 'weap', slot: 'weapon', label: 'Weapon' },
  { typeCode: 'shld', slot: 'shield', label: 'Shield' },
  { typeCode: 'tors', slot: 'body', label: 'Body Armor' },
  { typeCode: 'helm', slot: 'helm', label: 'Helm' },
  { typeCode: 'glov', slot: 'gloves', label: 'Gloves' },
  { typeCode: 'belt', slot: 'belt', label: 'Belt' },
  { typeCode: 'boot', slot: 'boots', label: 'Boots' },
  { typeCode: 'ring', slot: 'ring', label: 'Ring' },
  { typeCode: 'amul', slot: 'amulet', label: 'Amulet' },
  { typeCode: 'misl', slot: 'quiver', label: 'Quiver' },
  { typeCode: 'char', slot: 'charm', label: 'Unique Charm' },
];

const QUALITY_WORDS: Record<EnhanceQuality, string> = {
  uni: 'Unique',
  set: 'Set',
  rar: 'Rare',
  crf: 'Crafted',
  mag: 'Magic',
  hiq: 'Superior',
  nor: 'Normal',
  low: 'Low Quality',
};

// --- cubemain rows ------------------------------------------------------------------------------------------------

/** One parsed input cell: `"weap,uni,nru"` → code `weap`, qualifiers `uni`/`nru`, qty 1 */
interface CubeInput {
  cell: string;
  code: string;
  qualifiers: string[];
  qty: number;
}

interface CubeRecipe {
  description: string;
  enabled: boolean;
  op: number;
  param: number;
  value: number;
  inputs: CubeInput[];
  /** Raw `output` cell without quotes */
  output: string;
  mods: EnhanceMod[];
}

function unquote(cell: string): string {
  return cell.replace(/^"|"$/g, '').trim();
}

function numberCell(row: TsvRow, column: string): number {
  if (!row.has(column)) return 0;
  const value = Number(row.str(column));
  return Number.isNaN(value) ? 0 : value;
}

function parseInput(cell: string): CubeInput {
  const [code = '', ...rest] = cell.split(',').map((part) => part.trim());
  let qty = 1;
  const qualifiers: string[] = [];
  for (const part of rest) {
    const match = /^qty=(\d+)$/.exec(part);
    if (match === null) qualifiers.push(part);
    else qty = Number(match[1]);
  }
  return { cell, code, qualifiers, qty };
}

function readMods(row: TsvRow): EnhanceMod[] {
  const mods: EnhanceMod[] = [];
  for (let i = 1; i <= 5; i++) {
    const column = `mod ${String(i)}`;
    if (!row.has(column) || row.str(column) === '') continue;
    const param = row.has(`${column} param`) ? row.str(`${column} param`) : '';
    const mod: EnhanceMod = {
      code: row.str(column),
      param: param === '' ? null : param,
      min: numberCell(row, `${column} min`),
      max: numberCell(row, `${column} max`),
    };
    const chance = numberCell(row, `${column} chance`);
    if (chance > 0 && chance < 100) mod.chance = chance;
    mods.push(mod);
  }
  return mods;
}

function readCubeRecipes(table: TsvTable): CubeRecipe[] {
  return table.rows.map((row) => ({
    description: row.str('description'),
    enabled: numberCell(row, 'enabled') === 1,
    op: numberCell(row, 'op'),
    param: numberCell(row, 'param'),
    value: numberCell(row, 'value'),
    inputs: [1, 2, 3, 4, 5, 6, 7]
      .map((i) => (row.has(`input ${String(i)}`) ? unquote(row.str(`input ${String(i)}`)) : ''))
      .filter((cell) => cell !== '')
      .map(parseInput),
    output: row.has('output') ? unquote(row.str('output')) : '',
    mods: readMods(row),
  }));
}

const isVoid = (recipe: CubeRecipe) => recipe.output === 'void';
const modOf = (recipe: CubeRecipe, code: string) => recipe.mods.find((mod) => mod.code === code);
const qualityOf = (input: CubeInput) =>
  input.qualifiers.find((part): part is EnhanceQuality => (ENHANCE_QUALITIES as readonly string[]).includes(part));
const sortQualities = (qualities: Iterable<EnhanceQuality>) => ENHANCE_QUALITIES.filter((quality) => new Set(qualities).has(quality));

// --- rendering ----------------------------------------------------------------------------------------------------

function createLineRenderer(renderMods: ModsRenderer, warnings: Set<string>) {
  const readable = (mod: EnhanceMod) => {
    const result = renderMods([{ code: mod.code, param: mod.param, min: mod.min, max: mod.max }]);
    for (const warning of result.warnings) warnings.add(`enhance: ${warning}`);
    return result.warnings.length === 0;
  };
  const render = (mods: readonly EnhanceMod[]) =>
    mods.length === 0 ? [] : renderMods(mods.map((mod) => ({ code: mod.code, param: mod.param, min: mod.min, max: mod.max }))).lines;

  /** Visible mods and their lines; mods the renderer cannot read are dropped (with a warning) like in the guide */
  return (mods: readonly EnhanceMod[]): EnhanceBonus => {
    const visible = mods.filter((mod) => !HIDDEN_MODS.has(mod.code) && readable(mod));
    const sure = visible.filter((mod) => mod.chance === undefined);
    const lines = render(sure);
    for (const mod of visible) {
      if (mod.chance === undefined) continue;
      lines.push(...render([mod]).map((line) => `${line} (${String(mod.chance)}% chance)`));
    }
    return { mods: visible, lines };
  };
}

type LineRenderer = ReturnType<typeof createLineRenderer>;

const sameMods = (a: readonly EnhanceMod[], b: readonly EnhanceMod[]) => JSON.stringify(a) === JSON.stringify(b);

// --- corruption ---------------------------------------------------------------------------------------------------

interface DummyRoll {
  recipe: CubeRecipe;
  min: number;
  max: number;
}

/** "Add … Dummy Stat" rows: `op=16 value=0`, output `useitem` adding the dummy roll range */
function dummyRolls(recipes: readonly CubeRecipe[], dummy: string): DummyRoll[] {
  return recipes.flatMap((recipe) => {
    const mod = modOf(recipe, dummy);
    if (recipe.op !== 16 || recipe.value !== 0 || recipe.output !== 'useitem' || mod === undefined) return [];
    return [{ recipe, min: mod.min, max: mod.max }];
  });
}

/** The dummy stat id: the condition of the outcome rows, which clear the dummy (a negative dummy mod) */
function outcomeParam(recipes: readonly CubeRecipe[], dummy: string): number | null {
  return recipes.find((recipe) => recipe.op === 18 && (modOf(recipe, dummy)?.min ?? 0) < 0)?.param ?? null;
}

function brickText(output: string, nameOf: EnhanceContext['nameOf']): string {
  const input = parseInput(output);
  const quality = qualityOf(input);
  const word = quality === undefined ? '' : `${QUALITY_WORDS[quality]} `;
  if (input.code === 'usetype') return `${word}item of the same type`;
  return `${word}${nameOf(input.code)}`;
}

interface CorruptionResult {
  corruption: EnhanceBundle['corruption'];
  slots: CorruptionSlot[];
  outcomes: CorruptionOutcome[];
}

function buildCorruption(
  recipes: readonly CubeRecipe[],
  ctx: EnhanceContext,
  renderLines: LineRenderer,
  warnings: Set<string>
): CorruptionResult {
  const rolls = dummyRolls(recipes, CORRUPT_DUMMY);
  const dummyParam = outcomeParam(recipes, CORRUPT_DUMMY);
  const reagentCode = rolls.at(0)?.recipe.inputs[1]?.code ?? '';
  const outcomeRows = recipes.filter((recipe) => recipe.op === 18 && recipe.param === dummyParam && recipe.inputs.length === 1);

  const slots: CorruptionSlot[] = [];
  const outcomes: CorruptionOutcome[] = [];
  for (const def of SLOTS) {
    const slotRolls = rolls.filter(
      (roll) => roll.recipe.inputs[0]?.code === def.typeCode && qualityOf(roll.recipe.inputs[0]) !== undefined
    );
    const qualities: EnhanceQuality[] = [];
    const rollOnly: EnhanceQuality[] = [];
    let list: CorruptionOutcome[] | null = null;
    let rollRange = 0;
    let brickRolls = 0;
    const results: CorruptionBrickResult[] = [];
    for (const roll of slotRolls) {
      const input = roll.recipe.inputs.at(0);
      const quality = input === undefined ? undefined : qualityOf(input);
      if (input === undefined || quality === undefined) continue;
      const inRange = (recipe: CubeRecipe) => recipe.value >= roll.min && recipe.value <= roll.max;
      const own = outcomeRows.filter((recipe) => recipe.inputs[0]?.cell === input.cell && inRange(recipe));
      const success = own.filter((recipe) => recipe.output === 'useitem').sort((a, b) => a.value - b.value);
      if (success.length === 0) {
        rollOnly.push(quality);
        continue;
      }
      qualities.push(quality);
      const range = roll.max - roll.min + 1;
      const bricks = own.filter((recipe) => recipe.output !== 'useitem');
      const rendered = success.map((recipe) => ({ roll: recipe.value - roll.min + 1, bonus: renderLines(recipe.mods) }));
      if (list === null) {
        list = rendered.map(({ roll: index, bonus }) => ({ slot: def.slot, roll: index, ...bonus }));
        rollRange = range;
        brickRolls = bricks.length;
      } else if (range !== rollRange || rendered.length !== list.length) {
        warnings.add(`enhance: ${QUALITY_WORDS[quality]} ${def.label} corruption has another roll range or outcome count`);
      } else {
        // Same roll, other values (e.g. Low/Normal/Superior body armor): kept as a variant of that roll
        rendered.forEach(({ bonus }, i) => {
          const outcome = list?.[i];
          if (outcome === undefined || sameMods(outcome.mods, bonus.mods)) return;
          outcome.variants ??= [];
          const variant = outcome.variants.find((entry) => sameMods(entry.mods, bonus.mods));
          if (variant === undefined) outcome.variants.push({ qualities: [quality], ...bonus });
          else variant.qualities.push(quality);
        });
      }
      if (success.length + bricks.length !== range)
        warnings.add(
          `enhance: ${QUALITY_WORDS[quality]} ${def.label} corruption covers ${String(success.length + bricks.length)} of ${String(range)} rolls`
        );
      for (const output of new Set(bricks.map((recipe) => recipe.output))) {
        results.push({ quality, type: null, typeName: null, result: brickText(output, ctx.nameOf) });
      }
      // More specific brick rows (Odd Charm → Grand Charm): a subtype of the slot with the same quality, in the range
      const seen = new Set<string>();
      for (const recipe of outcomeRows) {
        const sub = recipe.inputs.at(0);
        if (sub === undefined || sub.code === def.typeCode || !ctx.isA(sub.code, def.typeCode)) continue;
        if (qualityOf(sub) !== quality || !inRange(recipe) || recipe.output === 'useitem') continue;
        // Item codes of an already listed subtype (Odd Charm item `cm4` of type `ocha`) repeat the same result
        const key = `${ctx.nameOf(sub.code)}|${recipe.output}`;
        if (seen.has(key)) continue;
        seen.add(key);
        results.push({ quality, type: sub.code, typeName: ctx.nameOf(sub.code), result: brickText(recipe.output, ctx.nameOf) });
      }
    }
    if (list === null) continue;
    for (const outcome of list) for (const variant of outcome.variants ?? []) variant.qualities = sortQualities(variant.qualities);
    outcomes.push(...list);
    slots.push({
      slot: def.slot,
      typeCode: def.typeCode,
      label: def.label,
      qualities: sortQualities(qualities),
      rollOnlyQualities: sortQualities(rollOnly),
      rollRange,
      outcomes: list.length,
      successRate: list.length / rollRange,
      brick: { rolls: brickRolls, rate: brickRolls / rollRange, results },
    });
  }

  // Special rows. A named item (not an item type) with its own roll: repeatable until its `void` check (op=15) is met
  const notes: string[] = [];
  const markerParam = recipes.find(
    (recipe) => isVoid(recipe) && recipe.op === 18 && recipe.inputs.length === 2 && recipe.inputs[1]?.code === reagentCode
  )?.param;
  for (const recipe of recipes) {
    const item = recipe.inputs.at(0);
    const reagent = recipe.inputs.at(1);
    if (item === undefined || recipe.inputs.length !== 2) continue;
    if (isVoid(recipe) && reagent?.code === reagentCode && recipe.op === 15 && recipe.param === markerParam) {
      const own = outcomeRows
        .filter((row) => row.inputs[0]?.cell === item.cell && row.output === 'useitem')
        .sort((a, b) => a.value - b.value)
        .map((row) => renderLines(row.mods).mods);
      const same = slots.find((slot) => {
        const slotOutcomes = outcomes.filter((outcome) => outcome.slot === slot.slot);
        return slotOutcomes.length === own.length && slotOutcomes.every((outcome, i) => sameMods(outcome.mods, own[i] ?? []));
      });
      const outcomesText = same === undefined ? '' : ` (the ${same.label} outcomes)`;
      notes.push(`${ctx.nameOf(item.code)} can be corrupted repeatedly, up to ${String(recipe.value)} times${outcomesText}.`);
    }
    const marker = modOf(recipe, 'corrupted');
    if (!isVoid(recipe) && reagent !== undefined && reagent.code !== reagentCode && marker !== undefined && marker.max < 0) {
      notes.push(
        `${ctx.nameOf(reagent.code)} removes the Corrupted marker from ${item.code === 'any' ? 'any item' : ctx.nameOf(item.code)}.`
      );
    }
  }

  return { corruption: { reagent: { code: reagentCode, name: ctx.nameOf(reagentCode) }, notes }, slots, outcomes };
}

// --- anointment ---------------------------------------------------------------------------------------------------

function anointmentOutcomes(pool: string, rows: readonly CubeRecipe[], renderLines: LineRenderer): AnointmentOutcome[] {
  return [...rows]
    .sort((a, b) => a.value - b.value)
    .map((recipe) => {
      const label = /\(([^()]+)\)\s*$/.exec(recipe.description)?.[1];
      return { pool, roll: recipe.value, ...(label === undefined ? {} : { label }), ...renderLines(recipe.mods) };
    });
}

interface AnointmentResult {
  anointment: EnhanceBundle['anointment'];
  slots: AnointmentSlot[];
  outcomes: AnointmentOutcome[];
}

function buildAnointment(
  recipes: readonly CubeRecipe[],
  ctx: EnhanceContext,
  renderLines: LineRenderer,
  vesselItem: string,
  warnings: Set<string>
): AnointmentResult {
  const rolls = dummyRolls(recipes, ANOINT_DUMMY).filter((roll) => roll.recipe.inputs.length >= 2);
  const dummyParam = outcomeParam(recipes, ANOINT_DUMMY);
  const outcomeRows = recipes.filter(
    (recipe) => recipe.op === 18 && recipe.param === dummyParam && recipe.inputs.length === 1 && recipe.output === 'useitem'
  );
  const poolRows = (cell: string) => outcomeRows.filter((recipe) => recipe.inputs[0]?.cell === cell);

  // Equipment: the item type of a slot plus one reagent
  const equipmentRolls = rolls.filter(
    (roll) => roll.recipe.inputs.length === 2 && SLOTS.some((def) => def.typeCode === roll.recipe.inputs[0]?.code)
  );
  const reagentCode = equipmentRolls.at(0)?.recipe.inputs[1]?.code ?? '';
  const slots: AnointmentSlot[] = [];
  const outcomes: AnointmentOutcome[] = [];
  for (const def of SLOTS) {
    const slotRolls = equipmentRolls.filter((roll) => roll.recipe.inputs[0]?.code === def.typeCode);
    const plain = slotRolls.find((roll) => !roll.recipe.inputs[0]?.qualifiers.includes('sock'));
    const socketed = slotRolls.find((roll) => roll.recipe.inputs[0]?.qualifiers.includes('sock'));
    if (plain === undefined) continue;
    const list = anointmentOutcomes(def.slot, poolRows(plain.recipe.inputs[0]?.cell ?? ''), renderLines);
    const rollRange = plain.max - plain.min + 1;
    if (list.length !== rollRange)
      warnings.add(`enhance: ${def.label} anointment has ${String(list.length)} outcome rows for ${String(rollRange)} rolls`);
    outcomes.push(...list);
    slots.push({
      slot: def.slot,
      typeCode: def.typeCode,
      label: def.label,
      rollRange,
      socketedRollRange: socketed === undefined ? null : socketed.max - socketed.min + 1,
    });
  }
  // `void` rows "<slot>,<quality> + reagent" without a condition block that quality
  const blockedQualities = sortQualities(
    recipes.flatMap((recipe) => {
      const item = recipe.inputs.at(0);
      const reagent = recipe.inputs.at(1);
      if (!isVoid(recipe) || recipe.op !== 0 || reagent?.code !== reagentCode || item === undefined) return [];
      const quality = SLOTS.some((def) => def.typeCode === item.code) ? qualityOf(item) : undefined;
      return quality === undefined ? [] : [quality];
    })
  );
  const noRunewords = equipmentRolls.length > 0 && equipmentRolls.every((roll) => roll.recipe.inputs[0]?.qualifiers.includes('nru'));

  // Unique charm: the charm type plus several reagents
  const charmRoll = rolls.find((roll) => roll.recipe.inputs.length > 2 && roll.recipe.inputs[0]?.code === 'char');
  const charmOutcomes =
    charmRoll === undefined ? [] : anointmentOutcomes('charm', poolRows(charmRoll.recipe.inputs[0]?.cell ?? ''), renderLines);
  if (charmRoll !== undefined && charmOutcomes.length !== charmRoll.max - charmRoll.min + 1)
    warnings.add(`enhance: unique charm anointment has ${String(charmOutcomes.length)} outcome rows`);
  outcomes.push(...charmOutcomes, ...anointmentOutcomes('vessel', poolRows(vesselItem), renderLines));

  return {
    anointment: {
      reagent: { code: reagentCode, name: ctx.nameOf(reagentCode) },
      blockedQualities,
      noRunewords,
      charmReagents: (charmRoll?.recipe.inputs.slice(1) ?? []).map((input) => ({ code: input.code, name: ctx.nameOf(input.code) })),
      vesselItem,
    },
    slots,
    outcomes,
  };
}

// --- sanctification ------------------------------------------------------------------------------------------------

interface SanctificationResult {
  sanctification: EnhanceBundle['sanctification'];
  outcomes: SanctificationOutcome[];
  bonuses: SanctificationBonus[];
}

/**
 * Lucion's Relic: "item + Relic" adds the `sanctified-dummy` roll, "item alone" then matches one outcome row per roll
 * value (every roll is one outcome, so each is equally likely). `bonuses` counts how many outcomes carry each bonus.
 */
function buildSanctification(
  recipes: readonly CubeRecipe[],
  ctx: EnhanceContext,
  renderLines: LineRenderer,
  warnings: Set<string>
): SanctificationResult | null {
  const roll = dummyRolls(recipes, SANCTIFY_DUMMY).find((entry) => entry.recipe.inputs.length === 2);
  const item = roll?.recipe.inputs[0];
  const reagent = roll?.recipe.inputs[1];
  // No roll row: no sanctification (the integrity test checks the ESR count)
  if (roll === undefined || item === undefined || reagent === undefined) return null;
  const dummyParam = outcomeParam(recipes, SANCTIFY_DUMMY);
  const rows = recipes
    .filter(
      (recipe) =>
        recipe.op === 18 &&
        recipe.param === dummyParam &&
        recipe.output === 'useitem' &&
        recipe.inputs.length === 1 &&
        recipe.inputs[0]?.cell === item.cell
    )
    .sort((a, b) => a.value - b.value);
  const outcomes = rows.map((recipe): SanctificationOutcome => ({ roll: recipe.value, ...renderLines(recipe.mods) }));
  const rollRange = roll.max - roll.min + 1;
  const rolls = new Set(outcomes.map((outcome) => outcome.roll));
  if (outcomes.length !== rollRange || ![...rolls].every((value) => value >= roll.min && value <= roll.max))
    warnings.add(`enhance: sanctification has ${String(outcomes.length)} outcome rows for ${String(rollRange)} rolls`);

  // One entry per distinct bonus (property, param and range) with its outcome count, by its column in the rows (the
  // outcomes combine one bonus of each column), then first seen
  const bonuses = new Map<string, SanctificationBonus & { column: number }>();
  for (const outcome of outcomes) {
    outcome.mods.forEach((mod, column) => {
      const key = JSON.stringify(mod);
      const entry = bonuses.get(key);
      if (entry !== undefined) entry.outcomes++;
      else bonuses.set(key, { line: renderLines([mod]).lines.join(', '), outcomes: 1, column });
    });
  }
  // A `void` "item + Relic" row on a stat being 1: the item can be sanctified once
  const once = recipes.some(
    (recipe) =>
      isVoid(recipe) &&
      recipe.op === 18 &&
      recipe.value === 1 &&
      recipe.inputs[0]?.cell === item.cell &&
      recipe.inputs[1]?.code === reagent.code
  );
  return {
    sanctification: {
      reagent: { code: reagent.code, name: ctx.nameOf(reagent.code) },
      item: { code: item.code, name: ctx.nameOf(item.code) },
      rollRange,
      once,
    },
    outcomes,
    bonuses: [...bonuses.values()].sort((a, b) => a.column - b.column).map(({ line, outcomes: count }) => ({ line, outcomes: count })),
  };
}

// --- Vessel of Souls ----------------------------------------------------------------------------------------------

function startSoulsOf(uniqueitems: TsvTable, item: string): number | null {
  const row = uniqueitems.rows.find((candidate) => candidate.has('index') && candidate.str('index') === item);
  if (row === undefined) return null;
  for (let i = 1; i <= 12; i++) {
    const column = `prop${String(i)}`;
    if (row.has(column) && row.str(column) === SOUL_COUNTER) return numberCell(row, `min${String(i)}`);
  }
  return null;
}

function materialsOf(recipe: CubeRecipe, ctx: EnhanceContext): VesselMaterial[] {
  return recipe.inputs.slice(1).map((input) => ({ code: input.code, name: ctx.nameOf(input.code), qty: input.qty }));
}

const materialKey = (recipe: CubeRecipe) =>
  recipe.inputs
    .slice(1)
    .map((input) => `${input.code}x${String(input.qty)}`)
    .sort()
    .join('+');

interface VesselResult {
  vessel: EnhanceBundle['vessel'];
  /** itemstatcost id of the soul counter (the recipes' condition stat) */
  soulParam: number;
  tiers: VesselTier[];
  recipes: VesselRecipe[];
  transforms: VesselTransform[];
}

function buildVessel(
  recipes: readonly CubeRecipe[],
  tables: EnhanceTables,
  ctx: EnhanceContext,
  renderLines: LineRenderer,
  warnings: Set<string>
): VesselResult {
  // The Vessel: input 1 of the conditional rows spending souls (a negative soul-counter mod)
  const spending = recipes.filter(
    (recipe) => recipe.output === 'useitem' && (modOf(recipe, SOUL_COUNTER)?.min ?? 0) < 0 && recipe.op !== 0
  );
  const item = spending.at(0)?.inputs[0]?.cell ?? '';
  const soulParam = spending.at(0)?.param ?? 0;
  const ofVessel = recipes.filter((recipe) => recipe.inputs[0]?.cell === item);
  const startSouls = startSoulsOf(tables.uniqueitems, item);
  if (startSouls === null && item !== '') warnings.add(`enhance: no ${SOUL_COUNTER} property on the "${item}" unique row`);

  // Tier gates: `void` rows "Vessel + any items" while the souls are at least N (the previous tier is not used up)
  const gates = [
    ...new Set(
      ofVessel
        .filter((recipe) => isVoid(recipe) && recipe.op === 15 && recipe.param === soulParam && recipe.inputs.length > 1)
        .filter((recipe) => recipe.inputs.slice(1).every((input) => input.code === 'any'))
        .map((recipe) => recipe.value)
    ),
  ].sort((a, b) => b - a);
  const tierOf = (souls: number) => 1 + gates.filter((gate) => gate > souls).length;

  // Every bonus has an op=15 row (at least N souls) and an op=18 row (exactly N: the tier's last use, which also adds
  // the "tier exhausted" mythicaldesc marker); deduplicated on tier + materials + visible mods + cost
  const byKey = new Map<string, { recipe: VesselRecipe; rows: CubeRecipe[] }>();
  const tierEnds = new Map<number, Set<number>>();
  for (const recipe of ofVessel) {
    const cost = -(modOf(recipe, SOUL_COUNTER)?.min ?? 0);
    if (recipe.param !== soulParam || recipe.output !== 'useitem' || cost <= 0) continue;
    const tier = tierOf(recipe.value);
    if (recipe.op === 18) {
      const ends = tierEnds.get(tier) ?? new Set<number>();
      ends.add(recipe.value - cost);
      tierEnds.set(tier, ends);
    }
    const bonus = renderLines(recipe.mods);
    const key = `${String(tier)}|${materialKey(recipe)}|${JSON.stringify(bonus.mods)}|${String(cost)}`;
    const entry = byKey.get(key);
    if (entry !== undefined) {
      entry.rows.push(recipe);
      continue;
    }
    const anoint = modOf(recipe, ANOINT_DUMMY);
    byKey.set(key, {
      rows: [recipe],
      recipe: {
        tier,
        materials: materialsOf(recipe, ctx),
        soulCost: cost,
        ...bonus,
        ...(anoint === undefined ? {} : { anointmentRolls: anoint.max - anoint.min + 1 }),
      },
    });
  }

  // Caps: a `void` row with a recipe's materials whose condition checks one of the recipe's stats ("str max 2 trap")
  const entries = [...byKey.values()];
  const anointParam = outcomeParam(recipes, ANOINT_DUMMY);
  for (const trap of ofVessel) {
    if (!isVoid(trap) || trap.op === 0 || trap.param === soulParam || trap.inputs.length < 2) continue;
    // The completion transforms' "anointment pending" blockers have the same shape
    if (trap.param === anointParam) continue;
    const key = materialKey(trap);
    const target = entries.find(
      (entry) =>
        entry.rows.some((row) => materialKey(row) === key) && entry.recipe.mods.some((mod) => ctx.statIdsOf(mod.code).includes(trap.param))
    );
    if (target === undefined) {
      warnings.add(`enhance: vessel cap row "${trap.description}" matches no recipe`);
      continue;
    }
    const times = /\bmax (\d+)\b/i.exec(trap.description)?.[1];
    if (times === undefined) warnings.add(`enhance: vessel cap row "${trap.description}" has no "max N" count`);
    else target.recipe.maxTimes = Number(times);
  }

  const tierNumbers = [...new Set(entries.map((entry) => entry.recipe.tier))].sort((a, b) => a - b);
  let souls = startSouls ?? 0;
  const tiers = tierNumbers.map((tier): VesselTier => {
    const ends = [...(tierEnds.get(tier) ?? [])];
    if (ends.length !== 1) warnings.add(`enhance: vessel tier ${String(tier)} ends at ${ends.length === 0 ? 'no' : ends.join('/')} souls`);
    const start = souls;
    souls = ends.at(0) ?? souls;
    return { tier, startSouls: start, endSouls: souls };
  });

  // Completion: at 0 souls the Vessel plus gems turns into a mythical weapon (`m21,mod`)
  const transforms = ofVessel
    .filter(
      (recipe) => recipe.param === soulParam && recipe.op === 18 && recipe.value === 0 && !isVoid(recipe) && recipe.output !== 'useitem'
    )
    .map((recipe): VesselTransform => {
      const output = parseInput(recipe.output);
      return {
        materials: materialsOf(recipe, ctx),
        output: { code: output.code, name: ctx.nameOf(output.code) },
        keepsMods: output.qualifiers.includes('mod'),
      };
    });

  return {
    vessel: { item, startSouls: startSouls ?? 0 },
    soulParam,
    tiers,
    recipes: entries.map((entry) => entry.recipe).sort((a, b) => a.tier - b.tier),
    transforms,
  };
}

export function buildEnhanceBundle(tables: EnhanceTables, ctx: EnhanceContext): EnhanceBuildResult {
  const warnings = new Set<string>();
  const recipes = readCubeRecipes(tables.cubemain).filter((recipe) => recipe.enabled);
  const renderLines = createLineRenderer(ctx.renderMods, warnings);

  const vessel = buildVessel(recipes, tables, ctx, renderLines, warnings);
  const corruption = buildCorruption(recipes, ctx, renderLines, warnings);
  // The Vessel's "cannot be corrupted" blocker: `void` for Vessel + reagent while it has souls
  const reagent = corruption.corruption.reagent.code;
  const blocked = recipes.some(
    (recipe) =>
      isVoid(recipe) &&
      recipe.inputs.length === 2 &&
      recipe.inputs[0]?.cell === vessel.vessel.item &&
      recipe.inputs[1]?.code === reagent &&
      recipe.op === 15 &&
      recipe.param === vessel.soulParam
  );
  if (blocked) corruption.corruption.notes.push(`${vessel.vessel.item} cannot be corrupted while it still has souls.`);
  const anointment = buildAnointment(recipes, ctx, renderLines, vessel.vessel.item, warnings);
  const sanctification = buildSanctification(recipes, ctx, renderLines, warnings);

  return {
    bundle: {
      corruption: corruption.corruption,
      corruptionSlots: corruption.slots,
      corruptionOutcomes: corruption.outcomes,
      anointment: anointment.anointment,
      anointmentSlots: anointment.slots,
      anointmentOutcomes: anointment.outcomes,
      sanctification: sanctification?.sanctification ?? {
        reagent: { code: '', name: '' },
        item: { code: '', name: '' },
        rollRange: 0,
        once: false,
      },
      sanctificationOutcomes: sanctification?.outcomes ?? [],
      sanctificationBonuses: sanctification?.bonuses ?? [],
      vessel: vessel.vessel,
      vesselTiers: vessel.tiers,
      vesselRecipes: vessel.recipes,
      vesselTransforms: vessel.transforms,
    },
    warnings: [...warnings],
  };
}
