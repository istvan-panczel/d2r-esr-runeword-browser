/**
 * modifiers.json: what the item modifiers do (docs/features/MODIFIERS.md).
 *
 * - `stats`: every itemstatcost.txt stat that an ESR item list carries (uniques, set items with their partial bonuses,
 *   set bonuses, runewords, gemwords, spawnable magic prefixes / suffixes / automods, superior affixes, gems and runes in
 *   sockets, cube outputs; property groups expanded), plus the stats of the key kinds even when nothing carries them.
 *   Display strings, op formula, item events, the properties setting it, the vanilla D2R comparison, usage per item
 *   list and a few example items.
 * - `kinds`: the reviewed key-kind table below (`KEY_KINDS`), then one generated kind per remaining stat (stats with
 *   the same description text share one). The explanation texts are not in the bundle: they join on `key`.
 * - `facts`: numbers with provenance: difficultylevels.txt per difficulty, charstats.txt BlockFactor, monstats.txt Drain,
 *   ESR's D2RLoader plugin configs (TOML) and patches, and the vanilla engine constants the calculators need.
 */
import type {
  ModifierCategory,
  ModifierFact,
  ModifierItemKind,
  ModifierKind,
  ModifierStat,
  ModifierStatEvent,
  ModifierStatOp,
  ModifiersBundle,
} from '../engine/schema.ts';
import { isTechnicalStat, labelFromDescription, propertyStats } from './affixStats.ts';
import {
  VANILLA_BLOCK_FACTOR,
  VANILLA_CHARSTATS,
  VANILLA_DIFFICULTY,
  VANILLA_STAT_COLUMNS,
  VANILLA_STATS,
} from './data/vanillaReference.ts';
import type { EsrModifierConfig, EsrModifierPatch } from './esrSources.ts';
import { modifierConfigFile, modifierPatchFile } from './esrSources.ts';
import type { PropertyDef, PropertyGroupDef } from './stats/tables.ts';
import { parseToml, type TomlDocument, type TomlValue } from './toml.ts';
import type { TsvTable } from './tsv.ts';

export interface ModifierSource {
  kind: ModifierItemKind;
  name: string;
  /** Property codes (or property group codes) */
  mods: readonly { code: string }[];
}

export interface ModifiersInput {
  /** itemstatcost.txt with its Expansion rows kept (row index = stat id) */
  itemstatcost: TsvTable;
  properties: ReadonlyMap<string, PropertyDef>;
  groups: ReadonlyMap<string, PropertyGroupDef>;
  strings: ReadonlyMap<string, string>;
  sources: readonly ModifierSource[];
  difficultylevels: TsvTable;
  /** charstats.txt without its Expansion row */
  charstats: TsvTable;
  monstats: TsvTable;
  configs: Readonly<Partial<Record<EsrModifierConfig, string | null>>>;
  patches: Readonly<Partial<Record<EsrModifierPatch, string | null>>>;
}

export interface ModifiersResult {
  bundle: ModifiersBundle;
  warnings: string[];
}

// --- key kinds --------------------------------------------------------------------------------------------------------

export interface KeyKind {
  key: string;
  title: string;
  category: ModifierCategory;
  stats: readonly string[];
}

/**
 * The reviewed modifier kinds (the ones with hand-checked explanations). A stat may be in one kind only; a stat missing
 * from itemstatcost.txt is a warning. Order = page order within a category.
 */
