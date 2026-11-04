/**
 * Item icons from the HD item sprites an ESR clone ships, with the vanilla D2R art (extracted from a game install) as
 * the fallback source (pure logic; scripts/generate-item-icons.ts does the IO and the WebP encoding).
 *
 * - `hd/items/items.json` maps an item code to an asset path (`{"hax":{"asset":"axe/hand_axe"}}`);
 * - the asset is `hd/global/ui/items/{weapon|armor|misc}/<asset>.sprite`, matched case-insensitively (17 asset paths
 *   differ from the file name in letter case, and Linux file systems are case-sensitive);
 * - `hd/items/uniques.json` / `sets.json` map a slug of the unique / set item's `index` to its own asset
 *   (`{"the_gnasher":{"normal":"axe/the_gnasher",…}}`); uniques and set items without one use their base's asset;
 * - items whose asset is not in the clone use vanilla D2R art: the same asset path in the vanilla folder (same layout,
 *   `data/hd/...` instead of `Eastern_Sun_Resurrected.mpq/data/hd/...`). The clone's sprite wins when it ships one;
 *   the vanilla items.json / uniques.json / sets.json fill in codes and keys the mod's files do not list;
 * - misc items in scope (`MISC_ICON_TYPES`: the socket fillers) get their code's art, keyed by display name;
 * - quest items (`selectQuestIconCodes`) get their code's art, keyed by code.
 */
import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import type { IconsBundle, ItemIconInfo, LootFilterItem, QuestIconInfo } from '../engine/schema.ts';
import { itemRowName, type UniqueOrSetRow } from './itemNames.ts';
import type { TsvTable } from './tsv.ts';
import { type TintRef, untintedFile } from './itemTint.ts';

export const ESR_HD_ITEMS_FILE = 'Eastern_Sun_Resurrected.mpq/data/hd/items/items.json';
export const ESR_HD_UNIQUES_FILE = 'Eastern_Sun_Resurrected.mpq/data/hd/items/uniques.json';
export const ESR_HD_SETS_FILE = 'Eastern_Sun_Resurrected.mpq/data/hd/items/sets.json';
export const ESR_HD_ITEM_SPRITES_DIR = 'Eastern_Sun_Resurrected.mpq/data/hd/global/ui/items';
/** The same files in the vanilla art folder (extracted from the D2R install's CASC storage) */
export const VANILLA_HD_ITEMS_FILE = 'data/hd/items/items.json';
export const VANILLA_HD_UNIQUES_FILE = 'data/hd/items/uniques.json';
export const VANILLA_HD_SETS_FILE = 'data/hd/items/sets.json';
export const VANILLA_HD_ITEM_SPRITES_DIR = 'data/hd/global/ui/items';
/** The install's Steam build config; its `root` hash identifies the game version the art was extracted from */
export const VANILLA_BUILD_CONFIG_FILE = 'steam-build.config';
/** Subfolders of ESR_HD_ITEM_SPRITES_DIR an asset path resolves into, in lookup order */
export const ITEM_SPRITE_FOLDERS = ['weapon', 'armor', 'misc'] as const;
/** Icons fit inside a square of this many pixels (keeping the aspect ratio, never enlarged) */
export const ICON_MAX_SIDE = 128;

export interface ItemAssets {
  /** Code → asset path; the first entry wins when a code repeats */
  readonly assets: ReadonlyMap<string, string>;
  /** Codes listed more than once */
  readonly duplicates: readonly string[];
}

/** Parses items.json: an array of single-key objects `{ code: { asset } }`. Malformed entries are skipped. */
export function parseItemAssets(json: unknown): ItemAssets {
  if (!Array.isArray(json)) throw new Error('items.json: expected an array');
  const assets = new Map<string, string>();
  const duplicates: string[] = [];
  for (const entry of json as unknown[]) {
    if (typeof entry !== 'object' || entry === null) continue;
    for (const [code, value] of Object.entries(entry as Record<string, unknown>)) {
      const asset = typeof value === 'object' && value !== null ? (value as Record<string, unknown>).asset : undefined;
      if (typeof asset !== 'string' || asset === '') continue;
      if (assets.has(code)) duplicates.push(code);
      else assets.set(code, asset);
    }
  }
  return { assets, duplicates };
}

