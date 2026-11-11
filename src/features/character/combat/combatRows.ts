/**
 * The Combat tab's numbers: chance to hit and chance to be hit per area and boss, from combat.json and the player's
 * attack rating and defense (docs/features/CHARACTER-SAVE.md "Combat tab"). Pure; the components only render these.
 *
 * - Hit chance: ESR's attack-rating.toml curve through modifierMath.ts `hitChance` (one curve for every attacker and
 *   defender, no level term).
 * - Champions / uniques / minions: the regular monster re-scaled to their level (+2 / +3) and given the monumod.txt
 *   attack rating bonus. Bosses have their own row and no kinds.
 * - "−% Target Defense" lowers the monster's defense, halved against uniques, superuniques (attack-rating.toml) and,
 *   INFERRED, bosses; "Ignore Target's Defense" makes the chance to hit 100 % (on bosses: unknown, flagged).
 */
import type { CombatArea, CombatBoss, CombatBundle, CombatPool, CombatSpread, ModifierFact } from '@/features/game-data/engine/schema';
import { attackRatingFor } from '@/features/modifiers/utils/calculatorViews';
import { hitChance } from '@/features/modifiers/utils/modifierMath';
import {
  kindAttackBonus,
  kindLevelBonus,
  rescaleLevel,
  unpackLevelRatios,
  withAttackBonus,
  type CombatDifficulty,
  type LevelRatioTables,
} from './monsterStats';

export type CombatKind = 'regular' | 'champion' | 'unique';

export const COMBAT_KINDS: readonly { readonly kind: CombatKind; readonly label: string }[] = [
  { kind: 'regular', label: 'Regular' },
  { kind: 'champion', label: 'Champion' },
  { kind: 'unique', label: 'Unique' },
];

export const DIFFICULTY_NAMES: readonly [string, string, string] = ['Normal', 'Nightmare', 'Hell'];

/** The player's side: what the Combat tab is given (all optional: a missing value leaves its column empty) */
export interface CombatPlayer {
  readonly attackRating?: number;
  readonly defense?: number;
  readonly ignoreTargetDefense?: boolean;
  /** "−x% Target Defense" as a positive number */
  readonly targetDefenseReductionPercent?: number;
}

/** combat.json prepared for the calculations (the level ratios as columns, the curve as a facts list) */
export interface CombatData {
  readonly bundle: CombatBundle;
  readonly ratios: LevelRatioTables;
  readonly facts: readonly ModifierFact[];
}

export function prepareCombatData(bundle: CombatBundle): CombatData {
  return { bundle, ratios: unpackLevelRatios(bundle.levelRatios), facts: [bundle.curve] };
}

/** A target's numbers: its level and the min / median / max defense and attack rating */
export interface CombatTarget {
  readonly level: number;
  /** Normal pools: the lowest and highest monster level */
  readonly levelRange?: readonly [number, number];
  readonly defense: CombatSpread;
  /** null: every monster type only casts spells */
  readonly attack: CombatSpread | null;
  /** Spell-casting monster types without an attack rating */
  readonly casters: number;
  readonly monsters: number;
  /** The usual random spawn bonus: [chance %, +% attack rating] (INFERRED) */
  readonly randomBonus: readonly [number, number] | null;
  /** A boss: −% Target Defense is halved, Ignore Target's Defense may not apply */
  readonly boss: boolean;
}

const mapSpread = (spread: CombatSpread, map: (value: number) => number): CombatSpread => [map(spread[0]), map(spread[1]), map(spread[2])];

/** An area pool as a target of the given kind (re-scaled to the kind's level, its attack rating bonus added) */
export function poolTarget(
  data: CombatData,
  pool: CombatPool,
  difficulty: CombatDifficulty,
  kind: CombatKind,
  randomBonus: readonly [number, number] | null
): CombatTarget {
  const [level, monsters, defense, attack, extra] = pool;
  const levelBonus = kindLevelBonus(kind, data.bundle.modifiers);
  const attackBonus = kindAttackBonus(kind, data.bundle.modifiers);
  const to = level + levelBonus;
  const range = extra?.range;
  return {
    level: to,
    ...(range === undefined ? {} : { levelRange: [range[0] + levelBonus, range[1] + levelBonus] as const }),
    defense: levelBonus === 0 ? defense : mapSpread(defense, (value) => rescaleLevel(value, level, to, data.ratios.defense[difficulty])),
    attack:
      attack === null
        ? null
        : mapSpread(attack, (value) =>
            withAttackBonus(levelBonus === 0 ? value : rescaleLevel(value, level, to, data.ratios.attack[difficulty]), attackBonus)
          ),
    casters: extra?.casters ?? 0,
    monsters,
    randomBonus: extra?.bonus === undefined ? randomBonus : extra.bonus,
    boss: false,
  };
}

