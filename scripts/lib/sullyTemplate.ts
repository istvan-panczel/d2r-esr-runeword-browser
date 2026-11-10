/**
 * The parts of `npm run loot-filter:template` that need no network: reading the GitHub tree listing of Sully's
 * repository, and which of his icons and sounds the site does not bundle. See scripts/update-sully-template.ts.
 */

/** "Thisisnotsully/QoL-Filter" for `https://github.com/Thisisnotsully/QoL-Filter`; null for any other URL. */
export function githubRepoSlug(repoUrl: string): string | null {
  const match = /^https:\/\/github\.com\/([^/]+\/[^/]+?)\/?$/.exec(repoUrl);
  return match === null ? null : match[1];
}

/** The branch a raw.githubusercontent.com URL reads (`…/refs/heads/<branch>/…` or `…/<owner>/<repo>/<branch>/…`); null otherwise. */
export function rawUrlBranch(rawUrl: string): string | null {
  const match = /^https:\/\/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/(?:refs\/heads\/)?([^/]+)\//.exec(rawUrl);
  return match === null ? null : match[1];
}

/** The GitHub API's recursive tree listing of the live file's branch (one request for every icon and sound). */
export function githubTreeUrl(repoUrl: string, liveUrl: string): string | null {
  const slug = githubRepoSlug(repoUrl);
  const branch = rawUrlBranch(liveUrl);
  return slug === null || branch === null ? null : `https://api.github.com/repos/${slug}/git/trees/${branch}?recursive=1`;
}

export interface UpstreamAssets {
  /** `.sprite` file names under `icons/` (a `.lowend.sprite` variant included). */
  readonly icons: readonly string[];
  /** Sound file names under `sounds/`. */
  readonly sounds: readonly string[];
}

const SOUND_FILE = /\.(wav|mp3|flac)$/i;

/** The icons and sounds in a `git/trees/<ref>?recursive=1` response; null when it is not a complete listing. */
export function upstreamAssetsOfTree(tree: unknown): UpstreamAssets | null {
  if (typeof tree !== 'object' || tree === null) return null;
  const { tree: entries, truncated } = tree as { tree?: unknown; truncated?: unknown };
  if (!Array.isArray(entries) || truncated === true) return null;
  const icons: string[] = [];
  const sounds: string[] = [];
  for (const entry of entries as unknown[]) {
    const { path, type } = typeof entry === 'object' && entry !== null ? (entry as { path?: unknown; type?: unknown }) : {};
    if (type !== 'blob' || typeof path !== 'string') continue;
    const match = /^(icons|sounds)\/([^/]+)$/.exec(path);
    if (match === null) continue;
    if (match[1] === 'icons' && /\.sprite$/i.test(match[2])) icons.push(match[2]);
    if (match[1] === 'sounds' && SOUND_FILE.test(match[2])) sounds.push(match[2]);
  }
  return { icons: icons.sort(), sounds: sounds.sort() };
}

/**
 * The upstream files the site does not bundle: icons by name without case (the plugin finds `gemp` as `gemP.sprite`;
 * a `.lowend.sprite` variant by its base icon's `lowend` flag), sounds by file name without case too.
 */
export function unbundledAssets(
  upstream: UpstreamAssets,
  bundled: { readonly icons: readonly { readonly name: string; readonly lowend?: boolean }[]; readonly sounds: readonly string[] }
): string[] {
  const icons = new Map(bundled.icons.map((icon) => [icon.name.toLowerCase(), icon]));
  const missing: string[] = [];
  for (const file of upstream.icons) {
    const lowend = /\.lowend\.sprite$/i.test(file);
    const name = file.replace(/(\.lowend)?\.sprite$/i, '').toLowerCase();
    const icon = icons.get(name);
    if (icon === undefined || (lowend && icon.lowend !== true)) missing.push(`icons/${file}`);
  }
  const sounds = new Set(bundled.sounds.map((file) => file.toLowerCase()));
  for (const file of upstream.sounds) if (!sounds.has(file.toLowerCase())) missing.push(`sounds/${file}`);
  return missing;
}

/** "689 rules, 22 styles; parser: 0 errors, 1 warning" style counts. */
export function plural(count: number, word: string): string {
  return `${String(count)} ${word}${count === 1 ? '' : 's'}`;
}

/** The share of the saved-filter cap from which `npm run loot-filter:template` warns. */
export const SIZE_WARNING_SHARE = 0.75;

/**
 * "Size: 537,684 bytes, 553,637 as the editor writes it (26% of the 2,097,152-byte saved-filter cap)", plus a warning
 * when either is over `SIZE_WARNING_SHARE` of the cap (a draft started from the template must stay savable).
 */
export function sizeReport(rawBytes: number, serializedBytes: number, capBytes: number): { line: string; warning: string | null } {
  const largest = Math.max(rawBytes, serializedBytes);
  const share = Math.round((largest / capBytes) * 100);
  const line = `Size: ${rawBytes.toLocaleString('en-US')} bytes, ${serializedBytes.toLocaleString('en-US')} as the editor writes it (${String(share)}% of the ${capBytes.toLocaleString('en-US')}-byte saved-filter cap)`;
  if (largest <= capBytes * SIZE_WARNING_SHARE) return { line, warning: null };
  return {
    line,
    warning:
      largest > capBytes
        ? 'WARNING: over the saved-filter cap: a filter started from it cannot be saved. Raise FILTER_CONTENT_MAX_BYTES with a migration (see 007).'
        : `WARNING: over ${String(SIZE_WARNING_SHARE * 100)}% of the saved-filter cap: raise FILTER_CONTENT_MAX_BYTES with a migration before it outgrows it (see 007).`,
  };
}
