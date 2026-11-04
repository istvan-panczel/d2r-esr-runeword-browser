/**
 * Read-only git helpers shared by esr-release-diff.ts and esr-update-review.ts: run git in a repository, resolve a
 * revision and fetch a missing one into a shallow clone (the only write either script makes, and only to the object
 * store: the branch and the working tree are never touched).
 */
import { execFileSync } from 'node:child_process';
import {
  findLootFilterDll,
  LAUNCHER_CONFIG_FILE,
  LAUNCHER_METADATA_FILE,
  parseLauncherMetadata,
  parseSaveFormatMode,
  readPluginVersion,
  type LauncherVersions,
} from './launcherInfo.ts';

/** Large buffer: some ESR tables and the bundles are several MB. */
const MAX_BUFFER = 512 * 1024 * 1024;

/** Runs git and returns stdout untrimmed, or null when it fails. */
export function runGit(cwd: string, args: string[]): string | null {
  try {
    return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: MAX_BUFFER });
  } catch {
    return null;
  }
}

/** Runs git and returns stdout as bytes (binary blobs), or null when it fails. */
export function runGitBuffer(cwd: string, args: string[]): Buffer | null {
  try {
    return execFileSync('git', ['-C', cwd, ...args], { stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: MAX_BUFFER });
  } catch {
    return null;
  }
}

/** The full commit id of `rev`, or null when the repository does not have it. */
export function resolveCommit(cwd: string, rev: string): string | null {
  return runGit(cwd, ['rev-parse', '--verify', '--quiet', `${rev}^{commit}`])?.trim() ?? null;
}

/**
 * Resolves `rev`; in a shallow clone fetches the missing commit once (best effort, `--depth 1 --no-tags`).
 * Returns null when it is still unknown. `log` receives the fetch notice (stderr in the CLIs).
 */
export function resolveOrFetch(cwd: string, rev: string, log: (message: string) => void): string | null {
  const local = resolveCommit(cwd, rev);
  if (local !== null) return local;
  log(`${rev} is not in the clone (shallow?); trying: git -C ${cwd} fetch --depth 1 --no-tags origin ${rev}`);
  if (runGit(cwd, ['fetch', '--depth', '1', '--no-tags', 'origin', rev]) === null) return null;
  return resolveCommit(cwd, rev) ?? (/^[0-9a-f]{7,40}$/i.test(rev) ? null : resolveCommit(cwd, 'FETCH_HEAD'));
}

/** The launcher versions at a commit of the ESR clone (metadata.json, d2rloader.toml, the loot filter DLL). */
export function readLauncherVersionsAt(esrDir: string, commit: string): LauncherVersions {
  const show = (path: string) => runGit(esrDir, ['show', `${commit}:${path}`]);
  const dll = findLootFilterDll((runGit(esrDir, ['ls-tree', '-r', '--name-only', commit, 'd2rloader/']) ?? '').split('\n'));
  return {
    ...parseLauncherMetadata(show(LAUNCHER_METADATA_FILE)),
    saveFormatMode: parseSaveFormatMode(show(LAUNCHER_CONFIG_FILE)),
    lootFilterPlugin: dll === null ? null : readPluginVersion(runGitBuffer(esrDir, ['show', `${commit}:${dll}`])),
  };
}
