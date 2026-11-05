#!/usr/bin/env node
/**
 * Draws the generated minimap icons of the loot filter editor (scripts/lib/lootFilterIcons.ts: shapes in the style
 * presets' colours) and writes them as 128 px .sprite files to public/loot-filters/icons/<shape>_<colour>.sprite, next to
 * Sully's icons. Register a new one in src/features/loot-filter/utils/bundledAssets.ts (bundledAssets.test.ts fails while
 * the folder and the registry disagree).
 *
 *   node scripts/generate-loot-filter-icons.ts [--check] [--sheet <file.png>]
 *
 * --check redraws in memory and exits 1 when a file differs, is missing or is an orphan (a `<shape>_<colour>.sprite` no
 * longer in the list); without it, the files are written and orphans removed.
 * --sheet writes a contact sheet: every generated icon decoded back from its file with the app's decoder, at 128, 48 and
 * 32 px on a dark background, then Sully's icons for comparison.
 * No .lowend.sprite is written: the plugin builds the game's low graphics copy itself from the .sprite file.
 */
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import sharp, { type OverlayOptions } from 'sharp';
import { decodeSprite, type DecodedSprite } from '../src/features/loot-filter/engine/sprite.ts';
import { encodeSprite } from '../src/features/loot-filter/engine/spriteEncode.ts';
import { REPO_ROOT } from './lib/esrClone.ts';
import { GENERATED_ICONS, ICON_COLORS, ICON_SHAPES, ICON_SIZE, renderIcon } from './lib/lootFilterIcons.ts';

const ICONS_DIR = join(REPO_ROOT, 'public', 'loot-filters', 'icons');
const GENERATED_NAME = new RegExp(`^(${Object.keys(ICON_SHAPES).join('|')})_(${Object.keys(ICON_COLORS).join('|')})\\.sprite$`);

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((byte, index) => byte === b[index]);
}

async function main(): Promise<void> {
  const { values } = parseArgs({ options: { check: { type: 'boolean', default: false }, sheet: { type: 'string' } } });
  const files = new Map(
    GENERATED_ICONS.map((icon) => [`${icon.name}.sprite`, encodeSprite({ width: ICON_SIZE, height: ICON_SIZE, rgba: renderIcon(icon) })])
  );
  const orphans = readdirSync(ICONS_DIR).filter((file) => GENERATED_NAME.test(file) && !files.has(file));

  if (values.check) {
    const problems: string[] = [];
    for (const [file, bytes] of files) {
      const path = join(ICONS_DIR, file);
      if (!existsSync(path)) problems.push(`${file}: missing`);
      else if (!sameBytes(new Uint8Array(readFileSync(path)), bytes)) problems.push(`${file}: differs`);
    }
    for (const file of orphans) problems.push(`${file}: orphan (no longer generated)`);
    if (problems.length > 0) {
      console.error(`The generated loot filter icons are stale (run npm run loot-filter:icons):\n  ${problems.join('\n  ')}`);
      process.exit(1);
    }
    console.log(`${String(files.size)} generated loot filter icons are up to date.`);
  } else {
    let total = 0;
    for (const [file, bytes] of files) {
      writeFileSync(join(ICONS_DIR, file), bytes);
      total += bytes.length;
    }
    for (const file of orphans) rmSync(join(ICONS_DIR, file));
    console.log(
      `Wrote ${String(files.size)} icons (${(total / 1024 / 1024).toFixed(2)} MB) to public/loot-filters/icons/${orphans.length > 0 ? `, removed ${orphans.join(', ')}` : ''}.`
    );
  }

  if (values.sheet !== undefined) {
    const sully = readdirSync(ICONS_DIR)
      .filter((file) => file.endsWith('.sprite') && !file.endsWith('.lowend.sprite') && !GENERATED_NAME.test(file))
      .sort((a, b) => a.localeCompare(b));
    await writeContactSheet(values.sheet, [...files.keys()], sully);
    console.log(`Contact sheet: ${values.sheet}`);
  }
}

const CELL_WIDTH = 200;
const CELL_HEIGHT = 196;
const COLUMNS = 5;
const BACKGROUND = { r: 24, g: 26, b: 30 };
const HEADING_HEIGHT = 36;

/** The decoded sprite as a PNG of `side` px (the longer side), for compositing. */
async function spriteImage(sprite: DecodedSprite, side: number): Promise<Buffer> {
  const image = sharp(Buffer.from(sprite.rgba.buffer, sprite.rgba.byteOffset, sprite.rgba.byteLength), {
    raw: { width: sprite.width, height: sprite.height, channels: 4 },
  });
  return (side === sprite.width ? image : image.resize(side, side, { kernel: 'lanczos3' })).png().toBuffer();
}

const escapeXml = (text: string) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

async function writeContactSheet(path: string, generated: readonly string[], sully: readonly string[]): Promise<void> {
  const sections = [
    { title: `Generated icons (${String(generated.length)}): 128 px, then 48 and 32 px as on the minimap`, files: generated },
    { title: "Sully's icons, for comparison", files: sully },
  ];
  const rows = (count: number) => Math.ceil(count / COLUMNS);
  const height = sections.reduce((sum, section) => sum + HEADING_HEIGHT + rows(section.files.length) * CELL_HEIGHT, 0);
  const width = COLUMNS * CELL_WIDTH;
  const layers: OverlayOptions[] = [];
  const labels: string[] = [];
  let y = 0;
  for (const section of sections) {
    labels.push(`<text x="12" y="${String(y + 24)}" font-size="16" font-weight="bold">${escapeXml(section.title)}</text>`);
    y += HEADING_HEIGHT;
    for (const [index, file] of section.files.entries()) {
      const sprite = decodeSprite(new Uint8Array(readFileSync(join(ICONS_DIR, file))));
      const left = (index % COLUMNS) * CELL_WIDTH;
      const top = y + Math.floor(index / COLUMNS) * CELL_HEIGHT;
      layers.push({ input: await spriteImage(sprite, 128), left: left + 8, top: top + 8 });
      layers.push({ input: await spriteImage(sprite, 48), left: left + 144, top: top + 16 });
      layers.push({ input: await spriteImage(sprite, 32), left: left + 152, top: top + 88 });
      labels.push(
        `<text x="${String(left + 10)}" y="${String(top + 158)}" font-size="14">${escapeXml(file.replace(/\.sprite$/, ''))}</text>`
      );
    }
    y += rows(section.files.length) * CELL_HEIGHT;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${String(width)}" height="${String(height)}"><g fill="#d8d8d8" font-family="Helvetica, Arial, sans-serif">${labels.join('')}</g></svg>`;
  layers.push({ input: Buffer.from(svg), left: 0, top: 0 });
  await sharp({ create: { width, height, channels: 4, background: { ...BACKGROUND, alpha: 1 } } })
    .composite(layers)
    .png()
    .toFile(path);
}

await main();