export const KEY_KINDS: readonly KeyKind[] = [
  // offense
  { key: 'deadly-strike', title: 'Deadly Strike', category: 'offense', stats: ['item_deadlystrike', 'item_deadlystrike_perlevel'] },
  { key: 'critical-damage', title: 'Deadly Strike Damage', category: 'offense', stats: ['criticaldamage'] },
  { key: 'crushing-blow', title: 'Crushing Blow', category: 'offense', stats: ['item_crushingblow', 'item_crushingblow_perlevel'] },
  { key: 'open-wounds', title: 'Open Wounds', category: 'offense', stats: ['item_openwounds'] },
  { key: 'bleed', title: 'Bleed', category: 'offense', stats: ['bleedmindam', 'bleedmaxdam', 'bleedlength'] },
  { key: 'life-leech', title: 'Life Leech', category: 'offense', stats: ['lifedrainmindam', 'lifedrainmaxdam'] },
  { key: 'mana-leech', title: 'Mana Leech', category: 'offense', stats: ['manadrainmindam', 'manadrainmaxdam'] },
  {
    key: 'enhanced-damage',
    title: 'Enhanced Damage',
    category: 'offense',
    stats: ['item_maxdamage_percent', 'item_mindamage_percent', 'item_maxdamage_percent_perlevel'],
  },
  {
    key: 'attack-rating',
    title: 'Attack Rating',
    category: 'offense',
    stats: ['tohit', 'item_tohit_percent', 'item_tohit_perlevel', 'item_tohitpercent_perlevel'],
  },
  { key: 'target-defense', title: '-% Target Defense', category: 'offense', stats: ['item_fractionaltargetac'] },
  { key: 'ignore-target-defense', title: "Ignore Target's Defense", category: 'offense', stats: ['item_ignoretargetac'] },
  {
    key: 'enemy-resist',
    title: '-% Enemy Resistance',
    category: 'offense',
    stats: [
      'passive_fire_pierce',
      'passive_ltng_pierce',
      'passive_cold_pierce',
      'passive_pois_pierce',
      'passive_mag_pierce',
      'passive_dmg_pierce',
    ],
  },
  {
    key: 'elemental-mastery',
    title: 'Elemental Spell Damage',
    category: 'offense',
    stats: ['passive_fire_mastery', 'passive_ltng_mastery', 'passive_cold_mastery', 'passive_pois_mastery', 'passive_mag_mastery'],
  },
  {
    key: 'spell-damage',
    title: 'Magic and Physical Spell Damage',
    category: 'offense',
    stats: ['passive_mag2_mastery', 'passive_wind_mastery'],
  },
  { key: 'summon-damage', title: 'Summon Damage', category: 'offense', stats: ['passive_summ_mastery'] },
  { key: 'total-spell-damage', title: 'Total Spell Damage', category: 'offense', stats: ['generictotalmultiplier'] },
  { key: 'piercing-attack', title: 'Piercing Attack', category: 'offense', stats: ['item_pierce'] },
  { key: 'slow-target', title: 'Slows Target', category: 'offense', stats: ['item_slow'] },
  { key: 'freeze-target', title: 'Freezes Target', category: 'offense', stats: ['item_freeze'] },
  { key: 'knockback', title: 'Knockback', category: 'offense', stats: ['item_knockback'] },
  { key: 'prevent-heal', title: 'Prevent Monster Heal', category: 'offense', stats: ['item_preventheal'] },
  { key: 'monster-flee', title: 'Hit Causes Monster to Flee', category: 'offense', stats: ['item_howl'] },
  { key: 'reanimate', title: 'Reanimate As', category: 'offense', stats: ['item_reanimate'] },
  // procs
  {
    key: 'cast-on-strike',
    title: 'Chance to Cast on Striking / Attack',
    category: 'procs',
    stats: ['item_skillonhit', 'item_skillonattack', 'item_skillonhit_hidden', 'item_skillonattack_hidden'],
  },
  {
    key: 'cast-when-struck',
    title: 'Chance to Cast when Struck',
    category: 'procs',
    stats: ['item_skillongethit', 'item_skillontakedmg', 'item_skillongethit_hidden', 'item_skillontakedmg_hidden'],
  },
  {
    key: 'cast-on-kill',
    title: 'Chance to Cast on Kill / Death / Level-Up',
    category: 'procs',
    stats: ['item_skillonkill', 'item_skillondeath', 'item_skillonlevelup', 'item_skillonkill_hidden'],
  },
  {
    key: 'cast-on-cast',
    title: 'Chance to Cast on Casting a Skill',
    category: 'procs',
    stats: ['item_skilloncast', 'item_skilloncast_hidden'],
  },
  {
    key: 'attacker-takes-damage',
    title: 'Attacker Takes Damage',
    category: 'procs',
    stats: [
      'item_attackertakesdamage',
      'item_thorns_perlevel',
      'item_attackertakeslightdamage',
      'item_attackertakesfiredamage',
      'item_attackertakescolddamage',
      'thorns_percent',
      'missile_thorns_percent',
    ],
  },
  // defense
  {
    key: 'resist-fire',
    title: 'Fire Resist',
    category: 'defense',
    stats: ['fireresist', 'item_resist_fire_perlevel', 'total_fire_resist'],
  },
  {
    key: 'resist-cold',
    title: 'Cold Resist',
    category: 'defense',
    stats: ['coldresist', 'item_resist_cold_perlevel', 'total_cold_resist'],
  },
  {
    key: 'resist-lightning',
    title: 'Lightning Resist',
    category: 'defense',
    stats: ['lightresist', 'item_resist_ltng_perlevel', 'total_lightning_resist'],
  },
  {
    key: 'resist-poison',
    title: 'Poison Resist',
    category: 'defense',
    stats: ['poisonresist', 'item_resist_pois_perlevel', 'total_poison_resist'],
  },
  {
    key: 'max-resist',
    title: 'Maximum Resist',
    category: 'defense',
    stats: ['maxfireresist', 'maxcoldresist', 'maxlightresist', 'maxpoisonresist', 'maxmagicresist'],
  },
  { key: 'physical-resist', title: 'Physical Resist', category: 'defense', stats: ['damageresist', 'total_physical_resist'] },
  { key: 'magic-resist', title: 'Magic Resist', category: 'defense', stats: ['magicresist', 'total_magic_resist'] },
  { key: 'damage-reduced', title: 'Damage Reduced', category: 'defense', stats: ['normal_damage_reduction'] },
  { key: 'magic-damage-reduced', title: 'Magic Damage Reduced', category: 'defense', stats: ['magic_damage_reduction'] },
  {
    key: 'absorb',
    title: 'Elemental Absorb',
    category: 'defense',
    stats: [
      'item_absorbfire_percent',
      'item_absorbfire',
      'item_absorblight_percent',
      'item_absorblight',
      'item_absorbmagic_percent',
      'item_absorbmagic',
      'item_absorbcold_percent',
      'item_absorbcold',
    ],
  },
  { key: 'block', title: 'Chance to Block', category: 'defense', stats: ['toblock'] },
  { key: 'dodge', title: 'Dodge, Avoid and Evade', category: 'defense', stats: ['passive_dodge', 'passive_avoid', 'passive_evade'] },
  { key: 'weapon-block', title: 'Weapon Block', category: 'defense', stats: ['passive_weaponblock'] },
  { key: 'cannot-be-frozen', title: 'Cannot Be Frozen', category: 'defense', stats: ['item_cannotbefrozen'] },
  { key: 'half-freeze', title: 'Half Freeze Duration', category: 'defense', stats: ['item_halffreezeduration'] },
  { key: 'poison-length', title: 'Poison Length Reduced', category: 'defense', stats: ['item_poisonlengthresist'] },
  { key: 'curse-resist', title: 'Curse Resistance', category: 'defense', stats: ['curse_resistance'] },
  { key: 'damage-to-mana', title: 'Damage Taken Goes to Mana', category: 'defense', stats: ['item_damagetomana'] },
  // speed
  { key: 'ias', title: 'Increased Attack Speed', category: 'speed', stats: ['item_fasterattackrate'] },
  { key: 'fcr', title: 'Faster Cast Rate', category: 'speed', stats: ['item_fastercastrate'] },
  { key: 'fhr', title: 'Faster Hit Recovery', category: 'speed', stats: ['item_fastergethitrate'] },
  { key: 'fbr', title: 'Faster Block Rate', category: 'speed', stats: ['item_fasterblockrate'] },
  { key: 'frw', title: 'Faster Run/Walk', category: 'speed', stats: ['item_fastermovevelocity'] },
  // resources
  {
    key: 'life-after-kill',
    title: 'Life after each Kill',
    category: 'resources',
    stats: ['item_healafterkill', 'item_healafterdemonkill'],
  },
  { key: 'mana-after-kill', title: 'Mana after each Kill', category: 'resources', stats: ['item_manaafterkill'] },
  { key: 'on-striking', title: 'Life and Mana on Striking', category: 'resources', stats: ['lifeonstriking', 'manaonstriking'] },
  { key: 'replenish-life', title: 'Replenish Life', category: 'resources', stats: ['hpregen'] },
  // find
  { key: 'magic-find', title: 'Magic Find', category: 'find', stats: ['item_magicbonus', 'item_find_magic_perlevel'] },
  { key: 'gold-find', title: 'Gold Find', category: 'find', stats: ['item_goldbonus', 'item_find_gold_perlevel'] },
  { key: 'extra-items', title: 'Increased Quantity of Items Found', category: 'find', stats: ['extra_items'] },
  // skills
  { key: 'skill-cooldown', title: 'Skill Cooldown Reduction', category: 'skills', stats: ['item_skill_cooldown'] },
  // attributes
  {
    key: 'attribute-percent',
    title: '% Bonus to Attributes',
    category: 'attributes',
    stats: ['strengthpercent', 'dexteritypercent', 'vitalitypercent', 'energypercent'],
  },
];

// --- item events and ops --------------------------------------------------------------------------------------------

/** itemstatcost `itemevent*` (D2MOO SUnitEvent.h) → readable trigger */
const EVENT_TRIGGERS: Readonly<Record<string, string>> = {
  damagedinmelee: 'when hit by a melee attack',
  damagedbymissile: 'when hit by a missile',
  attackedinmelee: 'when attacked in melee',
  doactive: 'when casting a skill',
  domeleedamage: 'on a melee hit',
  domissiledamage: 'on a missile hit',
  domeleeattack: 'on a melee attack',
  domissileattack: 'on a missile attack',
  kill: 'on a kill',
  killed: 'on death',
  absorbdamage: 'when taking damage',
  levelup: 'on level-up',
};

