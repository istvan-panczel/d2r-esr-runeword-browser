/** The `basedOn.template` (and `based_on_template` column) values of the bundled templates. */
export type BundledTemplateId = 'sullys-qol' | 'example';

/**
 * A filter bundled under `public/loot-filters/`: shown as a pinned card on the Shared tab, readable in its sandbox
 * (`sandboxPath`) and a starting point for drafts, which record `{ template: id, version, label }` in `basedOn`. The
 * version is never written here: it is the `version` of the text in use (`loadTemplate` in `templateSource.ts`: the
 * live file when the template has a `liveUrl` and it passes `checkTemplateText`, else the bundled copy), and drafts
 * started from a lower version get "Update available".
 */
export interface BundledTemplate {
  readonly id: BundledTemplateId;
  /** The file's `title`: the draft name and the start of the `basedOn` label ("<name> v<version>"). */
  readonly name: string;
  /** The file's `author`. */
  readonly author: string;
  /** The bundled copy under `public/loot-filters/`: the fallback when the live file cannot be used. */
  readonly file: string;
  /**
   * The upstream file the app loads first (a plain GET: no custom headers, so no CORS preflight); a valid live file
   * always wins over the bundled copy, whatever its version, as in the ESR launcher.
   */
  readonly liveUrl?: string;
  /** The upstream repository (the credit, the "could not load" reason, and the icons and sounds the site does not bundle). */
  readonly repoUrl?: string;
  /** The sandbox route that shows it without copying it. */
  readonly sandboxPath: string;
  /** The library button that starts a draft from it. */
  readonly startLabel: string;
  /** The pinned card's text. */
  readonly summary: string;
  /** The credit line under the start buttons (no final period). */
  readonly credit: string;
}

/**
 * Sully's QoL filter, the filter the ESR launcher pulls live from github.com/Thisisnotsully/QoL-Filter since ESR 3.2.22
 * (`LootFilters/sources.json`, every 10 minutes, keeping the last good file). The app does the same: it loads
 * `Sullys-QoL-Filter.json` from his main branch and falls back to the verbatim copy in `public/loot-filters/`
 * (`npm run loot-filter:template` refreshes it). Since v0.9.0 the file is grouped for this editor into `// ====` parts
 * and `// ----` sections; its `"activeInLevels": 4` is a number, not a list, which works in game, so the editor reads it
 * as `[4]` with one warning. Up to ESR 3.2.21 the mod shipped an earlier conversion of the same filter as
 * `LootFilters/esr-default-filter.json`.
 */
export const SULLYS_QOL_TEMPLATE: BundledTemplate = {
  id: 'sullys-qol',
  name: "Sully's QoL Filter",
  author: 'Sully',
  file: 'sullys-qol-filter.json',
  liveUrl: 'https://raw.githubusercontent.com/Thisisnotsully/QoL-Filter/refs/heads/main/Sullys-QoL-Filter.json',
  repoUrl: 'https://github.com/Thisisnotsully/QoL-Filter',
  sandboxPath: '/loot-filters/sully',
  startLabel: "Start from Sully's QoL filter",
  summary: 'The filter the ESR launcher gives every player. Start from it to change its rules.',
  credit:
    "Sully's QoL filter, the filter the ESR launcher ships live from github.com/Thisisnotsully/QoL-Filter (this site loads his latest too, with a bundled copy as fallback); icons and sounds by Sully",
};

/**
 * Our commented example filter (`example-filter.json`): 28 of the editor's example rules (`exampleRules.ts`, built
 * with their default presentation and the style presets they use) over two levels (Leveling, Strict), each comment
 * starting with the example's title and then explaining the rule, under a `// ---- <group>` section heading per example
 * group. It uses Sully's sounds and the generated icons. Bump its `version` with every change: drafts started from a
 * lower one see "Update available". exampleFilter.test.ts checks every rule against its example.
 */
export const EXAMPLE_TEMPLATE: BundledTemplate = {
  id: 'example',
  name: 'Example filter (with explanations)',
  author: 'D2R ESR Runeword Browser',
  file: 'example-filter.json',
  sandboxPath: '/loot-filters/example',
  startLabel: 'Start from the example',
  summary: 'A small filter to learn from: every rule says in its comment what it does and what to change.',
  credit:
    'Example filter, built for this site from its example rules to show how rules work; sounds by Sully, icons generated for this app',
};

/** The version of each template's text in use (live or bundled); a template not loaded yet is missing. */
export type TemplateVersions = Readonly<Partial<Record<BundledTemplateId, string | null>>>;

/** The bundled templates by id. */
export const BUNDLED_TEMPLATES: Readonly<Record<BundledTemplateId, BundledTemplate>> = {
  'sullys-qol': SULLYS_QOL_TEMPLATE,
  example: EXAMPLE_TEMPLATE,
};

/** The bundled templates in display order (Sully's first: the recommended start). */
export const BUNDLED_TEMPLATE_LIST: readonly BundledTemplate[] = [SULLYS_QOL_TEMPLATE, EXAMPLE_TEMPLATE];

/** The bundled template with this id (a `basedOn.template` / `based_on_template` value); null for any other text. */
export function bundledTemplate(id: string | null | undefined): BundledTemplate | null {
  return BUNDLED_TEMPLATE_LIST.find((template) => template.id === id) ?? null;
}

/** The ESR loot filter plugin version the editor targets; shared filters record it. Bump when the editor follows a new plugin. */
export const LOOT_FILTER_PLUGIN_VERSION = '1.8.2';

/** A file under `public/loot-filters/` (the templates, bundled sounds and icons). */
export function lootFilterAssetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}loot-filters/${path}`;
}

/** Fetches a bundled template's own copy (same origin, under `public/loot-filters/`). */
export async function fetchBundledTemplateText(id: BundledTemplateId, fetchImpl: typeof fetch = fetch): Promise<string> {
  const response = await fetchImpl(lootFilterAssetUrl(BUNDLED_TEMPLATES[id].file));
  if (!response.ok) throw new Error(`HTTP ${String(response.status)}`);
  return response.text();
}
