import { isClassCode, type Affix, type AffixesBundle, type ClassCode, type TypesBundle } from '../engine/schema.ts';
import { createAffixStatResolver, type StatIndex } from './affixStats.ts';
import type { PropertyLayerResolver } from './bundleLootFilterSkills.ts';
import type { ModsRenderer } from './bundleRunewords.ts';
import type { PropertyDef } from './stats/tables.ts';
import type { AffixRow } from './model.ts';

export interface AffixesBuildResult {
  bundle: AffixesBundle;
  warnings: string[];
  /** Rows with `spawnable != 1` */
  dropped: number;
  /** automagic placeholder rows named "null" without any visible stat (e.g. only `tinkerflag2`) */
  droppedPlaceholders: number;
}

/** What `Affix.stats` resolves through: properties.txt and itemstatcost (by name). */
export interface AffixStatTables {
  properties: ReadonlyMap<string, PropertyDef>;
  stats: StatIndex;
  /** Fills `Affix.layers`; without it no affix has layers */
  layers?: PropertyLayerResolver;
}

/** automagic.txt uses "null" as the name of nameless automods; automods never show a name in game. */
const PLACEHOLDER_NAME = 'null';

/**
 * Builds `affixes.json` from magicprefix (p), magicsuffix (s) and automagic (a) rows, in that order.
 * `id` = 0-based row index within its file (stable across regenerations as long as ESR only appends rows;
 * unique together with `kind`). Names resolve through strings, falling back to the raw `Name`.
 */
export function buildAffixesBundle(
  rows: readonly AffixRow[],
  typesBundle: TypesBundle,
  strings: ReadonlyMap<string, string>,
  renderMods: ModsRenderer,
  statTables: AffixStatTables
): AffixesBuildResult {
  const warnings = new Set<string>();
  const statResolver = createAffixStatResolver(statTables.properties, statTables.stats, strings, statTables.layers);
  const typeCodes = new Set(typesBundle.types.map((type) => type.code));
  const nextId = { p: 0, s: 0, a: 0 };
  const affixes: Affix[] = [];
  let dropped = 0;
  let droppedPlaceholders = 0;

  const classOf = (value: string, column: string, label: string): ClassCode | null => {
    if (value === '') return null;
    if (isClassCode(value)) return value;
    warnings.add(`affixes: ${label} has unknown ${column} "${value}"`);
    return null;
  };

  for (const row of rows) {
    const id = nextId[row.kind]++;
    if (row.spawnable !== 1) {
      dropped++;
      continue;
    }
    const label = `${row.kind}${String(id)} "${row.name}"`;
    const rendered = renderMods(row.mods);
    for (const warning of rendered.warnings) warnings.add(`affixes: ${warning}`);

    const placeholder = row.name.toLowerCase() === PLACEHOLDER_NAME && !strings.has(row.name);
    if (placeholder && rendered.lines.length === 0) {
      droppedPlaceholders++;
      continue;
    }
    for (const code of [...row.itypes, ...row.etypes]) {
      if (!typeCodes.has(code)) warnings.add(`affixes: ${label} references unknown item type "${code}"`);
    }

    const mods = row.mods.map((mod) => ({ prop: mod.code, param: mod.param, min: mod.min, max: mod.max }));
    const layers = statResolver.layersOf(mods);
    affixes.push({
      id,
      kind: row.kind,
      name: placeholder ? '' : (strings.get(row.name)?.trim() ?? row.name),
      lvl: row.level,
      maxLvl: row.maxlevel,
      reqLvl: row.levelreq,
      cls: classOf(row.classspecific, 'classspecific', label),
      reqCls: classOf(row.cls, 'class', label),
      clsReqLvl: row.classlevelreq,
      freq: row.frequency,
      group: row.group,
      rare: row.rare === 1,
      itypes: row.itypes,
      etypes: row.etypes,
      mods,
      stats: statResolver.statsOf(mods),
      ...(layers.length === 0 ? {} : { layers }),
      text: rendered.lines,
    });
  }

  for (const warning of statResolver.warnings()) warnings.add(warning);
  return { bundle: { affixes, stats: statResolver.listed() }, warnings: [...warnings], dropped, droppedPlaceholders };
}
