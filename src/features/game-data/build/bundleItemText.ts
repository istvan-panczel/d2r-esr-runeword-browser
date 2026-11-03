/**
 * itemtext.json: what the My Stash "All items" page needs to write an item's tooltip text and name from its saved
 * stats (src/features/stash/engine/items/itemText.ts renders them with engine/stats). Loaded lazily, only on
 * /stash/items, so it carries only what saved items can show:
 *
 * - the display columns of the stats a save can hold (itemstatcost.txt rows with Save Bits > 0), by stat id
 * - the string-table texts those stats and renderLines read (the closure: no description key is missing)
 * - skill names and classes by skill id, the class skill strings, monster and monster type names by row (the params
 *   of descfunc 22 / 23)
 * - the magic prefix / suffix and automagic names by the 1-based ids a save stores, the rare name table, the inferior
 *   and superior name prefixes
 * - the set bonus piece counts of the set items whose bonus lists are not the plain 2, 3, 4… pieces
 *
 * ESR ships no rareprefix.txt / raresuffix.txt: the game falls back to the vanilla tables, so their name keys are a
 * constant here (RARE_SUFFIX_KEYS, RARE_PREFIX_KEYS, in file order); the texts are in ESR's string table.
 */
import type { ItemTextBundle, ItemTextStatDef } from '../engine/schema.ts';
import { RENDER_LINES_STRINGS } from '../engine/stats/renderLines.ts';
import { statLayerKind } from '../engine/statLayers.ts';
import type { BuildResult } from './bundleTypes.ts';
import { createSkillLookup } from './stats/skills.ts';
import type { StatTables } from './stats/tables.ts';
import type { TsvTable } from './tsv.ts';

/** A property of a game-data property list (affix, unique, set item, runeword, cube output …) */
export interface ItemTextMod {
  code: string;
  param: string | null;
}

export interface ItemTextInput {
  /** Parsed with `keepExpansionRows`: the row number is the stat id */
  itemstatcost: TsvTable;
  /** Parsed with `keepExpansionRows`: the row number - 1 is the id a save stores */
  magicprefix: TsvTable;
  magicsuffix: TsvTable;
  automagic: TsvTable;
  /** Parsed with `keepExpansionRows`: the row number is the set item id a save stores */
  setitems: TsvTable;
  /** build/stats/statRenderer.ts `readStatTables` (monstats without its Expansion row: the row is the monster id) */
  statTables: StatTables;
  /** Skill ids to list besides the class skills and the skills `mods` name (lootfilter.json `skills`: the class trees) */
  skillIds: Iterable<number>;
  /**
   * Every property list the game data puts on items: the skills of the skill / event / charged stats and the monster
   * params of descfunc 23 stats are collected from it
   */
  mods: readonly (ItemTextMod & { min?: number; max?: number })[];
}

/** Vanilla raresuffix.txt `name` keys in file order: rare name ids 1-155 */
export const RARE_SUFFIX_KEYS: readonly string[] = [
  'bite', 'scratch', 'scalpel', 'fang', 'gutter', 'thirst', 'razor', 'scythe', 'edge', 'saw',
  'splitter', 'cleaver', 'sever', 'sunder', 'rend', 'mangler', 'slayer', 'reaver', 'spawn', 'gnash',
  'star', 'blow', 'smasher', 'Bane', 'crusher', 'breaker', 'grinder', 'crack', 'mallet', 'knell',
  'lance', 'spike', 'impaler', 'skewer', 'prod', 'scourge', 'wand', 'wrack', 'barb', 'needle',
  'dart', 'bolt', 'quarrel', 'fletch', 'flight', 'nock', 'horn', 'stinger', 'quill', 'goad',
  'branch', 'spire', 'song', 'call', 'cry', 'spell', 'chant', 'weaver', 'gnarl', 'visage',
  'crest', 'circlet', 'veil', 'hood', 'mask', 'brow', 'casque', 'visor', 'cowl', 'hide',
  'Pelt', 'carapace', 'coat', 'wrap', 'suit', 'cloak', 'shroud', 'jack', 'mantle', 'guard',
  'badge', 'rock', 'aegis', 'ward', 'tower', 'shield', 'wing', 'mark', 'emblem', 'hand',
  'fist', 'claw', 'clutches', 'grip', 'grasp', 'hold', 'touch', 'finger', 'knuckle', 'shank',
  'spur', 'tread', 'stalker', 'greave', 'blazer', 'nails', 'trample', 'Brogues', 'track', 'slippers',
  'clasp', 'buckle', 'harness', 'lock', 'fringe', 'winding', 'chain', 'strap', 'lash', 'cord',
  'knot', 'circle', 'loop', 'eye', 'turn', 'spiral', 'coil', 'gyre', 'band', 'whorl',
  'talisman', 'heart', 'noose', 'necklace', 'collar', 'beads', 'torc', 'gorget', 'scarab', 'wood',
  'brand', 'bludgeon', 'cudgel', 'loom', 'harp', 'master', 'barRI', 'hew', 'crook', 'mar',
  'shell', 'stake', 'picket', 'pale', 'flange',
]; // prettier-ignore

