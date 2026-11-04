/**
 * Which references of public user data no longer resolve in the current data (currentData.ts). Rows come straight from
 * the Supabase REST API, so every field is treated as unknown JSON. Pure; scripts/check-user-data.ts fetches the rows.
 *
 * Reference formats:
 * - favourites `item_id`: `runeword:<name>:<variant>`, `gemword:<name>:<variant>` (src/core/utils/recipeFavorites.ts),
 *   `htmUnique:<name>:<baseItemCode>` (src/features/htm-unique-items/utils/htmUniqueItemFavorites.ts);
 * - builds `build_data` (src/features/builds/buildData.ts): unique / mythical by snapshot name, runeword / gemword by
 *   [name, variant], set items by name, the runeword base by bases.json code, skillPoints by skills.json id, crafts by
 *   `slot:roll` / `kind:key` / `kind:material:switchItem` (src/features/builds/utils/crafts.ts), class, ascendancy;
 * - loot filters: the filter file, through the loot filter validator (item codes and types, stat names and ids, area
 *   ids, unique/set ids, sound rows) plus the skill ids of skill-layered stat checks.
 */
import { decodeSkillLevelLayer, statLayerKind } from '../../../src/features/game-data/engine/statLayers.ts';
import { parseLootFilter } from '../../../src/features/loot-filter/engine/parse.ts';
import type { LootFilter, StatCheck } from '../../../src/features/loot-filter/engine/types.ts';
import { validateLootFilter } from '../../../src/features/loot-filter/engine/validate.ts';
import { forgeKey, recipeKey, rollKey, stackingKey, type CurrentData, type HtmLookups, type HtmRecipe } from './currentData.ts';

/** One reference that no longer resolves */
export interface Problem {
  /** What kind of reference, e.g. `runeword`, `unique`, `set item`, `skill`, `craft`, `item code` */
  readonly kind: string;
  /** The reference as stored, e.g. `runeword:Spirit:3`, `items.weapon`, `rules/4/itemCodes/0` */
  readonly ref: string;
  readonly reason: string;
}

/** The result of checking one row: its problems and the references it could not check (no HTM data). */
export interface RowCheck {
  readonly checked: number;
  readonly unchecked: number;
  readonly problems: Problem[];
}

type UnknownRecord = Readonly<Record<string, unknown>>;

const isRecord = (value: unknown): value is UnknownRecord => value !== null && typeof value === 'object' && !Array.isArray(value);
const asString = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);
const asNumber = (value: unknown): number | undefined => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);
const asStrings = (value: unknown): readonly string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];

class Collector {
  checked = 0;
  unchecked = 0;
  readonly problems: Problem[] = [];

  /** Counts one reference; `reason` null means it resolves, undefined means it could not be checked. */
  add(kind: string, ref: string, reason: string | null | undefined): void {
    if (reason === undefined) {
      this.unchecked++;
      return;
    }
    this.checked++;
    if (reason !== null) this.problems.push({ kind, ref, reason });
  }

  /** A problem among references already counted as checked (the loot filter validator's findings). */
  problem(kind: string, ref: string, reason: string): void {
    this.problems.push({ kind, ref, reason });
  }

  result(): RowCheck {
    return { checked: this.checked, unchecked: this.unchecked, problems: this.problems };
  }
}

const variantsText = (count: number | undefined): string =>
  count === undefined ? 'no row has that name' : count === 1 ? 'only variant 1 exists' : `variants 1–${String(count)} exist`;

/** null when [name, variant] resolves, else why not; undefined without HTM data. */
function recipeReason(kind: 'runeword' | 'gemword', name: string, variant: number, htm: HtmLookups | null): string | null | undefined {
  if (htm === null) return undefined;
  const rows = kind === 'runeword' ? htm.runewords : htm.gemwords;
  if (rows.has(recipeKey(name, variant))) return null;
  const variants = (kind === 'runeword' ? htm.runewordVariants : htm.gemwordVariants).get(name);
  return `not on ${kind}s.htm (${variantsText(variants)})`;
}

/** Runes + gems, sorted (the comparison ignores order), and the socket count when known. */
function recipeSignature(recipe: { sockets?: number; runes?: readonly string[]; gems: readonly string[] }): string {
  const ingredients = [...(recipe.runes ?? []), ...recipe.gems].sort().join('+');
  return recipe.sockets === undefined ? ingredients : `${ingredients} (${String(recipe.sockets)} sockets)`;
}

