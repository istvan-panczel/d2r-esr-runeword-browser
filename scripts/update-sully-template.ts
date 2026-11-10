#!/usr/bin/env node
/**
 * Refreshes the bundled copy of Sully's QoL filter, public/loot-filters/sullys-qol-filter.json, from his repository
 * (the file the app loads live, `SULLYS_QOL_TEMPLATE.liveUrl`; the bundled copy is its fallback). The file is written
 * verbatim, only when it passes the app's own `checkTemplateText`. Then it lists his icons and sounds (one GitHub API
 * call) and says which ones the site does not bundle, and which the new file references without them being bundled.
 *
 *   node scripts/update-sully-template.ts [--check]
 *
 * --check writes nothing and exits 1 when upstream differs from the bundled copy (or cannot be fetched or checked).
 * Nothing else needs editing afterwards: the version comes from the file. See docs/features/LOOT-FILTER.md.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import type { LootFilterDataBundle, TypesBundle } from '../src/features/game-data/engine/schema.ts';
import { REPO_ROOT } from './lib/esrClone.ts';
import { importSrc } from './lib/srcImport.ts';
import { githubTreeUrl, plural, sizeReport, unbundledAssets, upstreamAssetsOfTree } from './lib/sullyTemplate.ts';

const BUNDLED_FILE = join(REPO_ROOT, 'public', 'loot-filters', 'sullys-qol-filter.json');
/** A generic client name: no personal or project details in requests to GitHub. */
const USER_AGENT = 'loot-filter-template-check/1.0';
const TIMEOUT_MS = 20_000;

interface Diagnostic {
  readonly severity: 'error' | 'warning';
  readonly path: string;
  readonly message: string;
}
interface Actions {
  readonly sound?: string | number;
  readonly icon?: { readonly iconName?: string };
}
interface Filter {
  readonly version?: string;
  readonly rules: readonly Actions[];
  readonly styles?: Readonly<Record<string, Actions>>;
}
interface TemplateModule {
  SULLYS_QOL_TEMPLATE: { readonly liveUrl?: string; readonly repoUrl?: string };
}
interface TemplateSourceModule {
  checkTemplateText: (
    id: 'sullys-qol',
    text: string
  ) => { readonly ok: true; readonly version: string; readonly ruleCount: number } | { readonly ok: false; readonly reason: string };
}
interface ParseModule {
  parseLootFilter: (text: string) => { readonly filter: Filter; readonly diagnostics: Diagnostic[]; readonly notes: Diagnostic[] };
}
interface AssetsModule {
  BUNDLED_ICON_ASSETS: readonly { readonly name: string; readonly lowend?: boolean }[];
  BUNDLED_SOUND_ASSETS: readonly { readonly file: string }[];
  findBundledSound: (sound: string) => string | undefined;
  findBundledIconAsset: (iconName: string) => object | undefined;
}
interface ReferencedModule {
  isSoundFile: (sound: string | number | undefined) => sound is string;
}
interface SerializeModule {
  serializeLootFilter: (filter: Filter) => string;
}
interface PresetsModule {
  presetNameClashes: (styleNames: Iterable<string>) => string[];
}
interface SharingConstantsModule {
  FILTER_CONTENT_MAX_BYTES: number;
}
interface ValidateModule {
  validateLootFilter: (filter: Filter, reference: object) => Diagnostic[];
}
interface ReferenceModule {
  buildLootFilterReference: (data: LootFilterDataBundle, types: TypesBundle) => object;
}

const { values } = parseArgs({ options: { check: { type: 'boolean', default: false } } });