/** Lowercased `folder/asset` (no extension) → the real relative path of the `.sprite` file, `/`-separated. */
export type SpriteIndex = ReadonlyMap<string, string>;

/**
 * Builds the index from relative `.sprite` paths (`weapon/axe/hand_axe.sprite`); other files are ignored, and so are
 * the `.lowend.sprite` halves of a game install (low-resolution copies).
 */
export function buildSpriteIndex(relativePaths: readonly string[]): SpriteIndex {
  const index = new Map<string, string>();
  for (const path of [...relativePaths].sort()) {
    const normalized = path.split(sep).join('/');
    const lower = normalized.toLowerCase();
    if (!lower.endsWith('.sprite') || lower.endsWith('.lowend.sprite')) continue;
    const key = normalized.slice(0, -'.sprite'.length).toLowerCase();
    if (!index.has(key)) index.set(key, normalized);
  }
  return index;
}

/** Lists every file under `dir` as `/`-separated paths relative to it (sorted, deterministic). */
export function listFilesRecursive(dir: string): string[] {
  const entries = readdirSync(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => relative(dir, join(entry.parentPath, entry.name)).split(sep).join('/'))
    .sort();
}

/** The real relative sprite path for an asset, looked up case-insensitively in each folder; null when the clone lacks it. */
export function resolveSprite(asset: string, index: SpriteIndex): string | null {
  const key = asset.replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();
  for (const folder of ITEM_SPRITE_FOLDERS) {
    const path = index.get(`${folder}/${key}`);
    if (path !== undefined) return path;
  }
  return null;
}

/** Which art folder a sprite comes from */
export type ArtSource = 'esr' | 'vanilla';

export interface ResolvedSprite {
  readonly source: ArtSource;
  /** Real relative path under that source's sprite directory */
  readonly path: string;
}

/** The clone's sprite when it ships one, else the vanilla folder's (when given); null when neither has it. */
export function resolveArt(asset: string, esr: SpriteIndex, vanilla: SpriteIndex | undefined): ResolvedSprite | null {
  const own = resolveSprite(asset, esr);
  if (own !== null) return { source: 'esr', path: own };
  const fallback = vanilla === undefined ? null : resolveSprite(asset, vanilla);
  return fallback === null ? null : { source: 'vanilla', path: fallback };
}

/** First segment of an asset path (`shield/fortress_shield` → `shield`), lowercased */
export function assetFolder(asset: string): string {
  return asset.replace(/\\/g, '/').replace(/^\/+/, '').split('/')[0]?.toLowerCase() ?? '';
}

/** `primary` plus the keys of `fallback` it lacks (the mod's json files win over the vanilla ones). */
export function withFallback<V>(primary: ReadonlyMap<string, V>, fallback: ReadonlyMap<string, V> | undefined): ReadonlyMap<string, V> {
  if (fallback === undefined) return primary;
  const merged = new Map(primary);
  for (const [key, value] of fallback) if (!merged.has(key)) merged.set(key, value);
  return merged;
}

/** `root = <hash>` of a Steam build config; null when the line is missing. */
export function parseBuildConfigRoot(text: string): string | null {
  return /^root\s*=\s*([0-9a-f]+)\s*$/im.exec(text)?.[1] ?? null;
}

