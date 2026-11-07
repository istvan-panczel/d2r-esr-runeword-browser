/**
 * The game data part of the LLM prompt package: CSV tables built from the `lootfilter` and `types` bundles, in two
 * sizes. Compact keeps what most filters need at about a third of Full: every item type, every stat (label, param kind,
 * plugin quirk or storage scale), the misc items that drop (runes, gems, charms, jewels, potions, keys, organs,
 * essences, coupons, maps…; stacks of identically named containers collapsed to their type), the weapon and armour
 * bases that drop grouped by item type and tier, uniques merged by name with every id (dropped and Ancient Coupon
 * rows), set items, areas, class skills, skill tabs and classes. Full has every row of every table and every skill.
 * Neither lists the sounds.txt names (they were about half of Full): the prompt says they exist and that the LLM asks
 * the user for an exact name, which the app's sound picker shows.
 */
import { CLASS_CODES, type LootFilterDataBundle, type LootFilterItem, type TypesBundle } from '@/features/game-data/engine/schema';
import { statLayerKind, tabLayer, type StatLayerKind } from '@/features/game-data/engine/statLayers';
import { statQuirk } from '../../engine/statQuirks';
import { statScale, type StatScale } from '../../engine/statScale';

export type GameDataSize = 'compact' | 'full';

/** One reference table: a CSV file in the zip, a section of the single .md. */
export interface GameDataTable {
  /** The file name in the zip (`items.csv`). */
  readonly path: string;
  /** What the file holds, for the prompt's file list. */
  readonly summary: string;
  readonly text: string;
}

// --- CSV ---

type Cell = string | number | boolean | null | undefined;