/** The defense the hit roll uses after "−x% Target Defense" (halved against uniques and bosses), rounded down */
export function reducedDefense(defense: number, reductionPercent: number, halved: boolean): number {
  const percent = Math.max(0, Math.min(100, halved ? reductionPercent / 2 : reductionPercent));
  return Math.floor((defense * (100 - percent)) / 100);
}

export interface ChanceSpread {
  /** Against the hardest / typical / easiest monster type of the pool */
  readonly low: number;
  readonly median: number;
  readonly high: number;
}

/** Chance to hit the target's min / median / max defense; null without an attack rating */
export function chanceToHit(data: CombatData, target: CombatTarget, player: CombatPlayer, kind: CombatKind): ChanceSpread | null {
  if (player.ignoreTargetDefense === true) return { low: 100, median: 100, high: 100 };
  const attackRating = player.attackRating;
  if (attackRating === undefined) return null;
  const halved = target.boss || kind === 'unique';
  const chance = (defense: number) =>
    hitChance(attackRating, reducedDefense(defense, player.targetDefenseReductionPercent ?? 0, halved), data.facts);
  return { low: chance(target.defense[2]), median: chance(target.defense[1]), high: chance(target.defense[0]) };
}

/** Chance the target's min / median / max attack rating hits the player; null without a defense or a monster attack */
export function chanceToBeHit(data: CombatData, target: CombatTarget, player: CombatPlayer): ChanceSpread | null {
  const defense = player.defense;
  if (defense === undefined || target.attack === null) return null;
  const chance = (attackRating: number) => hitChance(attackRating, defense, data.facts);
  return { low: chance(target.attack[0]), median: chance(target.attack[1]), high: chance(target.attack[2]) };
}

// --- rows ---------------------------------------------------------------------------------------------------------------

export interface CombatRow {
  /** Unique per row: `area:<id>:<difficulty>` / `boss:<id>:<difficulty>` */
  readonly key: string;
  readonly name: string;
  readonly target: CombatTarget;
  readonly hit: ChanceSpread | null;
  readonly beHit: ChanceSpread | null;
  /** Ignore Target's Defense on a boss: whether it works is unknown */
  readonly ignoreDefenseUnsure: boolean;
}

export interface CombatSection {
  readonly key: string;
  /** "Campaign · Hell", "Endgame maps", "Bosses" */
  readonly title: string;
  readonly groups: readonly { readonly key: string; readonly title: string; readonly rows: readonly CombatRow[] }[];
}

export interface CombatRowsOptions {
  readonly difficulty: CombatDifficulty;
  readonly kind: CombatKind;
}

function areaRow(data: CombatData, area: CombatArea, player: CombatPlayer, options: CombatRowsOptions): CombatRow | null {
  const pool = area.pools[options.difficulty];
  if (pool === null) return null;
  const fallbackBonus = area.tier === undefined ? data.bundle.randomBonus.campaign[options.difficulty] : data.bundle.randomBonus.maps;
  const target = poolTarget(data, pool, options.difficulty, options.kind, fallbackBonus);
  return {
    key: `area:${String(area.id)}:${String(options.difficulty)}`,
    name: area.name,
    target,
    hit: chanceToHit(data, target, player, options.kind),
    beHit: chanceToBeHit(data, target, player),
    ignoreDefenseUnsure: false,
  };
}

/** A boss as a target in a difficulty; null where it does not appear */
export function bossTarget(boss: CombatBoss, difficulty: CombatDifficulty): CombatTarget | null {
  const stats = boss.stats[difficulty];
  if (stats === null) return null;
  const [level, defense, attack] = stats;
  return {
    level,
    defense: [defense, defense, defense],
    attack: attack > 0 ? [attack, attack, attack] : null,
    casters: attack > 0 ? 0 : 1,
    monsters: 1,
    randomBonus: null,
    boss: true,
  };
}

function bossRow(data: CombatData, boss: CombatBoss, player: CombatPlayer, difficulty: CombatDifficulty): CombatRow | null {
  const target = bossTarget(boss, difficulty);
  if (target === null) return null;
  return {
    key: `boss:${boss.id}:${String(difficulty)}`,
    name: boss.name,
    target,
    hit: chanceToHit(data, target, player, 'regular'),
    beHit: chanceToBeHit(data, target, player),
    ignoreDefenseUnsure: player.ignoreTargetDefense === true,
  };
}

const present = <T>(value: T | null): value is T => value !== null;

