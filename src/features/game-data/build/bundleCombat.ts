/**
 * combat.json: monster defense and attack rating per area and boss, for the My Character Combat tab
 * (docs/features/CHARACTER-SAVE.md "Combat tab", docs/features/GAME-DATA.md "Combat").
 *
 * - Areas: the areas.json areas with monsters. Campaign areas keep one entry each (Normal, Nightmare, Hell); the
 *   endgame map levels are merged into one entry per zone (Hell only: the maps are Hell Act 5). The Goblin Realm holds
 *   only treasure goblins and drops out.
 * - Pool: levels.txt `mon1..25` (Normal) / `nmon1..25` (Nightmare, Hell). Left out: treasure goblins (`MonType`
 *   treasuregoblin), ESR's Corrupted Zakarum special spawns (`corruptedzakarum*`, appended to every campaign pool like
 *   the goblins) and `boss` rows (the "clone" bosses some pools list; the real bosses are in `bosses`).
 * - Monster level: Nightmare / Hell the area's `MonLvlEx(N)` / `MonLvlEx(H)`; Normal the monster's own monstats `Level`.
 *   Bosses use their own `Level` / `Level(N)` / `Level(H)`. Values: see character/combat/monsterStats.ts.
 * - Worked examples (WORKED_EXAMPLES) are recomputed every run; a mismatch is a manifest warning (an ESR rebalance
 *   should not block the update), and bundleIntegrity.test.ts pins the committed numbers.
 */
import { packLevelRatios, scaleByLevel, type CombatDifficulty, type LevelRatioTables } from '../../character/combat/monsterStats.ts';
import type {
  Area,
  CombatArea,
  CombatBoss,
  CombatBundle,
  CombatModifiers,
  CombatPool,
  CombatPoolExtra,
  CombatSpread,
  MapBoss,
  ModifierFact,
  PerDifficulty,
} from '../engine/schema.ts';
import { resolveName } from './itemNames.ts';
import type { TsvRow, TsvTable } from './tsv.ts';

const DIFFICULTIES: readonly CombatDifficulty[] = [0, 1, 2];
const SUFFIX = ['', '(N)', '(H)'] as const;
const MONPROP_SUFFIX = ['', ' (N)', ' (H)'] as const;
const POOL_SIZE = 25;
/** The last monlvl.txt row the engine reads */
const LAST_LEVEL = 110;

/** Champions +2 levels, uniques and their minions +3 (vanilla engine rule; not in a table) */
export const LEVEL_BONUS = { champion: 2, unique: 3, minion: 3 } as const;
/** monumod.txt constants by their `*constant desc` text, with the vanilla value as fallback */
export const ATTACK_BONUS_CONSTANTS = {
  champion: { desc: 'Champion Attack Rating % Bonus', vanilla: 75 },
  unique: { desc: 'Unique Attack Rating % Bonus', vanilla: 100 },
  minion: { desc: 'Minion of Unique Attack Rating % Bonus', vanilla: 50 },
} as const;

export const ACT_BOSSES: readonly { id: string; act: number }[] = [
  { id: 'andariel', act: 0 },
  { id: 'duriel', act: 1 },
  { id: 'mephisto', act: 2 },
  { id: 'diablo', act: 3 },
  { id: 'baalcrab', act: 4 },
];
/** The Pandemonium event bosses; their NameStr is the act boss's, so they get their own names */
export const UBER_BOSSES: readonly { id: string; name: string }[] = [
  { id: 'uberandariel', name: 'Lilith' },
  { id: 'uberduriel', name: 'Uber Duriel' },
  { id: 'uberizual', name: 'Uber Izual' },
  { id: 'ubermephisto', name: 'Uber Mephisto' },
  { id: 'uberdiablo', name: 'Uber Diablo' },
  { id: 'uberbaal', name: 'Uber Baal' },
];

