/**
 * charsheet.json: the game data of the computed character sheet (src/features/character/engine/sheet/), on top of
 * itemtext.json (saved stat definitions, socket fillers, base requirements). See docs/features/CHARACTER-SAVE.md
 * ("Computed sheet") and docs/features/GAME-DATA.md ("Character sheet").
 *
 * - statNames / valShift / ops: itemstatcost.txt (every row: skill formulas and passive stats name any stat)
 * - classes: charstats.txt life / stamina per vitality, mana per energy (fourths), ToHitFactor, BlockFactor
 * - weaponSpeed / quivers / armor: weapons.txt speed by code, the weapons.txt codes that are not weapons by their item
 *   type (ESR's arrow and bolt quivers, itemtypes.txt Equiv tree: no `weap` ancestor, asserted to be `misl`), armor.txt
 *   speed and block
 * - skills: class skills, every skill an item property names (itemtext.json `skills`) that carries passive or aura
 *   stats (with `range`: attack or cast), and every row and column their passive / aura / to-hit formulas reach
 *   (`collectFormulaRefs`); `shapeshift` when the skill's `aurastate` is a states.txt morph state (`transform` 1,
 *   `gfxtype` 1: Werewolf, Werebear, Elemental Form), with that `aurastate`; `restrict` and `State1-3` (the forms a
 *   skill works in)
 * - sets: sets.txt partial (PCode2a … 5b) and full (FCode1-8) bonuses as saved stats; a save holds only each set item's
 *   own bonus lists, never these
 * - rules: difficultylevels.txt resist penalties, ESR loader plugin settings (Runic Insight, charm dedup, charm
 *   inventory, dodge cap, resistance floor) and engine constants. Constants the files do not hold are asserted against
 *   what the files say about them where they say anything (`assertRules`): a changed source throws here.
 * - ascendancies: celestialrayone.ascendancies.toml (ESR 3.3.04+, the ascendancy panel plugin): the saved stats, the 15
 *   ascendancies in window order (the saved index) with each tier's properties as saved stats (`class-skills` kept as a
 *   value: the class skill property of the character's class, `class_skill_properties`), the Lich King bonus and the old
 *   stone conversion keys. The skills these properties name join `itemSkills` (generateBundles.ts), so the tier 3 / 4
 *   auras stay in `skills`
 */
import type {
  CharSheetAscendancies,
  CharSheetAscendancy,
  CharSheetArmor,
  CharSheetBundle,
  CharSheetClass,
  CharSheetHireling,
  CharSheetRules,
  CharSheetSet,
  CharSheetSkill,
  CharSheetStatOp,
  ItemTextSavedStat,
  SkillCalcRow,
  SpecializationTree,
} from '../engine/schema.ts';
import { CLASS_CODES } from '../engine/schema.ts';
import { ancestorsOf } from '../engine/itemTypes.ts';
import { BASE_SKILLS, collectFormulaRefs, createSource, SKILL_FORMULA_COLUMNS, type FormulaRefs } from '../engine/skillCalc/evaluate.ts';
import { affectsOwner } from '../engine/skillEffects.ts';
import { statLayerKind } from '../engine/statLayers.ts';
import { resolveGroups } from './stats/propertyGroups.ts';
import type { PropertyDef, PropertyGroupDef } from './stats/tables.ts';
import type { BuildResult } from './bundleTypes.ts';
import { parseToml, type TomlValue } from './toml.ts';
import type { TsvRow, TsvTable } from './tsv.ts';

export type SavedStatsReader = (code: string, param: string, min: number, max: number, where: string) => ItemTextSavedStat[];

export interface CharSheetConfigs {
  /** celestialrayone.archaeology.toml (Runic Insight = `socketed_runes`) */
  archaeology: string | null;
  /** celestialrayone.charm-dedup.toml */
  charmDedup: string | null;
  /** charm-inv.toml */
  charmInventory: string | null;
  /** celestialrayone.dodge-avoid-evade-cap.toml */
  dodgeCap: string | null;
  /** patches/esr-resistance-floor-minus-1000.json (gameplay floor) */
  resistFloor: string | null;
  /** patches/esr-resistance-floor-minus-1000-player-display.json (character screen floor; names the cap formula) */
  resistFloorDisplay: string | null;
  /** celestialrayone.ascendancies.toml (the ascendancy panel, ESR 3.3.04+) */
  ascendancies: string | null;
}

