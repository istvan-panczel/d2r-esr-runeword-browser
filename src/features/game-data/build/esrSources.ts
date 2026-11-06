import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { StringsFile } from './strings.ts';

/** Paths inside an Eastern_Sun_Resurrected clone. `excel/base/` is a byte-identical duplicate and is ignored. */
export const ESR_EXCEL_DIR = 'Eastern_Sun_Resurrected.mpq/data/global/excel';
export const ESR_STRINGS_DIR = 'Eastern_Sun_Resurrected.mpq/data/local/lng/strings';
export const ESR_METADATA_FILE = 'd2rloader/metadata.json';
/** D2RLoader plugin config naming uniques dropped by boss sets (Hellfire Torch, …); optional */
export const ESR_BOSS_SET_UNIQUE_DROP_FILE = 'd2rloader/config/celestialrayone.boss-set-unique-drop.toml';
/** The offline terror zone rotation (terrorzones.json) */
export const ESR_DESECRATED_ZONES_FILE = 'Eastern_Sun_Resurrected.mpq/data/hd/global/excel/desecratedzones.json';

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
  // stash.json (the stash page grid)
  'inventory',
  // terrorzones.json (the names the game's terror zone display uses)
  'levelgroups',
] as const;
export type EsrTableName = (typeof TABLES)[number];

/** Raw text of everything the generator reads from the clone. */
export interface EsrSources {
  esrVersion: string;
  tables: Record<EsrTableName, string>;
  strings: StringsFile[];
  /** Launcher plugin configs (raw text; null when the file is missing) */
  plugins: { bossSetUniqueDrop: string | null };
  /** Raw desecratedzones.json (the terror zone rotation) */
  desecratedZones: string;
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

  return { esrVersion: readModVersion(esrDir), tables, strings, plugins: { bossSetUniqueDrop }, desecratedZones };
}
