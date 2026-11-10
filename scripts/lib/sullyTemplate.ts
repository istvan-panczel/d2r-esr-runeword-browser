/**
 * The parts of `npm run loot-filter:template` that need no network: reading the GitHub tree listing of Sully's
 * repository, and which of his icons and sounds the site does not bundle. See scripts/update-sully-template.ts.
 */

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