/**
 * A recipe that still resolves but whose ingredients or socket count differ from the build's snapshot: the variant
 * number now points at another row (a row was inserted or removed before it), or the recipe itself changed. null when
 * they match or the snapshot has no ingredients.
 */
function recipeShift(current: HtmRecipe, snapshot: UnknownRecord): string | null {
  const runes = asStrings(snapshot.runes);
  const gems = asStrings(snapshot.gems);
  if (runes.length + gems.length === 0) return null;
  const sockets = current.sockets === undefined ? undefined : asNumber(snapshot.sockets);
  const saved = recipeSignature({ runes, gems, sockets });
  const now = recipeSignature({ ...current, sockets: sockets === undefined ? undefined : current.sockets });
  return saved === now ? null : `variant ${String(current.variant)} is now a different recipe (${saved} → ${now})`;
}

// ---------------------------------------------------------------------------
// Favourites
// ---------------------------------------------------------------------------

/** Checks one `favorite_counts.item_id`. */
export function checkFavorite(itemId: string, data: CurrentData): RowCheck {
  const collector = new Collector();
  const first = itemId.indexOf(':');
  const last = itemId.lastIndexOf(':');
  const kind = first === -1 ? '' : itemId.slice(0, first);
  const middle = first === -1 || last <= first ? '' : itemId.slice(first + 1, last);
  const tail = last === -1 ? '' : itemId.slice(last + 1);
  if (kind === 'runeword' || kind === 'gemword') {
    const variant = /^\d+$/.test(tail) ? Number(tail) : Number.NaN;
    if (middle === '' || Number.isNaN(variant)) collector.add('favourite', itemId, 'not a <kind>:<name>:<variant> id');
    else collector.add(kind, itemId, recipeReason(kind, middle, variant, data.htm));
  } else if (kind === 'htmUnique') {
    if (middle === '') collector.add('favourite', itemId, 'not an htmUnique:<name>:<code> id');
    else if (data.htm === null) collector.add('unique', itemId, undefined);
    else {
      const codes = data.htm.uniques.get(middle);
      collector.add(
        'unique',
        itemId,
        codes === undefined
          ? 'not on the unique pages'
          : codes.has(tail)
            ? null
            : `base code ${tail} is now ${[...codes].join(' / ')} (the favourite no longer matches)`
      );
    }
  } else {
    collector.add('favourite', itemId, `unknown item id kind "${kind}"`);
  }
  return collector.result();
}

// ---------------------------------------------------------------------------
// Builds
// ---------------------------------------------------------------------------

const SLOT_MAPS = ['items', 'weaponSwap', 'mercenary'] as const;
const CRAFT_MAPS = ['itemCrafts', 'weaponSwapCrafts', 'mercenaryCrafts'] as const;

function checkItemRef(collector: Collector, ref: string, value: unknown, data: CurrentData): void {
  if (!isRecord(value)) return;
  const snapshot = isRecord(value.snapshot) ? value.snapshot : {};
  const type = asString(value.type);
  const htm = data.htm;
  switch (type) {
    case 'unique':
    case 'mythical': {
      const name = asString(snapshot.name);
      if (name === undefined) return;
      const found = htm === null ? undefined : type === 'unique' ? htm.uniques.has(name) : htm.mythicals.has(name);
      collector.add(type, `${ref} "${name}"`, found === undefined ? undefined : found ? null : `not on the ${type} pages`);
      return;
    }
    case 'runeword':
    case 'gemword': {
      const name = asString(value.name);
      const variant = asNumber(value.variant);
      if (name === undefined || variant === undefined) return;
      const label = `${ref} ${type}:${name}:${String(variant)}`;
      const reason = recipeReason(type, name, variant, htm);
      const current = htm === null ? undefined : (type === 'runeword' ? htm.runewords : htm.gemwords).get(recipeKey(name, variant));
      collector.add(type, label, reason === null && current !== undefined ? recipeShift(current, snapshot) : reason);
      if (type === 'runeword' && isRecord(value.base)) {
        const code = asString(value.base.code);
        if (code !== undefined) collector.add('base', `${ref} base ${code}`, data.baseCodes.has(code) ? null : 'not in bases.json');
      }
      return;
    }
    case 'set': {
      const name = asString(value.name);
      if (name !== undefined) collector.add('set item', `${ref} "${name}"`, data.setItems.has(name) ? null : 'not in sets.json');
      return;
    }
    default:
      // freetext and unknown types reference nothing
      return;
  }
}

