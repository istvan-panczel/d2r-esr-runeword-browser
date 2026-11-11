#!/usr/bin/env node
/**
 * Converts the ESR txt game tables into the static JSON bundles under public/game-data/.
 *
 *   node scripts/generate-game-data.ts [--esr <dir>] [--check]
 *
 * Source: --esr <dir> | ESR_SOURCE_DIR | ../Eastern_Sun_Resurrected (relative to the repo root).
 * --check regenerates in memory and exits 1 when the committed files are stale.
 * Also writes (--check: checks) src/features/modifiers/data/modifierRefs.json from the fresh modifiers bundle
 * (scripts/lib/modifierRefsFile.ts; `npm run modifiers:refs` does that step alone), and after the bundles the loot filter
 * agent pack, public/loot-filters/agent/ (scripts/lib/lootFilterAgentPack.ts; `npm run loot-filter:agent-pack` alone).
 * icons.json comes from scripts/generate-item-icons.ts; when present it is only listed in the manifest (hash, counts).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import type { GameDataManifest, IconsBundle, ModifiersBundle } from '../src/features/game-data/engine/schema.ts';
import { readEsrSources } from '../src/features/game-data/build/esrSources.ts';
import { generateBundles } from '../src/features/game-data/build/generateBundles.ts';
import { untintedFile } from '../src/features/game-data/build/itemTint.ts';
import { buildManifest, serializeBundle } from '../src/features/game-data/build/writeBundle.ts';
import { git, REPO_ROOT, resolveEsrDir } from './lib/esrClone.ts';
import { updateLootFilterAgentPack } from './lib/lootFilterAgentPack.ts';
import { updateModifierRefs } from './lib/modifierRefsFile.ts';

const OUTPUT_DIR = join(REPO_ROOT, 'public', 'game-data');

function readPreviousManifest(): GameDataManifest | null {
  const path = join(OUTPUT_DIR, 'manifest.json');
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as GameDataManifest;
  } catch {
    return null;
  }
}

/** The committed icons.json (written by generate-item-icons.ts), listed in the manifest as is; null when absent. */
function readIcons(): { text: string; counts: Record<string, number> } | null {
  const path = join(OUTPUT_DIR, 'icons.json');
  if (!existsSync(path)) return null;
  const text = readFileSync(path, 'utf8');
  const bundle = JSON.parse(text) as IconsBundle;
  const count = (section: Record<string, unknown> | undefined) => Object.keys(section ?? {}).length;
  // Entries (all sections) whose image came from the vanilla art folder (recoloured ones through their source file)
  const vanillaFiles = new Set(bundle.vanilla?.files ?? []);
  const entries = [bundle.bases, bundle.uniques, bundle.sets, bundle.misc, bundle.quest, bundle.items, bundle.types].flatMap((section) =>
    Object.values(section)
  );
  const vanillaIcons = entries.filter((icon) => vanillaFiles.has(untintedFile(icon.file))).length;
  const tinted = entries.filter((icon) => icon.tint !== undefined);
  return {
    text,
    counts: {
      itemIcons: count(bundle.bases),
      uniqueIcons: count(bundle.uniques),
      setIcons: count(bundle.sets),
      miscIcons: count(bundle.misc),
      questIcons: count(bundle.quest),
      itemCodeIcons: count(bundle.items),
      typeIcons: count(bundle.types),
      vanillaIcons,
      vanillaIconFiles: vanillaFiles.size,
      tintedIcons: tinted.length,
      tintedIconFiles: new Set(tinted.map((icon) => icon.file)).size,
    },
  };
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      esr: { type: 'string' },
      check: { type: 'boolean', default: false },
    },
  });

  const esrDir = resolveEsrDir(values.esr);
  if (!existsSync(esrDir)) {
    console.error(`ESR clone not found: ${esrDir}`);
    console.error('Run npm run game-data:update (clones it), or pass --esr <dir>.');
    process.exit(1);
  }

  const esrCommit = git(esrDir, ['rev-parse', 'HEAD']);
  if (esrCommit === null) {
    console.error(`Not a git checkout: ${esrDir}`);
    process.exit(1);
  }
  const esrTag = git(esrDir, ['describe', '--tags', '--exact-match']);
  const dirty = git(esrDir, ['status', '--porcelain']);

  console.log(`ESR source: ${esrDir}`);
  const sources = readEsrSources(esrDir);
  console.log(`  version ${sources.esrVersion}, tag ${esrTag ?? '(none)'}, commit ${esrCommit.slice(0, 7)}`);
  if (dirty !== null && dirty !== '') console.warn('  WARNING: the ESR clone has uncommitted changes; output will not match the commit');

  const generated = generateBundles(sources);
  const files = {
    types: serializeBundle(generated.types),
    bases: serializeBundle(generated.bases),
    runewords: serializeBundle(generated.runewords),
    affixes: serializeBundle(generated.affixes),
    sources: serializeBundle(generated.sources),
    lootfilter: serializeBundle(generated.lootfilter),
    enhance: serializeBundle(generated.enhance),
    cube: serializeBundle(generated.cube),
    materials: serializeBundle(generated.materials),
    sets: serializeBundle(generated.sets),
    skills: serializeBundle(generated.skills),
    skilldetails: serializeBundle(generated.skilldetails),
    skillcalc: serializeBundle(generated.skillcalc),
    crafting: serializeBundle(generated.crafting),
    tiers: serializeBundle(generated.tiers),
    areas: serializeBundle(generated.areas),
    stash: serializeBundle(generated.stash),
    stashnames: serializeBundle(generated.stashnames),
    itemtext: serializeBundle(generated.itemtext),
    terrorzones: serializeBundle(generated.terrorzones),
    modifiers: serializeBundle(generated.modifiers),
    masteries: serializeBundle(generated.masteries),
    specializations: serializeBundle(generated.specializations),
    mercenaries: serializeBundle(generated.mercenaries),
    killledger: serializeBundle(generated.killledger),
    elixirs: serializeBundle(generated.elixirs),
    combat: serializeBundle(generated.combat),
  };
  const icons = readIcons();
  const manifest = buildManifest({
    esrVersion: sources.esrVersion,
    esrTag,
    esrCommit,
    esrDate: git(esrDir, ['log', '-1', '--format=%cI', 'HEAD']),
    files: icons === null ? files : { ...files, icons: icons.text },
    counts: icons === null ? generated.counts : { ...generated.counts, ...icons.counts },
    warnings: generated.warnings,
    previous: readPreviousManifest(),
    now: new Date(),
  });
  const outputs: Record<string, string> = { ...files, manifest: serializeBundle(manifest) };

  console.log('\nCounts:');
  for (const [key, value] of Object.entries(generated.counts)) console.log(`  ${key}: ${String(value)}`);
  console.log(`\nString conflicts (${String(generated.stringWarnings.length)}, not stored in the manifest):`);
  for (const warning of generated.stringWarnings) console.log(`  - ${warning}`);
  console.log(`\nWarnings (${String(generated.warnings.length)}):`);
  for (const warning of generated.warnings) console.log(`  - ${warning}`);

  // The modifier peek's data comes from the modifiers bundle as written (JSON, not the in-memory objects)
  const modifiers = JSON.parse(files.modifiers) as ModifiersBundle;

  if (values.check) {
    const stale = Object.entries(outputs).filter(([name, text]) => {
      const path = join(OUTPUT_DIR, `${name}.json`);
      return !existsSync(path) || readFileSync(path, 'utf8') !== text;
    });
    console.log('');
    const refsOk = updateModifierRefs(modifiers, true);
    // Built from the committed bundles: meaningful only when they are fresh (checked first)
    const packOk = stale.length > 0 || (await updateLootFilterAgentPack(true));
    if (stale.length > 0) {
      console.error(`\nStale game data: ${stale.map(([name]) => `${name}.json`).join(', ')}. Run npm run game-data:generate.`);
      process.exit(1);
    }
    if (!refsOk || !packOk) process.exit(1);
    console.log('\nGame data is up to date.');
    return;
  }

  mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log('\nWritten:');
  for (const [name, text] of Object.entries(outputs)) {
    writeFileSync(join(OUTPUT_DIR, `${name}.json`), text, 'utf8');
    console.log(`  public/game-data/${name}.json (${(Buffer.byteLength(text, 'utf8') / 1024).toFixed(1)} KB)`);
  }
  console.log('');
  if (!updateModifierRefs(modifiers, false)) process.exit(1);
  console.log('');
  // The pack reads the bundles just written, as the browser does
  if (!(await updateLootFilterAgentPack(false))) process.exit(1);
}

await main();
