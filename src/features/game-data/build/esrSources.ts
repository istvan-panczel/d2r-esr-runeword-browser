import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SKILL_INFO_PAGE_FILE } from './skillInfoPage.ts';
import type { StringsFile } from './strings.ts';

/** Paths inside an Eastern_Sun_Resurrected clone. `excel/base/` is a byte-identical duplicate and is ignored. */
export const ESR_EXCEL_DIR = 'Eastern_Sun_Resurrected.mpq/data/global/excel';
export const ESR_STRINGS_DIR = 'Eastern_Sun_Resurrected.mpq/data/local/lng/strings';
export const ESR_METADATA_FILE = 'd2rloader/metadata.json';
/** D2RLoader plugin config naming uniques dropped by boss sets (Hellfire Torch, …); optional */
export const ESR_BOSS_SET_UNIQUE_DROP_FILE = 'd2rloader/config/celestialrayone.boss-set-unique-drop.toml';
/** D2RLoader plugin config with the superior affix weights and rules (bases.json `superior`); optional */
export const ESR_SUPERIOR_AFFIXES_FILE = 'd2rloader/config/celestialrayone.superior-affixes.toml';
/** D2RLoader plugin config of the Alchemist perks that need engine code (elixirs.json); optional */
export const ESR_ALCHEMY_FILE = 'd2rloader/config/celestialrayone.alchemy.toml';
/** The offline terror zone rotation (terrorzones.json) */
export const ESR_DESECRATED_ZONES_FILE = 'Eastern_Sun_Resurrected.mpq/data/hd/global/excel/desecratedzones.json';
/** D2RLoader plugin configs the modifiers bundle reads its ESR facts from (crushing blow per target, caps, curves …) */
export const ESR_MODIFIER_CONFIGS = [
  'attack-rating',
  'bleed',
  'cast-rate-cap',
  'critical-strike-damage',
  'crossbow-charges',
  'crushing-blow',
  'dodge-avoid-evade-cap',
  'enhanced-damage-fix',
  'extra-curses',
  'item-quantity',
  'jeweler',
  'magic-find-soft-tail',
  'poison-immunity',
  'soft-hit-removal',
  'summon-resist-cap',
  'weapon-block-rules',
] as const;
export type EsrModifierConfig = (typeof ESR_MODIFIER_CONFIGS)[number];
/** D2RLoader memory patches the modifiers bundle reads (resistance floor, no run penalties, pet damage vs prime evils) */
export const ESR_MODIFIER_PATCHES = ['esr-resistance-floor-minus-1000', 'no-run-penalties', 'pet-damage-vs-prime-evil'] as const;
export type EsrModifierPatch = (typeof ESR_MODIFIER_PATCHES)[number];
export const modifierConfigFile = (name: EsrModifierConfig) => `d2rloader/config/celestialrayone.${name}.toml`;
export const modifierPatchFile = (name: EsrModifierPatch) => `d2rloader/patches/${name}.json`;

export const TABLES = [
  'itemtypes',
  'weapons',
  'armor',
  'misc',
  'charstats',
  'runes',
  // Phase 3: affixes + stat renderer
  'magicprefix',
  'magicsuffix',
  'automagic',
  'properties',
  'itemstatcost',
  'propertygroups',
  'skills',
  'skilldesc',
  'monstats',
  'montype',
  // sources.json
  'uniqueitems',
  'setitems',
  'cubemain',
  'treasureclassex',
  'superuniques',
  'gamble',
  // sets.json
  'sets',
  // lootfilter.json (levels: also areas.json and the cube's level names)
  'levels',
  'sounds',
  'gems',
  // skills.json
  'experience',
  // skillcalc.json (skill formulas reading missiles: descmissile, miss('m'.rang))
  'missiles',
  // stash.json (the stash page grid)
  'inventory',
  // terrorzones.json (the names the game's terror zone display uses)
  'levelgroups',
  // modifiers.json (difficulty penalties, leech divisors; superior affixes); bases.json superior
  'difficultylevels',
  'qualityitems',
  // elixirs.json (the shrine names of the Serendipity perk)
  'shrines',
] as const;
export type EsrTableName = (typeof TABLES)[number];