/** itemstatcost `itemeventfunc*` (D2MOO SkillItem.cpp event callbacks, Data Guide "Event Functions") → readable action */
const EVENT_FUNCTIONS: Readonly<Record<number, string>> = {
  1: 'Shield Spikes damage',
  2: 'Iron Maiden damage return',
  3: 'Life Tap heal',
  4: 'Iron Maiden damage return',
  5: 'Terror (flee)',
  6: 'Attacker takes physical damage (thorns)',
  7: 'Knockback',
  8: 'Target flees',
  9: 'Blinds the target',
  10: 'Attacker takes lightning damage',
  11: 'Attacker takes fire damage',
  12: 'Attacker takes cold damage',
  13: 'Damage taken goes to mana',
  14: 'Freezes the target',
  15: 'Open Wounds',
  16: 'Crushing Blow',
  17: 'Restores mana',
  18: 'Restores life (demon kill)',
  19: 'Slows the target',
  20: 'Casts a skill at the target',
  21: 'Casts a skill at the attacker',
  28: 'Restores life',
  29: 'Slain monster rests in peace',
  30: 'Casts a skill (no target needed)',
  31: 'Reanimates the slain monster',
};

/** A readable formula for an itemstatcost op (D2MOO D2StatList.cpp, Data Guide op table) */
export function opFormula(op: number, param: number, base: string, stats: readonly string[]): string {
  const target = stats.length === 0 ? '(no stat)' : stats.join(', ');
  const shift = param === 0 ? '' : ` / ${String(2 ** param)}`;
  const by = base === '' ? 'level' : base === 'level' ? 'character level' : base;
  switch (op) {
    case 1:
      return `${target} += ${target} × value / 100`;
    case 2:
      return `${target} += value × ${by}${shift}`;
    case 3:
      return `${target} += ${target} × value × ${by}${shift} / 100`;
    case 4:
      return `${target} (item) += value × ${by}${shift}`;
    case 5:
      return `${target} (item) += ${target} × value × ${by}${shift} / 100`;
    case 6:
      return `${target} += value × time of day`;
    case 7:
      return `${target} += ${target} × value × time of day / 100`;
    case 8:
      return `${target} += value × charstats ManaPerMagic / 4`;
    case 9:
      return `${target} += value × charstats LifePerVitality / StaminaPerVitality / 4`;
    case 11:
      return `${target} += ${target} × value / 100 (unit total)`;
    case 13:
      return `${target} += base ${target} of the item × value / 100`;
    default:
      return `op ${String(op)} on ${target}`;
  }
}

// --- facts ----------------------------------------------------------------------------------------------------------

export const DIFFICULTY_FACTS: readonly { column: string; label: string; unit: ModifierFact['unit']; note?: string }[] = [
  { column: 'ResistPenalty', label: 'Resistance penalty', unit: 'points', note: 'Added to fire, cold, lightning and poison resist.' },
  { column: 'ResistPenaltyNonExpansion', label: 'Resistance penalty (classic)', unit: 'points' },
  { column: 'LifeStealDivisor', label: 'Life leech divisor', unit: 'divisor', note: 'Life leech % is divided by this.' },
  { column: 'ManaStealDivisor', label: 'Mana leech divisor', unit: 'divisor', note: 'Mana leech % is divided by this.' },
  { column: 'DeathExpPenalty', label: 'Experience lost on death', unit: 'percent' },
  { column: 'MonsterSkillBonus', label: 'Monster skill level bonus', unit: 'points' },
  { column: 'MonsterFreezeDivisor', label: 'Freeze length divisor on monsters', unit: 'divisor' },
  { column: 'MonsterColdDivisor', label: 'Chill length divisor on monsters', unit: 'divisor' },
  { column: 'AiCurseDivisor', label: 'Curse length divisor on monsters', unit: 'divisor' },
  { column: 'UniqueDamageBonus', label: 'Unique monster damage', unit: 'percent' },
  { column: 'ChampionDamageBonus', label: 'Champion monster damage', unit: 'percent' },
  { column: 'PlayerDamagePercentVSPlayer', label: 'Player damage vs players', unit: 'percent' },
  { column: 'PlayerDamagePercentVSPrimeEvil', label: 'Player damage vs prime evils', unit: 'percent' },
  { column: 'MercenaryDamagePercentVSMercenary', label: 'Mercenary damage vs mercenaries', unit: 'percent' },
  { column: 'MercenaryDamagePercentVSBoss', label: 'Mercenary damage vs bosses', unit: 'percent' },
  { column: 'PrimeEvilDamagePercentVSMercenary', label: 'Prime evil damage vs mercenaries', unit: 'percent' },
  { column: 'PrimeEvilDamagePercentVSPet', label: 'Prime evil damage vs summons', unit: 'percent' },
  { column: 'MonsterCEDamagePercent', label: 'Corpse Explosion damage of monsters', unit: 'percent' },
  { column: 'MonsterFireEnchantExplosionDamagePercent', label: 'Fire Enchanted explosion damage', unit: 'percent' },
  { column: 'StaticFieldMin', label: 'Static Field floor', unit: 'percent' },
];

const D2MOO = 'D2 engine (D2MOO)';

/** Crushing Blow share of current life per target class in vanilla D2, melee hit (D2MOO SkillItem.cpp EventFunc16) */
const VANILLA_CRUSHING_BLOW: Readonly<Record<string, number>> = {
  monster: 25,
  champion: 25,
  unique: 25,
  super_unique: 12.5,
  act_boss: 12.5,
  minion: 25,
  mercenary: 10,
  player: 10,
};

function round(value: number, digits = 4): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function difficultyFacts(table: TsvTable, warnings: string[]): ModifierFact[] {
  const byName = new Map(table.rows.map((row) => [row.str('Name'), row]));
  const rows = ['Normal', 'Nightmare', 'Hell'].map((name) => byName.get(name));
  if (rows.some((row) => row === undefined)) {
    warnings.push('modifiers: difficultylevels.txt lacks a Normal, Nightmare or Hell row');
    return [];
  }
  return DIFFICULTY_FACTS.flatMap(({ column, label, unit, note }) => {
    if (!table.columns.includes(column)) {
      warnings.push(`modifiers: difficultylevels.txt has no ${column} column`);
      return [];
    }
    const value = rows.map((row) => row?.num(column) ?? 0);
    const vanilla = VANILLA_DIFFICULTY[column] as readonly number[] | undefined;
    const fact: ModifierFact = {
      key: `difficulty.${column}`,
      label,
      value,
      ...(vanilla === undefined ? {} : { vanilla: [...vanilla] }),
      unit,
      origin: 'game-files',
      source: { file: 'difficultylevels.txt', key: column },
    };
    if (note !== undefined) fact.note = note;
    return [fact];
  });
}

/** charstats.txt columns besides BlockFactor that the explanation texts quote, per class */
const CHARSTATS_COLUMNS = [
  { column: 'ToHitFactor', label: 'Class attack rating bonus', unit: 'points' },
  { column: 'WalkVelocity', label: 'Walk speed', unit: 'points' },
  { column: 'RunVelocity', label: 'Run speed', unit: 'points' },
  { column: 'MinimumCastingDelay', label: 'Minimum casting delay', unit: 'frames' },
] as const satisfies readonly { column: string; label: string; unit: ModifierFact['unit'] }[];

