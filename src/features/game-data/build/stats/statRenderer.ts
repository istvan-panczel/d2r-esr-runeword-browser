/**
 * Stat renderer facade: `renderMods(mods)` turns the properties of one affix or runeword row into display lines.
 * Lookups are built once per `createStatRenderer` call (once per generation).
 */
import { parseTsv } from '../tsv.ts';
import { renderLines, type RenderContext } from '../../engine/stats/renderLines.ts';
import { expandProperty, type ExpandContext, type ModInput, type StatEntry } from './expandProperty.ts';
import { formatChance, poolHeader, resolveGroups, type Pool } from './propertyGroups.ts';
import { createSkillLookup } from './skills.ts';
import {
  readClassStrings,
  readColumn,
  readProperties,
  readPropertyGroups,
  readSkillDescNames,
  readSkills,
  readStats,
  type StatTables,
} from './tables.ts';

export interface RenderResult {
  lines: string[];
  warnings: string[];
}

export interface StatRenderer {
  renderMods(mods: readonly ModInput[]): RenderResult;
  /** Stat entries straight to lines (stats a misc.txt row sets itself, no property in between) */
  renderStats(entries: readonly StatEntry[]): string[];
}

export type StatTableName =
  'properties' | 'itemstatcost' | 'propertygroups' | 'skills' | 'skilldesc' | 'charstats' | 'monstats' | 'montype';

export const STAT_TABLES: readonly StatTableName[] = [
  'properties',
  'itemstatcost',
  'propertygroups',
  'skills',
  'skilldesc',
  'charstats',
  'monstats',
  'montype',
];

export function readStatTables(texts: Readonly<Record<StatTableName, string>>): StatTables {
  const table = (name: StatTableName) => parseTsv(texts[name], `${name}.txt`);
  return {
    properties: readProperties(table('properties')),
    stats: readStats(table('itemstatcost')),
    groups: readPropertyGroups(table('propertygroups')),
    skills: readSkills(table('skills')),
    skillDescNames: readSkillDescNames(table('skilldesc')),
    classes: readClassStrings(table('charstats')),
    monsterNames: readColumn(table('monstats'), 'NameStr'),
    monTypeNames: readColumn(table('montype'), 'strplur'),
  };
}

export function createStatRenderer(tables: StatTables, strings: ReadonlyMap<string, string>): StatRenderer {
  const skills = createSkillLookup(tables, strings);
  const expandContext: ExpandContext = { properties: tables.properties, strings, skills };
  const renderContext: RenderContext = {
    strings,
    skills,
    stats: tables.stats,
    monsterNames: tables.monsterNames,
    monTypeNames: tables.monTypeNames,
  };

  const expandAll = (mods: readonly ModInput[], warnings: string[]): StatEntry[] =>
    mods.flatMap((mod) => {
      const result = expandProperty(mod, expandContext);
      warnings.push(...result.warnings);
      for (const entry of result.entries) {
        if (entry.text === undefined && !tables.stats.has(entry.stat))
          warnings.push(`property "${mod.code}" sets unknown stat "${entry.stat}"`);
      }
      return result.entries;
    });

  const renderPool = (pool: Pool, warnings: string[]): string[] => [
    poolHeader(pool),
    ...pool.options.map((option) => {
      const lines = renderLines(expandAll(option.mods, warnings), renderContext);
      for (const nested of option.pools) lines.push(...renderPool(nested, warnings));
      return `${lines.join(', ')} (${formatChance(option.chance)})`;
    }),
  ];

  return {
    renderMods(mods) {
      const warnings: string[] = [];
      const resolved = resolveGroups(mods, tables.groups);
      warnings.push(...resolved.warnings);
      const lines = renderLines(expandAll(resolved.mods, warnings), renderContext);
      for (const pool of resolved.pools) lines.push(...renderPool(pool, warnings));
      return { lines, warnings };
    },
    renderStats(entries) {
      return renderLines(entries, renderContext);
    },
  };
}