/** Vanilla rareprefix.txt `name` keys in file order: rare name ids 156-201 (after the suffix block) */
export const RARE_PREFIX_KEYS: readonly string[] = [
  'Beast', 'Eagle', 'Raven', 'Viper', 'GhoulRI', 'Skull', 'Blood', 'Dread', 'Doom', 'Grim',
  'Bone', 'Death', 'Shadow', 'Storm', 'Rune', 'PlagueRI', 'Stone', 'Wraithra', 'Spirit', 'Storm',
  'Demon', 'Cruel', 'Empyrion', 'Bramble', 'Pain', 'Loath', 'Glyph', 'Imp', 'Fiendra', 'Hailstone',
  'Gale', 'Dire', 'Soul', 'Brimstone', 'Corpse', 'Carrion', 'Holocaust', 'Havoc', 'Bitter', 'Entropy',
  'Chaos', 'Order', 'Rule', 'Warp', 'Rift', 'Corruption',
]; // prettier-ignore

/** Vanilla lowqualityitems.txt `Name` keys (ESR has no such table): the inferior quality variants 0-3 */
export const LOW_QUALITY_KEYS: readonly string[] = ['Crude', 'Cracked', 'Damaged', 'Low Quality'];
/** The superior name prefix key */
export const SUPERIOR_KEY = 'Hiquality';

/**
 * Strings the item text reads besides the stat descriptions and renderLines' own: the physical / magic damage range
 * labels of the stat filters (`g.dmg-phys`, `g.dmg-magic`)
 */
export const ITEM_TEXT_STRINGS: readonly string[] = ['strModMinDamageRange', 'strModMagicDamageRange'];

/** Set bonus groups aprop1-5 (a / b): group N is active with N + 1 items of the set worn */
const SET_BONUS_GROUPS = [1, 2, 3, 4, 5];

/**
 * A stat's display columns without the blank / zero ones, and without `descstrneg` / `dgrpstrneg` when they equal
 * the positive string (the renderer falls back to it for a blank one)
 */
function statDef(row: TsvTable['rows'][number]): ItemTextStatDef {
  const full = {
    stat: row.str('Stat'),
    op: row.num('op'),
    opParam: row.num('op param'),
    descpriority: row.num('descpriority'),
    descfunc: row.num('descfunc'),
    descval: row.num('descval'),
    descstrpos: row.str('descstrpos'),
    descstrneg: row.str('descstrneg'),
    descstr2: row.str('descstr2'),
    dgrp: row.num('dgrp'),
    dgrpfunc: row.num('dgrpfunc'),
    dgrpval: row.num('dgrpval'),
    dgrpstrpos: row.str('dgrpstrpos'),
    dgrpstrneg: row.str('dgrpstrneg'),
    dgrpstr2: row.str('dgrpstr2'),
  };
  const def: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(full)) {
    if (value === '' || value === 0) continue;
    if ((key === 'descstrneg' && value === full.descstrpos) || (key === 'dgrpstrneg' && value === full.dgrpstrpos)) continue;
    def[key] = value;
  }
  return def as unknown as ItemTextStatDef;
}

/** The string-table keys a stat definition reads */
export function statStringKeys(def: ItemTextStatDef): string[] {
  return [def.descstrpos, def.descstrneg, def.descstr2, def.dgrpstrpos, def.dgrpstrneg, def.dgrpstr2].flatMap((key) =>
    key === undefined || key === '' ? [] : [key]
  );
}

