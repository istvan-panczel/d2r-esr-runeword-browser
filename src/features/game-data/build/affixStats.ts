/**
 * Which itemstatcost stats an affix writes, for the loot filter's affix browser (the plugin matches stats, never affix
 * names). A property resolves through its properties.txt slots; most funcs name their stat in `stat1-7`. The funcs
 * without a stat column, from the engine (the same table `stats/expandProperty.ts` renders with):
 *
 *   func 5  `dmg-min`     → mindamage (21)
 *   func 6  `dmg-max`     → maxdamage (22)
 *   func 7  `dmg%`        → item_maxdamage_percent (17) + item_mindamage_percent (18)
 *   func 20 `indestruct`  → item_indesctructible (152) when stat1 is blank
 *   func 23 `ethereal`    → no stat: ethereal is an item flag (the rule's `ethereal` condition), not a stat
 *
 * Funcs that name their stat: 1/2/8/13 (stat = value), 3 (same value as the previous slot), 10 (skill tab),
 * 11 (skill on event), 12 (random skill), 14 (sockets), 15/16/17 (stat = min / max / param), 19 (charges),
 * 21 (class skills, param = class), 22/24 (stat with a param layer: auras, oskills). Any other func, or one of the
 * stat-less funcs above with a blank stat that is not listed, leaves the property unmapped (one warning per property).
 *
 * `layersOf` adds the params of the layered stats (skill tab, class, skill, event, charged) through the
 * `createPropertyLayerResolver` of build/bundleLootFilterSkills.ts, for `Affix.layers`.
 */
import type { AffixStat, StatParam } from '../engine/schema.ts';
import type { PropertyLayerResolver } from './bundleLootFilterSkills.ts';
import type { PropertyDef } from './stats/tables.ts';
import type { TsvTable } from './tsv.ts';

/** itemstatcost by `Stat` name. */
export type StatIndex = ReadonlyMap<string, { readonly id: number; readonly descstrpos: string }>;

const NAMED_FUNCS = new Set([1, 2, 3, 8, 10, 11, 12, 13, 14, 15, 16, 17, 19, 21, 22, 24]);
const STATLESS_FUNCS: Readonly<Record<number, readonly string[]>> = {
  5: ['mindamage'],
  6: ['maxdamage'],
  7: ['item_maxdamage_percent', 'item_mindamage_percent'],
  20: ['item_indesctructible'],
  23: [],
};

/**
 * ESR technical stats that are not item stats a filter author checks: tinkering markers, the magic jewel flag, the
 * randomize marker, and the `_display` / `_hidden` / `_cap` companions of real stats (the real stat is kept).
 */
export function isTechnicalStat(name: string): boolean {
  return name.includes('tinkerflag') || name === 'item_jewelflag' || name === 'item_randomize' || /_(display|hidden|cap)$/.test(name);
}

/** The stat names a property writes, in slot order (duplicates removed); null when a slot cannot be mapped. */
export function propertyStats(def: PropertyDef): string[] | null {
  const names: string[] = [];
  for (const slot of def.slots) {
    if (slot.stat !== '' && (NAMED_FUNCS.has(slot.func) || slot.func === 20)) {
      names.push(slot.stat);
      continue;
    }
    const fixed = slot.stat === '' ? STATLESS_FUNCS[slot.func] : undefined;
    if (fixed === undefined) return null;
    names.push(...fixed);
  }
  return [...new Set(names)];
}

/**
 * itemstatcost `Stat` → id and `descstrpos`. The id is the row number (= `*ID`, a comment column the parser drops), so
 * the table must be parsed with its Expansion rows kept, as for lootfilter.json.
 */
export function readStatIndex(itemstatcost: TsvTable): Map<string, { id: number; descstrpos: string }> {
  const result = new Map<string, { id: number; descstrpos: string }>();
  itemstatcost.rows.forEach((row, id) => {
    const stat = row.str('Stat');
    if (stat === '' || result.has(stat)) return;
    result.set(stat, { id, descstrpos: row.str('descstrpos') });
  });
  return result;
}

/**
 * A short label from a description string: "+%d%% Enhanced Damage" → "Enhanced Damage", "%+d to Strength" →
 * "Strength", "Damage Reduced by %d" → "Damage Reduced". Drops format tokens (`%d`, `%+d`, `%s`, `%%`, …), colour
 * codes, `+` signs, a leading "to", a trailing "by" / "of", the "Level" of "Chance to Cast Level …" and edge
 * punctuation. '' when nothing is left.
 */
export function labelFromDescription(text: string): string {
  return text
    .replace(/ÿc./g, '')
    .replace(/%%/g, ' ')
    .replace(/%[+-]?\d*[a-zA-Z]/g, ' ')
    .replace(/[+%]/g, ' ')
    .replace(/\\n|\n/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s:,.()-]+|[\s:,.(-]+$/g, '')
    .replace(/^to\s+/i, '')
    .replace(/\s+(by|of)$/i, '')
    .replace(/\b(cast) level\b/i, '$1')
    .trim();
}

