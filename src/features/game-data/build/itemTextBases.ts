/**
 * The itemtext.json parts for the tooltip's base lines and socket bonuses (build/bundleItemText.ts):
 *
 * - `bases`: per item code the weapons.txt damage (one-hand / two-hand / throw, as the tooltip shows them), the
 *   strength / dexterity / level requirements and the gem apply type (`gemapplytype`: which gems.txt column a socketed
 *   gem or rune gives: 0 weapon, 1 helm, 2 shield; ESR sets it per item, e.g. body armor 2, boots 1, wands 1)
 * - `socketables`: per gems.txt code (gems, runes and the other socket fillers) the stats of its three columns, in the
 *   form a save stores them (`[stat id, param, value]`: event skills `skill << 6 | level`, tabs `class << 3 | tab`), so
 *   the browser renders and sums them like the saved stats of a jewel
 * - `levels`: the required levels of uniques / set items (`lvl req`) and of the magic affixes (`levelreq`) by the ids a
 *   save stores
 */
import type { ItemTextBase, ItemTextBundle, ItemTextSavedStat } from '../engine/schema.ts';
import { skillTabLayer, statLayerKind } from '../engine/statLayers.ts';
import { expandProperty, type ExpandContext, type ModInput } from './stats/expandProperty.ts';
import { resolveGroups } from './stats/propertyGroups.ts';
import type { PropertyGroupDef } from './stats/tables.ts';
import type { TsvRow, TsvTable } from './tsv.ts';

export interface ItemTextBasesInput {
  /** Throw damage only for codes whose type chain is `Throwable` (ESR fills maxmisdam on wands, orbs, claws …) */
  itemtypes: TsvTable;
  weapons: TsvTable;
  armor: TsvTable;
  misc: TsvTable;
  gems: TsvTable;
  /** Parsed with `keepExpansionRows`: the row number is the id a save stores */
  uniqueitems: TsvTable;
  setitems: TsvTable;
  magicprefix: TsvTable;
  magicsuffix: TsvTable;
  automagic: TsvTable;
  /** itemstatcost `Stat` → id (row number) */
  statIds: ReadonlyMap<string, number>;
  expand: ExpandContext;
  /** propertygroups.txt: ESR's gem columns name groups (`chipped-amethyst-weap` = gem-master + att 30) */
  groups: ReadonlyMap<string, PropertyGroupDef>;
}

export type ItemTextBasesResult = Pick<ItemTextBundle, 'bases' | 'socketables' | 'levels'> & { warnings: string[] };

const GEM_COLUMNS = ['weapon', 'helm', 'shield'] as const;
const GEM_MODS = [1, 2, 3];

function range(row: TsvRow, min: string, max: string): [number, number] | undefined {
  const lo = row.num(min);
  const hi = row.num(max);
  return lo > 0 || hi > 0 ? [lo, hi] : undefined;
}

/** The item type codes that are throwable themselves or through an Equiv ancestor (itemtypes.txt `Throwable`) */
export function throwableTypes(itemtypes: TsvTable): Set<string> {
  const rows = new Map(itemtypes.rows.map((row) => [row.str('Code'), row]));
  const memo = new Map<string, boolean>();
  const throwable = (code: string, seen: ReadonlySet<string>): boolean => {
    const known = memo.get(code);
    if (known !== undefined) return known;
    const row = rows.get(code);
    if (row === undefined || seen.has(code)) return false;
    const next = new Set([...seen, code]);
    const result =
      (row.has('Throwable') && row.num('Throwable') === 1) ||
      [row.str('Equiv1'), row.str('Equiv2')].some((parent) => parent !== '' && throwable(parent, next));
    memo.set(code, result);
    return result;
  };
  return new Set([...rows.keys()].filter((code) => code !== '' && throwable(code, new Set())));
}

function baseOf(row: TsvRow, kind: 'weapon' | 'armor' | 'misc', throwable: ReadonlySet<string>): ItemTextBase {
  const base: ItemTextBase = {};
  if (kind === 'weapon') {
    const twoHanded = row.num('2handed') === 1;
    const either = row.num('1or2handed') === 1;
    const one = range(row, 'mindam', 'maxdam');
    const two = range(row, '2handmindam', '2handmaxdam');
    const thrown = range(row, 'minmisdam', 'maxmisdam');
    if (one !== undefined && (!twoHanded || either)) base.d1 = one;
    if (two !== undefined && (twoHanded || either)) base.d2 = two;
    const types = [row.str('type'), row.has('type2') ? row.str('type2') : ''];
    if (thrown !== undefined && types.some((type) => throwable.has(type))) base.dt = thrown;
  }
  if (row.has('reqstr') && row.num('reqstr') > 0) base.str = row.num('reqstr');
  if (row.has('reqdex') && row.num('reqdex') > 0) base.dex = row.num('reqdex');
  if (row.has('levelreq') && row.num('levelreq') > 0) base.lvl = row.num('levelreq');
  if (row.has('gemapplytype') && row.num('gemapplytype') > 0) base.gem = row.num('gemapplytype');
  return base;
}

