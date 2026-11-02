/**
 * The bundled starting point: Sully's QoL filter (v0.6.11), the filter the ESR launcher pulls live from
 * github.com/Thisisnotsully/QoL-Filter since ESR 3.2.22 (`LootFilters/sources.json`). The copy in `public/loot-filters/`
 * is his `Sullys-QoL-Filter.json` verbatim (v0.6.2 fixed the `9pm` typo and the trailing comma we had patched in
 * v0.6.1, v0.6.3 adds a 500k+ gold stack rule, v0.6.7 a +1 all skills base highlight and "except +all skills" hide rules, v0.6.9 to
 * v0.6.11 hide Ancient Scrolls at level 4, add Mythical Jewels to the rare jewel rule and fix ancient coupon tier lists;
 * its `"activeInLevels": 4` is a number, not a list, so the editor reports one error; strict JSON apart from the `//` comments). Up to ESR 3.2.21
 * the mod shipped an earlier conversion of the same filter as `LootFilters/esr-default-filter.json`.
 */
export const TEMPLATE_NAME = "Sully's QoL Filter";
/** The bundled template's `version` (checked against the file by a test); filters started from it record it in `basedOn`. */
export const TEMPLATE_VERSION = '0.6.11';
/** The `basedOn.template` (and `based_on_template` column) value of filters started from the bundled template. */
export const TEMPLATE_ID = 'sullys-qol';
export const TEMPLATE_CREDIT = `Sully's QoL filter v${TEMPLATE_VERSION}, the filter the ESR launcher ships live from github.com/Thisisnotsully/QoL-Filter; icons and sounds by Sully`;
/** The ESR loot filter plugin version the editor targets; shared filters record it. Bump when the editor follows a new plugin. */
export const LOOT_FILTER_PLUGIN_VERSION = '1.5.3';
export const TEMPLATE_FILE = 'sullys-qol-filter.json';

/** A file under `public/loot-filters/` (the template, bundled sounds and icons). */
export function lootFilterAssetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}loot-filters/${path}`;
}

/** Fetches the bundled template's file text. */
export async function fetchTemplateText(): Promise<string> {
  const response = await fetch(lootFilterAssetUrl(TEMPLATE_FILE));
  if (!response.ok) throw new Error(`HTTP ${String(response.status)}`);
  return response.text();
}

let templateText: Promise<string> | null = null;

/**
 * The bundled template's text, fetched once per page load (the library's pinned card and Start from Sully's share it);
 * a failed fetch is forgotten so the next call retries.
 */
export function loadTemplateText(): Promise<string> {
  templateText ??= fetchTemplateText().catch((error: unknown) => {
    templateText = null;
    throw error;
  });
  return templateText;
}
