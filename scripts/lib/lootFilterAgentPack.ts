/**
 * Writes or checks the loot filter agent pack, public/loot-filters/agent/ (README.md, FORMAT.md, examples.md, assets.md
 * and the full game data tables), from the committed public/game-data bundles, as the "Create a filter with AI help"
 * page builds its reference from them. Used by generate-loot-filter-agent-pack.ts and generate-game-data.ts (after it
 * writes the bundles). See docs/features/LOOT-FILTER.md "AI help".
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { GameDataManifest, LootFilterDataBundle, TypesBundle } from '../../src/features/game-data/engine/schema.ts';
import { REPO_ROOT } from './esrClone.ts';
import { SITE_URL } from './sitemap.ts';
import { importSrc } from './srcImport.ts';

export const AGENT_PACK_DIR = join(REPO_ROOT, 'public', 'loot-filters', 'agent');
const GAME_DATA_DIR = join(REPO_ROOT, 'public', 'game-data');

/** A pack file as `agentPack.ts` builds it (`PromptFile`; the loot filter code is outside the scripts' tsconfig). */
interface PackFile {
  readonly path: string;
  readonly text: string;
}

/** The validator's game-data lookups (`LootFilterReference`), passed through untouched. */
type Reference = object;

interface AgentPackModule {
  buildAgentPack: (
    input: { data: LootFilterDataBundle; types: TypesBundle; reference: Reference; esrVersion: string },
    siteUrl: string
  ) => readonly PackFile[];
}

interface ReferenceModule {
  buildLootFilterReference: (data: LootFilterDataBundle, types: TypesBundle) => Reference;
}

const readJson = (file: string): unknown => JSON.parse(readFileSync(join(GAME_DATA_DIR, file), 'utf8'));

/** The pack from the committed bundles, built by the app's own code. */
export async function buildCommittedAgentPack(): Promise<readonly PackFile[]> {
  const { buildAgentPack } = await importSrc<AgentPackModule>('features/loot-filter/utils/aiPrompt/agentPack.ts');
  const { buildLootFilterReference } = await importSrc<ReferenceModule>('features/loot-filter/engine/reference.ts');
  const data = readJson('lootfilter.json') as LootFilterDataBundle;
  const types = readJson('types.json') as TypesBundle;
  const { esrVersion } = readJson('manifest.json') as GameDataManifest;
  return buildAgentPack({ data, types, reference: buildLootFilterReference(data, types), esrVersion }, SITE_URL);
}

/** Writes the pack and removes files it no longer has (`check`: compares instead); false when, with `check`, it is stale. */
export async function updateLootFilterAgentPack(check: boolean): Promise<boolean> {
  const files = await buildCommittedAgentPack();
  const names = new Set(files.map((file) => file.path));
  const present = existsSync(AGENT_PACK_DIR) ? readdirSync(AGENT_PACK_DIR) : [];
  const extra = present.filter((name) => !names.has(name));

  if (check) {
    const stale = files.filter((file) => {
      const path = join(AGENT_PACK_DIR, file.path);
      return !existsSync(path) || readFileSync(path, 'utf8') !== file.text;
    });
    if (stale.length > 0 || extra.length > 0) {
      const parts = [...stale.map((file) => file.path), ...extra.map((name) => `${name} (not generated)`)];
      console.error(`Stale loot filter agent pack (public/loot-filters/agent/): ${parts.join(', ')}. Run npm run loot-filter:agent-pack.`);
      return false;
    }
    console.log(`Loot filter agent pack is up to date (${String(files.length)} files).`);
    return true;
  }

  mkdirSync(AGENT_PACK_DIR, { recursive: true });
  for (const name of extra) rmSync(join(AGENT_PACK_DIR, name), { recursive: true });
  console.log('Loot filter agent pack:');
  for (const file of files) {
    writeFileSync(join(AGENT_PACK_DIR, file.path), file.text, 'utf8');
    console.log(`  public/loot-filters/agent/${file.path} (${(Buffer.byteLength(file.text, 'utf8') / 1024).toFixed(1)} KB)`);
  }
  for (const name of extra) console.log(`  removed public/loot-filters/agent/${name}`);
  return true;
}