async function get(url: string, headers: Record<string, string> = {}): Promise<{ bytes: Buffer } | { error: string }> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { 'User-Agent': USER_AGENT, ...headers } });
    if (!response.ok) return { error: `HTTP ${String(response.status)}` };
    return { bytes: Buffer.from(await response.arrayBuffer()) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

const count = (diagnostics: readonly Diagnostic[], severity: Diagnostic['severity']) =>
  diagnostics.filter((diagnostic) => diagnostic.severity === severity).length;
const counts = (diagnostics: readonly Diagnostic[]) =>
  `${plural(count(diagnostics, 'error'), 'error')}, ${plural(count(diagnostics, 'warning'), 'warning')}`;

const { SULLYS_QOL_TEMPLATE } = await importSrc<TemplateModule>('features/loot-filter/utils/template.ts');
const { checkTemplateText } = await importSrc<TemplateSourceModule>('features/loot-filter/utils/templateSource.ts');
const { parseLootFilter } = await importSrc<ParseModule>('features/loot-filter/engine/parse.ts');
const assets = await importSrc<AssetsModule>('features/loot-filter/utils/bundledAssets.ts');
const { isSoundFile } = await importSrc<ReferencedModule>('features/loot-filter/utils/referencedAssets.ts');
const { validateLootFilter } = await importSrc<ValidateModule>('features/loot-filter/engine/validate.ts');
const { buildLootFilterReference } = await importSrc<ReferenceModule>('features/loot-filter/engine/reference.ts');
const { serializeLootFilter } = await importSrc<SerializeModule>('features/loot-filter/engine/serialize.ts');
const { presetNameClashes } = await importSrc<PresetsModule>('features/loot-filter/utils/stylePresets.ts');
const { FILTER_CONTENT_MAX_BYTES } = await importSrc<SharingConstantsModule>('features/loot-filter/sharing/constants.ts');

const { liveUrl, repoUrl } = SULLYS_QOL_TEMPLATE;
if (liveUrl === undefined || repoUrl === undefined) throw new Error('SULLYS_QOL_TEMPLATE has no liveUrl or repoUrl');
const treeUrl = githubTreeUrl(repoUrl, liveUrl);
if (treeUrl === null) throw new Error(`Cannot derive the GitHub tree listing from ${repoUrl} and ${liveUrl}`);

const versionOf = (text: string): string => {
  try {
    return parseLootFilter(text).filter.version ?? '(none)';
  } catch {
    return '(unreadable)';
  }
};

console.log(`Fetching ${liveUrl}`);
const upstream = await get(liveUrl);
if ('error' in upstream) {
  console.error(`Could not fetch Sully's filter: ${upstream.error}`);
  process.exit(1);
}
const upstreamText = upstream.bytes.toString('utf8');
const bundledBytes = readFileSync(BUNDLED_FILE);
const bundledText = bundledBytes.toString('utf8');
const oldVersion = versionOf(bundledText);

const verdict = checkTemplateText('sullys-qol', upstreamText);
if (!verdict.ok) {
  console.error(`Upstream does not pass checkTemplateText, so the app uses the bundled copy (v${oldVersion}): ${verdict.reason}`);
  console.error('Nothing written. Run again once Sully has fixed the file.');
  process.exit(1);
}

const parsed = parseLootFilter(upstreamText);
const data = JSON.parse(readFileSync(join(REPO_ROOT, 'public', 'game-data', 'lootfilter.json'), 'utf8')) as LootFilterDataBundle;
const types = JSON.parse(readFileSync(join(REPO_ROOT, 'public', 'game-data', 'types.json'), 'utf8')) as TypesBundle;
const validation = validateLootFilter(parsed.filter, buildLootFilterReference(data, types));
const same = upstream.bytes.equals(bundledBytes);

console.log(
  `${same ? `Up to date: v${verdict.version}` : `Upstream differs: bundled v${oldVersion} → upstream v${verdict.version}`} (${String(upstream.bytes.length)} bytes, ${plural(verdict.ruleCount, 'rule')}, ${plural(Object.keys(parsed.filter.styles ?? {}).length, 'style')})`
);
console.log(
  `Parser: ${counts([...parsed.diagnostics, ...parsed.notes])}; validator against the committed game data: ${counts(validation)}`
);
for (const diagnostic of [...parsed.diagnostics, ...parsed.notes].slice(0, 5)) {
  console.log(`  ${diagnostic.severity} ${diagnostic.path}: ${diagnostic.message}`);
}
const size = sizeReport(upstream.bytes.length, Buffer.byteLength(serializeLootFilter(parsed.filter), 'utf8'), FILTER_CONTENT_MAX_BYTES);
console.log(size.line);
if (size.warning !== null) console.warn(size.warning);
// A style named like one of our presets makes picking that preset in his filter keep his style (the MidRune bug).
const clashes = presetNameClashes(Object.keys(parsed.filter.styles ?? {}));
console.log(
  clashes.length === 0
    ? 'No style of his is named like one of our style presets.'
    : `WARNING: his styles use the preset names ${clashes.join(', ')}: rename those presets (utils/stylePresets.ts); stylePresets.test.ts fails until then.`
);

// What the new file names that the site does not bundle (the zip download and the sandbox lack them).
const referencedMissing = new Set<string>();
for (const actions of [...Object.values(parsed.filter.styles ?? {}), ...parsed.filter.rules]) {
  if (isSoundFile(actions.sound) && assets.findBundledSound(actions.sound) === undefined)
    referencedMissing.add(`sounds/${actions.sound.trim()}`);
  const iconName = actions.icon?.iconName?.trim();
  if (iconName !== undefined && iconName !== '' && assets.findBundledIconAsset(iconName) === undefined) {
    referencedMissing.add(`icons/${iconName.replace(/\.sprite$/i, '')}.sprite`);
  }
}
console.log(
  referencedMissing.size === 0
    ? 'Every sound and icon the file references is bundled.'
    : `The file references ${plural(referencedMissing.size, 'file')} the site does not bundle: ${[...referencedMissing].join(', ')}`
);

const tree = await get(treeUrl, { Accept: 'application/vnd.github+json' });
const listing = 'error' in tree ? null : upstreamAssetsOfTree(JSON.parse(tree.bytes.toString('utf8')) as unknown);
if (listing === null) {
  console.warn(`Could not list Sully's icons and sounds (${'error' in tree ? tree.error : 'not a complete tree listing'}).`);
} else {
  const notBundled = unbundledAssets(listing, {
    icons: assets.BUNDLED_ICON_ASSETS,
    sounds: assets.BUNDLED_SOUND_ASSETS.map((sound) => sound.file),
  });
  console.log(
    notBundled.length === 0
      ? `All ${plural(listing.icons.length, 'icon')} and ${plural(listing.sounds.length, 'sound')} of his repository are bundled.`
      : `Not bundled from his repository: ${notBundled.join(', ')} (shrink new icons to 128 px; see docs/features/LOOT-FILTER.md "Bundled sounds and icons")`
  );
}

if (same) process.exit(0);
if (values.check) {
  console.error('Run npm run loot-filter:template to refresh the bundled copy.');
  process.exit(1);
}
writeFileSync(BUNDLED_FILE, upstream.bytes);
console.log(`Wrote public/loot-filters/sullys-qol-filter.json (v${oldVersion} → v${verdict.version}).`);
