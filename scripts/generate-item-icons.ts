#!/usr/bin/env node
/**
 * Extracts item icons from HD item sprites into public/game-data/icons/*.webp and public/game-data/icons.json (file and
 * size by base code, unique name, set item name and misc item name). Scope: the codes of the committed bases.json, every
 * uniqueitems.txt and setitems.txt row with a base (own art from hd/items/uniques.json / sets.json, else the base's art)
 * the committed lootfilter.json misc items whose type descends from MISC_ICON_TYPES (types.json; the socket fillers)
 * and the quest items of misc/weapons/armor.txt (a `quest` number or a QUEST_ICON_TYPES type; by code).
 *
 *   node scripts/generate-item-icons.ts [--esr <dir>] [--vanilla <dir>] [--check]
 *
 * Sources: the ESR clone (--esr <dir> | ESR_SOURCE_DIR | ../Eastern_Sun_Resurrected) and the vanilla D2R art folder
 * extracted from a game install (--vanilla <dir> | D2R_VANILLA_ART_DIR | ../d2r-vanilla-art; paths relative to the repo
 * root). The clone's sprite wins; the vanilla one fills the gaps.
 * Unique / set items with an inventory colour transform (`invtransform` + the base's `InvTrans`) also get a recoloured
 * variant, approximating the game's palette recolour with the vanilla folder's colour maps (build/itemTint.ts).
 * --check regenerates in memory and exits 1 when icons.json or any image differs from the committed files. Without the
 * vanilla folder it verifies only the clone-derived part, accepts the committed vanilla-derived files with a warning and
 * exits 0; writing without the folder is refused (it would drop those files).
 * Run generate-game-data.ts afterwards: it lists icons.json (hash) in the manifest (`npm run game-data:icons` does both).
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import sharp from 'sharp';
import type { BasesBundle, IconsBundle, LootFilterDataBundle, TypesBundle } from '../src/features/game-data/engine/schema.ts';
import { ESR_EXCEL_DIR, readModVersion, readStringFiles } from '../src/features/game-data/build/esrSources.ts';
import { readUniqueOrSetRows } from '../src/features/game-data/build/itemNames.ts';
import { buildStringTable } from '../src/features/game-data/build/strings.ts';
import { parseTsv } from '../src/features/game-data/build/tsv.ts';
import {
  type ArtSource,
  buildIconsBundle,
  buildSpriteIndex,
  compareWithoutVanilla,
  cropRgba,
  ESR_HD_ITEM_SPRITES_DIR,
  ESR_HD_ITEMS_FILE,
  ESR_HD_SETS_FILE,
  ESR_HD_UNIQUES_FILE,
  fitInside,
  type MiscIconStats,
  MISC_ICON_TYPES,
  QUEST_ICON_TYPES,
  type QuestIconStats,
  type NamedIconStats,
  listFilesRecursive,
  opaqueBounds,
  parseBuildConfigRoot,
  parseItemAssets,
  parseNamedArt,
  planItemIcons,
  readItemNames,
  selectMiscIconRows,
  selectQuestIconCodes,
  VANILLA_BUILD_CONFIG_FILE,
  VANILLA_HD_ITEM_SPRITES_DIR,
  VANILLA_HD_ITEMS_FILE,
  VANILLA_HD_SETS_FILE,
  VANILLA_HD_UNIQUES_FILE,
  type VanillaArt,
} from '../src/features/game-data/build/itemIcons.ts';
import {
  buildTint,
  COLORMAP_DIR,
  COLORMAP_FILES,
  colormapBlock,
  GREYSCALE_MAX_CHROMA,
  meanChroma,
  PALETTE_FILE,
  parsePalette,
  planTints,
  readInvTrans,
  type Tint,
  TINT_COLORS,
  type TintStats,
} from '../src/features/game-data/build/itemTint.ts';
import { serializeBundle } from '../src/features/game-data/build/writeBundle.ts';
import { decodeSprite } from '../src/features/loot-filter/engine/sprite.ts';
import { git, REPO_ROOT, resolveEsrDir, resolveVanillaArtDir } from './lib/esrClone.ts';

const OUTPUT_DIR = join(REPO_ROOT, 'public', 'game-data');
const ICONS_DIR = join(OUTPUT_DIR, 'icons');
const EXTENSION = 'webp';
const WEBP_QUALITY = 80;
/** colors.txt in the vanilla art folder (the colour codes' block order) */
const VANILLA_COLORS_FILE = 'data/global/excel/colors.txt';

