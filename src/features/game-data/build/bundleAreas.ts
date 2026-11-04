/**
 * areas.json: the areas of levels.txt with their expansion monster level, density and unique packs per difficulty,
 * waypoint, endgame map tier, boss and map item, terrain, teleport and quest gate, and connections (Vis0–Vis7 links
 * both rows list). See docs/features/GAME-DATA.md "Areas".
 *
 * Left out: the null row (Id 0), the Expansion marker (dropped by the parser), the map entrances (`Name` contains
 * "Prep Zone", or a tier map row without monsters) and the levels ESR removed (REMOVED_LEVELS). Towns stay (they have
 * waypoints) with no monster level.
 */
import type { Area, AreasBundle, AreaTerrain, PerDifficulty } from '../engine/schema.ts';
import type { BuildResult } from './bundleTypes.ts';
import { resolveName } from './itemNames.ts';
import { parseTsv, type TsvRow } from './tsv.ts';

/** "Tier 3 Map - Twisted Maze" → tier 3, rest "Twisted Maze" */
const TIER_PREFIX = /^Tier (\d+) Map - (.*)$/;
const UNIQUE_MAP_PREFIX = /^Unique Map - (.*)$/;
const ACT_PREFIX = /^Act \d+ - /;
const PREP_ZONE = 'Prep Zone';
/** `Waypoint` of an area without one */
const NO_WAYPOINT = 255;
/** The comment column naming the boss of a map boss arena (the parser drops `*` columns, so it is read from the raw text) */
const MAP_BOSS_COLUMN = '*Map Boss';
/** Comment column: 1 for an indoor level (splits the outdoor level types from the Forgotten Tower and the temples) */
const INSIDE_COLUMN = '*IsInside';
/** cubemain output of an endgame map item: a red portal to levels.txt `lvl` (the map's prep zone, or the map itself) */
const RED_PORTAL_OUTPUT = /^Red Portal,(?:[^,]*,)*lvl=(\d+)(?:,|$)/;
const ENDGAME_ZONE_SUFFIX = ' (Endgame Zone)';
const DIFFICULTY_SUFFIXES = ['', '(N)', '(H)'] as const;

/**
 * Levels ESR removed but kept in levels.txt: no row links to them and the next row took over their name (31 is the
 * in-game "Jail Level 2", 37 "Catacombs Level 3"). The official Maps page lists neither (Jail and Catacombs have
 * three levels). The build warns when one gains an incoming Vis link or its row disappears.
 */
export const REMOVED_LEVELS: readonly number[] = [30, 36];

/**
 * Vis links only one of the two rows lists (`from` → `to`), dropped as expected: ESR copied these rows from others
 * (Matron's Den from Pandemonium Run 1, Crypt of Damnation from a map row with the Necropolis entrance). Any other
 * one-way link is dropped with a warning.
 */
export const EXPECTED_ONE_WAY_VIS: readonly (readonly [from: number, to: number])[] = [
  [133, 17],
  [143, 144],
];

/**
 * levels.txt `LevelType` (the vanilla lvltypes.txt ids) → terrain outside / inside (`*IsInside` 1). Outdoor types
 * are split: the Forgotten Tower is type 2 inside, the Kurast temples and the Durance type 22 inside, the Dimensional
 * Gate type 31 inside.
 */
const TERRAIN_BY_LEVEL_TYPE: ReadonlyMap<number, readonly [outside: AreaTerrain, inside: AreaTerrain]> = new Map(
  (
    [
      ['town', [1, 12, 20, 26, 29]],
      ['outdoor', [5, 6, 11, 16, 21, 27, 28, 30, 35]],
      ['cave', [3, 18, 23, 33]],
      ['tomb', [4, 10, 17]],
      ['dungeon', [7, 8, 13, 14, 15, 24, 25]],
      ['temple', [9, 32, 34]],
      ['special', [19]],
    ] as const
  )
    .flatMap(([terrain, types]) => types.map((type): [number, readonly [AreaTerrain, AreaTerrain]] => [type, [terrain, terrain]]))
    .concat([
      [2, ['outdoor', 'tower']],
      [22, ['outdoor', 'temple']],
      [31, ['outdoor', 'temple']],
    ])
);

/** The terrain of a level type; null for a type the table lacks */
export function levelTerrain(levelType: number, inside: boolean): AreaTerrain | null {
  const terrain = TERRAIN_BY_LEVEL_TYPE.get(levelType);
  return terrain === undefined ? null : terrain[inside ? 1 : 0];
}
const MONSTER_COLUMN_COUNT = 25;

