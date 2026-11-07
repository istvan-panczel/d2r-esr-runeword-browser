#!/usr/bin/env node
/**
 * Crops the skill icons of public/game-data/skilldetails.json (`icon` keys) from the ESR clone's HD skill icon sheets
 * into public/game-data/icons/skills/<key>.webp (see src/features/game-data/build/skillIcons.ts for the sheet layout),
 * and the specialisation perk icons of public/game-data/specializations.json (`icon` keys, `<tree>-<perk number>`) from
 * the HD perk sheets (hd/global/ui/specializations/<tree>.sprite, one cel per perk in row order) into
 * public/game-data/icons/specializations/<key>.webp.
 *
 *   node scripts/generate-skill-icons.ts [--esr <dir>] [--check]
 *
 * Source: --esr <dir> | ESR_SOURCE_DIR | ../Eastern_Sun_Resurrected (relative to the repo root). No vanilla art is
 * needed. Run generate-game-data.ts first: the keys come from the committed skilldetails.json and specializations.json,
 * which also carry the index (the key names the file) and the manifest counts (`skillIcons`, `specializationIcons`).
 * --check regenerates in memory and exits 1 when an image differs, is missing or is an orphan.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import sharp from 'sharp';
import type { SkillDetailsBundle, SpecializationsBundle } from '../src/features/game-data/engine/schema.ts';
import { ESR_HD_SPECIALIZATION_SPRITES_DIR } from '../src/features/game-data/build/bundleSpecializations.ts';
import { fitInside, listFilesRecursive } from '../src/features/game-data/build/itemIcons.ts';
import {
  cropCel,
  ESR_HD_SKILL_SPRITES_DIR,
  parsePerkIconKey,
  parseSkillIconKey,
  skillSheets,
} from '../src/features/game-data/build/skillIcons.ts';
import { decodeSprite, type DecodedSprite } from '../src/features/loot-filter/engine/sprite.ts';
import { REPO_ROOT, resolveEsrDir } from './lib/esrClone.ts';

const OUTPUT_DIR = join(REPO_ROOT, 'public', 'game-data');
const ICONS_DIR = join(OUTPUT_DIR, 'icons', 'skills');
const PERK_ICONS_DIR = join(OUTPUT_DIR, 'icons', 'specializations');
const EXTENSION = 'webp';
/** Shown at up to 48 CSS px; 64 keeps them sharp on 1.5× screens and the set small */
const ICON_SIDE = 64;
const WEBP_QUALITY = 80;
/** The sheets are horizontal strips (ESR's widest, submenu/skillicon.sprite, is 16236 px) */
const MAX_SHEET_SIDE = 32768;

/** One icon set: the keys to crop, where each key's cel is, and the output folder */
interface IconSet {
  label: string;
  dir: string;
  /** Path in public/game-data/ for the messages */
  publicDir: string;
  keys: readonly string[];
  locate: (key: string) => { file: string; cel: number } | string;
}

interface CroppedSet {
  set: IconSet;
  files: Map<string, Buffer>;
  failures: string[];
}

async function cropSet(set: IconSet, decoded: Map<string, DecodedSprite>): Promise<CroppedSet> {
  const files = new Map<string, Buffer>();
  const failures: string[] = [];
  for (const key of set.keys) {
    const location = set.locate(key);
    if (typeof location === 'string') {
      failures.push(`${key}: ${location}`);
      continue;
    }
    let sheet = decoded.get(location.file);
    if (sheet === undefined) {
      sheet = decodeSprite(new Uint8Array(readFileSync(location.file)), MAX_SHEET_SIDE);
      decoded.set(location.file, sheet);
    }
    const cel = cropCel(sheet, location.cel);
    if (cel === null) {
      failures.push(`${key}: cel ${String(location.cel)} outside ${location.file} (${String(sheet.frames)} cels)`);
      continue;
    }
    const size = fitInside(cel.width, cel.height, ICON_SIDE);
    const bytes = await sharp(cel.rgba, { raw: { width: cel.width, height: cel.height, channels: 4 } })
      .resize(size.width, size.height, { fit: 'fill', kernel: 'lanczos3' })
      .webp({ quality: WEBP_QUALITY, alphaQuality: 100, effort: 4, smartSubsample: true })
      .toBuffer();
    files.set(`${key}.${EXTENSION}`, bytes);
  }
  return { set, files, failures };
}

function existingFiles(dir: string): string[] {
  return existsSync(dir) ? readdirSync(dir).filter((name) => name.endsWith(`.${EXTENSION}`)) : [];
}

/** Stale, missing and orphan images of a set (--check) */
function staleFiles({ set, files }: CroppedSet): string[] {
  const stale = [...files]
    .filter(([name, bytes]) => {
      const path = join(set.dir, name);
      return !existsSync(path) || !readFileSync(path).equals(bytes);
    })
    .map(([name]) => `${set.publicDir}/${name}`);
  for (const name of existingFiles(set.dir)) if (!files.has(name)) stale.push(`${set.publicDir}/${name} (orphan)`);
  return stale;
}