export function buildItemTextBundle(input: ItemTextInput, strings: ReadonlyMap<string, string>): BuildResult<ItemTextBundle> {
  const warnings: string[] = [];
  const text = (key: string): string | null => {
    if (key === '') return null;
    const value = strings.get(key);
    return value === undefined || value === '' ? null : value;
  };

  const stats = input.itemstatcost.rows.map((row) => (row.num('Save Bits') > 0 && row.str('Stat') !== '' ? statDef(row) : null));

  const used = new Set<string>([...RENDER_LINES_STRINGS, ...ITEM_TEXT_STRINGS]);
  for (const def of stats) if (def !== null) for (const key of statStringKeys(def)) used.add(key);
  const bundleStrings: Record<string, string> = {};
  for (const key of [...used].sort()) {
    const value = strings.get(key);
    if (value === undefined) warnings.push(`itemtext: string "${key}" (stat description) not found`);
    else bundleStrings[key] = value;
  }

  const lookup = createSkillLookup(input.statTables, strings);
  const ids = new Set(input.skillIds);
  input.statTables.skills.forEach((row, id) => {
    if (row.charclass !== '' && lookup.classIndex(row.charclass) !== null) ids.add(id);
  });
  // The skills a property puts on items, by name or id: lootfilter.json leaves out ids above 1023 (the plugin's
  // layer encoding cannot hold them), but a save stores them (event / charged params are `skill << 6 | level` in 32
  // bits: Long Shot 1555, Delirium Proc 1557)
  for (const mod of input.mods) {
    for (const slot of input.statTables.properties.get(mod.code)?.slots ?? []) {
      const kind = statLayerKind(slot.stat);
      if (slot.func === 12 && mod.min !== undefined && mod.max !== undefined) {
        // random class skill: min-max is the skill id range
        for (let id = mod.min; id <= mod.max && id - mod.min < 400; id++) ids.add(id);
      } else if ((kind === 'skill' || kind === 'event' || kind === 'charged') && mod.param !== null) {
        const id = lookup.skillId(mod.param);
        if (id !== null) ids.add(id);
      }
    }
  }
  const skills = [...ids]
    .sort((a, b) => a - b)
    .flatMap((id) => {
      const info = lookup.skill(String(id));
      return info === null ? [] : [{ id, name: info.name, ...(info.cls === null ? {} : { cls: info.cls }) }];
    });
  const classes = input.statTables.classes.flatMap((_, index) => {
    const cls = lookup.classText(index);
    return cls === null ? [] : [cls];
  });

  // descfunc 23 (ESR's mythical descriptions, reanimate): the param is a monstats row whose NameStr holds the text
  const monsterStats = new Set(stats.flatMap((def) => (def !== null && def.descfunc === 23 ? [def.stat] : [])));
  const monsterIds = new Set<number>();
  const byName = new Set<string>();
  for (const mod of input.mods) {
    const slots = input.statTables.properties.get(mod.code)?.slots ?? [];
    if (!slots.some((slot) => monsterStats.has(slot.stat)) || mod.param === null) continue;
    if (/^\d+$/.test(mod.param)) monsterIds.add(Number(mod.param));
    else byName.add(`${mod.code} ${mod.param}`);
  }
  for (const entry of byName) warnings.push(`itemtext: property "${entry}" names a monster by name, not by id`);
  const monsters: (string | null)[] = Array.from({ length: Math.max(-1, ...monsterIds) + 1 }, () => null);
  for (const id of monsterIds) {
    const name = text(input.statTables.monsterNames.at(id) ?? '');
    if (name === null) warnings.push(`itemtext: monster ${String(id)} has no name text`);
    else monsters[id] = name;
  }

  // like affixes.json: the string, else the raw name; blank and "null" placeholder names are null
  const affixName = (key: string): string | null =>
    key === '' ? null : (text(key)?.trim() ?? (key.toLowerCase() === 'null' ? null : key));
  const names = (table: TsvTable) => [null, ...table.rows.map((row) => affixName(row.str('Name')))];

  const rareKey = (key: string): string | null => {
    const value = text(key);
    if (value === null) warnings.push(`itemtext: rare name "${key}" not found`);
    return value;
  };
  const rareNames = [null, ...RARE_SUFFIX_KEYS.map(rareKey), ...RARE_PREFIX_KEYS.map(rareKey)];

  const setBonusPieces: Record<string, number[]> = {};
  input.setitems.rows.forEach((row, id) => {
    if (row.str('index') === '') return;
    const pieces = SET_BONUS_GROUPS.filter(
      (group) => row.str(`aprop${String(group)}a`) !== '' || row.str(`aprop${String(group)}b`) !== ''
    ).map((group) => group + 1);
    if (pieces.some((count, i) => count !== i + 2)) setBonusPieces[String(id)] = pieces;
  });

  return {
    bundle: {
      stats,
      strings: bundleStrings,
      skills,
      classes,
      monsters,
      monTypes: input.statTables.monTypeNames.map((key) => text(key)),
      magicPrefixes: names(input.magicprefix),
      magicSuffixes: names(input.magicsuffix),
      autoAffixes: names(input.automagic),
      rareNames,
      lowQuality: LOW_QUALITY_KEYS.map((key) => text(key) ?? key),
      superior: text(SUPERIOR_KEY) ?? 'Superior',
      setBonusPieces,
    },
    warnings,
  };
}