function craftReason(craft: UnknownRecord, data: CurrentData): { label: string; reason: string | null } | undefined {
  const kind = asString(craft.kind);
  switch (kind) {
    case 'corruption':
    case 'anointment': {
      const slot = asString(kind === 'corruption' ? craft.slot : craft.pool);
      const roll = asNumber(craft.roll);
      if (slot === undefined || roll === undefined) return undefined;
      const key = rollKey(slot, roll);
      const known = kind === 'corruption' ? data.corruption : data.anointment;
      return { label: `${kind} ${key}`, reason: known.has(key) ? null : `not in enhance.json ${kind}Outcomes` };
    }
    case 'forge': {
      const forge = asString(craft.forge);
      const key = asString(craft.key);
      if (forge === undefined || key === undefined) return undefined;
      return {
        label: `forge ${forgeKey(forge, key)}`,
        reason: data.forgings.has(forgeKey(forge, key)) ? null : 'not in crafting.json forgings',
      };
    }
    case 'dstone':
    case 'meld': {
      const material = asString(craft.material);
      if (material === undefined) return undefined;
      const key = stackingKey(kind, material, kind === 'dstone' ? asString(craft.switchItem) : undefined);
      return { label: key, reason: data.stacking.has(key) ? null : 'not in crafting.json stacking' };
    }
    default:
      return undefined;
  }
}

/** Checks one public build (`class` column + `build_data`). */
export function checkBuild(cls: unknown, buildData: unknown, data: CurrentData): RowCheck {
  const collector = new Collector();
  const className = asString(cls);
  if (className !== undefined) collector.add('class', className, data.classes.has(className) ? null : 'not a skills.json class');
  if (!isRecord(buildData)) return collector.result();

  for (const map of SLOT_MAPS) {
    const slots = buildData[map];
    if (!isRecord(slots)) continue;
    for (const [slot, value] of Object.entries(slots)) checkItemRef(collector, `${map}.${slot}`, value, data);
  }
  for (const map of CRAFT_MAPS) {
    const slots = buildData[map];
    if (!isRecord(slots)) continue;
    for (const [slot, list] of Object.entries(slots)) {
      if (!Array.isArray(list)) continue;
      for (const craft of list) {
        const result = isRecord(craft) ? craftReason(craft, data) : undefined;
        if (result !== undefined) collector.add('craft', `${map}.${slot} ${result.label}`, result.reason);
      }
    }
  }
  if (isRecord(buildData.skillPoints)) {
    for (const id of Object.keys(buildData.skillPoints))
      collector.add('skill', id, data.skillIds.has(id) ? null : 'not a skills.json skill id');
  }
  const ascendancy = asString(buildData.ascendancy);
  if (ascendancy !== undefined && ascendancy !== '') {
    collector.add(
      'ascendancy',
      ascendancy,
      data.htm === null ? undefined : data.htm.ascendancies.has(ascendancy) ? null : 'not on ascendancies.htm'
    );
  }
  return collector.result();
}

// ---------------------------------------------------------------------------
// Loot filters
// ---------------------------------------------------------------------------

/** Validator messages that mean "this id or name is not in the game data" (validate.ts); other diagnostics are ignored. */
const UNRESOLVED_MESSAGES: readonly { kind: string; test: (message: string) => boolean }[] = [
  { kind: 'item code', test: (message) => message.startsWith('Unknown item code ') },
  { kind: 'item type', test: (message) => message.startsWith('Unknown item type ') },
  { kind: 'area', test: (message) => message.startsWith('Unknown area id ') },
  { kind: 'unique or set id', test: (message) => message.startsWith('Unknown unique or set id ') },
  { kind: 'stat', test: (message) => message.startsWith('Unknown stat ') },
  { kind: 'sound', test: (message) => message.startsWith('sounds.txt has no row ') || message.includes('is neither a sounds.txt sound') },
];

const STAT_LISTS = ['itemStats', 'itemStatsAnyOf', 'playerStats', 'playerStatsAnyOf'] as const;
const ID_LISTS = [
  'itemCodes',
  'excludeItemCodes',
  'itemTypes',
  'excludeItemTypes',
  'areas',
  'excludeAreas',
  'uniqueOrSetIds',
  'excludeUniqueOrSetIds',
] as const;