/** Fixed monster level of the endgame maps per tier: 100, 102, 104, 106, 108 */
export const mapTierLevel = (tier: number) => 100 + 2 * (tier - 1);

export interface AreasInput {
  /** Raw levels.txt (the `*Map Boss` and `*IsInside` comment columns are read from it too) */
  levelsText: string;
  /** Raw cubemain.txt (the endgame map items' red portals) */
  cubemainText: string;
  strings: ReadonlyMap<string, string>;
}

export interface AreasBuildResult extends BuildResult<AreasBundle> {
  /** Rows left out: map entrances (prep zones), removed levels (REMOVED_LEVELS) and the null row */
  hidden: { prepZones: number; removed: number; other: number };
  /** Vis links dropped because the target row does not list the source (expected ones included) */
  oneWayVis: number;
  /** Rows whose unique packs were re-read mins-then-maxes (rows with an inverted pair) */
  uniquesMinsThenMaxes: number;
}

type UniquePacks = PerDifficulty<[number, number]>;
const inverted = (packs: UniquePacks) => packs.some(([min, max]) => min > max);

/**
 * The six MonUMin / MonUMax values. The header pairs them per difficulty (`MonUMin, MonUMax, MonUMin(N), …`) and the
 * ESR map rows follow it (30 40 30 40 30 40), but 61 older rows have an inverted Nightmare pair (2 4 6 5 8 10); those
 * values are ESR's own, not vanilla, and read as mins 2/4/6, maxes 5/8/10 they become consistent. Read pairwise; when
 * a pair is inverted, re-read the row mins then maxes; when that is inverted too, keep the pairwise values (`ok` false: the caller warns).
 */
export function readUniquePacks(values: readonly [number, number, number, number, number, number]): {
  packs: UniquePacks;
  minsThenMaxes: boolean;
  ok: boolean;
} {
  const [a, b, c, d, e, f] = values;
  const pairwise: UniquePacks = [
    [a, b],
    [c, d],
    [e, f],
  ];
  if (!inverted(pairwise)) return { packs: pairwise, minsThenMaxes: false, ok: true };
  const minsThenMaxes: UniquePacks = [
    [a, d],
    [b, e],
    [c, f],
  ];
  if (!inverted(minsThenMaxes)) return { packs: minsThenMaxes, minsThenMaxes: true, ok: true };
  return { packs: pairwise, minsThenMaxes: false, ok: false };
}

/** Values of a comment column by 1-based line number (TsvRow.line); null when the header has no such column */
function commentColumn(text: string, column: string): Map<number, string> | null {
  const lines = text.split(/\r?\n/);
  const index = (lines[0] ?? '').split('\t').findIndex((name) => name.trim() === column);
  if (index < 0) return null;
  const values = new Map<number, string>();
  lines.forEach((line, i) => {
    const value = line.split('\t')[index]?.trim() ?? '';
    if (i > 0 && value !== '') values.set(i + 1, value);
  });
  return values;
}

const perDifficulty = <T>(read: (suffix: string) => T): PerDifficulty<T> => [
  read(DIFFICULTY_SUFFIXES[0]),
  read(DIFFICULTY_SUFFIXES[1]),
  read(DIFFICULTY_SUFFIXES[2]),
];

function hasMonsterColumns(row: TsvRow): boolean {
  return ['mon', 'nmon', 'umon'].some((prefix) =>
    Array.from({ length: MONSTER_COLUMN_COUNT }, (_, i) => `${prefix}${String(i + 1)}`).some(
      (column) => row.has(column) && row.str(column) !== ''
    )
  );
}

/** Item code → the levels.txt id its red portal opens (enabled cubemain rows with a `Red Portal,lvl=` output) */
function readMapPortals(cubemainText: string): [code: string, level: number][] {
  const unquote = (text: string) => text.replace(/^"|"$/g, '');
  return parseTsv(cubemainText, 'cubemain.txt').rows.flatMap((row): [string, number][] => {
    if (row.num('enabled') !== 1) return [];
    const match = RED_PORTAL_OUTPUT.exec(unquote(row.str('output')));
    const code = unquote(row.str('input 1')).split(',')[0]?.trim() ?? '';
    return match === null || code === '' ? [] : [[code, Number(match[1])]];
  });
}

