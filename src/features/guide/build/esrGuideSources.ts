/**
 * The ESR tables the guide directives read (cube recipes, vendors, difficulty penalties), parsed into small typed
 * shapes. `readEsrGuideSources` does the fs work; `buildEsrGuideTables` is pure so tests can feed inline TSV fixtures.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ESR_EXCEL_DIR, readModVersion, readStringFiles } from '../../game-data/build/esrSources.ts';
import {
  buildCubeNames,
  cubeModRenderer,
  numberOf,
  readCube,
  readCubeItem,
  type CubeItem,
  type CubeTables,
  type ModRenderer,
} from '../../game-data/build/cube/cubeRows.ts';
import { STAT_TABLES, type StatTableName } from '../../game-data/build/stats/statRenderer.ts';
import { buildStringTable, type StringsFile } from '../../game-data/build/strings.ts';
import { parseTsv, type TsvTable } from '../../game-data/build/tsv.ts';

export const GUIDE_TABLES = ['cubemain', 'misc', 'armor', 'weapons', 'itemtypes', 'difficultylevels'] as const;
export type GuideTableName = (typeof GUIDE_TABLES)[number];

export interface EsrGuideSources {
  esrVersion: string;
  tables: Record<GuideTableName, string>;
  /** The game-data stat renderer's tables (properties, itemstatcost, …), for the bonuses of cube outputs */
  statTables: Record<StatTableName, string>;
  strings: StringsFile[];
}

export interface VendorOffer {
  npc: string;
  /** Only sold as a magic item */
  magicOnly: boolean;
}

export interface EsrItem extends CubeItem {
  vendors: VendorOffer[];
}

export interface DifficultyRow {
  name: string;
  resistPenalty: number;
  deathExpPenalty: number;
  monsterSkillBonus: number;
}

export interface EsrGuideTables extends CubeTables {
  items: EsrItem[];
  /** Vendor column prefixes, e.g. `Gheed` */
  npcs: string[];
  difficulties: DifficultyRow[];
}

export function readEsrGuideSources(esrDir: string): EsrGuideSources {
  const excelDir = join(esrDir, ESR_EXCEL_DIR);
  const tables = {} as Record<GuideTableName, string>;
  for (const name of GUIDE_TABLES) tables[name] = readFileSync(join(excelDir, `${name}.txt`), 'utf8');
  const statTables = {} as Record<StatTableName, string>;
  for (const name of STAT_TABLES) statTables[name] = readFileSync(join(excelDir, `${name}.txt`), 'utf8');
  return { esrVersion: readModVersion(esrDir), tables, statTables, strings: readStringFiles(esrDir) };
}

/** Anchors (`id="…"` / `name="…"`) per file of the clone's docs/ folder (the official site); null without docs. */
export function readDocsIndex(esrDir: string): Map<string, Set<string>> | null {
  const docsDir = join(esrDir, 'docs');
  if (!existsSync(docsDir)) return null;
  const index = new Map<string, Set<string>>();
  for (const name of readdirSync(docsDir)) {
    index.set(name, /\.html?$/i.test(name) ? anchorsOf(readFileSync(join(docsDir, name), 'utf8')) : new Set());
  }
  return index;
}

function anchorsOf(html: string): Set<string> {
  return new Set([...html.matchAll(/\b(?:id|name)\s*=\s*["']([^"']*)["']/gi)].map((match) => match[1]));
}

function vendorNpcs(table: TsvTable): string[] {
  return table.columns.filter((column) => /^[A-Z][a-z]+Min$/.test(column) && column !== 'TMogMin').map((column) => column.slice(0, -3));
}

function readItems(table: TsvTable, kind: EsrItem['kind'], npcs: readonly string[], strings: ReadonlyMap<string, string>): EsrItem[] {
  return table.rows.map((row) => {
    const vendors: VendorOffer[] = [];
    for (const npc of npcs) {
      const max = numberOf(row, `${npc}Max`);
      const magicMax = numberOf(row, `${npc}MagicMax`);
      if (max > 0 || magicMax > 0) vendors.push({ npc, magicOnly: max <= 0 });
    }
    return { ...readCubeItem(row, kind, strings), vendors };
  });
}

/**
 * `renderMods` overrides the stat renderer (tests pass a stub); without it and without `statTables` (small fixtures)
 * no bonus is rendered.
 */
export function buildEsrGuideTables(
  sources: Pick<EsrGuideSources, 'tables' | 'strings'> & Partial<Pick<EsrGuideSources, 'statTables'>>,
  renderMods?: ModRenderer
): EsrGuideTables {
  const { strings } = buildStringTable(sources.strings);
  const misc = parseTsv(sources.tables.misc, 'misc.txt');
  const npcs = vendorNpcs(misc);
  const items = [
    ...readItems(misc, 'misc', npcs, strings),
    ...readItems(parseTsv(sources.tables.armor, 'armor.txt'), 'armor', npcs, strings),
    ...readItems(parseTsv(sources.tables.weapons, 'weapons.txt'), 'weapon', npcs, strings),
  ];
  const difficulties = parseTsv(sources.tables.difficultylevels, 'difficultylevels.txt').rows.map((row) => ({
    name: row.str('Name'),
    resistPenalty: numberOf(row, 'ResistPenalty'),
    deathExpPenalty: numberOf(row, 'DeathExpPenalty'),
    monsterSkillBonus: numberOf(row, 'MonsterSkillBonus'),
  }));

  return {
    cube: readCube(parseTsv(sources.tables.cubemain, 'cubemain.txt')),
    items,
    npcs,
    difficulties,
    ...buildCubeNames(items, parseTsv(sources.tables.itemtypes, 'itemtypes.txt'), strings),
    renderMods: cubeModRenderer(sources.statTables, strings, renderMods),
  };
}