/** Numbers worked out by hand from the tables (test-fixtures ground truth); recomputed as a self-check */
export const WORKED_EXAMPLES: readonly {
  label: string;
  monster: string;
  difficulty: CombatDifficulty;
  level: number;
  defense: number;
  attack: number;
}[] = [
  {
    label: 'Death Knight, Worldstone Keep Level 2 (Hell)',
    monster: 'blackknight5',
    difficulty: 2,
    level: 88,
    defense: 3226,
    attack: 52189,
  },
  {
    label: 'Harbinger of Pestilence, Tier 1 map',
    monster: 'harbingerofpestillence',
    difficulty: 2,
    level: 100,
    defense: 4685,
    attack: 620520,
  },
  { label: 'The Lich King', monster: 'thelichking', difficulty: 2, level: 110, defense: 10500, attack: 2743440 },
  { label: 'Diablo Hellhound (Tier 1 map boss)', monster: 'diablohellhound', difficulty: 2, level: 110, defense: 4200, attack: 1567680 },
  { label: 'Baal (Hell)', monster: 'baalcrab', difficulty: 2, level: 99, defense: 6293, attack: 153660 },
];

export interface CombatInput {
  levels: TsvTable;
  /** monstats.txt (first row of an Id wins) */
  monstats: TsvTable;
  monprop: TsvTable;
  monlvl: TsvTable;
  /** Raw monumod.txt: its constants are told apart by the `*constant desc` comment column */
  monumodText: string;
  /** areas.json areas (map bosses filled in) */
  areas: readonly Area[];
  mapBosses: readonly MapBoss[];
  /** modifiers.json `attackRating.curve` */
  curve: ModifierFact | undefined;
  strings: ReadonlyMap<string, string>;
}

export interface CombatResult {
  bundle: CombatBundle;
  warnings: string[];
  counts: Record<string, number>;
}

interface MonsterValues {
  id: string;
  level: number;
  defense: number;
  /** Best attack rating; null for a spell caster */
  attack: number | null;
}

/** Why a pool member is left out, or null when it counts */
export function excludedReason(row: TsvRow): 'goblin' | 'special' | 'boss' | null {
  if (row.str('MonType') === 'treasuregoblin') return 'goblin';
  if (row.str('Id').startsWith('corruptedzakarum')) return 'special';
  if (row.num('boss') === 1) return 'boss';
  return null;
}

/** monlvl.txt `L-AC*` / `L-TH*` by level 0..110 */
export function readLevelRatios(monlvl: TsvTable): LevelRatioTables {
  const byLevel = new Map(monlvl.rows.map((row) => [row.num('Level'), row]));
  const column = (name: string) =>
    Array.from({ length: LAST_LEVEL + 1 }, (_, level) => {
      const row = byLevel.get(level);
      if (row === undefined) throw new Error(`combat: monlvl.txt has no level ${String(level)}`);
      return row.num(name);
    });
  return {
    defense: [column('L-AC'), column('L-AC(N)'), column('L-AC(H)')],
    attack: [column('L-TH'), column('L-TH(N)'), column('L-TH(H)')],
  };
}

/** The attack rating bonuses of monumod.txt, by the `*constant desc` text of their row */
export function readModifiers(monumodText: string, warn: (message: string) => void): CombatModifiers {
  const lines = monumodText.split(/\r?\n/);
  const header = (lines[0] ?? '').split('\t').map((cell) => cell.trim());
  const valueColumn = header.indexOf('constants');
  const descColumn = header.indexOf('*constant desc');
  const constants = new Map<string, number>();
  if (valueColumn < 0 || descColumn < 0) warn('monumod.txt has no constants / *constant desc column; vanilla bonuses used');
  else
    for (const line of lines.slice(1)) {
      const cells = line.split('\t');
      const desc = (cells[descColumn] ?? '').trim();
      const value = Number((cells[valueColumn] ?? '').trim());
      if (desc !== '' && !constants.has(desc) && Number.isFinite(value)) constants.set(desc, value);
    }
  const attack = (kind: keyof typeof ATTACK_BONUS_CONSTANTS) => {
    const { desc, vanilla } = ATTACK_BONUS_CONSTANTS[kind];
    const value = constants.get(desc);
    if (value === undefined) {
      if (valueColumn >= 0 && descColumn >= 0) warn(`monumod.txt has no "${desc}" constant; vanilla ${String(vanilla)} used`);
      return vanilla;
    }
    return value;
  };
  return {
    champion: { level: LEVEL_BONUS.champion, attack: attack('champion') },
    unique: { level: LEVEL_BONUS.unique, attack: attack('unique') },
    minion: { level: LEVEL_BONUS.minion, attack: attack('minion') },
  };
}

