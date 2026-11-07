/**
 * Shared helpers for the local Eastern Sun Resurrected clone used by the game-data scripts.
 */
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ESR_BOSS_SET_UNIQUE_DROP_FILE,
  ESR_MODIFIER_CONFIGS,
  ESR_MODIFIER_PATCHES,
  modifierConfigFile,
  modifierPatchFile,
  specializationConfigPath,
} from '../../src/features/game-data/build/esrSources.ts';
import {
  ESR_HD_SPECIALIZATION_SPRITES_DIR,
  PERK_CONFIG_FILES,
  SPECIALIZATIONS_CONFIG_FILE,
} from '../../src/features/game-data/build/bundleSpecializations.ts';

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const ESR_REPO_URL = 'https://github.com/CelestialRayOne/Eastern_Sun_Resurrected.git';
export const DEFAULT_ESR_DIR = '../Eastern_Sun_Resurrected';

/**
 * Paths the generators and the tests read (non-cone sparse-checkout patterns). docs/ is the official site: weapons.htm
 * and armors.htm are the base-name oracle of bundleIntegrity.test.ts, and the guide checks its docs: links against it.
 * patchnotes/ is reference material for the guide authors. hd/items/ and hd/global/ui/items/ are the item art
 * (generate-item-icons.ts), hd/global/ui/spells/ the skill icon sheets and hd/global/ui/specializations/ the perk
 * icon sheets (generate-skill-icons.ts). The plugin configs and patches of ESR_MODIFIER_CONFIGS / ESR_MODIFIER_PATCHES
 * are the ESR facts of modifiers.json; the specialisation configs give specializations.json.
 */
export const ESR_SPARSE_PATHS = [
  '/Eastern_Sun_Resurrected.mpq/data/global/excel/',
  '/Eastern_Sun_Resurrected.mpq/data/local/lng/strings/',
  '/Eastern_Sun_Resurrected.mpq/data/hd/items/',
  '/Eastern_Sun_Resurrected.mpq/data/hd/global/ui/items/',
  '/Eastern_Sun_Resurrected.mpq/data/hd/global/ui/spells/',
  `/${ESR_HD_SPECIALIZATION_SPRITES_DIR}/`,
  '/d2rloader/metadata.json',
  `/${ESR_BOSS_SET_UNIQUE_DROP_FILE}`,
  ...ESR_MODIFIER_CONFIGS.map((name) => `/${modifierConfigFile(name)}`),
  ...ESR_MODIFIER_PATCHES.map((name) => `/${modifierPatchFile(name)}`),
  ...[SPECIALIZATIONS_CONFIG_FILE, ...PERK_CONFIG_FILES].map((file) => `/${specializationConfigPath(file)}`),
  '/docs/',
  '/patchnotes/',
];

/** --esr <dir> | ESR_SOURCE_DIR | ../Eastern_Sun_Resurrected, relative to the repo root. */
export function resolveEsrDir(cliValue: string | undefined): string {
  return resolve(REPO_ROOT, cliValue ?? process.env.ESR_SOURCE_DIR ?? DEFAULT_ESR_DIR);
}

/**
 * The vanilla D2R item art (hd/items/*.json and hd/global/ui/items/ extracted from a game install, not in git), the
 * fallback source of generate-item-icons.ts: --vanilla <dir> | D2R_VANILLA_ART_DIR | ../d2r-vanilla-art.
 */
export const DEFAULT_VANILLA_ART_DIR = '../d2r-vanilla-art';

export function resolveVanillaArtDir(cliValue: string | undefined): string {
  return resolve(REPO_ROOT, cliValue ?? process.env.D2R_VANILLA_ART_DIR ?? DEFAULT_VANILLA_ART_DIR);
}