export interface CharSheetInput {
  /** Parsed with `keepExpansionRows`: the row number is the stat id */
  itemstatcost: TsvTable;
  /** Parsed with `keepExpansionRows`: the row number is the skill id */
  skills: TsvTable;
  skilldesc: TsvTable;
  /** Without the Expansion marker row: the row number is the class id */
  charstats: TsvTable;
  experience: TsvTable;
  weapons: TsvTable;
  armor: TsvTable;
  /** itemtypes.txt: the Equiv tree tells a weapon (`weap` ancestor) from a quiver listed in weapons.txt */
  itemtypes: TsvTable;
  /** states.txt: `transform` marks the shape-shift states */
  states: TsvTable;
  sets: TsvTable;
  /** Parsed with `keepExpansionRows`: the row number is the set id a save stores */
  setitems: TsvTable;
  hireling: TsvTable;
  difficultylevels: TsvTable;
  /** Skill ids item properties and the ascendancy tiers name (`itemSkillUses` over both, `ascendancyMods`) */
  itemSkills: { owned: ReadonlySet<number>; events: ReadonlySet<number> };
  /** propertygroups.txt: ESR's full set bonuses name groups */
  groups: ReadonlyMap<string, PropertyGroupDef>;
  /** One property → saved stats (itemTextBases.ts `savedStatsReader`) */
  savedStats: SavedStatsReader;
  specializations: readonly SpecializationTree[];
  configs: CharSheetConfigs;
}

const FORMULA_COLUMNS = SKILL_FORMULA_COLUMNS;
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const PASSIVE_SLOTS = range(1, 14);
const AURA_SLOTS = range(1, 6);
const PASSIVE_COLUMNS = [...PASSIVE_SLOTS.flatMap((n) => [`passivestat${String(n)}`, `passivecalc${String(n)}`]), 'passiveitype'];
const AURA_COLUMNS = AURA_SLOTS.flatMap((n) => [`aurastat${String(n)}`, `aurastatcalc${String(n)}`]);
const TO_HIT_COLUMNS = ['ToHit', 'LevToHit', 'ToHitCalc'];
const FORM_COLUMNS = ['restrict', 'State1', 'State2', 'State3'];

/** hireling.txt `HireDesc` → type label (the page labels of build/bundleMercenaries.ts HIRE_DESC, inverted) */
const HIRE_DESC_LABELS: Readonly<Partial<Record<string, string>>> = {
  farw: 'Elemental',
  carw: 'Physical',
  comb: 'Combat',
  def: 'Defensive',
  off: 'Offensive',
  fire: 'Fire',
  cold: 'Cold',
  ltng: 'Lightning',
};

/** Engine constants the ESR files do not hold (D2 rules; see assertRules for what is checked) */
const RESIST_CAP = 75;
const RESIST_CEILING = 95;
const PHYSICAL_RESIST_CAP = 50;
const ANYA_RESIST = 10;
/** The resistance floor patch's description of the upper bound, verbatim: the cap formula the sheet uses */
const CAP_FORMULA = 'min(75+maxresist, 95)';

/** Every cell of a row: numbers as numbers (0 left out), text as text */
function readSkillRow(row: TsvRow, columns: readonly string[], id: string): SkillCalcRow {
  const out: SkillCalcRow = { id };
  for (const column of columns) {
    if (column === 'skill') continue;
    const text = row.str(column);
    if (text === '') continue;
    const value = Number(text);
    if (Number.isNaN(value)) out[column] = text;
    else if (value !== 0) out[column] = value;
  }
  return out;
}

function tomlValues(text: string | null): Map<string, TomlValue> {
  if (text === null) return new Map();
  return new Map([...parseToml(text).entries.values()].map((entry) => [entry.path, entry.value]));
}

const isNumber = (value: TomlValue | undefined): value is number => typeof value === 'number';
const numbers = (value: TomlValue | undefined): number[] => (Array.isArray(value) ? value.filter(isNumber) : []);
const strings = (value: TomlValue | undefined): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];