/**
 * Stats whose description is per class or format only ("%+d to %s", "to Amazon Skill Levels"), or that have none
 * but a plain meaning.
 */
const STAT_LABELS: Readonly<Record<string, string>> = {
  item_addclassskills: 'Class Skill Levels',
  item_addskill_tab: 'Skill Tab Levels',
  item_nonclassskill: 'Non-Class Skill',
  item_singleskill: 'Single Class Skill',
  item_aura: 'Aura When Equipped',
  item_charged_skill: 'Charged Skill',
  item_numsockets: 'Sockets',
  coldlength: 'Cold Length',
  poisonlength: 'Poison Length',
  bleedlength: 'Bleed Length',
};

/**
 * The label of a stat: an override, else its `descstrpos` string, else the stat name; per-level stats get
 * " (per level)" ("Defense (per level)" next to "Defense").
 */
export function statLabel(name: string, index: StatIndex, strings: ReadonlyMap<string, string>): string {
  const key = index.get(name)?.descstrpos ?? '';
  const base = STAT_LABELS[name] ?? (key === '' ? '' : labelFromDescription(strings.get(key) ?? ''));
  if (base === '') return name;
  return name.includes('perlevel') ? `${base} (per level)` : base;
}

/** Two stats with one label ("Fire Absorb"): the `_percent` one gets " %". */
function disambiguate(stats: readonly AffixStat[]): AffixStat[] {
  const counts = new Map<string, number>();
  for (const stat of stats) counts.set(stat.label, (counts.get(stat.label) ?? 0) + 1);
  return stats.map((stat) =>
    (counts.get(stat.label) ?? 0) > 1 && stat.name.endsWith('_percent') ? { ...stat, label: `${stat.label} %` } : stat
  );
}

export interface AffixStatResolver {
  /** The distinct non-technical stat ids the mods write, ascending. */
  statsOf(mods: readonly { readonly prop: string }[]): number[];
  /** The params of the layered stats among `statsOf(mods)`, by stat then param (none without a layer resolver). */
  layersOf(mods: readonly AffixLayerMod[]): StatParam[];
  /** Every stat `statsOf` returned so far, by id. */
  listed(): AffixStat[];
  warnings(): string[];
}

/** Distinct params, by stat then param */
function sortedLayers(layers: readonly StatParam[]): StatParam[] {
  const seen = new Set<string>();
  return layers
    .filter((layer) => {
      const key = `${String(layer.stat)}:${String(layer.param)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.stat - b.stat || a.param - b.param);
}

export interface AffixLayerMod {
  readonly prop: string;
  readonly param: string | null;
  readonly min: number;
  readonly max: number;
}

export function createAffixStatResolver(
  properties: ReadonlyMap<string, PropertyDef>,
  index: StatIndex,
  strings: ReadonlyMap<string, string>,
  layers?: PropertyLayerResolver
): AffixStatResolver {
  const warnings = new Set<string>();
  const byProp = new Map<string, number[]>();
  const seen = new Map<number, AffixStat>();

  const resolveProp = (prop: string): number[] => {
    const cached = byProp.get(prop);
    if (cached !== undefined) return cached;
    const def = properties.get(prop);
    const names = def === undefined ? null : propertyStats(def);
    const ids: number[] = [];
    if (names === null) {
      warnings.add(`affix stats: property "${prop}" is not mapped to item stats`);
    } else {
      for (const name of names) {
        if (isTechnicalStat(name)) continue;
        const entry = index.get(name);
        if (entry === undefined) {
          warnings.add(`affix stats: property "${prop}" writes unknown stat "${name}"`);
          continue;
        }
        ids.push(entry.id);
        if (!seen.has(entry.id)) seen.set(entry.id, { id: entry.id, name, label: statLabel(name, index, strings) });
      }
    }
    byProp.set(prop, ids);
    return ids;
  };

  const statsOf = (mods: readonly { readonly prop: string }[]) =>
    [...new Set(mods.flatMap((mod) => resolveProp(mod.prop)))].sort((a, b) => a - b);
  const layersOf = (mods: readonly AffixLayerMod[]): StatParam[] => {
    if (layers === undefined) return [];
    const ids = new Set(statsOf(mods));
    const params = mods.flatMap((mod) => layers({ code: mod.prop, param: mod.param, min: mod.min, max: mod.max }).layers);
    return sortedLayers(params.filter((layer) => ids.has(layer.stat)));
  };

  return {
    statsOf,
    layersOf,
    listed: () => disambiguate([...seen.values()].sort((a, b) => a.id - b.id)),
    warnings: () => [...warnings],
  };
}