/** Runs a git command in the clone and returns trimmed stdout, or null when it fails. */
export function git(esrDir: string, args: string[]): string | null {
  try {
    return execFileSync('git', ['-C', esrDir, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

/** Runs a git command with inherited stdio (progress visible); throws when it fails. */
export function gitLoud(args: string[]): void {
  console.log(`$ git ${args.join(' ')}`);
  execFileSync('git', args, { stdio: 'inherit' });
}

export interface EsrRevision {
  commit: string | null;
  tag: string | null;
}

export function readRevision(esrDir: string): EsrRevision {
  return { commit: git(esrDir, ['rev-parse', 'HEAD']), tag: git(esrDir, ['describe', '--tags', '--exact-match']) };
}

/** Shallow, blobless, sparse clone limited to ESR_SPARSE_PATHS; checks out `tag` when given, else main. */
export function cloneEsr(esrDir: string, tag: string | undefined): void {
  const branchArgs = tag === undefined ? [] : ['--branch', tag];
  gitLoud(['clone', '--depth', '1', '--filter=blob:none', '--sparse', ...branchArgs, ESR_REPO_URL, esrDir]);
  gitLoud(['-C', esrDir, 'sparse-checkout', 'set', '--no-cone', ...ESR_SPARSE_PATHS]);
}

/**
 * Updates an existing clone (plain or sparse, shallow or full). Without `tag` it fast-forwards main; with `tag` it
 * detaches at that tag. Avoids `git fetch --tags`: on a shallow clone that would pull the full history of every old
 * release tag. Fetching main auto-follows tags that point at the fetched commits.
 */
export function updateEsr(esrDir: string, tag: string | undefined): void {
  const status = git(esrDir, ['status', '--porcelain']);
  if (status === null) throw new Error(`Not a git checkout: ${esrDir}`);
  // Finder drops .DS_Store files into browsed folders; they never affect the generated data
  const dirty = status.split('\n').filter((line) => line !== '' && !line.endsWith('.DS_Store'));
  if (dirty.length > 0) throw new Error(`The ESR clone has uncommitted changes; clean it first (git -C ${esrDir} status).`);
  // Sparse clones made before ESR_SPARSE_PATHS grew pick up the new paths here.
  if (git(esrDir, ['config', '--get', 'core.sparseCheckout']) === 'true') {
    gitLoud(['-C', esrDir, 'sparse-checkout', 'set', '--no-cone', ...ESR_SPARSE_PATHS]);
  }

  if (tag !== undefined) {
    gitLoud(['-C', esrDir, 'fetch', '--depth', '1', '--no-tags', 'origin', 'tag', tag]);
    gitLoud(['-C', esrDir, 'checkout', '--detach', `refs/tags/${tag}`]);
    return;
  }

  const branch = git(esrDir, ['symbolic-ref', '--short', '-q', 'HEAD']);
  if (branch !== null && branch !== 'main') {
    throw new Error(`The ESR clone is on branch "${branch}", expected main (git -C ${esrDir} checkout main).`);
  }
  gitLoud(['-C', esrDir, 'fetch', 'origin', 'main']);
  // A detached HEAD (left by an earlier --tag run) goes back to main.
  if (branch === null) gitLoud(['-C', esrDir, 'checkout', 'main']);
  gitLoud(['-C', esrDir, 'merge', '--ff-only', 'origin/main']);
  fetchTagOfHead(esrDir);
}

/** Fetches the release tag pointing at HEAD when fetching main did not bring it along (shallow clones). */
function fetchTagOfHead(esrDir: string): void {
  const head = git(esrDir, ['rev-parse', 'HEAD']);
  if (head === null || git(esrDir, ['describe', '--tags', '--exact-match']) !== null) return;
  const remoteTags = git(esrDir, ['ls-remote', '--tags', 'origin']) ?? '';
  for (const line of remoteTags.split('\n')) {
    const [sha, ref = ''] = line.split('\t');
    if (sha !== head) continue;
    const tag = ref.replace(/^refs\/tags\//, '').replace(/\^\{\}$/, '');
    gitLoud(['-C', esrDir, 'fetch', '--depth', '1', '--no-tags', 'origin', 'tag', tag]);
    return;
  }
}
