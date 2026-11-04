#!/usr/bin/env node
/**
 * Read-only scan of PROD's public user data after an ESR update: which references of public builds, favourites
 * (`favorite_counts`) and public loot filters no longer resolve in the current data (public/game-data/ and the names
 * parsed from the clone's docs/*.htm with the app's own parsers under jsdom).
 *
 *   node scripts/check-user-data.ts [--json] [--out <file>] [--limit <n>] [--esr <dir>] [--review <file.json>]
 *
 *   --json            print the report as JSON (default: text)
 *   --out <file>      write the report to <file> instead of stdout
 *   --limit <n>       affected items listed in the text output (default 50; 0 lists all; JSON always has all)
 *   --esr <dir>       ESR clone whose docs/ is parsed (default: ESR_SOURCE_DIR or ../Eastern_Sun_Resurrected)
 *   --review <file>   esr-update-review.ts JSON: also list still-resolving references its findings mention (variant
 *                     shifts: `runeword:<name>:<variant>` ids that now point at another recipe)
 *
 * Reads VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY from .env.production (the publishable key; never printed). GET
 * requests only, through the REST API with the anon role: it sees exactly what any visitor sees. Prints public display
 * names and build / filter names only. Exit 0 when the scan ran (affected items are not a failure), 2 when it could
 * not run (no env, network or HTTP error).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { parseArgs, parseEnv } from 'node:util';
import { readRevision, REPO_ROOT, resolveEsrDir } from './lib/esrClone.ts';
import { importSrc } from './lib/srcImport.ts';
import { buildCurrentData, type GameDataBundles, type HtmNames, type HtmRecipe } from './lib/userData/currentData.ts';
import { formatScanText, ScanCollector } from './lib/userData/report.ts';
import { buildRecipeKeys, checkBuild, checkFavorite, checkLootFilter, reviewMentions, type ReviewJson } from './lib/userData/resolve.ts';

const PAGE_SIZE = 1000;
const GAME_DATA_DIR = join(REPO_ROOT, 'public', 'game-data');

class CannotRun extends Error {}

// ---------------------------------------------------------------------------
// Supabase (GET only)
// ---------------------------------------------------------------------------

interface Supabase {
  readonly url: string;
  readonly key: string;
}

function loadSupabase(): Supabase {
  const path = join(REPO_ROOT, '.env.production');
  if (!existsSync(path)) throw new CannotRun('.env.production not found');
  const env = parseEnv(readFileSync(path, 'utf8'));
  const url = env.VITE_SUPABASE_URL?.trim() ?? '';
  const key = env.VITE_SUPABASE_ANON_KEY?.trim() ?? '';
  if (url === '' || key === '') throw new CannotRun('VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY missing in .env.production');
  return { url: url.replace(/\/+$/, ''), key };
}

/** Every row of `table` for `query`, paged by PAGE_SIZE (PostgREST caps a response at 1000 rows). */
async function fetchAll<T>(supabase: Supabase, table: string, query: string): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const url = `${supabase.url}/rest/v1/${table}?${query}&limit=${String(PAGE_SIZE)}&offset=${String(offset)}`;
    let response: Response;
    try {
      response = await fetch(url, { method: 'GET', headers: { apikey: supabase.key, Authorization: `Bearer ${supabase.key}` } });
    } catch (error) {
      throw new CannotRun(`network error reading ${table}: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!response.ok) {
      const body = (await response.text()).slice(0, 300);
      throw new CannotRun(`reading ${table} failed: HTTP ${String(response.status)} ${body}`);
    }
    const page = (await response.json()) as T[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

interface Author {
  display_name?: unknown;
  discriminator?: unknown;
}

interface BuildRow {
  name: unknown;
  class: unknown;
  build_data: unknown;
  esr_version: string | null;
  esr_version_updated: string | null;
  author: Author | null;
}

interface FilterRow {
  name: unknown;
  content: unknown;
  esr_version: string | null;
  esr_version_updated: string | null;
  author: Author | null;
}

interface FavoriteCountRow {
  item_id: string;
  count: number;
}

const authorText = (author: Author | null): string =>
  author !== null && typeof author.display_name === 'string'
    ? `${author.display_name}#${typeof author.discriminator === 'number' ? String(author.discriminator) : '????'}`
    : '(unknown author)';

const rowLabel = (name: unknown, author: Author | null): string =>
  `${JSON.stringify(typeof name === 'string' ? name : '(unnamed)')} by ${authorText(author)}`;

// ---------------------------------------------------------------------------
// Current data
// ---------------------------------------------------------------------------

function readBundle(name: string): unknown {
  return JSON.parse(readFileSync(join(GAME_DATA_DIR, `${name}.json`), 'utf8'));
}

function readBundles(): GameDataBundles {
  return {
    bases: readBundle('bases'),
    sets: readBundle('sets'),
    skills: readBundle('skills'),
    crafting: readBundle('crafting'),
    enhance: readBundle('enhance'),
    lootfilter: readBundle('lootfilter'),
    types: readBundle('types'),
    itemTextSkills: (readBundle('itemtext') as { skills: { id: number }[] }).skills,
  } as GameDataBundles;
}

interface Parsers {
  parseRunewordsHtml: (html: string) => HtmRecipe[];
  parseGemwordsHtml: (html: string) => HtmRecipe[];
  parseHtmUniqueItems: (html: string, page: 'weapons' | 'armors' | 'other') => { name: string; baseItemCode: string }[];
  parseMythicalUniques: (html: string) => { name: string }[];
  parseAscendancies: (html: string) => { name: string }[];
}

const HTM_FILES = [
  'runewords.htm',
  'gemwords.htm',
  'unique_weapons.htm',
  'unique_armors.htm',
  'unique_others.htm',
  'unique_mythicals.htm',
  'ascendancies.htm',
];

/** The HTM names from `<clone>/docs`, parsed with the app's parsers under jsdom; a reason string when unavailable. */
async function readHtmNames(esrDir: string): Promise<HtmNames | string> {
  const docs = join(esrDir, 'docs');
  const missing = HTM_FILES.filter((file) => !existsSync(join(docs, file)));
  if (missing.length > 0) return `missing in ${relative(REPO_ROOT, docs)}: ${missing.join(', ')}`;
  const jsdomModule = 'jsdom';
  const { JSDOM } = (await import(jsdomModule)) as { JSDOM: new () => { window: Record<string, unknown> } };
  const window = new JSDOM().window;
  for (const name of ['DOMParser', 'Node', 'Element', 'HTMLElement', 'Text', 'NodeFilter']) {
    (globalThis as Record<string, unknown>)[name] = window[name];
  }
  const parsers: Parsers = {
    ...(await importSrc<Pick<Parsers, 'parseRunewordsHtml'>>('features/data-sync/parsers/runewordsParser.ts')),
    ...(await importSrc<Pick<Parsers, 'parseGemwordsHtml'>>('features/data-sync/parsers/gemwordsParser.ts')),
    ...(await importSrc<Pick<Parsers, 'parseHtmUniqueItems'>>('features/data-sync/parsers/htmUniqueItemsParser.ts')),
    ...(await importSrc<Pick<Parsers, 'parseMythicalUniques'>>('features/data-sync/parsers/mythicalUniquesParser.ts')),
    ...(await importSrc<Pick<Parsers, 'parseAscendancies'>>('features/data-sync/parsers/ascendanciesParser.ts')),
  };
  const html = (file: string) => readFileSync(join(docs, file), 'utf8');
  // The parsers log their progress; keep stdout for the report
  const log = console.log;
  console.log = (...args: unknown[]) => {
    console.error(...args);
  };
  try {
    return {
      runewords: parsers.parseRunewordsHtml(html('runewords.htm')),
      gemwords: parsers.parseGemwordsHtml(html('gemwords.htm')),
      uniques: [
        ...parsers.parseHtmUniqueItems(html('unique_weapons.htm'), 'weapons'),
        ...parsers.parseHtmUniqueItems(html('unique_armors.htm'), 'armors'),
        ...parsers.parseHtmUniqueItems(html('unique_others.htm'), 'other'),
      ],
      mythicals: parsers.parseMythicalUniques(html('unique_mythicals.htm')),
      ascendancies: parsers.parseAscendancies(html('ascendancies.htm')).map((entry) => entry.name),
    };
  } finally {
    console.log = log;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const USAGE = `Usage: node scripts/check-user-data.ts [--json] [--out <file>] [--limit <n>] [--esr <dir>] [--review <file.json>]

Read-only scan of PROD's public builds, favourite counts and public loot filters: lists the references that no longer
resolve in public/game-data/ and the clone's docs/*.htm. Exit 0 when it ran, 2 when it could not.`;

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      json: { type: 'boolean', default: false },
      out: { type: 'string' },
      limit: { type: 'string', default: '50' },
      esr: { type: 'string' },
      review: { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) {
    console.log(USAGE);
    return;
  }
  const limit = Number(values.limit);
  if (!Number.isInteger(limit) || limit < 0) throw new CannotRun(`--limit must be a whole number from 0, not "${values.limit}"`);
  const supabase = loadSupabase();

  const manifest = readBundle('manifest') as { esrVersion: string; esrTag: string | null };
  const esrDir = resolveEsrDir(values.esr);
  const htm = existsSync(esrDir) ? await readHtmNames(esrDir) : `no ESR clone at ${relative(REPO_ROOT, esrDir)}`;
  const data = buildCurrentData(readBundles(), typeof htm === 'string' ? null : htm);
  const review = values.review === undefined ? null : (JSON.parse(readFileSync(resolve(values.review), 'utf8')) as ReviewJson);

  const [favorites, builds, filters] = await Promise.all([
    fetchAll<FavoriteCountRow>(supabase, 'favorite_counts', 'select=item_id,count&count=gt.0&order=item_id.asc'),
    fetchAll<BuildRow>(
      supabase,
      'builds',
      'select=id,name,class,build_data,esr_version,esr_version_updated,author:profiles!builds_user_id_fkey(display_name,discriminator)&order=id.asc'
    ),
    fetchAll<FilterRow>(
      supabase,
      'loot_filters',
      'select=id,name,content,esr_version,esr_version_updated,author:profiles!loot_filters_user_id_fkey(display_name,discriminator)&is_private=eq.false&order=id.asc'
    ),
  ]);

  const collector = new ScanCollector();
  const mentionLabels = new Map<string, string[]>();
  const mention = (key: string, label: string) => mentionLabels.set(key, [...(mentionLabels.get(key) ?? []), label]);
  for (const row of favorites) {
    const label = `${row.item_id} (${String(row.count)} favourite${row.count === 1 ? '' : 's'})`;
    collector.add('favourite', label, checkFavorite(row.item_id, data));
    mention(row.item_id, `favourite: ${label}`);
  }
  for (const row of builds) {
    const label = rowLabel(row.name, row.author);
    collector.add('build', label, checkBuild(row.class, row.build_data, data));
    collector.version('build', row.esr_version_updated ?? row.esr_version);
    for (const key of buildRecipeKeys(row.build_data)) mention(key, `build: ${label} uses ${key}`);
  }
  for (const row of filters) {
    collector.add('loot filter', rowLabel(row.name, row.author), checkLootFilter(row.content, data));
    collector.version('loot filter', row.esr_version_updated ?? row.esr_version);
  }
  if (review !== null) {
    for (const [key, lines] of reviewMentions(review, mentionLabels.keys())) {
      for (const label of mentionLabels.get(key) ?? []) collector.reviewMentions.push({ label, lines });
    }
  }

  const clone = existsSync(esrDir) ? readRevision(esrDir) : null;
  const context = [
    'Supabase: PROD (.env.production, anon role, GET only)',
    `Game data: public/game-data at ESR ${manifest.esrVersion} (tag ${manifest.esrTag ?? '(none)'})`,
    typeof htm === 'string'
      ? `HTM names: not available (${htm}); runeword, gemword, unique, mythical and ascendancy references are unchecked`
      : `HTM names: ${relative(REPO_ROOT, join(esrDir, 'docs'))} (clone ${clone?.tag ?? clone?.commit?.slice(0, 7) ?? '?'}): ` +
        `${String(htm.runewords.length)} runewords, ${String(htm.gemwords.length)} gemwords, ${String(htm.uniques.length)} uniques, ` +
        `${String(htm.mythicals.length)} mythicals, ${String(htm.ascendancies.length)} ascendancies`,
    ...(values.review === undefined ? [] : [`Review: ${values.review}`]),
  ];
  const report = collector.report(context);
  const output = values.json ? `${JSON.stringify(report, null, 2)}\n` : formatScanText(report, limit);
  if (values.out === undefined) process.stdout.write(output);
  else {
    writeFileSync(resolve(values.out), output);
    console.error(`Wrote ${values.out}`);
  }
}

main().catch((error: unknown) => {
  console.error(`check-user-data: ${error instanceof Error ? error.message : String(error)}`);
  // 2: the scan could not run (env, network, HTTP); 1: anything else (a bug)
  process.exit(error instanceof CannotRun ? 2 : 1);
});
