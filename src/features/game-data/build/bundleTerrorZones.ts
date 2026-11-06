/**
 * terrorzones.json: the offline terror zone rotation of `data/hd/global/excel/desecratedzones.json`, reduced to what
 * the browser needs to work out the schedule (start, seed, durations, zone groups in file order), each group's names
 * and the terror boost per game version and difficulty. See docs/features/TERROR-ZONES.md.
 *
 * Group names: `labels` are the names the game's own terror zone display lists (each level group once through
 * levelgroups.txt `NameString`, then the levels without a group by `LevelName`, as ESR Docs resolves them and checked
 * against in-game screenshots); `areas` are the zone's levels as areas.json names them (Areas page, campaign map).
 */
import type {
  AreasBundle,
  TerrorZoneBoost,
  TerrorZoneConfig,
  TerrorZoneGameVersion,
  TerrorZoneGroup,
  TerrorZonesBundle,
} from '../engine/schema.ts';
import type { BuildResult } from './bundleTypes.ts';
import { resolveName } from './itemNames.ts';
import { parseTsv } from './tsv.ts';

export interface TerrorZonesInput {
  esrVersion: string;
  /** Raw desecratedzones.json */
  desecratedZonesText: string;
  levelsText: string;
  levelGroupsText: string;
  strings: ReadonlyMap<string, string>;
  /** areas.json (the `areas` names) */
  areas: AreasBundle;
}

export interface TerrorZonesBuildResult extends BuildResult<TerrorZonesBundle> {
  /** Zone levels areas.json does not list (map entrances, removed levels), left out of `areas` */
  unlistedLevels: number;
}

const VERSIONS: readonly TerrorZoneGameVersion[] = ['expansion', 'rotw'];
const DIFFICULTIES = ['normal', 'nightmare', 'hell'] as const;

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);
const objectAt = (value: unknown, key: string): Json | undefined => (isObject(value) && isObject(value[key]) ? value[key] : undefined);
const numberAt = (value: Json | undefined, key: string): number | undefined => {
  const field = value?.[key];
  return typeof field === 'number' && Number.isFinite(field) ? field : undefined;
};

/**
 * The seed is an unsigned 64-bit integer: above 2^53 a plain JSON.parse rounds it (and the whole rotation changes),
 * so every `"seed": <digits>` is quoted before parsing and kept as a string. Older files had comments; they are dropped.
 */
export function parseDesecratedZones(text: string): unknown {
  const quoted = text
    .replace(/^\uFEFF/, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/("seed"\s*:\s*)(\d+)/g, '$1"$2"');
  return JSON.parse(quoted);
}

const UTC_TIME = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/;

/** "2025-12-05 00:00:00" (UTC, exactly this format) → Unix seconds; null for an empty or unreadable time */
export function utcSeconds(text: unknown): number | null {
  if (typeof text !== 'string') return null;
  const match = UTC_TIME.exec(text.trim());
  if (match === null) return null;
  const [year, month, day, hour, minute, second] = match.slice(1).map(Number);
  const ms = Date.UTC(year, month - 1, day, hour, minute, second);
  const date = new Date(ms);
  // Date.UTC rolls 2025-02-30 over to March: refuse it
  const valid =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    date.getUTCHours() === hour &&
    date.getUTCMinutes() === minute &&
    date.getUTCSeconds() === second;
  return valid ? ms / 1000 : null;
}