/** Raw text of everything the generator reads from the clone. */
export interface EsrSources {
  esrVersion: string;
  tables: Record<EsrTableName, string>;
  strings: StringsFile[];
  /** Launcher plugin configs (raw text; null when the file is missing) */
  plugins: { bossSetUniqueDrop: string | null; superiorAffixes: string | null; alchemy: string | null };
  /** Plugin configs and memory patches of modifiers.json by name (raw text; null when the file is missing) */
  modifierConfigs: Record<EsrModifierConfig, string | null>;
  modifierPatches: Record<EsrModifierPatch, string | null>;
  /** Raw desecratedzones.json (the terror zone rotation) */
  desecratedZones: string;
  /** Raw docs/skill_information.htm (the official mercenary and oskill page); null when the file is missing */
  skillInfoPage: string | null;
}

/** `metadata.modVersion` of the clone's d2rloader metadata (the ESR version). */
export function readModVersion(esrDir: string): string {
  const parsed: unknown = JSON.parse(readFileSync(join(esrDir, ESR_METADATA_FILE), 'utf8').replace(/^\uFEFF/, ''));
  const metadata = typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>).metadata : undefined;
  const version = typeof metadata === 'object' && metadata !== null ? (metadata as Record<string, unknown>).modVersion : undefined;
  if (typeof version !== 'string' || version === '') throw new Error(`${ESR_METADATA_FILE}: metadata.modVersion missing`);
  return version;
}

/** The clone's string table files (`*.json` under ESR_STRINGS_DIR), sorted by name. */
export function readStringFiles(esrDir: string): StringsFile[] {
  const stringsDir = join(esrDir, ESR_STRINGS_DIR);
  return readdirSync(stringsDir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => ({ name, text: readFileSync(join(stringsDir, name), 'utf8') }));
}

export function readEsrSources(esrDir: string): EsrSources {
  const excelDir = join(esrDir, ESR_EXCEL_DIR);
  const tables = {} as Record<EsrTableName, string>;
  for (const name of TABLES) tables[name] = readFileSync(join(excelDir, `${name}.txt`), 'utf8');

  const strings = readStringFiles(esrDir);

  const pluginFile = join(esrDir, ESR_BOSS_SET_UNIQUE_DROP_FILE);
  const bossSetUniqueDrop = existsSync(pluginFile) ? readFileSync(pluginFile, 'utf8') : null;

  const desecratedZones = readFileSync(join(esrDir, ESR_DESECRATED_ZONES_FILE), 'utf8');

  const optional = (path: string) => (existsSync(join(esrDir, path)) ? readFileSync(join(esrDir, path), 'utf8') : null);
  const modifierConfigs = Object.fromEntries(ESR_MODIFIER_CONFIGS.map((name) => [name, optional(modifierConfigFile(name))])) as Record<
    EsrModifierConfig,
    string | null
  >;
  const modifierPatches = Object.fromEntries(ESR_MODIFIER_PATCHES.map((name) => [name, optional(modifierPatchFile(name))])) as Record<
    EsrModifierPatch,
    string | null
  >;

  const skillInfoFile = join(esrDir, SKILL_INFO_PAGE_FILE);
  const skillInfoPage = existsSync(skillInfoFile) ? readFileSync(skillInfoFile, 'utf8') : null;

  return {
    esrVersion: readModVersion(esrDir),
    tables,
    strings,
    plugins: { bossSetUniqueDrop, superiorAffixes: optional(ESR_SUPERIOR_AFFIXES_FILE), alchemy: optional(ESR_ALCHEMY_FILE) },
    modifierConfigs,
    modifierPatches,
    desecratedZones,
    skillInfoPage,
  };
}