function readRules(input: CharSheetInput, statIds: ReadonlyMap<string, number>, warnings: string[]): CharSheetRules {
  const penalties = input.difficultylevels.rows.map((row) => row.num('ResistPenalty'));
  if (penalties.length !== 3) throw new Error(`charsheet: difficultylevels.txt has ${String(penalties.length)} rows, expected 3`);

  const archaeology = tomlValues(input.configs.archaeology);
  let runicInsight: CharSheetRules['runicInsight'] = null;
  if (archaeology.get('archaeology.enabled') !== false && archaeology.get('socketed_runes.enabled') === true) {
    const stat = archaeology.get('socketed_runes.perk_stat');
    const percent = archaeology.get('socketed_runes.bonus_percent');
    if (!isNumber(stat) || !isNumber(percent)) throw new Error('charsheet: archaeology socketed_runes has no perk_stat / bonus_percent');
    // The sheet labels the perk by its stat; a renumbered row would silently raise another perk's items
    if (input.itemstatcost.rows[stat]?.str('Stat') !== 'archaeology_3')
      throw new Error(`charsheet: archaeology socketed_runes perk_stat ${String(stat)} is not archaeology_3 in itemstatcost.txt`);
    runicInsight = {
      stat,
      percent,
      runes: strings(archaeology.get('socketed_runes.item_codes')),
      stats: numbers(archaeology.get('socketed_runes.stats')),
      perItemStats: numbers(archaeology.get('socketed_runes.per_item_stats')),
    };
    if (runicInsight.runes.length === 0 || runicInsight.stats.length === 0)
      throw new Error('charsheet: archaeology socketed_runes lists nothing');
  } else if (input.configs.archaeology === null)
    warnings.push('charsheet: celestialrayone.archaeology.toml missing, Runic Insight left out');

  const dedup = tomlValues(input.configs.charmDedup);
  const groups = dedup.get('groups');
  const charmDedup =
    dedup.get('enabled') === false || !Array.isArray(groups)
      ? []
      : groups.map((group) => strings(group)).filter((group) => group.length > 0);
  if (input.configs.charmDedup === null) warnings.push('charsheet: celestialrayone.charm-dedup.toml missing, no charm dedup');

  const charmInventory = tomlValues(input.configs.charmInventory);
  const allowInventory = charmInventory.get('charm-inv.allow_inventory_charms');
  if (typeof allowInventory !== 'boolean') throw new Error('charsheet: charm-inv.toml has no allow_inventory_charms');

  const dodge = tomlValues(input.configs.dodgeCap);
  let dodgeCap: CharSheetRules['dodgeCap'] = null;
  if (dodge.get('dodge_avoid_evade_cap.enabled') === true) {
    const cap = dodge.get('dodge_avoid_evade_cap.cap_percent');
    if (!isNumber(cap)) throw new Error('charsheet: dodge-avoid-evade-cap has no cap_percent');
    const kind = (key: string) => {
      const value = dodge.get(`dodge_avoid_evade_cap.${key}_cap_percent`);
      return isNumber(value) && value >= 0 ? value : cap;
    };
    dodgeCap = { dodge: kind('dodge'), avoid: kind('avoid'), evade: kind('evade') };
  }

  // The floor patches carry the engine's cap formula in their description: the cap constants are checked against it
  const resistFloorDisplay = input.configs.resistFloorDisplay;
  if (resistFloorDisplay !== null && !resistFloorDisplay.includes(CAP_FORMULA))
    throw new Error(`charsheet: the resistance floor display patch no longer describes the cap as "${CAP_FORMULA}"`);
  const resistFloor = input.configs.resistFloor !== null && resistFloorDisplay !== null ? -1000 : -100;

  for (const name of ['maxfireresist', 'damageresist', 'passive_dodge', 'item_maxhp_percent'])
    if (!statIds.has(name)) throw new Error(`charsheet: itemstatcost.txt has no ${name}`);

  return {
    resistPenalty: penalties,
    resistCap: RESIST_CAP,
    resistCeiling: RESIST_CEILING,
    resistFloor,
    physicalResistCap: PHYSICAL_RESIST_CAP,
    anyaResist: ANYA_RESIST,
    dodgeCap,
    runicInsight,
    charmDedup,
    inventoryCharms: allowInventory,
  };
}

/** One ascendancy property as the toml writes it: "code=value", "code[param]=value", "code=min..max", "code[param]=min..max" */
export interface AscendancyMod {
  code: string;
  param: string | null;
  min: number;
  max: number;
}

const ASCENDANCY_MOD = /^([^[\]=\s]+)(?:\[([^\]]*)\])?=(-?\d+)(?:\.\.(-?\d+))?$/;
/** The toml's stand-in for the class skill property of the character's own class */
const CLASS_SKILLS = 'class-skills';
const TIERS = range(1, 5);