export function buildTerrorZonesBundle(input: TerrorZonesInput): TerrorZonesBuildResult {
  const warnings: string[] = [];
  const parsed = parseDesecratedZones(input.desecratedZonesText);
  const configs = isObject(parsed) && Array.isArray(parsed.desecrated_zones) ? parsed.desecrated_zones : [];
  const raw: unknown = configs[0];
  if (!isObject(raw)) throw new Error('terrorzones: desecratedzones.json has no desecrated_zones config');
  // The game uses the first config covering the time; the app schedules only one, so more would show a wrong rotation
  if (configs.length > 1)
    throw new Error(
      `terrorzones: desecratedzones.json has ${String(configs.length)} configs, the app schedules only one. See "Terror zones" in .claude/skills/esr-update/reference.md`
    );

  const start = utcSeconds(raw.start_time_utc);
  if (start === null) throw new Error(`terrorzones: unreadable start_time_utc ${JSON.stringify(raw.start_time_utc)}`);
  const seed = typeof raw.seed === 'string' ? raw.seed : '';
  if (!/^\d+$/.test(seed) || BigInt(seed) >= 2n ** 64n) throw new Error(`terrorzones: unreadable seed ${JSON.stringify(raw.seed)}`);
  const zoneMinutes = numberAt(raw, 'zone_duration_minutes') ?? 0;
  const breakMinutes = numberAt(raw, 'break_duration_minutes') ?? 0;
  if (!Number.isInteger(zoneMinutes) || zoneMinutes <= 0)
    throw new Error(`terrorzones: zone_duration_minutes ${String(zoneMinutes)} is not a positive whole number`);
  if (!Number.isInteger(breakMinutes) || breakMinutes < 0)
    throw new Error(`terrorzones: break_duration_minutes ${String(breakMinutes)} is not a whole number ≥ 0`);
  const end = utcSeconds(raw.end_time_utc);
  if (end === null && typeof raw.end_time_utc === 'string' && raw.end_time_utc.trim() !== '')
    throw new Error(`terrorzones: unreadable end_time_utc ${JSON.stringify(raw.end_time_utc)}`);
  if (!Number.isInteger(start) || (end !== null && !Number.isInteger(end)))
    throw new Error('terrorzones: start_time_utc / end_time_utc are not whole seconds');
  if (end !== null) warnings.push(`terrorzones: the config ends at ${String(raw.end_time_utc)}; nothing is scheduled after it`);
  const config: TerrorZoneConfig = { start, end, seed, zoneMinutes, breakMinutes };

  // --- boosts ---
  const boosts: TerrorZoneBoost[] = [];
  const difficulties = objectAt(raw, 'game_difficulties');
  for (const version of VERSIONS) {
    DIFFICULTIES.forEach((name, difficulty) => {
      const defaults = objectAt(objectAt(objectAt(difficulties, version), name), 'defaults');
      const values = ['bound_incl_min', 'bound_incl_max', 'boost_level', 'boost_experience_percent'].map((key) => numberAt(defaults, key));
      const [minLevel, maxLevel, levelBoost, xpPercent] = values;
      if (minLevel === undefined || maxLevel === undefined || levelBoost === undefined || xpPercent === undefined) {
        warnings.push(`terrorzones: no ${version} ${name} boost in game_difficulties; left out`);
        return;
      }
      boosts.push({ version, difficulty, minLevel, maxLevel, levelBoost, xpPercent });
    });
  }

  // --- zone groups ---
  const levels = new Map(
    parseTsv(input.levelsText, 'levels.txt')
      .rows.filter((row) => row.str('Id') !== '')
      .map((row) => [row.num('Id'), row])
  );
  const groupNames = new Map(
    parseTsv(input.levelGroupsText, 'levelgroups.txt')
      .rows.filter((row) => row.str('LevelGroupId') !== '')
      .map((row) => [row.str('LevelGroupId'), resolveName(input.strings, row.str('NameString'), '')])
  );
  const areaNames = new Map(input.areas.areas.map((area) => [area.id, area.name]));
  let unlistedLevels = 0;

  const seen = new Set<string>();
  const zones: TerrorZoneGroup[] = [];
  const rawZones: unknown[] = Array.isArray(raw.zones) ? raw.zones : [];
  for (const zone of rawZones) {
    const id = isObject(zone) && typeof zone.id === 'string' ? zone.id : '';
    if (id === '') {
      warnings.push(`terrorzones: zone ${String(zones.length + 1)} has no id; left out`);
      continue;
    }
    // The game skips a zone whose id is already taken ("Duplicate or collision found")
    if (seen.has(id)) {
      warnings.push(`terrorzones: duplicate zone id ${id}; left out like the game does`);
      continue;
    }
    seen.add(id);
    const rawLevels: unknown[] = isObject(zone) && Array.isArray(zone.levels) ? zone.levels : [];
    const levelIds = rawLevels.flatMap((level) => {
      const levelId = isObject(level) ? numberAt(level, 'level_id') : undefined;
      return levelId === undefined ? [] : [levelId];
    });

    const grouped: string[] = [];
    const ungrouped: string[] = [];
    const areas: TerrorZoneGroup['areas'] = [];
    for (const levelId of levelIds) {
      const row = levels.get(levelId);
      if (row === undefined) {
        warnings.push(`terrorzones: ${id} lists level ${String(levelId)}, which levels.txt does not have`);
        continue;
      }
      const groupName = groupNames.get(row.str('LevelGroup'));
      const label = groupName !== undefined && groupName !== '' ? groupName : resolveName(input.strings, row.str('LevelName'), '');
      if (label === '') warnings.push(`terrorzones: ${id} level ${String(levelId)} has no name; left out of the labels`);
      else {
        const list = groupName !== undefined && groupName !== '' ? grouped : ungrouped;
        if (!list.includes(label)) list.push(label);
      }
      const areaName = areaNames.get(levelId);
      if (areaName === undefined) unlistedLevels++;
      else if (!areas.some((area) => area.id === levelId)) areas.push({ id: levelId, name: areaName });
    }
    if (areas.length === 0) warnings.push(`terrorzones: ${id} has no level areas.json lists`);
    zones.push({ id, labels: [...grouped, ...ungrouped], areas });
  }
  if (zones.length < 2) throw new Error(`terrorzones: ${String(zones.length)} zone groups; the rotation needs at least 2`);

  return { bundle: { esrVersion: input.esrVersion, config, boosts, zones }, warnings, unlistedLevels };
}