/** Defense and best attack rating of a monstats row at a monster level (noRatio rows: the raw columns) */
export function monsterValues(row: TsvRow, level: number, difficulty: CombatDifficulty, ratios: LevelRatioTables): MonsterValues {
  const suffix = SUFFIX[difficulty];
  const raw = row.num('noRatio') === 1;
  const scale = (base: number, table: readonly number[]) => (raw ? base : scaleByLevel(base, level, table));
  const hits = ['A1TH', 'A2TH', 'S1TH'].map((column) => row.num(`${column}${suffix}`)).filter((value) => value > 0);
  return {
    id: row.str('Id'),
    level,
    defense: scale(row.num(`AC${suffix}`), ratios.defense[difficulty]),
    attack: hits.length === 0 ? null : Math.max(...hits.map((base) => scale(base, ratios.attack[difficulty]))),
  };
}

/** The monprop.txt `monrandombonus` of a monster in a difficulty: [chance %, value], or null */
function randomBonus(row: TsvRow, monprop: ReadonlyMap<string, TsvRow>, difficulty: CombatDifficulty): [number, number] | null {
  const prop = monprop.get(row.str('MonProp'));
  if (prop === undefined) return null;
  const suffix = MONPROP_SUFFIX[difficulty];
  for (let i = 1; i <= 6; i++) {
    const column = `prop${String(i)}${suffix}`;
    if (!prop.has(column) || prop.str(column) !== 'monrandombonus') continue;
    return [prop.num(`chance${String(i)}${suffix}`), prop.num(`max${String(i)}${suffix}`)];
  }
  return null;
}

/** The min / median (lower middle) / max of a sorted list */
function spread(sorted: readonly number[]): CombatSpread {
  const at = (index: number) => sorted[index] ?? 0;
  return [at(0), at(Math.floor((sorted.length - 1) / 2)), at(sorted.length - 1)];
}

/** A built pool and the `monrandombonus` most of its monsters carry (folded into the bundle default afterwards) */
export interface PoolDraft {
  pool: CombatPool;
  bonus: [number, number] | null;
}

export function buildPool(
  members: readonly TsvRow[],
  areaLevel: number,
  difficulty: CombatDifficulty,
  ratios: LevelRatioTables,
  monprop: ReadonlyMap<string, TsvRow>
): PoolDraft | null {
  if (members.length === 0) return null;
  const values = members.map((row) => monsterValues(row, difficulty === 0 ? row.num('Level') || areaLevel : areaLevel, difficulty, ratios));
  const levels = values.map((value) => value.level).sort((a, b) => a - b);
  const level = difficulty === 0 ? (levels[Math.floor((levels.length - 1) / 2)] ?? areaLevel) : areaLevel;
  const defense = spread(values.map((value) => value.defense).sort((a, b) => a - b));
  const attackers = values.flatMap((value) => (value.attack === null ? [] : [value.attack])).sort((a, b) => a - b);
  const attack = attackers.length === 0 ? null : spread(attackers);
  const bonusCounts = new Map<string, number>();
  for (const row of members) {
    const bonus = randomBonus(row, monprop, difficulty);
    if (bonus !== null) bonusCounts.set(bonus.join(','), (bonusCounts.get(bonus.join(',')) ?? 0) + 1);
  }
  const topBonus = [...bonusCounts].sort((a, b) => b[1] - a[1]).at(0);
  const casters = values.length - attackers.length;
  const low = levels[0] ?? level;
  const high = levels[levels.length - 1] ?? level;
  const extra: CombatPoolExtra = {
    ...(difficulty === 0 && low !== high ? { range: [low, high] as [number, number] } : {}),
    ...(casters > 0 ? { casters } : {}),
  };
  const pool: CombatPool = [level, members.length, defense, attack];
  if (Object.keys(extra).length > 0) pool.push(extra);
  return {
    pool,
    bonus: topBonus !== undefined && topBonus[1] * 2 > members.length ? (topBonus[0].split(',').map(Number) as [number, number]) : null,
  };
}