interface EncodedIcon {
  width: number;
  height: number;
  bytes: Buffer;
}

const readSprite = (path: string) => decodeSprite(new Uint8Array(readFileSync(path)));

/** Decodes, crops, recolours (`tint`, on the full-size pixels), fits inside 128 × 128 and encodes one sprite. */
async function encodeIcon(spritePath: string, tint?: Tint): Promise<EncodedIcon> {
  const sprite = readSprite(spritePath);
  const box = opaqueBounds(sprite.width, sprite.height, sprite.rgba);
  if (box === null) throw new Error('fully transparent');
  const cropped = cropRgba(sprite.width, sprite.rgba, box);
  tint?.apply(cropped);
  const size = fitInside(box.width, box.height);
  const bytes = await sharp(cropped, { raw: { width: box.width, height: box.height, channels: 4 } })
    .resize(size.width, size.height, { fit: 'fill', kernel: 'lanczos3' })
    .webp({ quality: WEBP_QUALITY, alphaQuality: 100, effort: 4, smartSubsample: true })
    .toBuffer();
  return { ...size, bytes };
}

interface VanillaFolder {
  readonly art: VanillaArt;
  readonly spritesDir: string;
  readonly rootHash: string;
  readonly extractedAt: string;
  /** act1 pal.dat as RGB */
  readonly palette: Uint8Array;
  /** Colour-map file (without `.dat`) → bytes */
  readonly colormaps: ReadonlyMap<string, Uint8Array>;
}

/** colors.txt (`Transform Color`, `Code`): the codes must be TINT_COLORS in order, since a code's row is its block index. */
function checkColorsTxt(path: string): void {
  const codes = parseTsv(readFileSync(path, 'utf8'), 'colors.txt').rows.map((row) => row.str('Code'));
  if (codes.join(',') !== TINT_COLORS.join(',')) {
    console.error(`${path}: colour codes ${codes.join(', ')} differ from the expected ${TINT_COLORS.join(', ')}`);
    process.exit(1);
  }
}

