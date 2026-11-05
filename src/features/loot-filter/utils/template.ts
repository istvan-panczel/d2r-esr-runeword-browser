/** The `basedOn.template` (and `based_on_template` column) values of the bundled templates. */
export type BundledTemplateId = 'sullys-qol' | 'example';

/**
 * A filter bundled under `public/loot-filters/`: shown as a pinned card on the Shared tab, readable in its sandbox
 * (`sandboxPath`) and a starting point for drafts, which record `{ template: id, version, label }` in `basedOn` and get
 * "Update available" once a newer `version` is bundled.
 */
export interface BundledTemplate {
  readonly id: BundledTemplateId;
  /** The file's `title`: the draft name and the start of the `basedOn` label ("<name> v<version>"). */
  readonly name: string;
  /** The file's `author`. */
  readonly author: string;
  /** The file's `version` (checked against the file by a test); bump it with the file. */
  readonly version: string;
  /** The file under `public/loot-filters/`. */
  readonly file: string;
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
 * Sully's QoL filter (v0.6.13), the filter the ESR launcher pulls live from github.com/Thisisnotsully/QoL-Filter since
 * ESR 3.2.22 (`LootFilters/sources.json`). The copy in `public/loot-filters/` is his `Sullys-QoL-Filter.json` verbatim
 * (v0.6.2 fixed the `9pm` typo and the trailing comma we had patched in v0.6.1, v0.6.3 adds a 500k+ gold stack rule,
 * v0.6.7 a +1 all skills base highlight and "except +all skills" hide rules, v0.6.9 to v0.6.11 hide Ancient Scrolls at
 * level 4, add Mythical Jewels to the rare jewel rule and fix ancient coupon tier lists, v0.6.12 to v0.6.13 add two Legendary
 * Materials (Lucion's Relic of Sanctification `u18`, Inarius' Everburning Halo `u40`); its `"activeInLevels": 4` is a
 * number, not a list, which works in game, so the editor reads it as `[4]` with one warning; strict JSON apart from the
 * `//` comments). Up to ESR 3.2.21 the mod shipped an earlier conversion of the same filter as
 * `LootFilters/esr-default-filter.json`.
 */
export const SULLYS_QOL_TEMPLATE: BundledTemplate = {
  id: 'sullys-qol',
  name: "Sully's QoL Filter",
  author: 'Sully',
  version: '0.6.13',
  file: 'sullys-qol-filter.json',
  sandboxPath: '/loot-filters/sully',
  startLabel: "Start from Sully's QoL filter",
  summary: 'The filter the ESR launcher gives every player, bundled with this site. Start from it to change its rules.',
  credit:
    "Sully's QoL filter v0.6.13, the filter the ESR launcher ships live from github.com/Thisisnotsully/QoL-Filter; icons and sounds by Sully",
};

/**
 * Our commented example filter (`example-filter.json`): 28 of the editor's example rules (`exampleRules.ts`, built
 * with their default presentation and the style presets they use) over two levels (Leveling, Strict), each comment
 * starting with the example's title and then explaining the rule. It uses Sully's sounds and the generated icons.
 * v2.0.0 (2026-11-05) replaced the hand-written v1.0.0 (21 rules, two custom styles, Sully's icons); drafts started
 * from v1.0.0 see "Update available". exampleFilter.test.ts checks every rule against its example.
 */
export const EXAMPLE_TEMPLATE: BundledTemplate = {
  id: 'example',
  name: 'Example filter (with explanations)',
  author: 'D2R ESR Runeword Browser',
  version: '2.0.0',
  file: 'example-filter.json',
  sandboxPath: '/loot-filters/example',
  startLabel: 'Start from the example',
  summary: 'A small filter to learn from: every rule says in its comment what it does and what to change.',
  credit:
    'Example filter v2.0.0, built for this site from its example rules to show how rules work; sounds by Sully, icons generated for this app',
};

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
export const LOOT_FILTER_PLUGIN_VERSION = '1.5.3';

/** A file under `public/loot-filters/` (the templates, bundled sounds and icons). */
export function lootFilterAssetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}loot-filters/${path}`;
}

/** Fetches a bundled template's file text. */
export async function fetchTemplateText(id: BundledTemplateId): Promise<string> {
  const response = await fetch(lootFilterAssetUrl(BUNDLED_TEMPLATES[id].file));
  if (!response.ok) throw new Error(`HTTP ${String(response.status)}`);
  return response.text();
}

const templateTexts = new Map<BundledTemplateId, Promise<string>>();

/**
 * A bundled template's text, fetched once per page load (its pinned card and its start button share it); a failed
 * fetch is forgotten so the next call retries.
 */
export function loadTemplateText(id: BundledTemplateId): Promise<string> {
  const cached = templateTexts.get(id);
  if (cached !== undefined) return cached;
  const loading = fetchTemplateText(id).catch((error: unknown) => {
    templateTexts.delete(id);
    throw error;
  });
  templateTexts.set(id, loading);
  return loading;
}