function parseAscendancyMod(text: string, where: string): AscendancyMod {
  const match = ASCENDANCY_MOD.exec(text.trim());
  if (match === null) throw new Error(`charsheet: ascendancies ${where}: "${text}" is not code[param]=min..max`);
  const min = Number(match[3]);
  const max = match.at(4);
  // A RegExp group that did not take part is undefined at run time, whatever the type says
  return { code: match[1], param: match.at(2) ?? null, min, max: max === undefined ? min : Number(max) };
}

function ascendancyToml(text: string): Map<string, TomlValue> {
  const { entries, errors } = parseToml(text);
  if (errors.length > 0) throw new Error(`charsheet: celestialrayone.ascendancies.toml: ${errors.join('; ')}`);
  return new Map([...entries.values()].map((entry) => [entry.path, entry.value]));
}

/** The `[[ascendancy]]` blocks in window order (the saved index − 1) */
function ascendancyBlocks(values: ReadonlyMap<string, TomlValue>): number[] {
  const blocks: number[] = [];
  while (values.has(`ascendancy[${String(blocks.length)}].name`)) blocks.push(blocks.length);
  return blocks;
}

/** Every property the ascendancy tiers and the Lich King bonus list (for the skills they name); [] without the file */
export function ascendancyMods(text: string | null): AscendancyMod[] {
  if (text === null) return [];
  const values = ascendancyToml(text);
  const lists = [
    strings(values.get('ascendancies.lich_king')),
    ...ascendancyBlocks(values).flatMap((i) => TIERS.map((tier) => strings(values.get(`ascendancy[${String(i)}].tier${String(tier)}`)))),
  ];
  return lists.flat().flatMap((mod) => {
    const parsed = parseAscendancyMod(mod, 'property');
    return parsed.code === CLASS_SKILLS ? [] : [parsed];
  });
}

function readAscendancies(input: CharSheetInput, statNames: readonly string[], warnings: string[]): CharSheetAscendancies | null {
  const text = input.configs.ascendancies;
  if (text === null) {
    warnings.push('charsheet: celestialrayone.ascendancies.toml missing, no ascendancy bonuses');
    return null;
  }
  const values = ascendancyToml(text);
  if (values.get('ascendancies.enabled') === false) return null;
  const num = (key: string): number => {
    const value = values.get(key);
    if (!isNumber(value)) throw new Error(`charsheet: ascendancies ${key} is not a number`);
    return value;
  };
  const stat = (key: string, name: string): number => {
    const id = num(`ascendancies.${key}`);
    if (statNames[id] !== name) throw new Error(`charsheet: ascendancies ${key} = ${String(id)} is not ${name} in itemstatcost.txt`);
    return id;
  };
  const stats = {
    ascendancy: stat('ascendancy_stat', 'ascendancy'),
    progress: stat('progress_stat', 'ascendancy_progress'),
    soulstones: stat('soulstone_stat', 'ascendancy_soulstones'),
    orb: stat('orb_stat', 'ascendancy_orb'),
  };

  // The class skill property per class, charstats.txt order: one stat each, item_addclassskills with the class as param
  const classProperties = strings(values.get('ascendancies.class_skill_properties'));
  if (classProperties.length !== CLASS_CODES.length || classProperties.some((code, i) => code !== CLASS_CODES[i]))
    throw new Error(`charsheet: ascendancies class_skill_properties [${classProperties.join(', ')}] is not the class order`);
  const classSkills = classProperties.map((code, cls): [number, number] => {
    const saved = input.savedStats(code, '', 1, 1, `ascendancies class_skill_properties ${code}`);
    const only = saved.at(0);
    if (saved.length !== 1 || only === undefined || statNames[only[0]] !== 'item_addclassskills' || only[1] !== cls || only[2] !== 1)
      throw new Error(`charsheet: ascendancies class skill property ${code} is not one class skill stat`);
    return [only[0], only[1]];
  });

  const savedOf = (mods: readonly AscendancyMod[], where: string): ItemTextSavedStat[] => {
    const resolved = resolveGroups(mods, input.groups);
    for (const warning of resolved.warnings) warnings.push(`charsheet: ascendancies ${where}: ${warning}`);
    if (resolved.pools.length > 0) warnings.push(`charsheet: ascendancies ${where}: a random pool is left out`);
    return resolved.mods.flatMap((mod) =>
      input.savedStats(mod.code, mod.param ?? '', mod.min, mod.max, `ascendancies ${where} ${mod.code}`)
    );
  };
  const list = ascendancyBlocks(values).map((i): CharSheetAscendancy => {
    const at = (key: string) => `ascendancy[${String(i)}].${key}`;
    const name = values.get(at('name'));
    if (typeof name !== 'string' || name === '') throw new Error(`charsheet: ascendancies block ${String(i + 1)} has no name`);
    const tiers = TIERS.map((tier) => {
      const where = `${name} tier ${String(tier)}`;
      const value = values.get(at(`tier${String(tier)}`));
      if (!Array.isArray(value)) throw new Error(`charsheet: ascendancies ${where}: no tier${String(tier)} list`);
      const mods = strings(value).map((mod) => parseAscendancyMod(mod, where));
      let classSkillValue = 0;
      for (const mod of mods.filter((entry) => entry.code === CLASS_SKILLS)) {
        if (mod.param !== null || mod.min !== mod.max) throw new Error(`charsheet: ascendancies ${where}: ${CLASS_SKILLS} takes one value`);
        classSkillValue += mod.max;
      }
      return {
        classSkills: classSkillValue,
        stats: savedOf(
          mods.filter((mod) => mod.code !== CLASS_SKILLS),
          where
        ),
      };
    });
    return { index: i + 1, name, legacyUnique: num(at('legacy_unique')), tiers };
  });
  if (list.length === 0) throw new Error('charsheet: celestialrayone.ascendancies.toml has no [[ascendancy]] block');
  const names = new Set(list.map((entry) => entry.name));
  if (names.size !== list.length) throw new Error('charsheet: ascendancies: two blocks share a name');

  const lichKingMods = strings(values.get('ascendancies.lich_king')).map((mod) => parseAscendancyMod(mod, 'lich_king'));
  if (lichKingMods.some((mod) => mod.code === CLASS_SKILLS)) throw new Error(`charsheet: ascendancies lich_king lists ${CLASS_SKILLS}`);
  const tierStats = numbers(values.get('ascendancies.legacy_tier_stats'));
  if (tierStats.length !== 4) throw new Error('charsheet: ascendancies legacy_tier_stats is not the stone stats of tiers 2–5');
  const item = values.get('ascendancies.legacy_stone_item');
  if (typeof item !== 'string' || item === '') throw new Error('charsheet: ascendancies legacy_stone_item missing');

  return {
    stats,
    soulstoneCap: num('ascendancies.soulstone_cap'),
    soulstoneTier: num('ascendancies.soulstone_tier'),
    classSkills,
    lichKing: savedOf(lichKingMods, 'lich_king'),
    legacy: {
      item,
      tierStats,
      soulstoneStat: num('ascendancies.legacy_soulstone_stat'),
      lichKingStat: num('ascendancies.legacy_lich_king_stat'),
    },
    list,
  };
}