function readBundle(name: string): unknown {
  const path = join(OUTPUT_DIR, `${name}.json`);
  if (!existsSync(path)) {
    console.error(`public/game-data/${name}.json is missing; run npm run game-data:generate first.`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(path, 'utf8'));
}

async function main(): Promise<void> {
  const { values } = parseArgs({ options: { esr: { type: 'string' }, check: { type: 'boolean', default: false } } });
  const esrDir = resolveEsrDir(values.esr);
  const spritesDir = join(esrDir, ESR_HD_SKILL_SPRITES_DIR);
  const perkSpritesDir = join(esrDir, ESR_HD_SPECIALIZATION_SPRITES_DIR);
  if (!existsSync(spritesDir)) {
    console.error(`HD skill icon sheets not found in the ESR clone: ${spritesDir}`);
    console.error('Run npm run game-data:update (clones it with the HD paths), or pass --esr <dir>.');
    process.exit(1);
  }
  const { skills } = readBundle('skilldetails') as SkillDetailsBundle;
  const { trees } = readBundle('specializations') as SpecializationsBundle;
  const keys = [...new Set(skills.flatMap((skill) => (skill.icon === undefined ? [] : [skill.icon])))].sort();
  const perkKeys = [...new Set(trees.flatMap((tree) => tree.perks.flatMap((perk) => (perk.icon === undefined ? [] : [perk.icon]))))].sort();
  const sheets = skillSheets(listFilesRecursive(spritesDir));
  console.log(`ESR source: ${esrDir}`);
  console.log(`  sheets: ${[...sheets].map(([prefix, file]) => `${prefix} = ${file}`).join(', ')}`);

  const sets: IconSet[] = [
    {
      label: 'skill',
      dir: ICONS_DIR,
      publicDir: 'icons/skills',
      keys,
      locate: (key) => {
        const parsed = parseSkillIconKey(key);
        const sheetFile = parsed === null ? undefined : sheets.get(parsed.prefix);
        return parsed === null || sheetFile === undefined ? 'no sheet' : { file: join(spritesDir, sheetFile), cel: parsed.cel };
      },
    },
    {
      label: 'specialisation perk',
      dir: PERK_ICONS_DIR,
      publicDir: 'icons/specializations',
      keys: perkKeys,
      locate: (key) => {
        const parsed = parsePerkIconKey(key);
        if (parsed === null) return 'not a perk icon key';
        const file = join(perkSpritesDir, parsed.sheet);
        return existsSync(file) ? { file, cel: parsed.cel } : `no sheet ${parsed.sheet}`;
      },
    },
  ];
  const decoded = new Map<string, DecodedSprite>();
  const cropped: CroppedSet[] = [];
  for (const set of sets) cropped.push(await cropSet(set, decoded));

  console.log('\nCounts:');
  console.log(`  icon keys in skilldetails.json: ${String(keys.length)} (${String(skills.length)} skills)`);
  console.log(`  perk icon keys in specializations.json: ${String(perkKeys.length)}`);
  for (const { set, files, failures } of cropped) {
    const totalBytes = [...files.values()].reduce((sum, bytes) => sum + bytes.byteLength, 0);
    console.log(`  ${set.label} icons: ${String(files.size)}, ${(totalBytes / 1024).toFixed(1)} KB`);
    console.log(`  ${set.label} failures: ${String(failures.length)}`);
    for (const failure of failures) console.log(`    - ${failure}`);
  }
  const failureCount = cropped.reduce((sum, entry) => sum + entry.failures.length, 0);

  if (values.check) {
    const stale = cropped.flatMap(staleFiles);
    if (stale.length > 0 || failureCount > 0) {
      const shown = stale.slice(0, 10).join(', ') + (stale.length > 10 ? `, … (${String(stale.length)} in all)` : '');
      console.error(`\nStale skill / perk icons: ${shown || '(none)'}; failures: ${String(failureCount)}. Run npm run game-data:icons.`);
      process.exit(1);
    }
    console.log('\nSkill and perk icons are up to date.');
    return;
  }
  if (failureCount > 0) {
    console.error('\nSome icon keys could not be cropped; fix the sheet mapping before writing.');
    process.exit(1);
  }
  for (const { set, files } of cropped) {
    mkdirSync(set.dir, { recursive: true });
    for (const name of existingFiles(set.dir)) if (!files.has(name)) rmSync(join(set.dir, name));
    for (const [name, bytes] of files) writeFileSync(join(set.dir, name), bytes);
    console.log(`\nWritten: public/game-data/${set.publicDir}/ (${String(files.size)} files)`);
  }
}

await main();