/** Vis0–Vis7 of a row: the linked level ids, without 0, the row itself and repeats (in column order) */
function visTargets(row: TsvRow): number[] {
  const targets: number[] = [];
  for (let i = 0; i < 8; i++) {
    const target = row.num(`Vis${String(i)}`);
    if (target !== 0 && target !== row.num('Id') && !targets.includes(target)) targets.push(target);
  }
  return targets;
}

export function buildAreasBundle({ levelsText, cubemainText, strings }: AreasInput): AreasBuildResult {
  const warnings: string[] = [];
  const table = parseTsv(levelsText, 'levels.txt');
  const column = (name: string) => {
    const values = commentColumn(levelsText, name);
    // Without it every map boss would be gone and every outdoor-type level outdoor, silently
    if (values === null) warnings.push(`areas: levels.txt has no ${name} column; read as empty`);
    return values ?? new Map<number, string>();
  };
  const bosses = column(MAP_BOSS_COLUMN);
  const inside = column(INSIDE_COLUMN);
  const rows = table.rows.filter((row) => row.str('Id') !== '');
  const hidden = { prepZones: 0, removed: 0, other: 0 };
  let uniquesMinsThenMaxes = 0;
  const labelOf = (row: TsvRow) => `levels.txt ${row.str('Id')} (${row.str('Name')})`;

  /** The expansion monster level per difficulty; null for a row without monsters (towns, map entrances) */
  const monsterLevel = (row: TsvRow, density: PerDifficulty<number>, uniques: UniquePacks): PerDifficulty<number> | null => {
    const rawLevel = perDifficulty((suffix) => row.num(`MonLvlEx${suffix}`));
    const hasDensity = density.some((value) => value > 0);
    const hasUniques = uniques.some(([min, max]) => min > 0 || max > 0);
    // A row with no monster columns, density, unique packs or boss (towns, Dimensional Gate, map entrances) has no level
    const hasMonsters = hasMonsterColumns(row) || hasDensity || hasUniques || bosses.has(row.line);
    return rawLevel.some((value) => value > 0) && hasMonsters ? rawLevel : null;
  };
  const readPacks = (row: TsvRow) =>
    readUniquePacks(
      // In header order: MonUMin, MonUMax, MonUMin(N), MonUMax(N), MonUMin(H), MonUMax(H)
      [row.num('MonUMin'), row.num('MonUMax'), row.num('MonUMin(N)'), row.num('MonUMax(N)'), row.num('MonUMin(H)'), row.num('MonUMax(H)')]
    );
  const readDensity = (row: TsvRow) => perDifficulty((suffix) => row.num(`MonDen${suffix}`));

  const listed = rows.filter((row) => {
    const id = row.num('Id');
    // A map entrance: named "… Prep Zone", or a tier map row without monsters (The Icecrown Citadel / The Sanctum of the Dead entrances)
    const prepZone =
      row.str('Name').includes(PREP_ZONE) ||
      (TIER_PREFIX.test(row.str('Name')) && monsterLevel(row, readDensity(row), readPacks(row).packs) === null);
    if (prepZone) {
      hidden.prepZones++;
      return false;
    }
    if (REMOVED_LEVELS.includes(id)) {
      hidden.removed++;
      return false;
    }
    if (id === 0) {
      hidden.other++;
      return false;
    }
    return true;
  });
  const listedIds = new Set(listed.map((row) => row.num('Id')));
  const visById = new Map(rows.map((row) => [row.num('Id'), visTargets(row)]));

  for (const removed of REMOVED_LEVELS) {
    if (!visById.has(removed)) warnings.push(`areas: removed level ${String(removed)} is no longer in levels.txt; update REMOVED_LEVELS`);
    for (const row of rows) {
      if (row.num('Id') !== removed && visById.get(row.num('Id'))?.includes(removed) === true)
        warnings.push(`areas: ${labelOf(row)} links to the removed level ${String(removed)}; check REMOVED_LEVELS`);
    }
  }

  // Endgame map items: on the map's entry level (the prep zone's Vis0 target), or on the portal's level when listed
  const mapItems = new Map<number, string>();
  for (const [code, level] of readMapPortals(cubemainText)) {
    const entry = listedIds.has(level) ? level : visById.get(level)?.[0];
    if (entry === undefined || !listedIds.has(entry)) {
      warnings.push(`areas: cubemain red portal of ${code} (lvl=${String(level)}) leads to no listed level`);
      continue;
    }
    const existing = mapItems.get(entry);
    if (existing !== undefined) {
      warnings.push(`areas: map items ${existing} and ${code} both enter levels.txt ${String(entry)}; kept ${existing}`);
      continue;
    }
    mapItems.set(entry, code);
  }

  let oneWayVis = 0;
  const areas = listed.map((row): Area => {
    const id = row.num('Id');
    const internal = row.str('Name');
    const label = labelOf(row);
    const levelName = row.str('LevelName');
    const name = resolveName(strings, levelName, internal.replace(ACT_PREFIX, ''));

    const tierMatch = TIER_PREFIX.exec(internal);
    const uniqueMatch = UNIQUE_MAP_PREFIX.exec(internal);
    const tier = tierMatch === null ? undefined : Number(tierMatch[1]);
    let group: string | undefined;
    if (tier !== undefined) {
      const groupMatch = TIER_PREFIX.exec(row.str('LevelGroup'));
      group = groupMatch?.[2] ?? tierMatch?.[2];
      if (groupMatch !== null && Number(groupMatch[1]) !== tier)
        warnings.push(`areas: ${label} is tier ${String(tier)} but its LevelGroup "${row.str('LevelGroup')}" says tier ${groupMatch[1]}`);
    } else if (uniqueMatch !== null) {
      group = uniqueMatch[1];
    }
    const isMap = tier !== undefined || uniqueMatch !== null;

    const boss = bosses.get(row.line);
    const density = readDensity(row);
    const read = readPacks(row);
    const uniques = read.packs;
    if (read.minsThenMaxes) uniquesMinsThenMaxes++;
    if (!read.ok) warnings.push(`areas: ${label} unique packs have min > max read pairwise and mins then maxes; kept pairwise`);
    const hasDensity = density.some((value) => value > 0);
    const hasUniques = uniques.some(([min, max]) => min > 0 || max > 0);
    const level = monsterLevel(row, density, uniques);

    if (tier !== undefined && level !== null && level.some((value) => value !== mapTierLevel(tier)))
      warnings.push(
        `areas: ${label} is tier ${String(tier)} (level ${String(mapTierLevel(tier))}) but has monster level ${level.join('/')}`
      );

    // A link counts only when both rows list each other (ESR's copied rows keep stale Vis entries)
    const connections: number[] = [];
    for (const target of visById.get(id) ?? []) {
      const back = visById.get(target);
      if (back === undefined) {
        warnings.push(`areas: ${label} Vis names unknown level ${String(target)}`);
        continue;
      }
      if (!back.includes(id)) {
        oneWayVis++;
        if (!EXPECTED_ONE_WAY_VIS.some(([from, to]) => from === id && to === target))
          warnings.push(`areas: ${label} links to levels.txt ${String(target)}, which does not link back; dropped`);
        continue;
      }
      if (listedIds.has(target)) connections.push(target);
    }

    const levelType = row.num('LevelType');
    const isInside = inside.get(row.line) === '1';
    let terrain = levelTerrain(levelType, isInside);
    if (terrain === null) {
      terrain = isInside ? 'dungeon' : 'outdoor';
      warnings.push(`areas: ${label} has the unknown LevelType ${String(levelType)}; shown as ${terrain}`);
    }
    const teleport = row.num('Teleport');
    const questGate = row.num('QuestFlagEx') || row.num('QuestFlag');
    const mapItem = mapItems.get(id);

    const waypoint = row.str('Waypoint');
    return {
      id,
      name,
      act: row.num('Act'),
      ...(group === undefined ? {} : { group }),
      ...(tier === undefined ? {} : { tier }),
      ...(uniqueMatch === null ? {} : { uniqueMap: true as const }),
      ...(boss === undefined ? {} : { boss }),
      ...(mapItem === undefined ? {} : { mapItem }),
      // A map row's Waypoint slot is a copy from the row it was made from (the waypoint menu has act tabs only)
      waypoint: !isMap && waypoint !== '' && Number(waypoint) !== NO_WAYPOINT,
      level,
      density: hasDensity ? density : null,
      uniques: hasUniques ? uniques : null,
      connections,
      ...(row.num('PreventTownPortal') === 0 ? {} : { preventTownPortal: true as const }),
      terrain,
      ...(teleport === 0 ? { teleport: 'off' as const } : teleport === 2 ? { teleport: 'restricted' as const } : {}),
      ...(questGate === 0 ? {} : { questGate }),
      ...(name.endsWith(ENDGAME_ZONE_SUFFIX) ? { endgameZone: true as const } : {}),
    };
  });

  return { bundle: { areas }, warnings, hidden, oneWayVis, uniquesMinsThenMaxes };
}