function readClasses(charstats: TsvTable): CharSheetClass[] {
  return CLASS_CODES.map((code, classId): CharSheetClass => {
    const row = charstats.rows.at(classId);
    if (row?.str('class').slice(0, 3).toLowerCase() !== code)
      throw new Error(`charsheet: charstats.txt row ${String(classId)} is not class ${code}`);
    return {
      code,
      lifePerVitality: row.num('LifePerVitality'),
      staminaPerVitality: row.num('StaminaPerVitality'),
      manaPerEnergy: row.num('ManaPerMagic'),
      toHitFactor: row.num('ToHitFactor'),
      blockFactor: row.num('BlockFactor'),
    };
  });
}

/** experience.txt by level (the `MaxLvl` row left out); every class column must match, the sheet keeps one list */
function readExperience(table: TsvTable): number[] {
  const levels = table.rows.filter((row) => /^\d+$/.test(row.str('Level')));
  const columns = table.columns.filter((column) => column !== 'Level' && column !== 'ExpRatio');
  const list = levels.map((row) => row.num(columns[0] ?? 'Amazon'));
  for (const column of columns)
    if (levels.some((row, i) => row.num(column) !== list[i]))
      throw new Error(`charsheet: experience.txt column ${column} differs from the others`);
  if (levels.some((row, i) => row.num('Level') !== i)) throw new Error('charsheet: experience.txt levels are not 0, 1, 2 …');
  return list;
}