/**
 * One property (`code`, `param`, `min`, `max`) → the stats a save would store for it (`[stat id, param, value]`, the
 * layered params encoded as a save stores them; a roll range keeps the max). Problems go to `warn` as "<where>: …".
 * Also used by the character sheet bundle (bundleCharSheet.ts) for the set bonuses.
 */
export function savedStatsReader(
  statIds: ReadonlyMap<string, number>,
  expand: ExpandContext,
  warn: (warning: string) => void
): (code: string, param: string, min: number, max: number, where: string) => ItemTextSavedStat[] {
  const skillId = (param: string, where: string): number | null => {
    const id = expand.skills.skillId(param);
    if (id === null) warn(`${where}: unknown skill "${param}"`);
    return id;
  };
  return (code, param, min, max, where) => {
    const { entries, warnings: expandWarnings } = expandProperty({ code, param: param === '' ? null : param, min, max }, expand);
    for (const warning of expandWarnings) warn(`${where}: ${warning}`);
    return entries.flatMap((entry): ItemTextSavedStat[] => {
      if (entry.text !== undefined) {
        warn(`${where}: "${code}" is not a saved stat ("${entry.text}"), left out`);
        return [];
      }
      const id = statIds.get(entry.stat);
      if (id === undefined) {
        warn(`${where}: unknown stat "${entry.stat}"`);
        return [];
      }
      switch (statLayerKind(entry.stat)) {
        case 'event': {
          const skill = skillId(entry.param, where);
          return skill === null ? [] : [[id, (skill << 6) | entry.max, entry.min]];
        }
        case 'charged': {
          const skill = skillId(entry.param, where);
          return skill === null ? [] : [[id, (skill << 6) | entry.max, (entry.min << 8) | entry.min]];
        }
        case 'tab':
          return [[id, skillTabLayer(Number(entry.param)) ?? 0, entry.max]];
        case 'skill': {
          const skill = skillId(entry.param, where);
          return skill === null ? [] : [[id, skill, entry.max]];
        }
        default:
          if (entry.min !== entry.max) warn(`${where}: "${code}" rolls ${String(entry.min)}-${String(entry.max)}, kept the max`);
          return [[id, /^\d+$/.test(entry.param) ? Number(entry.param) : 0, entry.max]];
      }
    });
  };
}

export function buildItemTextBases(input: ItemTextBasesInput): ItemTextBasesResult {
  const warnings = new Set<string>();

  const throwable = throwableTypes(input.itemtypes);
  const bases: Record<string, ItemTextBase> = {};
  for (const [table, kind] of [
    [input.weapons, 'weapon'],
    [input.armor, 'armor'],
    [input.misc, 'misc'],
  ] as const) {
    for (const row of table.rows) {
      const code = row.str('code');
      if (code === '' || code in bases) continue;
      const base = baseOf(row, kind, throwable);
      if (Object.keys(base).length > 0) bases[code] = base;
    }
  }

  const savedStats = savedStatsReader(input.statIds, input.expand, (warning) => warnings.add(`itemtext: ${warning}`));

  const socketables: ItemTextBundle['socketables'] = {};
  for (const row of input.gems.rows) {
    const code = row.str('code');
    if (code === '') continue;
    const [weapon, helm, shield] = GEM_COLUMNS.map((column) => {
      const where = `gems ${code} ${column}`;
      const mods: ModInput[] = GEM_MODS.flatMap((i) => {
        const mod = row.str(`${column}Mod${String(i)}Code`);
        if (mod === '') return [];
        const at = (part: string) => row.num(`${column}Mod${String(i)}${part}`);
        const param = row.str(`${column}Mod${String(i)}Param`);
        return [{ code: mod, param: param === '' ? null : param, min: at('Min'), max: at('Max') }];
      });
      const resolved = resolveGroups(mods, input.groups);
      for (const warning of resolved.warnings) warnings.add(`itemtext: ${where}: ${warning}`);
      if (resolved.pools.length > 0) warnings.add(`itemtext: ${where}: a random pool is left out (a save stores no roll for it)`);
      return resolved.mods.flatMap((mod) => savedStats(mod.code, mod.param ?? '', mod.min, mod.max, where));
    });
    socketables[code] = [weapon, helm, shield];
  }

  const column = (table: TsvTable, name: string, offset: number) => {
    const values = table.rows.map((row) => (row.has(name) ? row.num(name) : 0));
    return offset === 0 ? values : [0, ...values];
  };
  return {
    bases,
    socketables,
    levels: {
      uniques: column(input.uniqueitems, 'lvl req', 0),
      setItems: column(input.setitems, 'lvl req', 0),
      magicPrefixes: column(input.magicprefix, 'levelreq', 1),
      magicSuffixes: column(input.magicsuffix, 'levelreq', 1),
      autoAffixes: column(input.automagic, 'levelreq', 1),
    },
    warnings: [...warnings],
  };
}