/** The vanilla art folder, or null when the directory does not exist; exits when it exists but is incomplete. */
function readVanillaFolder(dir: string): VanillaFolder | null {
  if (!existsSync(dir)) return null;
  const spritesDir = join(dir, VANILLA_HD_ITEM_SPRITES_DIR);
  const required = [
    spritesDir,
    ...[
      VANILLA_HD_ITEMS_FILE,
      VANILLA_HD_UNIQUES_FILE,
      VANILLA_HD_SETS_FILE,
      VANILLA_BUILD_CONFIG_FILE,
      PALETTE_FILE,
      VANILLA_COLORS_FILE,
      ...COLORMAP_FILES.map((file) => `${COLORMAP_DIR}/${file}.dat`),
    ].map((file) => join(dir, file)),
  ];
  const missing = required.filter((path) => !existsSync(path));
  if (missing.length > 0) {
    console.error(`The vanilla art folder ${dir} is incomplete; missing: ${missing.join(', ')}`);
    process.exit(1);
  }
  const configPath = join(dir, VANILLA_BUILD_CONFIG_FILE);
  const rootHash = parseBuildConfigRoot(readFileSync(configPath, 'utf8'));
  if (rootHash === null) {
    console.error(`No "root = <hash>" line in ${configPath}`);
    process.exit(1);
  }
  const json = (file: string): unknown => JSON.parse(readFileSync(join(dir, file), 'utf8'));
  checkColorsTxt(join(dir, VANILLA_COLORS_FILE));
  const bytes = (file: string) => new Uint8Array(readFileSync(join(dir, file)));
  return {
    art: {
      index: buildSpriteIndex(listFilesRecursive(spritesDir)),
      assets: parseItemAssets(json(VANILLA_HD_ITEMS_FILE)).assets,
      uniqueArt: parseNamedArt(json(VANILLA_HD_UNIQUES_FILE), 'vanilla uniques.json').art,
      setArt: parseNamedArt(json(VANILLA_HD_SETS_FILE), 'vanilla sets.json').art,
    },
    spritesDir,
    rootHash,
    extractedAt: statSync(configPath).mtime.toISOString().slice(0, 10),
    palette: parsePalette(bytes(PALETTE_FILE)),
    colormaps: new Map(COLORMAP_FILES.map((file) => [file, bytes(`${COLORMAP_DIR}/${file}.dat`)])),
  };
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      esr: { type: 'string' },
      vanilla: { type: 'string' },
      check: { type: 'boolean', default: false },
    },
  });

  const esrDir = resolveEsrDir(values.esr);
  const spritesDir = join(esrDir, ESR_HD_ITEM_SPRITES_DIR);
  const itemsFile = join(esrDir, ESR_HD_ITEMS_FILE);
  const uniquesFile = join(esrDir, ESR_HD_UNIQUES_FILE);
  const setsFile = join(esrDir, ESR_HD_SETS_FILE);
  if (!existsSync(spritesDir) || !existsSync(itemsFile) || !existsSync(uniquesFile) || !existsSync(setsFile)) {
    console.error(`HD item art not found in the ESR clone: ${esrDir}`);
    console.error('Run npm run game-data:update (clones it with the HD paths), or pass --esr <dir>.');
    process.exit(1);
  }

  const esrTag = git(esrDir, ['describe', '--tags', '--exact-match']);
  const esrVersion = readModVersion(esrDir);
  console.log(`ESR source: ${esrDir}`);
  console.log(`  version ${esrVersion}, tag ${esrTag ?? '(none)'}`);
  const vanillaDir = resolveVanillaArtDir(values.vanilla);
  const vanilla = readVanillaFolder(vanillaDir);
  if (vanilla === null) {
    console.warn(`\nWARNING: vanilla art folder not found (${vanillaDir}), vanilla-derived icons not verified.`);
    if (!values.check) {
      console.error('Refusing to write without it: the committed vanilla-derived icons would be dropped.');
      console.error('Pass --vanilla <dir> or set D2R_VANILLA_ART_DIR (see docs/features/GAME-DATA.md, "Item icons").');
      process.exit(1);
    }
  } else {
    console.log(`Vanilla art: ${vanillaDir}`);
    console.log(`  steam-build.config root ${vanilla.rootHash}, extracted ${vanilla.extractedAt}`);
  }

  const { bases } = JSON.parse(readFileSync(join(OUTPUT_DIR, 'bases.json'), 'utf8')) as BasesBundle;
  const codes = bases.map((base) => base.code);
  const lootfilter = JSON.parse(readFileSync(join(OUTPUT_DIR, 'lootfilter.json'), 'utf8')) as LootFilterDataBundle;
  const { types } = JSON.parse(readFileSync(join(OUTPUT_DIR, 'types.json'), 'utf8')) as TypesBundle;
  const misc = selectMiscIconRows(lootfilter.items, new Map(types.map((type) => [type.code, type.ancestors])));
  const { assets, duplicates } = parseItemAssets(JSON.parse(readFileSync(itemsFile, 'utf8')));
  const uniqueArt = parseNamedArt(JSON.parse(readFileSync(uniquesFile, 'utf8')), 'uniques.json');
  const setArt = parseNamedArt(JSON.parse(readFileSync(setsFile, 'utf8')), 'sets.json');
  // Names resolve exactly as lootfilter.json / sets.json do (same string table, same reader)
  const { strings } = buildStringTable(readStringFiles(esrDir));
  const table = (name: string) => parseTsv(readFileSync(join(esrDir, ESR_EXCEL_DIR, `${name}.txt`), 'utf8'), `${name}.txt`);
  const uniques = readUniqueOrSetRows(table('uniqueitems'), 'code', strings);
  const sets = readUniqueOrSetRows(table('setitems'), 'item', strings);
  const invTrans = readInvTrans([table('weapons'), table('armor'), table('misc')]);
  const quest = selectQuestIconCodes([table('misc'), table('weapons'), table('armor')]);
  const index = buildSpriteIndex(listFilesRecursive(spritesDir));
  const plan = planItemIcons({
    codes,
    uniques,
    sets,
    misc,
    quest,
    assets,
    uniqueArt: uniqueArt.art,
    setArt: setArt.art,
    index,
    ...(vanilla === null ? {} : { vanilla: vanilla.art }),
  });

  const sourceDirs: Record<ArtSource, string> = { esr: spritesDir, vanilla: vanilla?.spritesDir ?? '' };
  // Inventory colour transforms need the vanilla folder's palette files; without it no entry is recoloured
  const tintPlan = planTints({
    uniqueChoices: plan.uniqueChoices,
    setChoices: plan.setChoices,
    invTrans,
    colormaps: vanilla === null ? null : new Set(vanilla.colormaps.keys()),
    tintOwnArt: (slug) => {
      const sprite = plan.sprites.get(slug);
      return sprite !== undefined && meanChroma(readSprite(join(sourceDirs[sprite.source], sprite.path)).rgba) <= GREYSCALE_MAX_CHROMA;
    },
  });

  const images = new Map<string, EncodedIcon>();
  const failures: string[] = [];
  for (const [slug, sprite] of plan.sprites) {
    try {
      images.set(slug, await encodeIcon(join(sourceDirs[sprite.source], sprite.path)));
    } catch (error) {
      failures.push(`${sprite.source}: ${sprite.path}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const tints = new Map<string, Tint>();
  for (const [slug, variant] of tintPlan.variants) {
    const sprite = plan.sprites.get(variant.source);
    const map = vanilla?.colormaps.get(variant.map);
    if (sprite === undefined || vanilla === null || map === undefined || !images.has(variant.source)) continue;
    const key = `${variant.map}-${variant.color}`;
    let tint = tints.get(key);
    if (tint === undefined) {
      tint = buildTint(vanilla.palette, colormapBlock(map, TINT_COLORS.indexOf(variant.color)));
      tints.set(key, tint);
    }
    images.set(slug, await encodeIcon(join(sourceDirs[sprite.source], sprite.path), tint));
  }
  const bundle = buildIconsBundle({
    esrVersion,
    esrTag,
    ...(vanilla === null ? {} : { vanilla: { rootHash: vanilla.rootHash, extractedAt: vanilla.extractedAt } }),
    plan,
    tints: tintPlan,
    itemNames: readItemNames([table('misc'), table('weapons'), table('armor')], strings),
    images,
    extension: EXTENSION,
  });
  const bundleText = serializeBundle(bundle);
  const files = new Map([...images].map(([slug, image]) => [`${slug}.${EXTENSION}`, image.bytes]));
  const totalBytes = [...files.values()].reduce((sum, bytes) => sum + bytes.byteLength, 0);
  const vanillaFileCount = [...plan.sprites.values()].filter((sprite) => sprite.source === 'vanilla').length;
  const tintedFiles = new Set(
    [bundle.uniques, bundle.sets].flatMap((section) =>
      Object.values(section)
        .filter((icon) => icon.tint !== undefined)
        .map((icon) => icon.file)
    )
  );
  const usedFiles = new Set(
    [bundle.bases, bundle.uniques, bundle.sets, bundle.misc, bundle.quest].flatMap((section) =>
      Object.values(section).map((icon) => icon.file)
    )
  );
  const unusedFiles = [...files.keys()].filter((name) => !usedFiles.has(name));
  const failedEntries = [plan.bases, plan.uniques, plan.sets, plan.misc, plan.quest].reduce(
    (sum, map) => sum + [...map.values()].filter((slug) => !images.has(slug)).length,
    0
  );

  console.log('\nCounts:');
  console.log(`  codes requested (bases.json): ${String(new Set(codes).size)}`);
  console.log(`  items.json entries: ${String(assets.size)} (${String(duplicates.length)} repeated codes ignored)`);
  console.log(`  sprites: ${String(index.size)} in the clone, ${String(vanilla?.art.index.size ?? 0)} in the vanilla folder`);
  const baseCount = plan.bases.size;
  console.log(
    `  bases: ${String(baseCount - plan.basesFromVanilla)} from ESR art, ${String(plan.basesFromVanilla)} from vanilla art, ` +
      `${String(plan.missingEntry.length + plan.missingArt.length)} without art`
  );
  console.log(`    without an items.json entry: ${String(plan.missingEntry.length)}${listCodes(plan.missingEntry)}`);
  console.log(
    `    asset in no source: ${String(plan.missingArt.length)}${plan.missingArt.length > 0 ? ` (${plan.missingArt.join(', ')})` : ''}`
  );
  printNamed('uniques (uniqueitems.txt rows with a base, by name)', uniques.length, plan.uniqueStats, uniqueArt.duplicates);
  printNamed('set items (setitems.txt rows, by name)', sets.length, plan.setStats, setArt.duplicates);
  printMisc(misc.length, plan.miscStats);
  printQuest(plan.questStats);
  console.log(
    `  icons written (distinct assets): ${String(files.size)} (${String(vanillaFileCount)} from vanilla art), ${(totalBytes / 1024).toFixed(1)} KB`
  );
  printTints('uniques', tintPlan.uniqueStats);
  printTints('set items', tintPlan.setStats);
  console.log(`    recoloured files (distinct asset, map, colour): ${String(tintedFiles.size)}`);
  console.log(`    untinted files only the recoloured variants use: ${String(unusedFiles.length)}${listCodes(unusedFiles)}`);
  console.log(`  decode failures: ${String(failures.length)} sprites, ${String(failedEntries)} entries`);
  for (const failure of failures) console.log(`    - ${failure}`);

  if (values.check) {
    const stale = vanilla === null ? checkWithoutVanilla(bundle, files) : checkAll(bundleText, files);
    if (stale.length > 0) {
      const shown = stale.slice(0, 10).join(', ') + (stale.length > 10 ? `, … (${String(stale.length)} in all)` : '');
      console.error(`\nStale item icons: ${shown}. Run npm run game-data:icons.`);
      process.exit(1);
    }
    console.log(
      vanilla === null
        ? '\nItem icons from the ESR clone are up to date (vanilla-derived icons not verified: vanilla art folder not found).'
        : '\nItem icons are up to date.'
    );
    return;
  }

  mkdirSync(ICONS_DIR, { recursive: true });
  for (const name of listIconFiles()) if (!files.has(name)) rmSync(join(ICONS_DIR, name));
  for (const [name, bytes] of files) writeFileSync(join(ICONS_DIR, name), bytes);
  writeFileSync(join(OUTPUT_DIR, 'icons.json'), bundleText, 'utf8');
  console.log(`\nWritten: public/game-data/icons.json (${(Buffer.byteLength(bundleText, 'utf8') / 1024).toFixed(1)} KB)`);
  console.log(`         public/game-data/icons/ (${String(files.size)} files)`);
  console.log('Run node scripts/generate-game-data.ts to list icons.json in the manifest.');
}

/** Both sources present: icons.json and every image byte for byte, plus orphans. */
function checkAll(bundleText: string, files: ReadonlyMap<string, Buffer>): string[] {
  const stale: string[] = [];
  const iconsJson = join(OUTPUT_DIR, 'icons.json');
  if (!existsSync(iconsJson) || readFileSync(iconsJson, 'utf8') !== bundleText) stale.push('icons.json');
  for (const [name, bytes] of files) if (!sameFile(name, bytes)) stale.push(`icons/${name}`);
  for (const name of listIconFiles()) if (!files.has(name)) stale.push(`icons/${name} (orphan)`);
  return stale;
}

/**
 * No vanilla folder: the clone-derived entries and images must match; the committed vanilla-derived files (icons.json
 * `vanilla.files`) must exist and are otherwise accepted.
 */
function checkWithoutVanilla(esrOnly: IconsBundle, files: ReadonlyMap<string, Buffer>): string[] {
  const iconsJson = join(OUTPUT_DIR, 'icons.json');
  if (!existsSync(iconsJson)) return ['icons.json (missing)'];
  const committed = JSON.parse(readFileSync(iconsJson, 'utf8')) as IconsBundle;
  const vanillaFiles = new Set(committed.vanilla?.files ?? []);
  // Recoloured files need the vanilla folder's colour maps: accepted unverified, like the vanilla-derived ones
  const tintedFiles = new Set(
    [committed.uniques, committed.sets].flatMap((section) =>
      Object.values(section)
        .filter((icon) => icon.tint !== undefined)
        .map((icon) => icon.file)
    )
  );
  const stale = compareWithoutVanilla(committed, esrOnly).map((problem) => `icons.json (${problem})`);
  for (const [name, bytes] of files) if (!sameFile(name, bytes)) stale.push(`icons/${name}`);
  for (const name of vanillaFiles) if (!existsSync(join(ICONS_DIR, name))) stale.push(`icons/${name} (vanilla, missing)`);
  for (const name of tintedFiles) if (!existsSync(join(ICONS_DIR, name))) stale.push(`icons/${name} (recoloured, missing)`);
  for (const name of listIconFiles()) {
    if (!files.has(name) && !vanillaFiles.has(name) && !tintedFiles.has(name)) stale.push(`icons/${name} (orphan)`);
  }
  return stale;
}

function sameFile(name: string, bytes: Buffer): boolean {
  const path = join(ICONS_DIR, name);
  return existsSync(path) && readFileSync(path).equals(bytes);
}

function listIconFiles(): string[] {
  if (!existsSync(ICONS_DIR)) return [];
  return readdirSync(ICONS_DIR).filter((name) => name.endsWith(`.${EXTENSION}`));
}

function printNamed(label: string, rows: number, stats: NamedIconStats, duplicates: readonly string[]): void {
  console.log(`  ${label}: ${String(stats.requested)} names from ${String(rows)} rows`);
  console.log(
    `    ${String(stats.own + stats.base - stats.vanilla)} from ESR art, ${String(stats.vanilla)} from vanilla art, ${String(stats.none)} without art`
  );
  console.log(`    own art: ${String(stats.own)}, base art only: ${String(stats.base)}`);
  console.log(`    own art entry pointing at art no source has: ${String(stats.ownArtMissing)}`);
  if (stats.noneNames.length > 0) console.log(`    without art: ${stats.noneNames.join(', ')}`);
  if (stats.vanillaKeyUsed.length > 0) console.log(`    own entries from the vanilla file: ${stats.vanillaKeyUsed.join(', ')}`);
  if (stats.vanillaKeyRejected.length > 0) {
    console.log(`    vanilla own entries ignored (other asset folder than the base): ${stats.vanillaKeyRejected.join(', ')}`);
  }
  console.log(`    art keys no row matched: ${String(stats.unusedKeys.length)}${listCodes(stats.unusedKeys)}`);
  if (duplicates.length > 0) console.log(`    repeated art keys (first wins): ${duplicates.join(', ')}`);
}

function printMisc(rows: number, stats: MiscIconStats): void {
  console.log(`  misc items (types ${MISC_ICON_TYPES.join(', ')}, by name): ${String(stats.requested)} names from ${String(rows)} rows`);
  console.log(
    `    ${String(stats.withArt - stats.vanilla)} from ESR art, ${String(stats.vanilla)} from vanilla art, ` +
      `${String(stats.requested - stats.withArt)} without art`
  );
  if (stats.noneNames.length > 0) console.log(`    without art: ${stats.noneNames.join(', ')}`);
  if (stats.splitNames.length > 0) console.log(`    keyed per code (rows with different art): ${stats.splitNames.join(', ')}`);
}

function printQuest(stats: QuestIconStats): void {
  const withArt = stats.requested - stats.missing.length;
  console.log(`  quest items (a quest number or types ${QUEST_ICON_TYPES.join(', ')}, by code): ${String(stats.requested)} codes`);
  console.log(
    `    ${String(withArt - stats.vanilla)} from ESR art, ${String(stats.vanilla)} from vanilla art, ` +
      `${String(stats.missing.length)} without art${listCodes(stats.missing)}`
  );
}

function printTints(label: string, stats: TintStats): void {
  console.log(`  colour transforms, ${label}: ${String(stats.recoloured)} recoloured (${String(stats.recolouredOwnArt)} of them own art)`);
  console.log(`    colour code but the base never recolours (InvTrans 0, 3, 4): ${String(stats.neverRecolour)}`);
  console.log(`    colour code but no palette data (vanilla folder missing): ${String(stats.noPaletteData)}`);
  if (stats.ownArtSkipped > 0) console.log(`    own art left untinted: ${String(stats.ownArtSkipped)}`);
  if (stats.unknownColor.length > 0) console.log(`    unknown colour codes: ${stats.unknownColor.join(', ')}`);
}

function listCodes(codes: readonly string[]): string {
  return codes.length === 0 ? '' : ` (${codes.slice(0, 20).join(', ')}${codes.length > 20 ? ', …' : ''})`;
}

await main();