function readItems(
  weapons: TsvTable,
  armor: TsvTable,
  itemtypes: TsvTable
): { weaponSpeed: Record<string, number>; quivers: string[]; armor: Record<string, CharSheetArmor> } {
  const parents = new Map(itemtypes.rows.filter((row) => row.str('Code') !== '').map((row) => [row.str('Code'), row.list('Equiv', 2)]));
  const weaponSpeed: Record<string, number> = {};
  const quivers: string[] = [];
  for (const row of weapons.rows) {
    const code = row.str('code');
    if (code === '' || code in weaponSpeed) continue;
    weaponSpeed[code] = row.num('speed');
    // ESR lists its magic arrow / bolt quivers in weapons.txt; the hands rule (dual wield) must not take them for weapons
    const ancestors = ancestorsOf([row.str('type'), row.str('type2')], parents);
    if (ancestors.includes('weap')) continue;
    if (!ancestors.includes('misl'))
      throw new Error(`charsheet: weapons.txt ${code} (type ${row.str('type')}) is neither a weapon nor a quiver by itemtypes.txt`);
    quivers.push(code);
  }
  const armorInfo: Record<string, CharSheetArmor> = {};
  const seen = new Set<string>();
  for (const row of armor.rows) {
    const code = row.str('code');
    if (code === '' || seen.has(code)) continue;
    seen.add(code);
    const info: CharSheetArmor = {};
    if (row.num('speed') !== 0) info.speed = row.num('speed');
    if (row.num('block') !== 0) info.block = row.num('block');
    if (Object.keys(info).length > 0) armorInfo[code] = info;
  }
  return { weaponSpeed, quivers: quivers.sort(), armor: armorInfo };
}

function readSkills(input: CharSheetInput, warnings: string[]): CharSheetSkill[] {
  const pages = new Map<string, number>();
  for (const row of input.skilldesc.rows) if (!pages.has(row.str('skilldesc'))) pages.set(row.str('skilldesc'), row.num('SkillPage'));
  const classIds = new Map<string, number>(CLASS_CODES.map((code, i) => [code, i]));
  // A shape-shift state turns the unit into a monster graphic (`transform` 1, `gfxtype` 1: gfxclass is a monstats row);
  // `transform` alone also marks Holy Armor's glow and the Shadow Warrior / Valkyrie disguises (gfxtype 2 or none)
  const shapeStates = new Set(
    input.states.rows.filter((row) => row.num('transform') === 1 && row.num('gfxtype') === 1).map((row) => row.str('state'))
  );

  // Full rows for the formula references (first row of a name wins, as the game's lookup does)
  const full = input.skills.rows.map((row) => readSkillRow(row, input.skills.columns, row.str('skill')));
  const source = createSource(
    full.filter((row) => row.id !== ''),
    []
  );
  const has = (row: SkillCalcRow, columns: readonly string[]) => columns.some((column) => row[column] !== undefined);

  /** Per kept skill: the columns the sheet reads (before the formula references) */
  const columnsById = new Map<number, Set<string>>();
  const meta = new Map<number, { cls?: number; tab?: number; shapeshift?: true }>();
  input.skills.rows.forEach((tsv, id) => {
    const row = full.at(id);
    if (row === undefined || row.id === '') return;
    const cls = classIds.get(tsv.str('charclass'));
    const owned = input.itemSkills.owned.has(id);
    const event = input.itemSkills.events.has(id);
    // Attack, Kick, Throw …: every character has them (hand skills with a to-hit bonus)
    const baseSkill = BASE_SKILLS.has(row.id);
    if (cls === undefined && !owned && !event && !baseSkill) return;
    const columns = new Set<string>();
    const isPassive = row.passive === 1;
    if (isPassive && has(row, PASSIVE_COLUMNS)) for (const column of ['passive', 'passivestate', ...PASSIVE_COLUMNS]) columns.add(column);
    // Aura and passive stats of a skill that reaches its owner: item auras, own auras and buffs, oskills, self-buff procs
    const reachesOwner = affectsOwner(row, 'cast') || (owned && affectsOwner(row, 'item-aura'));
    if (reachesOwner && has(row, [...AURA_COLUMNS, ...PASSIVE_COLUMNS])) {
      for (const column of ['passive', 'passivestate', 'aura', 'aurafilter', ...AURA_COLUMNS, ...PASSIVE_COLUMNS]) columns.add(column);
      // Whether it attacks with the weapon in hand (`h2h`, `rng`, `both`) or is cast (`none`, `loc`): a buff cast on the
      // other weapon set is kept after swapping back only when it is cast (character/engine/sheet/otherSet.ts)
      if (row.range !== undefined) columns.add('range');
    }
    if ((cls !== undefined || owned || baseSkill) && has(row, TO_HIT_COLUMNS)) for (const column of TO_HIT_COLUMNS) columns.add(column);
    // Which hand(s) the skill attacks with: the sheet gives an off-hand attack rating line only to one using the off hand
    if ((cls !== undefined || owned || baseSkill) && row.weapsel !== undefined) columns.add('weapsel');
    if (cls === undefined && !baseSkill && columns.size === 0) return;
    const shapeshift = shapeStates.has(tsv.str('aurastate')) ? { shapeshift: true as const } : {};
    // Which form the skill works in (character/engine/sheet/forms.ts): `restrict` blank = unshifted only, 1 = any form,
    // 2 = only in the State1-3 forms; a shape-shift's own state names its form
    for (const column of FORM_COLUMNS) if (row[column] !== undefined) columns.add(column);
    if ('shapeshift' in shapeshift) columns.add('aurastate');
    columnsById.set(id, columns);
    if (cls !== undefined) {
      const page = pages.get(tsv.str('skilldesc')) ?? 0;
      meta.set(id, { ...(page > 0 ? { cls, tab: page } : { cls }), ...shapeshift });
    } else if ('shapeshift' in shapeshift) meta.set(id, shapeshift);
  });

  const refs: FormulaRefs = { skills: new Map(), missiles: new Map() };
  for (const [id, columns] of columnsById) {
    const row = full.at(id);
    if (row === undefined) continue;
    for (const column of columns) {
      const text = row[column];
      if (FORMULA_COLUMNS.has(column) && typeof text === 'string') collectFormulaRefs(source, row, text, refs);
    }
  }
  if (refs.missiles.size > 0) warnings.push(`charsheet: skill formulas read missiles (${[...refs.missiles.keys()].join(', ')}), left out`);
  const idByName = new Map<string, number>();
  full.forEach((row, id) => {
    if (row.id !== '' && !idByName.has(row.id)) idByName.set(row.id, id);
  });
  for (const [name, columns] of refs.skills) {
    const id = idByName.get(name);
    if (id === undefined) continue;
    const set = columnsById.get(id) ?? new Set<string>();
    for (const column of columns) set.add(column);
    columnsById.set(id, set);
  }

  return [...columnsById.keys()]
    .sort((a, b) => a - b)
    .flatMap((id): CharSheetSkill[] => {
      const row = full.at(id);
      const columns = columnsById.get(id);
      if (row === undefined || columns === undefined) return [];
      const out: SkillCalcRow = { id: row.id };
      for (const column of [...columns].sort()) {
        const value = row[column];
        if (value !== undefined) out[column] = value;
      }
      return [{ n: id, ...meta.get(id), row: out }];
    });
}