/** The game-data references the validator checks: listed ids and codes, stat checks and sounds (rules and styles). */
function filterReferenceCount(filter: LootFilter): number {
  let count = Object.values(filter.styles ?? {}).filter((style) => style.sound !== undefined).length;
  for (const rule of filter.rules) {
    for (const list of ID_LISTS) count += rule[list]?.length ?? 0;
    for (const list of STAT_LISTS) count += rule[list]?.length ?? 0;
    if (rule.sound !== undefined) count++;
  }
  return count;
}

/** The skill id a skill-layered stat check names, or undefined for other checks. */
function checkSkill(check: StatCheck, data: CurrentData): number | undefined {
  const name = typeof check.stat === 'number' ? data.lootFilterReference.statNamesById.get(check.stat) : check.stat;
  const kind = name === undefined ? undefined : statLayerKind(name);
  if (kind === undefined || check.param === undefined) return undefined;
  if (kind === 'skill') return check.param & 0xffff;
  if (kind === 'event' || kind === 'charged') return decodeSkillLevelLayer(check.param)?.skill;
  return undefined;
}

function checkFilterSkills(collector: Collector, filter: LootFilter, data: CurrentData): void {
  filter.rules.forEach((rule, index) => {
    for (const list of STAT_LISTS) {
      rule[list]?.forEach((check, checkIndex) => {
        const skill = checkSkill(check, data);
        if (skill === undefined) return;
        collector.add(
          'skill id',
          `rule ${String(index + 1)} ${list}/${String(checkIndex)} skill ${String(skill)}`,
          data.lootFilterSkillIds.has(skill) ? null : 'neither a class skill nor a skill items carry'
        );
      });
    }
  });
}

/** Checks one public loot filter's file content. A file that does not parse yields one `parse` problem. */
export function checkLootFilter(content: unknown, data: CurrentData): RowCheck {
  const collector = new Collector();
  if (typeof content !== 'string') return collector.result();
  let filter: LootFilter;
  try {
    filter = parseLootFilter(content).filter;
  } catch (error) {
    collector.add('parse', 'file', `does not parse: ${error instanceof Error ? error.message : String(error)}`);
    return collector.result();
  }
  collector.checked += filterReferenceCount(filter);
  for (const diagnostic of validateLootFilter(filter, data.lootFilterReference)) {
    const match = UNRESOLVED_MESSAGES.find((entry) => entry.test(diagnostic.message));
    if (match !== undefined) collector.problem(match.kind, diagnostic.path, diagnostic.message);
  }
  checkFilterSkills(collector, filter, data);
  return collector.result();
}

// ---------------------------------------------------------------------------
// Review cross-reference
// ---------------------------------------------------------------------------

/** The part of esr-update-review.ts's JSON output read here. */
export interface ReviewJson {
  readonly checks?: readonly { readonly id?: unknown; readonly status?: unknown; readonly details?: unknown }[];
}

/**
 * The review's detail lines (of checks that are not ok) that mention one of `keys` (`runeword:Name:N`,
 * `gemword:Name:N`, `htmUnique:Name:code`) as a whole token: a variant shift resolves but points at another recipe,
 * and the review's variant diff lists it. key → `<check id>: <line>`.
 */
export function reviewMentions(review: ReviewJson, keys: Iterable<string>): Map<string, string[]> {
  const lines = (review.checks ?? []).flatMap((check) =>
    check.status === 'ok' || !Array.isArray(check.details)
      ? []
      : check.details.filter((line): line is string => typeof line === 'string').map((line) => ({ id: String(check.id), line }))
  );
  const mentions = new Map<string, string[]>();
  for (const key of keys) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(^|[^\\w:])${escaped}(?![\\w:])`);
    const hits = lines.filter((entry) => pattern.test(entry.line)).map((entry) => `${entry.id}: ${entry.line}`);
    if (hits.length > 0) mentions.set(key, hits);
  }
  return mentions;
}

/** The recipe and unique keys a build references, in the favourites' id format (for reviewMentions). */
export function buildRecipeKeys(buildData: unknown): string[] {
  if (!isRecord(buildData)) return [];
  const keys: string[] = [];
  for (const map of SLOT_MAPS) {
    const slots = buildData[map];
    if (!isRecord(slots)) continue;
    for (const value of Object.values(slots)) {
      if (!isRecord(value)) continue;
      const type = asString(value.type);
      const name = asString(value.name);
      const variant = asNumber(value.variant);
      if ((type === 'runeword' || type === 'gemword') && name !== undefined && variant !== undefined) {
        keys.push(`${type}:${name}:${String(variant)}`);
      }
    }
  }
  return keys;
}
