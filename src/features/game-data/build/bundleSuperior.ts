/**
 * The superior affix rows of bases.json (`BasesBundle.superior`): qualityitems.txt with the weights of ESR's D2RLoader
 * plugin config `d2rloader/config/celestialrayone.superior-affixes.toml`, and the pools of rows the bases roll. The
 * eligibility rules live in engine/superiorAffixes.ts (the pages compute a base's rows with the same code).
 */
import {
  SUPERIOR_COLUMNS,
  type BaseItem,
  type ItemTypeInfo,
  type SuperiorAffixes,
  type SuperiorPool,
  type SuperiorRow,
} from '../engine/schema.ts';
import { superiorRollsForBase } from '../engine/superiorAffixes.ts';
import type { ModsRenderer } from './bundleRunewords.ts';
import { optStr, type PropertyMod } from './model.ts';
import { parseToml } from './toml.ts';
import type { TsvTable } from './tsv.ts';

/** The plugin's weight range (`row = weight, 0 to 65535`) */
const MAX_WEIGHT = 65535;
/** Weight of every row when the plugin is off or missing: the stock picker gives every allowed row the same odds */
const STOCK_WEIGHT = 100;

const SECTION = 'superior_affixes';
const WEIGHTS_SECTION = `${SECTION}.weights`;

export interface SuperiorConfig {
  enabled: boolean;
  defaultWeight: number;
  firstFourRows: boolean;
  /** Row → weight, as listed */
  weights: Map<number, number>;
}

/** Reads the plugin config; null config = the plugin is not shipped (stock rules). */
export function readSuperiorConfig(text: string | null, warnings: string[]): SuperiorConfig {
  const stock: SuperiorConfig = { enabled: false, defaultWeight: STOCK_WEIGHT, firstFourRows: true, weights: new Map() };
  if (text === null) {
    warnings.push('superior: celestialrayone.superior-affixes.toml not found; stock rules (equal odds, rows 0-3 for throwing items)');
    return stock;
  }
  const { entries, errors } = parseToml(text);
  for (const error of errors) warnings.push(`superior: superior-affixes.toml ${error}`);
  const value = (key: string) => entries.get(`${SECTION}.${key}`)?.value;
  const enabled = value('enabled');
  const defaultWeight = value('default_weight');
  const firstFourRows = value('first_four_rows_for_throwing_and_nodurability');
  const config: SuperiorConfig = {
    enabled: enabled !== false,
    defaultWeight: typeof defaultWeight === 'number' ? defaultWeight : STOCK_WEIGHT,
    firstFourRows: firstFourRows !== false,
    weights: new Map(),
  };
  if (typeof defaultWeight !== 'number')
    warnings.push(`superior: superior-affixes.toml has no default_weight; ${String(STOCK_WEIGHT)} assumed`);
  for (const [path, entry] of entries) {
    if (!path.startsWith(`${WEIGHTS_SECTION}.`)) continue;
    const key = path.slice(WEIGHTS_SECTION.length + 1);
    const row = /^\d+$/.test(key) ? Number(key) : NaN;
    const weight = entry.value;
    if (Number.isNaN(row) || typeof weight !== 'number' || !Number.isInteger(weight) || weight < 0 || weight > MAX_WEIGHT) {
      warnings.push(
        `superior: superior-affixes.toml line ${String(entry.line)}: "${key} = ${String(weight)}" is not a row = 0-65535 weight`
      );
      continue;
    }
    config.weights.set(row, weight);
  }
  if (!config.enabled) return { ...stock, enabled: false };
  return config;
}

/** One qualityitems.txt row as the bundle stores it, without the rendered text and weight. */
function readRow(table: TsvTable, index: number): Omit<SuperiorRow, 'weight' | 'text'> & { renderMods: PropertyMod[] } {
  const row = table.rows[index];
  const mod = (n: 1 | 2): PropertyMod | null => {
    const code = row.str(`mod${String(n)}code`);
    if (code === '') return null;
    const param = row.str(`mod${String(n)}param`);
    return { code, param: param === '' ? null : param, min: row.num(`mod${String(n)}min`), max: row.num(`mod${String(n)}max`) };
  };
  const mod1 = mod(1);
  // mod2 is applied only when mod1code is filled in
  const mod2 = mod1 === null ? null : mod(2);
  const renderMods = [mod1, mod2].filter((entry) => entry !== null);
  const codes = (prefix: string, n: number) =>
    Array.from({ length: n }, (_, i) => optStr(row, `${prefix}${String(i + 1)}`)).filter((code) => code !== '');
  return {
    row: index,
    mods: renderMods.map((entry) => ({ prop: entry.code, param: entry.param, min: entry.min, max: entry.max })),
    renderMods,
    columns: SUPERIOR_COLUMNS.filter((column) => row.has(column) && row.num(column) === 1),
    itypes: codes('itype', 7),
    etypes: codes('etype', 5),
  };
}

