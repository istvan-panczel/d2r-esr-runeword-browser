/**
 * Checks of things outside the bundles: the live docs site and links (the CLI does the requests), the loot filter
 * plugin, live filter repositories, Sully's upstream template and assets, template validation against the new data,
 * and the docs that quote the old ESR version. Pure: every input is already fetched or read.
 */
import { capLines, finding, info, ok, type Check } from './report.ts';

// ---------------------------------------------------------------------------------------------------------------------
// 12. Docs site freshness

export interface PageComparison {
  file: string;
  /** same: live bytes = clone docs/<file>; differs; error: the request failed (detail says why) */
  result: 'same' | 'differs' | 'error';
  detail?: string;
}

export function docsSiteCheck(pages: readonly PageComparison[], liveModVersion: string | null, cloneModVersion: string | null): Check {
  const title = 'Docs site vs clone docs/';
  const differs = pages.filter((page) => page.result === 'differs');
  const errors = pages.filter((page) => page.result === 'error');
  const lines = [
    ...differs.map((page) => `differs: ${page.file}${page.detail ? ` (${page.detail})` : ''}`),
    ...errors.map((page) => `failed: ${page.file} (${page.detail ?? 'error'})`),
    `live metadata.json modVersion ${liveModVersion ?? '—'}, clone ${cloneModVersion ?? '—'}`,
  ];
  const metadataLags = liveModVersion !== cloneModVersion;
  if (differs.length > 0 || metadataLags) {
    return finding(
      'net.docs-site',
      title,
      `${String(differs.length)} of ${String(pages.length)} live pages differ from the clone${metadataLags ? '; the live metadata.json has another modVersion' : ''}`,
      'the app parses the live pages at runtime and caches them per modVersion: until the site matches, players see other runewords, uniques and socketables than the bundles describe (a later docs fix without a version bump needs an app release)',
      lines
    );
  }
  if (errors.length > 0)
    return info('net.docs-site', title, `${String(errors.length)} pages could not be fetched; the others match.`, lines);
  return ok(
    'net.docs-site',
    title,
    `All ${String(pages.length)} pages the app parses match the clone byte for byte; modVersion ${cloneModVersion ?? '—'} live.`
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// 13. Links

export interface LinkResult {
  url: string;
  /** Final HTTP status after redirects; null when the request failed */
  status: number | null;
  error?: string;
  /** Where the link is used, e.g. "OFFICIAL_LINKS esr-site" */
  where: string;
}

export function linksCheck(results: readonly LinkResult[]): Check {
  const title = 'External links';
  const bad = results.filter((result) => result.status === null || result.status >= 400);
  const lines = bad.map(
    (result) => `${result.status === null ? (result.error ?? 'failed') : String(result.status)} ${result.url} (${result.where})`
  );
  if (bad.length > 0) {
    return finding(
      'net.links',
      title,
      `${String(bad.length)} of ${String(results.length)} links fail`,
      'the header menu, home page, community tools or guide link a dead page (fix in src/core/navigation/navConfig.ts or guideHome.ts)',
      lines
    );
  }
  return ok('net.links', title, `All ${String(results.length)} links answer below 400.`);
}

export function discordCheck(code: string, body: unknown, error: string | null): Check {
  const title = 'Discord invite';
  const record = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : null;
  const guild =
    record !== null && typeof record.guild === 'object' && record.guild !== null ? (record.guild as Record<string, unknown>) : null;
  const name = typeof guild?.name === 'string' ? guild.name : null;
  const expires = record?.expires_at;
  if (error !== null || name === null) {
    return finding(
      'net.discord',
      title,
      `Invite ${code} is not valid (${error ?? 'no guild in the answer'})`,
      'the "ESR Discord" link on the header and home page leads nowhere (DISCORD_URL in navConfig.ts)'
    );
  }
  if (expires !== null && expires !== undefined) {
    return finding(
      'net.discord',
      title,
      `Invite ${code} (${name}) expires at ${JSON.stringify(expires)}`,
      'the Discord link stops working on that date (DISCORD_URL in navConfig.ts)'
    );
  }
  return ok('net.discord', title, `Invite ${code} is valid: "${name}", never expires.`);
}

// ---------------------------------------------------------------------------------------------------------------------
// 14. Loot filter

export function pluginVersionCheck(before: string | null, after: string | null, appVersion: string | null): Check {
  const title = 'Loot filter plugin version';
  const line = `DLL ${before ?? '—'} → ${after ?? '—'}, LOOT_FILTER_PLUGIN_VERSION ${appVersion ?? '—'}`;
  if (after === null) return info('lootfilter.plugin', title, 'No version found in the loot filter DLL.', [line]);
  if (after !== appVersion) {
    return finding(
      'lootfilter.plugin',
      title,
      `The clone ships plugin ${after}, the editor targets ${appVersion ?? '—'}`,
      'shared filters record the plugin version and the evaluator, quirks and JSONC rules were verified on the old one: re-verify in game, then bump LOOT_FILTER_PLUGIN_VERSION (src/features/loot-filter/utils/template.ts)',
      [line]
    );
  }
  if (before !== after)
    return info('lootfilter.plugin', title, `Plugin ${before ?? '—'} → ${after}, already the editor's version.`, [line]);
  return ok('lootfilter.plugin', title, `Plugin ${after} = LOOT_FILTER_PLUGIN_VERSION.`);
}

/** Repository URLs of LootFilters/sources.json (JSON with `//` comments). */
export function liveFilterRepositories(text: string | null): string[] {
  if (text === null) return [];
  return [...text.matchAll(/"url"\s*:\s*"([^"]+)"/g)].map((match) => match[1]);
}

export function lootFilterSourcesCheck(before: string | null, after: string | null): Check {
  const title = 'Live loot filter repositories';
  const a = liveFilterRepositories(before);
  const b = liveFilterRepositories(after);
  const added = b.filter((url) => !a.includes(url));
  const removed = a.filter((url) => !b.includes(url));
  const lines = [...added.map((url) => `+ ${url}`), ...removed.map((url) => `- ${url}`)];
  if (added.length + removed.length > 0) {
    return finding(
      'lootfilter.sources',
      title,
      'LootFilters/sources.json lists other repositories',
      'the launcher gives every player these filters live: the bundled template, its credit and the editor\'s "the filter the launcher ships" texts may now be wrong',
      lines
    );
  }
  if (before !== after)
    return info('lootfilter.sources', title, `Same repositories (${b.join(', ')}); the file text changed (branch, folder or comments).`);
  return ok('lootfilter.sources', title, `Unchanged: ${b.join(', ') || '(none)'}.`);
}

export interface TemplateInputs {
  upstreamText: string | null;
  upstreamVersion: string | null;
  bundledText: string;
  bundledVersion: string | null;
  /** The request error when upstream could not be fetched */
  error?: string;
}

export function sullyTemplateCheck(input: TemplateInputs): Check {
  const title = "Sully's template";
  const lines = [`upstream v${input.upstreamVersion ?? '—'}, bundled file v${input.bundledVersion ?? '—'}`];
  if (input.upstreamText === null)
    return info('lootfilter.template', title, `Upstream could not be fetched (${input.error ?? 'error'}).`, lines);
  if (input.upstreamText !== input.bundledText) {
    return finding(
      'lootfilter.template',
      title,
      `Upstream differs from public/loot-filters/sullys-qol-filter.json (v${input.upstreamVersion ?? '—'} vs v${input.bundledVersion ?? '—'})`,
      'the app loads the upstream file live, but falls back to this copy when GitHub cannot be reached or the file is broken: run npm run loot-filter:template',
      lines
    );
  }
  return ok('lootfilter.template', title, `Upstream = bundled copy (v${input.bundledVersion ?? '—'}).`);
}

export interface AssetLists {
  icons: readonly string[] | null;
  sounds: readonly string[] | null;
}

const ASSET_EXTENSIONS: Readonly<Record<keyof AssetLists, RegExp>> = { icons: /\.sprite$/i, sounds: /\.(wav|mp3|flac)$/i };

export function sullyAssetsCheck(upstream: AssetLists, local: AssetLists, error: string | null): Check {
  const title = "Sully's icons and sounds";
  if (upstream.icons === null || upstream.sounds === null)
    return info('lootfilter.assets', title, `Upstream listing failed (${error ?? 'error'}).`);
  const missing: string[] = [];
  const extra: string[] = [];
  for (const folder of ['icons', 'sounds'] as const) {
    const pattern = ASSET_EXTENSIONS[folder];
    const up = (upstream[folder] ?? []).filter((name) => pattern.test(name));
    const ours = (local[folder] ?? []).filter((name) => pattern.test(name));
    missing.push(...up.filter((name) => !ours.includes(name)).map((name) => `missing here: ${folder}/${name}`));
    extra.push(...ours.filter((name) => !up.includes(name)).map((name) => `only here: ${folder}/${name}`));
  }
  if (missing.length > 0) {
    return finding(
      'lootfilter.assets',
      title,
      `${String(missing.length)} upstream assets are not bundled`,
      'rules that name them play no sound or show no icon in the editor and sandbox (public/loot-filters/icons, sounds)',
      [...missing, ...extra]
    );
  }
  if (extra.length > 0) return ok('lootfilter.assets', title, 'Every upstream asset is bundled (plus a few bundled-only files).', extra);
  return ok('lootfilter.assets', title, 'Bundled icons and sounds = upstream.');
}

export interface DiagnosticLike {
  severity: string;
  path: string;
  message: string;
}

export interface TemplateValidation {
  file: string;
  /** Diagnostics against the HEAD bundles and against the working-tree bundles */
  before: readonly DiagnosticLike[];
  after: readonly DiagnosticLike[];
}

export function templateValidationCheck(results: readonly TemplateValidation[]): Check {
  const title = 'Bundled filters vs the new data';
  const key = (d: DiagnosticLike) => `${d.severity} ${d.path}: ${d.message}`;
  const added: string[] = [];
  const gone: string[] = [];
  const totals: string[] = [];
  for (const result of results) {
    const a = new Set(result.before.map(key));
    const b = new Set(result.after.map(key));
    added.push(...[...b].filter((k) => !a.has(k)).map((k) => `+ ${result.file} ${k}`));
    gone.push(...[...a].filter((k) => !b.has(k)).map((k) => `- ${result.file} ${k}`));
    totals.push(`${result.file}: ${String(b.size)} diagnostics`);
  }
  const lines = capLines([...added, ...gone].map((line) => (line.length > 300 ? `${line.slice(0, 299)}…` : line)));
  if (added.length > 0) {
    return finding(
      'lootfilter.validate',
      title,
      `${String(added.length)} new diagnostics in the bundled filters (${totals.join(', ')})`,
      'the editor shows them on the template and example every player starts from; usually renamed or moved codes, ids or stats',
      lines
    );
  }
  if (gone.length > 0)
    return info('lootfilter.validate', title, `${String(gone.length)} diagnostics gone, none new (${totals.join(', ')}).`, lines);
  return ok('lootfilter.validate', title, `Same diagnostics as with the HEAD data (${totals.join(', ')}).`);
}

// ---------------------------------------------------------------------------------------------------------------------
// 15. Docs quoting the old version

/** Occurrences of `version` not glued to another digit or dot-digit ("3.2.24" but not "3.2.240" or "13.2.24"). */
export function countVersionMentions(text: string, version: string): number {
  const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [...text.matchAll(new RegExp(`(?<![\\d.])${escaped}(?!\\.?\\d)`, 'g'))].length;
}

export function oldVersionDocsCheck(
  oldVersion: string | null,
  versionChanged: boolean,
  hits: readonly { path: string; count: number }[]
): Check {
  const title = 'Docs quoting the old ESR version';
  const lines = hits.map((hit) => `${hit.path}: ${String(hit.count)}`);
  const total = hits.reduce((sum, hit) => sum + hit.count, 0);
  if (oldVersion === null) return info('docs.old-version', title, 'No old esrVersion in the HEAD manifest.');
  if (!versionChanged)
    return ok(
      'docs.old-version',
      title,
      `ESR version unchanged; ${String(hits.length)} files quote ${oldVersion} (${String(total)} mentions).`
    );
  return info(
    'docs.old-version',
    title,
    `${String(hits.length)} files quote ${oldVersion} ${String(total)} times: update the ones that state current numbers.`,
    lines
  );
}