/** The table: the campaign by act, the endgame maps by tier (Hell), then the bosses of the difficulty */
export function buildCombatSections(data: CombatData, player: CombatPlayer, options: CombatRowsOptions): CombatSection[] {
  const { areas, bosses } = data.bundle;
  const { difficulty } = options;
  const campaign = areas.filter((area) => area.tier === undefined);
  const acts = [...new Set(campaign.map((area) => area.act))].sort((a, b) => a - b);
  const sections: CombatSection[] = [
    {
      key: 'campaign',
      title: `Campaign · ${DIFFICULTY_NAMES[difficulty]}`,
      groups: acts.map((act) => ({
        key: `act-${String(act)}`,
        title: `Act ${String(act + 1)}`,
        rows: campaign.filter((area) => area.act === act).flatMap((area) => areaRow(data, area, player, options) ?? []),
      })),
    },
  ];
  if (difficulty === 2) {
    const tiers = [...new Set(areas.flatMap((area) => (area.tier === undefined ? [] : [area.tier])))].sort((a, b) => a - b);
    sections.push({
      key: 'maps',
      title: 'Endgame maps',
      groups: tiers.map((tier) => ({
        key: `tier-${String(tier)}`,
        title: `Tier ${String(tier)}`,
        rows: areas.filter((area) => area.tier === tier).flatMap((area) => areaRow(data, area, player, options) ?? []),
      })),
    });
  }
  const bossGroup = (key: string, title: string, list: readonly CombatBoss[]) => ({
    key,
    title,
    rows: list.map((boss) => bossRow(data, boss, player, difficulty)).filter(present),
  });
  const mapTiers = [...new Set(bosses.flatMap((boss) => (boss.tier === undefined ? [] : [boss.tier])))].sort((a, b) => a - b);
  sections.push({
    key: 'bosses',
    title: 'Bosses',
    groups: [
      bossGroup(
        'act',
        'Act bosses',
        bosses.filter((boss) => boss.group === 'act')
      ),
      bossGroup(
        'uber',
        'Pandemonium',
        bosses.filter((boss) => boss.group === 'uber')
      ),
      ...mapTiers.map((tier) =>
        bossGroup(
          `map-${String(tier)}`,
          `Map bosses · Tier ${String(tier)}`,
          bosses.filter((boss) => boss.group === 'map' && boss.tier === tier)
        )
      ),
    ].filter((group) => group.rows.length > 0),
  });
  return sections.map((section) => ({ ...section, groups: section.groups.filter((group) => group.rows.length > 0) }));
}

// --- what is needed -----------------------------------------------------------------------------------------------------

/** Above this the searches give up (no character gets near it) */
const SEARCH_LIMIT = 1_000_000_000;

/** The smallest attack rating with at least `chance` % to hit `defense` (null: out of reach) */
export function attackRatingNeeded(chance: number, defense: number, data: CombatData): number | null {
  return attackRatingFor(chance, defense, data.facts);
}

/** The smallest defense at which `attackRating` hits at most `chance` % of the time (null: out of reach) */
export function defenseNeeded(chance: number, attackRating: number, data: CombatData): number | null {
  if (hitChance(attackRating, 0, data.facts) <= chance) return 0;
  if (hitChance(attackRating, SEARCH_LIMIT, data.facts) > chance) return null;
  let low = 1;
  let high = SEARCH_LIMIT;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (hitChance(attackRating, mid, data.facts) <= chance) high = mid;
    else low = mid + 1;
  }
  return low;
}

export const HIT_GOALS: readonly number[] = [75, 95];
export const BE_HIT_GOALS: readonly number[] = [25, 5];

export interface NeededValues {
  /** Attack rating for each HIT_GOALS chance against the target's median and highest defense */
  readonly attackRating: readonly { readonly chance: number; readonly typical: number | null; readonly toughest: number | null }[];
  /** Defense for each BE_HIT_GOALS chance against the target's median and highest attack rating; empty without one */
  readonly defense: readonly { readonly chance: number; readonly typical: number | null; readonly toughest: number | null }[];
}

export function neededValues(data: CombatData, target: CombatTarget, player: CombatPlayer, kind: CombatKind): NeededValues {
  const halved = target.boss || kind === 'unique';
  const reduce = (defense: number) => reducedDefense(defense, player.targetDefenseReductionPercent ?? 0, halved);
  const attack = target.attack;
  return {
    attackRating: HIT_GOALS.map((chance) => ({
      chance,
      typical: attackRatingNeeded(chance, reduce(target.defense[1]), data),
      toughest: attackRatingNeeded(chance, reduce(target.defense[2]), data),
    })),
    defense:
      attack === null
        ? []
        : BE_HIT_GOALS.map((chance) => ({
            chance,
            typical: defenseNeeded(chance, attack[1], data),
            toughest: defenseNeeded(chance, attack[2], data),
          })),
  };
}

/** Attack rating / defense ratio, the curve's x (null when the divisor is 0) */
export function ratio(attackRating: number, defense: number): number | null {
  return defense > 0 ? attackRating / defense : null;
}