/** One CSV cell: empty for null/undefined/false, quoted when it holds a comma, quote or line break. */
export function csvCell(value: Cell): string {
  if (value === null || value === undefined || value === false) return '';
  const text = value === true ? 'yes' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** A CSV text (header row first), lines joined with `\n`, ending with a line break. */
export function toCsv(header: readonly string[], rows: readonly (readonly Cell[])[]): string {
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n') + '\n';
}

// --- Stats ---

/** What a layered stat's `param` holds, for the stats table. */
export const PARAM_KIND_TEXT: Readonly<Record<StatLayerKind, string>> = {
  tab: 'skill tab: class × 8 + tab (skill-tabs.csv)',
  class: 'class id 0-7 (classes.csv)',
  skill: 'skill id (skills.csv)',
  event: 'skill id × 64 + skill level',
  charged: 'skill id × 64 + skill level; value = max charges × 256 + charges left',
};

function scaleNote(scale: StatScale): string {
  switch (scale.kind) {
    case 'shift':
      return 'stored ×256 (+40 may read as 10240; not verified): prefer presence checks (>= 1, < 1)';
    case 'perLevel':
      return 'stored in eighths per character level (not verified): prefer presence checks (>= 1, < 1)';
    case 'shiftPerLevel':
      return 'stored in eighths per character level and ×256 (not verified): prefer presence checks (>= 1, < 1)';
  }
}

/** The stats table: id, itemstatcost name, label, what `param` holds and the plugin quirk or storage scale. */
export function statsTable(data: LootFilterDataBundle): GameDataTable {
  const rows = data.stats.map((stat) => {
    const kind = statLayerKind(stat.name);
    const quirk = statQuirk(stat.id);
    const scale = statScale(stat.id);
    const notes = [quirk?.headline, scale === undefined ? undefined : scaleNote(scale)].filter((note) => note !== undefined);
    return [stat.id, stat.name, stat.label, kind === undefined ? undefined : PARAM_KIND_TEXT[kind], notes.join('; ')];
  });
  return {
    path: 'stats.csv',
    summary: 'every itemstatcost.txt stat: id, name (write either in "stat"), label, what "param" holds, plugin limits',
    text: toCsv(['id', 'name', 'label', 'param', 'notes'], rows),
  };
}

// --- Item types ---

export function itemTypesTable(types: TypesBundle): GameDataTable {
  return {
    path: 'item-types.csv',
    summary: 'every itemtypes.txt type: code (for "itemTypes"), name, parent types (a rule on a parent matches its children)',
    text: toCsv(
      ['code', 'name', 'parents'],
      types.types.map((type) => [type.code, type.name, type.parents.join(' ')])
    ),
  };
}

// --- Items ---

/** Item types of more than this many drops that all share one name collapse to one row in Compact. */
const CONTAINER_COLLAPSE_MIN = 5;

/** Full: every weapons/armor/misc row. */
function fullItemsTable(data: LootFilterDataBundle): GameDataTable {
  return {
    path: 'items.csv',
    summary: 'every item code (weapons, armour, misc): code, name, kind, type, second type, base tier, whether it can drop',
    text: toCsv(
      ['code', 'name', 'kind', 'type', 'type2', 'tier', 'drops'],
      data.items.map((item) => [item.code, item.name, item.kind, item.type, item.type2, item.tier, item.drops ? 'yes' : 'no'])
    ),
  };
}

/** Item types whose drops (more than a few) all share one name: stacks of containers, listed by type only. */
function collapsedTypes(items: readonly LootFilterItem[]): Map<string, readonly LootFilterItem[]> {
  const byType = new Map<string, LootFilterItem[]>();
  for (const item of items) byType.set(item.type, [...(byType.get(item.type) ?? []), item]);
  return new Map(
    [...byType].filter(([, list]) => list.length >= CONTAINER_COLLAPSE_MIN && list.every((item) => item.name === list[0]?.name))
  );
}

/** Compact: the misc items that drop, one row each, with identically named container stacks as one row per type. */
function compactMiscTable(data: LootFilterDataBundle): GameDataTable {
  const misc = data.items.filter((item) => item.kind === 'misc' && item.drops);
  const collapsed = collapsedTypes(misc);
  const rows: Cell[][] = [];
  const done = new Set<string>();
  for (const item of misc) {
    const stack = collapsed.get(item.type);
    if (stack === undefined) {
      rows.push([item.code, item.name, item.type, item.type2]);
      continue;
    }
    if (done.has(item.type)) continue;
    done.add(item.type);
    rows.push([
      '',
      `${item.name} ×${String(stack.length)} (one code each, all with this name: match them by item type ${item.type})`,
      item.type,
      '',
    ]);
  }
  return {
    path: 'items.csv',
    summary:
      'the misc items that drop (runes, gems, charms, jewels, potions, keys, organs, essences, coupons, maps, scrolls…): code, name, type, second type',
    text: toCsv(['code', 'name', 'type', 'type2'], rows),
  };
}

const TIER_ORDER = ['normal', 'exceptional', 'elite'] as const;

/**
 * Compact: the weapon and armour bases that drop, one row per item type and base tier ("ssd Short Sword; scm
 * Scimitar"), so a rule can name a type with `baseTier` or pick the codes.
 */
function compactBasesTable(data: LootFilterDataBundle, types: TypesBundle): GameDataTable {
  const typeNames = new Map(types.types.map((type) => [type.code, type.name]));
  const groups = new Map<string, LootFilterItem[]>();
  for (const item of data.items) {
    if (item.kind === 'misc' || !item.drops) continue;
    const key = `${item.type}\u0000${item.tier ?? ''}`;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  const tierRank = (tier: string) => {
    const index = (TIER_ORDER as readonly string[]).indexOf(tier);
    return index === -1 ? TIER_ORDER.length : index;
  };
  const byType = new Map<string, { tier: string; items: LootFilterItem[] }[]>();
  for (const [key, items] of groups) {
    const [type = '', tier = ''] = key.split('\u0000');
    byType.set(type, [...(byType.get(type) ?? []), { tier, items }]);
  }
  const rows = [...byType].flatMap(([type, tiers]) =>
    [...tiers]
      .sort((a, b) => tierRank(a.tier) - tierRank(b.tier))
      .map(({ tier, items }) => [type, typeNames.get(type), tier, items.map((item) => `${item.code} ${item.name}`).join('; ')])
  );
  return {
    path: 'bases.csv',
    summary: 'the weapon and armour bases that drop, by item type and base tier ("tier" empty: no tier family): codes with names',
    text: toCsv(['type', 'typeName', 'tier', 'items'], rows),
  };
}

// --- Uniques and sets ---

function fullUniquesSetsTable(data: LootFilterDataBundle): GameDataTable {
  const itemNames = new Map(data.items.map((item) => [item.code, item.name]));
  const rows: Cell[][] = [
    ...data.uniques.map((entry) => [
      'unique',
      entry.id,
      entry.name,
      entry.code,
      itemNames.get(entry.code),
      entry.reqLvl,
      '',
      [entry.coupon === true ? 'Ancient Coupon row (cubed, never drops)' : '', entry.disabled === true ? 'disabled (never created)' : '']
        .filter((note) => note !== '')
        .join('; '),
    ]),
    ...data.sets.map((entry) => [
      'set',
      entry.id,
      entry.name,
      entry.code,
      itemNames.get(entry.code),
      entry.reqLvl,
      entry.set,
      entry.disabled === true ? 'disabled (never created)' : '',
    ]),
  ];
  return {
    path: 'uniques-sets.csv',
    summary: 'every unique and set item row: kind, id (for "uniqueOrSetIds"), name, base code and name, required level, set, notes',
    text: toCsv(['kind', 'id', 'name', 'baseCode', 'baseName', 'reqLvl', 'set', 'notes'], rows),
  };
}

/** Compact: uniques merged by name (the dropped rows' ids, then the Ancient Coupon rows' ids), then the set items. */
function compactUniquesSetsTable(data: LootFilterDataBundle): GameDataTable {
  const uniques = new Map<string, { ids: number[]; couponIds: number[] }>();
  for (const entry of data.uniques) {
    if (entry.disabled === true) continue;
    const merged = uniques.get(entry.name) ?? { ids: [], couponIds: [] };
    (entry.coupon === true ? merged.couponIds : merged.ids).push(entry.id);
    uniques.set(entry.name, merged);
  }
  const rows: Cell[][] = [
    ...[...uniques].map(([name, { ids, couponIds }]) => [name, ids.join(' '), couponIds.join(' '), '']),
    ...data.sets.filter((entry) => entry.disabled !== true).map((entry) => [entry.name, entry.id, '', entry.set]),
  ];
  return {
    path: 'uniques-sets.csv',
    summary:
      'the uniques by name with every row id (ids: the rows that drop; couponIds: the Ancient Coupon rows, list both), then the set items (the rows with a set name)',
    text: toCsv(['name', 'ids', 'couponIds', 'set'], rows),
  };
}

// --- Areas and skills ---

function areasTable(data: LootFilterDataBundle): GameDataTable {
  return {
    path: 'areas.csv',
    summary: 'every levels.txt area: id (for "areas"), name, act',
    text: toCsv(
      ['id', 'name', 'act'],
      data.areas.map((area) => [area.id, area.name, area.act + 1])
    ),
  };
}

function skillsTable(data: LootFilterDataBundle, size: GameDataSize): GameDataTable {
  const skills = (data.skills ?? []).filter((skill) => size === 'full' || skill.cls !== undefined);
  return {
    path: 'skills.csv',
    summary:
      size === 'full'
        ? 'every skill a stat param can name: id, name, class (empty: an item or monster skill), formulaName (the skills.txt name a formula takes)'
        : 'the class skills: id (the "param" of item_singleskill and the skill part of event and charged params), name, class, formulaName (the skills.txt name a formula takes)',
    text: toCsv(
      ['id', 'name', 'class', 'formulaName'],
      skills.map((skill) => [skill.id, skill.name, skill.cls, data.skillNames?.[skill.id]])
    ),
  };
}

/** The skill tabs (`item_addskill_tab` params, class × 8 + tab) and the classes (`item_addclassskills` params). */
function classesTables(types: TypesBundle): GameDataTable[] {
  const tabRows: Cell[][] = [];
  const classRows: Cell[][] = [];
  CLASS_CODES.forEach((code, classId) => {
    const info = types.classes.find((entry) => entry.code === code);
    classRows.push([classId, code, info?.name]);
    info?.tabs.forEach((tab, index) => {
      tabRows.push([tabLayer(classId, index), info.name, tab]);
    });
  });
  return [
    {
      path: 'skill-tabs.csv',
      summary: 'the skill tabs: param of item_addskill_tab (class × 8 + tab), class, tab',
      text: toCsv(['param', 'class', 'tab'], tabRows),
    },
    {
      path: 'classes.csv',
      summary: 'the classes: param of item_addclassskills (class id), code, name',
      text: toCsv(['param', 'code', 'name'], classRows),
    },
  ];
}

/** The game data tables of one size, in the order the prompt lists them. */
export function gameDataTables(data: LootFilterDataBundle, types: TypesBundle, size: GameDataSize): GameDataTable[] {
  const items = size === 'full' ? [fullItemsTable(data)] : [compactMiscTable(data), compactBasesTable(data, types)];
  return [
    itemTypesTable(types),
    ...items,
    statsTable(data),
    size === 'full' ? fullUniquesSetsTable(data) : compactUniquesSetsTable(data),
    areasTable(data),
    skillsTable(data, size),
    ...classesTables(types),
  ];
}