function charStatsFacts(table: TsvTable, warnings: string[]): ModifierFact[] {
  const rows = table.rows.filter((row) => row.str('class') !== '');
  const byClass = (column: string) => Object.fromEntries(rows.map((row) => [row.str('class'), row.num(column)]));
  const facts: ModifierFact[] = [
    {
      key: 'charstats.BlockFactor',
      label: 'Class block factor',
      value: byClass('BlockFactor'),
      vanilla: { ...VANILLA_BLOCK_FACTOR },
      unit: 'points',
      origin: 'game-files',
      source: { file: 'charstats.txt', key: 'BlockFactor' },
      note: 'Shield block = (BlockFactor + block) × (Dexterity − 15) / (2 × character level), capped at 75.',
    },
  ];
  for (const { column, label, unit } of CHARSTATS_COLUMNS) {
    if (!table.columns.includes(column)) {
      warnings.push(`modifiers: charstats.txt has no ${column} column`);
      continue;
    }
    facts.push({
      key: `charstats.${column}`,
      label,
      value: byClass(column),
      vanilla: { ...VANILLA_CHARSTATS[column] },
      unit,
      origin: 'game-files',
      source: { file: 'charstats.txt', key: column },
    });
  }
  return facts;
}

function monsterFacts(table: TsvTable): ModifierFact[] {
  const enabled = table.rows.filter((row) => row.str('Id') !== '' && row.num('enabled') === 1);
  const columns = ['Drain', 'Drain(N)', 'Drain(H)'];
  const count = (pick: (drain: number) => boolean) => columns.map((column) => enabled.filter((row) => pick(row.num(column))).length);
  return [
    {
      key: 'monstats.drainZero',
      label: 'Monsters that cannot be leeched',
      value: count((drain) => drain === 0),
      unit: 'count',
      origin: 'game-files',
      source: { file: 'monstats.txt', key: 'Drain / Drain(N) / Drain(H)' },
      note: `Enabled monsters (of ${String(enabled.length)}) whose Drain is 0 or blank, per difficulty: no life or mana leech against them.`,
    },
    {
      key: 'monstats.drainPartial',
      label: 'Monsters with reduced leech',
      value: count((drain) => drain > 0 && drain < 100),
      unit: 'count',
      origin: 'game-files',
      source: { file: 'monstats.txt', key: 'Drain / Drain(N) / Drain(H)' },
      note: 'Enabled monsters whose Drain is between 1 and 99: leech against them is scaled by Drain / 100.',
    },
  ];
}

/** The numbers of a "N -> X %" comment line ("50 -> 12.5 % of current life.") */
function commentShare(comment: readonly string[]): { setting: number; share: number } | null {
  for (const line of comment) {
    const match = /^(\d+(?:\.\d+)?)\s*->\s*(\d+(?:\.\d+)?)\s*%/.exec(line);
    if (match !== null) return { setting: Number(match[1]), share: Number(match[2]) };
  }
  return null;
}

interface ConfigReader {
  doc: TomlDocument;
  file: string;
}