/** The most common bonus of a list of drafts (null when none) */
function commonBonus(drafts: readonly PoolDraft[]): [number, number] | null {
  const counts = new Map<string, number>();
  for (const draft of drafts) {
    const key = draft.bonus === null ? '' : draft.bonus.join(',');
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const top = [...counts].sort((a, b) => b[1] - a[1]).at(0);
  return top === undefined || top[0] === '' ? null : (top[0].split(',').map(Number) as [number, number]);
}

/** The pool with its own bonus in `extra.bonus` when it differs from the default */
function withBonus(draft: PoolDraft, fallback: [number, number] | null): CombatPool {
  if (draft.bonus?.join(',') === fallback?.join(',')) return draft.pool;
  const [level, monsters, defense, attack, extra] = draft.pool;
  return [level, monsters, defense, attack, { ...extra, bonus: draft.bonus }];
}

export function buildCombatBundle(input: CombatInput): CombatResult {
  const warnings: string[] = [];
  const warn = (message: string) => warnings.push(`combat: ${message}`);
  if (input.curve === undefined) throw new Error('combat: modifiers.json has no attackRating.curve fact (attack-rating.toml missing?)');

  const monsters = new Map<string, TsvRow>();
  for (const row of input.monstats.rows) if (row.str('Id') !== '' && !monsters.has(row.str('Id'))) monsters.set(row.str('Id'), row);
  const monprop = new Map(input.monprop.rows.map((row) => [row.str('Id'), row]));
  const levelRows = new Map(input.levels.rows.filter((row) => row.str('Id') !== '').map((row) => [row.num('Id'), row]));
  const ratios = readLevelRatios(input.monlvl);
  const modifiers = readModifiers(input.monumodText, warn);

  const excluded = { goblin: new Set<string>(), special: new Set<string>(), boss: new Set<string>() };
  const unknown = new Set<string>();
  /** The counted pool members of a levels.txt row in a difficulty */
  const members = (id: number, difficulty: CombatDifficulty): TsvRow[] => {
    const row = levelRows.get(id);
    if (row === undefined) return [];
    const ids = [...new Set(row.list(difficulty === 0 ? 'mon' : 'nmon', POOL_SIZE))];
    return ids.flatMap((monster) => {
      const monsterRow = monsters.get(monster);
      if (monsterRow === undefined) {
        unknown.add(`${monster} (levels.txt ${String(id)})`);
        return [];
      }
      const reason = excludedReason(monsterRow);
      if (reason !== null) {
        excluded[reason].add(monster);
        return [];
      }
      return [monsterRow];
    });
  };

  // Areas first as drafts: the usual random bonus becomes the bundle default, a pool keeps only its own
  const campaign: { area: Area; drafts: (PoolDraft | null)[] }[] = [];
  const mapZones: { zone: string; first: Area; levels: number[]; draft: PoolDraft }[] = [];
  const zones = new Map<string, Area[]>();
  for (const area of input.areas) {
    if (area.level === null) continue;
    if (area.tier !== undefined || area.uniqueMap === true) {
      const key = area.group ?? area.name;
      zones.set(key, [...(zones.get(key) ?? []), area]);
      continue;
    }
    const level = area.level;
    const drafts = DIFFICULTIES.map((difficulty) =>
      buildPool(members(area.id, difficulty), level[difficulty], difficulty, ratios, monprop)
    );
    if (drafts.some((draft) => draft !== null)) campaign.push({ area, drafts });
  }
  let droppedZones = 0;
  for (const [zone, zoneAreas] of zones) {
    const withMonsters = zoneAreas.filter((area) => members(area.id, 2).length > 0);
    const first = withMonsters.at(0);
    if (first === undefined || first.level === null) {
      droppedZones++;
      continue;
    }
    const levels = new Set(withMonsters.map((area) => area.level?.[2]));
    if (levels.size > 1) warn(`map zone ${zone} has levels of different monster levels (${[...levels].join(', ')}); the first is used`);
    const union = new Map<string, TsvRow>();
    for (const area of withMonsters) for (const row of members(area.id, 2)) union.set(row.str('Id'), row);
    const draft = buildPool([...union.values()], first.level[2], 2, ratios, monprop);
    if (draft !== null) mapZones.push({ zone, first, levels: withMonsters.map((area) => area.id), draft });
  }
  const randomBonusDefault: CombatBundle['randomBonus'] = {
    campaign: DIFFICULTIES.map((difficulty) =>
      commonBonus(campaign.flatMap(({ drafts }) => drafts[difficulty] ?? []))
    ) as CombatBundle['randomBonus']['campaign'],
    maps: commonBonus(mapZones.map(({ draft }) => draft)),
  };
  const areas: CombatArea[] = [
    ...campaign.map(({ area, drafts }) => ({
      id: area.id,
      name: area.name,
      act: area.act,
      pools: drafts.map((draft, difficulty) =>
        draft === null ? null : withBonus(draft, randomBonusDefault.campaign[difficulty] ?? null)
      ) as PerDifficulty<CombatPool | null>,
    })),
    ...mapZones.map(({ zone, first, levels, draft }) => ({
      id: first.id,
      name: zone,
      act: first.act,
      ...(first.tier === undefined ? {} : { tier: first.tier }),
      levels,
      pools: [null, null, withBonus(draft, randomBonusDefault.maps)] as PerDifficulty<CombatPool | null>,
    })),
  ];

  const bossStats = (row: TsvRow, difficulties: readonly CombatDifficulty[]): CombatBoss['stats'] =>
    DIFFICULTIES.map((difficulty) => {
      if (!difficulties.includes(difficulty)) return null;
      const level = row.num(difficulty === 0 ? 'Level' : `Level${SUFFIX[difficulty]}`);
      const values = monsterValues(row, level, difficulty, ratios);
      return [level, values.defense, values.attack ?? 0];
    }) as CombatBoss['stats'];
  const bosses: CombatBoss[] = [];
  const bossRow = (id: string) => {
    const row = monsters.get(id);
    if (row === undefined) warn(`boss ${id} is not in monstats.txt`);
    return row;
  };
  for (const { id, act } of ACT_BOSSES) {
    const row = bossRow(id);
    if (row !== undefined)
      bosses.push({ id, name: resolveName(input.strings, row.str('NameStr'), id), group: 'act', act, stats: bossStats(row, DIFFICULTIES) });
  }
  for (const { id, name } of UBER_BOSSES) {
    const row = bossRow(id);
    if (row !== undefined) bosses.push({ id, name, group: 'uber', stats: bossStats(row, [2]) });
  }
  for (const boss of input.mapBosses) {
    const row = bossRow(boss.id);
    if (row !== undefined) bosses.push({ id: boss.id, name: boss.name, group: 'map', tier: boss.tier, stats: bossStats(row, [2]) });
  }

  for (const example of WORKED_EXAMPLES) {
    const row = monsters.get(example.monster);
    if (row === undefined) {
      warn(`worked example ${example.label}: ${example.monster} is not in monstats.txt`);
      continue;
    }
    const got = monsterValues(row, example.level, example.difficulty, ratios);
    if (got.defense !== example.defense || got.attack !== example.attack)
      warn(
        `worked example ${example.label}: expected defense ${String(example.defense)} / attack rating ${String(example.attack)}, ` +
          `got ${String(got.defense)} / ${String(got.attack)} (an ESR rebalance? update WORKED_EXAMPLES and the docs)`
      );
  }
  if (unknown.size > 0) warn(`pool monsters missing from monstats.txt: ${[...unknown].join(', ')}`);

  const pools = areas.flatMap((area) => area.pools.filter((pool) => pool !== null));
  return {
    bundle: { curve: input.curve, levelRatios: packLevelRatios(ratios), modifiers, randomBonus: randomBonusDefault, areas, bosses },
    warnings,
    counts: {
      combatAreas: areas.filter((area) => area.levels === undefined).length,
      combatMapZones: areas.filter((area) => area.levels !== undefined).length,
      combatMapZonesDropped: droppedZones,
      combatPools: pools.length,
      combatPoolsWithCasters: pools.filter((pool) => pool[4]?.casters !== undefined).length,
      combatBosses: bosses.length,
      combatExcludedGoblins: excluded.goblin.size,
      combatExcludedSpecial: excluded.special.size,
      combatExcludedBosses: excluded.boss.size,
    },
  };
}