/** Output file name of an asset: `axe/Hand_Axe` → `axe_hand_axe.webp`. */
export function assetSlug(asset: string): string {
  return asset
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .toLowerCase()
    .replace(/[^a-z0-9/_-]/g, '-')
    .replace(/\//g, '_');
}

/**
 * Key of a uniques.json / sets.json entry and of a txt `index`: lowercased, runs of spaces and hyphens → `_`, other
 * characters dropped ("Civerb's Ward" → `civerbs_ward`, "Buriza-Do Kyanon" → `buriza_do_kyanon`). The art files
 * use the same rule with a few irregular keys (`BlackKnights_Holy_Signet`, `scourge of_the_twin_seas`), which this
 * normalisation absorbs on the key side.
 */
export function artKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

/** Keys a txt `index` may be listed under: as is, without a `_lod` suffix (`Stormshield_lod`), digits split off (`Cutthroat1`). */
export function artKeyCandidates(index: string): string[] {
  const key = artKey(index);
  return [...new Set([key, key.replace(/_lod$/, ''), key.replace(/([a-z])(\d+)$/, '$1_$2')])];
}

export interface NamedArt {
  /** artKey → asset path (`normal`, else `uber`, else `ultra`) */
  readonly art: ReadonlyMap<string, string>;
  /** Normalised keys listed more than once (the first wins) */
  readonly duplicates: readonly string[];
}

/**
 * Parses uniques.json / sets.json: an array of single-key objects `{ key: { normal, uber, ultra } }`. A key with a
 * `_new` suffix (`hellfire_torch_new`) is also registered without it unless that key exists.
 */
export function parseNamedArt(json: unknown, file: string): NamedArt {
  if (!Array.isArray(json)) throw new Error(`${file}: expected an array`);
  const art = new Map<string, string>();
  const duplicates: string[] = [];
  const aliases: [string, string][] = [];
  for (const entry of json as unknown[]) {
    if (typeof entry !== 'object' || entry === null) continue;
    for (const [rawKey, value] of Object.entries(entry as Record<string, unknown>)) {
      if (typeof value !== 'object' || value === null) continue;
      const tiers = value as Record<string, unknown>;
      const asset = [tiers.normal, tiers.uber, tiers.ultra].find((candidate) => typeof candidate === 'string' && candidate !== '');
      if (typeof asset !== 'string') continue;
      const key = artKey(rawKey);
      if (art.has(key)) {
        duplicates.push(key);
        continue;
      }
      art.set(key, asset);
      if (key.endsWith('_new')) aliases.push([key.slice(0, -'_new'.length), asset]);
    }
  }
  for (const [key, asset] of aliases) if (!art.has(key)) art.set(key, asset);
  return { art, duplicates };
}

/** How the uniques or set items of a plan got their icon (counted per distinct display name). */
export interface NamedIconStats {
  /** Distinct display names */
  readonly requested: number;
  /** Own HD art (an entry in uniques.json / sets.json whose asset differs from the base's and is in a source) */
  readonly own: number;
  /** The base's art (no own entry, an own entry equal to the base's asset, or own art no source has) */
  readonly base: number;
  /** Neither own nor base art in any source */
  readonly none: number;
  /** Of `own` + `base`: the chosen art comes from the vanilla folder */
  readonly vanilla: number;
  /** Names whose own entry points at art no source has; counted in `base` or `none` */
  readonly ownArtMissing: number;
  /** The names without art (`none`), in row order */
  readonly noneNames: readonly string[];
  /** Names whose own entry comes from the vanilla file (the mod's lacks one; same asset folder as the base) */
  readonly vanillaKeyUsed: readonly string[];
  /** Names whose only own entry is in the vanilla file and points into another asset folder than the base (ignored) */
  readonly vanillaKeyRejected: readonly string[];
  /** Keys of the mod's art map no txt row matched (e.g. vanilla items ESR removed) */
  readonly unusedKeys: readonly string[];
}

export interface IconPlan {
  /** Code → asset slug, for codes with art in a source (input order) */
  readonly bases: ReadonlyMap<string, string>;
  /** Of `bases`: codes whose art comes from the vanilla folder */
  readonly basesFromVanilla: number;
  /** Quest item code (`selectQuestIconCodes`) → asset slug, for codes with art in a source */
  readonly quest: ReadonlyMap<string, string>;
  readonly questStats: QuestIconStats;
  /** Unique display name → asset slug (own art, else the base's) */
  readonly uniques: ReadonlyMap<string, string>;
  /** Set item display name → asset slug */
  readonly sets: ReadonlyMap<string, string>;
  /** Unique / set item display name → the row its icon came from and whether it is the item's own art */
  readonly uniqueChoices: ReadonlyMap<string, NamedArtChoice>;
  readonly setChoices: ReadonlyMap<string, NamedArtChoice>;
  /** Misc item display name (or `name#code` when the name's rows differ in art) → asset slug */
  readonly misc: ReadonlyMap<string, string>;
  /** Slug → source and real relative sprite path, one per distinct asset */
  readonly sprites: ReadonlyMap<string, ResolvedSprite>;
  /** Base codes without an items.json entry (mod or vanilla) */
  readonly missingEntry: readonly string[];
  /** Base codes whose asset is in no source */
  readonly missingArt: readonly string[];
  readonly uniqueStats: NamedIconStats;
  readonly setStats: NamedIconStats;
  readonly miscStats: MiscIconStats;
}

export interface IconPlanInput {
  /** Base codes (bases.json) */
  readonly codes: readonly string[];
  /** uniqueitems.txt / setitems.txt rows (`readUniqueOrSetRows`) */
  readonly uniques: readonly UniqueOrSetRow[];
  readonly sets: readonly UniqueOrSetRow[];
  /** items.json: code → asset */
  readonly assets: ReadonlyMap<string, string>;
  /** uniques.json / sets.json: artKey → asset */
  readonly uniqueArt: ReadonlyMap<string, string>;
  readonly setArt: ReadonlyMap<string, string>;
  /** Misc rows in the icon scope (`selectMiscIconRows`); omitted → no misc section */
  readonly misc?: readonly MiscIconRow[];
  /** Quest item codes (`selectQuestIconCodes`); omitted → no quest section entries */
  readonly quest?: readonly string[];
  readonly index: SpriteIndex;
  /** The vanilla art folder: its sprites and json maps, used where the clone's lack an asset, code or key */
  readonly vanilla?: VanillaArt;
}

export interface VanillaArt {
  readonly index: SpriteIndex;
  readonly assets: ReadonlyMap<string, string>;
  readonly uniqueArt: ReadonlyMap<string, string>;
  readonly setArt: ReadonlyMap<string, string>;
}

/** The row behind a unique / set item's icon (for its inventory colour transform) */
export interface NamedArtChoice {
  /** Asset slug of the chosen art */
  readonly slug: string;
  /** The item's own art (rank 2), not its base's */
  readonly own: boolean;
  /** Base item code of the row */
  readonly code: string;
  /** The row's `invtransform` colour code (blank: none) */
  readonly invTransform: string;
}

/**
 * itemtypes.txt codes whose misc items (by the `type` / `type2` ancestry of types.json) get an icon in the `misc`
 * section: the socket fillers the Socketables page lists. `gem` is the parent of every gem type (`gema` … `gemk` and
 * the quality types `gem0` … `gem5`); `rune` covers the LoD, ESR and Kanji runes and ESR's crystals, which misc.txt
 * types `rune` too. Jewels (`jewl` / `cjwl`, also under `sock`) are left out. Add a code here to widen the scope.
 */
export const MISC_ICON_TYPES: readonly string[] = ['gem', 'rune'];

/**
 * Separator of a code-qualified misc key (`Ko Rune#r19`): written when one display name has rows with different art
 * (ESR's Ko Rune and the LoD Ko Rune), instead of the plain name, so neither shows the other's art.
 */
export const MISC_CODE_SEPARATOR = '#';

/** A misc.txt row in the misc icon scope */
export interface MiscIconRow {
  readonly code: string;
  readonly name: string;
  /** `spawnable` (misc.txt has no `disabled` column); spawnable rows win a shared name */
  readonly enabled: boolean;
}

/**
 * The lootfilter.json items (misc.txt rows with their display names) whose `type` or `type2` descends from one of
 * `scope` per the types.json ancestry, in file order. A type types.json lacks counts as its own only ancestor.
 */
export function selectMiscIconRows(
  items: readonly LootFilterItem[],
  ancestors: ReadonlyMap<string, readonly string[]>,
  scope: readonly string[] = MISC_ICON_TYPES
): MiscIconRow[] {
  const inScope = (type: string | undefined) => type !== undefined && (ancestors.get(type) ?? [type]).some((code) => scope.includes(code));
  return items
    .filter((item) => item.kind === 'misc' && (inScope(item.type) || inScope(item.type2)))
    .map((item) => ({ code: item.code, name: item.name, enabled: item.spawnable }));
}

/**
 * itemtypes.txt codes whose misc / weapons / armor.txt rows get an icon in the `quest` section besides the rows with a
 * `quest` number (the campaign quest items): `ques` (also the portal keys, organs, essences and other quest-typed
 * items without a quest number) and `mmap` (the endgame map items, areas.json `mapItem`).
 */
export const QUEST_ICON_TYPES: readonly string[] = ['ques', 'mmap'];

/** Item codes of the quest icon scope: rows with a `quest` number or a QUEST_ICON_TYPES `type`, in table then row order. */
export function selectQuestIconCodes(tables: readonly TsvTable[], types: readonly string[] = QUEST_ICON_TYPES): string[] {
  const codes = new Set<string>();
  for (const table of tables) {
    for (const row of table.rows) {
      const code = row.has('code') ? row.str('code') : '';
      if (code === '') continue;
      const quest = row.has('quest') ? row.num('quest') : 0;
      const typed = ['type', 'type2'].some((column) => row.has(column) && types.includes(row.str(column)));
      if (quest > 0 || typed) codes.add(code);
    }
  }
  return [...codes];
}

/**
 * Display names of item codes (the first misc / weapons / armor.txt row of a code), as stashnames.json `bases` names
 * them: the `quest` section carries them so a page that shows quest items needs no stashnames.json.
 */
export function readItemNames(tables: readonly TsvTable[], strings: ReadonlyMap<string, string>): Map<string, string> {
  const names = new Map<string, string>();
  for (const table of tables) {
    for (const row of table.rows) {
      const code = row.has('code') ? row.str('code') : '';
      if (code === '' || names.has(code)) continue;
      names.set(code, itemRowName(strings, row.has('namestr') ? row.str('namestr') : '', row.has('name') ? row.str('name') : ''));
    }
  }
  return names;
}

/** How the quest items of a plan got their icon (per code). */
export interface QuestIconStats {
  readonly requested: number;
  /** Of the codes with an icon: art from the vanilla folder */
  readonly vanilla: number;
  /** Codes without an items.json entry or whose asset is in no source */
  readonly missing: readonly string[];
}

/** How the misc items of a plan got their icon (counted per distinct display name). */
export interface MiscIconStats {
  /** Distinct display names */
  readonly requested: number;
  /** Names with an icon (plain or code-qualified keys) */
  readonly withArt: number;
  /** Of `withArt`: the art comes from the vanilla folder */
  readonly vanilla: number;
  /** The names without art, in row order */
  readonly noneNames: readonly string[];
  /** Names whose rows have different art, keyed per code (`name#code`) */
  readonly splitNames: readonly string[];
}

type Rank = 0 | 1 | 2;
/** Rank first; within a rank the clone's art beats the vanilla folder's */
const score = (pick: NamedPick): number => pick.rank * 2 + (pick.art?.sprite.source === 'esr' ? 1 : 0);
interface NamedPick {
  /** The chosen asset and its sprite; null without art */
  readonly art: { readonly asset: string; readonly sprite: ResolvedSprite } | null;
  readonly rank: Rank;
  readonly ownArtMissing: boolean;
  readonly row: UniqueOrSetRow;
}

export function planItemIcons(input: IconPlanInput): IconPlan {
  const vanilla = input.vanilla;
  const assets = withFallback(input.assets, vanilla?.assets);
  const resolve = (asset: string) => resolveArt(asset, input.index, vanilla?.index);
  const sprites = new Map<string, ResolvedSprite>();
  const addSprite = (asset: string, sprite: ResolvedSprite): string => {
    const slug = assetSlug(asset);
    if (!sprites.has(slug)) sprites.set(slug, sprite);
    return slug;
  };

  /** Item codes → their items.json art */
  const planCodes = (codes: readonly string[]) => {
    const byCode = new Map<string, string>();
    const missingEntry: string[] = [];
    const missingArt: string[] = [];
    let fromVanilla = 0;
    for (const code of codes) {
      if (byCode.has(code) || missingEntry.includes(code) || missingArt.includes(code)) continue;
      const asset = assets.get(code);
      if (asset === undefined) {
        missingEntry.push(code);
        continue;
      }
      const sprite = resolve(asset);
      if (sprite === null) {
        missingArt.push(code);
        continue;
      }
      if (sprite.source === 'vanilla') fromVanilla++;
      byCode.set(code, addSprite(asset, sprite));
    }
    return { byCode, missingEntry, missingArt, fromVanilla };
  };
  const { byCode: bases, missingEntry, missingArt, fromVanilla: basesFromVanilla } = planCodes(input.codes);
  const quest = planCodes(input.quest ?? []);

  /*
   * One icon per display name. Enabled rows come first; a later row replaces an earlier one with the same name only
   * when it is enabled and ranks higher (own art 2 > base art 1 > none 0; within a rank the clone's art beats the
   * vanilla folder's), so a name with several versions shows its own art when any enabled version has one, and ESR's
   * own art when a version has that (the mythical Buriza-Do Kyanon over the vanilla Buriza's Hellcast art).
   */
  const planNamed = (
    rows: readonly UniqueOrSetRow[],
    modArt: ReadonlyMap<string, string>,
    vanillaArt: ReadonlyMap<string, string> | undefined
  ) => {
    const picks = new Map<string, NamedPick>();
    const usedKeys = new Set<string>();
    const vanillaKeyRejected = new Set<string>();
    const vanillaKeyUsed = new Set<string>();
    for (const row of [...rows.filter((entry) => !entry.disabled), ...rows.filter((entry) => entry.disabled)]) {
      const candidates = artKeyCandidates(row.index);
      const key = candidates.find((candidate) => modArt.has(candidate));
      if (key !== undefined) usedKeys.add(key);
      const baseAsset = assets.get(row.code);
      let ownAsset = key === undefined ? undefined : modArt.get(key);
      if (ownAsset === undefined && vanillaArt !== undefined) {
        /*
         * A vanilla entry for a name the mod's file lacks: ESR reuses some vanilla names for other items (its Guardian
         * Angel is a shield, vanilla's an armor), so the entry counts only when its asset folder matches the base's.
         */
        const vanillaKey = candidates.find((candidate) => vanillaArt.has(candidate));
        const vanillaAsset = vanillaKey === undefined ? undefined : vanillaArt.get(vanillaKey);
        if (vanillaAsset !== undefined) {
          if (baseAsset !== undefined && assetFolder(vanillaAsset) === assetFolder(baseAsset)) {
            ownAsset = vanillaAsset;
            vanillaKeyUsed.add(row.name);
          } else {
            vanillaKeyRejected.add(row.name);
          }
        }
      }
      const ownSprite = ownAsset === undefined ? null : resolve(ownAsset);
      const baseSprite = baseAsset === undefined ? null : resolve(baseAsset);
      let pick: NamedPick;
      if (ownAsset !== undefined && ownSprite !== null && (baseAsset === undefined || assetSlug(ownAsset) !== assetSlug(baseAsset))) {
        pick = { art: { asset: ownAsset, sprite: ownSprite }, rank: 2, ownArtMissing: false, row };
      } else if (baseAsset !== undefined && baseSprite !== null) {
        pick = {
          art: { asset: baseAsset, sprite: baseSprite },
          rank: 1,
          ownArtMissing: ownAsset !== undefined && ownSprite === null,
          row,
        };
      } else {
        pick = { art: null, rank: 0, ownArtMissing: ownAsset !== undefined && ownSprite === null, row };
      }
      const existing = picks.get(row.name);
      if (existing !== undefined && (row.disabled || score(existing) >= score(pick))) continue;
      picks.set(row.name, pick);
    }
    const byName = new Map<string, string>();
    const choices = new Map<string, NamedArtChoice>();
    // Sprites are registered for the final picks only, so a replaced pick leaves no unused file behind
    for (const [name, pick] of picks) {
      if (pick.art === null) continue;
      const slug = addSprite(pick.art.asset, pick.art.sprite);
      byName.set(name, slug);
      choices.set(name, { slug, own: pick.rank === 2, code: pick.row.code, invTransform: pick.row.invTransform });
    }
    const values = [...picks.values()];
    const stats: NamedIconStats = {
      requested: picks.size,
      own: values.filter((pick) => pick.rank === 2).length,
      base: values.filter((pick) => pick.rank === 1).length,
      none: values.filter((pick) => pick.rank === 0).length,
      vanilla: values.filter((pick) => pick.art?.sprite.source === 'vanilla').length,
      ownArtMissing: values.filter((pick) => pick.ownArtMissing).length,
      noneNames: [...picks].filter(([, pick]) => pick.rank === 0).map(([name]) => name),
      vanillaKeyUsed: [...vanillaKeyUsed],
      vanillaKeyRejected: [...vanillaKeyRejected],
      unusedKeys: [...modArt.keys()].filter((key) => !usedKeys.has(key) && !usedKeys.has(key.replace(/_new$/, ''))),
    };
    return { byName, choices, stats };
  };

  const uniques = planNamed(input.uniques, input.uniqueArt, vanilla?.uniqueArt);
  const sets = planNamed(input.sets, input.setArt, vanilla?.setArt);

  /*
   * Misc items: the code's items.json art, one icon per display name from its spawnable rows (all rows when none is).
   * Rows without art are skipped; when the remaining rows differ in art, each gets a `name#code` key instead.
   */
  const misc = new Map<string, string>();
  const rowsByName = new Map<string, MiscIconRow[]>();
  for (const row of input.misc ?? []) rowsByName.set(row.name, [...(rowsByName.get(row.name) ?? []), row]);
  const noneNames: string[] = [];
  const splitNames: string[] = [];
  let miscFromVanilla = 0;
  for (const [name, rows] of rowsByName) {
    const enabled = rows.filter((row) => row.enabled);
    const withArt = (enabled.length > 0 ? enabled : rows).flatMap((row) => {
      const asset = assets.get(row.code);
      const sprite = asset === undefined ? null : resolve(asset);
      return asset === undefined || sprite === null ? [] : [{ row, asset, sprite }];
    });
    const first = withArt.at(0);
    if (first === undefined) {
      noneNames.push(name);
      continue;
    }
    if (first.sprite.source === 'vanilla') miscFromVanilla++;
    if (new Set(withArt.map((entry) => assetSlug(entry.asset))).size === 1) {
      misc.set(name, addSprite(first.asset, first.sprite));
      continue;
    }
    splitNames.push(name);
    for (const entry of withArt) misc.set(`${name}${MISC_CODE_SEPARATOR}${entry.row.code}`, addSprite(entry.asset, entry.sprite));
  }

  return {
    bases,
    basesFromVanilla,
    quest: quest.byCode,
    questStats: {
      requested: new Set(input.quest ?? []).size,
      vanilla: quest.fromVanilla,
      missing: [...quest.missingEntry, ...quest.missingArt],
    },
    uniques: uniques.byName,
    sets: sets.byName,
    uniqueChoices: uniques.choices,
    setChoices: sets.choices,
    sprites,
    missingEntry,
    missingArt,
    uniqueStats: uniques.stats,
    setStats: sets.stats,
    misc,
    miscStats: {
      requested: rowsByName.size,
      withArt: rowsByName.size - noneNames.length,
      vanilla: miscFromVanilla,
      noneNames,
      splitNames,
    },
  };
}

export interface CropBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Bounding box of the pixels with any alpha; null when the image is fully transparent. */
export function opaqueBounds(width: number, height: number, rgba: Uint8Array | Uint8ClampedArray): CropBox | null {
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < height; y++) {
    const row = y * width * 4;
    for (let x = 0; x < width; x++) {
      if ((rgba[row + x * 4 + 3] ?? 0) === 0) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

/** Copies the box out of an RGBA image. */
export function cropRgba(width: number, rgba: Uint8Array | Uint8ClampedArray, box: CropBox): Uint8Array {
  const out = new Uint8Array(box.width * box.height * 4);
  for (let y = 0; y < box.height; y++) {
    const start = ((box.y + y) * width + box.x) * 4;
    out.set(rgba.subarray(start, start + box.width * 4), y * box.width * 4);
  }
  return out;
}

/** Size that fits inside max×max keeping the aspect ratio; never enlarges, never below 1 px. */
export function fitInside(width: number, height: number, max: number = ICON_MAX_SIDE): { width: number; height: number } {
  const scale = Math.min(1, max / width, max / height);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/**
 * icons.json: only the entries whose slug got an image (decode failures drop out). `vanilla` (the art folder's
 * provenance) is written, with the files that came from it, only when any did.
 */
export function buildIconsBundle(input: {
  esrVersion: string;
  esrTag: string | null;
  vanilla?: { rootHash: string; extractedAt: string };
  plan: Pick<IconPlan, 'bases' | 'uniques' | 'sets' | 'sprites'> & Partial<Pick<IconPlan, 'misc' | 'quest'>>;
  /** Recoloured variants by unique / set item name (`planTints`); their images are in `images` under the variant slug */
  tints?: { uniques: ReadonlyMap<string, TintRef>; sets: ReadonlyMap<string, TintRef> };
  /** Display names by item code (`readItemNames`) for the `quest` entries; a code without one is named by its code */
  itemNames?: ReadonlyMap<string, string>;
  images: ReadonlyMap<string, { width: number; height: number }>;
  extension: string;
}): IconsBundle {
  const section = (bySlug: ReadonlyMap<string, string>, tints?: ReadonlyMap<string, TintRef>): Record<string, ItemIconInfo> => {
    const icons: Record<string, ItemIconInfo> = {};
    for (const [key, slug] of bySlug) {
      const tint = tints?.get(key);
      const tinted = tint === undefined ? undefined : input.images.get(tint.slug);
      if (tint !== undefined && tinted !== undefined) {
        icons[key] = {
          file: `${tint.slug}.${input.extension}`,
          w: tinted.width,
          h: tinted.height,
          tint: { map: tint.map, color: tint.color },
        };
        continue;
      }
      const image = input.images.get(slug);
      if (image === undefined) continue;
      icons[key] = { file: `${slug}.${input.extension}`, w: image.width, h: image.height };
    }
    return icons;
  };
  const vanillaFiles = [...input.plan.sprites]
    .filter(([slug, sprite]) => sprite.source === 'vanilla' && input.images.has(slug))
    .map(([slug]) => `${slug}.${input.extension}`)
    .sort();
  return {
    esrVersion: input.esrVersion,
    esrTag: input.esrTag,
    ...(input.vanilla !== undefined && vanillaFiles.length > 0 ? { vanilla: { ...input.vanilla, files: vanillaFiles } } : {}),
    bases: section(input.plan.bases),
    uniques: section(input.plan.uniques, input.tints?.uniques),
    sets: section(input.plan.sets, input.tints?.sets),
    misc: section(input.plan.misc ?? new Map()),
    quest: Object.fromEntries(
      Object.entries(section(input.plan.quest ?? new Map())).map(([code, icon]): [string, QuestIconInfo] => [
        code,
        { ...icon, name: input.itemNames?.get(code) ?? code },
      ])
    ),
  };
}

/**
 * Compares the committed icons.json with one generated without the vanilla folder (CI, other machines): every entry
 * the clone's art yields must be committed as is, and every other committed entry must point at a file the committed
 * bundle lists as vanilla-derived (unverifiable here, accepted). A recoloured entry (`tint`; the colour maps are in the
 * vanilla folder) is compared through its untinted file: that file and the size must match the clone's entry, unless
 * the untinted file is vanilla-derived. Returns the differences (empty when consistent).
 */
export function compareWithoutVanilla(committed: IconsBundle, esrOnly: IconsBundle): string[] {
  const problems: string[] = [];
  if (committed.esrVersion !== esrOnly.esrVersion) problems.push(`esrVersion ${committed.esrVersion} ≠ ${esrOnly.esrVersion}`);
  if (committed.esrTag !== esrOnly.esrTag) problems.push(`esrTag ${String(committed.esrTag)} ≠ ${String(esrOnly.esrTag)}`);
  const vanillaFiles = new Set(committed.vanilla?.files ?? []);
  // The quest entries' names come from the clone's tables, so they must match as well
  type Entry = ItemIconInfo & { name?: string };
  const same = (a: Entry, b: Entry) => a.file === b.file && a.w === b.w && a.h === b.h && a.name === b.name;
  const describe = (icon: ItemIconInfo) => `${icon.file} ${String(icon.w)}×${String(icon.h)}`;
  for (const section of ['bases', 'uniques', 'sets', 'misc', 'quest'] as const) {
    const old = committed[section];
    const fresh = esrOnly[section];
    for (const [key, committedIcon] of Object.entries(old)) {
      const expected = Object.hasOwn(fresh, key) ? fresh[key] : undefined;
      const icon =
        committedIcon.tint === undefined
          ? committedIcon
          : { file: untintedFile(committedIcon.file), w: committedIcon.w, h: committedIcon.h };
      if (vanillaFiles.has(icon.file)) {
        // A vanilla file the clone now ships would come from the clone
        if (expected?.file === icon.file) problems.push(`${section}/${key}: ${icon.file} is now in the clone`);
        continue;
      }
      if (expected === undefined) problems.push(`${section}/${key}: not produced by the clone's art`);
      else if (!same(icon, expected)) problems.push(`${section}/${key}: ${describe(icon)} ≠ ${describe(expected)}`);
    }
    for (const key of Object.keys(fresh)) if (!Object.hasOwn(old, key)) problems.push(`${section}/${key}: missing`);
  }
  return problems;
}