function configFacts(input: ModifiersInput, warnings: string[]): ModifierFact[] {
  const facts: ModifierFact[] = [];
  const read = (name: EsrModifierConfig): ConfigReader | null => {
    const text = input.configs[name];
    const file = modifierConfigFile(name);
    if (text === undefined || text === null) {
      warnings.push(`modifiers: ${file} is missing; its facts are left out`);
      return null;
    }
    const { entries, errors } = parseToml(text);
    for (const error of errors) warnings.push(`modifiers: ${file} ${error}`);
    return { doc: entries, file };
  };
  const value = (config: ConfigReader, path: string): TomlValue | undefined => {
    const entry = config.doc.get(path);
    if (entry === undefined) warnings.push(`modifiers: ${config.file} has no ${path}`);
    return entry?.value;
  };
  const num = (config: ConfigReader, path: string): number | null => {
    const found = value(config, path);
    if (found === undefined) return null;
    if (typeof found === 'boolean') return found ? 1 : 0;
    if (typeof found !== 'number') {
      warnings.push(`modifiers: ${config.file} ${path} is not a number`);
      return null;
    }
    return found;
  };
  const push = (config: ConfigReader, path: string, fact: Omit<ModifierFact, 'origin' | 'source'>) => {
    facts.push({ ...fact, origin: 'esr-config', source: { file: config.file, key: path } });
  };
  const numFact = (config: ConfigReader, path: string, fact: Omit<ModifierFact, 'origin' | 'source' | 'value'>) => {
    const found = num(config, path);
    if (found !== null) push(config, path, { ...fact, value: found });
    return found;
  };
  const boolFact = (config: ConfigReader, path: string, fact: Omit<ModifierFact, 'origin' | 'source' | 'value'>) => {
    const found = value(config, path);
    if (typeof found === 'boolean') push(config, path, { ...fact, value: found });
    else if (found !== undefined) warnings.push(`modifiers: ${config.file} ${path} is not true / false`);
  };
  const record = (config: ConfigReader, paths: Readonly<Record<string, string>>): Record<string, number> | null => {
    const out: Record<string, number> = {};
    for (const [name, path] of Object.entries(paths)) {
      const found = num(config, path);
      if (found === null) return null;
      out[name] = found;
    }
    return out;
  };

  // crushing-blow.toml: percent of the vanilla share per target class, ranged vs melee
  const cb = read('crushing-blow');
  if (cb !== null) {
    boolFact(cb, 'enabled', { key: 'crushingBlow.enabled', label: 'Crushing Blow rework enabled' });
    const settings = record(cb, Object.fromEntries(Object.keys(VANILLA_CRUSHING_BLOW).map((target) => [target, `targets.${target}`])));
    if (settings !== null) {
      const effective = Object.fromEntries(
        Object.entries(settings).map(([target, setting]) => [target, round((VANILLA_CRUSHING_BLOW[target] * setting) / 100)])
      );
      const mismatches = Object.entries(settings).flatMap(([target, setting]) => {
        const comment = commentShare(cb.doc.get(`targets.${target}`)?.comment ?? []);
        if (comment === null || (comment.setting === setting && comment.share === effective[target])) return [];
        return [
          `${target} = ${String(setting)} gives ${String(effective[target])} % of current life, but its config comment says ` +
            `"${String(comment.setting)} -> ${String(comment.share)} %"`,
        ];
      });
      for (const mismatch of mismatches) warnings.push(`modifiers: crushing-blow.toml ${mismatch}`);
      push(cb, 'targets', {
        key: 'crushingBlow.settings',
        label: 'Crushing Blow strength per target, % of vanilla',
        value: settings,
        unit: 'percent',
        note: 'The plugin scales the vanilla share of current life per target class; 100 = vanilla.',
      });
      push(cb, 'targets', {
        key: 'crushingBlow.share',
        label: 'Crushing Blow share of current life per target (melee, one player)',
        value: effective,
        vanilla: { ...VANILLA_CRUSHING_BLOW },
        unit: 'percent',
        note:
          'Vanilla share × setting / 100. Classes do not stack: mercenary → act_boss → super_unique → unique → champion → minion ' +
          '→ monster.' +
          (mismatches.length === 0
            ? ''
            : ` The config comments disagree with the values: ${mismatches.join('; ')}. The value is what the plugin reads.`),
      });
    }
    numFact(cb, 'attack.ranged', {
      key: 'crushingBlow.ranged',
      label: 'Ranged Crushing Blow, % of melee',
      vanilla: 50,
      unit: 'percent',
      note: 'Missile and thrown hits; vanilla halves Crushing Blow for them.',
    });
  }

  // critical-strike-damage.toml: stat 434 adds to the x2 critical multiplier
  const crit = read('critical-strike-damage');
  if (crit !== null) {
    boolFact(crit, 'critical_strike_damage.enabled', { key: 'criticalDamage.enabled', label: 'Deadly Strike Damage stat enabled' });
    numFact(crit, 'critical_strike_damage.stat_id', {
      key: 'criticalDamage.stat',
      label: 'Deadly Strike Damage stat id',
      unit: 'stat',
      note: 'Its value is added to the base multiplier: +50 turns a ×2 critical into ×2.5.',
    });
    numFact(crit, 'critical_strike_damage.base_percent', {
      key: 'criticalDamage.basePercent',
      label: 'Critical multiplier',
      vanilla: 200,
      unit: 'percent',
      note: 'Deadly Strike, Critical Strike and weapon-mastery criticals share one doubling: only one of them applies per hit.',
    });
    numFact(crit, 'critical_strike_damage.max_percent', {
      key: 'criticalDamage.maxPercent',
      label: 'Critical multiplier ceiling',
      unit: 'percent',
    });
    boolFact(crit, 'critical_strike_damage.apply_to_missiles', { key: 'criticalDamage.missiles', label: 'Applies to missiles' });
  }

  // dodge-avoid-evade-cap.toml
  const dodge = read('dodge-avoid-evade-cap');
  if (dodge !== null) {
    const cap = num(dodge, 'dodge_avoid_evade_cap.cap_percent');
    const overrides = record(dodge, {
      dodge: 'dodge_avoid_evade_cap.dodge_cap_percent',
      avoid: 'dodge_avoid_evade_cap.avoid_cap_percent',
      evade: 'dodge_avoid_evade_cap.evade_cap_percent',
    });
    if (cap !== null && overrides !== null) {
      const caps = Object.fromEntries(Object.entries(overrides).map(([name, override]) => [name, override < 0 ? cap : override]));
      push(dodge, 'dodge_avoid_evade_cap.cap_percent', {
        key: 'dodge.cap',
        label: 'Dodge, Avoid and Evade cap',
        value: caps,
        vanilla: { dodge: 100, avoid: 100, evade: 100 },
        unit: 'percent',
        note: 'Per-stat overrides of -1 inherit cap_percent. The stat on items is not changed, only the roll.',
      });
    }
  }

  // cast-rate-cap.toml
  const fcr = read('cast-rate-cap');
  if (fcr !== null) {
    const cap = numFact(fcr, 'cast-rate-cap.fcr_cap', {
      key: 'castRate.cap',
      label: 'Faster Cast Rate cap',
      vanilla: 200,
      unit: 'points',
      note: 'FCR past this point does nothing. Effective FCR = 120 × FCR / (FCR + 120).',
    });
    if (cap !== null)
      push(fcr, 'cast-rate-cap.fcr_cap', {
        key: 'castRate.maxRate',
        label: 'Highest cast animation rate',
        value: 100 + Math.floor((120 * cap) / (cap + 120)),
        vanilla: 175,
        unit: 'percent',
        note: 'Rate = 100 + effective FCR at the cap (derived). Frames = ceil(256 × FramesPerDirection / (AnimationSpeed × rate / 100)) − 1.',
      });
  }

  // magic-find-soft-tail.toml
  const mf = read('magic-find-soft-tail');
  if (mf !== null) {
    const tail = num(mf, 'magic_find_soft_tail.tail_percent');
    const enabled = value(mf, 'magic_find_soft_tail.enabled');
    const overrides = record(mf, {
      unique: 'magic_find_soft_tail.tail_percent_unique',
      set: 'magic_find_soft_tail.tail_percent_set',
      rare: 'magic_find_soft_tail.tail_percent_rare',
    });
    if (tail !== null && overrides !== null) {
      const off = enabled === false;
      push(mf, 'magic_find_soft_tail.tail_percent', {
        key: 'magicFind.tail',
        label: 'Magic Find soft tail, % of raw MF added',
        value: Object.fromEntries(
          Object.entries(overrides).map(([quality, override]) => [quality, off ? 0 : override < 0 ? tail : override])
        ),
        vanilla: { unique: 0, set: 0, rare: 0 },
        unit: 'percent',
        note: 'Effective MF = dim × MF / (MF + dim) + MF × tail / 100 for unique, set and rare items.',
      });
    }
  }

  // attack-rating.toml: the hit chance curve
  const ar = read('attack-rating');
  if (ar !== null) {
    const curve = record(ar, {
      enabled: 'attack_rating.enabled',
      pivotRatio: 'curve.pivot_ratio',
      steepness: 'curve.steepness',
      tail: 'curve.tail',
      lateTail: 'curve.late_tail',
      blendStart: 'curve.blend_start_ratio',
      blendEnd: 'curve.blend_end_ratio',
      snapTo100At: 'curve.snap_to_100_at',
      minChance: 'chance.min_chance',
      maxChance: 'chance.max_chance',
      levelScaling: 'chance.level_scaling',
    });
    if (curve !== null)
      push(ar, 'curve', {
        key: 'attackRating.curve',
        label: 'Hit chance curve',
        value: curve,
        vanilla: {
          enabled: 0,
          pivotRatio: 1,
          steepness: 1,
          tail: 2,
          lateTail: 0,
          blendStart: 0,
          blendEnd: 0,
          snapTo100At: 100,
          minChance: 5,
          maxChance: 95,
          levelScaling: 1,
        },
        unit: 'ratio',
        note:
          'r = attack rating / defense. Below the pivot 100 × r^s / (r^s + pivot^s), above it 50 + 50 × (r − pivot) / ((r − pivot) + tail), ' +
          'the late tail blended in between blendStart and blendEnd; whole percents, snapped to 100 at snapTo100At, then the limits.',
      });
    // The curve table in the comments ("#   r        1   2 …" / "#   chance   0   1 …"): the calculator's test reproduces it
    const commentLines = (input.configs['attack-rating'] ?? '').split(/\r?\n/).map((line) => line.replace(/^\s*#\s*/, ''));
    const ratios = commentLines.find((line) => /^r\s+\d/.test(line));
    const chances = commentLines.find((line) => /^chance\s+\d/.test(line));
    if (ratios !== undefined && chances !== undefined) {
      const r = ratios.trim().split(/\s+/).slice(1).map(Number);
      const c = chances.trim().split(/\s+/).slice(1).map(Number);
      if (r.length === c.length && r.length > 0)
        push(ar, 'curve (comment table)', {
          key: 'attackRating.table',
          label: 'Hit chance at attack rating / defense ratios (config comment)',
          value: Object.fromEntries(r.map((ratio, i) => [String(ratio), c[i]])),
          unit: 'percent',
          note: 'The default curve as the plugin author lists it, before min_chance and max_chance.',
        });
      else warnings.push('modifiers: attack-rating.toml curve table rows differ in length');
    } else warnings.push('modifiers: attack-rating.toml has no curve table comment');
  }

  // bleed.toml
  const bleed = read('bleed');
  if (bleed !== null) {
    boolFact(bleed, 'bleed.enabled', { key: 'bleed.enabled', label: 'Bleed enabled' });
    const stats = record(bleed, {
      min: 'bleed.min_damage_stat',
      max: 'bleed.max_damage_stat',
      length: 'bleed.length_stat',
      state: 'bleed.state_id',
    });
    if (stats !== null)
      push(bleed, 'bleed', {
        key: 'bleed.stats',
        label: 'Bleed stat and state ids',
        value: stats,
        unit: 'stat',
        note:
          'A hit that still deals physical damage rolls a percent from min to max; the bleed deals physical × percent / 100 over the ' +
          'length (frames, 25 per second) averaged over the sources that carry a length. A stronger bleed replaces a weaker one; ' +
          'bleed and poison stack.',
      });
  }

  // weapon-block-rules.toml
  const weaponBlock = read('weapon-block-rules');
  if (weaponBlock !== null) {
    boolFact(weaponBlock, 'enabled', { key: 'weaponBlock.enabled', label: 'Weapon block for every class' });
    for (const [key, path, label] of [
      ['weaponBlock.clawTypes', 'claw_item_types', 'Weapon block: claw item types (one in each hand)'],
      ['weaponBlock.swordTypes', 'sword_item_types', 'Weapon block: sword item types (one in each hand, or one two-handed)'],
    ] as const) {
      const found = value(weaponBlock, path);
      if (Array.isArray(found) && found.every((entry) => typeof entry === 'string'))
        push(weaponBlock, path, { key, label, value: found, note: 'Not capped at 75 like shield block; no weapon block while moving.' });
    }
  }

  // summon-resist-cap.toml
  const summons = read('summon-resist-cap');
  if (summons !== null)
    boolFact(summons, 'enabled', {
      key: 'summonResistCap.enabled',
      label: 'Allied summons have capped resists',
      note: 'Allies (monstats Align 1) use the player caps: 75 + max resist, at most 95; physical 50; no difficulty penalty.',
    });

  // soft-hit-removal.toml
  const softHit = read('soft-hit-removal');
  if (softHit !== null) {
    boolFact(softHit, 'soft_hit_removal.attacker_takes_damage', {
      key: 'thorns.killCredit',
      label: 'Attacker Takes Damage kills count',
      note: 'Thorns kills give kill credit and trigger on-kill effects.',
    });
    boolFact(softHit, 'soft_hit_removal.thorns_percent', { key: 'thorns.percentKillCredit', label: 'Percent thorns kills count' });
  }

  // poison-immunity.toml: the state that blocks poison over time
  const poisonImmunity = read('poison-immunity');
  if (poisonImmunity !== null) {
    boolFact(poisonImmunity, 'poison_immunity.enabled', { key: 'poisonImmunity.enabled', label: 'Poison immunity state enabled' });
    numFact(poisonImmunity, 'poison_immunity.state_id', {
      key: 'poisonImmunity.state',
      label: 'Poison immunity state id',
      unit: 'stat',
      note: 'A unit in this state takes no poison over time.',
    });
  }

  // enhanced-damage-fix.toml
  const edFix = read('enhanced-damage-fix');
  if (edFix !== null)
    boolFact(edFix, 'enhanced_damage_fix.enabled', {
      key: 'enhancedDamageFix.enabled',
      label: 'Off-weapon Enhanced Damage fix enabled',
      note: 'Off-weapon Enhanced Damage is no longer lost when the item (or a jewel in it) also has flat minimum or maximum damage.',
    });

  // item-quantity.toml
  const quantity = read('item-quantity');
  if (quantity !== null) {
    const settings = record(quantity, {
      stat: 'stat_id',
      percent: 'percent',
      excludePrimeEvils: 'exclude_prime_evils',
      creditMinionOwner: 'credit_minion_owner',
      maxBonusPicks: 'max_bonus_picks',
    });
    if (settings !== null)
      push(quantity, 'stat_id', {
        key: 'extraItems.settings',
        label: 'Increased Quantity of Items Found',
        value: settings,
        note: 'percent = 1: the stat is a percent chance of one extra pick from the monster’s own treasure class (150 = one plus 50 %).',
      });
  }

  return facts;
}

function patchFacts(input: ModifiersInput, warnings: string[]): ModifierFact[] {
  const facts: ModifierFact[] = [];
  const read = (name: EsrModifierPatch): { name: string; description: string; patches: { expected?: string; bytes?: string }[] } | null => {
    const text = input.patches[name];
    if (text === undefined || text === null) {
      warnings.push(`modifiers: ${modifierPatchFile(name)} is missing; its facts are left out`);
      return null;
    }
    try {
      return JSON.parse(text.replace(/^\uFEFF/, '')) as {
        name: string;
        description: string;
        patches: { expected?: string; bytes?: string }[];
      };
    } catch {
      warnings.push(`modifiers: ${modifierPatchFile(name)} is not JSON`);
      return null;
    }
  };
  const floor = read('esr-resistance-floor-minus-1000');
  if (floor !== null) {
    // `mov ecx, imm32` (B9 xx xx xx xx): the patched immediate is the floor
    const site = floor.patches.find(
      (patch) => patch.expected?.startsWith('B9 9C FF FF FF') === true && patch.bytes?.startsWith('B9') === true
    );
    const bytes = site?.bytes?.split(' ').slice(1, 5);
    if (bytes?.length === 4) {
      const value = bytes.reduce((sum, byte, i) => sum | (parseInt(byte, 16) << (8 * i)), 0);
      facts.push({
        key: 'resist.floor',
        label: 'Lowest resistance',
        value,
        vanilla: -100,
        unit: 'points',
        origin: 'esr-config',
        source: { file: modifierPatchFile('esr-resistance-floor-minus-1000'), key: 'patches[].bytes (mov ecx, imm32)' },
        note: 'Every unit; the 95 ceiling and the 50 physical cap are unchanged. Damage taken = (100 − resist) %.',
      });
    } else warnings.push('modifiers: esr-resistance-floor-minus-1000.json has no mov ecx floor patch');
  }
  const presence = (name: EsrModifierPatch, key: string, label: string, note: string) => {
    const patch = read(name);
    if (patch !== null)
      facts.push({
        key,
        label,
        value: true,
        vanilla: false,
        origin: 'esr-config',
        source: { file: modifierPatchFile(name), key: 'name' },
        note,
      });
  };
  presence(
    'no-run-penalties',
    'block.noRunPenalty',
    'Running keeps block and defense',
    'Vanilla divides block by 3 while moving and makes attacks always hit a running player; ESR removes both.'
  );
  presence(
    'pet-damage-vs-prime-evil',
    'summons.primeEvilDamage',
    'Summons use the player damage % vs prime evils',
    'Pets hitting a prime evil are scaled by difficultylevels.txt PlayerDamagePercentVSPrimeEvil, like players.'
  );
  return facts;
}

/** Vanilla engine constants the calculators need (D2MOO; not confirmed for ESR) */
function engineFacts(): ModifierFact[] {
  const fact = (
    key: string,
    label: string,
    value: ModifierFact['value'],
    unit: ModifierFact['unit'],
    where: string,
    note?: string
  ): ModifierFact => ({
    key,
    label,
    value,
    unit,
    origin: 'vanilla-engine',
    source: { file: D2MOO, key: where },
    ...(note === undefined ? {} : { note }),
  });
  return [
    fact(
      'magicFind.dim',
      'Magic Find diminishing returns',
      { unique: 250, set: 500, rare: 600 },
      'points',
      'Items.cpp ITEMS_RollQuality',
      'Magic items get the full MF.'
    ),
    fact(
      'leech.precision',
      'Leech precision',
      64,
      'divisor',
      'SUnitDmg.cpp SUNITDMG_ExecuteEvents',
      'Leech is kept in 1/64 of a percent after the divisor: floor(leech × 64 / divisor).'
    ),
    fact('resist.maxBase', 'Resistance cap before maximum resist', 75, 'percent', 'SUnitDmg.cpp SUNITDMG_ApplyResistancesAndAbsorb'),
    fact('resist.hardCap', 'Resistance hard cap', 95, 'percent', 'SUnitDmg.cpp SUNITDMG_ApplyResistancesAndAbsorb'),
    fact('resist.physicalCap', 'Physical resist cap of players', 50, 'percent', 'SUnitDmg.cpp SUNITDMG_ApplyResistancesAndAbsorb'),
    fact('absorb.percentCap', 'Elemental absorb % cap', 40, 'percent', 'SUnitDmg.cpp SUNITDMG_ApplyResistancesAndAbsorb'),
    fact('block.cap', 'Shield block cap', 75, 'percent', 'Units.cpp UNITS_GetBlockRate'),
    fact(
      'monster.hpBonusPerPlayer',
      'Monster life per extra player (/players)',
      50,
      'percent',
      'Monster.cpp MONSTER_GetHpBonus',
      'Crushing Blow against monsters is divided by 1 + this × (players − 1) / 100.'
    ),
    fact(
      'speed.breakpointDivisor',
      'Speed stat diminishing returns',
      { ias: 120, fcr: 120, fhr: 120, fbr: 120, frw: 150 },
      'points',
      'Units.cpp',
      'Effective = k × value / (value + k).'
    ),
  ];
}

// --- stats ------------------------------------------------------------------------------------------------------------

const EXAMPLE_ORDER: readonly ModifierItemKind[] = [
  'runeword',
  'unique',
  'set',
  'setBonus',
  'gemword',
  'socketable',
  'superior',
  'prefix',
  'suffix',
  'automagic',
  'cube',
];
const MAX_EXAMPLES = 12;

/**
 * Titles of generated kinds whose description string misleads: `item_replenish_durability` reads "Repairs %d durability
 * per second", but the game repairs 1 durability every 100 / value seconds (descfunc 11)
 */
const GENERATED_TITLES: Readonly<Partial<Record<string, string>>> = { item_replenish_durability: 'Repairs Durability' };

/** A category for a generated kind, from its stat name */
export function generatedCategory(stat: string): ModifierCategory {
  if (/skill|aura|_tab|classskills|elemskill/.test(stat)) return 'skills';
  if (/regen|recovery|replenish|drain|afterkill|onstriking/.test(stat)) return 'resources';
  if (/resist|armor|absorb|_ac$|defense|block|reduction/.test(stat)) return 'defense';
  if (/dam|tohit|pierce|mastery|length|crush|deadly|wound/.test(stat)) return 'offense';
  if (/^(item_)?(strength|dexterity|vitality|energy|maxhp|maxmana|maxstamina|hp|mana|stamina)/.test(stat)) return 'attributes';
  if (/find|gold|magicbonus|exp/.test(stat)) return 'find';
  if (/rate|velocity|speed/.test(stat)) return 'speed';
  return 'other';
}

export function buildModifiersBundle(input: ModifiersInput): ModifiersResult {
  const warnings: string[] = [];
  const text = (key: string) => (key === '' ? undefined : (input.strings.get(key) ?? key));

  // itemstatcost rows by name
  const rows = new Map<string, { id: number; row: TsvTable['rows'][number] }>();
  input.itemstatcost.rows.forEach((row, id) => {
    const stat = row.str('Stat');
    if (stat !== '' && !rows.has(stat)) rows.set(stat, { id, row });
  });

  // property → stats (property groups expanded through their entries)
  const propertyStatsCache = new Map<string, string[]>();
  const statsOfCode = (code: string, depth = 0): string[] => {
    const cached = propertyStatsCache.get(code);
    if (cached !== undefined) return cached;
    let result: string[] = [];
    const def = input.properties.get(code);
    if (def !== undefined) result = propertyStats(def) ?? def.slots.flatMap((slot) => (slot.stat === '' ? [] : [slot.stat]));
    else {
      const group = input.groups.get(code);
      if (group !== undefined && depth < 4) result = [...new Set(group.entries.flatMap((entry) => statsOfCode(entry.prop, depth + 1)))];
    }
    propertyStatsCache.set(code, result);
    return result;
  };
  const properties = new Map<string, string[]>();
  for (const def of input.properties.values())
    for (const stat of statsOfCode(def.code)) properties.set(stat, [...(properties.get(stat) ?? []), def.code]);

  // usage per stat
  const usage = new Map<string, { counts: Map<ModifierItemKind, number>; examples: Map<ModifierItemKind, string[]>; items: Set<string> }>();
  for (const [index, source] of input.sources.entries()) {
    const stats = new Set(source.mods.flatMap((mod) => statsOfCode(mod.code)));
    for (const stat of stats) {
      let entry = usage.get(stat);
      if (entry === undefined) {
        entry = { counts: new Map(), examples: new Map(), items: new Set() };
        usage.set(stat, entry);
      }
      entry.counts.set(source.kind, (entry.counts.get(source.kind) ?? 0) + 1);
      entry.items.add(String(index));
      const examples = entry.examples.get(source.kind) ?? [];
      // A nameless source (the automagic / suffix rows of item_randomize) still counts, but is no example
      if (source.name !== '' && examples.length < MAX_EXAMPLES && !examples.includes(source.name)) examples.push(source.name);
      entry.examples.set(source.kind, examples);
    }
  }

  // kinds: key kinds first, then the generated ones
  const kindOf = new Map<string, string>();
  for (const kind of KEY_KINDS)
    for (const stat of kind.stats) {
      if (!rows.has(stat)) warnings.push(`modifiers: key kind ${kind.key} names stat ${stat}, which itemstatcost.txt does not have`);
      else if (kindOf.has(stat)) warnings.push(`modifiers: stat ${stat} is in key kinds ${kindOf.get(stat) ?? ''} and ${kind.key}`);
      else kindOf.set(stat, kind.key);
    }
  const included = [...rows.entries()].filter(([stat]) => usage.has(stat) || kindOf.has(stat)).sort((a, b) => a[1].id - b[1].id);

  const generatedKinds = new Map<string, { key: string; title: string; category: ModifierCategory; stats: string[] }>();
  const byText = new Map<string, string>();
  for (const [stat, { row }] of included) {
    if (kindOf.has(stat)) continue;
    const description = text(row.str('descstrpos'));
    const shared = description === undefined ? undefined : byText.get(description);
    if (shared !== undefined) {
      kindOf.set(stat, shared);
      generatedKinds.get(shared)?.stats.push(stat);
      continue;
    }
    const key = `stat-${stat
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')}`;
    const label = GENERATED_TITLES[stat] ?? (description === undefined ? '' : labelFromDescription(description));
    generatedKinds.set(key, {
      key,
      // A description without a word (".%1%0", item_mythicaldesc) is no title: the stat name is
      title: /[a-z]/i.test(label) ? label : stat,
      category: isTechnicalStat(stat) ? 'other' : generatedCategory(stat),
      stats: [stat],
    });
    if (description !== undefined) byText.set(description, key);
    kindOf.set(stat, key);
  }

  const vanilla = new Map(VANILLA_STATS.map(([name, id, columns]) => [name, { id, columns: columns ?? {} }]));
  const vanillaById = new Map(VANILLA_STATS.map(([name, id]) => [id, name]));

  const stats: ModifierStat[] = included.map(([stat, { id, row }]) => {
    const used = usage.get(stat);
    const entry: ModifierStat = {
      id,
      stat,
      kind: kindOf.get(stat) ?? '',
      properties: properties.get(stat) ?? [],
      vanilla: 'esr',
      usage: {},
      items: 0,
      examples: [],
    };
    if (isTechnicalStat(stat)) entry.technical = true;
    const pos = text(row.str('descstrpos'));
    const neg = text(row.str('descstrneg'));
    const second = text(row.str('descstr2'));
    const group = text(row.str('dgrpstrpos'));
    if (pos !== undefined) entry.text = pos;
    if (neg !== undefined && neg !== pos) entry.textNeg = neg;
    if (second !== undefined) entry.text2 = second;
    if (group !== undefined) entry.group = group;
    if (row.num('descfunc') !== 0) entry.descfunc = row.num('descfunc');
    if (row.num('descval') !== 0) entry.descval = row.num('descval');
    const op = row.num('op');
    if (op !== 0) {
      const opStats = ['op stat1', 'op stat2', 'op stat3'].map((column) => row.str(column)).filter((name) => name !== '');
      const result: ModifierStatOp = { op, stats: opStats, formula: '' };
      if (row.num('op param') !== 0) result.param = row.num('op param');
      if (row.str('op base') !== '') result.base = row.str('op base');
      result.formula = opFormula(op, row.num('op param'), row.str('op base'), opStats);
      entry.op = result;
    }
    const events: ModifierStatEvent[] = [];
    for (const n of ['1', '2']) {
      const event = row.str(`itemevent${n}`);
      if (event === '') continue;
      const func = row.num(`itemeventfunc${n}`);
      const trigger = EVENT_TRIGGERS[event] as string | undefined;
      const action = EVENT_FUNCTIONS[func] as string | undefined;
      if (trigger === undefined) warnings.push(`modifiers: stat ${stat} has unknown item event ${event}`);
      if (action === undefined) warnings.push(`modifiers: stat ${stat} has unknown item event function ${String(func)}`);
      events.push({ event, trigger: trigger ?? event, func, action: action ?? `event function ${String(func)}` });
    }
    if (events.length > 0) entry.events = events;

    // vanilla comparison
    const original = vanilla.get(stat);
    if (original === undefined) {
      const reused = vanillaById.get(id);
      if (reused !== undefined) entry.reusesId = reused;
    } else {
      const changed: string[] = [];
      if (original.id !== id) changed.push('id');
      const columns = original.columns as Readonly<Record<string, string | number | undefined>>;
      for (const column of VANILLA_STAT_COLUMNS) {
        const before = String(columns[column] ?? '');
        const after = row.has(column) ? row.str(column) : '';
        const normalise = (value: string) => (value === '0' ? '' : value);
        if (normalise(before) !== normalise(after)) changed.push(column);
      }
      entry.vanilla = changed.length === 0 ? 'same' : 'changed';
      if (changed.length > 0) entry.changed = changed;
    }

    if (used !== undefined) {
      for (const kind of EXAMPLE_ORDER) {
        const count = used.counts.get(kind);
        if (count !== undefined) entry.usage[kind] = count;
      }
      entry.items = used.items.size;
      const examples: [ModifierItemKind, string][] = [];
      // round-robin over the lists in EXAMPLE_ORDER so one list does not take every slot
      for (let round = 0; examples.length < MAX_EXAMPLES && round < MAX_EXAMPLES; round++)
        for (const kind of EXAMPLE_ORDER) {
          const name = used.examples.get(kind)?.[round];
          if (name !== undefined && examples.length < MAX_EXAMPLES) examples.push([kind, name]);
        }
      entry.examples = examples;
    }
    return entry;
  });

  const statIds = new Map(stats.map((entry) => [entry.stat, entry.id]));
  const itemsOf = (names: readonly string[]) => {
    const items = new Set<string>();
    for (const name of names) for (const item of usage.get(name)?.items ?? []) items.add(item);
    return items.size;
  };
  const kinds: ModifierKind[] = [
    ...KEY_KINDS.map((kind) => {
      const present = kind.stats.filter((stat) => statIds.has(stat));
      return {
        key: kind.key,
        title: kind.title,
        category: kind.category,
        stats: present.map((stat) => statIds.get(stat) ?? -1),
        items: itemsOf(present),
      };
    }),
    ...[...generatedKinds.values()].map((kind) => ({
      key: kind.key,
      title: kind.title,
      category: kind.category,
      stats: kind.stats.map((stat) => statIds.get(stat) ?? -1),
      generated: true as const,
      items: itemsOf(kind.stats),
    })),
  ];
  const keys = new Set<string>();
  for (const kind of kinds) {
    if (keys.has(kind.key)) warnings.push(`modifiers: duplicate kind key ${kind.key}`);
    keys.add(kind.key);
  }

  const facts = [
    ...difficultyFacts(input.difficultylevels, warnings),
    ...charStatsFacts(input.charstats, warnings),
    ...monsterFacts(input.monstats),
    ...configFacts(input, warnings),
    ...patchFacts(input, warnings),
    ...engineFacts(),
  ];
  return { bundle: { kinds, stats, facts }, warnings };
}
