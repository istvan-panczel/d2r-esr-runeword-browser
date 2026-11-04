/**
 * Versions the ESR launcher files carry, read from text and bytes (the CLIs do the git and fs reads):
 * `d2rloader/metadata.json` (mod version, D2RLoader version, game version and build), the save format `mode` of
 * `d2rloader/config/d2rloader.toml`, and the plugin version embedded in a plugin DLL. Shared by esr-release-diff.ts and
 * esr-update-review.ts.
 */

export const LAUNCHER_METADATA_FILE = 'd2rloader/metadata.json';
export const LAUNCHER_CONFIG_FILE = 'd2rloader/config/d2rloader.toml';
export const LOOT_FILTER_SOURCES_FILE = 'LootFilters/sources.json';
/** The plugin id the loot filter DLL embeds right before its version string. */
export const LOOT_FILTER_PLUGIN_ID = 'celestialrayone.loot-filter';
/** Matches the loot filter plugin among the files under d2rloader/ (`d2rl-celestialrayone-loot-filter.dll` at 3.2.24). */
const LOOT_FILTER_DLL = /(^|\/)[^/]*loot-filter[^/]*\.dll$/i;

export interface LauncherVersions {
  /** `metadata.modVersion`: the ESR version the app labels its data with */
  modVersion: string | null;
  /** `d2rloader.version` */
  loaderVersion: string | null;
  /** `d2rloader.bins.gameVersion` / `gameBuild`: the retail D2R build the loader targets */
  gameVersion: string | null;
  gameBuild: string | null;
  /** `mode` under `[d2rcore.save_format]` of d2rloader.toml ("extended" at 3.2.24) */
  saveFormatMode: string | null;
  /** Version embedded in the loot filter plugin DLL */
  lootFilterPlugin: string | null;
}

export const EMPTY_LAUNCHER_VERSIONS: LauncherVersions = {
  modVersion: null,
  loaderVersion: null,
  gameVersion: null,
  gameBuild: null,
  saveFormatMode: null,
  lootFilterPlugin: null,
};

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
const asString = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);

/** The version fields of metadata.json; nulls for a missing or malformed file. */
export function parseLauncherMetadata(
  text: string | null
): Pick<LauncherVersions, 'modVersion' | 'loaderVersion' | 'gameVersion' | 'gameBuild'> {
  let parsed: unknown;
  try {
    parsed = text === null || text.trim() === '' ? null : JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch {
    parsed = null;
  }
  const root = asRecord(parsed);
  const loader = asRecord(root.d2rloader);
  const bins = asRecord(loader.bins);
  return {
    modVersion: asString(asRecord(root.metadata).modVersion),
    loaderVersion: asString(loader.version),
    gameVersion: asString(bins.gameVersion),
    gameBuild: asString(bins.gameBuild) ?? (typeof bins.gameBuild === 'number' ? String(bins.gameBuild) : null),
  };
}

/** `mode = "…"` under `[d2rcore.save_format]` (else the first top-level-looking `mode =` line); null when absent. */
export function parseSaveFormatMode(toml: string | null): string | null {
  if (toml === null) return null;
  let section = '';
  let fallback: string | null = null;
  for (const raw of toml.split(/\r?\n/)) {
    const line = raw.trim();
    const header = /^\[([^\]]+)\]/.exec(line);
    if (header) {
      section = header[1].trim();
      continue;
    }
    const match = /^mode\s*=\s*"([^"]*)"/.exec(line);
    if (!match) continue;
    if (section === 'd2rcore.save_format') return match[1];
    fallback ??= match[1];
  }
  return fallback;
}

/**
 * The version string a D2RLoader plugin DLL stores after its NUL-terminated plugin id (`celestialrayone.loot-filter\0
 * 1.5.3\0`, what `strings` shows as the line after the id). Null when the id or a version-shaped string is missing.
 */
export function readPluginVersion(dll: Uint8Array | null, pluginId = LOOT_FILTER_PLUGIN_ID): string | null {
  if (dll === null) return null;
  const bytes = Buffer.from(dll.buffer, dll.byteOffset, dll.byteLength);
  const needle = Buffer.from(`${pluginId}\0`, 'latin1');
  for (let at = bytes.indexOf(needle); at !== -1; at = bytes.indexOf(needle, at + 1)) {
    let start = at + needle.length;
    while (start < bytes.length && bytes[start] === 0) start++;
    let end = start;
    while (end < bytes.length && end - start < 32 && bytes[end] >= 0x20 && bytes[end] < 0x7f) end++;
    const text = bytes.subarray(start, end).toString('latin1');
    if (/^\d+(\.\d+){1,3}$/.test(text)) return text;
  }
  return null;
}

/** The loot filter plugin DLL among repository paths (`git ls-tree -r --name-only <rev> d2rloader/`), or null. */
export function findLootFilterDll(paths: readonly string[]): string | null {
  return paths.find((path) => path.startsWith('d2rloader/') && LOOT_FILTER_DLL.test(path)) ?? null;
}

export interface VersionChange {
  field: keyof LauncherVersions;
  label: string;
  before: string | null;
  after: string | null;
}

export const LAUNCHER_VERSION_LABELS: Readonly<Record<keyof LauncherVersions, string>> = {
  modVersion: 'metadata.modVersion',
  loaderVersion: 'd2rloader.version',
  gameVersion: 'bins.gameVersion',
  gameBuild: 'bins.gameBuild',
  saveFormatMode: 'save_format mode',
  lootFilterPlugin: 'loot filter plugin',
};

/** Every field, before and after, in display order (changed or not). */
export function compareLauncherVersions(before: LauncherVersions, after: LauncherVersions): (VersionChange & { changed: boolean })[] {
  return (Object.keys(LAUNCHER_VERSION_LABELS) as (keyof LauncherVersions)[]).map((field) => ({
    field,
    label: LAUNCHER_VERSION_LABELS[field],
    before: before[field],
    after: after[field],
    changed: before[field] !== after[field],
  }));
}

/** "metadata.modVersion 3.2.20 → 3.2.24, d2rloader.version 1.3.1, …" (unchanged fields once). */
export function formatLauncherVersions(before: LauncherVersions, after: LauncherVersions): string {
  return compareLauncherVersions(before, after)
    .map(({ label, before: a, after: b, changed }) => `${label} ${changed ? `${a ?? '—'} → ${b ?? '—'}` : (b ?? '—')}`)
    .join(', ');
}
