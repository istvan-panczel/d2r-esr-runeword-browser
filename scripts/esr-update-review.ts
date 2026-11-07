#!/usr/bin/env node
/**
 * Read-only review after `npm run game-data:update`: compares the regenerated public/game-data/ and public/guide/ in the
 * working tree with the committed state (`git show HEAD:…`, the previous ESR version), the ESR clone at the new version
 * and at the old revision (esrCommit of the HEAD manifest), plus the live docs site, links and Sully's upstream filter.
 * It changes nothing (except an on-demand `git fetch` of a missing old revision into a shallow clone).
 *
 *   node scripts/esr-update-review.ts [--json] [--out <file.md>] [--offline] [--esr <dir>] [--from <rev>]
 *
 * Output: a list of checks (ok / finding / info / skipped); text on stdout, or JSON with --json; --out writes Markdown
 * to <file.md> and the JSON next to it (<file>.json). Every finding says why it matters. --offline skips the network
 * checks. Exit 0 when it ran (findings included), 2 when it cannot run (no clone, no HEAD manifest), 1 on errors.
 * The pure comparison logic lives in scripts/lib/esrReview/.
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { REMOTE_URLS } from '../src/core/api/remoteConfig.ts';
import { STAT_OPS } from '../src/features/game-data/build/bundleCube.ts';
import { ESR_DESECRATED_ZONES_FILE } from '../src/features/game-data/build/esrSources.ts';
import { parseTsv } from '../src/features/game-data/build/tsv.ts';
import type { LootFilterDataBundle, TypesBundle } from '../src/features/game-data/engine/schema.ts';
import { versionFromPatchNoteFile, type PatchNote } from '../src/features/guide/build/staleness.ts';
import type { GuideBundle } from '../src/features/guide/engine/schema.ts';
import { parseLootFilter } from '../src/features/loot-filter/engine/parse.ts';
import { buildLootFilterReference } from '../src/features/loot-filter/engine/reference.ts';
import { validateLootFilter } from '../src/features/loot-filter/engine/validate.ts';
import { ESR_SPARSE_PATHS, REPO_ROOT, resolveEsrDir, resolveVanillaArtDir } from './lib/esrClone.ts';
import { readLauncherVersionsAt, resolveCommit, resolveOrFetch, runGit } from './lib/esrGit.ts';
import { EMPTY_LAUNCHER_VERSIONS, LOOT_FILTER_SOURCES_FILE, parseLauncherMetadata } from './lib/launcherInfo.ts';
import { BUNDLE_SPECS, bundleCheck, diffBundle } from './lib/esrReview/bundles.ts';
import {
  craftsCheck,
  cubeFallbackCheck,
  cubeIconsCheck,
  cubeOps,
  cubeOpsCheck,
  iconInputsCheck,
  manifestChecks,
  missingIconsCheck,
  skillIdCheck,
  unknownSourcesCheck,
  vanillaArtCheck,
  versionChecks,
  type ManifestLike,
} from './lib/esrReview/dataChecks.ts';
import {
  countVersionMentions,
  discordCheck,
  docsSiteCheck,
  linksCheck,
  lootFilterSourcesCheck,
  oldVersionDocsCheck,
  pluginVersionCheck,
  sullyAssetsCheck,
  sullyTemplateCheck,
  templateValidationCheck,
  type LinkResult,
  type PageComparison,
} from './lib/esrReview/externalChecks.ts';
import { dataBlocksCheck, patchNoteMentionsCheck, recipesCheck } from './lib/esrReview/guideChecks.ts';
import { idShiftChecks, idSpaces } from './lib/esrReview/idShifts.ts';
import { get, mapLimited, MAX_PARALLEL } from './lib/esrReview/net.ts';
import { countByStatus, formatMarkdown, formatText, skipped, type Check, type ReviewReport } from './lib/esrReview/report.ts';
import { commitsCheck, coverageCheck, featureCommits, warningClassesInSource } from './lib/esrReview/selfCheck.ts';
import { importSrc } from './lib/srcImport.ts';
import { DOCS_PAGES_BY_TABLE, docsLagCheck } from './lib/esrReview/docsLag.ts';
import { mapBossesOf, mapBossPageCheck, mapBossPageLines, type BossCardOf } from './lib/esrReview/mapBosses.ts';
import { citationsIn, isReferenceCandidate, referencesCheck } from './lib/esrReview/references.ts';
import { variantMap, variantsCheck, type ParsedRecipe } from './lib/esrReview/variants.ts';

type Doc = Readonly<Record<string, unknown>>;

const GAME_DATA_DIR = 'public/game-data';
const MANIFEST = `${GAME_DATA_DIR}/manifest.json`;
const GUIDE_FILE = 'public/guide/guide.json';
const LOOT_FILTERS_DIR = 'public/loot-filters';
const SULLY_FILE = 'sullys-qol-filter.json';
const EXAMPLE_FILE = 'example-filter.json';
const PREVIOUS_FIXTURES_DIR = 'test-fixtures/previous';
const SULLY_REPO = 'Thisisnotsully/QoL-Filter';
const SULLY_RAW_URL = `https://raw.githubusercontent.com/${SULLY_REPO}/main/Sullys-QoL-Filter.json`;
/** Folders whose files may quote the ESR version as a current fact */
const VERSION_DOC_DIRS = ['docs', 'content', 'builds-feature-docs', '.claude'];
/** What the skill's self-update step watches: commits after the last change to these */
const SKILL_PATHS = ['.claude/skills/esr-update', 'scripts/esr-update-review.ts', 'scripts/lib/esrReview'];
const FEATURE_PATHS = ['src/features', 'scripts', 'public/game-data'];