/**
 * The skills item properties name, by how: `owned` = a skill-layer stat (item_aura, oskills, single skills), `events`
 * = an event-layer stat (skill on hit / attack / kill …: a proc)
 */
export function itemSkillUses(
  mods: readonly { code: string; param: string | null }[],
  properties: ReadonlyMap<string, PropertyDef>,
  skillId: (param: string) => number | null
): { owned: Set<number>; events: Set<number> } {
  const owned = new Set<number>();
  const events = new Set<number>();
  for (const mod of mods) {
    if (mod.param === null || mod.param === '') continue;
    for (const slot of properties.get(mod.code)?.slots ?? []) {
      if (slot.func === 12) continue;
      const kind = statLayerKind(slot.stat);
      const id = kind === 'skill' || kind === 'event' ? skillId(mod.param) : null;
      if (id === null) continue;
      (kind === 'skill' ? owned : events).add(id);
    }
  }
  return { owned, events };
}

function readSets(input: CharSheetInput, warnings: string[]): { setItems: number[]; sets: CharSheetSet[] } {
  const keys = input.sets.rows.map((row) => row.str('index'));
  const index = new Map(keys.map((key, i) => [key, i]));
  const setItems = input.setitems.rows.map((row) => index.get(row.str('set')) ?? -1);
  const counts = new Map<number, number>();
  for (const set of setItems) if (set >= 0) counts.set(set, (counts.get(set) ?? 0) + 1);
  const sets = input.sets.rows.map((row, i): CharSheetSet => {
    const key = keys[i] ?? '';
    const stats = (code: string, param: string, min: number, max: number): ItemTextSavedStat[] => {
      if (code === '') return [];
      const resolved = resolveGroups([{ code, param: param === '' ? null : param, min, max }], input.groups);
      for (const warning of resolved.warnings) warnings.push(`charsheet: sets ${key}: ${warning}`);
      if (resolved.pools.length > 0) warnings.push(`charsheet: sets ${key} ${code}: a random pool is left out`);
      return resolved.mods.flatMap((mod) => input.savedStats(mod.code, mod.param ?? '', mod.min, mod.max, `sets ${key} ${mod.code}`));
    };
    const partial = range(2, 5).flatMap((pieces) => {
      const list = ['a', 'b'].flatMap((ab) => {
        const at = (part: string) => `${part}${String(pieces)}${ab}`;
        return stats(row.str(at('PCode')), row.str(at('PParam')), row.num(at('PMin')), row.num(at('PMax')));
      });
      return list.length === 0 ? [] : [{ pieces, stats: list }];
    });
    const full = range(1, 8).flatMap((n) => {
      const at = (part: string) => `${part}${String(n)}`;
      return stats(row.str(at('FCode')), row.str(at('FParam')), row.num(at('FMin')), row.num(at('FMax')));
    });
    return { key, items: counts.get(i) ?? 0, partial, full };
  });
  return { setItems, sets };
}