/**
 * A pool's label: the deepest item type every pool type descends from (own types; Equiv ancestors), with
 * " (other types)" when bases of other pools descend from it too ("Weapon (other types)" next to "Wand").
 */
function poolLabel(pool: SuperiorPool, others: readonly SuperiorPool[], typeByCode: ReadonlyMap<string, ItemTypeInfo>): string {
  const ancestorsOf = (code: string) => typeByCode.get(code)?.ancestors ?? [code];
  const [first, ...rest] = pool.types;
  const common = ancestorsOf(first).filter((code) => rest.every((type) => ancestorsOf(type).includes(code)));
  const deepest = common.reduce<string | null>((best, code) => {
    if (best === null) return code;
    return ancestorsOf(code).length > ancestorsOf(best).length ? code : best;
  }, null);
  if (deepest === null) return pool.types.map((code) => typeByCode.get(code)?.name ?? code).join(', ');
  const name = typeByCode.get(deepest)?.name ?? deepest;
  const shared = others.some((other) => other !== pool && other.types.some((type) => ancestorsOf(type).includes(deepest)));
  return shared ? `${name} (other types)` : name;
}

export interface SuperiorBuildInput {
  qualityitems: TsvTable;
  /** Raw celestialrayone.superior-affixes.toml; null when the clone has none */
  config: string | null;
  /** bases.json bases (only weapons and armor roll Superior) */
  bases: readonly BaseItem[];
  types: readonly ItemTypeInfo[];
  /** Own types with itemtypes.txt `Throwable = 1` (the stock rows 0-3 rule) */
  throwableTypes: ReadonlySet<string>;
  renderMods: ModsRenderer;
}

export function buildSuperiorAffixes(input: SuperiorBuildInput): { superior: SuperiorAffixes; warnings: string[] } {
  const warnings: string[] = [];
  const config = readSuperiorConfig(input.config, warnings);
  const typeByCode = new Map(input.types.map((type) => [type.code, type]));

  const rows: SuperiorRow[] = input.qualityitems.rows.map((_, index) => {
    const { renderMods, ...row } = readRow(input.qualityitems, index);
    const rendered = input.renderMods(renderMods);
    for (const warning of rendered.warnings) warnings.push(`superior: row ${String(index)}: ${warning}`);
    for (const code of [...row.itypes, ...row.etypes]) {
      if (!typeByCode.has(code))
        warnings.push(`superior: row ${String(index)} names unknown item type "${code}" (the plugin ignores the columns)`);
    }
    const weight = config.enabled ? (config.weights.get(index) ?? config.defaultWeight) : STOCK_WEIGHT;
    const { row: rowIndex, mods, columns, itypes, etypes } = row;
    return { row: rowIndex, weight, mods, text: rendered.lines, columns, itypes, etypes };
  });
  const orphans = [...config.weights.keys()].filter((row) => row >= rows.length).sort((a, b) => a - b);
  if (orphans.length > 0) {
    warnings.push(
      `superior: superior-affixes.toml has weights for rows ${orphans.join(', ')}; qualityitems.txt has ${String(rows.length)} rows (0-${String(rows.length - 1)})`
    );
  }

  const gear = input.bases.filter((base) => base.kind !== 'misc');
  const firstFourRowBases = config.firstFourRows
    ? gear.filter((base) => base.indestructible || input.throwableTypes.has(base.type)).map((base) => base.code)
    : [];
  const superior: SuperiorAffixes = {
    enabled: config.enabled,
    defaultWeight: config.defaultWeight,
    ...(firstFourRowBases.length > 0 && { firstFourRowBases }),
    rows,
    pools: [],
  };

  const pools = new Map<string, SuperiorPool>();
  for (const base of gear) {
    const { rolls, total } = superiorRollsForBase(superior, base);
    if (rolls.length === 0) continue;
    const key = rolls.map((roll) => roll.row.row).join(',');
    const pool = pools.get(key) ?? { label: '', types: [], bases: 0, rows: rolls.map((roll) => roll.row.row), total };
    pools.set(key, pool);
    pool.bases++;
    if (!pool.types.includes(base.type)) pool.types.push(base.type);
  }
  const list = [...pools.values()];
  const seen = new Map<string, number>();
  for (const pool of list) {
    const label = poolLabel(pool, list, typeByCode);
    const count = (seen.get(label) ?? 0) + 1;
    seen.set(label, count);
    pool.label = count === 1 ? label : `${label} #${String(count)}`;
  }

  const used = new Set(list.flatMap((pool) => pool.rows));
  for (const row of rows) {
    if (!used.has(row.row))
      warnings.push(`superior: row ${String(row.row)} (${row.mods.map((mod) => mod.prop).join(' + ') || 'no mods'}) rolls on no base`);
  }
  return { superior: { ...superior, pools: list }, warnings };
}