class UsageError extends Error {
  exitCode: number;
  constructor(message: string, exitCode = 1) {
    super(message);
    this.exitCode = exitCode;
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Reading

function parseJson(text: string | null): Doc | null {
  if (text === null) return null;
  try {
    const parsed: unknown = JSON.parse(text.replace(/^\uFEFF/, ''));
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? (parsed as Doc) : null;
  } catch {
    return null;
  }
}

const headText = (path: string) => runGit(REPO_ROOT, ['show', `HEAD:${path}`]);
const workingText = (path: string) => {
  const file = join(REPO_ROOT, path);
  return existsSync(file) ? readFileSync(file, 'utf8') : null;
};

function listFiles(dir: string, filter: (path: string) => boolean): string[] {
  if (!existsSync(dir)) return [];
  const result: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git') continue;
    const path = join(dir, name);
    const stats = statSync(path);
    if (stats.isDirectory()) result.push(...listFiles(path, filter));
    else if (filter(path)) result.push(path);
  }
  return result;
}

/** Bundle files (`*.json` directly under public/game-data/) at HEAD and in the working tree. */
function bundleFiles(): string[] {
  const head = (runGit(REPO_ROOT, ['ls-tree', '--name-only', 'HEAD', `${GAME_DATA_DIR}/`]) ?? '')
    .split('\n')
    .map((path) => path.split('/').pop() ?? '')
    .filter((name) => name.endsWith('.json'));
  const dir = join(REPO_ROOT, GAME_DATA_DIR);
  const working = existsSync(dir) ? readdirSync(dir).filter((name) => name.endsWith('.json')) : [];
  return [...new Set([...head, ...working])].sort();
}

/** Ops of the enabled cubemain rows at a commit of the clone. */
function cubeOpsAt(esrDir: string, commit: string): Map<number, number> {
  const text = runGit(esrDir, ['show', `${commit}:Eastern_Sun_Resurrected.mpq/data/global/excel/cubemain.txt`]);
  if (text === null) return new Map();
  const table = parseTsv(text, 'cubemain.txt');
  const ops: number[] = [];
  for (const row of table.rows) {
    try {
      if (row.num('enabled') === 1) ops.push(row.num('op'));
    } catch {
      // a non-numeric cell: not a row the game reads
    }
  }
  return cubeOps(ops);
}

function changedPaths(esrDir: string, from: string, to: string, paths: string[]): string[] {
  if (from === to) return [];
  return (runGit(esrDir, ['diff', '--name-only', '--no-renames', from, to, '--', ...paths]) ?? '')
    .split('\n')
    .filter((line) => line !== '');
}

// ---------------------------------------------------------------------------------------------------------------------
// Runeword / gemword pages (the app's real parsers, with a jsdom DOM)

interface Parsers {
  runewords: (html: string) => ParsedRecipe[];
  gemwords: (html: string) => ParsedRecipe[];
}

async function loadParsers(): Promise<Parsers> {
  // jsdom (a devDependency) ships no types; a variable specifier keeps tsc from looking for them
  const jsdomModule: string = 'jsdom';
  const { JSDOM } = (await import(jsdomModule)) as { JSDOM: new () => { window: Record<string, unknown> } };
  const window = new JSDOM().window;
  for (const name of ['DOMParser', 'Node', 'Element', 'HTMLElement', 'Text']) (globalThis as Record<string, unknown>)[name] = window[name];
  const rw = await importSrc<{ parseRunewordsHtml: (html: string) => ParsedRecipe[] }>('features/data-sync/parsers/runewordsParser.ts');
  const gw = await importSrc<{ parseGemwordsHtml: (html: string) => ParsedRecipe[] }>('features/data-sync/parsers/gemwordsParser.ts');
  // The parsers log their progress for the browser console; keep stdout clean for --json
  const quiet = <T>(run: () => T): T => {
    const log = console.log;
    console.log = () => undefined;
    try {
      return run();
    } finally {
      console.log = log;
    }
  };
  return {
    runewords: (html) => quiet(() => rw.parseRunewordsHtml(html)),
    gemwords: (html) => quiet(() => gw.parseGemwordsHtml(html)),
  };
}

async function variantChecks(esrDir: string, oldCommit: string | null, newCommit: string): Promise<Check[]> {
  let parsers: Parsers;
  try {
    parsers = await loadParsers();
  } catch (error) {
    const reason = `The app's HTM parsers could not be loaded: ${error instanceof Error ? error.message : String(error)}`;
    return [skipped('variants.runewords', 'Runeword variants', reason), skipped('variants.gemwords', 'Gemword variants', reason)];
  }
  return (['runeword', 'gemword'] as const).map((kind) => {
    const page = `docs/${kind}s.htm`;
    const parse = kind === 'runeword' ? parsers.runewords : parsers.gemwords;
    const newHtml = runGit(esrDir, ['show', `${newCommit}:${page}`]);
    if (newHtml === null) return skipped(`variants.${kind}s`, `${kind} variants`, `${page} is missing in the clone.`);
    let oldHtml = oldCommit === null ? null : runGit(esrDir, ['show', `${oldCommit}:${page}`]);
    let source = oldCommit === null ? '' : `${page} at ${oldCommit.slice(0, 8)}`;
    if (oldHtml === null) {
      oldHtml = workingText(`${PREVIOUS_FIXTURES_DIR}/${kind}s.htm`);
      source = `${PREVIOUS_FIXTURES_DIR}/${kind}s.htm`;
    }
    const after = variantMap(parse(newHtml));
    const before = oldHtml === null ? null : oldHtml === newHtml ? after : variantMap(parse(oldHtml));
    return variantsCheck(kind, before, after, oldHtml === null ? 'none' : source);
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// Loot filter (offline parts)

function templateValidation(
  head: { lootfilter: Doc | null; types: Doc | null },
  working: { lootfilter: Doc | null; types: Doc | null }
): Check {
  if (head.lootfilter === null || head.types === null || working.lootfilter === null || working.types === null) {
    return skipped(
      'lootfilter.validate',
      'Bundled filters vs the new data',
      'lootfilter.json or types.json is missing at HEAD or in the working tree.'
    );
  }
  const before = buildLootFilterReference(head.lootfilter as unknown as LootFilterDataBundle, head.types as unknown as TypesBundle);
  const after = buildLootFilterReference(working.lootfilter as unknown as LootFilterDataBundle, working.types as unknown as TypesBundle);
  const results = [SULLY_FILE, EXAMPLE_FILE].flatMap((file) => {
    const text = workingText(`${LOOT_FILTERS_DIR}/${file}`);
    if (text === null) return [];
    const filter = parseLootFilter(text).filter;
    return [{ file, before: validateLootFilter(filter, before), after: validateLootFilter(filter, after) }];
  });
  return templateValidationCheck(results);
}

interface TemplateConstants {
  LOOT_FILTER_PLUGIN_VERSION: string;
  SULLYS_QOL_TEMPLATE: { version: string };
}

// ---------------------------------------------------------------------------------------------------------------------
// Online checks

interface NavConfig {
  OFFICIAL_LINKS: readonly { key: string; href: string }[];
  COMMUNITY_TOOLS: readonly { key: string; href: string; sourceUrl?: string }[];
  DROP_FINDER_URL: string;
  FRAME_TABLE_URL: string;
  DISCORD_URL: string;
}

interface GuideHome {
  OFFICIAL_REFERENCES: readonly { label: string; file: string }[];
  officialReferenceHref: (reference: { label: string; file: string }) => string;
}

async function docsSite(esrDir: string, cloneModVersion: string | null): Promise<Check> {
  const pages = Object.entries(REMOTE_URLS)
    .filter(([key]) => key !== 'modMetadata')
    .map(([, url]) => ({ url, file: decodeURIComponent(new URL(url).pathname.replace(/^\//, '')) }));
  const comparisons = await mapLimited(pages, MAX_PARALLEL, async ({ url, file }): Promise<PageComparison> => {
    const live = await get(url, true);
    const local = join(esrDir, 'docs', file);
    if (live.body === null || live.status !== 200) return { file, result: 'error', detail: live.error ?? `HTTP ${String(live.status)}` };
    if (!existsSync(local)) return { file, result: 'differs', detail: 'missing in the clone' };
    const ours = readFileSync(local);
    return live.body.equals(ours)
      ? { file, result: 'same' }
      : { file, result: 'differs', detail: `${String(live.body.length)} vs ${String(ours.length)} bytes` };
  });
  const metadata = await get(REMOTE_URLS.modMetadata, true);
  const liveVersion = metadata.body === null ? null : parseLauncherMetadata(metadata.body.toString('utf8')).modVersion;
  return docsSiteCheck(comparisons, liveVersion, cloneModVersion);
}

async function links(nav: NavConfig, guideHome: GuideHome): Promise<Check> {
  const targets = new Map<string, string>();
  const add = (url: string, where: string) => {
    if (!targets.has(url)) targets.set(url, where);
  };
  for (const link of nav.OFFICIAL_LINKS) if (link.href !== nav.DISCORD_URL) add(link.href, `OFFICIAL_LINKS ${link.key}`);
  for (const tool of nav.COMMUNITY_TOOLS) {
    add(tool.href, `COMMUNITY_TOOLS ${tool.key}`);
    if (tool.sourceUrl !== undefined) add(tool.sourceUrl, `COMMUNITY_TOOLS ${tool.key} source`);
  }
  for (const reference of guideHome.OFFICIAL_REFERENCES)
    add(guideHome.officialReferenceHref(reference), `OFFICIAL_REFERENCES ${reference.label}`);
  add(nav.DROP_FINDER_URL, 'Drop Finder');
  add(nav.FRAME_TABLE_URL, 'Frame Table');
  const results = await mapLimited([...targets], MAX_PARALLEL, async ([url, where]): Promise<LinkResult> => {
    const result = await get(url, false);
    return { url, where, status: result.status, ...(result.error === null ? {} : { error: result.error }) };
  });
  return linksCheck(results);
}

async function discord(url: string): Promise<Check> {
  const code =
    url
      .split('/')
      .filter((part) => part !== '')
      .pop() ?? '';
  const result = await get(`https://discord.com/api/v10/invites/${encodeURIComponent(code)}`, true);
  const body = result.body === null ? null : (parseJson(result.body.toString('utf8')) as unknown);
  const error = result.error ?? (result.status === 200 ? null : `HTTP ${String(result.status)}`);
  return discordCheck(code, body, error);
}

async function githubListing(folder: string): Promise<{ names: string[] | null; error: string | null }> {
  const result = await get(`https://api.github.com/repos/${SULLY_REPO}/contents/${folder}`, true, {
    Accept: 'application/vnd.github+json',
  });
  if (result.body === null || result.status !== 200) return { names: null, error: result.error ?? `HTTP ${String(result.status)}` };
  try {
    const parsed: unknown = JSON.parse(result.body.toString('utf8'));
    if (!Array.isArray(parsed)) return { names: null, error: 'not a listing' };
    return {
      names: parsed.flatMap((entry: unknown) => {
        const record = typeof entry === 'object' && entry !== null ? (entry as Record<string, unknown>) : {};
        return record.type === 'file' && typeof record.name === 'string' ? [record.name] : [];
      }),
      error: null,
    };
  } catch (error) {
    return { names: null, error: error instanceof Error ? error.message : String(error) };
  }
}

const filterVersion = (text: string | null) => (text === null ? null : (parseLootFilter(text).filter.version ?? null));

async function sully(constants: TemplateConstants | null): Promise<Check[]> {
  const bundledText = workingText(`${LOOT_FILTERS_DIR}/${SULLY_FILE}`) ?? '';
  const upstream = await get(SULLY_RAW_URL, true);
  const upstreamText = upstream.body !== null && upstream.status === 200 ? upstream.body.toString('utf8') : null;
  const template = sullyTemplateCheck({
    upstreamText,
    upstreamVersion: filterVersion(upstreamText),
    bundledText,
    bundledVersion: filterVersion(bundledText),
    constantVersion: constants?.SULLYS_QOL_TEMPLATE.version ?? null,
    ...(upstreamText === null ? { error: upstream.error ?? `HTTP ${String(upstream.status)}` } : {}),
  });
  const [icons, sounds] = await Promise.all([githubListing('icons'), githubListing('sounds')]);
  const localNames = (folder: string) => {
    const dir = join(REPO_ROOT, LOOT_FILTERS_DIR, folder);
    return existsSync(dir) ? readdirSync(dir) : [];
  };
  const assets = sullyAssetsCheck(
    { icons: icons.names, sounds: sounds.names },
    { icons: localNames('icons'), sounds: localNames('sounds') },
    icons.error ?? sounds.error
  );
  return [template, assets];
}

// ---------------------------------------------------------------------------------------------------------------------

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      json: { type: 'boolean', default: false },
      out: { type: 'string' },
      offline: { type: 'boolean', default: false },
      esr: { type: 'string' },
      from: { type: 'string' },
    },
  });
  const esrDir = resolveEsrDir(values.esr);
  if (!existsSync(esrDir) || runGit(esrDir, ['rev-parse', '--git-dir']) === null) {
    throw new UsageError(`No ESR git clone at ${esrDir} (use --esr <dir> or ESR_SOURCE_DIR, or run npm run game-data:update).`, 2);
  }
  const headManifest = parseJson(headText(MANIFEST)) as ManifestLike | null;
  if (headManifest === null) throw new UsageError(`No ${MANIFEST} in HEAD: nothing to compare with.`, 2);
  const workingManifest = (parseJson(workingText(MANIFEST)) as ManifestLike | null) ?? {};

  const newCommit = resolveCommit(esrDir, 'HEAD');
  if (newCommit === null) throw new UsageError(`The clone at ${esrDir} has no HEAD commit.`, 2);
  const cloneTag = runGit(esrDir, ['describe', '--tags', '--exact-match', newCommit])?.trim() ?? null;
  const oldRev = values.from ?? headManifest.esrCommit ?? null;
  const oldCommit =
    oldRev === null
      ? null
      : resolveOrFetch(esrDir, oldRev, (message) => {
          console.error(message);
        });
  const noOld = `The old revision ${oldRev ?? '(none in the HEAD manifest)'} is not available in the clone (pass --from <rev>).`;

  const files = bundleFiles();
  const head = new Map(files.map((file) => [file, parseJson(headText(`${GAME_DATA_DIR}/${file}`))]));
  const working = new Map(files.map((file) => [file, parseJson(workingText(`${GAME_DATA_DIR}/${file}`))]));
  const h = (file: string) => head.get(file) ?? null;
  const w = (file: string) => working.get(file) ?? null;

  const checks: Check[] = [];

  // 1. Versions
  const launcherNew = readLauncherVersionsAt(esrDir, newCommit);
  const launcherOld = oldCommit === null ? EMPTY_LAUNCHER_VERSIONS : readLauncherVersionsAt(esrDir, oldCommit);
  checks.push(
    ...versionChecks({ head: headManifest, working: workingManifest, cloneCommit: newCommit, cloneTag, launcherOld, launcherNew })
  );
  if (oldCommit === null) checks.push(skipped('versions.launcher-old', 'Old launcher versions', noOld));

  // 2. Manifest
  checks.push(...manifestChecks(headManifest, workingManifest));

  // 3. Entries per bundle
  const unknownSections: string[] = [];
  for (const file of files) {
    if (BUNDLE_SPECS[file] === null) continue;
    const diff = diffBundle(file, h(file), w(file));
    unknownSections.push(...diff.unknownSections.map((section) => `${file} ${section}`));
    checks.push(bundleCheck(diff));
  }

  // 4–8. Skill ids, unknown sources, id shifts, build crafts, cube
  checks.push(
    skillIdCheck(
      { details: h('skilldetails.json'), skills: h('skills.json') },
      { details: w('skilldetails.json'), skills: w('skills.json') }
    )
  );
  checks.push(unknownSourcesCheck(h('sources.json'), w('sources.json')));
  const spaces = (get: (file: string) => Doc | null) =>
    idSpaces({
      lootfilter: get('lootfilter.json'),
      stashnames: get('stashnames.json'),
      itemtext: get('itemtext.json'),
      stash: get('stash.json'),
    });
  checks.push(...idShiftChecks(spaces(h), spaces(w)));
  checks.push(
    craftsCheck({ enhance: h('enhance.json'), crafting: h('crafting.json') }, { enhance: w('enhance.json'), crafting: w('crafting.json') })
  );
  checks.push(cubeFallbackCheck({ manifest: headManifest, cube: h('cube.json') }, { manifest: workingManifest, cube: w('cube.json') }));
  const knownOps = Object.keys(STAT_OPS).map(Number);
  checks.push(
    oldCommit === null
      ? skipped('cube.ops', 'Cube condition ops', noOld)
      : cubeOpsCheck(cubeOpsAt(esrDir, oldCommit), cubeOpsAt(esrDir, newCommit), knownOps)
  );
  // 8b. Map boss rewards vs the Endgame Maps page figures kept in campaign-map/data/mapBosses.ts
  try {
    const { MAP_BOSS_FACTS } = await importSrc<{ MAP_BOSS_FACTS: Readonly<Record<string, unknown>> }>(
      'features/campaign-map/data/mapBosses.ts'
    );
    const { bossCard } = await importSrc<{ bossCard: BossCardOf<unknown> }>('features/campaign-map/utils/mapBossFacts.ts');
    checks.push(
      mapBossPageCheck(
        mapBossPageLines(mapBossesOf(h('areas.json')), MAP_BOSS_FACTS, bossCard),
        mapBossPageLines(mapBossesOf(w('areas.json')), MAP_BOSS_FACTS, bossCard)
      )
    );
  } catch (error) {
    const reason = `campaign-map mapBosses.ts / mapBossFacts.ts could not be loaded: ${error instanceof Error ? error.message : String(error)}`;
    checks.push(skipped('mapbosses.page', 'Map bosses vs the Endgame Maps page', reason));
  }

  // 9. Guide
  const headGuide = parseJson(headText(GUIDE_FILE)) as GuideBundle | null;
  const workingGuide = parseJson(workingText(GUIDE_FILE)) as GuideBundle | null;
  checks.push(recipesCheck(headGuide, workingGuide), dataBlocksCheck(headGuide, workingGuide));
  if (oldCommit === null) checks.push(skipped('guide.patch-notes', 'Guide notes named in the new patch notes', noOld));
  else {
    const patchNotes: PatchNote[] = changedPaths(esrDir, oldCommit, newCommit, ['patchnotes/']).flatMap((path) => {
      const version = versionFromPatchNoteFile(path);
      const text = runGit(esrDir, ['show', `${newCommit}:${path}`]);
      return version === null || text === null ? [] : [{ version, text }];
    });
    checks.push(patchNoteMentionsCheck(workingGuide, patchNotes));
  }

  // 10. Icons
  const iconInputs = (get: (file: string) => Doc | null) => ({
    icons: get('icons.json'),
    bases: get('bases.json'),
    lootfilter: get('lootfilter.json'),
  });
  checks.push(missingIconsCheck(iconInputs(h), iconInputs(w)));
  checks.push(cubeIconsCheck({ cube: h('cube.json'), icons: h('icons.json') }, { cube: w('cube.json'), icons: w('icons.json') }));
  const vanillaDir = resolveVanillaArtDir(undefined);
  checks.push(
    vanillaArtCheck(
      relative(REPO_ROOT, vanillaDir) || vanillaDir,
      existsSync(vanillaDir),
      headManifest.esrVersion !== workingManifest.esrVersion
    )
  );
  const hdPaths = ESR_SPARSE_PATHS.filter((path) => path.includes('/hd/')).map((path) => path.replace(/^\//, ''));
  checks.push(
    oldCommit === null
      ? skipped('icons.inputs', 'Icon inputs in the clone', noOld)
      : iconInputsCheck(changedPaths(esrDir, oldCommit, newCommit, hdPaths))
  );

  // 11. Runeword and gemword variants
  checks.push(...(await variantChecks(esrDir, oldCommit, newCommit)));

  // 11b. Tables vs the generated docs pages the app parses (were the docs regenerated?)
  const excelDir = 'Eastern_Sun_Resurrected.mpq/data/global/excel/';
  checks.push(
    oldCommit === null
      ? skipped('docs.lag', 'Tables vs the generated docs pages', noOld)
      : docsLagCheck(
          changedPaths(
            esrDir,
            oldCommit,
            newCommit,
            Object.keys(DOCS_PAGES_BY_TABLE).map((table) => `${excelDir}${table}`)
          ),
          changedPaths(esrDir, oldCommit, newCommit, ['docs/'])
        )
  );

  // 11c. Docs pages and D2RLoader configs that hand-written app data or content/ notes follow
  if (oldCommit === null) checks.push(skipped('refs.followed', 'Changed ESR files the app follows', noOld));
  else {
    const changed = changedPaths(esrDir, oldCommit, newCommit, ['docs/', 'd2rloader/', ESR_DESECRATED_ZONES_FILE]).filter(
      isReferenceCandidate
    );
    const contentFiles = listFiles(join(REPO_ROOT, 'content'), (path) => /\.(md|ya?ml)$/.test(path)).map((path) => ({
      path: relative(REPO_ROOT, path),
      text: readFileSync(path, 'utf8'),
    }));
    checks.push(referencesCheck(changed, citationsIn(changed, contentFiles)));
  }

  // 14. Loot filter (offline)
  const constants = await importSrc<TemplateConstants>('features/loot-filter/utils/template.ts').catch(() => null);
  checks.push(
    pluginVersionCheck(launcherOld.lootFilterPlugin, launcherNew.lootFilterPlugin, constants?.LOOT_FILTER_PLUGIN_VERSION ?? null)
  );
  checks.push(
    oldCommit === null
      ? skipped('lootfilter.sources', 'Live loot filter repositories', noOld)
      : lootFilterSourcesCheck(
          runGit(esrDir, ['show', `${oldCommit}:${LOOT_FILTER_SOURCES_FILE}`]),
          runGit(esrDir, ['show', `${newCommit}:${LOOT_FILTER_SOURCES_FILE}`])
        )
  );
  checks.push(
    templateValidation(
      { lootfilter: h('lootfilter.json'), types: h('types.json') },
      { lootfilter: w('lootfilter.json'), types: w('types.json') }
    )
  );

  // 12, 13, 14. Online
  if (values.offline) {
    const reason = 'Offline (--offline).';
    checks.push(
      skipped('net.docs-site', 'Docs site vs clone docs/', reason),
      skipped('net.links', 'External links', reason),
      skipped('net.discord', 'Discord invite', reason),
      skipped('lootfilter.template', "Sully's template", reason),
      skipped('lootfilter.assets', "Sully's icons and sounds", reason)
    );
  } else {
    checks.push(await docsSite(esrDir, launcherNew.modVersion));
    try {
      const nav = await importSrc<NavConfig>('core/navigation/navConfig.ts');
      const guideHome = await importSrc<GuideHome>('features/guide/utils/guideHome.ts');
      checks.push(await links(nav, guideHome), await discord(nav.DISCORD_URL));
    } catch (error) {
      const reason = `navConfig.ts / guideHome.ts could not be loaded: ${error instanceof Error ? error.message : String(error)}`;
      checks.push(skipped('net.links', 'External links', reason), skipped('net.discord', 'Discord invite', reason));
    }
    checks.push(...(await sully(constants)));
  }

  // 15. Docs quoting the old version
  const oldVersion = headManifest.esrVersion ?? null;
  const hits =
    oldVersion === null
      ? []
      : VERSION_DOC_DIRS.flatMap((dir) =>
          listFiles(join(REPO_ROOT, dir), (path) => statSync(path).size < 2_000_000).flatMap((path) => {
            const text = readFileSync(path, 'utf8');
            if (text.includes('\0')) return [];
            const count = countVersionMentions(text, oldVersion);
            return count === 0 ? [] : [{ path: relative(REPO_ROOT, path), count }];
          })
        );
  checks.push(oldVersionDocsCheck(oldVersion, oldVersion !== (workingManifest.esrVersion ?? null), hits));

  // 16. Self-check
  const buildDir = join(REPO_ROOT, 'src/features/game-data/build');
  const sourceWarningClasses = listFiles(buildDir, (path) => path.endsWith('.ts') && !path.endsWith('.test.ts')).flatMap((path) =>
    warningClassesInSource(readFileSync(path, 'utf8')).map((cls) => ({ file: relative(REPO_ROOT, path), cls }))
  );
  checks.push(
    coverageCheck({
      bundleFiles: files,
      unknownSections,
      countKeys: Object.keys(workingManifest.counts ?? headManifest.counts ?? {}),
      warnings: workingManifest.warnings ?? [],
      sourceWarningClasses,
    })
  );
  const since = runGit(REPO_ROOT, ['log', '-1', '--format=%h', '--', ...SKILL_PATHS])?.trim() || null;
  const log = since === null ? '' : (runGit(REPO_ROOT, ['log', '--format=%h%x09%s', `${since}..HEAD`, '--', ...FEATURE_PATHS]) ?? '');
  checks.push(commitsCheck(since, featureCommits(log)));

  const appHead = runGit(REPO_ROOT, ['rev-parse', '--short', 'HEAD'])?.trim() ?? '—';
  const report: ReviewReport = {
    generatedAt: new Date().toISOString(),
    context: [
      `App: HEAD ${appHead} (ESR ${headManifest.esrVersion ?? '—'}) → working tree (ESR ${workingManifest.esrVersion ?? '—'})`,
      `Clone ${relative(REPO_ROOT, esrDir) || esrDir}: ${oldCommit?.slice(0, 8) ?? '—'} → ${newCommit.slice(0, 8)} (${cloneTag ?? 'untagged'})`,
      values.offline ? 'Network checks skipped (--offline)' : 'Network checks run',
    ],
    checks,
  };

  if (values.out !== undefined) {
    const out = resolve(process.cwd(), values.out);
    const jsonOut = out.endsWith('.md') ? out.replace(/\.md$/, '.json') : `${out}.json`;
    writeFileSync(out, formatMarkdown(report));
    writeFileSync(jsonOut, `${JSON.stringify(report, null, 2)}\n`);
    const counts = countByStatus(checks);
    console.log(
      `Wrote ${out} and ${jsonOut}: ` +
        `${String(counts.finding)} findings, ${String(counts.info)} info, ${String(counts.ok)} ok, ${String(counts.skipped)} skipped.`
    );
  }
  if (values.json) console.log(JSON.stringify(report, null, 2));
  else if (values.out === undefined) process.stdout.write(formatText(report));
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(error instanceof UsageError ? error.exitCode : 1);
}