function readHirelings(table: TsvTable, warnings: string[]): CharSheetHireling[] {
  const byId = new Map<number, CharSheetHireling>();
  for (const row of table.rows) {
    if (row.num('Version') !== 100) continue;
    const id = row.num('Id');
    const entry: CharSheetHireling = {
      id,
      name: row.str('Hireling'),
      subtype: HIRE_DESC_LABELS[row.str('HireDesc')] ?? row.str('HireDesc'),
      act: row.num('Act'),
      difficulty: row.num('Difficulty') - 1,
      expPerLevel: row.num('Exp/Lvl'),
    };
    const seen = byId.get(id);
    if (seen === undefined) byId.set(id, entry);
    else if (JSON.stringify(seen) !== JSON.stringify(entry))
      warnings.push(`charsheet: hireling.txt Id ${String(id)} rows differ, the first is kept`);
    if (HIRE_DESC_LABELS[row.str('HireDesc')] === undefined)
      warnings.push(`charsheet: hireling.txt HireDesc "${row.str('HireDesc')}" has no label`);
  }
  return [...byId.values()].sort((a, b) => a.id - b.id);
}

export function buildCharSheetBundle(input: CharSheetInput): BuildResult<CharSheetBundle> {
  const warnings: string[] = [];
  const statNames = input.itemstatcost.rows.map((row) => row.str('Stat'));
  const statIds = new Map<string, number>();
  statNames.forEach((name, id) => {
    if (name !== '' && !statIds.has(name)) statIds.set(name, id);
  });
  const valShift: Record<string, number> = {};
  const ops: CharSheetStatOp[] = [];
  const statId = (name: string, where: string): number[] => {
    if (name === '') return [];
    const id = statIds.get(name);
    if (id === undefined) warnings.push(`charsheet: ${where} names unknown stat "${name}"`);
    return id === undefined ? [] : [id];
  };
  input.itemstatcost.rows.forEach((row, id) => {
    if (row.num('ValShift') !== 0) valShift[String(id)] = row.num('ValShift');
    const op = row.num('op');
    if (op === 0) return;
    const where = `itemstatcost ${statNames[id] ?? String(id)}`;
    ops.push({
      id,
      op,
      param: row.num('op param'),
      base: statId(row.str('op base'), where)[0] ?? null,
      targets: ['op stat1', 'op stat2', 'op stat3'].flatMap((column) => statId(row.str(column), where)),
    });
  });

  const skills = readSkills(input, warnings);
  // A passive with a weapon-type gate needs code the sheet does not have
  for (const skill of skills)
    if (skill.cls !== undefined && skill.row.passive === 1 && skill.row.passiveitype !== undefined)
      throw new Error(
        `charsheet: class passive ${skill.row.id} has passiveitype ${String(skill.row.passiveitype)}: the sheet ignores weapon gates`
      );

  const { setItems, sets } = readSets(input, warnings);
  return {
    bundle: {
      statNames,
      valShift,
      ops,
      classes: readClasses(input.charstats),
      experience: readExperience(input.experience),
      ...readItems(input.weapons, input.armor, input.itemtypes),
      skills,
      setItems,
      sets,
      hirelings: readHirelings(input.hireling, warnings),
      specializations: input.specializations.map((tree) => ({
        slug: tree.slug,
        name: tree.name,
        stats: tree.perks.map((perk) => perk.stat),
      })),
      rules: readRules(input, statIds, warnings),
      ascendancies: readAscendancies(input, statNames, warnings),
    },
    warnings,
  };
}
